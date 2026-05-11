const resources = {
  resume: "",
  jd: "",
  company: "",
  hiringManager: ""
};

const labels = {
  resume: {
    label: "Resume",
    placeholder: "Paste the candidate resume here."
  },
  jd: {
    label: "JD",
    placeholder: "Paste the job description here."
  },
  company: {
    label: "Company",
    placeholder: "Paste company notes, a company name, or a website."
  },
  hiringManager: {
    label: "Hiring Manager",
    placeholder: "Paste the hiring manager name, LinkedIn URL, notes, or anything you know about them."
  }
};

let activeTab = "resume";
let focusMode = "resources";
let hasGenerated = false;
let progressTimer = null;
let progressStartedAt = 0;
let latestAnalysis = null;
let latestSource = "";
let historyFilter = "active";
let savedSearches = loadSavedSearches();
let todoState = {};

const editor = document.querySelector("#resourceEditor");
const editorLabel = document.querySelector("#editorLabel");
const charCount = document.querySelector("#charCount");
const saveState = document.querySelector("#saveState");
const resumeMeter = document.querySelector("#resumeMeter");
const jdMeter = document.querySelector("#jdMeter");
const companyMeter = document.querySelector("#companyMeter");
const hiringManagerMeter = document.querySelector("#hiringManagerMeter");
const generateBtn = document.querySelector("#generateBtn");
const saveSearchBtn = document.querySelector("#saveSearchBtn");
const resetBtn = document.querySelector("#resetBtn");
const statusLabel = document.querySelector("#statusLabel");
const statusDetail = document.querySelector("#statusDetail");
const sourcePill = document.querySelector("#sourcePill");
const emptyState = document.querySelector("#emptyState");
const codexProgress = document.querySelector("#codexProgress");
const progressTitle = document.querySelector("#progressTitle");
const progressFill = document.querySelector("#progressFill");
const elapsedTime = document.querySelector("#elapsedTime");
const etaTime = document.querySelector("#etaTime");
const results = document.querySelector("#results");
const historyList = document.querySelector("#historyList");
const studioGrid = document.querySelector("#studioGrid");

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

editor.addEventListener("input", () => {
  resources[activeTab] = editor.value;
  hasGenerated = false;
  updateResourceState();
  updateGenerateState();
});

generateBtn.addEventListener("click", generateBrief);
saveSearchBtn.addEventListener("click", saveCurrentSearch);
resetBtn.addEventListener("click", resetWorkspace);
document.querySelectorAll(".section-toggle").forEach(button => {
  button.addEventListener("click", () => toggleSection(button));
});
document.querySelectorAll(".history-filter").forEach(button => {
  button.addEventListener("click", () => switchHistoryFilter(button.dataset.filter));
});
document.querySelectorAll(".focus-button").forEach(button => {
  button.addEventListener("click", () => setFocusMode(button.dataset.focus));
});

updateResourceState();
updateGenerateState();
renderHistory();

function switchTab(tab, persistCurrent = true) {
  if (persistCurrent) resources[activeTab] = editor.value;
  activeTab = tab;

  document.querySelectorAll(".tab").forEach(button => {
    const isActive = button.dataset.tab === tab;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  editorLabel.textContent = labels[tab].label;
  editor.placeholder = labels[tab].placeholder;
  editor.value = resources[tab];
  updateResourceState();
}

function updateResourceState() {
  const filled = Object.values(resources).filter(value => value.trim()).length;
  charCount.textContent = `${editor.value.length.toLocaleString()} characters`;
  saveState.textContent = `${filled}/4 resources updated`;
  updateMeter(resumeMeter, resources.resume, "Required");
  updateMeter(jdMeter, resources.jd, "Required");
  updateMeter(companyMeter, resources.company, "Optional");
  updateMeter(hiringManagerMeter, resources.hiringManager, "Optional");
}

function updateGenerateState() {
  const ready = resources.resume.trim().length > 0 && resources.jd.trim().length > 0;
  generateBtn.disabled = !ready;

  if (!ready) {
    statusLabel.textContent = "Waiting for resources";
    statusDetail.textContent = "Add resume and JD text to enable generation.";
    sourcePill.textContent = "Draft";
    saveSearchBtn.disabled = true;
    return;
  }

  if (!hasGenerated) {
    statusLabel.textContent = "Ready to generate";
    statusDetail.textContent = "Generate will run Codex locally through the backend.";
    sourcePill.textContent = "Ready";
    saveSearchBtn.disabled = true;
  }
}

async function generateBrief() {
  resources[activeTab] = editor.value;
  setFocusMode("review");
  generateBtn.disabled = true;
  resetBtn.disabled = true;
  saveSearchBtn.disabled = true;
  document.body.classList.add("loading");
  generateBtn.textContent = "Generating";
  emptyState.classList.add("hidden");
  results.classList.add("hidden");
  startProgress();
  statusLabel.textContent = "Generating brief";
  statusDetail.textContent = "Codex is running locally, fetching company context, and preparing structured interview notes.";
  sourcePill.textContent = "Codex";

  try {
    const response = await fetch("/api/interview-prep/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(resources)
    });

    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || "Generation failed");

    renderAnalysis(payload.analysis);
    latestAnalysis = payload.analysis;
    latestSource = payload.source;
    hasGenerated = true;
    emptyState.classList.add("hidden");
    codexProgress.classList.add("hidden");
    results.classList.remove("hidden");
    statusLabel.textContent = payload.source === "codex" ? "Generated by Codex" : "Generated local draft";
    statusDetail.textContent = payload.warning || "Reset to clear the resources and start a fresh search.";
    sourcePill.textContent = payload.source === "codex" ? "Codex" : "Local draft";
    saveSearchBtn.disabled = false;
  } catch (error) {
    statusLabel.textContent = "Generation failed";
    statusDetail.textContent = error.message;
    sourcePill.textContent = "Error";
    emptyState.classList.remove("hidden");
  } finally {
    stopProgress();
    document.body.classList.remove("loading");
    generateBtn.textContent = hasGenerated ? "Regenerate Draft" : "Generate";
    resetBtn.disabled = false;
    generateBtn.disabled = !(resources.resume.trim() && resources.jd.trim());
  }
}

