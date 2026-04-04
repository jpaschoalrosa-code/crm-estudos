const api = {
  async request(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : null;

    if (!response.ok) {
      const error = new Error(payload?.error || "Erro ao processar a requisicao.");
      error.status = response.status;
      throw error;
    }

    return payload;
  },
  get(path) {
    return this.request(path);
  },
  send(path, method, payload) {
    return this.request(path, { method, body: JSON.stringify(payload) });
  },
};

const elements = {
  appShell: document.querySelector("#app-shell"),
  loginScreen: document.querySelector("#login-screen"),
  toastRegion: document.querySelector("#toast-region"),
  authTabs: [...document.querySelectorAll(".auth-tab")],
  authPanels: [...document.querySelectorAll(".auth-panel")],
  ambientSquares: document.querySelector("#ambient-squares"),
  loginForm: document.querySelector("#login-form"),
  registerForm: document.querySelector("#register-form"),
  registerRole: document.querySelector("#register-role"),
  adminCodeField: document.querySelector("#admin-code-field"),
  loginError: document.querySelector("#login-error"),
  registerError: document.querySelector("#register-error"),
  logoutButton: document.querySelector("#logout-button"),
  themeToggle: document.querySelector("#theme-toggle"),
  userName: document.querySelector("#user-name"),
  userRole: document.querySelector("#user-role"),
  stats: document.querySelector("#stats"),
  tabs: [...document.querySelectorAll(".tab")],
  panels: [...document.querySelectorAll(".tab-panel")],
  usersTab: document.querySelector("#users-tab"),
  overviewSubjects: document.querySelector("#overview-subjects"),
  overviewTasks: document.querySelector("#overview-tasks"),
  overviewAlerts: document.querySelector("#overview-alerts"),
  nextActionCard: document.querySelector("#next-action-card"),
  consistencyMetrics: document.querySelector("#consistency-metrics"),
  usersList: document.querySelector("#users-list"),
  userProfile: document.querySelector("#user-profile"),
  activitySummary: document.querySelector("#activity-summary"),
  activityLine: document.querySelector("#activity-line"),
  activityFill: document.querySelector("#activity-fill"),
  activityPoints: document.querySelector("#activity-points"),
  axisLabels: document.querySelector("#axis-labels"),
  subjectForm: document.querySelector("#subject-form"),
  taskForm: document.querySelector("#task-form"),
  sessionForm: document.querySelector("#session-form"),
  subjectFormTitle: document.querySelector("#subject-form-title"),
  taskFormTitle: document.querySelector("#task-form-title"),
  sessionFormTitle: document.querySelector("#session-form-title"),
  subjectError: document.querySelector("#subject-error"),
  taskError: document.querySelector("#task-error"),
  sessionError: document.querySelector("#session-error"),
  subjectCancel: document.querySelector("#subject-cancel"),
  taskCancel: document.querySelector("#task-cancel"),
  sessionCancel: document.querySelector("#session-cancel"),
  subjectsList: document.querySelector("#subjects-list"),
  tasksList: document.querySelector("#tasks-list"),
  sessionsList: document.querySelector("#sessions-list"),
  taskSubjectSelect: document.querySelector("#task-subject-select"),
  sessionSubjectSelect: document.querySelector("#session-subject-select"),
  subjectSearch: document.querySelector("#subject-search"),
  subjectStatusFilter: document.querySelector("#subject-status-filter"),
  subjectPriorityFilter: document.querySelector("#subject-priority-filter"),
  taskSearch: document.querySelector("#task-search"),
  taskStatusFilter: document.querySelector("#task-status-filter"),
  taskSubjectFilter: document.querySelector("#task-subject-filter"),
  sessionSearch: document.querySelector("#session-search"),
  sessionSubjectFilter: document.querySelector("#session-subject-filter"),
  sessionRecencyFilter: document.querySelector("#session-recency-filter"),
  durationChips: [...document.querySelectorAll(".duration-chip")],
  subjectTemplate: document.querySelector("#subject-template"),
  taskTemplate: document.querySelector("#task-template"),
  sessionTemplate: document.querySelector("#session-template"),
  userTemplate: document.querySelector("#user-template"),
};

let cache = { subjects: [], tasks: [], sessions: [], users: [] };
let currentRole = "";
let selectedUserProfileId = null;

function formToJson(form) {
  const data = new FormData(form);
  return Object.fromEntries(data.entries());
}

function getTodayLocal() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function toDateKey(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function parseDate(dateString) {
  return new Date(`${dateString}T12:00:00`);
}

function diffDays(fromDateString, toDateString = getTodayLocal()) {
  const from = parseDate(fromDateString);
  const to = parseDate(toDateString);
  return Math.round((from - to) / 86400000);
}

function formatDate(dateString) {
  if (!dateString) return "";
  return parseDate(dateString).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatShortDay(dateString) {
  return parseDate(dateString).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function randomBetween(min, max, decimals = 0) {
  const random = min + Math.random() * (max - min);
  return Number(random.toFixed(decimals));
}

function getAmbientSquareCount() {
  if (window.innerWidth < 720) return 10;
  if (window.innerWidth < 1100) return 14;
  return 18;
}

function renderAmbientSquares() {
  if (!elements.ambientSquares) return;

  const palette = [
    "var(--ambient-square-1)",
    "var(--ambient-square-2)",
    "var(--ambient-square-3)",
    "var(--ambient-square-4)",
  ];
  const fragment = document.createDocumentFragment();

  elements.ambientSquares.innerHTML = "";

  Array.from({ length: getAmbientSquareCount() }, (_, index) => {
    const square = document.createElement("span");
    square.className = "ambient-square";
    square.style.setProperty("--square-size", `${randomBetween(4.5, 13.5, 2)}rem`);
    square.style.setProperty("--square-left", `${randomBetween(-4, 96, 2)}vw`);
    square.style.setProperty("--square-top", `${randomBetween(-8, 92, 2)}vh`);
    square.style.setProperty("--square-rotate", `${randomBetween(0, 180)}deg`);
    square.style.setProperty("--square-scale", randomBetween(0.72, 1.38, 2));
    square.style.setProperty("--square-opacity", randomBetween(0.2, 0.46, 2));
    square.style.setProperty("--square-blur", `${randomBetween(0, 0.9, 2)}px`);
    square.style.setProperty("--square-color", palette[(index + Math.floor(Math.random() * palette.length)) % palette.length]);
    fragment.append(square);
  });

  elements.ambientSquares.append(fragment);
}

function setViewState(view) {
  document.body.dataset.view = view;
}

function setActiveTab(tabName) {
  elements.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabName));
  elements.panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tabName));
}

