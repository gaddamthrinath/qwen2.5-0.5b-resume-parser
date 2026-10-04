/**
 * Resume Parser AI - Full-Screen Client Logic
 * Multi-Model Support (Q8 & Q4) + Llama LiteParse OCR + Ollama Resident Memory
 * Backend Post-Processing Badge & Dual Raw/Cleaned JSON View
 */

const state = {
  activeLeftTab: 'pdf', // 'pdf' | 'text'
  currentView: 'visual', // 'visual' | 'json'
  activeJsonSubTab: 'processed', // 'processed' | 'raw'
  selectedModel: localStorage.getItem('selected_model') || 'qwenResumeParserQ8',
  currentFile: null,
  currentPdfUrl: null,
  parsedData: null, // Cleaned JSON
  rawJsonData: null, // Raw LLM Output JSON
  isPostProcessed: false,
  postProcessChanges: [],
  extractedOcrText: '',
  isParsing: false,
  timerInterval: null
};

// DOM References
const elements = {
  // Navigation & Header
  statusDot: document.getElementById('status-dot') || document.querySelector('.status-dot'),
  statusText: document.getElementById('status-text'),
  modelSelector: document.getElementById('model-selector'),
  btnModelGuide: document.getElementById('btn-model-guide'),
  modelGuideDot: document.getElementById('model-guide-dot'),
  modelGuideText: document.getElementById('model-guide-text'),
  btnPreload: document.getElementById('btn-preload'),
  preloadBtnText: document.getElementById('preload-btn-text'),
  memorySubnote: document.getElementById('memory-subnote'),
  subnoteDot: document.getElementById('subnote-dot'),
  memorySubnoteText: document.getElementById('memory-subnote-text'),
  btnParse: document.getElementById('btn-parse'),
  parseSpinner: document.getElementById('parse-spinner'),
  parseIcon: document.getElementById('parse-icon'),
  parseBtnText: document.getElementById('parse-btn-text'),

  // Model Setup Modal
  modelSetupModal: document.getElementById('model-setup-modal'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  btnModalDone: document.getElementById('btn-modal-done'),
  btnRefreshModels: document.getElementById('btn-refresh-models'),
  refreshBtnText: document.getElementById('refresh-btn-text'),
  refreshIcon: document.getElementById('refresh-icon'),
  setupAlertBox: document.getElementById('setup-alert-box'),
  setupAlertIcon: document.getElementById('setup-alert-icon'),
  setupAlertTitle: document.getElementById('setup-alert-title'),
  setupAlertDesc: document.getElementById('setup-alert-desc'),
  modalModelsGrid: document.getElementById('modal-models-grid'),
  modalStepsList: document.getElementById('modal-steps-list'),

  // Splitter & Panes
  workspace: document.getElementById('workspace'),
  paneLeft: document.getElementById('pane-left'),
  paneRight: document.getElementById('pane-right'),
  resizer: document.getElementById('resizer'),

  // Left Toolbar & Tabs
  tabPdfView: document.getElementById('tab-pdf-view'),
  tabTextView: document.getElementById('tab-text-view'),
  btnUploadFile: document.getElementById('btn-upload-file'),
  fileInput: document.getElementById('file-input'),
  fileLoadedPill: document.getElementById('file-loaded-pill'),
  loadedFileName: document.getElementById('loaded-file-name'),
  removeFileBtn: document.getElementById('remove-file-btn'),

  // Left Content
  pdfFullWrapper: document.getElementById('pdf-full-wrapper'),
  pdfUploadEmpty: document.getElementById('pdf-upload-empty'),
  dropTargetArea: document.getElementById('drop-target-area'),
  btnSelectPdf: document.getElementById('btn-select-pdf'),
  pdfFrame: document.getElementById('pdf-frame'),
  ocrTextWrapper: document.getElementById('ocr-text-wrapper'),
  ocrStatusLabel: document.getElementById('ocr-status-label'),
  ocrStats: document.getElementById('ocr-stats'),
  resumeTextInput: document.getElementById('resume-text-input'),

  // Right Toolbar & Tabs
  tabVisual: document.getElementById('tab-visual'),
  tabJson: document.getElementById('tab-json'),
  postprocessBadgeWrap: document.getElementById('postprocess-badge-wrap'),
  postprocessBadge: document.getElementById('postprocess-badge'),
  postprocessDot: document.getElementById('postprocess-dot'),
  postprocessLabel: document.getElementById('postprocess-label'),
  benchmarkPill: document.getElementById('benchmark-pill'),
  parseTime: document.getElementById('parse-time'),
  btnCopyJson: document.getElementById('btn-copy-json'),
  copyBtnText: document.getElementById('copy-btn-text'),
  btnDownloadJson: document.getElementById('btn-download-json'),

  // JSON Sub-tabs
  subtabProcessed: document.getElementById('subtab-processed'),
  subtabRaw: document.getElementById('subtab-raw'),
  jsonNoticeText: document.getElementById('json-notice-text'),

  // Right Content & States
  emptyState: document.getElementById('empty-state'),
  loadingState: document.getElementById('loading-state'),
  loadingTitle: document.getElementById('loading-title'),
  loadingSubtext: document.getElementById('loading-subtext'),
  liveTimer: document.getElementById('live-timer'),
  visualProfileView: document.getElementById('visual-profile-view'),
  jsonCodeView: document.getElementById('json-code-view'),
  jsonCodeBlock: document.getElementById('json-code-block'),

  // Visual Profile Fields
  avatarInitials: document.getElementById('avatar-initials'),
  vName: document.getElementById('v-name'),
  vTitle: document.getElementById('v-title'),
  vEmailChip: document.getElementById('v-email-chip'),
  vEmailLink: document.getElementById('v-email-link'),
  vPhoneChip: document.getElementById('v-phone-chip'),
  vPhoneText: document.getElementById('v-phone-text'),
  vLocationChip: document.getElementById('v-location-chip'),
  vLocationText: document.getElementById('v-location-text'),
  vLinksRow: document.getElementById('v-links-row'),
  vSummaryText: document.getElementById('v-summary-text'),
  secSummary: document.getElementById('sec-summary'),
  vSkillsCloud: document.getElementById('v-skills-cloud'),
  vSkillsCount: document.getElementById('v-skills-count'),
  secSkills: document.getElementById('sec-skills'),
  vExperienceTimeline: document.getElementById('v-experience-timeline'),
  vExpCount: document.getElementById('v-exp-count'),
  secExperience: document.getElementById('sec-experience'),
  vProjectsGrid: document.getElementById('v-projects-grid'),
  vProjCount: document.getElementById('v-proj-count'),
  secProjects: document.getElementById('sec-projects'),
  vEducationTimeline: document.getElementById('v-education-timeline'),
  vEducationList: document.getElementById('v-education-timeline') || document.getElementById('v-education-list'),
  vEduCount: document.getElementById('v-edu-count'),
  secEducation: document.getElementById('sec-education'),
  vCertificationsList: document.getElementById('v-certifications-list'),
  vCertCount: document.getElementById('v-cert-count'),
  secCertifications: document.getElementById('sec-certifications'),
  vAwardsList: document.getElementById('v-awards-list'),
  vAwardsCount: document.getElementById('v-awards-count'),
  secAwards: document.getElementById('sec-awards'),
  vLanguagesCloud: document.getElementById('v-languages-cloud'),
  vLangCount: document.getElementById('v-lang-count'),
  secLanguages: document.getElementById('sec-languages'),

  // Toast
  toast: document.getElementById('app-toast')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  // Sync model selector with saved state
  if (elements.modelSelector) {
    elements.modelSelector.value = state.selectedModel;
  }
  initSplitter();
  initEventListeners();
  initDropzone();
  checkBackendStatus();
});

