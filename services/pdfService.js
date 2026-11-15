const pdfParse = require('pdf-parse');

/**
 * מחלץ טקסט מתוך Buffer של קובץ PDF
 * @param {Buffer} buffer 
 * @returns {Promise<{text: string, numpages: number, info: any}>}
 */
async function extractTextFromPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    const cleanedText = (data.text || '').trim();

    if (!cleanedText) {
      throw new Error('לא נמצא טקסט קריא בקובץ ה-PDF (ייתכן שהקובץ מכיל רק תמונות סרוקות ללא שכבת טקסט).');
    }

    return {
      text: cleanedText,
      numpages: data.numpages,
      info: data.info || {}
    };
  } catch (err) {
    throw new Error(`שגיאה בעיבוד קובץ ה-PDF: ${err.message}`);
  }
}

module.exports = {
  extractTextFromPDF
};
