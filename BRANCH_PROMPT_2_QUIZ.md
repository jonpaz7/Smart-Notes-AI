# 🧠 הנחיות פיתוח לענף 2: בוחן הבנה וציון אמריקאי (AI Quiz & Feedback)

> **שם הענף (Branch):** `feature/quiz-generator`  
> **מפתח אחראי:** החבר/ה לצוות  
> **מטרת הפיצ'ר:** הפיכת תוכן ה-PDF או ההרצאה למבחן אמריקאי אינטראקטיבי (3–4 שאלות) באמצעות Gemini AI (מודל Gemini 3.8 Flash), עם בדיקה מיידית, ציון ומשוב מסביר לכל שאלה.

---

## 🛠️ מה נדרש לממש? (צעד אחר צעד)

### שלב 1: יצירת שירות ה-AI למחולל השאלות (Gemini 3.8 Flash)
צרו קובץ חדש בשם: `services/quizGenerator.js`.

```javascript
require('dotenv').config();
const { getBestAvailableModel } = require('./aiService');

async function generateQuiz(text, language = 'he', customApiKey = null) {
  const apiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('נדרש מפתח Gemini API תקין ליצירת בוחן.');
  }

  // איתור אוטומטי של המודל (gemini-3.8-flash)
  const model = await getBestAvailableModel(apiKey);

  const prompt = `
אתה מרצה ומדריך מומחה.
בהתבסס אך ורק על הטקסט/סיכום הבא, צור שאלון אמריקאי של 3 עד 4 שאלות לבדיקת הבנה של החומר.

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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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
    throw new Error(`שגיאת Gemini (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned);
}

module.exports = { generateQuiz };
```

---

### שלב 2: הוספת Endpoint ב-`server.js`
בקובץ `server.js`, חפשו את ההערה `[ענף 2 - מחולל בחנים]` והוסיפו:

```javascript
const { generateQuiz } = require('./services/quizGenerator');

app.post('/api/quiz', async (req, res) => {
  try {
    const { text, language } = req.body;
    const customApiKey = req.headers['x-gemini-api-key'] || req.body.apiKey;

    if (!text) {
      return res.status(400).json({ success: false, error: 'לא סופק טקסט ליצירת בוחן.' });
    }

    const quiz = await generateQuiz(text, language || 'he', customApiKey);
    res.json({ success: true, quiz });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
```

---

### שלב 3: חיבור ה-UI בלשונית ענף 2
בקובץ `public/app.js`:
1. האזינו ללחיצה על הלשונית `#branch2-nav-tab`.
2. כאשר המשתמש עובר ללשונית, בדקו האם כבר קיים סיכום ב-`window.SmartNotesState.currentSummary`.
3. שלחו בקשת `POST` ל-`/api/quiz` עם הטקסט של הסיכום והמפתח ב-header `x-gemini-api-key`.
4. רנדרו את השאלות בתוך `#branch-2-quiz-container` עם כפתורי רדיו לבחירת תשובה.
5. הוסיפו כפתור "בדוק תשובות" שמחשב ציון ומסמן:
   * תשובה נכונה בירוק.
   * תשובה שגויה באדום.
   * כרטיסיית הסבר לכל שאלה.

---

### 💡 טיפ חשוב למיזוג ב-Git (Merge):
אם השותף שלך מיזג ראשון את ענף 1 ל-`main`, בצע בענף שלך:
```bash
git checkout main
git pull origin main
git checkout feature/quiz-generator
git merge main
```
במקרה של קונפליקט קל ב-`server.js` (באזור ששניכם הוספתם את ה-endpoints), פשוט השאירו את שני ה-endpoints בקובץ, שמרו, עשו קומיט ופתחו PR!
