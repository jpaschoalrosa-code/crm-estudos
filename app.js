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
  authTabs: [...document.querySelectorAll(".auth-tab")],
  authPanels: [...document.querySelectorAll(".auth-panel")],
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
  usersList: document.querySelector("#users-list"),
  subjectForm: document.querySelector("#subject-form"),
  taskForm: document.querySelector("#task-form"),
  sessionForm: document.querySelector("#session-form"),
  subjectFormTitle: document.querySelector("#subject-form-title"),
  taskFormTitle: document.querySelector("#task-form-title"),
  sessionFormTitle: document.querySelector("#session-form-title"),
  subjectError: document.querySelector("#subject-error"),
  subjectCancel: document.querySelector("#subject-cancel"),
  taskCancel: document.querySelector("#task-cancel"),
  sessionCancel: document.querySelector("#session-cancel"),
  subjectsList: document.querySelector("#subjects-list"),
  tasksList: document.querySelector("#tasks-list"),
  sessionsList: document.querySelector("#sessions-list"),
  taskSubjectSelect: document.querySelector("#task-subject-select"),
  sessionSubjectSelect: document.querySelector("#session-subject-select"),
  subjectTemplate: document.querySelector("#subject-template"),
  taskTemplate: document.querySelector("#task-template"),
  sessionTemplate: document.querySelector("#session-template"),
  userTemplate: document.querySelector("#user-template"),
};

let cache = { subjects: [], tasks: [], sessions: [], users: [] };
let currentRole = "";

function formToJson(form) {
  const data = new FormData(form);
  return Object.fromEntries(data.entries());
}

function setActiveTab(tabName) {
  elements.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabName));
  elements.panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tabName));
}

function setLoggedIn(user) {
  currentRole = user.role;
  elements.userName.textContent = user.name;
  elements.userRole.textContent = `Cargo: ${user.role}`;
  elements.appShell.classList.toggle("admin-mode", user.role === "admin");
  elements.usersTab.classList.toggle("hidden", user.role !== "admin");
  elements.loginScreen.classList.add("hidden");
  elements.appShell.classList.remove("hidden");
}