function resetWorkspace() {
  resources.resume = "";
  resources.jd = "";
  resources.company = "";
  resources.hiringManager = "";
  hasGenerated = false;
  latestAnalysis = null;
  latestSource = "";
  todoState = {};
  switchTab("resume", false);
  emptyState.classList.remove("hidden");
  codexProgress.classList.add("hidden");
  results.classList.add("hidden");
  generateBtn.textContent = "Generate";
  statusLabel.textContent = "Waiting for resources";
  statusDetail.textContent = "Add resume and JD text to enable generation.";
  sourcePill.textContent = "Draft";
  saveSearchBtn.disabled = true;
  updateGenerateState();
}

function renderAnalysis(analysis) {
  todoState = {};
  const metadata = analysis.metadata || {};
  setText("#candidateName", metadata.candidateName || "Not specified");
  setText("#targetRole", metadata.targetRole || "Not specified");
  setText("#companyName", metadata.companyName || "Not specified");

  const aboutCompany = normalizeCompany(analysis.aboutCompany);
  const roleAlignment = analysis.roleAlignment || [];
  const roleNonAlignment = analysis.roleNonAlignment || [];
  const hiringManager = normalizeHiringManager(analysis.hiringManager);
  const preparationFocus = analysis.preparationFocus || [];
  const researchLinks = normalizeResearchLinks(analysis.researchLinks);

  setText("#aboutCompanyCount", "3 fields");
  setText("#roleAlignmentCount", itemCount(roleAlignment.length));
  setText("#roleNonAlignmentCount", itemCount(roleNonAlignment.length));
  setText("#hiringManagerCount", "6 fields");
  setText("#preparationFocusCount", itemCount(preparationFocus.length));

  renderCompany("#aboutCompany", aboutCompany, researchLinks);
  renderRoleAlignment("#roleAlignment", roleAlignment, researchLinks);
  renderRoleNonAlignment("#roleNonAlignment", roleNonAlignment, researchLinks);
  renderHiringManager("#hiringManagerDetails", hiringManager, researchLinks);
  renderPreparationFocus("#preparationFocus", preparationFocus, researchLinks);
}

function renderAnalysisFromSaved(analysis, savedTodoState = {}) {
  renderAnalysis(analysis);
  todoState = { ...savedTodoState };
  document.querySelectorAll(".todo-item").forEach(button => {
    const index = button.dataset.todo;
    setTodoVisual(button, Boolean(todoState[index]));
  });
}