/* ==========================================================================
   RESIZABLE SPLIT PANES (DRAGGABLE SLIDER)
   ========================================================================== */
function initSplitter() {
  let isDragging = false;
  const workspace = elements.workspace;
  const paneLeft = elements.paneLeft;
  const resizer = elements.resizer;

  // Restore saved splitter ratio
  const savedRatio = localStorage.getItem('splitter_ratio');
  if (savedRatio && !isNaN(parseFloat(savedRatio))) {
    const ratio = Math.min(Math.max(parseFloat(savedRatio), 20), 80);
    paneLeft.style.width = `${ratio}%`;
  }

  function startDragging(clientX) {
    isDragging = true;
    resizer.classList.add('dragging');
    document.body.classList.add('is-resizing');
  }

  function doDrag(clientX) {
    if (!isDragging) return;
    const workspaceRect = workspace.getBoundingClientRect();
    const newWidth = clientX - workspaceRect.left;
    const totalWidth = workspaceRect.width;
    if (totalWidth <= 0) return;

    const minWidth = totalWidth * 0.20;
    const maxWidth = totalWidth * 0.80;

    if (newWidth >= minWidth && newWidth <= maxWidth) {
      const percentage = (newWidth / totalWidth) * 100;
      paneLeft.style.width = `${percentage}%`;
      localStorage.setItem('splitter_ratio', percentage.toFixed(2));
    }
  }

  function stopDragging() {
    if (isDragging) {
      isDragging = false;
      resizer.classList.remove('dragging');
      document.body.classList.remove('is-resizing');
    }
  }

  // Mouse events
  resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startDragging(e.clientX);
  });

  window.addEventListener('mousemove', (e) => {
    if (isDragging) {
      e.preventDefault();
      doDrag(e.clientX);
    }
  });

  window.addEventListener('mouseup', () => {
    stopDragging();
  });

  // Touch events (tablets / touch screens)
  resizer.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length > 0) {
      startDragging(e.touches[0].clientX);
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches && e.touches.length > 0) {
      doDrag(e.touches[0].clientX);
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    stopDragging();
  });

  window.addEventListener('touchcancel', () => {
    stopDragging();
  });

  // Double-click to reset 50/50
  resizer.addEventListener('dblclick', () => {
    paneLeft.style.width = '50%';
    localStorage.setItem('splitter_ratio', '50');
    showToast('Panes reset to 50% / 50%');
  });
}

/* ==========================================================================
   BACKEND HEALTH, KEEP-ALIVE & RESUME MODEL VERIFICATION
   ========================================================================== */

const REQUIRED_RESUME_MODELS_LIST = [
  {
    id: 'qwenResumeParserQ8',
    displayName: 'Qwen 0.5B (Q8_0 • High Precision)',
    modelfile: 'Modelfile.q8_0',
    ggufFile: 'Qwen2.5-0.5B-Instruct.Q8_0.gguf',
    createCmd: 'ollama create qwenResumeParserQ8 -f ./Modelfile.q8_0',
    description: 'High precision 8-bit quantization for maximum structural CV extraction accuracy'
  },
  {
    id: 'qewnResumePraser',
    displayName: 'Qwen 0.5B (Q4_K_M • Fast)',
    modelfile: 'Modelfile.q4_k_m',
    ggufFile: 'Qwen2.5-0.5B-Instruct.Q4_K_M.gguf',
    createCmd: 'ollama create qewnResumePraser -f ./Modelfile.q4_k_m',
    description: 'Fast 4-bit medium quantization for high throughput CV parsing'
  }
];

// Strictly restrict model selector options to our custom Qwen resume models only
function updateResumeModelSelector(modelsStatus) {
  if (!elements.modelSelector) return;
  const currentVal = state.selectedModel || elements.modelSelector.value;
  elements.modelSelector.innerHTML = '';

  const listToRender = (modelsStatus && modelsStatus.length > 0) ? modelsStatus : REQUIRED_RESUME_MODELS_LIST;

  listToRender.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    const isReg = m.isRegistered !== false;
    opt.textContent = isReg ? m.displayName : `${m.displayName} [Not Created in Ollama]`;
    if (!isReg) {
      opt.style.color = '#94a3b8';
    }
    if (m.id === currentVal) {
      opt.selected = true;
    }
    elements.modelSelector.appendChild(opt);
  });

  if (elements.modelSelector.value) {
    state.selectedModel = elements.modelSelector.value;
    localStorage.setItem('selected_model', state.selectedModel);
  }
}