function focusTab(tabName) {
  setActiveTab(tabName);
  const panel = document.querySelector(`[data-panel="${tabName}"]`);
  panel?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearErrors() {
  elements.subjectError.textContent = "";
  elements.taskError.textContent = "";
  elements.sessionError.textContent = "";
}

function badge(text, className = "") {
  const node = document.createElement("span");
  node.className = `badge ${className}`.trim();
  node.textContent = text;
  return node;
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  elements.toastRegion.append(toast);
  window.setTimeout(() => toast.classList.add("visible"), 10);
  window.setTimeout(() => {
    toast.classList.remove("visible");
    window.setTimeout(() => toast.remove(), 240);
  }, 2800);
}

function subjectName(subjectId) {
  return cache.subjects.find((subject) => subject.id === Number(subjectId))?.name || "Materia";
}

function getSubjectSessions(subjectId) {
  return cache.sessions.filter((session) => Number(session.subjectId) === Number(subjectId));
}

function getLastSessionForSubject(subjectId) {
  return getSubjectSessions(subjectId).sort((a, b) => b.date.localeCompare(a.date))[0] || null;
}

function getOpenTasksForSubject(subjectId) {
  return cache.tasks.filter((task) => Number(task.subjectId) === Number(subjectId) && task.status !== "concluida");
}

function getSubjectInsights(subject) {
  const sessions = getSubjectSessions(subject.id);
  const totalMinutes = sessions.reduce((sum, session) => sum + Number(session.duration || 0), 0);
  const lastSession = getLastSessionForSubject(subject.id);
  return {
    totalMinutes,
    totalHours: (totalMinutes / 60).toFixed(totalMinutes % 60 === 0 ? 0 : 1),
    openTasks: getOpenTasksForSubject(subject.id).length,
    lastSessionDate: lastSession?.date || "",
  };
}

function setLoggedIn(user) {
  currentRole = user.role;
  elements.userName.textContent = user.name;
  elements.userRole.textContent = `Cargo: ${user.role}`;
  document.querySelector(".avatar-circle").textContent = (user.name || "P").charAt(0).toUpperCase();
  elements.appShell.classList.toggle("admin-mode", user.role === "admin");
  elements.usersTab.classList.toggle("hidden", user.role !== "admin");
  elements.loginScreen.classList.add("hidden");
  elements.appShell.classList.remove("hidden");
  setViewState("app");
}

function setLoggedOut() {
  currentRole = "";
  selectedUserProfileId = null;
  elements.appShell.classList.add("hidden");
  elements.appShell.classList.remove("admin-mode");
  elements.loginScreen.classList.remove("hidden");
  elements.userName.textContent = "";
  elements.userRole.textContent = "";
  elements.usersTab.classList.add("hidden");
  elements.userProfile.innerHTML = `<div class="empty">Escolha uma pessoa para ver o perfil.</div>`;
  cache = { subjects: [], tasks: [], sessions: [], users: [] };
  setActiveTab("overview");
  setViewState("login");
}

function applyTheme(theme) {
  const finalTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = finalTheme;
  localStorage.setItem("studycrm-theme", finalTheme);
  elements.themeToggle.textContent = finalTheme === "dark" ? "Modo claro" : "Modo escuro";
}

function setActiveAuthTab(tabName) {
  elements.authTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.authTab === tabName));
  elements.authPanels.forEach((panel) => panel.classList.toggle("active", panel.dataset.authPanel === tabName));
}

function setDefaultFormValues() {
  const today = getTodayLocal();
  if (!elements.subjectForm.elements.id.value && !elements.subjectForm.elements.nextReview.value) {
    elements.subjectForm.elements.nextReview.value = today;
  }
  if (!elements.taskForm.elements.id.value && !elements.taskForm.elements.dueDate.value) {
    elements.taskForm.elements.dueDate.value = today;
  }
  if (!elements.sessionForm.elements.id.value) {
    elements.sessionForm.elements.date.value = elements.sessionForm.elements.date.value || today;
    elements.sessionForm.elements.duration.value = elements.sessionForm.elements.duration.value || "50";
  }
}

function fillForm(form, item) {
  Object.entries(item).forEach(([key, value]) => {
    if (form.elements[key]) {
      form.elements[key].value = value;
    }
  });
}

function fillSelect(select, subjects, selectedValue = "", placeholder = "Cadastre uma materia primeiro") {
  select.innerHTML = "";
  if (!subjects.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = placeholder;
    select.append(option);
    return;
  }

  subjects.forEach((subject) => {
    const option = document.createElement("option");
    option.value = String(subject.id);
    option.textContent = subject.name;
    option.selected = String(subject.id) === String(selectedValue);
    select.append(option);
  });
}

function fillFilterSelect(select, subjects, selectedValue = "") {
  const firstOption = select.querySelector("option")?.cloneNode(true);
  select.innerHTML = "";
  if (firstOption) {
    select.append(firstOption);
  }
  subjects.forEach((subject) => {
    const option = document.createElement("option");
    option.value = String(subject.id);
    option.textContent = subject.name;
    option.selected = String(subject.id) === String(selectedValue);
    select.append(option);
  });
}