function normalizeCompany(aboutCompany) {
  if (Array.isArray(aboutCompany)) {
    const summary = aboutCompany.map(item => `${item.title || "Company"}: ${item.detail || ""}`).join(" ");
    return {
      keyInformation: {
        mainProductsServices: summary || "Not available.",
        businessSegments: "Not available in older saved search.",
        topLine: "Not available in older saved search.",
        bottomLine: "Not available in older saved search.",
        headcount: "Not available in older saved search.",
        headquarters: "Not available in older saved search."
      },
      additionalInformation: {
        globalPresence: "Not available in older saved search.",
        topCustomers: ["Not available in older saved search."],
        topCompetitors: ["Not available in older saved search."]
      },
      presenceInIndia: {
        mainProductsServices: "Not available in older saved search.",
        businessSegments: "Not available in older saved search.",
        topLine: "Not available in older saved search.",
        bottomLine: "Not available in older saved search.",
        headcount: "Not available in older saved search.",
        locationsInIndia: "Not available in older saved search.",
        bangaloreSpecifics: "Not available in older saved search."
      }
    };
  }

  return aboutCompany || {
    keyInformation: {},
    additionalInformation: {},
    presenceInIndia: {}
  };
}

function normalizeHiringManager(hiringManager) {
  return hiringManager || {
    name: "Not available.",
    currentRole: "Not available.",
    experience: "Not available.",
    background: "Not available.",
    education: "Not available.",
    passionsInterests: "Not available.",
    interviewRelevance: "Not available."
  };
}

function normalizeResearchLinks(links) {
  if (!Array.isArray(links)) return [];
  return links
    .filter(link => link && link.url && /^https?:\/\//i.test(link.url))
    .map(link => ({
      section: String(link.section || "Further research"),
      label: String(link.label || link.url),
      url: String(link.url),
      why: String(link.why || "Open this for additional context.")
    }));
}

function updateMeter(node, value, fallback) {
  const length = value.trim().length;
  if (!length) {
    node.textContent = fallback;
    node.dataset.state = fallback === "Required" ? "missing" : "optional";
    return;
  }
  node.textContent = length < 250 ? "Short" : length < 1500 ? "Ready" : "Detailed";
  node.dataset.state = "ready";
}

function startProgress() {
  progressStartedAt = Date.now();
  codexProgress.classList.remove("hidden");
  updateProgress();
  progressTimer = window.setInterval(updateProgress, 1000);
}

function stopProgress() {
  if (progressTimer) window.clearInterval(progressTimer);
  progressTimer = null;
}

function updateProgress() {
  const seconds = Math.floor((Date.now() - progressStartedAt) / 1000);
  const estimate = 150;
  const percent = Math.min(94, Math.max(8, Math.round((seconds / estimate) * 100)));
  const step = seconds < 12 ? 0 : seconds < 45 ? 1 : seconds < 95 ? 2 : 3;
  const titles = [
    "Reading your resources",
    "Fetching relevant company context",
    "Comparing resume evidence to the JD",
    "Writing the preparation brief"
  ];

  progressTitle.textContent = titles[step];
  progressFill.style.width = `${percent}%`;
  elapsedTime.textContent = `${seconds}s elapsed`;
  etaTime.textContent = seconds < 60 ? "Expected 1-3 min" : "Still running; Codex can take a few minutes";

  document.querySelectorAll(".progress-steps li").forEach(item => {
    const itemStep = Number(item.dataset.step);
    item.classList.toggle("active", itemStep === step);
    item.classList.toggle("done", itemStep < step);
  });
}

function setFocusMode(mode) {
  focusMode = mode === "review" ? "review" : "resources";
  studioGrid.classList.toggle("resources-focus", focusMode === "resources");
  studioGrid.classList.toggle("review-focus", focusMode === "review");
  document.querySelectorAll(".focus-button").forEach(button => {
    button.classList.toggle("active", button.dataset.focus === focusMode);
  });
}

function toggleSection(button) {
  const section = button.closest(".result-section");
  const isOpen = section.classList.toggle("open");
  button.setAttribute("aria-expanded", String(isOpen));
}

function toggleTodo(button, index) {
  todoState[index] = !todoState[index];
  setTodoVisual(button, todoState[index]);
}

function setTodoVisual(button, done) {
  button.classList.toggle("done", done);
  button.setAttribute("aria-pressed", String(done));
}

function saveCurrentSearch() {
  if (!latestAnalysis) return;
  resources[activeTab] = editor.value;
  const metadata = latestAnalysis.metadata || {};
  const item = {
    id: crypto.randomUUID(),
    title: buildSearchTitle(metadata),
    createdAt: new Date().toISOString(),
    source: latestSource || "codex",
    archived: false,
    resources: { ...resources },
    analysis: latestAnalysis,
    todoState: { ...todoState }
  };

  savedSearches = [item, ...savedSearches].slice(0, 30);
  persistSavedSearches();
  renderHistory();
  statusLabel.textContent = "Search saved";
  statusDetail.textContent = "You can open it again from Past searches or archive it when it is no longer active.";
}

function buildSearchTitle(metadata) {
  const company = metadata.companyName || firstLine(resources.company) || "Company";
  const role = metadata.targetRole || firstLine(resources.jd) || "Role";
  return `${company} - ${role}`.slice(0, 120);
}

function switchHistoryFilter(filter) {
  historyFilter = filter;
  document.querySelectorAll(".history-filter").forEach(button => {
    button.classList.toggle("active", button.dataset.filter === filter);
  });
  renderHistory();
}

function renderHistory() {
  const visible = savedSearches.filter(item => item.archived === (historyFilter === "archived"));
  historyList.replaceChildren();

  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = historyFilter === "archived" ? "Archived searches will appear here." : "Saved searches will appear here after generation.";
    historyList.append(empty);
    return;
  }

  visible.forEach(item => {
    const row = document.createElement("article");
    row.className = "history-item";

    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.title;
    const meta = document.createElement("span");
    meta.textContent = `${formatDate(item.createdAt)} · ${item.source === "codex" ? "Codex" : "Local draft"}`;
    body.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "history-actions";
    const open = document.createElement("button");
    open.type = "button";
    open.textContent = "Open";
    open.addEventListener("click", () => openSavedSearch(item.id));

    const archive = document.createElement("button");
    archive.type = "button";
    archive.textContent = item.archived ? "Restore" : "Archive";
    archive.addEventListener("click", () => toggleArchive(item.id));
    actions.append(open, archive);

    row.append(body, actions);
    historyList.append(row);
  });
}