// Render the Model Setup Modal Dialog contents with real-time API check
function renderModelSetupModalContent(data) {
  if (!elements.setupAlertBox || !elements.modalModelsGrid || !elements.modalStepsList) return;

  const isOllamaOnline = !!data.ollamaOnline;
  const allReady = !!data.allRequiredPresent;
  const regCount = data.registeredCount || 0;
  const totalReq = data.totalRequired || 2;
  const models = data.models || REQUIRED_RESUME_MODELS_LIST;
  const instructions = data.instructions || [
    {
      step: 1,
      title: 'Unpack GGUF Models & Modelfiles',
      desc: 'Extract quantized_gguf_models.zip in this directory to unpack Modelfiles and .gguf weights.',
      command: 'tar -xf quantized_gguf_models.zip'
    },
    {
      step: 2,
      title: 'Register Qwen Q8_0 High Precision Model',
      desc: 'Create the 8-bit quantization model in your local Ollama.',
      command: 'ollama create qwenResumeParserQ8 -f ./Modelfile.q8_0'
    },
    {
      step: 3,
      title: 'Register Qwen Q4_K_M Fast Model',
      desc: 'Create the 4-bit medium quantization model in your local Ollama.',
      command: 'ollama create qewnResumePraser -f ./Modelfile.q4_k_m'
    },
    {
      step: 4,
      title: 'Verify Models in Ollama',
      desc: 'Check that both models are active and available in Ollama.',
      command: 'ollama list'
    }
  ];

  // 1. Setup Alert Box
  elements.setupAlertBox.className = 'setup-alert';
  if (allReady && isOllamaOnline) {
    elements.setupAlertBox.classList.add('ready');
    elements.setupAlertIcon.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    `;
    elements.setupAlertTitle.textContent = `All Resume Parser Models Ready (${regCount}/${totalReq})`;
    elements.setupAlertDesc.textContent = `Connected to Ollama (${data.ollamaUrl || 'http://localhost:11434'}). Both Q8_0 and Q4_K_M models are registered and available for inference.`;
  } else if (isOllamaOnline) {
    elements.setupAlertBox.classList.add('warning');
    elements.setupAlertIcon.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    `;
    elements.setupAlertTitle.textContent = `Action Required: Missing Resume Models (${regCount}/${totalReq} Ready)`;
    elements.setupAlertDesc.textContent = 'One or more custom Qwen resume models have not been created in your local Ollama. Run the terminal registration commands below to register them.';
  } else {
    elements.setupAlertBox.classList.add('offline');
    elements.setupAlertIcon.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
    `;
    elements.setupAlertTitle.textContent = 'Ollama Service Offline / Unreachable';
    elements.setupAlertDesc.textContent = `Could not connect to Ollama at ${data.ollamaUrl || 'http://localhost:11434'}. Ensure the Ollama app or "ollama serve" is running locally.`;
  }

  // 2. Render Models Grid
  elements.modalModelsGrid.innerHTML = '';
  models.forEach(model => {
    const card = document.createElement('div');
    const isRegistered = !!model.isRegistered;
    card.className = `model-status-card ${isRegistered ? 'is-ready' : 'is-missing'}`;

    card.innerHTML = `
      <div class="model-card-top">
        <span class="model-card-name">${escapeHtml(model.id)}</span>
        <span class="model-status-pill ${isRegistered ? 'ready' : 'missing'}">
          <span class="pill-dot"></span>
          ${isRegistered ? 'Ready in Ollama' : 'Not Registered'}
        </span>
      </div>
      <div class="model-card-desc">${escapeHtml(model.description || model.displayName)}</div>
      <div class="model-card-files">
        <span class="file-check ${model.filesPresent?.modelfile ? 'present' : 'absent'}">${escapeHtml(model.modelfile)}</span>
        <span>•</span>
        <span class="file-check ${model.filesPresent?.gguf ? 'present' : 'absent'}">${escapeHtml(model.ggufFile)}</span>
      </div>
    `;
    elements.modalModelsGrid.appendChild(card);
  });

  // 3. Render Steps List
  elements.modalStepsList.innerHTML = '';
  instructions.forEach((inst, idx) => {
    const stepCard = document.createElement('div');
    stepCard.className = 'setup-step-card';

    stepCard.innerHTML = `
      <div class="step-card-header">
        <div class="step-num-badge">${inst.step || (idx + 1)}</div>
        <span class="step-card-title">${escapeHtml(inst.title)}</span>
      </div>
      <div class="step-card-desc">${escapeHtml(inst.desc)}</div>
      <div class="command-code-box">
        <code>${escapeHtml(inst.command)}</code>
        <button class="btn-copy-cmd" data-cmd="${escapeHtml(inst.command)}" title="Copy command to clipboard">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        </button>
      </div>
    `;

    // Attach copy button handler
    const copyBtn = stepCard.querySelector('.btn-copy-cmd');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyCommandToClipboard(inst.command, copyBtn);
      });
    }

    elements.modalStepsList.appendChild(stepCard);
  });
}

function copyCommandToClipboard(text, btnElement) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    if (btnElement) {
      btnElement.classList.add('copied');
      btnElement.innerHTML = `
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Copied!</span>
      `;
      setTimeout(() => {
        btnElement.classList.remove('copied');
        btnElement.innerHTML = `
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        `;
      }, 2000);
    }
    showToast(`Command copied: ${text}`);
  }).catch(() => {
    showToast('Failed to copy command');
  });
}

function openModelSetupModal() {
  if (elements.modelSetupModal) {
    elements.modelSetupModal.style.display = 'flex';
  }
}

function closeModelSetupModal() {
  if (elements.modelSetupModal) {
    elements.modelSetupModal.style.display = 'none';
  }
}

async function checkModelVerification(autoOpenIfMissing = true) {
  if (elements.refreshIcon) elements.refreshIcon.classList.add('spin-animation');
  if (elements.refreshBtnText) elements.refreshBtnText.textContent = 'Checking...';

  try {
    const res = await fetch('/api/models/check');
    if (res.ok) {
      const data = await res.json();
      const isOllamaOnline = !!data.ollamaOnline;
      const allReady = !!data.allRequiredPresent;
      const regCount = data.registeredCount || 0;
      const totalReq = data.totalRequired || 2;

      // 1. Strictly update model selector dropdown with only our Qwen resume models
      updateResumeModelSelector(data.models);

      // 2. Update Header Model Guide Trigger Button
      if (elements.modelGuideDot && elements.modelGuideText) {
        if (allReady && isOllamaOnline) {
          elements.modelGuideDot.className = 'model-guide-dot ready';
          elements.modelGuideText.textContent = `Models Ready (${regCount}/${totalReq})`;
        } else if (isOllamaOnline) {
          elements.modelGuideDot.className = 'model-guide-dot warning';
          elements.modelGuideText.textContent = `Models: ${regCount}/${totalReq} (Setup)`;
        } else {
          elements.modelGuideDot.className = 'model-guide-dot offline';
          elements.modelGuideText.textContent = 'Models Missing (Setup)';
        }
      }

      // 3. Update Global Server Status indicator
      if (elements.statusDot) {
        elements.statusDot.className = isOllamaOnline ? 'status-dot online' : 'status-dot checking';
      }
      if (elements.statusText) {
        elements.statusText.textContent = isOllamaOnline
          ? 'Backend & Ollama Online'
          : 'Backend Ready (Ollama Offline)';
      }

      // 4. Update Memory Subnote
      if (elements.memorySubnoteText && elements.subnoteDot) {
        if (isOllamaOnline) {
          elements.subnoteDot.className = 'subnote-dot active';
          elements.memorySubnoteText.textContent = `Resident in RAM (${state.selectedModel})`;
          if (elements.preloadBtnText) elements.preloadBtnText.textContent = 'Memory Warmed';
          if (elements.btnPreload) {
            elements.btnPreload.classList.add('warmed');
            elements.btnPreload.title = `${state.selectedModel} is locked in memory (keep_alive: -1)`;
          }
        } else {
          elements.subnoteDot.className = 'subnote-dot offline';
          elements.memorySubnoteText.textContent = 'Ollama offline';
          if (elements.preloadBtnText) elements.preloadBtnText.textContent = 'Warm Memory';
          if (elements.btnPreload) elements.btnPreload.classList.remove('warmed');
        }
      }

      // 5. Render Modal Contents
      renderModelSetupModalContent(data);

      // 6. If models are missing or Ollama is offline, automatically popup the guide
      if (autoOpenIfMissing && (!allReady || !isOllamaOnline)) {
        openModelSetupModal();
      }

      if (!autoOpenIfMissing) {
        showToast(allReady ? 'All resume parser models verified in Ollama!' : 'Model status refreshed.');
      }
      return data;
    }
  } catch (err) {
    if (elements.statusDot) elements.statusDot.className = 'status-dot offline';
    if (elements.statusText) elements.statusText.textContent = 'Backend Offline';
    if (elements.modelGuideDot) elements.modelGuideDot.className = 'model-guide-dot offline';
    if (elements.modelGuideText) elements.modelGuideText.textContent = 'Backend Offline';
    renderModelSetupModalContent({
      ollamaOnline: false,
      allRequiredPresent: false,
      registeredCount: 0,
      totalRequired: 2,
      models: REQUIRED_RESUME_MODELS_LIST
    });
    if (autoOpenIfMissing) openModelSetupModal();
  } finally {
    if (elements.refreshIcon) elements.refreshIcon.classList.remove('spin-animation');
    if (elements.refreshBtnText) elements.refreshBtnText.textContent = 'Re-check Models';
  }
}

async function checkBackendStatus() {
  return checkModelVerification(true);
}

async function preloadModel(silent = false) {
  if (elements.preloadBtnText) elements.preloadBtnText.textContent = 'Warming...';
  if (elements.subnoteDot) elements.subnoteDot.className = 'subnote-dot warming';
  if (elements.memorySubnoteText) elements.memorySubnoteText.textContent = `Pre-loading ${state.selectedModel} into RAM...`;
  if (!silent) showToast(`Pre-warming ${state.selectedModel} in memory...`);

  try {
    const res = await fetch('/api/preload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: state.selectedModel })
    });
    if (res.ok) {
      if (elements.preloadBtnText) elements.preloadBtnText.textContent = 'Memory Warmed';
      if (elements.btnPreload) {
        elements.btnPreload.classList.add('warmed');
        elements.btnPreload.title = `${state.selectedModel} is locked in memory (keep_alive: -1)`;
      }
      if (elements.subnoteDot) elements.subnoteDot.className = 'subnote-dot active';
      if (elements.memorySubnoteText) elements.memorySubnoteText.textContent = `Resident in RAM (${state.selectedModel})`;
      if (!silent) showToast(`${state.selectedModel} locked in RAM (keep_alive: -1)`);
      checkBackendStatus();
    } else {
      throw new Error(`Server responded with status ${res.status}`);
    }
  } catch (err) {
    if (elements.preloadBtnText) elements.preloadBtnText.textContent = 'Warm Memory';
    if (elements.btnPreload) elements.btnPreload.classList.remove('warmed');
    if (elements.subnoteDot) elements.subnoteDot.className = 'subnote-dot offline';
    if (elements.memorySubnoteText) elements.memorySubnoteText.textContent = 'Preload failed';
    if (!silent) showToast(`Preload failed: ${err.message}`);
  }
}

/* ==========================================================================
   FULL-SCREEN PDF DROP & 90% ZOOM RENDERING
   ========================================================================== */

function initDropzone() {
  const dropArea = elements.pdfFullWrapper;

  ['dragenter', 'dragover'].forEach(name => {
    dropArea.addEventListener(name, (e) => {
      e.preventDefault();
      elements.dropTargetArea.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropArea.addEventListener(name, (e) => {
      e.preventDefault();
      elements.dropTargetArea.classList.remove('dragover');
    });
  });

  dropArea.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) handleSelectedFile(files[0]);
  });

  elements.btnUploadFile.addEventListener('click', () => elements.fileInput.click());
  elements.btnSelectPdf.addEventListener('click', () => elements.fileInput.click());

  elements.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleSelectedFile(e.target.files[0]);
  });

  elements.removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearSelectedFile();
  });
}

function handleSelectedFile(file) {
  state.currentFile = file;
  elements.loadedFileName.textContent = file.name;
  elements.fileLoadedPill.style.display = 'inline-flex';

  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'pdf') {
    if (state.currentPdfUrl) URL.revokeObjectURL(state.currentPdfUrl);
    state.currentPdfUrl = URL.createObjectURL(file);
    
    // Set 90% zoom view
    elements.pdfFrame.src = `${state.currentPdfUrl}#toolbar=1&navpanes=0&scrollbar=1&page=1&zoom=90`;
    elements.pdfFrame.style.display = 'block';
    elements.pdfUploadEmpty.style.display = 'none';
    switchLeftTab('pdf');
    showToast(`PDF loaded (90% view): ${file.name}`);
  } else {
    file.text().then(text => {
      elements.resumeTextInput.value = text;
      updateTextStats();
      switchLeftTab('text');
      showToast(`Text loaded: ${file.name}`);
    });
  }
}

