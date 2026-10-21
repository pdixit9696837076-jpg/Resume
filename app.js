(() => {
  "use strict";

  const STORAGE_KEY = "folio-resumes-v1";
  const ORDER_KEY = "folio-section-order-v1";
  const AI_SETTINGS_KEY = "pauser-ai-settings-v1";
  const GURUAGENT_API_URL = "https://guruagent-fixed.vercel.app/api/chat";
  const sections = [
    { id: "summary", label: "Professional summary", icon: "✎", hint: "A quick introduction to your career" },
    { id: "experience", label: "Work experience", icon: "▣", hint: "Show the impact you've made" },
    { id: "education", label: "Education", icon: "⌂", hint: "Your academic background" },
    { id: "skills", label: "Skills", icon: "✦", hint: "Your strengths and expertise" },
    { id: "projects", label: "Projects & certifications", icon: "◇", hint: "The work you're proud of" }
  ];
  const templates = [
    { id: "classic", name: "Classic ATS", category: "ATS safe", detail: "A clean, single-column layout made for applicant tracking systems." },
    { id: "modern", name: "Modern", category: "Professional", detail: "A fresh, confident look with a subtle green accent." },
    { id: "creative", name: "Creative", category: "Creative", detail: "A warm editorial style for creative and design-minded roles." },
    { id: "executive", name: "Executive", category: "Professional", detail: "A polished, understated format for senior professionals." },
    { id: "minimal", name: "Minimal", category: "ATS safe", detail: "Quiet typography and generous spacing keep the focus on results." },
    { id: "compact", name: "Compact One-page", category: "ATS safe", detail: "Space-efficient sections for concise, early-career resumes." },
    { id: "professional", name: "Professional", category: "Professional", detail: "A balanced layout for a wide range of industries." },
    { id: "technical", name: "Technical", category: "Technology", detail: "A structured, skills-forward design for engineering roles." },
    { id: "academic", name: "Academic", category: "Academic", detail: "A traditional, readable style for research and education." },
    { id: "corporate", name: "Corporate", category: "Professional", detail: "A formal layout suited to established organizations." },
    { id: "elegant", name: "Elegant", category: "Professional", detail: "Refined type and subtle rules for a considered presentation." },
    { id: "bold", name: "Bold", category: "Creative", detail: "Confident headings add personality without losing readability." },
    { id: "gradient", name: "Fresh Accent", category: "Creative", detail: "A contemporary color accent with a simple, readable structure." },
    { id: "editorial", name: "Editorial", category: "Creative", detail: "An editorial hierarchy for writing, media, and content roles." },
    { id: "portfolio", name: "Portfolio", category: "Creative", detail: "A visual-forward format for showcasing projects and craft." },
    { id: "startup", name: "Startup", category: "Technology", detail: "A modern, agile look for startup and product teams." },
    { id: "product", name: "Product Leader", category: "Technology", detail: "Clear impact-led sections for product and program managers." },
    { id: "engineering", name: "Engineer", category: "Technology", detail: "A concise, technical format with room for projects and tools." },
    { id: "analyst", name: "Data Analyst", category: "Technology", detail: "A crisp layout that gives analytical results room to stand out." },
    { id: "finance", name: "Finance", category: "Industry", detail: "A conservative, numbers-first format for finance roles." },
    { id: "healthcare", name: "Healthcare", category: "Industry", detail: "A clear professional format for care and clinical teams." },
    { id: "consultant", name: "Consultant", category: "Industry", detail: "An outcome-focused layout for client-facing professionals." },
    { id: "photo-classic", name: "Portrait Classic", category: "Photo layouts", photo: true, detail: "A classic resume with an optional profile photo." },
    { id: "photo-modern", name: "Portrait Modern", category: "Photo layouts", photo: true, detail: "A modern accent layout with an optional profile photo." },
    { id: "photo-creative", name: "Portrait Creative", category: "Photo layouts", photo: true, detail: "A creative editorial layout with an optional profile photo." }
  ];
  const THEME_KEY = "pauser-theme-v1";
  const blankResume = () => ({
    id: makeId(), name: "Untitled resume", updatedAt: Date.now(), template: "classic",
    contact: { name: "", role: "", email: "", phone: "", location: "", linkedin: "", portfolio: "", photo: "" },
    summary: "", experience: [], education: [], skills: [], projects: []
  });

  function normalizeResume(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Resume data must be an object");
    const text = value => typeof value === "string" ? value : "";
    const entries = (items, keys) => Array.isArray(items) ? items.filter(item => item && typeof item === "object" && !Array.isArray(item)).map(item => Object.fromEntries(keys.map(key => [key, text(item[key])]))) : [];
    const contact = data.contact && typeof data.contact === "object" && !Array.isArray(data.contact) ? data.contact : {};
    const validTemplate = templates.some(item => item.id === data.template) ? data.template : "classic";
    return {
      id: typeof data.id === "string" && data.id ? data.id : makeId(),
      name: text(data.name) || "Untitled resume",
      updatedAt: Number.isFinite(data.updatedAt) ? data.updatedAt : Date.now(),
      template: validTemplate,
      contact: {
        ...Object.fromEntries(["name", "role", "email", "phone", "location", "linkedin", "portfolio"].map(key => [key, text(contact[key])])),
        photo: typeof contact.photo === "string" && contact.photo.length <= 500000 && /^data:image\/(?:jpeg|png|webp);base64,/.test(contact.photo) ? contact.photo : ""
      },
      summary: text(data.summary),
      experience: entries(data.experience, ["title", "company", "start", "end", "bullets"]),
      education: entries(data.education, ["degree", "school", "year", "grade"]),
      skills: Array.isArray(data.skills) ? data.skills.filter(skill => typeof skill === "string") : [],
      projects: entries(data.projects, ["name", "link", "description"])
    };
  }

  let resumes = loadResumes();
  let activeResumeId = resumes.length ? resumes[0].id : null;
  let currentView = "dashboard";
  let collapsed = new Set();
  let toastTimeout;
  let uploadLibraries = {};
  let order = loadOrder();
  let aiMessages = [];

  function initTheme() {
    let savedTheme = localStorage.getItem(THEME_KEY);
    if (!savedTheme) {
      savedTheme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    applyTheme(savedTheme);
  }

  function applyTheme(theme) {
    const isDark = theme === "dark";
    document.body.classList.toggle("dark-theme", isDark);
    localStorage.setItem(THEME_KEY, theme);
    const metaTheme = document.getElementById("meta-theme-color");
    if (metaTheme) metaTheme.setAttribute("content", isDark ? "#0c120e" : "#f6f7f5");

    const btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.innerHTML = `<span class="theme-icon">${isDark ? "☀️" : "🌙"}</span><span class="theme-text">${isDark ? "Light" : "Dark"}</span>`;
    }
    const sideBtn = document.getElementById("sidebar-theme-toggle");
    if (sideBtn) {
      sideBtn.textContent = isDark ? "☀️" : "🌙";
    }
    if (window.updateThreeJsTheme) window.updateThreeJsTheme(isDark);
  }

  function toggleTheme() {
    const isCurrentDark = document.body.classList.contains("dark-theme");
    applyTheme(isCurrentDark ? "light" : "dark");
    toast(`Switched to ${isCurrentDark ? "Light" : "Dark"} theme.`);
  }

  function downloadResumePdf(resumeId) {
    const targetId = resumeId || activeResumeId || (resumes[0] && resumes[0].id);
    if (!targetId) {
      toast("Please create or select a resume first.", true);
      return;
    }
    activeResumeId = targetId;
    const resume = activeResume();
    const cleanName = (resume?.contact?.name || "Resume").replace(/[^a-zA-Z0-9_-]/g, "_");
    const oldTitle = document.title;
    document.title = `${cleanName}_Resume.pdf`;

    setView("builder");
    toast("Opening print dialog — select 'Save as PDF' to download your resume.");
    setTimeout(() => {
      window.print();
      setTimeout(() => { document.title = oldTitle; }, 1000);
    }, 280);
  }

  try {
    localStorage.removeItem(AI_SETTINGS_KEY);
  } catch (error) {
    console.error("Could not remove the retired AI provider settings:", error);
  }

  function makeId() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  function safeUrl(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    const candidate = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    try {
      const url = new URL(candidate);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
  }
  function loadResumes() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(saved)) throw new Error("Saved resumes must be a list");
      return saved.filter(item => item && !(typeof item.id === "string" && item.id.startsWith("featured-"))).map(normalizeResume);
    } catch (error) {
      console.error("Could not load saved resumes:", error);
      return [];
    }
  }
  function loadOrder() {
    try {
      const saved = JSON.parse(localStorage.getItem(ORDER_KEY) || "null");
      return Array.isArray(saved) ? sections.map(section => saved.includes(section.id) ? section.id : null).filter(Boolean).concat(sections.map(section => section.id).filter(id => !saved.includes(id))) : sections.map(section => section.id);
    } catch (error) {
      console.error("Could not load saved section order:", error);
      return sections.map(section => section.id);
    }
  }
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(resumes));
      setSaveStatus("All changes saved");
    } catch {
      setSaveStatus("Could not save changes");
      toast("Storage is unavailable. Export a PDF to keep a copy.", true);
    }
  }
  function setSaveStatus(text) {
    const node = document.getElementById("save-status");
    if (node) node.textContent = text;
  }
  function activeResume() { return resumes.find(item => item.id === activeResumeId); }
  function formatDate(timestamp) { return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(timestamp)); }
  function toast(message, error = false) {
    const node = document.getElementById("toast");
    node.textContent = message;
    node.classList.toggle("error", error);
    node.classList.add("visible");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => node.classList.remove("visible"), 2600);
  }
  function setView(view) {
    currentView = view;
    document.querySelectorAll(".page-view").forEach(node => node.classList.add("hidden"));
    const target = document.getElementById(`${view}-view`);
    if (target) target.classList.remove("hidden");
    document.querySelectorAll(".nav-item").forEach(node => node.classList.toggle("active", node.dataset.view === view));
    document.querySelectorAll(".mob-nav-item").forEach(node => node.classList.toggle("active", node.dataset.view === view));
    const crumb = document.getElementById("breadcrumb-current");
    crumb.textContent = view === "dashboard" ? "My resumes" : view === "builder" ? "Resume builder" : view === "tracker" ? "Job applications" : view === "templates" ? "Templates" : view === "ai" ? "AI assistant" : "Workspace";
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (view === "dashboard") renderDashboard();
    if (view === "builder") renderBuilder();
    if (view === "tracker") renderTracker();
    if (view === "templates") renderTemplates();
    if (view === "ai") renderAiAssistant();
  }
  function openBuilder(resume) {
    activeResumeId = resume.id;
    collapsed = new Set();
    setView("builder");
  }
  function createResume() {
    const resume = blankResume();
    resumes.unshift(resume);
    activeResumeId = resume.id;
    persist();
    openBuilder(resume);
  }
  function renderDashboard() {
    const view = document.getElementById("dashboard-view");
    const cards = resumes.map(resume => `
      <article class="resume-card">
        <div class="resume-thumb"><div class="paper-mini"><div class="mini-heading"></div><div class="mini-line narrow"></div><div class="mini-rule"></div><div class="mini-line"></div><div class="mini-line wide"></div><div class="mini-rule"></div><div class="mini-line"></div><div class="mini-line narrow"></div><div class="mini-line wide"></div><div class="mini-rule"></div><div class="mini-line"></div><div class="mini-line wide"></div></div></div>
        <div class="resume-meta"><div class="doc-icon">▤</div><div class="resume-name"><strong>${escapeHtml(resume.name || "Untitled resume")}</strong><span>Edited ${formatDate(resume.updatedAt || Date.now())}</span></div><button class="card-menu" data-action="delete" data-id="${escapeHtml(resume.id)}" aria-label="Delete resume">×</button></div>
        <div class="card-actions"><button data-action="edit" data-id="${escapeHtml(resume.id)}">Edit resume</button><button data-action="export" data-id="${escapeHtml(resume.id)}">Download PDF</button></div>
      </article>`).join("");
    view.innerHTML = `
      <div class="welcome-banner">
        <div class="welcome-copy">
          <div class="eyebrow">Your job search, made simpler</div>
          <h1>Build a resume that gets you to your next opportunity.</h1>
          <p>Create a clear, tailored resume, check it against a job description, and keep every application organized — all in one private workspace.</p>
          <div class="banner-actions">
            <button class="primary-button" data-action="create"><span class="button-icon">＋</span>Start your resume</button>
            <button class="secondary-button" data-action="open-tracker"><span class="button-icon">↗</span>Track applications</button>
          </div>
        </div>
        <div class="banner-3d-wrap" id="banner-3d-canvas-wrap"></div>
        <span class="banner-3d-badge">Made for your next step</span>
      </div>
      <section class="ats-upload-panel" aria-labelledby="upload-heading">
        <div class="upload-intro"><div class="upload-icon">↑</div><div><div class="eyebrow">A quick check before you apply</div><h2 id="upload-heading">Review your resume</h2><p>Check sections and keywords in a resume file. Your document is analyzed on this device.</p></div></div>
        <label class="upload-button secondary-button" for="resume-upload" tabindex="0">Choose a file</label>
        <input id="resume-upload" class="visually-hidden" type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain">
        <div class="upload-note">PDF, DOCX or TXT · Scanned PDFs supported · Up to 15 MB · Analyzed on this device</div>
      </section>
      <div class="section-head"><h2>Your resumes</h2><span>${resumes.length} ${resumes.length === 1 ? "document" : "documents"}</span></div>
      ${resumes.length ? `<div class="resume-grid">${cards}</div>` : `<div class="empty-state"><div class="empty-icon">▤</div><h3>Your first resume is waiting</h3><p>Start with the essentials. You can always add more as you go.</p><button class="secondary-button" data-action="create">Create your first resume</button></div>`}`;

    setTimeout(initBanner3D, 50);

    const fileInput = view.querySelector("#resume-upload");
    fileInput.addEventListener("change", async () => {
      const [file] = fileInput.files || [];
      if (file) await analyzeUploadedFile(file, view);
      fileInput.value = "";
    });
    const dropZone = view.querySelector(".ats-upload-panel");
    dropZone.addEventListener("dragover", event => {
      event.preventDefault();
      dropZone.classList.add("drag-over");
    });
    dropZone.addEventListener("dragleave", event => {
      if (!dropZone.contains(event.relatedTarget)) dropZone.classList.remove("drag-over");
    });
    dropZone.addEventListener("drop", async event => {
      event.preventDefault();
      dropZone.classList.remove("drag-over");
      const [file] = event.dataTransfer.files || [];
      if (file) await analyzeUploadedFile(file, view);
    });
    view.onclick = event => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const item = resumes.find(resume => resume.id === button.dataset.id);
      if (button.dataset.action === "create") createResume();
      if (button.dataset.action === "open-tracker") setView("tracker");
      if (button.dataset.action === "edit" && item) openBuilder(item);
      if (button.dataset.action === "delete" && item) {
        if (confirm(`Delete "${item.name || "Untitled resume"}"? This cannot be undone.`)) {
          resumes = resumes.filter(resume => resume.id !== item.id);
          persist(); renderDashboard(); toast("Resume deleted.");
        }
      }
      if (button.dataset.action === "export" && item) downloadResumePdf(item.id);
    };
  }
  async function analyzeUploadedFile(file, view) {
    const extension = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "docx", "txt"].includes(extension)) {
      toast("Please choose a PDF, DOCX, or TXT file.", true);
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast("This file is larger than 15 MB. Choose a smaller resume.", true);
      return;
    }
    if (file.size === 0) {
      toast("This file is empty. Choose a resume with text.", true);
      return;
    }
    const dialog = openScanDialog(file.name);
    try {
      updateScanProgress(dialog, 1);
      await new Promise(resolve => setTimeout(resolve, 220));
      const text = await extractResumeText(file, extension, status => {
        dialog.querySelector(".scan-progress-label").textContent = status;
      });
      const readableText = text.replace(/\s+/g, " ").trim();
      const readableWords = readableText.match(/\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b/gu) || [];
      if (readableText.length < 20 || readableWords.length < 3) {
        throw new Error("I couldn't read enough text from this file, even after trying PDF text extraction and OCR. Please download the PDF again, or upload a DOCX/TXT version.");
      }
      updateScanProgress(dialog, 2);
      await new Promise(resolve => setTimeout(resolve, 260));
      const analysis = analyzeResumeText(text);
      updateScanProgress(dialog, 3);
      await new Promise(resolve => setTimeout(resolve, 220));
      renderScanResults(dialog, file.name, text, analysis);
    } catch (error) {
      console.error("Resume upload analysis failed:", error);
      renderScanError(dialog, error instanceof Error ? error.message : "Could not read this resume. Try another PDF, DOCX, or TXT file.");
    }
  }
  function openScanDialog(fileName) {
    document.querySelector("#resume-scan-dialog")?.remove();
    const restoreFocus = document.querySelector('label[for="resume-upload"]');
    const appShell = document.querySelector(".app-shell");
    const previousBodyOverflow = document.body.style.overflow;
    const dialog = document.createElement("div");
    dialog.id = "resume-scan-dialog";
    dialog.className = "scan-overlay";
    if (appShell) appShell.inert = true;
    document.body.style.overflow = "hidden";
    dialog.innerHTML = `<section class="scan-dialog" role="dialog" aria-modal="true" aria-labelledby="scan-title"><header class="scan-dialog-header"><div><div class="eyebrow">Private resume review</div><h2 id="scan-title" tabindex="-1">Scanning your resume</h2><p class="scan-filename">${escapeHtml(fileName)}</p></div><button class="scan-close" type="button" aria-label="Close review">×</button></header><div class="scan-loading" role="status"><div class="scan-spinner"></div><div class="scan-progress-label">Reading your resume text…</div><div class="scan-progress-track"><span></span></div><div class="scan-step-list"><span data-scan-step="1">Extracting resume text</span><span data-scan-step="2">Checking sections and bullet points</span><span data-scan-step="3">Preparing your review</span></div></div><div class="scan-result hidden"></div></section>`;
    document.body.append(dialog);
    const close = () => {
      document.removeEventListener("keydown", onKeyDown);
      dialog.remove();
      if (appShell) appShell.inert = false;
      document.body.style.overflow = previousBodyOverflow;
      if (restoreFocus instanceof HTMLElement && restoreFocus.isConnected) restoreFocus.focus();
    };
    dialog.closeReview = close;
    const onKeyDown = event => {
      if (event.key === "Escape") close();
      if (event.key === "Tab") {
        const focusable = [...dialog.querySelectorAll("button, textarea, input, [tabindex]:not([tabindex='-1'])")].filter(node => !node.disabled && node.offsetParent !== null);
        if (!focusable.length) return;
        if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
      }
    };
    dialog.querySelector(".scan-close").addEventListener("click", close);
    dialog.addEventListener("click", event => { if (event.target === dialog) close(); });
    document.addEventListener("keydown", onKeyDown);
    dialog.querySelector(".scan-close").focus();
    return dialog;
  }
  function updateScanProgress(dialog, step) {
    const labels = ["Reading your resume text…", "Checking sections and bullet points…", "Preparing your review…"];
    dialog.querySelector("#scan-title").textContent = step === 3 ? "Finishing your review" : "Scanning your resume";
    dialog.querySelector(".scan-progress-label").textContent = labels[step - 1];
    dialog.querySelector(".scan-progress-track span").style.width = `${step * 30}%`;
    dialog.querySelectorAll("[data-scan-step]").forEach(node => {
      const completed = Number(node.dataset.scanStep) < step;
      node.classList.toggle("complete", completed);
      node.classList.toggle("current", Number(node.dataset.scanStep) === step);
    });
  }
  function renderScanError(dialog, message) {
    const loading = dialog.querySelector(".scan-loading");
    loading.innerHTML = `<div class="scan-error-icon">!</div><h3>We couldn't scan this file</h3><p>${escapeHtml(message)}</p><button class="secondary-button scan-retry" type="button">Choose another file</button>`;
    dialog.querySelector("#scan-title").textContent = "Resume scan stopped";
    loading.querySelector(".scan-retry").addEventListener("click", () => {
      dialog.closeReview();
      setTimeout(() => document.querySelector("#resume-upload")?.click(), 0);
    });
  }
  function loadScriptOnce(url) {
    if (uploadLibraries[url]) return uploadLibraries[url];
    uploadLibraries[url] = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        delete uploadLibraries[url];
        reject(new Error("Could not load the document reader. Check your internet connection and try again."));
      };
      document.head.append(script);
    });
    return uploadLibraries[url];
  }
  async function loadPdfDocument(file) {
    const buffer = await file.arrayBuffer();
    const sources = [
      {
        library: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
        worker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
      },
      {
        library: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
        worker: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js"
      }
    ];
    let pdf;
    let lastError;
    for (const source of sources) {
      try {
        await loadScriptOnce(source.library);
        if (!window.pdfjsLib) throw new Error("The PDF reader did not initialize.");
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = source.worker;
        pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!pdf) throw new Error(`Could not open this PDF. Check that it is not password-protected or damaged. ${lastError instanceof Error ? lastError.message : ""}`.trim());
    return pdf;
  }
  async function createOcrWorker() {
    const sources = [
      "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",
      "https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js"
    ];
    let lastError;
    for (const source of sources) {
      try {
        await loadScriptOnce(source);
        if (!window.Tesseract) throw new Error("The OCR reader did not initialize.");
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!window.Tesseract) {
      throw new Error(`Could not load the PDF text reader. Check your internet connection and try again. ${lastError instanceof Error ? lastError.message : ""}`.trim());
    }
    return window.Tesseract.createWorker("eng", 1, {
      workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
      corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1",
      langPath: "https://tessdata.projectnaptha.com/4.0.0"
    });
  }
  async function recognizePdfPage(page, worker, pageNumber, pageCount, onStatus) {
    onStatus(`Reading scanned page ${pageNumber} of ${pageCount}…`);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    try {
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      const result = await worker.recognize(canvas);
      return result.data.text;
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
  async function extractResumeText(file, extension, onStatus = () => { }) {
    if (extension === "txt") return file.text();
    if (extension === "pdf") {
      const pdf = await loadPdfDocument(file);
      const pages = [];
      let ocrWorker = null;
      try {
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          const page = await pdf.getPage(pageNumber);
          const content = await page.getTextContent();
          const lines = [];
          let currentLine = "";
          let previousY = null;
          for (const item of content.items) {
            if (typeof item.str !== "string" || !item.str.trim()) continue;
            const y = item.transform?.[5];
            if (previousY !== null && Number.isFinite(y) && Math.abs(y - previousY) > 2) {
              if (currentLine.trim()) lines.push(currentLine.trim());
              currentLine = "";
            }
            currentLine += `${currentLine ? " " : ""}${item.str}`;
            if (Number.isFinite(y)) previousY = y;
          }
          if (currentLine.trim()) lines.push(currentLine.trim());
          let pageText = lines.join("\n");
          const pageWords = pageText.match(/\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b/gu) || [];
          if (pageText.trim().length < 30 || pageWords.length < 5) {
            ocrWorker ||= await createOcrWorker();
            pageText = await recognizePdfPage(page, ocrWorker, pageNumber, pdf.numPages, onStatus);
          }
          pages.push(pageText);
        }
      } finally {
        if (ocrWorker) await ocrWorker.terminate();
      }
      return pages.join("\n");
    }
    const buffer = await file.arrayBuffer();
    await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js");
    if (!window.mammoth) throw new Error("The DOCX reader did not initialize. Try uploading a PDF or TXT file.");
    const parsed = await window.mammoth.extractRawText({ arrayBuffer: buffer });
    return parsed.value;
  }
  function analyzeResumeText(text) {
    const normalized = text.replace(/\s+/g, " ").trim();
    const words = normalized.match(/\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b/gu) || [];
    const metricPattern = /(?:\b\d+(?:[.,]\d+)?\s?%|\b\d+(?:[.,]\d+)?\s+percent\b|\b\d+(?:[.,]\d+)?\s?(?:k|m|million|billion|users|customers|clients|hours|days|weeks|projects|people|employees|team members|locations|tickets|sales|revenue|leads|deployments)\b|[$£€]\s?\d)/i;
    const actionPattern = /\b(achieved|analyzed|built|created|delivered|designed|developed|directed|established|implemented|improved|increased|launched|led|managed|optimized|reduced|streamlined|coordinated|supported|maintained|drove|spearheaded|generated|negotiated|resolved|transformed|accelerated|automated|launched|mentored|produced|secured|trained)\b/i;
    const experienceMatch = normalized.match(/(?:work experience|professional experience|employment history|work history|experience)([\s\S]*?)(?=\b(?:education|academic background|qualifications|skills|projects|certifications)\b|$)/i);
    const experienceText = experienceMatch?.[1] || "";
    const checks = [
      { id: "email", label: "Email address", passed: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(normalized), points: 10, advice: "Add a professional email address to your contact details." },
      { id: "phone", label: "Phone number", passed: /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}\b/.test(normalized), points: 5, advice: "Add a reachable phone number with your country code." },
      { id: "headings", label: "Recognizable section headings", passed: /\b(summary|objective|experience|employment|education|skills|projects|certifications)\b/i.test(normalized), points: 10, advice: "Use clear, conventional headings such as Experience, Education and Skills." },
      { id: "experience", label: "Work experience section", passed: /\b(work experience|professional experience|employment history|work history|experience)\b/i.test(normalized), points: 15, advice: "Add a clearly labeled Work Experience section if it applies to you." },
      { id: "education", label: "Education section", passed: /\b(education|academic background|qualifications)\b/i.test(normalized), points: 10, advice: "Add a clearly labeled Education section if it applies to you." },
      { id: "skills", label: "Skills section", passed: /\b(skills|technical skills|core competencies|key skills)\b/i.test(normalized), points: 10, advice: "Add a Skills section with skills relevant to your target role." },
      { id: "actions", label: "Action verbs in experience", passed: actionPattern.test(experienceText), points: 10, advice: "Begin experience bullets with specific action verbs such as built, led, improved or delivered." },
      { id: "impact", label: "Measurable outcomes in experience", passed: metricPattern.test(experienceText), points: 20, advice: "Where accurate, show scale or results with numbers, percentages, time saved or customers reached." },
      { id: "length", label: "Readable text length", passed: words.length >= 200 && words.length <= 1200, points: 10, advice: words.length < 200 ? "The extracted text is brief. Add relevant detail if it reflects your actual experience." : "The extracted text is long. Consider removing repetition and keeping relevant detail." }
    ];
    const experienceLines = (text.includes("\n") ? text.split(/\r?\n/) : experienceText.split(/(?<=[.!?])\s+/))
      .map(line => line.trim().replace(/^[\u2022•▪◦*\-–—\s]+/, ""))
      .filter(line => line.length >= 35 && actionPattern.test(line) && !metricPattern.test(line))
      .slice(0, 8);
    const metricLines = (text.includes("\n") ? text.split(/\r?\n/) : experienceText.split(/(?<=[.!?])\s+/))
      .map(line => line.trim().replace(/^[\u2022•▪◦*\-–—\s]+/, ""))
      .filter(line => line.length >= 35 && !metricPattern.test(line) && !/^(experience|work experience|professional experience|education|skills|projects|summary|objective)\b/i.test(line))
      .slice(0, 8);
    const englishIssues = collectEnglishIssues(text);
    return { score: checks.reduce((sum, check) => sum + (check.passed ? check.points : 0), 0), checks, wordCount: words.length, experienceLines, metricLines, englishIssues };
  }
  function collectEnglishIssues(text) {
    const rules = [
      { pattern: /\bresponsible for\b/i, detail: "“Responsible for” describes a duty, not your contribution. Start with the action you took, then add the outcome if you can verify it.", example: "Example: Managed [area] and improved [verified outcome]." },
      { pattern: /\bworked on\b/i, detail: "“Worked on” is vague. Name your specific contribution and the tools or approach you actually used.", example: "Example: Developed [specific feature] using [tool]." },
      { pattern: /\bhelped (?:to )?\b/i, detail: "“Helped” can hide your contribution. State the part you personally completed.", example: "Example: Coordinated [specific task] with [team]." },
      { pattern: /\b(i|we|my|our)\b/i, detail: "Resume bullets are usually clearer without first-person pronouns.", example: "Remove the pronoun and begin with an action verb." },
      { pattern: /\b(various|several|many|multiple|a lot of)\b/i, detail: "This wording is imprecise. Use a specific number or scope only if you can verify it.", example: "Example: Supported [number] users / [team size]." },
      { pattern: /\b(utilize|utilized)\b/i, detail: "“Use” is more direct and natural than “utilize” in most resume writing.", example: "Replace “utilize” with “use” where appropriate." },
      { pattern: /\b(a)\s+(?:engineer|analyst|administrator|architect|operator|expert)\b/i, detail: "The article is incorrect before this vowel sound; use “an” instead of “a”.", example: "Example: “an engineer”." },
      { pattern: /\b(an)\s+(?:developer|designer|manager|product|user|team)\b/i, detail: "The article is incorrect before this consonant sound; use “a” instead of “an”.", example: "Example: “a developer”." },
      { pattern: /\b(teh|recieve|seperate|acheive|managment|experiance|developement)\b/i, detail: "This looks like a common spelling error. Correct the word and proofread the surrounding sentence.", example: "" }
    ];
    const lines = text.split(/\r?\n|(?<=[.!?])\s+/).map(line => line.trim().replace(/^[\u2022•▪◦*\-–—\s]+/, "")).filter(line => line.length >= 18);
    const issues = [];
    for (const line of lines) {
      for (const rule of rules) {
        if (rule.pattern.test(line)) {
          issues.push({ excerpt: line, detail: rule.detail, example: rule.example });
          break;
        }
      }
      if (issues.length >= 8) break;
    }
    return issues;
  }
  const roleKeywords = [
    { match: /full[\s-]?stack|software (?:developer|engineer)|web developer/i, words: ["JavaScript", "TypeScript", "React", "Node.js", "REST API", "Git", "testing", "SQL"] },
    { match: /front[\s-]?end|ui developer/i, words: ["JavaScript", "TypeScript", "React", "HTML", "CSS", "accessibility", "responsive design", "testing"] },
    { match: /back[\s-]?end|api developer/i, words: ["API", "Node.js", "Python", "SQL", "database", "authentication", "testing", "cloud"] },
    { match: /data analyst|business analyst|data scientist/i, words: ["SQL", "Python", "Excel", "Tableau", "Power BI", "statistics", "data visualization", "ETL"] },
    { match: /product manager|product owner/i, words: ["roadmap", "stakeholder", "prioritization", "user research", "OKR", "analytics", "launch", "Agile"] },
    { match: /ux|ui\/ux|product designer/i, words: ["Figma", "user research", "prototyping", "accessibility", "design systems", "usability testing", "wireframes"] },
    { match: /devops|site reliability|platform engineer/i, words: ["AWS", "Azure", "Docker", "Kubernetes", "CI/CD", "Terraform", "monitoring", "Linux"] },
    { match: /project manager|program manager/i, words: ["project planning", "budget", "risk management", "stakeholder", "Agile", "delivery", "reporting"] },
    { match: /marketing|content|seo/i, words: ["SEO", "campaigns", "analytics", "content strategy", "conversion", "social media", "brand"] },
    { match: /sales|account executive|business development/i, words: ["pipeline", "CRM", "prospecting", "negotiation", "quota", "revenue", "customer relationships"] },
    { match: /teacher|educator|instructor/i, words: ["lesson planning", "classroom management", "assessment", "curriculum", "student engagement", "differentiation"] },
    { match: /nurse|healthcare|clinical/i, words: ["patient care", "clinical documentation", "patient safety", "care coordination", "HIPAA", "assessment"] },
    { match: /quality assurance|qa engineer|test engineer|software tester/i, words: ["test automation", "manual testing", "Selenium", "Playwright", "test cases", "CI/CD", "bug tracking"] },
    { match: /cybersecurity|security analyst|information security/i, words: ["SIEM", "incident response", "vulnerability management", "threat analysis", "NIST", "network security"] },
    { match: /mobile developer|ios developer|android developer/i, words: ["Swift", "Kotlin", "React Native", "mobile testing", "REST API", "app release"] },
    { match: /machine learning|artificial intelligence|ai engineer/i, words: ["Python", "machine learning", "PyTorch", "TensorFlow", "model evaluation", "data pipelines"] },
    { match: /human resources|hr manager|recruiter|talent acquisition/i, words: ["recruiting", "employee relations", "HRIS", "onboarding", "talent acquisition", "employment law"] },
    { match: /accountant|accounting|financial analyst/i, words: ["financial reporting", "forecasting", "budgeting", "Excel", "reconciliation", "GAAP"] },
    { match: /customer support|customer success/i, words: ["customer satisfaction", "ticketing", "CRM", "retention", "customer onboarding", "SLA"] },
    { match: /operations manager|operations analyst|supply chain/i, words: ["process improvement", "forecasting", "logistics", "inventory", "KPI", "vendor management"] },
    { match: /lawyer|attorney|legal counsel/i, words: ["legal research", "contract review", "compliance", "case management", "negotiation", "due diligence"] },
    { match: /engineer|developer/i, words: ["technical design", "testing", "documentation", "problem-solving", "collaboration"] }
  ];
  function keywordsForRole(role) {
    return roleKeywords.find(item => item.match.test(role || ""))?.words || [];
  }
  function roleSummaryIdea(role) {
    const title = role.trim() || "professional";
    const profile = roleKeywords.find(item => item.match.test(title));
    const focus = profile ? profile.words.slice(0, 4).join(", ") : "clear communication, problem-solving, and measurable results";
    return `Targeting ${title} opportunities, with a focus on ${focus}. Brings a thoughtful, collaborative approach to solving problems and delivering reliable work. Add your experience level, strongest relevant skills, and a verified achievement to make this summary your own.`;
  }
  const keywordStopWords = new Set("a about across after all also am an and any are as at be been before being between both but by candidate candidates can could day did do does doing for from get got had has have having he her here him his how i if in including into is it its job just must of on or our ours out own per qualified regarding role roles she should skill skills some such team than that the their them then there these they this those through to up was we were what when where which while who why will with work would years you your about responsibilities responsible requirement requirements required seeking opportunity looking ideal apply join".split(" "));
  function extractKeywords(text) {
    return [...new Set((text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}+.#/-]{2,}/gu) || []).map(word => word.replace(/^[./#+-]+|[./#+-]+$/g, "")).filter(word => word.length >= 3 && !keywordStopWords.has(word) && !/^\d+$/.test(word)))].slice(0, 80);
  }
  function renderScanResults(dialog, fileName, text, analysis) {
    const loading = dialog.querySelector(".scan-loading");
    const result = dialog.querySelector(".scan-result");
    loading.classList.add("hidden");
    result.classList.remove("hidden");
    dialog.querySelector("#scan-title").textContent = "Your resume review";
    const missingChecks = analysis.checks.filter(check => !check.passed);
    const concerns = [];
    if (!analysis.checks.find(check => check.id === "email").passed) concerns.push({ title: "Contact details", detail: "No email address was found in the extracted text.", excerpt: "Email not detected", type: "missing" });
    if (!analysis.checks.find(check => check.id === "phone").passed) concerns.push({ title: "Contact details", detail: "No phone number was found. Keep it near your name and email.", excerpt: "Phone number not detected", type: "missing" });
    if (!analysis.checks.find(check => check.id === "headings").passed) concerns.push({ title: "Section headings", detail: "Conventional headings make sections easier for parsers to identify.", excerpt: "No common resume section heading found", type: "missing" });
    if (!analysis.checks.find(check => check.id === "experience").passed) concerns.push({ title: "Experience section", detail: "We couldn't identify a Work Experience heading in the extracted text.", excerpt: "Experience heading not detected", type: "missing" });
    for (const line of analysis.experienceLines) concerns.push({ title: "Add a result to this experience bullet", detail: "It starts with an action verb, but no measurable outcome was detected. Add a real number, scale, time saved or result only if you can verify it.", excerpt: line, type: "improve" });
    if (!analysis.checks.find(check => check.id === "actions").passed) concerns.push({ title: "Make experience bullets more specific", detail: "Start bullets with the action you took, then explain the result. Do not claim work you did not do.", excerpt: "Example structure: Built [what] using [how], resulting in [verified outcome].", type: "improve" });
    if (!analysis.checks.find(check => check.id === "impact").passed && !analysis.experienceLines.length) concerns.push({ title: "Show measurable impact", detail: "Where you have evidence, add the scale or result of your work. Never invent figures.", excerpt: "Example structure: Improved [process/result] by [verified amount] for [scope].", type: "improve" });
    for (const check of missingChecks.filter(item => !["email", "phone", "headings", "experience", "actions", "impact"].includes(item.id))) concerns.push({ title: check.label, detail: check.advice, excerpt: check.advice, type: "improve" });
    for (const issue of analysis.englishIssues) concerns.push({ title: "English and wording", detail: issue.detail, excerpt: issue.excerpt, example: issue.example, type: "improve" });
    const highlighted = renderHighlightedText(text, concerns);
    result.innerHTML = `<div class="scan-score-panel"><div class="scan-score-ring" style="--score:${analysis.score}%"><span>${analysis.score}</span><small>/100</small></div><div class="scan-score-copy"><div class="eyebrow">Transparent checklist estimate</div><h3>${analysis.score >= 75 ? "Good baseline coverage" : analysis.score >= 50 ? "A few things to improve" : "Several basics need attention"}</h3><p>${analysis.wordCount.toLocaleString()} words extracted · ${analysis.checks.filter(check => check.passed).length} of ${analysis.checks.length} checks passed</p></div></div><p class="scan-disclaimer"><strong>What this score means:</strong> a fixed, visible checklist—not a score from a specific employer's ATS. ATS products and job criteria differ, and text extraction cannot verify visual layout, columns, tables, or parsing in a real system. English notes flag common wording patterns; they are not a full grammar proofread.</p><details class="scan-score-breakdown"><summary>See exactly how this score was calculated</summary><div>${analysis.checks.map(check => `<div class="score-breakdown-row ${check.passed ? "passed" : "not-passed"}"><span>${check.passed ? "✓" : "○"}</span><strong>${escapeHtml(check.label)}</strong><small>${check.passed ? check.points : 0} / ${check.points} pts</small></div>`).join("")}<p>Earned points divided by a 100-point checklist. This is not calibrated against any employer ATS.</p></div></details><div class="scan-two-column"><section class="scan-resume-column"><div class="scan-section-heading"><h3>Resume text</h3><span>Highlighted items may need a second look</span></div><div class="scan-document">${highlighted}</div><div class="highlight-legend"><span><i class="legend-missing"></i>Missing items listed below</span><span><i class="legend-improve"></i>Consider improving</span></div></section><section class="scan-feedback-column"><div class="scan-section-heading"><h3>Suggestions</h3><span>${concerns.length} review ${concerns.length === 1 ? "item" : "items"}</span></div><div class="scan-suggestion-list">${concerns.length ? concerns.map((item, index) => `<article class="scan-suggestion ${item.type}"><div class="suggestion-number">${index + 1}</div><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p>${item.excerpt ? `<blockquote>${escapeHtml(item.excerpt)}</blockquote>` : ""}${item.example ? `<small class="suggestion-example">${escapeHtml(item.example)}</small>` : ""}</div></article>`).join("") : `<div class="scan-all-clear"><span>✓</span><strong>No checklist issues detected</strong><p>Still review the highlighted text and tailor your resume to each role.</p></div>`}</div><button class="suggestion-copy-button" type="button">Copy bullet-point framework</button><p class="suggestion-copy-note">Copies a fill-in template only; it will not invent achievements.</p></section></div><section class="scan-keyword-section"><label for="target-role"><strong>Tailor this review to your target role <span>(optional)</span></strong><small>We compare common role terms against your resume. Treat them as prompts, not required skills.</small></label><input id="target-role" placeholder="e.g. Full Stack Developer"><label for="job-description" class="job-description-label"><strong>Compare to a job description <span>(optional)</span></strong><small>Exact word overlap only; processed in this browser.</small></label><textarea id="job-description" placeholder="Paste the job description here…"></textarea><div id="keyword-match-result" class="keyword-match-result"><span>Add a target role or job description to see relevant terms.</span></div></section><footer class="scan-dialog-footer"><span>Your resume file and extracted text are not saved or sent to our servers.</span><button type="button" class="secondary-button scan-done">Done</button></footer>`;
    dialog.querySelector(".scan-done").addEventListener("click", () => dialog.closeReview());
    dialog.querySelector(".suggestion-copy-button").addEventListener("click", async event => {
      try {
        await navigator.clipboard.writeText(" [Action verb] [what you did] using [tool or approach], resulting in [verified outcome or scale]. Only include details you can substantiate.");
        event.currentTarget.textContent = "Framework copied";
      } catch {
        toast("Clipboard access was denied. Copy the framework from a suggestion card instead.", true);
      }
    });
    const jobDescription = dialog.querySelector("#job-description");
    const targetRole = dialog.querySelector("#target-role");
    const updateKeywords = () => renderKeywordMatch(dialog.querySelector("#keyword-match-result"), text, jobDescription.value, targetRole.value);
    jobDescription.addEventListener("input", updateKeywords);
    targetRole.addEventListener("input", updateKeywords);
    dialog.querySelector("#scan-title").focus({ preventScroll: true });
  }
  function renderHighlightedText(text, concerns) {
    const flagged = new Map();
    for (const concern of concerns) {
      if (concern.type === "missing" || !concern.excerpt || concern.excerpt.startsWith("Example structure:")) continue;
      flagged.set(concern.excerpt.trim().toLowerCase(), concern.type);
    }
    return text.split(/(\r?\n+)/).map(part => {
      if (/^\r?\n+$/.test(part)) return part;
      const type = flagged.get(part.trim().replace(/^[\u2022•▪◦*\-–—\s]+/, "").toLowerCase());
      return type ? `<mark class="resume-highlight ${type}">${escapeHtml(part)}</mark>` : escapeHtml(part);
    }).join("") || "No text could be displayed.";
  }
  function renderKeywordMatch(container, resumeText, jobDescription, role = "") {
    const useJobDescription = jobDescription.trim().length >= 30;
    const roleTerms = keywordsForRole(role);
    if (!useJobDescription && !role.trim()) {
      container.innerHTML = "<span>Add a target role or job description to see relevant terms.</span>";
      return;
    }
    const resumeWords = new Set(extractKeywords(resumeText));
    const jobWords = useJobDescription ? extractKeywords(jobDescription) : roleTerms;
    if (!jobWords.length) {
      container.innerHTML = "<span>No role-specific keyword set is available. Paste the job responsibilities or requirements instead.</span>";
      return;
    }
    const matches = jobWords.filter(word => resumeWords.has(word));
    const missing = jobWords.filter(word => !resumeWords.has(word));
    const percent = Math.round(matches.length / jobWords.length * 100);
    container.innerHTML = `<div class="keyword-score"><strong>${percent}%</strong><span>${useJobDescription ? "literal job-description keyword overlap" : `common ${escapeHtml(role)} role terms found`} <small>(${matches.length}/${jobWords.length})</small></span></div><p class="keyword-caution">${useJobDescription ? "Exact word overlap only; synonyms, importance, and your actual qualifications are not evaluated." : "These are common role terms, not a job-specific ATS rule."} Add a missing term only if it accurately describes your experience.</p><div class="keyword-groups">${matches.length ? `<div><strong>Found in resume</strong><div class="keyword-chips">${matches.slice(0, 24).map(word => `<span class="keyword-chip found">${escapeHtml(word)}</span>`).join("")}</div></div>` : ""}${missing.length ? `<div><strong>${useJobDescription ? "Not found" : "Consider if relevant"} <small>— only add if true</small></strong><div class="keyword-chips">${missing.slice(0, 24).map(word => `<span class="keyword-chip missing">${escapeHtml(word)}</span>`).join("")}</div></div>` : ""}</div>`;
  }
  function field(label, key, value, placeholder = "", type = "text", full = false) {
    return `<div class="field${full ? " full" : ""}"><label for="field-${escapeHtml(key)}">${label}</label><input id="field-${escapeHtml(key)}" data-key="${escapeHtml(key)}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"></div>`;
  }
  function textarea(label, key, value, placeholder, full = true) {
    return `<div class="field${full ? " full" : ""}"><label for="field-${escapeHtml(key)}">${label}</label><textarea id="field-${escapeHtml(key)}" data-key="${escapeHtml(key)}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea></div>`;
  }
  function entryMarkup(kind, entry, index) {
    const prefix = `${kind}.${index}`;
    const title = kind === "experience" ? "Position" : kind === "education" ? "Education" : "Project / certification";
    let fields = "";
    if (kind === "experience") fields = `<div class="form-grid">${field("Job title", `${prefix}.title`, entry.title, "e.g. Product designer")}${field("Company", `${prefix}.company`, entry.company, "Company name")}${field("Start date", `${prefix}.start`, entry.start, "e.g. Jan 2022")}${field("End date", `${prefix}.end`, entry.end, "e.g. Present")}${textarea("Impact & responsibilities", `${prefix}.bullets`, entry.bullets, "Write each accomplishment on a new line. Start with an action verb.", true)}</div>`;
    if (kind === "education") fields = `<div class="form-grid">${field("Degree / qualification", `${prefix}.degree`, entry.degree, "e.g. B.A. Computer Science")}${field("School / institution", `${prefix}.school`, entry.school, "Institution name")}${field("Passing year", `${prefix}.year`, entry.year, "e.g. 2024")}${field("Marks / CGPA", `${prefix}.grade`, entry.grade, "e.g. 8.7 CGPA")}</div>`;
    if (kind === "projects") fields = `<div class="form-grid">${field("Name", `${prefix}.name`, entry.name, "Project or certification")}${field("Link / issuer", `${prefix}.link`, entry.link, "URL or issuing organization")}${textarea("Description", `${prefix}.description`, entry.description, "What did you build, learn, or accomplish?", true)}</div>`;
    return `<div class="entry-block"><div class="entry-heading"><span>${title} ${index + 1}</span><button type="button" class="remove-entry" data-remove="${kind}.${index}">Remove</button></div>${fields}</div>`;
  }
  function renderSectionCard(section) {
    const resume = activeResume();
    const isCollapsed = collapsed.has(section.id);
    let content = "";
    if (section.id === "summary") content = `<div class="form-grid">${textarea("Your summary", "summary", resume.summary, "A few sentences about your experience, strengths, and the value you bring.", true)}</div><div class="suggestion-box"><span>✦</span><p>Start with a draft based on your target role. Review it and add only true details.</p><button type="button" data-suggest="summary">Draft summary</button><button type="button" data-ai-summary>Generate with AI</button></div>`;
    if (section.id === "experience") content = `${resume.experience.map((entry, index) => entryMarkup("experience", entry, index)).join("")}<button type="button" class="add-entry" data-add="experience">＋ Add experience</button>`;
    if (section.id === "education") content = `${resume.education.map((entry, index) => entryMarkup("education", entry, index)).join("")}<button type="button" class="add-entry" data-add="education">＋ Add education</button>`;
    if (section.id === "skills") content = `<div class="field"><label for="skills-input">Add a skill, then press Enter</label><div class="skills-input-wrap">${resume.skills.map((skill, index) => `<span class="skill-chip">${escapeHtml(skill)} <button aria-label="Remove ${escapeHtml(skill)}" type="button" data-remove-skill="${index}" style="border:0;background:none;color:inherit;padding:0 0 0 4px">×</button></span>`).join("")}<input id="skills-input" data-skill-input placeholder="e.g. Project management"></div><small>Skills appear as bullet points on your resume.</small></div>`;
    if (section.id === "projects") content = `${resume.projects.map((entry, index) => entryMarkup("projects", entry, index)).join("")}<button type="button" class="add-entry" data-add="projects">＋ Add project or certification</button>`;
    return `<article class="form-card${isCollapsed ? " collapsed" : ""}" data-section-card="${section.id}"><div class="form-card-head" data-toggle="${section.id}"><div class="form-card-icon">${section.icon}</div><div class="form-card-title"><strong>${section.label}</strong><span>${section.hint}</span></div><span class="card-chevron">⌄</span></div><div class="form-card-content">${content}<div class="section-order"><label>Section order</label><button class="order-button" type="button" data-move="${section.id}" data-direction="-1" aria-label="Move ${section.label} up" ${order.indexOf(section.id) === 0 ? "disabled" : ""}>↑</button><button class="order-button" type="button" data-move="${section.id}" data-direction="1" aria-label="Move ${section.label} down" ${order.indexOf(section.id) === order.length - 1 ? "disabled" : ""}>↓</button></div></div></article>`;
  }
  function renderBuilder() {
    const view = document.getElementById("builder-view");
    const resume = activeResume();
    if (!resume) { view.innerHTML = `<div class="empty-state"><h3>No resume selected</h3><button class="primary-button" data-action="create">Create a resume</button></div>`; return; }
    const filled = [resume.contact.name, resume.contact.email, resume.summary, ...resume.experience.map(entry => entry.title || entry.company), ...resume.education.map(entry => entry.degree || entry.school), ...resume.skills].filter(Boolean).length;
    const progress = Math.min(100, Math.round(filled / 8 * 100));
    view.innerHTML = `<div class="builder-toolbar"><div class="builder-title"><button class="back-button" data-action="back" aria-label="Back to resumes">←</button><div><h1>${escapeHtml(resume.name || "Untitled resume")}</h1><p>Changes save automatically on this device</p></div></div><div class="builder-actions"><button class="secondary-button" data-action="share">↗ Share</button><button class="primary-button" data-action="pdf">↓ Download PDF</button></div></div>
      <div class="builder-layout"><div class="editor-column"><div class="editor-intro"><h2>Let's build your resume</h2><p>Start with your details, then make it yours.</p><div class="editor-progress"><div class="progress-track"><span style="width:${progress}%"></span></div><span>${progress}% complete</span></div></div>
      <article class="form-card"><div class="form-card-head" data-toggle="contact"><div class="form-card-icon">♙</div><div class="form-card-title"><strong>Contact information</strong><span>Details to include on your applications</span></div><span class="card-chevron">⌄</span></div><div class="form-card-content"><div class="form-grid">${field("Full name", "contact.name", resume.contact.name, "e.g. Alex Morgan")}${field("Target role", "contact.role", resume.contact.role, "e.g. Full Stack Developer")}${field("Email address", "contact.email", resume.contact.email, "you@example.com", "email")}${field("Phone number", "contact.phone", resume.contact.phone, "+1 555 010 1234", "tel")}${field("Location", "contact.location", resume.contact.location, "City, Country")}${field("LinkedIn profile", "contact.linkedin", resume.contact.linkedin, "linkedin.com/in/you")}${field("Portfolio / website", "contact.portfolio", resume.contact.portfolio, "yourportfolio.com")}<div class="field full photo-field"><label for="contact-photo">Profile photo <span>(optional; select a portrait template)</span></label><input id="contact-photo" class="photo-input" type="file" accept="image/jpeg,image/png,image/webp"><div class="photo-preview">${resume.contact.photo ? `<img src="${resume.contact.photo}" alt="Profile photo preview"><button type="button" data-action="remove-photo">Remove photo</button>` : `<span>No photo selected</span>`}</div></div></div></div></article>
      ${order.map(id => renderSectionCard(sections.find(section => section.id === id))).join("")}</div>
      <aside class="preview-column"><div class="preview-top"><strong>Live preview</strong><div class="preview-controls"><span class="zoom-label">Template</span><select class="template-select" aria-label="Choose resume template">${templates.map(item => `<option value="${item.id}" ${resume.template === item.id ? "selected" : ""}>${item.name}</option>`).join("")}</select></div></div><div class="preview-frame"><div id="resume-preview"></div></div><div class="ats-card"><div id="score-ring" class="score-ring"><span>0</span></div><div class="ats-copy"><strong>ATS readiness</strong><p id="ats-label">Add details to see your score</p></div><button data-action="ats">View tips →</button></div><div id="ats-details" class="ats-details"></div></aside></div>`;
    renderPreview();
    bindBuilderEvents(view);
  }
  function renderPreview() {
    const resume = activeResume();
    const preview = document.getElementById("resume-preview");
    if (!resume || !preview) return;
    preview.className = `resume-template-${resume.template}`;
    const contact = resume.contact;
    const contactLinks = [
      contact.email ? `<span>${escapeHtml(contact.email)}</span>` : "",
      contact.phone ? `<span>${escapeHtml(contact.phone)}</span>` : "",
      contact.location ? `<span>${escapeHtml(contact.location)}</span>` : "",
      contact.linkedin ? `<span>${escapeHtml(contact.linkedin.replace(/^https?:\/\//i, ""))}</span>` : "",
      contact.portfolio ? `<span>${escapeHtml(contact.portfolio.replace(/^https?:\/\//i, ""))}</span>` : ""
    ].filter(Boolean).join("");
    const sectionHtml = order.map(id => {
      if (id === "summary" && resume.summary.trim()) return `<section class="resume-section"><h3 class="resume-section-title">Professional Summary</h3><div class="resume-summary">${escapeHtml(resume.summary).replace(/\n/g, "<br>")}</div></section>`;
      if (id === "experience" && resume.experience.some(item => item.title || item.company)) return `<section class="resume-section"><h3 class="resume-section-title">Experience</h3>${resume.experience.filter(item => item.title || item.company).map(item => `<div class="resume-item"><div class="resume-item-heading"><span>${escapeHtml(item.title)}</span><span>${escapeHtml([item.start, item.end].filter(Boolean).join(" – "))}</span></div><div class="resume-item-sub">${escapeHtml(item.company)}</div>${item.bullets ? `<ul>${escapeHtml(item.bullets).split("\n").filter(line => line.trim()).map(line => `<li>${line.replace(/^[•\-]\s*/, "")}</li>`).join("")}</ul>` : ""}</div>`).join("")}</section>`;
      if (id === "education" && resume.education.some(item => item.degree || item.school)) return `<section class="resume-section"><h3 class="resume-section-title">Education</h3>${resume.education.filter(item => item.degree || item.school).map(item => `<div class="resume-item"><div class="resume-item-heading"><span>${escapeHtml(item.degree)}</span><span>${escapeHtml(item.year)}</span></div><div class="resume-item-sub">${escapeHtml([item.school, item.grade].filter(Boolean).join(" · "))}</div></div>`).join("")}</section>`;
      if (id === "skills" && resume.skills.length) return `<section class="resume-section"><h3 class="resume-section-title">Skills</h3><ul class="resume-skills">${resume.skills.map(skill => `<li>${escapeHtml(skill)}</li>`).join("")}</ul></section>`;
      if (id === "projects" && resume.projects.some(item => item.name || item.description)) return `<section class="resume-section"><h3 class="resume-section-title">Projects & Certifications</h3>${resume.projects.filter(item => item.name || item.description).map(item => `<div class="resume-item"><div class="resume-item-heading"><span>${escapeHtml(item.name)}</span></div><div class="resume-item-sub">${escapeHtml(item.link)}</div>${item.description ? `<div>${escapeHtml(item.description)}</div>` : ""}</div>`).join("")}</section>`;
      return "";
    }).join("");
    const template = templates.find(item => item.id === resume.template);
    const photo = template?.photo && contact.photo ? `<img class="resume-photo" src="${contact.photo}" alt="">` : "";
    preview.innerHTML = `<article class="resume-paper"><header class="resume-header">${photo}<div class="resume-header-copy"><h2>${escapeHtml(contact.name || "Your name")}</h2>${contact.role ? `<div class="resume-role">${escapeHtml(contact.role)}</div>` : ""}<div class="resume-contact">${contactLinks || "<span>Email · Phone · Location</span>"}</div></div></header>${sectionHtml || `<div class="resume-section"><h3 class="resume-section-title">Your story starts here</h3><div class="resume-summary">Add your details in the form to see your resume take shape.</div></div>`}</article>`;
    updateAts();
  }
  function updateAts() {
    const resume = activeResume();
    const score = calculateAts(resume);
    const ring = document.getElementById("score-ring");
    if (!ring) return;
    ring.style.setProperty("--score-angle", `${score * 3.6}deg`);
    ring.querySelector("span").textContent = String(score);
    document.getElementById("ats-label").textContent = score >= 75 ? "Strong foundation — keep it tailored" : score >= 40 ? "Good start — a few details can help" : "Add details to improve your score";
    const role = resume.contact.role.trim();
    const terms = keywordsForRole(role);
    const content = [resume.summary, ...resume.experience.map(item => item.bullets), ...resume.skills].join(" ").toLowerCase();
    const missingTerms = terms.filter(term => !content.includes(term.toLowerCase()));
    const englishIssues = collectEnglishIssues(resume.experience.map(item => item.bullets).join("\n"));
    const checks = [
      ["Contact details are easy to find", Boolean(resume.contact.name && resume.contact.email)],
      ["Professional summary is included", Boolean(resume.summary.trim())],
      ["Work experience has clear details", resume.experience.some(item => item.title && item.company)],
      ["Education section is filled in", resume.education.some(item => item.degree && item.school)],
      ["Skills are listed as bullet points", resume.skills.length >= 3],
      ["Uses a simple, ATS-friendly template", ["classic", "minimal", "compact", "professional", "technical", "academic", "corporate", "finance", "healthcare", "consultant"].includes(resume.template)],
      ["Target role is defined", Boolean(role)],
      ["Resume content includes role-related terms", !terms.length || missingTerms.length < terms.length]
    ];
    const details = checks.map(([label, passed]) => `<div class="ats-check ${passed ? "ok" : "missing"}">${label}${passed ? "" : " — review this"}</div>`).join("");
    const roleAdvice = missingTerms.length ? `<div class="ats-advice"><strong>Possible ${escapeHtml(role)} terms to review</strong><span>${missingTerms.slice(0, 8).map(escapeHtml).join(" · ")}. Add only skills you genuinely have.</span></div>` : "";
    const englishAdvice = englishIssues.length ? `<div class="ats-advice"><strong>Writing clarity</strong>${englishIssues.slice(0, 4).map(issue => `<span>${escapeHtml(issue.excerpt)} — ${escapeHtml(issue.detail)}</span>`).join("")}</div>` : "";
    document.getElementById("ats-details").innerHTML = `<h3>Specific ATS improvements</h3>${details}${roleAdvice}${englishAdvice}<p class="ats-disclaimer">A local checklist estimate, not a hiring guarantee or a live employer ATS score.</p>`;
  }
  function calculateAts(resume) {
    if (!resume) return 0;
    const terms = keywordsForRole(resume.contact.role);
    const content = [resume.summary, ...resume.experience.map(item => item.bullets), ...resume.skills].join(" ").toLowerCase();
    const checks = [
      Boolean(resume.contact.name), Boolean(resume.contact.email), Boolean(resume.contact.phone),
      Boolean(resume.summary.trim()), resume.experience.some(item => item.title && item.company),
      resume.experience.some(item => item.bullets.trim()), resume.education.some(item => item.degree && item.school),
      resume.skills.length >= 3, ["classic", "minimal", "compact", "professional", "technical", "academic", "corporate", "finance", "healthcare", "consultant"].includes(resume.template),
      Boolean(resume.contact.location), Boolean(resume.contact.role),
      !terms.length || terms.some(term => content.includes(term.toLowerCase()))
    ];
    return Math.round(checks.filter(Boolean).length / checks.length * 100);
  }
  async function compressPhoto(file) {
    if (!file.type.startsWith("image/") || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG, or WebP image.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Choose a photo smaller than 8 MB.");
    const source = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = source;
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("This image could not be opened."));
      });
      const scale = Math.min(1, 480 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser could not prepare this photo.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.82);
    } finally {
      URL.revokeObjectURL(source);
    }
  }
  function resumeAiContext(resume) {
    if (!resume) return "";
    return JSON.stringify({
      targetRole: resume.contact.role,
      summary: resume.summary,
      skills: resume.skills,
      experience: resume.experience,
      education: resume.education,
      projects: resume.projects
    });
  }
  async function requestAi(messages) {
    let response;
    try {
      response = await fetch(GURUAGENT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages })
      });
    } catch (error) {
      if (error instanceof TypeError) throw new Error("Could not reach the AI service. Check your internet connection and try again.");
      throw error;
    }
    const bodyText = await response.text();
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      throw new Error(`The AI service returned an unreadable response (${response.status}).`);
    }
    if (!response.ok) {
      const message = body?.error || (response.status === 404
        ? "The AI service endpoint was not found. Check the service deployment."
        : `The AI service returned HTTP ${response.status}.`);
      throw new Error(message);
    }
    const answer = body?.reply;
    if (typeof answer !== "string" || !answer.trim()) throw new Error("The AI service returned an empty response. Please try again.");
    return answer.trim();
  }
  async function generateAiSummary(resume) {
    const context = resumeAiContext(resume);
    const summary = await requestAi([
      { role: "system", content: "Write a concise, natural English professional summary for the stated target role. Use only facts in the supplied resume context; never invent employers, skills, credentials, metrics, or achievements. If details are missing, phrase the summary conservatively. Return only the summary." },
      { role: "user", content: `Resume context: ${context}` }
    ]);
    resume.summary = summary;
    persist();
    renderBuilder();
    toast("AI summary drafted. Please review every detail before using it.");
  }
  function bindBuilderEvents(view) {
    view.oninput = event => {
      const target = event.target;
      const resume = activeResume();
      if (!resume) return;
      if (target.dataset.key) {
        setValue(resume, target.dataset.key, target.value);
        resume.updatedAt = Date.now();
        if (target.dataset.key === "contact.name" && (!resume.name || resume.name === "Untitled resume")) {
          resume.name = target.value.trim() ? `${target.value.trim()}'s resume` : "Untitled resume";
          document.querySelector(".builder-title h1").textContent = resume.name;
        }
        persist(); renderPreview(); updateProgress();
      }
    };
    view.onchange = async event => {
      const photoInput = event.target.closest(".photo-input");
      if (photoInput?.files?.[0]) {
        try {
          activeResume().contact.photo = await compressPhoto(photoInput.files[0]);
          persist();
          renderBuilder();
          toast("Photo added. Choose a portrait template to show it.");
        } catch (error) {
          console.error("Could not load profile photo:", error);
          toast(error instanceof Error ? error.message : "Could not load this photo.", true);
        }
        return;
      }
      const select = event.target.closest(".template-select");
      if (select) { activeResume().template = select.value; persist(); renderPreview(); }
    };
    view.onkeydown = event => {
      if (event.target.matches("[data-skill-input]") && event.key === "Enter") {
        event.preventDefault();
        const skill = event.target.value.trim();
        if (skill && !activeResume().skills.some(item => item.toLowerCase() === skill.toLowerCase())) {
          activeResume().skills.push(skill); persist(); renderBuilder();
          document.getElementById("skills-input")?.focus();
        }
      }
    };
    view.onclick = async event => {
      const toggle = event.target.closest("[data-toggle]");
      if (toggle) { const id = toggle.dataset.toggle; collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id); renderBuilder(); return; }
      const action = event.target.closest("[data-action]");
      if (action) {
        if (action.dataset.action === "back") setView("dashboard");
        if (action.dataset.action === "pdf") downloadResumePdf(activeResumeId);
        if (action.dataset.action === "share") shareResume();
        if (action.dataset.action === "ats") document.getElementById("ats-details").classList.toggle("open");
        if (action.dataset.action === "remove-photo") { activeResume().contact.photo = ""; persist(); renderBuilder(); }
        return;
      }
      const add = event.target.closest("[data-add]");
      if (add) {
        const kind = add.dataset.add;
        const defaults = { experience: { title: "", company: "", start: "", end: "", bullets: "" }, education: { degree: "", school: "", year: "", grade: "" }, projects: { name: "", link: "", description: "" } };
        activeResume()[kind].push(defaults[kind]); persist(); renderBuilder(); return;
      }
      const remove = event.target.closest("[data-remove]");
      if (remove) {
        const [kind, index] = remove.dataset.remove.split(".");
        activeResume()[kind].splice(Number(index), 1); persist(); renderBuilder(); return;
      }
      const removeSkill = event.target.closest("[data-remove-skill]");
      if (removeSkill) { activeResume().skills.splice(Number(removeSkill.dataset.removeSkill), 1); persist(); renderBuilder(); return; }
      const move = event.target.closest("[data-move]");
      if (move) {
        const index = order.indexOf(move.dataset.move), destination = index + Number(move.dataset.direction);
        if (destination >= 0 && destination < order.length) {
          [order[index], order[destination]] = [order[destination], order[index]];
          try { localStorage.setItem(ORDER_KEY, JSON.stringify(order)); } catch { toast("Could not save section order.", true); }
          renderBuilder();
        }
        return;
      }
      const suggest = event.target.closest("[data-suggest]");
      if (suggest) {
        const role = activeResume().contact.role || "professional";
        const suggestion = roleSummaryIdea(role);
        activeResume().summary = suggestion;
        persist(); renderBuilder(); toast("Summary idea added — personalize it with your own achievements.");
      }
      if (event.target.closest("[data-ai-summary]")) {
        const button = event.target.closest("[data-ai-summary]");
        button.disabled = true;
        try {
          await generateAiSummary(activeResume());
        } catch (error) {
          console.error("Could not generate AI summary:", error);
          toast(error instanceof Error ? error.message : "Could not generate the summary.", true);
          button.disabled = false;
        }
      }
    };
  }
  function setValue(object, path, value) {
    const parts = path.split(".");
    let target = object;
    for (const part of parts.slice(0, -1)) target = /^\d+$/.test(part) ? target[Number(part)] : target[part];
    target[parts[parts.length - 1]] = value;
  }
  function updateProgress() {
    const resume = activeResume();
    const filled = [resume.contact.name, resume.contact.email, resume.summary, ...resume.experience.map(entry => entry.title || entry.company), ...resume.education.map(entry => entry.degree || entry.school), ...resume.skills].filter(Boolean).length;
    const progress = Math.min(100, Math.round(filled / 8 * 100));
    const bar = document.querySelector(".progress-track span");
    const label = document.querySelector(".editor-progress span:last-child");
    if (bar) bar.style.width = `${progress}%`;
    if (label) label.textContent = `${progress}% complete`;
  }
  async function shareResume() {
    const resume = activeResume();
    try {
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(resume))));
      const url = `${location.origin}${location.pathname}#resume=${encoded}`;
      await navigator.clipboard.writeText(url);
      toast("Share link copied. Anyone with it can view this resume.");
    } catch {
      toast("Could not copy the share link. Check browser clipboard permissions.", true);
    }
  }
  function importSharedResume() {
    const match = location.hash.match(/^#resume=([A-Za-z0-9+/=_-]+)$/);
    if (!match) return false;
    try {
      const data = normalizeResume(JSON.parse(decodeURIComponent(escape(atob(match[1])))));
      const resume = { ...data, id: makeId(), name: `${data.contact.name || "Shared"}'s shared resume` };
      resumes.unshift(resume);
      persist();
      history.replaceState(null, "", location.pathname);
      openBuilder(resume);
      toast("Shared resume opened and saved to your device.");
      return true;
    } catch {
      history.replaceState(null, "", location.pathname);
      toast("This share link is invalid or incomplete.", true);
      return false;
    }
  }
  function renderTemplates() {
    const view = document.getElementById("templates-view");
    const current = activeResume()?.template;
    view.innerHTML = `<div class="page-heading"><div><div class="eyebrow">Find your format · ${templates.length} designs</div><h1>Templates that fit your story.</h1><p>Choose an ATS-friendly, industry-focused, creative, or photo-enabled layout.</p></div>${activeResume() ? `<button class="primary-button" data-action="back-builder">Back to builder</button>` : ""}</div><div class="template-grid">${templates.map(item => `<article class="template-card${current === item.id ? " selected" : ""}"><div class="template-preview"><div class="template-sheet ${item.id}">${item.photo ? `<span class="template-photo-dot"></span>` : ""}<div class="mini-heading"></div><div class="mini-line narrow"></div><div class="mini-rule"></div><div class="mini-line"></div><div class="mini-line wide"></div><div class="mini-line narrow"></div><div class="mini-rule"></div><div class="mini-line wide"></div><div class="mini-line"></div><div class="mini-line narrow"></div><div class="mini-rule"></div><div class="mini-line"></div><div class="mini-line wide"></div></div></div><div class="template-info"><span class="template-category">${escapeHtml(item.category)}${item.photo ? " · Photo" : ""}</span><h3>${escapeHtml(item.name)}${["classic", "minimal", "compact", "professional", "technical", "academic", "corporate", "finance", "healthcare", "consultant"].includes(item.id) ? " · ATS-friendly" : ""}</h3><p>${escapeHtml(item.detail)}</p><button class="${current === item.id ? "primary-button" : "secondary-button"}" data-template-choice="${item.id}">${current === item.id ? "Selected" : "Use this template"}</button></div></article>`).join("")}</div><div class="template-tip"><strong>ATS note:</strong> A single-column layout is usually easiest for automated parsers. Photo layouts are optional and may not suit every country, role, or application system.</div>`;
    view.onclick = event => {
      const choice = event.target.closest("[data-template-choice]");
      if (choice) {
        if (!activeResume()) { createResume(); activeResume().template = choice.dataset.templateChoice; persist(); renderBuilder(); }
        else { activeResume().template = choice.dataset.templateChoice; persist(); renderTemplates(); toast(`${templates.find(item => item.id === choice.dataset.templateChoice).name} template selected.`); }
      }
      if (event.target.closest('[data-action="back-builder"]')) setView("builder");
    };
  }
  function renderAiMessages(container) {
    container.innerHTML = aiMessages.length
      ? aiMessages.map(item => `<article class="ai-message ${item.role}"><strong>${item.role === "user" ? "You" : "Pauser AI"}</strong><p>${escapeHtml(item.content)}</p></article>`).join("")
      : `<div class="ai-empty"><span class="pauser-icon" aria-hidden="true">||</span><strong>What would you like help with?</strong><p>Ask for resume feedback, a summary draft, skill ideas, or clearer bullet points.</p></div>`;
    container.scrollTop = container.scrollHeight;
  }
  function renderAiAssistant() {
    const view = document.getElementById("ai-view");
    view.innerHTML = `
          <div class="page-heading"><div><div class="eyebrow">AI resume assistant</div><h1>Ask, improve, and tailor.</h1><p>Get help refining your resume and preparing for applications.</p></div></div>
          <div class="ai-layout">
            <section class="ai-chat-card">
              <header class="ai-card-heading"><div><strong>Pauser AI</strong><span>Application writing assistant</span></div><span class="ai-connection">Checking AI service…</span></header>
              <div class="ai-privacy-note">Messages are sent to an external AI service. Resume details are shared only when you turn on the optional resume context.</div>
              <div class="ai-messages" aria-live="polite"></div>
              <div class="ai-chat-status" aria-live="polite"></div>
              <label class="ai-context-toggle"><input type="checkbox" id="ai-include-resume" ${activeResume() ? "" : "disabled"}><span>Include my current resume details in this conversation${activeResume() ? ` (${escapeHtml(activeResume().contact.role || activeResume().name)})` : " — open a resume first"}</span></label>
              <div class="ai-quick-prompts"><button type="button" data-ai-prompt="Review my resume and tell me the three most important improvements.">Review my resume</button><button type="button" data-ai-prompt="Help me rewrite my most recent experience bullet using clear action and impact, without inventing facts.">Improve a bullet</button><button type="button" data-ai-prompt="Suggest relevant skills for the role I am targeting, and mark which details I need to verify.">Suggest skills</button></div>
              <form class="ai-chat-form"><textarea name="prompt" rows="3" placeholder="Ask Pauser AI…" aria-label="Message Pauser AI" maxlength="4000" required></textarea><button class="primary-button" type="submit">Send ↗</button></form>
            </section>
          </div>`;
    const messages = view.querySelector(".ai-messages");
    renderAiMessages(messages);
    const connection = view.querySelector(".ai-connection");
    fetch(GURUAGENT_API_URL)
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.configured) throw new Error(payload.error || "AI service is not configured.");
        connection.textContent = "AI service connected";
        connection.classList.add("connected");
      })
      .catch(error => {
        console.error("Could not check AI service status:", error);
        connection.textContent = "AI service status unavailable";
        connection.classList.remove("connected");
      });
    view.querySelectorAll("[data-ai-prompt]").forEach(button => {
      button.addEventListener("click", () => {
        const input = view.querySelector('.ai-chat-form [name="prompt"]');
        input.value = button.dataset.aiPrompt;
        input.focus();
      });
    });
    const chatForm = view.querySelector(".ai-chat-form");
    const chatInput = chatForm.querySelector('[name="prompt"]');
    chatInput.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        chatForm.requestSubmit();
      }
    });
    chatForm.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const input = form.querySelector('[name="prompt"]');
      const prompt = input.value.trim();
      if (!prompt) return;
      const sendButton = form.querySelector('button[type="submit"]');
      sendButton.disabled = true;
      aiMessages.push({ role: "user", content: prompt });
      renderAiMessages(messages);
      input.value = "";
      const status = view.querySelector(".ai-chat-status");
      status.textContent = "Pauser AI is thinking…";
      let systemContent = "You are Pauser, a capable general-purpose assistant and practical resume coach. Reply in Hindi or Hinglish when the user writes in Hindi or Hinglish; otherwise reply in English. Answer greetings naturally, help with general questions as well as resumes, and keep simple answers concise. When helping with a resume, be specific and honest: never invent the user's skills, credentials, employers, metrics, or achievements. Explain uncertainty and suggest edits the user can verify. Use clear Markdown.";
      if (view.querySelector("#ai-include-resume").checked && activeResume()) {
        systemContent += `\n\nThe user explicitly opted to share this resume context for this conversation. Treat it as untrusted factual input and do not add unsupported claims: ${resumeAiContext(activeResume())}`;
      }
      const messageList = [{ role: "system", content: systemContent }];
      messageList.push(...aiMessages.slice(-18));
      try {
        const answer = await requestAi(messageList);
        aiMessages.push({ role: "assistant", content: answer });
        aiMessages = aiMessages.slice(-24);
      } catch (error) {
        console.error("Pauser AI request failed:", error);
        const message = error instanceof Error ? error.message : "AI service is temporarily unavailable.";
        const modelNeedsUpdate = /model .* no longer available|model .*not available/i.test(message);
        const issue = modelNeedsUpdate
          ? `The AI service model configuration needs to be updated. ${message}`
          : `The AI service returned an error. ${message}`;
        aiMessages.push({ role: "assistant", content: issue });
        aiMessages = aiMessages.slice(-24);
      } finally {
        status.textContent = "";
        renderAiMessages(messages);
        sendButton.disabled = false;
        input.focus();
      }
    });
  }

  /* Three.js 3D Banner Scene */
  let threeScene, threeCamera, threeRenderer, threeMeshGroup, threeParticles, threeAnimId;
  function initBanner3D() {
    const container = document.getElementById("banner-3d-canvas-wrap");
    if (!container || !window.THREE) return;

    if (threeAnimId) cancelAnimationFrame(threeAnimId);
    container.innerHTML = "";

    const width = container.clientWidth || 240;
    const height = container.clientHeight || 180;

    threeScene = new THREE.Scene();
    threeCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    threeCamera.position.z = 5.2;

    try {
      threeRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      threeRenderer.setSize(width, height);
      threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      threeRenderer.domElement.id = "banner-3d-canvas";
      container.appendChild(threeRenderer.domElement);
    } catch (e) {
      console.warn("WebGL unsupported, 3D banner fallback used.", e);
      return;
    }

    const isDark = document.body.classList.contains("dark-theme");
    threeMeshGroup = new THREE.Group();

    // Outer Icosahedron Wireframe
    const outerGeo = new THREE.IcosahedronGeometry(1.6, 1);
    const outerMat = new THREE.MeshBasicMaterial({
      color: isDark ? 0x52b788 : 0x3d7955,
      wireframe: true,
      transparent: true,
      opacity: isDark ? 0.45 : 0.35
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    threeMeshGroup.add(outerMesh);

    // Inner Gem (Octahedron)
    const innerGeo = new THREE.OctahedronGeometry(1.0, 0);
    const innerMat = new THREE.MeshPhongMaterial({
      color: isDark ? 0x48bb78 : 0x467b57,
      emissive: isDark ? 0x143520 : 0x0d2416,
      specular: 0xffffff,
      shininess: 90,
      flatShading: true,
      transparent: true,
      opacity: 0.88
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    threeMeshGroup.add(innerMesh);

    // Core Glowing Node
    const coreGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: isDark ? 0xf6ad55 : 0xe98a46
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    threeMeshGroup.add(coreMesh);

    // Orbiting Particles Constellation
    const particleCount = 65;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      const radius = 2.0 + Math.random() * 0.9;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = radius * Math.cos(phi);
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: isDark ? 0x68d391 : 0x52b788,
      size: 0.08,
      transparent: true,
      opacity: 0.75
    });
    threeParticles = new THREE.Points(particleGeo, particleMat);
    threeMeshGroup.add(threeParticles);

    threeScene.add(threeMeshGroup);

    // Dynamic Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, isDark ? 0.8 : 0.9);
    threeScene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(5, 5, 5);
    threeScene.add(dirLight1);

    const dirLight2 = new THREE.PointLight(isDark ? 0x52b788 : 0x3d7955, 1.5, 10);
    dirLight2.position.set(-3, -2, 2);
    threeScene.add(dirLight2);

    // Mouse / Touch Parallax & Dragging
    let targetX = 0, targetY = 0;
    let mouseX = 0, mouseY = 0;
    let isDragging = false, prevMouseX = 0, prevMouseY = 0;

    const banner = document.querySelector(".welcome-banner");
    const onMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      targetX = x * 1.5;
      targetY = y * 1.5;
    };

    container.addEventListener("mousedown", (e) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    });
    window.addEventListener("mouseup", () => { isDragging = false; });
    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      threeMeshGroup.rotation.y += deltaX * 0.015;
      threeMeshGroup.rotation.x += deltaY * 0.015;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    });

    if (banner) banner.addEventListener("mousemove", onMouseMove);

    function animate() {
      threeAnimId = requestAnimationFrame(animate);
      if (!isDragging) {
        threeMeshGroup.rotation.y += 0.007;
        threeMeshGroup.rotation.x += 0.003;
        threeParticles.rotation.y -= 0.003;

        mouseX += (targetX - mouseX) * 0.05;
        mouseY += (targetY - mouseY) * 0.05;
        threeMeshGroup.position.x = mouseX * 0.8;
        threeMeshGroup.position.y = -mouseY * 0.8;
      }
      threeRenderer.render(threeScene, threeCamera);
    }
    animate();

    window.updateThreeJsTheme = (dark) => {
      outerMat.color.setHex(dark ? 0x52b788 : 0x3d7955);
      outerMat.opacity = dark ? 0.45 : 0.35;
      innerMat.color.setHex(dark ? 0x48bb78 : 0x467b57);
      innerMat.emissive.setHex(dark ? 0x143520 : 0x0d2416);
      particleMat.color.setHex(dark ? 0x68d391 : 0x52b788);
      coreMat.color.setHex(dark ? 0xf6ad55 : 0xe98a46);
    };
  }

  /* ==========================================================================
     JOB APPLICATION SUITE & TRACKER (Candidate-First Toolkit)
     ========================================================================== */
  const APPLICATIONS_KEY = "pauser-job-applications-v1";

  function getJobApplications() {
    try {
      const saved = JSON.parse(localStorage.getItem(APPLICATIONS_KEY) || "null");
      if (Array.isArray(saved)) return saved;
    } catch (e) {
      console.warn("Could not parse saved job applications:", e);
    }
    return [];
  }

  function saveJobApplications(apps) {
    try {
      localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(apps));
    } catch (e) {
      console.warn("Could not save applications:", e);
    }
  }

  const COMMON_ROLE_KEYWORDS = [
    "javascript", "js", "es6", "three.js", "threejs", "webgl", "python", "c++", "cpp", "java",
    "html", "html5", "css", "css3", "node.js", "nodejs", "node", "rest", "api", "apis", "restful",
    "git", "github", "data structures", "algorithms", "dsa", "problem solving", "oop", "oops",
    "dom", "dom manipulation", "event handling", "ai", "machine learning", "responsive design",
    "web development", "frontend", "front-end", "backend", "back-end", "full-stack",
    "communication", "leadership", "teamwork", "project management", "time management",
    "customer service", "sales", "marketing", "content writing", "research", "data analysis",
    "analytics", "excel", "accounting", "operations", "training", "presentation", "problem solving"
  ];

  const COMMON_JD_TECH_KEYWORDS = [
    "react", "react.js", "next.js", "typescript", "ts", "redux", "tailwind", "tailwindcss",
    "vue", "angular", "express", "express.js", "mongodb", "sql", "mysql", "postgresql",
    "docker", "kubernetes", "aws", "azure", "cloud", "redis", "graphql", "ci/cd", "jest",
    "testing", "microservices", "kafka", "pandas", "numpy", "django", "flask", "fastapi"
  ];

  function renderTracker() {
    const view = document.getElementById("tracker-view");
    let applications = getJobApplications();
    let currentFilter = "all";

    function draw() {
      const totalCount = applications.length;
      const interviewingCount = applications.filter(a => a.status === "Technical Interview" || a.status === "HR Round").length;
      const assessmentCount = applications.filter(a => a.status === "Online Assessment").length;
      const offerCount = applications.filter(a => a.status === "Offer Received").length;

      const filteredApps = applications.filter(a => {
        if (currentFilter === "all") return true;
        if (currentFilter === "interview") return a.status === "Technical Interview" || a.status === "HR Round";
        if (currentFilter === "assessment") return a.status === "Online Assessment";
        if (currentFilter === "offer") return a.status === "Offer Received";
        if (currentFilter === "applied") return a.status === "Applied";
        return true;
      });

      view.innerHTML = `
        <div class="page-heading">
          <div>
            <div class="eyebrow">Your job search workspace</div>
            <h1>Apply with confidence.</h1>
            <p>Tailor your resume to each role, prepare a clear application message, and keep every application moving forward.</p>
          </div>
          <div class="tracker-top-cta">
            <button class="primary-button" id="tracker-download-pdf"><span class="button-icon">↓</span> Download resume</button>
            <button class="secondary-button" id="tracker-edit-resume"><span class="button-icon">✎</span> Edit resume</button>
          </div>
        </div>

        <!-- Metric Stat Cards -->
        <div class="tracker-stats-grid">
          <div class="tracker-stat-card">
            <div class="tracker-stat-icon">📋</div>
            <div class="tracker-stat-meta">
              <span class="tracker-stat-num">${totalCount}</span>
              <span class="tracker-stat-label">Applications</span>
            </div>
          </div>
          <div class="tracker-stat-card">
            <div class="tracker-stat-icon">💻</div>
            <div class="tracker-stat-meta">
              <span class="tracker-stat-num">${assessmentCount}</span>
              <span class="tracker-stat-label">Assessments</span>
            </div>
          </div>
          <div class="tracker-stat-card highlight">
            <div class="tracker-stat-icon">🎯</div>
            <div class="tracker-stat-meta">
              <span class="tracker-stat-num">${interviewingCount}</span>
              <span class="tracker-stat-label">Interviews</span>
            </div>
          </div>
          <div class="tracker-stat-card">
            <div class="tracker-stat-icon">🏆</div>
            <div class="tracker-stat-meta">
              <span class="tracker-stat-num">${offerCount}</span>
              <span class="tracker-stat-label">Offers</span>
            </div>
          </div>
        </div>

        <!-- 2 Column Tools Section: Job description matcher + application message -->
        <div class="tracker-tools-grid">
          
          <!-- Tool 1: JD Keyword & ATS Matcher -->
          <section class="tracker-tool-card">
            <div class="tool-card-head">
              <div>
                <span class="tool-badge">01 · Tailor</span>
                <h3>Compare with the job description</h3>
                <p>See which skills from your resume appear in the role description. This is a keyword guide, not an employer ATS score.</p>
              </div>
            </div>
            
            <div class="jd-input-wrap">
              <textarea id="tracker-jd-input" placeholder="Paste the job description here to identify relevant skills and keywords…"></textarea>
            </div>

            <div class="tool-actions-row">
              <button class="primary-button" id="btn-match-jd"><span class="button-icon">⚡</span> Compare with my resume</button>
              <button class="secondary-button" id="btn-clear-jd">Clear</button>
            </div>

            <div id="jd-analysis-result" class="jd-result-container" style="display:none;"></div>
          </section>

          <!-- Tool 2: Application message generator -->
          <section class="tracker-tool-card">
            <div class="tool-card-head">
              <div>
                <span class="tool-badge">02 · Prepare</span>
                <h3>Draft an application message</h3>
                <p>Create a starting point for an application email using details you have added to your resume.</p>
              </div>
            </div>

            <div class="pitch-form-grid">
              <div class="pitch-field">
                <label for="pitch-company">Company</label>
                <input type="text" id="pitch-company" placeholder="Company name">
              </div>
              <div class="pitch-field">
                <label for="pitch-role">Role</label>
                <input type="text" id="pitch-role" placeholder="Job title">
              </div>
              <div class="pitch-field">
                <label for="pitch-recruiter">Greeting (optional)</label>
                <input type="text" id="pitch-recruiter" placeholder="e.g. Hello">
              </div>
              <div class="pitch-field">
                <label for="pitch-angle">Message length</label>
                <select id="pitch-angle">
                  <option value="detailed">Detailed</option>
                  <option value="concise">Concise</option>
                </select>
              </div>
            </div>

            <div class="tool-actions-row" style="margin-top:14px;">
              <button class="primary-button" id="btn-generate-pitch"><span class="button-icon">✦</span> Create draft</button>
            </div>

            <div id="pitch-output-box" class="pitch-output-box" style="margin-top:16px;">
              <div class="pitch-box-header">
                <strong>Subject Line:</strong>
                <button class="text-button" id="btn-copy-subject">Copy Subject</button>
              </div>
              <div class="pitch-subject-display" id="pitch-subject-text">Your application subject will appear here.</div>
              
              <div class="pitch-box-header" style="margin-top:12px;">
                <strong>Message:</strong>
                <button class="text-button" id="btn-copy-body">Copy message</button>
              </div>
              <div class="pitch-body-display" id="pitch-body-text">Add your resume details, then create a draft you can review and personalize.</div>

              <div class="pitch-actions-row">
                <button class="secondary-button" id="btn-copy-all"><span class="button-icon">▣</span> Copy application</button>
                <a href="#" id="btn-open-gmail" class="primary-button" target="_blank" rel="noopener"><span class="button-icon">✉</span> Open email draft</a>
              </div>
            </div>
          </section>

        </div>

        <!-- Section 3: Applications Tracker Table -->
        <section class="tracker-table-section">
          <div class="table-section-head">
            <div>
              <div class="eyebrow">03 · Keep track</div>
              <h2>Application tracker</h2>
              <p>Keep track of where you've applied, interview stages, and follow-ups. Saved locally in your browser.</p>
            </div>
            <button class="primary-button" id="btn-show-add-modal"><span class="button-icon">＋</span> Add application</button>
          </div>

          <!-- Add Application Inline Form (toggleable) -->
          <div id="add-app-form-wrap" class="add-app-drawer hidden">
            <h4>Add a job application</h4>
            <div class="add-app-grid">
              <div class="add-field">
                <label for="new-app-company">Company Name *</label>
                <input type="text" id="new-app-company" placeholder="Company name">
              </div>
              <div class="add-field">
                <label for="new-app-role">Role Applied *</label>
                <input type="text" id="new-app-role" placeholder="Role title">
              </div>
              <div class="add-field">
                <label for="new-app-platform">Platform / Source</label>
                <select id="new-app-platform">
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Indeed">Indeed</option>
                  <option value="Glassdoor">Glassdoor</option>
                  <option value="Naukri">Naukri.com</option>
                  <option value="Company Portal">Company Careers Portal</option>
                  <option value="Wellfound">Wellfound (AngelList)</option>
                  <option value="Cold Email">Cold Email / InMail</option>
                  <option value="Campus">College Campus / Referral</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div class="add-field">
                <label for="new-app-date">Date Applied</label>
                <input type="date" id="new-app-date" value="${new Date().toISOString().split("T")[0]}">
              </div>
              <div class="add-field">
                <label for="new-app-status">Current Status</label>
                <select id="new-app-status">
                  <option value="Applied">Applied</option>
                  <option value="Online Assessment">Online Assessment</option>
                  <option value="Technical Interview">Technical Interview</option>
                  <option value="HR Round">HR Round</option>
                  <option value="Offer Received">Offer Received</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div class="add-field" style="grid-column: 1 / -1;">
                <label for="new-app-notes">Notes / Links / Next Steps</label>
                <input type="text" id="new-app-notes" placeholder="e.g. Application link, follow-up date, or next step">
              </div>
            </div>
            <div class="add-app-actions">
              <button class="primary-button" id="btn-save-new-app">Save Application</button>
              <button class="secondary-button" id="btn-cancel-add-app">Cancel</button>
            </div>
          </div>

          <!-- Filter Tabs -->
          <div class="tracker-filter-tabs">
            <button class="tracker-tab ${currentFilter === "all" ? "active" : ""}" data-filter="all">All Applications (${totalCount})</button>
            <button class="tracker-tab ${currentFilter === "applied" ? "active" : ""}" data-filter="applied">Applied (${applications.filter(a => a.status === "Applied").length})</button>
            <button class="tracker-tab ${currentFilter === "assessment" ? "active" : ""}" data-filter="assessment">Assessments (${assessmentCount})</button>
            <button class="tracker-tab ${currentFilter === "interview" ? "active" : ""}" data-filter="interview">Interviews (${interviewingCount})</button>
            <button class="tracker-tab ${currentFilter === "offer" ? "active" : ""}" data-filter="offer">Offers (${offerCount})</button>
          </div>

          <!-- Applications Table -->
          <div class="tracker-table-wrap">
            <table class="tracker-table">
              <thead>
                <tr>
                  <th>Company & Role</th>
                  <th>Platform</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${filteredApps.length === 0 ? `
                  <tr>
                    <td colspan="6" style="text-align:center; padding:30px; color:var(--muted);">
                        No applications here yet. Add one to start tracking your progress.
                    </td>
                  </tr>
                ` : filteredApps.map(app => {
                  const statusClass = app.status === "Offer Received" ? "offer" :
                                      app.status === "Technical Interview" || app.status === "HR Round" ? "interview" :
                                      app.status === "Online Assessment" ? "assessment" :
                                      app.status === "Rejected" ? "rejected" : "applied";
                  return `
                    <tr data-app-id="${escapeHtml(app.id)}">
                      <td>
                        <strong>${escapeHtml(app.company)}</strong>
                        <span class="table-subtext">${escapeHtml(app.role)}</span>
                      </td>
                      <td><span class="platform-badge">${escapeHtml(app.platform || "Direct")}</span></td>
                      <td style="white-space:nowrap; font-size:12px; color:var(--muted);">${escapeHtml(app.dateApplied || "-")}</td>
                      <td>
                        <select class="table-status-select ${statusClass}" data-action="change-status" data-id="${escapeHtml(app.id)}">
                          <option value="Applied" ${app.status === "Applied" ? "selected" : ""}>Applied</option>
                          <option value="Online Assessment" ${app.status === "Online Assessment" ? "selected" : ""}>Online Assessment</option>
                          <option value="Technical Interview" ${app.status === "Technical Interview" ? "selected" : ""}>Technical Interview</option>
                          <option value="HR Round" ${app.status === "HR Round" ? "selected" : ""}>HR Round</option>
                          <option value="Offer Received" ${app.status === "Offer Received" ? "selected" : ""}>Offer Received</option>
                          <option value="Rejected" ${app.status === "Rejected" ? "selected" : ""}>Rejected</option>
                        </select>
                      </td>
                      <td>
                        <div class="table-notes" title="${escapeHtml(app.notes || "")}">${escapeHtml(app.notes || "—")}</div>
                      </td>
                      <td style="text-align:right;">
                        <button class="table-del-btn" data-action="delete-app" data-id="${escapeHtml(app.id)}" title="Delete application">×</button>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </section>

        <!-- Application checklist -->
        <div class="tracker-checklist-card">
          <div class="checklist-head">
            <span class="checklist-icon">✓</span>
            <div>
              <h3>Before you apply</h3>
              <p>A few quick checks can help you submit a complete, tailored application.</p>
            </div>
          </div>
          <div class="checklist-grid">
            <label class="check-item"><input type="checkbox"> <span>Check your contact details and links</span></label>
            <label class="check-item"><input type="checkbox"> <span>Tailor your resume to the role requirements</span></label>
            <label class="check-item"><input type="checkbox"> <span>Review dates, spelling, and formatting</span></label>
            <label class="check-item"><input type="checkbox"> <span>Save a copy of the submitted resume</span></label>
          </div>
        </div>
      `;

      bindEvents();
    }

    function bindEvents() {
      // Top actions
      const dlBtn = view.querySelector("#tracker-download-pdf");
      if (dlBtn) dlBtn.onclick = () => downloadResumePdf();

      const editResumeBtn = view.querySelector("#tracker-edit-resume");
      if (editResumeBtn) editResumeBtn.onclick = () => activeResume() ? setView("builder") : createResume();

      // Analyze JD
      const matchJdBtn = view.querySelector("#btn-match-jd");
      if (matchJdBtn) {
        matchJdBtn.onclick = () => {
          const jdText = view.querySelector("#tracker-jd-input").value.trim();
          if (!jdText) {
            toast("Please paste a job description first.", true);
            return;
          }
          analyzeJd(jdText);
        };
      }

      // Clear JD
      const clearJdBtn = view.querySelector("#btn-clear-jd");
      if (clearJdBtn) {
        clearJdBtn.onclick = () => {
          view.querySelector("#tracker-jd-input").value = "";
          const res = view.querySelector("#jd-analysis-result");
          if (res) res.style.display = "none";
        };
      }

      // Pitch Generator
      const genPitchBtn = view.querySelector("#btn-generate-pitch");
      if (genPitchBtn) {
        genPitchBtn.onclick = generatePitch;
      }

      const copySubjectBtn = view.querySelector("#btn-copy-subject");
      if (copySubjectBtn) {
        copySubjectBtn.onclick = () => {
          const txt = view.querySelector("#pitch-subject-text").textContent;
          navigator.clipboard.writeText(txt).then(() => toast("Subject copied to clipboard!"));
        };
      }

      const copyBodyBtn = view.querySelector("#btn-copy-body");
      if (copyBodyBtn) {
        copyBodyBtn.onclick = () => {
          const txt = view.querySelector("#pitch-body-text").textContent;
          navigator.clipboard.writeText(txt).then(() => toast("Email body copied to clipboard!"));
        };
      }

      const copyAllBtn = view.querySelector("#btn-copy-all");
      if (copyAllBtn) {
        copyAllBtn.onclick = () => {
          const sub = view.querySelector("#pitch-subject-text").textContent;
          const body = view.querySelector("#pitch-body-text").textContent;
          navigator.clipboard.writeText(`Subject: ${sub}\n\n${body}`).then(() => toast("Complete pitch copied to clipboard!"));
        };
      }

      // Drawer toggle
      const showAddBtn = view.querySelector("#btn-show-add-modal");
      const drawer = view.querySelector("#add-app-form-wrap");
      if (showAddBtn && drawer) {
        showAddBtn.onclick = () => {
          drawer.classList.toggle("hidden");
          if (!drawer.classList.contains("hidden")) {
            view.querySelector("#new-app-company").focus();
          }
        };
      }

      const cancelAddBtn = view.querySelector("#btn-cancel-add-app");
      if (cancelAddBtn && drawer) {
        cancelAddBtn.onclick = () => drawer.classList.add("hidden");
      }

      const saveNewBtn = view.querySelector("#btn-save-new-app");
      if (saveNewBtn) {
        saveNewBtn.onclick = () => {
          const company = view.querySelector("#new-app-company").value.trim();
          const role = view.querySelector("#new-app-role").value.trim();
          const platform = view.querySelector("#new-app-platform").value;
          const dateApplied = view.querySelector("#new-app-date").value;
          const status = view.querySelector("#new-app-status").value;
          const notes = view.querySelector("#new-app-notes").value.trim();

          if (!company || !role) {
            toast("Please enter both Company and Role.", true);
            return;
          }

          const newApp = {
            id: makeId(),
            company,
            role,
            platform,
            dateApplied: dateApplied || new Date().toISOString().split("T")[0],
            status,
            notes
          };

          applications.unshift(newApp);
          saveJobApplications(applications);
          toast(`Logged application for ${company}!`);
          draw();
        };
      }

      // Filter tabs
      view.querySelectorAll(".tracker-tab").forEach(tab => {
        tab.onclick = () => {
          currentFilter = tab.dataset.filter;
          draw();
        };
      });

      // Table status changes & deletes
      view.querySelectorAll('[data-action="change-status"]').forEach(sel => {
        sel.onchange = (e) => {
          const id = sel.dataset.id;
          const newStatus = e.target.value;
          const item = applications.find(a => a.id === id);
          if (item) {
            item.status = newStatus;
            saveJobApplications(applications);
            toast(`Status updated to "${newStatus}" for ${item.company}.`);
            draw();
          }
        };
      });

      view.querySelectorAll('[data-action="delete-app"]').forEach(btn => {
        btn.onclick = () => {
          const id = btn.dataset.id;
          const item = applications.find(a => a.id === id);
          if (item && confirm(`Remove application for ${item.company}?`)) {
            applications = applications.filter(a => a.id !== id);
            saveJobApplications(applications);
            toast("Application removed.");
            draw();
          }
        };
      });

      // Generate default pitch on initial draw
      generatePitch();
    }

    function analyzeJd(text) {
      const resume = activeResume();
      if (!resume) {
        toast("Create a resume first to compare it with a job description.", true);
        return;
      }
      const jobText = text.toLowerCase();
      const resumeText = JSON.stringify(resume).toLowerCase();
      const keywords = [...new Set([...COMMON_ROLE_KEYWORDS, ...COMMON_JD_TECH_KEYWORDS])];
      const matches = keyword => {
        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i");
      };
      const mentioned = keywords.filter(keyword => matches(keyword).test(jobText));
      const matched = mentioned.filter(keyword => matches(keyword).test(resumeText));
      const missing = mentioned.filter(keyword => !matches(keyword).test(resumeText));
      const score = mentioned.length ? Math.round((matched.length / mentioned.length) * 100) : 0;
      const scoreColor = score >= 70 ? "var(--green)" : score >= 40 ? "#b7791f" : "#c0564b";
      const resDiv = view.querySelector("#jd-analysis-result");
      resDiv.style.display = "block";
      resDiv.innerHTML = `
        <div class="jd-score-header">
          <div class="jd-score-circle" style="border-color:${scoreColor}; color:${scoreColor};">
            <span class="jd-score-val">${mentioned.length ? `${score}%` : "N/A"}</span>
            <span class="jd-score-tag">Keyword overlap</span>
          </div>
          <div class="jd-score-details">
            <h4 style="color:${scoreColor}; margin:0 0 4px;">${matched.length} of ${mentioned.length} role keywords found</h4>
            <p style="margin:0; font-size:12px; color:var(--muted);">Based on text in your current resume. This is a simple keyword comparison, not an ATS score or a prediction of hiring outcomes.</p>
          </div>
        </div>
        <div class="jd-pills-row">
          <div>
            <strong class="pill-title" style="color:var(--green)">Found in your resume (${matched.length}):</strong>
            <div class="match-pills-wrap">
              ${matched.length ? matched.map(keyword => `<span class="match-pill matched">&#10003; ${escapeHtml(keyword)}</span>`).join("") : `<span style="font-size:11px;color:var(--muted);">No matching keywords found yet.</span>`}
            </div>
          </div>
          ${missing.length ? `
            <div style="margin-top:14px;">
              <strong class="pill-title" style="color:#b7791f">Consider adding if accurate (${missing.length}):</strong>
              <div class="match-pills-wrap">
                ${missing.map(keyword => `<span class="match-pill bonus">+ ${escapeHtml(keyword)}</span>`).join("")}
              </div>
              <p style="font-size:10px; color:var(--muted); margin:6px 0 0;">Only include skills and experience you genuinely have.</p>
            </div>
          ` : ""}
        </div>
      `;
      resDiv.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function generatePitch() {
      const resume = activeResume();
      const company = view.querySelector("#pitch-company").value.trim() || "the company";
      const roleInput = view.querySelector("#pitch-role").value.trim();
      const role = roleInput || "the advertised role";
      const greeting = view.querySelector("#pitch-recruiter").value.trim();
      const concise = view.querySelector("#pitch-angle").value === "concise";
      const name = resume?.contact?.name.trim() || "Your name";
      const subject = `Application for ${role} - ${name}`;
      const summary = resume?.summary.trim();
      const highlights = [
        ...(resume?.skills || []).slice(0, 5),
        ...(resume?.experience || []).slice(0, 2).map(item => `${item.title}${item.company ? ` at ${item.company}` : ""}`),
        ...(resume?.projects || []).slice(0, 2).map(item => item.name)
      ].filter(Boolean).slice(0, concise ? 3 : 5);
      const greetingLine = greeting ? `Dear ${greeting},` : "Hello,";
      const paragraphs = [
        greetingLine,
        "",
        `I am writing to apply for ${roleInput ? `the ${roleInput} position` : "the advertised position"} at ${company}.`,
        summary || (highlights.length ? `My relevant background includes ${highlights.join(", ")}.` : "I would welcome the opportunity to share how my experience and skills align with this role."),
        ...(concise || !highlights.length ? [] : [`Relevant experience and skills from my resume include: ${highlights.join(", ")}.`]),
        "Thank you for considering my application. I have attached my resume and would be glad to discuss my suitability for the role.",
        "",
        "Kind regards,",
        name,
        ...(resume?.contact?.role ? [resume.contact.role] : [])
      ].filter((line, index, all) => line || (index > 0 && all[index - 1] !== ""));
      const body = paragraphs.join("\n");
      view.querySelector("#pitch-subject-text").textContent = subject;
      view.querySelector("#pitch-body-text").textContent = body;
      const emailLink = view.querySelector("#btn-open-gmail");
      emailLink.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }

    draw();
  }

  // Global Event Listeners & Initialization
  document.addEventListener("click", event => {
    const nav = event.target.closest("[data-view]");
    if (nav) {
      event.preventDefault();
      setView(nav.dataset.view);
    }
  });

  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) themeToggle.addEventListener("click", toggleTheme);

  const sidebarThemeToggle = document.getElementById("sidebar-theme-toggle");
  if (sidebarThemeToggle) sidebarThemeToggle.addEventListener("click", toggleTheme);

  const quickDownloadBtn = document.getElementById("quick-download-pdf");
  if (quickDownloadBtn) quickDownloadBtn.addEventListener("click", () => downloadResumePdf());

  const helpBtn = document.querySelector(".help-button");
  if (helpBtn) helpBtn.addEventListener("click", () => toast("Your resumes are saved privately in this browser on this device."));

  window.addEventListener("resize", () => {
    if (currentView === "dashboard") {
      setTimeout(initBanner3D, 60);
    }
  });

  initTheme();
  if (!importSharedResume()) setView("dashboard");
})();