function openSavedSearch(id) {
  const item = savedSearches.find(search => search.id === id);
  if (!item) return;

  resources.resume = item.resources.resume || "";
  resources.jd = item.resources.jd || "";
  resources.company = item.resources.company || "";
  resources.hiringManager = item.resources.hiringManager || "";
  latestAnalysis = item.analysis;
  latestSource = item.source;
  hasGenerated = true;
  switchTab("resume", false);
  renderAnalysisFromSaved(item.analysis, item.todoState || {});
  emptyState.classList.add("hidden");
  codexProgress.classList.add("hidden");
  results.classList.remove("hidden");
  generateBtn.textContent = "Regenerate Draft";
  saveSearchBtn.disabled = false;
  statusLabel.textContent = "Saved search opened";
  statusDetail.textContent = "This brief was restored from your browser history.";
  sourcePill.textContent = item.source === "codex" ? "Codex" : "Local draft";
  updateResourceState();
}

function toggleArchive(id) {
  savedSearches = savedSearches.map(item => item.id === id ? { ...item, archived: !item.archived } : item);
  persistSavedSearches();
  renderHistory();
}

function loadSavedSearches() {
  try {
    return JSON.parse(localStorage.getItem("interviewPrepSearches") || "[]");
  } catch {
    return [];
  }
}