function clearSelectedFile() {
  state.currentFile = null;
  if (state.currentPdfUrl) {
    URL.revokeObjectURL(state.currentPdfUrl);
    state.currentPdfUrl = null;
  }
  elements.fileInput.value = '';
  elements.fileLoadedPill.style.display = 'none';
  elements.pdfFrame.src = '';
  elements.pdfFrame.style.display = 'none';
  elements.pdfUploadEmpty.style.display = 'flex';
  elements.resumeTextInput.value = '';
  updateTextStats();
}

function switchLeftTab(tabName) {
  state.activeLeftTab = tabName;
  if (tabName === 'pdf') {
    elements.tabPdfView.classList.add('active');
    elements.tabTextView.classList.remove('active');
    elements.pdfFullWrapper.style.display = 'flex';
    elements.ocrTextWrapper.style.display = 'none';
  } else {
    elements.tabPdfView.classList.remove('active');
    elements.tabTextView.classList.add('active');
    elements.pdfFullWrapper.style.display = 'none';
    elements.ocrTextWrapper.style.display = 'flex';
  }
}

/* ==========================================================================
   RESUME PARSING (LLAMA LITEPARSE + SELECTED OLLAMA MODEL)
   ========================================================================== */

async function parseResume() {
  if (state.currentFile && state.currentFile.name.toLowerCase().endsWith('.pdf')) {
    await parsePdfWithLiteParse(state.currentFile);
  } else {
    const text = elements.resumeTextInput.value.trim();
    if (!text) {
      showToast('Please upload a PDF resume first.');
      return;
    }
    await parseRawText(text);
  }
}

