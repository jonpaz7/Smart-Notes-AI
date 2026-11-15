// מצב גלובלי של האפליקציה (זמין עבור כל הרכיבים והענפים)
window.SmartNotesState = {
  selectedFile: null,
  currentSummary: null,
  currentSourceText: null,
  activeTab: 'pdf',
  hasServerKey: false
};

document.addEventListener('DOMContentLoaded', () => {
  // אלמנטים
  const statusPill = document.getElementById('system-status');
  const statusText = document.getElementById('status-text');
  const statusDot = statusPill.querySelector('.status-dot');
  const apiStatusLabel = document.getElementById('api-status-label');

  // מודל הגדרת מפתח API
  const openKeyModalBtn = document.getElementById('open-key-modal-btn');
  const apiKeyModal = document.getElementById('api-key-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const cancelModalBtn = document.getElementById('cancel-modal-btn');
  const saveKeyBtn = document.getElementById('save-key-btn');
  const apiKeyInput = document.getElementById('api-key-input');
  const toggleKeyVisibility = document.getElementById('toggle-key-visibility');
  const keyTestFeedback = document.getElementById('key-test-feedback');

  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPdf = document.getElementById('tab-pdf');
  const tabText = document.getElementById('tab-text');

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('pdf-file-input');
  const dropzoneEmpty = document.getElementById('dropzone-empty');
  const filePreview = document.getElementById('file-preview');
  const fileName = document.getElementById('file-name');
  const fileSize = document.getElementById('file-size');
  const removeFileBtn = document.getElementById('remove-file-btn');

  const rawTextInput = document.getElementById('raw-text-input');
  const charCount = document.getElementById('char-count');

  const form = document.getElementById('summarize-form');
  const submitBtn = document.getElementById('submit-btn');
  const btnText = submitBtn.querySelector('.btn-text');
  const spinner = submitBtn.querySelector('.spinner');

  const resultsCard = document.getElementById('results-card');
  const resultTitle = document.getElementById('result-title');
  const metaType = document.getElementById('meta-type');
  const metaPages = document.getElementById('meta-pages');
  const metaLength = document.getElementById('meta-length');
  const executiveSummary = document.getElementById('executive-summary');
  const keyTopicsList = document.getElementById('key-topics-list');
  const keyTakeawaysList = document.getElementById('key-takeaways-list');

  const copyBtn = document.getElementById('copy-btn');
  const downloadBtn = document.getElementById('download-btn');
  const resetBtn = document.getElementById('reset-btn');

  const subtabButtons = document.querySelectorAll('.subtab-btn');
  const subtabContents = document.querySelectorAll('.subtab-content');

  // פונקציה להחזרת המפתח השמור (או מ-localStorage)
  function getActiveApiKey() {
    return localStorage.getItem('gemini_api_key') || '';
  }

  // 1. בדיקת סטטוס השרת ומפתח ה-API
  async function checkServerStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      window.SmartNotesState.hasServerKey = data.hasApiKey;

      const localKey = getActiveApiKey();
      if (data.hasApiKey || localKey) {
        statusText.textContent = 'מחובר ל-Gemini AI';
        statusDot.className = 'status-dot online';
        apiStatusLabel.textContent = 'מפתח Gemini מוגדר ✓';
      } else {
        statusText.textContent = 'נדרש מפתח API';
        statusDot.className = 'status-dot';
        statusDot.style.backgroundColor = 'var(--warning)';
        apiStatusLabel.textContent = 'הגדרת Gemini Key';
      }
    } catch {
      statusText.textContent = 'שרת מנותק';
      statusDot.className = 'status-dot';
      statusDot.style.backgroundColor = 'var(--danger)';
    }
  }
  checkServerStatus();

  // 2. ניהול מודל ה-API Key
  openKeyModalBtn.addEventListener('click', () => {
    apiKeyInput.value = getActiveApiKey();
    keyTestFeedback.className = 'feedback-msg hidden';
    apiKeyModal.classList.remove('hidden');
  });

  function closeKeyModal() {
    apiKeyModal.classList.add('hidden');
  }

  closeModalBtn.addEventListener('click', closeKeyModal);
  cancelModalBtn.addEventListener('click', closeKeyModal);

  toggleKeyVisibility.addEventListener('click', () => {
    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
  });

  saveKeyBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showFeedback('אנא הזינו מפתח API.', 'error');
      return;
    }

    saveKeyBtn.disabled = true;
    saveKeyBtn.textContent = 'בודק תקינות מול Google...';

    try {
      // בדיקת המפתח מול השרת
      const testRes = await fetch('/api/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key })
      });
      const testData = await testRes.json();

      if (!testData.valid) {
        throw new Error(testData.error || 'המפתח אינו תקין.');
      }

      // שמירה בדפדפן (localStorage)
      localStorage.setItem('gemini_api_key', key);

      // שמירה גם בשרת לקובץ .env
      await fetch('/api/save-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key })
      });

      showFeedback('✅ המפתח תקין ונשמר בהצלחה!', 'success');
      setTimeout(() => {
        closeKeyModal();
        checkServerStatus();
      }, 1000);

    } catch (err) {
      showFeedback(`❌ שגיאה: ${err.message}`, 'error');
    } finally {
      saveKeyBtn.disabled = false;
      saveKeyBtn.textContent = 'בדוק ושמור מפתח';
    }
  });

  function showFeedback(msg, type) {
    keyTestFeedback.textContent = msg;
    keyTestFeedback.className = `feedback-msg ${type}`;
  }

  // 3. החלפת טאבים (PDF / טקסט חופשי)
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetTab = btn.dataset.tab;
      window.SmartNotesState.activeTab = targetTab;

      if (targetTab === 'pdf') {
        tabPdf.classList.add('active');
        tabText.classList.remove('active');
      } else {
        tabText.classList.add('active');
        tabPdf.classList.remove('active');
      }
    });
  });

  // 4. ניהול קובץ PDF
  dropzone.addEventListener('click', (e) => {
    if (e.target !== removeFileBtn) {
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        handleFileSelected(file);
      } else {
        alert('אנא העלו קובץ PDF בלבד.');
      }
    }
  });

  function handleFileSelected(file) {
    window.SmartNotesState.selectedFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;
    dropzoneEmpty.classList.add('hidden');
    filePreview.classList.remove('hidden');
  }

  removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.SmartNotesState.selectedFile = null;
    fileInput.value = '';
    filePreview.classList.add('hidden');
    dropzoneEmpty.classList.remove('hidden');
  });

  // מונה תווים
  rawTextInput.addEventListener('input', () => {
    charCount.textContent = rawTextInput.value.length.toLocaleString();
  });

  // 5. שליחת הטופס לסיכום חי באמצעות Gemini AI
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // בדיקה האם יש מפתח API מוגדר
    const localKey = getActiveApiKey();
    if (!window.SmartNotesState.hasServerKey && !localKey) {
      openKeyModalBtn.click();
      return;
    }

    const depth = document.getElementById('depth-select').value;
    const language = document.getElementById('language-select').value;
    const formData = new FormData();
    formData.append('depth', depth);
    formData.append('language', language);

    if (window.SmartNotesState.activeTab === 'pdf') {
      if (!window.SmartNotesState.selectedFile) {
        alert('אנא בחרו קובץ PDF להעלאה.');
        return;
      }
      formData.append('pdfFile', window.SmartNotesState.selectedFile);
    } else {
      const text = rawTextInput.value.trim();
      if (!text || text.length < 20) {
        alert('אנא הזינו לפחות 20 תווים לסיכום.');
        return;
      }
      formData.append('text', text);
      window.SmartNotesState.currentSourceText = text;
    }

    setLoading(true);

    try {
      const headers = {};
      if (localKey) {
        headers['x-gemini-api-key'] = localKey;
      }

      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: headers,
        body: formData
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'שגיאה ביצירת הסיכום.');
      }

      window.SmartNotesState.currentSummary = result.data.summary;
      renderSummary(result.data);

    } catch (err) {
      alert(`שגיאת AI: ${err.message}`);
    } finally {
      setLoading(false);
    }
  });

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    if (isLoading) {
      btnText.textContent = 'Gemini AI מנתח ומסכם...';
      spinner.classList.remove('hidden');
    } else {
      btnText.textContent = '✨ סכם באמצעות Gemini AI';
      spinner.classList.add('hidden');
    }
  }

  // 6. הצגת הסיכום ב-UI
  function renderSummary(data) {
    const { summary, meta } = data;

    resultTitle.textContent = summary.title || 'סיכום המסמך';
    metaType.textContent = meta.sourceType === 'pdf' ? `📄 ${meta.fileName || 'PDF'}` : '✍️ טקסט';
    metaPages.textContent = meta.numPages ? `${meta.numPages} עמודים` : '';
    metaPages.style.display = meta.numPages ? 'inline-block' : 'none';
    metaLength.textContent = `${meta.originalLength.toLocaleString()} תווים במקור`;

    const metaModel = document.getElementById('meta-model');
    if (metaModel && meta.activeModel) {
      metaModel.textContent = `🤖 ${meta.activeModel}`;
    }

    executiveSummary.textContent = summary.executiveSummary || 'לא סופק תקציר מנהלים.';

    // נושאים מרכזיים
    keyTopicsList.innerHTML = '';
    if (summary.keyTopics && summary.keyTopics.length > 0) {
      summary.keyTopics.forEach(topic => {
        const card = document.createElement('div');
        card.className = 'topic-card';
        card.innerHTML = `
          <h4>${topic.topic}</h4>
          <p>${topic.details}</p>
        `;
        keyTopicsList.appendChild(card);
      });
    }

    // תובנות ומסקנות
    keyTakeawaysList.innerHTML = '';
    if (summary.keyTakeaways && summary.keyTakeaways.length > 0) {
      summary.keyTakeaways.forEach(item => {
        const li = document.createElement('li');
        li.className = 'takeaway-item';
        li.innerHTML = `
          <span class="takeaway-icon">✓</span>
          <span>${item}</span>
        `;
        keyTakeawaysList.appendChild(li);
      });
    }

    resultsCard.classList.remove('hidden');
    resultsCard.scrollIntoView({ behavior: 'smooth' });
    switchSubTab('summary-view');
  }

  // 7. ניווט בין לשוניות התוצאה
  subtabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetSubtab = btn.dataset.subtab;
      switchSubTab(targetSubtab);
    });
  });

  function switchSubTab(subtabId) {
    subtabButtons.forEach(b => {
      b.classList.toggle('active', b.dataset.subtab === subtabId);
    });
    subtabContents.forEach(c => {
      c.classList.toggle('active', c.id === subtabId);
    });
  }

  // 8. פעולות מהירות (העתקה, הורדה, איפוס)
  copyBtn.addEventListener('click', () => {
    if (!window.SmartNotesState.currentSummary) return;
    const s = window.SmartNotesState.currentSummary;
    let textToCopy = `# ${s.title}\n\n## תקציר מנהלים:\n${s.executiveSummary}\n\n## נושאים מרכזיים:\n`;
    (s.keyTopics || []).forEach(t => {
      textToCopy += `### ${t.topic}\n${t.details}\n\n`;
    });
    textToCopy += `## מסקנות ודגשים:\n`;
    (s.keyTakeaways || []).forEach(k => {
      textToCopy += `- ${k}\n`;
    });

    navigator.clipboard.writeText(textToCopy).then(() => {
      const originalText = copyBtn.innerHTML;
      copyBtn.innerHTML = '✅ <span>הועתק!</span>';
      setTimeout(() => copyBtn.innerHTML = originalText, 2000);
    });
  });

  downloadBtn.addEventListener('click', () => {
    if (!window.SmartNotesState.currentSummary) return;
    const s = window.SmartNotesState.currentSummary;
    let markdown = `# ${s.title}\n\n## תקציר מנהלים\n${s.executiveSummary}\n\n## נושאים מרכזיים\n`;
    (s.keyTopics || []).forEach(t => {
      markdown += `### ${t.topic}\n${t.details}\n\n`;
    });
    markdown += `## מסקנות ודגשים\n`;
    (s.keyTakeaways || []).forEach(k => {
      markdown += `- ${k}\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `summary-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  });

  resetBtn.addEventListener('click', () => {
    if (confirm('האם לאפס את הנתונים ולהתחיל מחדש?')) {
      window.SmartNotesState.selectedFile = null;
      window.SmartNotesState.currentSummary = null;
      fileInput.value = '';
      rawTextInput.value = '';
      charCount.textContent = '0';
      filePreview.classList.add('hidden');
      dropzoneEmpty.classList.remove('hidden');
      resultsCard.classList.add('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

});