function persistSavedSearches() {
  localStorage.setItem("interviewPrepSearches", JSON.stringify(savedSearches));
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function firstLine(text) {
  return text.split(/\n+/).map(line => line.trim()).find(Boolean) || "";
}

function itemCount(count) {
  return `${count} ${count === 1 ? "item" : "items"}`;
}

function renderCompany(selector, company, researchLinks) {
  const container = document.querySelector(selector);
  container.replaceChildren();

  const groups = [
    {
      title: "Key information: Global",
      icon: "icon-globe",
      links: linksFor(researchLinks, ["company", "global", "financials", "headcount"]),
      items: [
        ["Main products/services", company.keyInformation?.mainProductsServices],
        ["Business segments", company.keyInformation?.businessSegments],
        ["Top line", company.keyInformation?.topLine],
        ["Bottom line", company.keyInformation?.bottomLine],
        ["Headcount", company.keyInformation?.headcount],
        ["Headquarter", company.keyInformation?.headquarters]
      ]
    },
    {
      title: "Additional information",
      icon: "icon-search",
      links: linksFor(researchLinks, ["customer", "competitor", "market", "company"]),
      items: [
        ["Global presence", company.additionalInformation?.globalPresence],
        ["3 top customers", listText(company.additionalInformation?.topCustomers)],
        ["3 top competitors", listText(company.additionalInformation?.topCompetitors)]
      ]
    },
    {
      title: "Presence in India",
      icon: "icon-map",
      links: linksFor(researchLinks, ["india", "bangalore", "location", "office"]),
      items: [
        ["Main products/services", company.presenceInIndia?.mainProductsServices],
        ["Business segments", company.presenceInIndia?.businessSegments],
        ["Top line", company.presenceInIndia?.topLine],
        ["Bottom line", company.presenceInIndia?.bottomLine],
        ["Headcount", company.presenceInIndia?.headcount],
        ["Locations in India", company.presenceInIndia?.locationsInIndia],
        ["Specifics about Bangalore", company.presenceInIndia?.bangaloreSpecifics]
      ]
    }
  ];

  renderGroupedCards(container, groups);
}

function renderRoleAlignment(selector, items, researchLinks) {
  const container = document.querySelector(selector);
  container.replaceChildren();

  renderGroupedCards(container, [
    {
      title: "Strong matches to lead with",
      icon: "icon-check",
      links: linksFor(researchLinks, ["role", "alignment", "skills"]),
      items: items.map(item => [
        item.requirement || "Requirement",
        `Evidence: ${item.resumeEvidence || "Not available."}\nTalk track: ${item.talkTrack || "Not available."}`
      ])
    }
  ]);
}

function renderRoleNonAlignment(selector, items, researchLinks) {
  const container = document.querySelector(selector);
  container.replaceChildren();

  renderGroupedCards(container, [
    {
      title: "Gaps and risks to prepare",
      icon: "icon-alert",
      links: linksFor(researchLinks, ["gap", "risk", "interview", "role"]),
      items: items.map(item => [
        item.gap || "Gap",
        `Risk: ${item.risk || "Not available."}\nMitigation: ${item.mitigation || "Not available."}`
      ])
    }
  ]);
}

function renderHiringManager(selector, hiringManager, researchLinks) {
  const container = document.querySelector(selector);
  container.replaceChildren();

  renderGroupedCards(container, [
    {
      title: "Hiring Manager profile",
      icon: "icon-user",
      links: linksFor(researchLinks, ["hiring manager", "manager", "linkedin", "profile"]),
      items: [
        ["HM name", hiringManager.name],
        ["Current role", hiringManager.currentRole],
        ["Experience", hiringManager.experience],
        ["Background", hiringManager.background],
        ["Education", hiringManager.education],
        ["Passion & interest", hiringManager.passionsInterests],
        ["What to know before interview", hiringManager.interviewRelevance]
      ]
    }
  ]);
}

function renderPreparationFocus(selector, items, researchLinks) {
  const container = document.querySelector(selector);
  container.replaceChildren();

  const details = makeCardShell("Action checklist", "icon-list", true);
  const list = document.createElement("ul");
  list.className = "focus-list";

  items.forEach((item, index) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "todo-item";
    button.dataset.todo = String(index);
    button.setAttribute("aria-pressed", "false");
    button.append(makeIcon("icon-circle"));
    button.append(document.createTextNode(item));
    button.addEventListener("click", () => toggleTodo(button, index));
    li.append(button);
    list.append(li);
  });

  details.append(list);
  appendResearchLinks(details, linksFor(researchLinks, ["prep", "interview", "question", "role"]));
  container.append(details);
}

function renderGroupedCards(container, groups) {
  groups.forEach((group, index) => {
    const details = makeCardShell(group.title, group.icon, index === 0);
    const dl = document.createElement("dl");

    const items = group.items?.length ? group.items : [["No items", "No items returned."]];
    items.forEach(([label, value]) => {
      const div = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = value || "Not available.";
      div.append(dt, dd);
      dl.append(div);
    });

    details.append(dl);
    appendResearchLinks(details, group.links || []);
    container.append(details);
  });
}

function makeCardShell(title, iconName, open) {
  const details = document.createElement("details");
  details.className = "company-card";
  details.open = open;

  const summary = document.createElement("summary");
  summary.append(makeIcon(iconName));
  summary.append(document.createTextNode(title));
  details.append(summary);
  return details;
}

function makeIcon(name) {
  const icon = document.createElement("i");
  icon.className = `icon ${name}`;
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function appendResearchLinks(parent, links) {
  if (!links.length) return;

  const panel = document.createElement("div");
  panel.className = "research-links";
  const title = document.createElement("h4");
  title.textContent = "Further research";
  panel.append(title);

  links.slice(0, 4).forEach(link => {
    const anchor = document.createElement("a");
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.textContent = link.label;

    const why = document.createElement("span");
    why.textContent = link.why;

    const row = document.createElement("div");
    row.append(anchor, why);
    panel.append(row);
  });

  parent.append(panel);
}

function linksFor(links, keywords) {
  const selected = links.filter(link => {
    const text = `${link.section} ${link.label} ${link.why}`.toLowerCase();
    return keywords.some(keyword => text.includes(keyword));
  });
  return selected.length ? selected : links.slice(0, 2);
}

function listText(items) {
  if (!Array.isArray(items) || !items.length) return "Not available.";
  return items.join(" · ");
}

function setText(selector, value) {
  document.querySelector(selector).textContent = value;
}