function syncFilterSelects() {
  fillSelect(elements.taskSubjectSelect, cache.subjects, elements.taskForm.elements.subjectId.value);
  fillSelect(elements.sessionSubjectSelect, cache.subjects, elements.sessionForm.elements.subjectId.value);
  fillFilterSelect(elements.taskSubjectFilter, cache.subjects, elements.taskSubjectFilter.value);
  fillFilterSelect(elements.sessionSubjectFilter, cache.subjects, elements.sessionSubjectFilter.value);
}

function suggestSessionSubject() {
  if (elements.sessionForm.elements.id.value || !cache.subjects.length) return;
  const latestSession = [...cache.sessions].sort((a, b) => b.date.localeCompare(a.date))[0];
  const suggested = latestSession?.subjectId || cache.subjects[0]?.id;
  if (suggested && !elements.sessionForm.elements.subjectId.value) {
    elements.sessionForm.elements.subjectId.value = String(suggested);
  }
}

function resetForm(form, titleElement, baseTitle, cancelButton) {
  form.reset();
  form.elements.id.value = "";
  titleElement.textContent = baseTitle;
  cancelButton.classList.add("hidden");
  clearErrors();
  setDefaultFormValues();
  syncFilterSelects();
  suggestSessionSubject();
}

function buildActivitySeries() {
  const today = new Date();
  const series = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = toDateKey(date);
    const minutes = cache.sessions
      .filter((session) => session.date === key)
      .reduce((sum, session) => sum + Number(session.duration || 0), 0);
    series.push({ key, label: formatShortDay(key), minutes });
  }
  return series;
}

