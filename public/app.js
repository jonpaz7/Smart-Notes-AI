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
      window.SmartNotesState.currentSourceText = null;
      window.SmartNotesState.currentQuiz = null;
      currentQuizQuestions = null;
      lastQuizSummaryHash = null;

      fileInput.value = '';
      rawTextInput.value = '';
      charCount.textContent = '0';
      filePreview.classList.add('hidden');
      dropzoneEmpty.classList.remove('hidden');
      resultsCard.classList.add('hidden');

      if (branch2QuizContainer) {
        branch2QuizContainer.className = 'branch-placeholder';
        branch2QuizContainer.innerHTML = `
          <div class="placeholder-icon">🎯</div>
          <h3>אזור פיצ'ר ענף 2: בוחן הבנה אמריקאי מבוסס AI</h3>
          <p>חלק זה ימומש בענף <code>feature/quiz-generator</code> באמצעות Gemini AI.</p>
          <p class="placeholder-hint">הנחיות מלאות בקובץ <code>BRANCH_PROMPT_2_QUIZ.md</code>.</p>
        `;
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // ====================================================================
  // 🧠 ענף 2: בוחן הבנה וציון אמריקאי (feature/quiz-generator)
  // ====================================================================
  const branch2NavTab = document.getElementById('branch2-nav-tab');
  const branch2QuizContainer = document.getElementById('branch-2-quiz-container');

  let currentQuizQuestions = null;
  let isGeneratingQuiz = false;
  let lastQuizSummaryHash = null;

  function getSummaryTextForQuiz() {
    const s = window.SmartNotesState.currentSummary;
    if (!s) return '';
    let text = '';
    if (s.title) text += `# ${s.title}\n\n`;
    if (s.executiveSummary) text += `## תקציר:\n${s.executiveSummary}\n\n`;
    if (Array.isArray(s.keyTopics) && s.keyTopics.length > 0) {
      text += `## נושאים מרכזיים:\n`;
      s.keyTopics.forEach(t => {
        text += `- ${t.topic}: ${t.details}\n`;
      });
      text += '\n';
    }
    if (Array.isArray(s.keyTakeaways) && s.keyTakeaways.length > 0) {
      text += `## דגשים ומסקנות:\n`;
      s.keyTakeaways.forEach(k => {
        text += `- ${k}\n`;
      });
    }
    if (window.SmartNotesState.currentSourceText) {
      text += `\n\n## טקסט מקור:\n${window.SmartNotesState.currentSourceText.slice(0, 10000)}`;
    }
    return text.trim();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function generateAndRenderQuiz(forceRegenerate = false) {
    if (!window.SmartNotesState.currentSummary) {
      branch2QuizContainer.className = 'branch-placeholder';
      branch2QuizContainer.innerHTML = `
        <div class="placeholder-icon">ℹ️</div>
        <h3>טרם הופק סיכום</h3>
        <p>כדי ליצור בוחן הבנה אמריקאי, יש לסכם מסמך PDF או טקסט תחילה.</p>
      `;
      return;
    }

    const summaryText = getSummaryTextForQuiz();
    if (!summaryText) {
      alert('לא נמצא תוכן סיכום ליצירת בוחן.');
      return;
    }

    // אם כבר נוצר שאלון עבור אותו הסיכום ולא נדרש ריענון כפוי, לא מפיקים מחדש
    if (!forceRegenerate && currentQuizQuestions && lastQuizSummaryHash === summaryText) {
      return;
    }

    if (isGeneratingQuiz) return;
    isGeneratingQuiz = true;

    branch2QuizContainer.className = 'quiz-container loading';
    branch2QuizContainer.innerHTML = `
      <div class="quiz-loading-state">
        <div class="spinner large-spinner"></div>
        <h3>Gemini AI מנתח ומחולל בוחן הבנה...</h3>
        <p>מנסח 3–4 שאלות אמריקאיות עם תשובות נכונות והסברים מפורטים</p>
      </div>
    `;

    try {
      const localKey = getActiveApiKey();
      const headers = { 'Content-Type': 'application/json' };
      if (localKey) {
        headers['x-gemini-api-key'] = localKey;
      }

      const languageSelect = document.getElementById('language-select');
      const language = languageSelect ? languageSelect.value : 'he';

      const response = await fetch('/api/quiz', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          text: summaryText,
          language: language
        })
      });

      const data = await response.json();

      if (!data.success || !data.quiz) {
        throw new Error(data.error || 'נכשלה יצירת הבוחן מול השרת.');
      }

      currentQuizQuestions = data.quiz;
      lastQuizSummaryHash = summaryText;
      window.SmartNotesState.currentQuiz = data.quiz;

      renderQuizUI(currentQuizQuestions);

    } catch (err) {
      console.error('Quiz Generation Error:', err);
      branch2QuizContainer.className = 'branch-placeholder';
      branch2QuizContainer.innerHTML = `
        <div class="placeholder-icon">❌</div>
        <h3>שגיאה ביצירת הבוחן</h3>
        <p style="color: var(--danger); margin-bottom: 1rem;">${escapeHtml(err.message)}</p>
        <button type="button" class="primary-btn" id="retry-quiz-fetch-btn">🔄 נסה שוב</button>
      `;
      document.getElementById('retry-quiz-fetch-btn')?.addEventListener('click', () => {
        generateAndRenderQuiz(true);
      });
    } finally {
      isGeneratingQuiz = false;
    }
  }

  function renderQuizUI(questions) {
    if (!Array.isArray(questions) || questions.length === 0) {
      branch2QuizContainer.className = 'branch-placeholder';
      branch2QuizContainer.innerHTML = `
        <div class="placeholder-icon">⚠️</div>
        <h3>לא התקבלו שאלות</h3>
        <p>ה-AI לא הצליח להפיק שאלות מהטקסט שסופק.</p>
        <button type="button" class="primary-btn mt-3" id="retry-empty-quiz-btn">🔄 נסה שוב</button>
      `;
      document.getElementById('retry-empty-quiz-btn')?.addEventListener('click', () => {
        generateAndRenderQuiz(true);
      });
      return;
    }

    branch2QuizContainer.className = 'quiz-container';

    let html = `
      <div class="quiz-header-banner">
        <div>
          <h3>🧠 בוחן הבנה אמריקאי (AI Quiz)</h3>
          <p class="quiz-subtitle">ענו על ${questions.length} השאלות הבאות ובדקו את הבנתכם בחומר המסוכם</p>
        </div>
        <button type="button" class="icon-btn" id="regenerate-quiz-btn" title="חולל בוחן חדש עם שאלות שונות">
          🔄 <span>שאלות חדשות</span>
        </button>
      </div>

      <div class="quiz-score-banner hidden" id="quiz-score-banner"></div>

      <form id="quiz-form" class="quiz-form">
    `;

    questions.forEach((q, qIndex) => {
      html += `
        <div class="quiz-question-card" id="quiz-q-${qIndex}">
          <div class="quiz-question-header">
            <span class="quiz-q-num">שאלה ${qIndex + 1} מתוך ${questions.length}</span>
            <h4 class="quiz-q-text">${escapeHtml(q.question)}</h4>
          </div>
          <div class="quiz-options-list">
      `;

      (q.options || []).forEach((opt, optIndex) => {
        const optionId = `q_${qIndex}_opt_${optIndex}`;
        html += `
          <label class="quiz-option-label" for="${optionId}" data-opt-index="${optIndex}">
            <input type="radio" name="question_${qIndex}" id="${optionId}" value="${optIndex}">
            <span class="custom-radio"></span>
            <span class="option-text">${escapeHtml(opt)}</span>
          </label>
        `;
      });

      html += `
          </div>
          <div class="quiz-explanation hidden" id="quiz-expl-${qIndex}">
            <div class="expl-icon">💡</div>
            <div>
              <strong>הסבר ה-AI:</strong>
              <span class="expl-text">${escapeHtml(q.explanation || '')}</span>
            </div>
          </div>
        </div>
      `;
    });

    html += `
        <div class="quiz-footer-actions">
          <button type="button" class="primary-btn" id="submit-quiz-btn">
            <span>✓ בדוק תשובות וחשב ציון</span>
          </button>
          <button type="button" class="secondary-btn hidden" id="retry-answers-btn">
            <span>🔄 נסה שוב</span>
          </button>
        </div>
      </form>
    `;

    branch2QuizContainer.innerHTML = html;

    // אירוע "שאלות חדשות"
    document.getElementById('regenerate-quiz-btn')?.addEventListener('click', () => {
      generateAndRenderQuiz(true);
    });

    const submitQuizBtn = document.getElementById('submit-quiz-btn');
    const retryAnswersBtn = document.getElementById('retry-answers-btn');
    const scoreBanner = document.getElementById('quiz-score-banner');

    // אירוע "בדוק תשובות"
    submitQuizBtn?.addEventListener('click', () => {
      let correctCount = 0;
      let answeredCount = 0;

      questions.forEach((q, qIndex) => {
        const questionCard = document.getElementById(`quiz-q-${qIndex}`);
        const selectedRadio = questionCard.querySelector(`input[name="question_${qIndex}"]:checked`);
        const explanationEl = document.getElementById(`quiz-expl-${qIndex}`);
        const optionLabels = questionCard.querySelectorAll('.quiz-option-label');
        const correctIndex = Number(q.correctAnswerIndex);

        optionLabels.forEach(l => l.classList.remove('correct', 'incorrect', 'correct-target'));

        if (selectedRadio) {
          answeredCount++;
          const selectedIndex = parseInt(selectedRadio.value, 10);
          if (selectedIndex === correctIndex) {
            correctCount++;
            if (optionLabels[selectedIndex]) {
              optionLabels[selectedIndex].classList.add('correct');
            }
          } else {
            if (optionLabels[selectedIndex]) {
              optionLabels[selectedIndex].classList.add('incorrect');
            }
            if (optionLabels[correctIndex]) {
              optionLabels[correctIndex].classList.add('correct-target');
            }
          }
        } else {
          // שאלה שלא נענתה - נסמן את הנכונה
          if (optionLabels[correctIndex]) {
            optionLabels[correctIndex].classList.add('correct-target');
          }
        }

        // נעילת כפתורי הבחירה
        questionCard.querySelectorAll('input[type="radio"]').forEach(r => r.disabled = true);

        // הצגת כרטיסיית ההסבר
        if (explanationEl) {
          explanationEl.classList.remove('hidden');
        }
      });

      const total = questions.length;
      const score = Math.round((correctCount / total) * 100);

      let feedbackClass = 'score-high';
      let feedbackText = 'מעולה! שליטה מלאה בחומר הנלמד! 🏆';
      if (score < 60) {
        feedbackClass = 'score-low';
        feedbackText = 'כדאי לחזור על החומר ולקרוא את ההסברים 📚';
      } else if (score < 85) {
        feedbackClass = 'score-mid';
        feedbackText = 'עבודה טובה! הבנה טובה של רוב הנושאים 👏';
      }

      scoreBanner.className = `quiz-score-banner ${feedbackClass}`;
      scoreBanner.innerHTML = `
        <div class="score-number">${score}</div>
        <div class="score-details">
          <h4>${feedbackText}</h4>
          <p>ענית נכון על ${correctCount} מתוך ${total} שאלות (${score}%)</p>
        </div>
      `;
      scoreBanner.classList.remove('hidden');
      scoreBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      submitQuizBtn.classList.add('hidden');
      retryAnswersBtn.classList.remove('hidden');
    });

    // אירוע "נסה שוב"
    retryAnswersBtn?.addEventListener('click', () => {
      questions.forEach((q, qIndex) => {
        const questionCard = document.getElementById(`quiz-q-${qIndex}`);
        const explanationEl = document.getElementById(`quiz-expl-${qIndex}`);
        const optionLabels = questionCard.querySelectorAll('.quiz-option-label');

        optionLabels.forEach(l => {
          l.classList.remove('correct', 'incorrect', 'correct-target');
        });

        questionCard.querySelectorAll('input[type="radio"]').forEach(r => {
          r.disabled = false;
          r.checked = false;
        });

        if (explanationEl) {
          explanationEl.classList.add('hidden');
        }
      });

      scoreBanner.classList.add('hidden');
      submitQuizBtn.classList.remove('hidden');
      retryAnswersBtn.classList.add('hidden');
    });
  }

  // 1. האזנה ללחיצה על הלשונית של ענף 2
  if (branch2NavTab) {
    branch2NavTab.addEventListener('click', () => {
      generateAndRenderQuiz(false);
    });
  }

});
