require('dotenv').config();

// שמירת המודל שנמצא בזיכרון מטמון
let cachedModel = null;

/**
 * מזהה באופן דינמי את המודל הזמין והנתמך ביותר עבור מפתח ה-API
 */
async function getBestAvailableModel(apiKey) {
  if (cachedModel) return cachedModel;

  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listRes = await fetch(listUrl);

    if (!listRes.ok) {
      const errText = await listRes.text();
      let msg = errText;
      try { msg = JSON.parse(errText)?.error?.message || errText; } catch {}
      throw new Error(`שגיאת אימות מפתח API (${listRes.status}): ${msg}`);
    }

    const data = await listRes.json();
    const availableModels = (data.models || [])
      .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name.replace(/^models\//, ''));

    console.log('📋 מודלים שזוהו עבור המפתח שלך:', availableModels);

    // סדר עדיפויות לדגמי Flash חדישים (gemini-3.8-flash בראש הרשימה לפי המלצת Google)
    const preferences = [
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ];

    for (const pref of preferences) {
      const match = availableModels.find(m => m === pref || m.startsWith(pref));
      if (match) {
        cachedModel = match;
        console.log(`✅ נבחר מודל Gemini אופטימלי: ${cachedModel}`);
        return cachedModel;
      }
    }

    if (availableModels.length > 0) {
      cachedModel = availableModels[0];
      console.log(`✅ נבחר מודל זמין: ${cachedModel}`);
      return cachedModel;
    }

    // ברירת מחדל בטוחה
    return 'gemini-3.8-flash';
  } catch (error) {
    console.warn('אזהרה באיתור רשימת המודלים, משתמש ב-gemini-3.8-flash כברירת מחדל:', error.message);
    return 'gemini-3.8-flash';
  }
}

/**
 * שולח טקסט ל-Gemini API ומחזיר סיכום מובנה ואמיתי
 * @param {string} text - הטקסט המלא לסיכום
 * @param {string} depth - רמת פירוט: 'brief' או 'detailed'
 * @param {string} language - שפת הסיכום ('he' או 'en')
 * @param {string} [providedApiKey] - מפתח API שהועבר ישירות מהלקוח (אופציונלי)
 */
async function generateSummary(text, depth = 'detailed', language = 'he', providedApiKey = null) {
  const apiKey = (providedApiKey && providedApiKey.trim()) || process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
    throw new Error('נדרש מפתח Gemini API תקין. אנא הזינו מפתח בממשק או בקובץ .env');
  }

  // איתור המודל (מתחיל ב-gemini-3.8-flash)
  let model = await getBestAvailableModel(apiKey);

  const prompt = `
אתה עוזר AI מקצועי ומדויק לסיכום הרצאות, פגישות ומסמכי PDF.
קרא בעיון את כל הטקסט הבא והפק סיכום ברור, מקיף, מובנה ומדויק לחלוטין בהתבסס אך ורק על המידע המופיע בטקסט.

הנחיות קריטיות:
1. שפת הפלט: ${language === 'he' ? 'עברית רהוטה ומקצועית' : 'English'}.
2. עומק הפירוט: ${depth === 'brief' ? 'תמציתי וממוקד (נקודות עיקריות בלבד)' : 'מקיף, מעמיק ומפורט, המסביר כל נושא בהרחבה'}.
3. חובה להחזיר אך ורק אובייקט JSON תקין (ללא markdown backticks, ללא שום טקסט נוסף לפני או אחרי).

מבנה ה-JSON הנדרש:
{
  "title": "כותרת מדויקת וממצה למסמך",
  "executiveSummary": "תקציר מנהלים מעמיק של 2-3 פסקאות המסביר את מהות המסמך, הרקע והמסקנות",
  "keyTopics": [
    {
      "topic": "שם הנושא / הפרק",
      "details": "הסבר מפורט ומעמיק של כל הנקודות והרעיונות שעלו בנושא זה"
    }
  ],
  "keyTakeaways": [
    "מסקנה / תובנה משמעותית 1",
    "מסקנה / תובנה משמעותית 2",
    "מסקנה / תובנה משמעותית 3"
  ]
}

טקסט המקור לסיכום:
${text.slice(0, 45000)}
`;

  // רשימת ניסיונות: מתחילים במודל הנבחר, ואם הוא לא זמין ננסה gemini-3.8-flash ו-gemini-flash-latest
  const candidates = [model, 'gemini-3.8-flash', 'gemini-flash-latest'];
  const uniqueCandidates = [...new Set(candidates)];
  let lastError = null;

  for (const currentModel of uniqueCandidates) {
    try {
      console.log(`🤖 מנסה להפיק סיכום עם מודל: ${currentModel}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API Error with model ${currentModel} (status ${response.status}):`, errorText);
        let parsedErr;
        try { parsedErr = JSON.parse(errorText); } catch { parsedErr = null; }
        const msg = parsedErr?.error?.message || errorText;

        // אם המודל לא זמין או שפג תוקפו עבור משתמשים חדשים, ננסה את המודל הבא ברשימה
        if (response.status === 404 || msg.includes('no longer available') || msg.includes('not found')) {
          console.warn(`המודל ${currentModel} אינו זמין, מנסה מודל חלופי...`);
          cachedModel = null; // איפוס המטמון
          continue;
        }

        throw new Error(`שגיאת Gemini API (${response.status}): ${msg}`);
      }

      const data = await response.json();
      const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawContent) {
        throw new Error('לא התקבלה תשובה מ-Gemini API (התשובה ריקה).');
      }

      const cleanedJson = rawContent
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```$/i, '')
        .trim();

      const parsed = JSON.parse(cleanedJson);
      parsed.activeModel = currentModel;
      cachedModel = currentModel;
      return parsed;

    } catch (err) {
      lastError = err;
      if (err.message.includes('404') || err.message.includes('no longer available') || err.message.includes('not found')) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('נכשלה התקשורת עם Gemini API.');
}

module.exports = {
  generateSummary,
  getBestAvailableModel
};