/**
 * Send PDF to backend for Llama LiteParse OCR + Selected Ollama Model inference
 */
async function parsePdfWithLiteParse(file) {
  const modelLabel = state.selectedModel === 'qwenResumeParserQ8' ? 'Qwen 0.5B (Q8)' : 'Qwen 0.5B (Q4)';
  setLoadingState(true, `Parsing with ${modelLabel}...`, 'Llama LiteParse OCR is reading spatial layout...');
  const startTime = performance.now();

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', state.selectedModel);

    const response = await fetch('/api/parse-pdf', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || `Server responded with status ${response.status}`);
    }

    const result = await response.json();
    const duration = ((performance.now() - startTime) / 1000).toFixed(2);

    // Update OCR Text tab
    state.extractedOcrText = result.extractedText;
    elements.resumeTextInput.value = result.extractedText;
    elements.ocrStatusLabel.textContent = `Llama LiteParse OCR (${result.stats?.totalPages || 1} pages, ${result.stats?.ocrDurationMs || 0}ms OCR)`;
    updateTextStats();

    // Store Cleaned & Raw JSON
    state.parsedData = result.parsedData;
    state.rawJsonData = result.rawJson || result.parsedData;
    state.isPostProcessed = !!result.isPostProcessed;
    state.postProcessChanges = result.postProcessChanges || [];

    elements.parseTime.textContent = `${duration}s (${result.stats?.ocrDurationMs || 0}ms OCR + ${result.stats?.ollamaDurationMs || 0}ms LLM • ${result.modelUsed || state.selectedModel})`;
    elements.benchmarkPill.style.display = 'inline-flex';

    // Update UI
    updatePostProcessBadge();
    renderVisualProfile(state.parsedData);
    updateJsonCodeView();
    switchView(state.currentView);

    showToast(`Parsed in ${duration}s using ${result.modelUsed || state.selectedModel}`);
  } catch (error) {
    console.error('Llama LiteParse error:', error);
    showToast(`Parsing failed: ${error.message}`);
    elements.loadingState.style.display = 'none';
    elements.emptyState.style.display = 'flex';
  } finally {
    setLoadingState(false);
  }
}

/**
 * Send raw text directly to Ollama
 */
async function parseRawText(text) {
  const modelLabel = state.selectedModel === 'qwenResumeParserQ8' ? 'Qwen 0.5B (Q8)' : 'Qwen 0.5B (Q4)';
  setLoadingState(true, `Extracting with ${modelLabel}...`, 'Passing text to resident model in RAM...');
  const startTime = performance.now();

  try {
    const response = await fetch('/api/parse-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model: state.selectedModel })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Inference failed' }));
      throw new Error(err.error || `Server error: ${response.status}`);
    }

    const result = await response.json();
    const duration = ((performance.now() - startTime) / 1000).toFixed(2);

    state.parsedData = result.parsedData;
    state.rawJsonData = result.rawJson || result.parsedData;
    state.isPostProcessed = !!result.isPostProcessed;
    state.postProcessChanges = result.postProcessChanges || [];

    elements.parseTime.textContent = `${duration}s (${result.modelUsed || state.selectedModel})`;
    elements.benchmarkPill.style.display = 'inline-flex';

    updatePostProcessBadge();
    renderVisualProfile(state.parsedData);
    updateJsonCodeView();
    switchView(state.currentView);

    showToast(`Resume parsed in ${duration}s using ${result.modelUsed || state.selectedModel}`);
  } catch (error) {
    console.error('Parsing error:', error);
    showToast(`Parsing failed: ${error.message}`);
    elements.loadingState.style.display = 'none';
    elements.emptyState.style.display = 'flex';
  } finally {
    setLoadingState(false);
  }
}

/* ==========================================================================
   POST-PROCESSING BADGE & DUAL JSON SUB-TABS
   ========================================================================== */

function updatePostProcessBadge() {
  if (!state.parsedData) {
    elements.postprocessBadgeWrap.style.display = 'none';
    return;
  }

  elements.postprocessBadgeWrap.style.display = 'inline-flex';

  if (state.isPostProcessed) {
    elements.postprocessBadge.className = 'postprocess-pill processed';
    elements.postprocessBadge.innerHTML = `
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2">
        <path d="M12 20h9"></path>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
      </svg>
      <span>Post-Processed</span>
    `;
    const changeList = state.postProcessChanges.length > 0
      ? state.postProcessChanges.join('\n• ')
      : 'Removed null experience slots or unverified spoken languages';
    elements.postprocessBadge.title = `Post-processed by backend:\n• ${changeList}`;
  } else {
    elements.postprocessBadge.className = 'postprocess-pill clean';
    elements.postprocessBadge.innerHTML = `
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 14 14"></polyline>
      </svg>
      <span>Raw Model Output</span>
    `;
    elements.postprocessBadge.title = 'Clean direct output from model without post-processing modification';
  }
}

