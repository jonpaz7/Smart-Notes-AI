const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { extractTextFromPDF } = require('./services/pdfService');
const { generateSummary, getBestAvailableModel } = require('./services/aiService');
const { extractActionItems } = require('./services/taskExtractor');

const app = express();
const PORT = process.env.PORT || 3000;

// שמירת קבצים בזיכרון RAM (MemoryStorage) לעיבוד מהיר
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // עד 15MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('רק קובצי PDF נתמכים במערכת.'));
    }
  }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// בדיקת מצב המערכת
app.get('/api/status', (req, res) => {
  const envKey = process.env.GEMINI_API_KEY;
  const hasEnvApiKey = Boolean(envKey && envKey.trim() !== '' && envKey !== 'your_gemini_api_key_here');
  res.json({
    status: 'ok',
    hasApiKey: hasEnvApiKey,
    version: '1.0.0',
    mode: 'Live Gemini AI'
  });
});

// בדיקת תקינות מפתח API מול Google ואיתור המודל הנתמך
app.post('/api/test-key', async (req, res) => {
  const apiKey = req.body.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return res.status(400).json({ valid: false, error: 'לא סופק מפתח API לבדיקה.' });
  }

  try {
    const selectedModel = await getBestAvailableModel(apiKey.trim());
    res.json({
      valid: true,
      model: selectedModel,
      message: `המפתח תקין ומחובר בהצלחה! מודל נבחר: ${selectedModel}`
    });
  } catch (error) {
    res.status(400).json({ valid: false, error: error.message });
  }
});

// שמירת מפתח API ישירות לקובץ .env
app.post('/api/save-key', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || apiKey.trim() === '') {
    return res.status(400).json({ success: false, error: 'יש להזין מפתח תקין.' });
  }

  try {
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      if (envContent.includes('GEMINI_API_KEY=')) {
        envContent = envContent.replace(/GEMINI_API_KEY=.*/, `GEMINI_API_KEY=${apiKey.trim()}`);
      } else {
        envContent += `\nGEMINI_API_KEY=${apiKey.trim()}\n`;
      }
    } else {
      envContent = `PORT=3000\nGEMINI_API_KEY=${apiKey.trim()}\n`;
    }

    fs.writeFileSync(envPath, envContent, 'utf8');
    process.env.GEMINI_API_KEY = apiKey.trim();

    console.log('🔑 מפתח Gemini API נשמר בהצלחה ב-.env');
    res.json({ success: true, message: 'המפתח נשמר בהצלחה בשרת.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// נקודת קצה ראשית: סיכום חי באמצעות Gemini AI
app.post('/api/summarize', upload.single('pdfFile'), async (req, res) => {
  try {
    let sourceText = '';
    let numPages = null;

    if (req.file) {
      console.log(`📄 מעבד קובץ PDF אמיתי: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);
      const extracted = await extractTextFromPDF(req.file.buffer);
      sourceText = extracted.text;
      numPages = extracted.numpages;
    } else if (req.body.text && req.body.text.trim()) {
      sourceText = req.body.text.trim();
    } else {
      return res.status(400).json({
        success: false,
        error: 'יש להזין טקסט או להעלות קובץ PDF לסיכום.'
      });
    }

    if (sourceText.length < 20) {
      return res.status(400).json({
        success: false,
        error: 'הטקסט קצר מדי לסיכום (נדרשים לפחות 20 תווים).'
      });
    }

    const depth = req.body.depth || 'detailed';
    const language = req.body.language || 'he';
    const customApiKey = req.headers['x-gemini-api-key'] || req.body.apiKey;

    console.log(`🤖 שולח ל-Gemini AI לסיכום חי (${sourceText.length} תווים)...`);
    const summary = await generateSummary(sourceText, depth, language, customApiKey);

    res.json({
      success: true,
      data: {
        summary,
        meta: {
          originalLength: sourceText.length,
          numPages: numPages,
          sourceType: req.file ? 'pdf' : 'text',
          fileName: req.file ? req.file.originalname : null,
          activeModel: summary.activeModel
        }
      }
    });

  } catch (error) {
    console.error('שגיאה ב-POST /api/summarize:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'אירעה שגיאה בעיבוד הבקשה מול ה-AI.'
    });
  }
});

// ====================================================================
// 🚀 נקודות הרחבה לצוות עבור ענפי Git:
// ====================================================================

// חילוץ משימות מתוך הסיכום באמצעות Gemini AI
app.post('/api/action-items', async (req, res) => {
  try {
    const body = req.body || {};
    const { text, language } = body;
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, error: 'לא סופק טקסט לחילוץ משימות.' });
    }

    const customApiKey = req.headers['x-gemini-api-key'] || body.apiKey;
    const tasks = await extractActionItems(text, language || 'he', customApiKey);
    res.json({ success: true, tasks });
  } catch (error) {
    console.error('שגיאה ב-POST /api/action-items:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'אירעה שגיאה בחילוץ המשימות.'
    });
  }
});

// [ענף 2 - מחולל בחנים (feature/quiz-generator)]:
// const { generateQuiz } = require('./services/quizGenerator');
// app.post('/api/quiz', async (req, res) => { ... });

// ====================================================================

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 SmartNotes AI פועל בחיבור חי ל-Gemini AI!`);
  console.log(`🌐 פתחו את הדפדפן בכתובת: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