function setLoggedOut() {
  currentRole = "";
  elements.appShell.classList.add("hidden");
  elements.appShell.classList.remove("admin-mode");
  elements.loginScreen.classList.remove("hidden");
  elements.userName.textContent = "";
  elements.userRole.textContent = "";
  elements.usersTab.classList.add("hidden");
  cache.users = [];
  setActiveTab("overview");
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

function resetForm(form, titleElement, baseTitle, cancelButton) {
  form.reset();
  form.elements.id.value = "";
  titleElement.textContent = baseTitle;
  cancelButton.classList.add("hidden");
  if (form === elements.subjectForm) {
    elements.subjectError.textContent = "";
  }
}

function fillForm(form, item) {
  Object.entries(item).forEach(([key, value]) => {
    if (form.elements[key]) {
      form.elements[key].value = value;
    }
  });
}

function badge(text) {
  const node = document.createElement("span");
  node.className = "badge";
  node.textContent = text;
  return node;
}

function subjectName(subjectId) {
  return cache.subjects.find((subject) => subject.id === subjectId)?.name || "Materia";
}

function fillSelect(select, subjects, selectedValue = "") {
  select.innerHTML = "";
  if (!subjects.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Cadastre uma materia primeiro";
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

function renderStats(summary) {
  const labels = [
    ["Materias", summary.subjects],
    ["Estudando", summary.studying],
    ["Para revisar", summary.review],
    ["Tarefas concluidas", summary.tasksDone],
    ["Horas estudadas", summary.hoursStudied],
  ];

  elements.stats.innerHTML = "";
  labels.forEach(([label, value]) => {
    const card = document.createElement("article");
    card.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    elements.stats.append(card);
  });
}

function renderOverview() {
  elements.overviewSubjects.innerHTML = "";
  elements.overviewTasks.innerHTML = "";

  const subjects = [...cache.subjects].sort((a, b) => a.nextReview.localeCompare(b.nextReview)).slice(0, 4);
  const tasks = [...cache.tasks]
    .filter((task) => task.status !== "concluida")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  if (!subjects.length) {
    elements.overviewSubjects.innerHTML = `<div class="empty">Cadastre materias para montar sua agenda.</div>`;
  } else {
    subjects.forEach((subject) => {
      const card = document.createElement("article");
      card.className = "card";
      card.innerHTML = `
        <h3>${subject.name}</h3>
        <p class="muted">${subject.goal}</p>
        <p>Revisao: ${subject.nextReview}</p>
      `;
      elements.overviewSubjects.append(card);
    });
  }

  if (!tasks.length) {
    elements.overviewTasks.innerHTML = `<div class="empty">Nenhuma tarefa em aberto agora.</div>`;
  } else {
    tasks.forEach((task) => {
      const card = document.createElement("article");
      card.className = "card";
      card.innerHTML = `
        <h3>${task.title}</h3>
        <p class="muted">${subjectName(task.subjectId)}</p>
        <p>Prazo: ${task.dueDate}</p>
      `;
      elements.overviewTasks.append(card);
    });
  }
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
    fragment.querySelector(".meta").textContent = `Criado em ${user.createdAt} | ${user.subjects} materias | ${user.tasks} tarefas | ${user.sessions} sessoes`;
    fragment.querySelector(".role-badge").textContent = user.role;
    elements.usersList.append(fragment);
  });
}

function renderSubjects(subjects) {
  elements.subjectsList.innerHTML = "";
  if (!subjects.length) {
    elements.subjectsList.innerHTML = `<div class="empty">Nenhuma materia cadastrada ainda.</div>`;
    return;
  }

  subjects.forEach((subject) => {
    const fragment = elements.subjectTemplate.content.cloneNode(true);
    fragment.querySelector("h3").textContent = subject.name;
    fragment.querySelector(".goal").textContent = subject.goal;
    fragment.querySelector(".notes").textContent = subject.notes;
    fragment.querySelector(".review-date").textContent = `Proxima revisao: ${subject.nextReview}`;
    fragment.querySelector(".progress-fill").style.width = `${subject.progress}%`;

    const badges = fragment.querySelector(".badges");
    badges.append(
      badge(`Status: ${subject.status}`),
      badge(`Prioridade: ${subject.priority}`),
      badge(`Progresso: ${subject.progress}%`)
    );

    fragment.querySelector(".edit-button").addEventListener("click", () => {
      fillForm(elements.subjectForm, subject);
      elements.subjectFormTitle.textContent = `Editando: ${subject.name}`;
      elements.subjectCancel.classList.remove("hidden");
      setActiveTab("subjects");
      elements.subjectForm.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    fragment.querySelector(".delete-button").addEventListener("click", async () => {
      await api.request(`/api/subjects/${subject.id}`, { method: "DELETE" });
      resetForm(elements.subjectForm, elements.subjectFormTitle, "Nova materia", elements.subjectCancel);
      await refresh();
    });

    elements.subjectsList.append(fragment);
  });
}

function renderTasks(tasks) {
  elements.tasksList.innerHTML = "";
  if (!tasks.length) {
    elements.tasksList.innerHTML = `<div class="empty">Nenhuma tarefa criada ainda.</div>`;
    return;
  }

  const ordered = [...tasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  ordered.forEach((task) => {
    const fragment = elements.taskTemplate.content.cloneNode(true);
    fragment.querySelector("h3").textContent = task.title;
    fragment.querySelector(".meta").textContent = `${subjectName(task.subjectId)} | ${task.status} | prazo ${task.dueDate}`;

    fragment.querySelector(".edit-button").addEventListener("click", () => {
      fillForm(elements.taskForm, { ...task, subjectId: String(task.subjectId) });
      fillSelect(elements.taskSubjectSelect, cache.subjects, task.subjectId);
      elements.taskFormTitle.textContent = `Editando: ${task.title}`;
      elements.taskCancel.classList.remove("hidden");
      setActiveTab("tasks");
      elements.taskForm.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    fragment.querySelector(".delete-button").addEventListener("click", async () => {
      await api.request(`/api/tasks/${task.id}`, { method: "DELETE" });
      resetForm(elements.taskForm, elements.taskFormTitle, "Nova tarefa", elements.taskCancel);
      fillSelect(elements.taskSubjectSelect, cache.subjects);
      await refresh();
    });

    elements.tasksList.append(fragment);
  });
}

function renderSessions(sessions) {
  elements.sessionsList.innerHTML = "";
  if (!sessions.length) {
    elements.sessionsList.innerHTML = `<div class="empty">Nenhuma sessao registrada ainda.</div>`;
    return;
  }

  const ordered = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  ordered.forEach((session) => {
    const fragment = elements.sessionTemplate.content.cloneNode(true);
    fragment.querySelector("h3").textContent = subjectName(session.subjectId);
    fragment.querySelector(".meta").textContent = `${session.date} | ${session.duration} min`;
    fragment.querySelector(".summary").textContent = session.summary;

    fragment.querySelector(".edit-button").addEventListener("click", () => {
      fillForm(elements.sessionForm, { ...session, subjectId: String(session.subjectId) });
      fillSelect(elements.sessionSubjectSelect, cache.subjects, session.subjectId);
      elements.sessionFormTitle.textContent = `Editando sessao de ${subjectName(session.subjectId)}`;
      elements.sessionCancel.classList.remove("hidden");
      setActiveTab("sessions");
      elements.sessionForm.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    fragment.querySelector(".delete-button").addEventListener("click", async () => {
      await api.request(`/api/sessions/${session.id}`, { method: "DELETE" });
      resetForm(elements.sessionForm, elements.sessionFormTitle, "Nova sessao", elements.sessionCancel);
      fillSelect(elements.sessionSubjectSelect, cache.subjects);
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
  cache = {
    subjects: dashboard.subjects,
    tasks: dashboard.tasks,
    sessions: dashboard.sessions,
    users: cache.users,
  };
  renderStats(dashboard.summary);
  renderOverview();
  renderSubjects(cache.subjects);
  renderTasks(cache.tasks);
  renderSessions(cache.sessions);
  renderUsers(cache.users);
  fillSelect(elements.taskSubjectSelect, cache.subjects, elements.taskForm.elements.subjectId.value);
  fillSelect(elements.sessionSubjectSelect, cache.subjects, elements.sessionForm.elements.subjectId.value);
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

elements.tabs.forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
});

elements.authTabs.forEach((tab) => {
  tab.addEventListener("click", () => setActiveAuthTab(tab.dataset.authTab));
});

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
    await refresh();
  } catch (error) {
    elements.registerError.textContent = error.message;
  }
});

elements.logoutButton.addEventListener("click", async () => {
  await api.send("/api/logout", "POST", {});
  setLoggedOut();
});

elements.themeToggle.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(currentTheme === "dark" ? "light" : "dark");
});

elements.subjectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.subjectError.textContent = "";
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
    await refresh();
  } catch (error) {
    elements.subjectError.textContent = error.message;
  }
});

elements.taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = formToJson(elements.taskForm);
  const method = payload.id ? "PUT" : "POST";
  const path = payload.id ? `/api/tasks/${payload.id}` : "/api/tasks";
  delete payload.id;
  await api.send(path, method, payload);
  resetForm(elements.taskForm, elements.taskFormTitle, "Nova tarefa", elements.taskCancel);
  fillSelect(elements.taskSubjectSelect, cache.subjects);
  await refresh();
});

elements.sessionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = formToJson(elements.sessionForm);
  const method = payload.id ? "PUT" : "POST";
  const path = payload.id ? `/api/sessions/${payload.id}` : "/api/sessions";
  delete payload.id;
  await api.send(path, method, payload);
  resetForm(elements.sessionForm, elements.sessionFormTitle, "Nova sessao", elements.sessionCancel);
  fillSelect(elements.sessionSubjectSelect, cache.subjects);
  await refresh();
});

elements.subjectCancel.addEventListener("click", () => {
  resetForm(elements.subjectForm, elements.subjectFormTitle, "Nova materia", elements.subjectCancel);
});

elements.taskCancel.addEventListener("click", () => {
  resetForm(elements.taskForm, elements.taskFormTitle, "Nova tarefa", elements.taskCancel);
  fillSelect(elements.taskSubjectSelect, cache.subjects);
});

elements.sessionCancel.addEventListener("click", () => {
  resetForm(elements.sessionForm, elements.sessionFormTitle, "Nova sessao", elements.sessionCancel);
  fillSelect(elements.sessionSubjectSelect, cache.subjects);
});

ensureSession().catch(() => {
  setLoggedOut();
});

applyTheme(localStorage.getItem("studycrm-theme"));
elements.registerRole.dispatchEvent(new Event("change"));