function updateJsonCodeView() {
  if (!state.parsedData && !state.rawJsonData) return;

  if (state.activeJsonSubTab === 'raw') {
    elements.subtabProcessed.classList.remove('active');
    elements.subtabRaw.classList.add('active');
    elements.jsonNoticeText.textContent = 'Raw LLM output directly from Ollama';
    const rawStr = JSON.stringify(state.rawJsonData || state.parsedData, null, 2);
    renderJsonView(rawStr);
  } else {
    elements.subtabProcessed.classList.add('active');
    elements.subtabRaw.classList.remove('active');
    elements.jsonNoticeText.textContent = state.isPostProcessed ? 'Cleaned & validated schema' : 'Clean model output';
    const processedStr = JSON.stringify(state.parsedData, null, 2);
    renderJsonView(processedStr);
  }
}

function getActiveJsonString() {
  const target = (state.activeJsonSubTab === 'raw' && state.rawJsonData)
    ? state.rawJsonData
    : state.parsedData;
  return target ? JSON.stringify(target, null, 2) : '';
}

/* ==========================================================================
   RENDERERS: VISUAL PROFILE & JSON HIGHLIGHTING
   ========================================================================== */

function renderVisualProfile(data) {
  if (!data) return;

  const fullName = data.full_name || 'Candidate Profile';
  elements.vName.textContent = fullName;
  
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'CV';
  elements.avatarInitials.textContent = initials;

  const recentRole = (data.experience && data.experience[0] && data.experience[0].title) || 'Candidate';
  elements.vTitle.textContent = recentRole;

  // Contact
  if (data.email) {
    elements.vEmailChip.style.display = 'inline-flex';
    elements.vEmailLink.textContent = data.email;
    elements.vEmailLink.href = `mailto:${data.email}`;
  } else {
    elements.vEmailChip.style.display = 'none';
  }

  if (data.phone) {
    elements.vPhoneChip.style.display = 'inline-flex';
    elements.vPhoneText.textContent = data.phone;
  } else {
    elements.vPhoneChip.style.display = 'none';
  }

  const locParts = [data.location?.city, data.location?.state, data.location?.country].filter(Boolean);
  if (locParts.length > 0) {
    elements.vLocationChip.style.display = 'inline-flex';
    elements.vLocationText.textContent = locParts.join(', ');
  } else {
    elements.vLocationChip.style.display = 'none';
  }

  // Links
  elements.vLinksRow.innerHTML = '';
  if (Array.isArray(data.links) && data.links.length > 0) {
    data.links.forEach(link => {
      if (!link) return;
      const a = document.createElement('a');
      a.className = 'link-pill';
      a.href = link.startsWith('http') ? link : `https://${link}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';

      let label = 'Link';
      if (link.includes('linkedin')) label = 'LinkedIn';
      else if (link.includes('github')) label = 'GitHub';
      else if (link.includes('twitter') || link.includes('x.com')) label = 'X / Twitter';
      else {
        try {
          label = new URL(a.href).hostname.replace('www.', '');
        } catch (_) {
          label = link;
        }
      }

      a.innerHTML = `↗ ${escapeHtml(label)}`;
      elements.vLinksRow.appendChild(a);
    });
  }

  // Summary
  if (data.summary) {
    elements.secSummary.style.display = 'block';
    elements.vSummaryText.textContent = data.summary;
  } else {
    elements.secSummary.style.display = 'none';
  }

  // Skills
  elements.vSkillsCloud.innerHTML = '';
  if (Array.isArray(data.skills) && data.skills.length > 0) {
    elements.secSkills.style.display = 'block';
    elements.vSkillsCount.textContent = data.skills.length;
    data.skills.forEach(skill => {
      const span = document.createElement('span');
      span.className = 'skill-tag';
      span.textContent = skill;
      elements.vSkillsCloud.appendChild(span);
    });
  } else {
    elements.secSkills.style.display = 'none';
  }

  // Work Experience
  elements.vExperienceTimeline.innerHTML = '';
  if (Array.isArray(data.experience) && data.experience.length > 0) {
    elements.secExperience.style.display = 'block';
    elements.vExpCount.textContent = data.experience.length;

    data.experience.forEach(exp => {
      const item = document.createElement('div');
      item.className = 'timeline-node';

      const dateStr = [exp.start_date, exp.is_current ? 'Present' : exp.end_date].filter(Boolean).join(' — ');
      const currentBadge = exp.is_current ? '<span class="current-tag">Current</span>' : '';
      const locationStr = exp.location ? `<span class="timeline-loc"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> ${escapeHtml(exp.location)}</span>` : '';

      let highlightsHtml = '';
      if (Array.isArray(exp.highlights) && exp.highlights.length > 0) {
        highlightsHtml = `<ul class="timeline-bullets-list">
          ${exp.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}
        </ul>`;
      }

      item.innerHTML = `
        <div class="timeline-bullet work-bullet"></div>
        <div class="timeline-header-row">
          <div>
            <span class="timeline-role-name">${escapeHtml(exp.title || 'Role')}</span>
            <span class="timeline-company-name">@ ${escapeHtml(exp.company || 'Company')}</span>
            ${locationStr}
            ${currentBadge}
          </div>
          ${dateStr ? `<span class="timeline-dates">${escapeHtml(dateStr)}</span>` : ''}
        </div>
        ${exp.description ? `<p class="timeline-desc-text">${escapeHtml(exp.description)}</p>` : ''}
        ${highlightsHtml}
      `;
      elements.vExperienceTimeline.appendChild(item);
    });
  } else {
    elements.secExperience.style.display = 'none';
  }

  // Education (Rich Timeline UI Matching Work Experience)
  const eduContainer = elements.vEducationTimeline || elements.vEducationList;
  if (eduContainer) eduContainer.innerHTML = '';
  if (Array.isArray(data.education) && data.education.length > 0) {
    elements.secEducation.style.display = 'block';
    if (elements.vEduCount) elements.vEduCount.textContent = data.education.length;

    data.education.forEach(edu => {
      const item = document.createElement('div');
      item.className = 'timeline-node education-node';

      const dateStr = [edu.start_date, edu.end_date].filter(Boolean).join(' — ');
      const gpaBadge = edu.gpa ? `<span class="gpa-badge"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> GPA: ${escapeHtml(edu.gpa)}</span>` : '';
      
      const degreeTitle = edu.degree 
        ? (edu.field_of_study ? `${edu.degree} in ${edu.field_of_study}` : edu.degree)
        : (edu.field_of_study ? `Degree in ${edu.field_of_study}` : 'Degree');

      const institutionStr = edu.institution ? `<span class="timeline-company-name education-inst">@ ${escapeHtml(edu.institution)}</span>` : '';

      let highlightsHtml = '';
      if (Array.isArray(edu.highlights) && edu.highlights.length > 0) {
        highlightsHtml = `<ul class="timeline-bullets-list">
          ${edu.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}
        </ul>`;
      } else if (edu.description) {
        highlightsHtml = `<p class="timeline-desc-text">${escapeHtml(edu.description)}</p>`;
      }

      item.innerHTML = `
        <div class="timeline-bullet education-bullet">
          <svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
          </svg>
        </div>
        <div class="timeline-header-row">
          <div>
            <span class="timeline-role-name">${escapeHtml(degreeTitle)}</span>
            ${institutionStr}
            ${gpaBadge}
          </div>
          ${dateStr ? `<span class="timeline-dates">${escapeHtml(dateStr)}</span>` : ''}
        </div>
        ${edu.field_of_study && !edu.degree ? `<div class="edu-field-pill">Major: ${escapeHtml(edu.field_of_study)}</div>` : ''}
        ${highlightsHtml}
      `;
      if (eduContainer) eduContainer.appendChild(item);
    });
  } else {
    elements.secEducation.style.display = 'none';
  }

  // Notable Projects (Virtual Cards)
  elements.vProjectsGrid.innerHTML = '';
  if (Array.isArray(data.projects) && data.projects.length > 0) {
    elements.secProjects.style.display = 'block';
    if (elements.vProjCount) elements.vProjCount.textContent = data.projects.length;

    data.projects.forEach(proj => {
      const card = document.createElement('div');
      card.className = 'virtual-card project-card';

      let linkHtml = '';
      if (proj.url) {
        const href = proj.url.startsWith('http') ? proj.url : `https://${proj.url}`;
        linkHtml = `<a class="card-action-btn" href="${href}" target="_blank" rel="noopener noreferrer" title="Open Project Link">
          <span>View</span>
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>`;
      }

      let techsHtml = '';
      if (Array.isArray(proj.technologies) && proj.technologies.length > 0) {
        techsHtml = `<div class="card-tags-row">
          ${proj.technologies.map(t => `<span class="card-tech-pill">${escapeHtml(t)}</span>`).join('')}
        </div>`;
      }

      card.innerHTML = `
        <div class="card-top-row">
          <div class="card-title-group">
            <div class="card-icon-badge project-badge">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
              </svg>
            </div>
            <span class="card-main-title">${escapeHtml(proj.name || 'Project')}</span>
          </div>
          ${linkHtml}
        </div>
        ${proj.description ? `<p class="card-body-text">${escapeHtml(proj.description)}</p>` : ''}
        ${techsHtml}
      `;
      elements.vProjectsGrid.appendChild(card);
    });
  } else {
    elements.secProjects.style.display = 'none';
  }

  // Certifications (Virtual Cards)
  elements.vCertificationsList.innerHTML = '';
  if (Array.isArray(data.certifications) && data.certifications.length > 0) {
    elements.secCertifications.style.display = 'block';
    if (elements.vCertCount) elements.vCertCount.textContent = data.certifications.length;

    data.certifications.forEach(cert => {
      const card = document.createElement('div');
      card.className = 'virtual-card cert-card';

      card.innerHTML = `
        <div class="card-top-row">
          <div class="card-title-group">
            <div class="card-icon-badge cert-badge">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <polyline points="9 12 11 14 15 10"></polyline>
              </svg>
            </div>
            <div>
              <span class="card-main-title">${escapeHtml(cert.name || 'Certification')}</span>
              ${cert.issuer ? `<div class="card-sub-title">${escapeHtml(cert.issuer)}</div>` : ''}
            </div>
          </div>
          ${cert.date ? `<span class="card-meta-pill">${escapeHtml(cert.date)}</span>` : ''}
        </div>
        <div class="card-footer-status">
          <span class="verified-chip">
            <span class="verified-dot"></span> Verified Credential
          </span>
        </div>
      `;
      elements.vCertificationsList.appendChild(card);
    });
  } else {
    elements.secCertifications.style.display = 'none';
  }

  // Awards & Achievements (Virtual Cards)
  elements.vAwardsList.innerHTML = '';
  if (Array.isArray(data.awards_achievements) && data.awards_achievements.length > 0) {
    elements.secAwards.style.display = 'block';
    if (elements.vAwardsCount) elements.vAwardsCount.textContent = data.awards_achievements.length;

    data.awards_achievements.forEach(award => {
      const card = document.createElement('div');
      card.className = 'virtual-card award-card';

      card.innerHTML = `
        <div class="card-top-row">
          <div class="card-title-group">
            <div class="card-icon-badge award-badge">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="8" r="7"></circle>
                <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
              </svg>
            </div>
            <div>
              <span class="card-main-title">${escapeHtml(award.name || 'Award / Achievement')}</span>
              ${award.issuer ? `<div class="card-sub-title">Awarded by ${escapeHtml(award.issuer)}</div>` : ''}
            </div>
          </div>
          ${award.date ? `<span class="card-meta-pill gold">${escapeHtml(award.date)}</span>` : ''}
        </div>
        ${award.description ? `<p class="card-body-text">${escapeHtml(award.description)}</p>` : ''}
      `;
      elements.vAwardsList.appendChild(card);
    });
  } else {
    elements.secAwards.style.display = 'none';
  }

  // Spoken Languages (Virtual Cards)
  elements.vLanguagesCloud.innerHTML = '';
  if (Array.isArray(data.spoken_languages) && data.spoken_languages.length > 0) {
    elements.secLanguages.style.display = 'block';
    if (elements.vLangCount) elements.vLangCount.textContent = data.spoken_languages.length;

    data.spoken_languages.forEach(lang => {
      const card = document.createElement('div');
      card.className = 'virtual-card language-card';

      card.innerHTML = `
        <div class="language-card-inner">
          <div class="card-icon-badge lang-badge">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
          </div>
          <div class="lang-info">
            <span class="lang-name">${escapeHtml(lang)}</span>
            <span class="lang-badge-status">Native / Fluent</span>
          </div>
        </div>
      `;
      elements.vLanguagesCloud.appendChild(card);
    });
  } else {
    elements.secLanguages.style.display = 'none';
  }
}

