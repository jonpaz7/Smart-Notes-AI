# 📋 הנחיות פיתוח לענף 1: משימות חכמות וייצוא ליומן (Action Items & Calendar)

> **שם הענף (Branch):** `feature/action-items`  
> **מפתח אחראי:** אתה  
> **מטרת הפיצ'ר:** לאחר שהמסמך/PDF סוכם, ה-AI יסרוק אותו ויחלץ משימות קונקרטיות לביצוע (מי אחראי, מה המשימה, עדיפות ודדליין), יציג צ'ק-ליסט אינטראקטיבי, ויאפשר ייצוא לקובץ יומן (`.ics`) לחיבור ישיר ל-Google Calendar / Outlook.

---

## 🛠️ מה נדרש לממש? (צעד אחר צעד)

### שלב 1: יצירת שירות ה-AI לחילוץ משימות (Gemini 3.8 Flash)
צרו קובץ חדש בשם: `services/taskExtractor.js`.

```javascript
require('dotenv').config();
const { getBestAvailableModel } = require('./aiService');

async function extractActionItems(text, language = 'he', customApiKey = null) {
  const apiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('נדרש מפתח Gemini API תקין לחילוץ משימות.');
  }

  // איתור אוטומטי של המודל (gemini-3.8-flash)
  const model = await getBestAvailableModel(apiKey);

  const prompt = `
אתה עוזר AI מקצועי לניהול משימות ופרויקטים.
קרא בעיון את הטקסט/סיכום הבא, וחלץ ממנו רשימה של 3 עד 6 משימות מעשיות וברורות לביצוע (Action Items).

לכל משימה ציין:
- id: מספר רץ
- title: כותרת קצרה ומדויקת לפעולה
- assignee: מי האחראי לפי הטקסט (אם לא צוין במפורש, הגדר תפקיד מתאים)
- priority: רמת דחיפות ("high", "medium", "low")
- dueDate: מועד יעד משוער או תאריך
- description: הסבר קצר של שורה אחת על המשימה

החזר אך ורק מערך JSON של אובייקטים (ללא שום markdown backticks):
[
  {
    "id": 1,
    "title": "...",
    "assignee": "...",
    "priority": "high",
    "dueDate": "...",
    "description": "..."
  }
]

טקסט לניתוח:
${text.slice(0, 30000)}
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`שגיאת Gemini (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned);
}

module.exports = { extractActionItems };
```

---

### שלב 2: הוספת Endpoint ב-`server.js`
בקובץ `server.js`, חפשו את ההערה `[ענף 1 - משימות ולוח שנה]` והוסיפו:

```javascript
const { extractActionItems } = require('./services/taskExtractor');

app.post('/api/action-items', async (req, res) => {
  try {
    const { text, language } = req.body;
    const customApiKey = req.headers['x-gemini-api-key'] || req.body.apiKey;

    if (!text) {
      return res.status(400).json({ success: false, error: 'לא סופק טקסט לחילוץ משימות.' });
    }

    const tasks = await extractActionItems(text, language || 'he', customApiKey);
    res.json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
```

---

### שלב 3: חיבור ה-UI בלשונית ענף 1
בקובץ `public/app.js`:
1. האזינו ללחיצה על הלשונית `#branch1-nav-tab`.
2. כאשר המשתמש עובר ללשונית זו, בדקו האם כבר קיים סיכום ב-`window.SmartNotesState.currentSummary`.
3. שלחו בקשת `POST` ל-`/api/action-items` עם הטקסט של הסיכום והמפתח מ-`localStorage` ב-header `x-gemini-api-key`.
4. רנדרו את רשימת המשימות בתוך `#branch-1-tasks-container` כצ'ק-בוקסים מעוצבים.
5. הוסיפו כפתור "הורד קובץ יומן (.ics)" שמייצר קובץ iCalendar ומאפשר הוספה ליומן.

---

## 🎯 רשימת צ'ק-ליסט לסיום הענף
- [ ] יצרת את `services/taskExtractor.js` (Gemini 3.8 Flash)
- [ ] הוספת את הנתיב ב-`server.js`
- [ ] עדכנת את ה-UI להצגת משימות וצ'ק-בוקסים
- [ ] בדקת שהפיצ'ר מחזיר משימות אמיתיות מ-Gemini
- [ ] בצעת Commit מסודר לענף שלך ב-Git
- [ ] פתחת Pull Request אל ענף `main`!
