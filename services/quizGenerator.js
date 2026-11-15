require('dotenv').config();
const { getBestAvailableModel } = require('./aiService');

/**
 * מחולל בוחן שאלות אמריקאי (3-4 שאלות) באמצעות Gemini AI
 * @param {string} text - הטקסט או הסיכום שעליו יתבסס הבוחן
 * @param {string} language - שפת השאלון ('he' או 'en')
 * @param {string} [customApiKey] - מפתח API שהועבר מהלקוח (אופציונלי)
 */
async function generateQuiz(text, language = 'he', customApiKey = null) {
  const apiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('נדרש מפתח Gemini API תקין ליצירת בוחן.');
  }

  // איתור אוטומטי של המודל האופטימלי (gemini-3.8-flash)
  const model = await getBestAvailableModel(apiKey);

  const langInstruction = language === 'en'
    ? 'All questions, options, and explanations must be written in English.'
    : 'כל השאלות, אפשרויות התשובה וההסברים חייבים להיכתב בעברית.';

  const prompt = `
אתה מרצה ומדריך מומחה.
בהתבסס אך ורק על הטקסט/סיכום הבא, צור שאלון אמריקאי של 3 עד 4 שאלות לבדיקת הבנה של החומר.
${langInstruction}

לכל שאלה ספק:
- id: מספר רץ
- question: נוסח השאלה
- options: מערך של 4 אפשרויות תשובה
- correctAnswerIndex: אינדקס התשובה הנכונה (מספר מ-0 עד 3)
- explanation: הסבר קצר מדוע זו התשובה הנכונה לפי הטקסט

החזר אך ורק מערך JSON של שאלות (ללא שום markdown backticks):
[
  {
    "id": 1,
    "question": "...",
    "options": ["תשובה 1", "תשובה 2", "תשובה 3", "תשובה 4"],
    "correctAnswerIndex": 0,
    "explanation": "..."
  }
]

טקסט לניתוח:
${text.slice(0, 30000)}
`;

  // רשימת ניסיונות: מתחילים במודל הנבחר, עם חלופות במידת הצורך
  const candidates = [model, 'gemini-3.8-flash', 'gemini-flash-latest'];
  const uniqueCandidates = [...new Set(candidates)];
  let lastError = null;

  for (const currentModel of uniqueCandidates) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, responseMimeType: "application/json" }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        let parsedErr;
        try { parsedErr = JSON.parse(errText); } catch { parsedErr = null; }
        const msg = parsedErr?.error?.message || errText;

        if (response.status === 404 || msg.includes('no longer available') || msg.includes('not found')) {
          continue;
        }
        throw new Error(`שגיאת Gemini (${response.status}): ${msg}`);
      }

      const data = await response.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw) {
        throw new Error('לא התקבלה תשובה מ-Gemini API ליצירת הבוחן.');
      }

      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      // תמיכה בפורמט מערך או אובייקט שמכיל מערך
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (Array.isArray(parsed.questions)) {
        return parsed.questions;
      } else if (Array.isArray(parsed.quiz)) {
        return parsed.quiz;
      }
      return parsed;

    } catch (err) {
      lastError = err;
      if (err.message.includes('404') || err.message.includes('not found') || err.message.includes('no longer available')) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('נכשלה יצירת הבוחן מול Gemini API.');
}

module.exports = { generateQuiz };