function renderJsonView(jsonString) {
  elements.jsonCodeBlock.innerHTML = syntaxHighlightJson(jsonString);
}

function syntaxHighlightJson(json) {
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'json-key';
      } else {
        cls = 'json-string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return `<span class="${cls}">${match}</span>`;
  });
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

/* ==========================================================================
   VIEW SWITCHING & STATES
   ========================================================================== */

function switchView(viewName) {
  state.currentView = viewName;
  if (viewName === 'visual') {
    elements.tabVisual.classList.add('active');
    elements.tabJson.classList.remove('active');
    if (state.parsedData) {
      elements.visualProfileView.style.display = 'flex';
      elements.jsonCodeView.style.display = 'none';
      elements.emptyState.style.display = 'none';
    }
  } else {
    elements.tabVisual.classList.remove('active');
    elements.tabJson.classList.add('active');
    if (state.parsedData || state.rawJsonData) {
      elements.visualProfileView.style.display = 'none';
      elements.jsonCodeView.style.display = 'block';
      elements.emptyState.style.display = 'none';
      updateJsonCodeView();
    }
  }
}

function setLoadingState(isLoading, title = 'Parsing Resume...', desc = 'Llama LiteParse OCR is reading spatial layout...') {
  state.isParsing = isLoading;
  elements.btnParse.disabled = isLoading;

  if (isLoading) {
    elements.parseSpinner.style.display = 'inline-block';
    elements.parseIcon.style.display = 'none';
    elements.parseBtnText.textContent = 'Parsing...';
    elements.emptyState.style.display = 'none';
    elements.visualProfileView.style.display = 'none';
    elements.jsonCodeView.style.display = 'none';
    elements.loadingState.style.display = 'flex';
    elements.loadingTitle.textContent = title;
    elements.loadingSubtext.textContent = desc;

    let seconds = 0;
    elements.liveTimer.textContent = '0.0';
    state.timerInterval = setInterval(() => {
      seconds += 0.1;
      elements.liveTimer.textContent = seconds.toFixed(1);
    }, 100);
  } else {
    elements.parseSpinner.style.display = 'none';
    elements.parseIcon.style.display = 'inline-block';
    elements.parseBtnText.textContent = 'Parse Resume';
    elements.loadingState.style.display = 'none';
    if (state.timerInterval) clearInterval(state.timerInterval);
  }
}