function computeConsistencyMetrics() {
  const uniqueDays = [...new Set(cache.sessions.map((session) => session.date))].sort();
  let streak = 0;
  let cursor = parseDate(getTodayLocal());
  while (uniqueDays.includes(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const last7 = buildActivitySeries();
  const average = Math.round(last7.reduce((sum, item) => sum + item.minutes, 0) / last7.length);
  const subjectMinutes = cache.subjects.map((subject) => ({
    name: subject.name,
    minutes: getSubjectSessions(subject.id).reduce((sum, session) => sum + Number(session.duration || 0), 0),
  }));
  subjectMinutes.sort((a, b) => b.minutes - a.minutes);
  return {
    streak,
    average,
    topSubject: subjectMinutes[0]?.minutes ? `${subjectMinutes[0].name} (${subjectMinutes[0].minutes} min)` : "Sem destaque ainda",
    activeDays: uniqueDays.length,
  };
}

function renderStats(summary) {
  const metrics = computeConsistencyMetrics();
  const labels = [
    ["Materias", summary.subjects],
    ["Estudando", summary.studying],
    ["Para revisar", summary.review],
    ["Tarefas concluidas", summary.tasksDone],
    ["Sequencia", `${metrics.streak} dias`],
    ["Horas estudadas", summary.hoursStudied],
  ];

  elements.stats.innerHTML = "";
  labels.forEach(([label, value]) => {
    const card = document.createElement("article");
    card.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    elements.stats.append(card);
  });
}

function renderActivityChart() {
  const series = buildActivitySeries();
  const maxMinutes = Math.max(...series.map((item) => item.minutes), 60);
  const width = 640;
  const height = 300;
  const left = 18;
  const bottom = 24;
  const chartWidth = width - left * 2;
  const chartHeight = height - bottom - 18;
  const step = chartWidth / Math.max(series.length - 1, 1);

  const points = series.map((item, index) => {
    const x = left + step * index;
    const y = 18 + chartHeight - (item.minutes / maxMinutes) * chartHeight;
    return { ...item, x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const fillPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(18 + chartHeight).toFixed(2)} L ${points[0].x.toFixed(2)} ${(18 + chartHeight).toFixed(2)} Z`;

  elements.activityLine.setAttribute("d", linePath);
  elements.activityFill.setAttribute("d", fillPath);
  elements.activityPoints.innerHTML = points
    .map(
      (point) =>
        `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="4.5"></circle><text x="${point.x.toFixed(2)}" y="${(point.y - 10).toFixed(2)}">${point.minutes}</text>`
    )
    .join("");

  elements.axisLabels.innerHTML = series.map((item) => `<span>${item.label}</span>`).join("");
  const totalMinutes = series.reduce((sum, item) => sum + item.minutes, 0);
  elements.activitySummary.textContent = `Minutos estudados nos ultimos 7 dias: ${totalMinutes} min`;
}

function buildAlerts() {
  const alerts = [];
  const today = getTodayLocal();
  const overdueTasks = cache.tasks.filter((task) => task.status !== "concluida" && task.dueDate < today);
  overdueTasks.forEach((task) => {
    alerts.push({
      type: "danger",
      title: `Tarefa atrasada: ${task.title}`,
      copy: `${subjectName(task.subjectId)} | prazo em ${formatDate(task.dueDate)}`,
      tab: "tasks",
    });
  });

  cache.subjects.forEach((subject) => {
    const daysUntilReview = diffDays(subject.nextReview);
    const lastSession = getLastSessionForSubject(subject.id);
    const daysSinceLastStudy = lastSession ? -diffDays(lastSession.date) : null;

    if (daysUntilReview < 0) {
      alerts.push({ type: "danger", title: `Revisao vencida: ${subject.name}`, copy: `Venceu em ${formatDate(subject.nextReview)}`, tab: "subjects" });
    } else if (daysUntilReview === 0) {
      alerts.push({ type: "warning", title: `Revisao hoje: ${subject.name}`, copy: "Reserve um bloco curto para revisar esta materia.", tab: "subjects" });
    } else if (daysUntilReview === 1) {
      alerts.push({ type: "neutral", title: `Revisao amanha: ${subject.name}`, copy: "Adiante a agenda se quiser diminuir pressao.", tab: "subjects" });
    }

    if (subject.priority === "alta" && Number(subject.progress) < 30) {
      alerts.push({ type: "warning", title: "Prioridade alta com progresso baixo", copy: `${subject.name} esta em ${subject.progress}% de progresso.`, tab: "subjects" });
    }

    if (!lastSession || daysSinceLastStudy >= 7) {
      alerts.push({ type: "neutral", title: `Materia esfriando: ${subject.name}`, copy: lastSession ? `Ultimo estudo em ${formatDate(lastSession.date)}.` : "Ainda nao ha sessoes registradas.", tab: "sessions" });
    }
  });

  return alerts.slice(0, 6);
}

function buildNextAction() {
  const today = getTodayLocal();
  const overdueTask = [...cache.tasks]
    .filter((task) => task.status !== "concluida" && task.dueDate < today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  if (overdueTask) {
    return {
      badge: "Mais urgente",
      title: `Concluir ou replanejar "${overdueTask.title}"`,
      copy: `${subjectName(overdueTask.subjectId)} | prazo vencido em ${formatDate(overdueTask.dueDate)}`,
      actionLabel: "Abrir tarefas",
      tab: "tasks",
    };
  }

  const dueReview = [...cache.subjects].sort((a, b) => a.nextReview.localeCompare(b.nextReview))[0];
  if (dueReview) {
    const lastSession = getLastSessionForSubject(dueReview.id);
    return {
      badge: diffDays(dueReview.nextReview) <= 0 ? "Revisao em foco" : "Proximo passo",
      title: `Revisar ${dueReview.name}`,
      copy: `${diffDays(dueReview.nextReview) < 0 ? "Revisao atrasada" : `Revisao em ${formatDate(dueReview.nextReview)}`}${lastSession ? ` | ultima sessao em ${formatDate(lastSession.date)}` : ""}`,
      actionLabel: "Ir para materias",
      tab: "subjects",
    };
  }

  return {
    badge: "Comeco ideal",
    title: "Cadastre sua primeira materia",
    copy: "Monte uma base minima para o painel te orientar.",
    actionLabel: "Nova materia",
    tab: "subjects",
  };
}

function renderConsistency() {
  const metrics = computeConsistencyMetrics();
  elements.consistencyMetrics.innerHTML = `
    <div><span>Sequencia</span><strong>${metrics.streak} dias</strong></div>
    <div><span>Media diaria</span><strong>${metrics.average} min</strong></div>
    <div><span>Dias ativos</span><strong>${metrics.activeDays}</strong></div>
    <div><span>Destaque</span><strong>${escapeHtml(metrics.topSubject)}</strong></div>
  `;
}

function renderAlerts() {
  const alerts = buildAlerts();
  if (!alerts.length) {
    elements.overviewAlerts.innerHTML = `<div class="empty">Sem alertas criticos agora. Seu painel esta sob controle.</div>`;
    return;
  }

  elements.overviewAlerts.innerHTML = "";
  alerts.forEach((alert) => {
    const card = document.createElement("article");
    card.className = `card alert-card ${alert.type}`;
    card.innerHTML = `
      <h3>${escapeHtml(alert.title)}</h3>
      <p class="muted">${escapeHtml(alert.copy)}</p>
      <button class="small ghost">Ver agora</button>
    `;
    card.querySelector("button").addEventListener("click", () => focusTab(alert.tab));
    elements.overviewAlerts.append(card);
  });
}

function renderNextAction() {
  const action = buildNextAction();
  elements.nextActionCard.innerHTML = `
    <span class="badge focus-badge">${escapeHtml(action.badge)}</span>
    <h3>${escapeHtml(action.title)}</h3>
    <p class="muted">${escapeHtml(action.copy)}</p>
    <button>${escapeHtml(action.actionLabel)}</button>
  `;
  elements.nextActionCard.querySelector("button").addEventListener("click", () => focusTab(action.tab));
}

function renderOverview() {
  elements.overviewSubjects.innerHTML = "";
  elements.overviewTasks.innerHTML = "";
  renderNextAction();
  renderConsistency();
  renderAlerts();

  if (!cache.subjects.length && !cache.tasks.length && !cache.sessions.length) {
    elements.overviewSubjects.innerHTML = `
      <div class="empty onboarding-empty">
        <strong>Seu painel comeca aqui.</strong>
        <p>Cadastre uma materia, depois crie uma tarefa e registre a primeira sessao.</p>
        <div class="action-row">
          <button data-jump="subjects">Criar materia</button>
          <button data-jump="tasks" class="ghost">Criar tarefa</button>
          <button data-jump="sessions" class="ghost">Registrar sessao</button>
        </div>
      </div>
    `;
    elements.overviewSubjects.querySelectorAll("[data-jump]").forEach((button) => {
      button.addEventListener("click", () => focusTab(button.dataset.jump));
    });
    return;
  }

  const subjects = [...cache.subjects].sort((a, b) => a.nextReview.localeCompare(b.nextReview)).slice(0, 4);
  const tasks = [...cache.tasks].filter((task) => task.status !== "concluida").sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);

  elements.overviewSubjects.innerHTML = subjects.length ? "" : `<div class="empty">Cadastre materias para montar sua agenda.</div>`;
  subjects.forEach((subject) => {
    const insights = getSubjectInsights(subject);
    const reviewDiff = diffDays(subject.nextReview);
    const statusCopy = reviewDiff < 0 ? `Revisao atrasada desde ${formatDate(subject.nextReview)}` : reviewDiff === 0 ? "Revisao hoje" : `Proxima revisao: ${formatDate(subject.nextReview)}`;
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <h3>${escapeHtml(subject.name)}</h3>
      <p class="muted">${escapeHtml(subject.goal)}</p>
      <p>${statusCopy}</p>
      <small>${insights.openTasks} tarefas abertas | ${insights.totalHours}h registradas</small>
    `;
    elements.overviewSubjects.append(card);
  });

  elements.overviewTasks.innerHTML = tasks.length ? "" : `<div class="empty">Nenhuma tarefa em aberto agora.</div>`;
  tasks.forEach((task) => {
    const dueDiff = diffDays(task.dueDate);
    const urgency = dueDiff < 0 ? "Atrasada" : dueDiff === 0 ? "Vence hoje" : `Prazo: ${formatDate(task.dueDate)}`;
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <h3>${escapeHtml(task.title)}</h3>
      <p class="muted">${escapeHtml(subjectName(task.subjectId))}</p>
      <p>${urgency}</p>
    `;
    elements.overviewTasks.append(card);
  });
}

function getFilteredSubjects() {
  const query = elements.subjectSearch.value.trim().toLowerCase();
  const status = elements.subjectStatusFilter.value;
  const priority = elements.subjectPriorityFilter.value;
  return cache.subjects.filter((subject) => {
    const matchesQuery = !query || `${subject.name} ${subject.goal} ${subject.notes}`.toLowerCase().includes(query);
    const matchesStatus = !status || subject.status === status;
    const matchesPriority = !priority || subject.priority === priority;
    return matchesQuery && matchesStatus && matchesPriority;
  });
}

function getFilteredTasks() {
  const query = elements.taskSearch.value.trim().toLowerCase();
  const status = elements.taskStatusFilter.value;
  const subjectId = elements.taskSubjectFilter.value;
  return cache.tasks.filter((task) => {
    const matchesQuery = !query || task.title.toLowerCase().includes(query);
    const matchesStatus = !status || task.status === status;
    const matchesSubject = !subjectId || String(task.subjectId) === String(subjectId);
    return matchesQuery && matchesStatus && matchesSubject;
  });
}

function getFilteredSessions() {
  const query = elements.sessionSearch.value.trim().toLowerCase();
  const subjectId = elements.sessionSubjectFilter.value;
  const recency = Number(elements.sessionRecencyFilter.value || 0);
  return cache.sessions.filter((session) => {
    const matchesQuery = !query || session.summary.toLowerCase().includes(query) || subjectName(session.subjectId).toLowerCase().includes(query);
    const matchesSubject = !subjectId || String(session.subjectId) === String(subjectId);
    const matchesRecency = !recency || -diffDays(session.date) <= recency;
    return matchesQuery && matchesSubject && matchesRecency;
  });
}

async function quickUpdate(path, payload, message) {
  await api.send(path, "PUT", payload);
  showToast(message);
  await refresh();
}

function renderUsers(users) {
  elements.usersList.innerHTML = "";
  if (!users.length) {
    elements.usersList.innerHTML = `<div class="empty">Nenhuma pessoa cadastrada ainda.</div>`;
    return;
  }

  users.forEach((user) => {
    const fragment = elements.userTemplate.content.cloneNode(true);
    fragment.querySelector("h3").textContent = user.name;
    fragment.querySelector(".meta").textContent = `Criado em ${formatDate(user.createdAt.slice(0, 10))} | ${user.subjects} materias | ${user.tasks} tarefas | ${user.sessions} sessoes`;
    fragment.querySelector(".role-badge").textContent = user.role;
    fragment.querySelector(".view-button").addEventListener("click", async () => {
      selectedUserProfileId = user.id;
      await loadUserProfile(user.id);
      setActiveTab("users");
    });
    fragment.querySelector(".delete-button").addEventListener("click", async () => {
      const confirmed = window.confirm(`Deseja mesmo excluir a conta de ${user.name}? Essa acao apaga os dados da pessoa.`);
      if (!confirmed) return;
      try {
        await api.request(`/api/users/${user.id}`, { method: "DELETE" });
        if (selectedUserProfileId === user.id) {
          selectedUserProfileId = null;
          elements.userProfile.innerHTML = `<div class="empty">Escolha uma pessoa para ver o perfil.</div>`;
        }
        showToast("Conta removida.");
        await refresh();
      } catch (error) {
        window.alert(error.message);
      }
    });
    elements.usersList.append(fragment);
  });
}

async function loadUserProfile(userId) {
  try {
    const profile = await api.get(`/api/users/${userId}`);
    const profileSubjectName = (subjectId) => profile.subjects.find((subject) => subject.id === subjectId)?.name || "Materia";
    elements.userProfile.innerHTML = `
      <article class="card">
        <h3>${escapeHtml(profile.user.name)}</h3>
        <p class="muted">Cargo: ${escapeHtml(profile.user.role)} | Criado em ${formatDate(profile.user.createdAt.slice(0, 10))}</p>
        <div class="badges">
          <span class="badge">Materias: ${profile.summary.subjects}</span>
          <span class="badge">Estudando: ${profile.summary.studying}</span>
          <span class="badge">Revisar: ${profile.summary.review}</span>
          <span class="badge">Tarefas concluidas: ${profile.summary.tasksDone}</span>
          <span class="badge">Horas estudadas: ${profile.summary.hoursStudied}</span>
        </div>
      </article>
      <article class="card">
        <h3>Materias recentes</h3>
        ${profile.subjects.length ? profile.subjects.slice(0, 5).map((subject) => `<p>${escapeHtml(subject.name)} | ${escapeHtml(subject.status)} | ${subject.progress}%</p>`).join("") : '<p class="muted">Sem materias cadastradas.</p>'}
      </article>
      <article class="card">
        <h3>Tarefas recentes</h3>
        ${profile.tasks.length ? profile.tasks.slice(0, 5).map((task) => `<p>${escapeHtml(task.title)} | ${escapeHtml(task.status)} | ${formatDate(task.dueDate)}</p>`).join("") : '<p class="muted">Sem tarefas cadastradas.</p>'}
      </article>
      <article class="card">
        <h3>Sessoes recentes</h3>
        ${profile.sessions.length ? profile.sessions.slice(0, 5).map((session) => `<p>${formatDate(session.date)} | ${session.duration} min | ${escapeHtml(profileSubjectName(session.subjectId))}</p>`).join("") : '<p class="muted">Sem sessoes registradas.</p>'}
      </article>
    `;
  } catch (error) {
    elements.userProfile.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

function renderSubjects(subjects) {
  elements.subjectsList.innerHTML = "";
  if (!cache.subjects.length) {
    elements.subjectsList.innerHTML = `<div class="empty onboarding-empty"><strong>Nenhuma materia cadastrada ainda.</strong><p>Comece por uma materia principal para destravar tarefas e sessoes.</p><button data-jump="subjects">Cadastrar agora</button></div>`;
    elements.subjectsList.querySelector("[data-jump]")?.addEventListener("click", () => {
      elements.subjectForm.scrollIntoView({ behavior: "smooth", block: "start" });
      elements.subjectForm.elements.name.focus();
    });
    return;
  }
  if (!subjects.length) {
    elements.subjectsList.innerHTML = `<div class="empty">Nenhuma materia bate com os filtros atuais.</div>`;
    return;
  }

  subjects.forEach((subject) => {
    const fragment = elements.subjectTemplate.content.cloneNode(true);
    const insights = getSubjectInsights(subject);
    const reviewDiff = diffDays(subject.nextReview);
    const lastStudyCopy = insights.lastSessionDate ? `Ultimo estudo em ${formatDate(insights.lastSessionDate)}` : "Nenhuma sessao ainda";
    fragment.querySelector("h3").textContent = subject.name;
    fragment.querySelector(".goal").textContent = subject.goal;
    fragment.querySelector(".notes").textContent = subject.notes;
    fragment.querySelector(".review-date").textContent = `Proxima revisao: ${formatDate(subject.nextReview)}`;
    fragment.querySelector(".progress-fill").style.width = `${subject.progress}%`;
    fragment.querySelector(".subject-health").textContent = `${lastStudyCopy} | ${insights.openTasks} tarefas abertas | ${insights.totalHours}h estudadas`;

    const badges = fragment.querySelector(".badges");
    badges.append(badge(`Status: ${subject.status}`), badge(`Prioridade: ${subject.priority}`), badge(`Progresso: ${subject.progress}%`), reviewDiff < 0 ? badge("Revisao atrasada", "danger-badge") : reviewDiff === 0 ? badge("Revisao hoje", "warning-badge") : badge(`D-${reviewDiff} para revisar`, "neutral-badge"));
    if (subject.priority === "alta" && Number(subject.progress) < 30) badges.append(badge("Alta prioridade, acelere", "warning-badge"));
    if (!insights.lastSessionDate || -diffDays(insights.lastSessionDate) >= 7) badges.append(badge("Materia parada", "neutral-badge"));

    fragment.querySelector(".review-button").addEventListener("click", async () => {
      try {
        await quickUpdate(`/api/subjects/${subject.id}`, { nextReview: getTodayLocal(), status: subject.status === "nao comecei" ? "revisar" : subject.status }, "Revisao colocada para hoje.");
      } catch (error) {
        elements.subjectError.textContent = error.message;
      }
    });

    fragment.querySelector(".study-button").addEventListener("click", () => {
      resetForm(elements.sessionForm, elements.sessionFormTitle, "Nova sessao", elements.sessionCancel);
      elements.sessionForm.elements.subjectId.value = String(subject.id);
      elements.sessionForm.elements.summary.value = `Estudo de ${subject.name}: `;
      focusTab("sessions");
      elements.sessionForm.scrollIntoView({ behavior: "smooth", block: "start" });
      elements.sessionForm.elements.summary.focus();
    });

    fragment.querySelector(".edit-button").addEventListener("click", () => {
      fillForm(elements.subjectForm, subject);
      elements.subjectFormTitle.textContent = `Editando: ${subject.name}`;
      elements.subjectCancel.classList.remove("hidden");
      setActiveTab("subjects");
      elements.subjectForm.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    fragment.querySelector(".delete-button").addEventListener("click", async () => {
      const confirmed = window.confirm(`Excluir a materia "${subject.name}"? Tarefas e sessoes ligadas a ela tambem serao apagadas.`);
      if (!confirmed) return;
      await api.request(`/api/subjects/${subject.id}`, { method: "DELETE" });
      resetForm(elements.subjectForm, elements.subjectFormTitle, "Nova materia", elements.subjectCancel);
      showToast("Materia excluida.");
      await refresh();
    });

    elements.subjectsList.append(fragment);
  });
}

function renderTasks(tasks) {
  elements.tasksList.innerHTML = "";
  if (!cache.subjects.length) {
    elements.tasksList.innerHTML = `<div class="empty">Cadastre uma materia antes de criar tarefas.</div>`;
    return;
  }
  if (!cache.tasks.length) {
    elements.tasksList.innerHTML = `<div class="empty onboarding-empty"><strong>Nenhuma tarefa criada ainda.</strong><p>Transforme materias em proximos passos com prazos simples.</p><button data-jump="tasks">Criar tarefa</button></div>`;
    elements.tasksList.querySelector("[data-jump]")?.addEventListener("click", () => {
      elements.taskForm.scrollIntoView({ behavior: "smooth", block: "start" });
      elements.taskForm.elements.title.focus();
    });
    return;
  }
  if (!tasks.length) {
    elements.tasksList.innerHTML = `<div class="empty">Nenhuma tarefa bate com os filtros atuais.</div>`;
    return;
  }

  [...tasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).forEach((task) => {
    const fragment = elements.taskTemplate.content.cloneNode(true);
    const dueDiff = diffDays(task.dueDate);
    const metaPieces = [subjectName(task.subjectId), task.status, dueDiff < 0 ? `atrasada desde ${formatDate(task.dueDate)}` : dueDiff === 0 ? "vence hoje" : `prazo ${formatDate(task.dueDate)}`];
    fragment.querySelector("h3").textContent = task.title;
    fragment.querySelector(".meta").textContent = metaPieces.join(" | ");
    fragment.querySelector(".done-button").classList.toggle("hidden", task.status === "concluida");

    fragment.querySelector(".done-button").addEventListener("click", async () => {
      try {
        await quickUpdate(`/api/tasks/${task.id}`, { status: "concluida" }, "Tarefa concluida.");
      } catch (error) {
        elements.taskError.textContent = error.message;
      }
    });

    fragment.querySelector(".edit-button").addEventListener("click", () => {
      fillForm(elements.taskForm, { ...task, subjectId: String(task.subjectId) });
      fillSelect(elements.taskSubjectSelect, cache.subjects, task.subjectId);
      elements.taskFormTitle.textContent = `Editando: ${task.title}`;
      elements.taskCancel.classList.remove("hidden");
      setActiveTab("tasks");
      elements.taskForm.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    fragment.querySelector(".delete-button").addEventListener("click", async () => {
      const confirmed = window.confirm(`Excluir a tarefa "${task.title}"?`);
      if (!confirmed) return;
      await api.request(`/api/tasks/${task.id}`, { method: "DELETE" });
      resetForm(elements.taskForm, elements.taskFormTitle, "Nova tarefa", elements.taskCancel);
      showToast("Tarefa excluida.");
      await refresh();
    });

    elements.tasksList.append(fragment);
  });
}

function renderSessions(sessions) {
  elements.sessionsList.innerHTML = "";
  if (!cache.subjects.length) {
    elements.sessionsList.innerHTML = `<div class="empty">Cadastre uma materia antes de registrar sessoes.</div>`;
    return;
  }
  if (!cache.sessions.length) {
    elements.sessionsList.innerHTML = `<div class="empty onboarding-empty"><strong>Nenhuma sessao registrada ainda.</strong><p>Registrar sessoes ajuda o painel a mostrar consistencia e prioridades.</p><button data-jump="sessions">Registrar sessao</button></div>`;
    elements.sessionsList.querySelector("[data-jump]")?.addEventListener("click", () => {
      elements.sessionForm.scrollIntoView({ behavior: "smooth", block: "start" });
      elements.sessionForm.elements.summary.focus();
    });
    return;
  }
  if (!sessions.length) {
    elements.sessionsList.innerHTML = `<div class="empty">Nenhuma sessao bate com os filtros atuais.</div>`;
    return;
  }

  [...sessions].sort((a, b) => b.date.localeCompare(a.date)).forEach((session) => {
    const fragment = elements.sessionTemplate.content.cloneNode(true);
    fragment.querySelector("h3").textContent = subjectName(session.subjectId);
    fragment.querySelector(".meta").textContent = `${formatDate(session.date)} | ${session.duration} min`;
    fragment.querySelector(".summary").textContent = session.summary;

    fragment.querySelector(".duplicate-button").addEventListener("click", async () => {
      try {
        await api.send("/api/sessions", "POST", {
          subjectId: session.subjectId,
          date: getTodayLocal(),
          duration: session.duration,
          summary: session.summary,
        });
        showToast("Sessao duplicada para hoje.");
        await refresh();
      } catch (error) {
        elements.sessionError.textContent = error.message;
      }
    });

    fragment.querySelector(".edit-button").addEventListener("click", () => {
      fillForm(elements.sessionForm, { ...session, subjectId: String(session.subjectId) });
      fillSelect(elements.sessionSubjectSelect, cache.subjects, session.subjectId);
      elements.sessionFormTitle.textContent = `Editando sessao de ${subjectName(session.subjectId)}`;
      elements.sessionCancel.classList.remove("hidden");
      setActiveTab("sessions");
      elements.sessionForm.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    fragment.querySelector(".delete-button").addEventListener("click", async () => {
      const confirmed = window.confirm(`Excluir a sessao de ${subjectName(session.subjectId)} em ${formatDate(session.date)}?`);
      if (!confirmed) return;
      await api.request(`/api/sessions/${session.id}`, { method: "DELETE" });
      resetForm(elements.sessionForm, elements.sessionFormTitle, "Nova sessao", elements.sessionCancel);
      showToast("Sessao excluida.");
      await refresh();
    });

    elements.sessionsList.append(fragment);
  });
}

async function refresh() {
  if (currentRole === "admin") {
    cache.users = await api.get("/api/users");
  }
  const dashboard = await api.get("/api/dashboard");
  cache = { subjects: dashboard.subjects, tasks: dashboard.tasks, sessions: dashboard.sessions, users: cache.users };
  renderStats(dashboard.summary);
  renderActivityChart();
  renderOverview();
  syncFilterSelects();
  renderSubjects(getFilteredSubjects());
  renderTasks(getFilteredTasks());
  renderSessions(getFilteredSessions());
  renderUsers(cache.users);
  if (currentRole === "admin" && selectedUserProfileId) {
    await loadUserProfile(selectedUserProfileId);
  }
  setDefaultFormValues();
  suggestSessionSubject();
}

async function ensureSession() {
  const session = await api.get("/api/session");
  if (!session.authenticated) {
    setLoggedOut();
    return;
  }
  setLoggedIn(session.user);
  if (session.user.role === "admin") {
    cache.users = await api.get("/api/users");
  }
  await refresh();
}

elements.tabs.forEach((tab) => tab.addEventListener("click", () => setActiveTab(tab.dataset.tab)));
elements.authTabs.forEach((tab) => tab.addEventListener("click", () => setActiveAuthTab(tab.dataset.authTab)));

elements.registerRole.addEventListener("change", () => {
  const isAdmin = elements.registerRole.value === "admin";
  elements.adminCodeField.classList.toggle("hidden", !isAdmin);
  elements.adminCodeField.required = isAdmin;
  if (!isAdmin) {
    elements.adminCodeField.value = "";
  }
});

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.loginError.textContent = "";
  elements.registerError.textContent = "";
  try {
    const result = await api.send("/api/login", "POST", formToJson(elements.loginForm));
    setLoggedIn(result.user);
    cache.users = result.user.role === "admin" ? await api.get("/api/users") : [];
    showToast("Login realizado.");
    await refresh();
  } catch (error) {
    elements.loginError.textContent = error.message;
  }
});

elements.registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.registerError.textContent = "";
  elements.loginError.textContent = "";
  try {
    const result = await api.send("/api/register", "POST", formToJson(elements.registerForm));
    setLoggedIn(result.user);
    cache.users = result.user.role === "admin" ? await api.get("/api/users") : [];
    showToast("Conta criada com sucesso.");
    await refresh();
  } catch (error) {
    elements.registerError.textContent = error.message;
  }
});

elements.logoutButton.addEventListener("click", async () => {
  await api.send("/api/logout", "POST", {});
  setLoggedOut();
  showToast("Sessao encerrada.");
});

elements.themeToggle.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(currentTheme === "dark" ? "light" : "dark");
});

elements.subjectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearErrors();
  const payload = formToJson(elements.subjectForm);
  const progress = Number(payload.progress);
  const requestedStatus = payload.status;
  if (requestedStatus === "concluido" && progress !== 100) {
    elements.subjectError.textContent = "Uma materia so pode ser concluida com 100% de progresso.";
    return;
  }
  if (progress === 100 && requestedStatus !== "concluido") {
    const confirmDone = window.confirm("Essa materia chegou em 100%. Deseja marcar como concluida agora?");
    if (confirmDone) {
      payload.status = "concluido";
    }
  }
  const method = payload.id ? "PUT" : "POST";
  const path = payload.id ? `/api/subjects/${payload.id}` : "/api/subjects";
  delete payload.id;
  try {
    await api.send(path, method, payload);
    resetForm(elements.subjectForm, elements.subjectFormTitle, "Nova materia", elements.subjectCancel);
    showToast(method === "POST" ? "Materia criada." : "Materia atualizada.");
    await refresh();
  } catch (error) {
    elements.subjectError.textContent = error.message;
  }
});

elements.taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearErrors();
  const payload = formToJson(elements.taskForm);
  const method = payload.id ? "PUT" : "POST";
  const path = payload.id ? `/api/tasks/${payload.id}` : "/api/tasks";
  delete payload.id;
  try {
    await api.send(path, method, payload);
    resetForm(elements.taskForm, elements.taskFormTitle, "Nova tarefa", elements.taskCancel);
    showToast(method === "POST" ? "Tarefa criada." : "Tarefa atualizada.");
    await refresh();
  } catch (error) {
    elements.taskError.textContent = error.message;
  }
});

elements.sessionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearErrors();
  const payload = formToJson(elements.sessionForm);
  const method = payload.id ? "PUT" : "POST";
  const path = payload.id ? `/api/sessions/${payload.id}` : "/api/sessions";
  delete payload.id;
  try {
    await api.send(path, method, payload);
    resetForm(elements.sessionForm, elements.sessionFormTitle, "Nova sessao", elements.sessionCancel);
    showToast(method === "POST" ? "Sessao registrada." : "Sessao atualizada.");
    await refresh();
  } catch (error) {
    elements.sessionError.textContent = error.message;
  }
});

elements.subjectCancel.addEventListener("click", () => {
  resetForm(elements.subjectForm, elements.subjectFormTitle, "Nova materia", elements.subjectCancel);
});

elements.taskCancel.addEventListener("click", () => {
  resetForm(elements.taskForm, elements.taskFormTitle, "Nova tarefa", elements.taskCancel);
});

elements.sessionCancel.addEventListener("click", () => {
  resetForm(elements.sessionForm, elements.sessionFormTitle, "Nova sessao", elements.sessionCancel);
});

[elements.subjectSearch, elements.subjectStatusFilter, elements.subjectPriorityFilter].forEach((control) => {
  control.addEventListener("input", () => renderSubjects(getFilteredSubjects()));
  control.addEventListener("change", () => renderSubjects(getFilteredSubjects()));
});

[elements.taskSearch, elements.taskStatusFilter, elements.taskSubjectFilter].forEach((control) => {
  control.addEventListener("input", () => renderTasks(getFilteredTasks()));
  control.addEventListener("change", () => renderTasks(getFilteredTasks()));
});

[elements.sessionSearch, elements.sessionSubjectFilter, elements.sessionRecencyFilter].forEach((control) => {
  control.addEventListener("input", () => renderSessions(getFilteredSessions()));
  control.addEventListener("change", () => renderSessions(getFilteredSessions()));
});

elements.durationChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    elements.sessionForm.elements.duration.value = chip.dataset.duration;
  });
});

let ambientSquaresResizeTimer;

window.addEventListener("resize", () => {
  window.clearTimeout(ambientSquaresResizeTimer);
  ambientSquaresResizeTimer = window.setTimeout(renderAmbientSquares, 140);
});

applyTheme(localStorage.getItem("studycrm-theme"));
setViewState("login");
renderAmbientSquares();
ensureSession().catch(() => {
  setLoggedOut();
});
elements.registerRole.dispatchEvent(new Event("change"));
setDefaultFormValues();