/* ==========================================================================
   EVENT LISTENERS & ACTIONS
   ========================================================================== */

function initEventListeners() {
  // Tabs Left
  elements.tabPdfView.addEventListener('click', () => switchLeftTab('pdf'));
  elements.tabTextView.addEventListener('click', () => switchLeftTab('text'));

  // Model Selector
  elements.modelSelector.addEventListener('change', (e) => {
    state.selectedModel = e.target.value;
    localStorage.setItem('selected_model', state.selectedModel);
    showToast(`Switched model to ${state.selectedModel}`);
    preloadModel(true);
  });

  // Preload
  elements.btnPreload.addEventListener('click', () => preloadModel(false));

  // Global Parse Action (Top Header)
  elements.btnParse.addEventListener('click', parseResume);

  // View Switch Tabs
  elements.tabVisual.addEventListener('click', () => switchView('visual'));
  elements.tabJson.addEventListener('click', () => switchView('json'));

  // JSON Sub-tabs (Cleaned vs Raw)
  if (elements.subtabProcessed) {
    elements.subtabProcessed.addEventListener('click', () => {
      state.activeJsonSubTab = 'processed';
      updateJsonCodeView();
    });
  }

  if (elements.subtabRaw) {
    elements.subtabRaw.addEventListener('click', () => {
      state.activeJsonSubTab = 'raw';
      updateJsonCodeView();
    });
  }

  elements.resumeTextInput.addEventListener('input', updateTextStats);

  // Copy JSON (copies currently active sub-tab JSON)
  elements.btnCopyJson.addEventListener('click', () => {
    const jsonStr = getActiveJsonString();
    if (!jsonStr) {
      showToast('No JSON to copy yet.');
      return;
    }
    navigator.clipboard.writeText(jsonStr).then(() => {
      elements.copyBtnText.textContent = 'Copied!';
      setTimeout(() => elements.copyBtnText.textContent = 'Copy JSON', 2000);
      showToast(`${state.activeJsonSubTab === 'raw' ? 'Raw LLM' : 'Cleaned'} JSON copied to clipboard`);
    });
  });

  // Download JSON (exports currently active sub-tab JSON)
  elements.btnDownloadJson.addEventListener('click', () => {
    const jsonStr = getActiveJsonString();
    if (!jsonStr) {
      showToast('No JSON to download yet.');
      return;
    }
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const prefix = state.activeJsonSubTab === 'raw' ? 'raw_' : '';
    const name = (state.parsedData?.full_name || 'parsed_resume').toLowerCase().replace(/\s+/g, '_');
    a.download = `${prefix}${name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${state.activeJsonSubTab === 'raw' ? 'Raw' : 'Cleaned'} JSON exported`);
  });
  // Model Setup & Verification Modal
  if (elements.btnModelGuide) {
    elements.btnModelGuide.addEventListener('click', () => {
      openModelSetupModal();
    });
  }

  if (elements.btnCloseModal) {
    elements.btnCloseModal.addEventListener('click', () => {
      closeModelSetupModal();
    });
  }

  if (elements.btnModalDone) {
    elements.btnModalDone.addEventListener('click', () => {
      closeModelSetupModal();
    });
  }

  if (elements.modelSetupModal) {
    elements.modelSetupModal.addEventListener('click', (e) => {
      if (e.target === elements.modelSetupModal) {
        closeModelSetupModal();
      }
    });
  }

  if (elements.btnRefreshModels) {
    elements.btnRefreshModels.addEventListener('click', () => {
      checkModelVerification(false);
    });
  }

  // Close modal on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.modelSetupModal && elements.modelSetupModal.style.display !== 'none') {
      closeModelSetupModal();
    }
  });
}

function updateTextStats() {
  const text = elements.resumeTextInput.value;
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  elements.ocrStats.textContent = `${words.toLocaleString()} words • ${chars.toLocaleString()} chars`;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.style.display = 'block';
  setTimeout(() => {
    elements.toast.style.display = 'none';
  }, 3000);
}
