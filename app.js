"use strict";

(() => {
  const LOCAL_STORAGE_KEY = "vistula-task-manager.tasks.v1";
  const elements = {
    form: document.getElementById("task-form"),
    title: document.getElementById("task-title"),
    description: document.getElementById("task-description"),
    submit: document.getElementById("task-submit"),
    cancel: document.getElementById("task-cancel"),
    formHeading: document.getElementById("form-heading"),
    list: document.getElementById("task-list"),
    count: document.getElementById("task-count"),
    status: document.getElementById("status-message"),
    studentId: document.getElementById("student-id")
  };

  const state = {
    tasks: [],
    config: null,
    mode: "local",
    editingId: null,
    loadFailed: false
  };

  function setStatus(message, kind = "info") {
    elements.status.textContent = message;
    elements.status.dataset.kind = kind;
  }

  function escapeId(id) {
    return encodeURIComponent(String(id));
  }

  function hasRemoteConfig(config) {
    if (!config || typeof config.supabaseUrl !== "string" || typeof config.supabasePublishableKey !== "string") {
      return false;
    }

    const url = config.supabaseUrl.trim();
    const key = config.supabasePublishableKey.trim();
    const table = typeof config.tableName === "string" ? config.tableName.trim() : "";

    if (!url || !key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) return false;

    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:";
    } catch {
      return false;
    }
  }

  async function readConfig() {
    const response = await fetch("config.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function localTasks() {
    try {
      const value = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!value) return [];
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveLocalTasks(tasks) {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
    state.tasks = tasks;
  }

  function apiUrl(query = "") {
    const base = state.config.supabaseUrl.trim().replace(/\/+$/, "");
    const table = encodeURIComponent(state.config.tableName.trim());
    return `${base}/rest/v1/${table}${query}`;
  }

  async function supabaseRequest(method, query = "", body) {
    const headers = {
      apikey: state.config.supabasePublishableKey.trim(),
      Authorization: `Bearer ${state.config.supabasePublishableKey.trim()}`
    };

    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (method === "POST" || method === "PATCH") headers.Prefer = "return=representation";

    let response;
    try {
      response = await fetch(apiUrl(query), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch {
      throw new Error("Could not reach Supabase. Check your connection and project URL.");
    }

    if (!response.ok) {
      const detail = (await response.text()).trim();
      const shortDetail = detail.length > 220 ? `${detail.slice(0, 220)}…` : detail;
      throw new Error(`Supabase returned error ${response.status}${shortDetail ? `: ${shortDetail}` : "."}`);
    }

    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function fetchRemoteTasks() {
    const records = await supabaseRequest("GET", "?select=*&order=id.asc");
    if (!Array.isArray(records)) throw new Error("Supabase returned an unexpected task list.");
    state.tasks = records;
  }

  function sameId(left, right) {
    return String(left) === String(right);
  }

  function makeButton(label, className, action, taskId) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `button button-small ${className}`.trim();
    button.textContent = label;
    button.dataset.action = action;
    button.dataset.id = String(taskId);
    return button;
  }

  function render() {
    elements.list.replaceChildren();
    elements.count.textContent = String(state.tasks.length);

    if (state.loadFailed) {
      const error = document.createElement("p");
      error.className = "empty-state";
      error.textContent = "Tasks could not be loaded. Fix the connection and refresh the page.";
      elements.list.append(error);
      return;
    }

    if (state.tasks.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No tasks yet. Add your first task above.";
      elements.list.append(empty);
      return;
    }

    for (const task of state.tasks) {
      const item = document.createElement("article");
      item.className = `task-item${task.completed ? " is-complete" : ""}`;
      item.dataset.id = String(task.id);

      const topLine = document.createElement("div");
      topLine.className = "task-topline";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "task-check";
      checkbox.checked = Boolean(task.completed);
      checkbox.setAttribute("aria-label", task.completed ? "Mark task as incomplete" : "Mark task as complete");
      checkbox.dataset.action = "toggle";
      checkbox.dataset.id = String(task.id);

      const content = document.createElement("div");
      content.className = "task-content";
      const title = document.createElement("h3");
      title.className = "task-title";
      title.textContent = task.title || "Untitled task";
      content.append(title);

      if (task.description) {
        const description = document.createElement("p");
        description.className = "task-description";
        description.textContent = task.description;
        content.append(description);
      }

      topLine.append(checkbox, content);

      const actions = document.createElement("div");
      actions.className = "task-actions";
      actions.append(
        makeButton("Edit", "button-secondary", "edit", task.id),
        makeButton("Delete", "button-danger", "delete", task.id)
      );

      item.append(topLine, actions);
      elements.list.append(item);
    }
  }

  function resetForm() {
    state.editingId = null;
    elements.form.reset();
    elements.formHeading.textContent = "New task";
    elements.submit.textContent = "Add task";
    elements.cancel.hidden = true;
  }

  function startEditing(task) {
    state.editingId = task.id;
    elements.title.value = task.title || "";
    elements.description.value = task.description || "";
    elements.formHeading.textContent = "Edit task";
    elements.submit.textContent = "Save changes";
    elements.cancel.hidden = false;
    elements.title.focus();
  }

  async function reloadRemoteTasks() {
    await fetchRemoteTasks();
    state.loadFailed = false;
    render();
  }

  async function submitTask(event) {
    event.preventDefault();
    const title = elements.title.value.trim();
    const description = elements.description.value.trim();
    if (!title) {
      elements.title.focus();
      return;
    }

    const editingId = state.editingId;
    const values = { title, description };
    elements.submit.disabled = true;
    elements.cancel.disabled = true;

    try {
      if (state.mode === "remote") {
        if (editingId === null) {
          await supabaseRequest("POST", "", { ...values, completed: false });
          await reloadRemoteTasks();
          setStatus("Task added.", "success");
        } else {
          await supabaseRequest("PATCH", `?id=eq.${escapeId(editingId)}`, values);
          await reloadRemoteTasks();
          setStatus("Changes saved.", "success");
        }
      } else if (editingId === null) {
        const nextTask = { id: String(Date.now()), ...values, completed: false };
        saveLocalTasks([...state.tasks, nextTask]);
        render();
        setStatus("Task added to your local list.", "success");
      } else {
        const nextTasks = state.tasks.map(task => sameId(task.id, editingId) ? { ...task, ...values } : task);
        saveLocalTasks(nextTasks);
        render();
        setStatus("Changes saved locally.", "success");
      }

      resetForm();
    } catch (error) {
      setStatus(error.message || "Could not save the task.", "error");
    } finally {
      elements.submit.disabled = false;
      elements.cancel.disabled = false;
    }
  }

  async function toggleTask(taskId, checkbox) {
    const task = state.tasks.find(item => sameId(item.id, taskId));
    if (!task) return;

    checkbox.disabled = true;
    const completed = checkbox.checked;
    try {
      if (state.mode === "remote") {
        await supabaseRequest("PATCH", `?id=eq.${escapeId(taskId)}`, { completed });
        state.tasks = state.tasks.map(item => sameId(item.id, taskId) ? { ...item, completed } : item);
      } else {
        const nextTasks = state.tasks.map(item => sameId(item.id, taskId) ? { ...item, completed } : item);
        saveLocalTasks(nextTasks);
      }
      render();
      setStatus(completed ? "Task marked as complete." : "Task marked as incomplete.", "success");
    } catch (error) {
      checkbox.checked = Boolean(task.completed);
      checkbox.disabled = false;
      setStatus(error.message || "Could not update the task status.", "error");
    }
  }

  async function deleteTask(taskId) {
    const task = state.tasks.find(item => sameId(item.id, taskId));
    if (!task) return;

    try {
      if (state.mode === "remote") {
        await supabaseRequest("DELETE", `?id=eq.${escapeId(taskId)}`);
        state.tasks = state.tasks.filter(item => !sameId(item.id, taskId));
      } else {
        saveLocalTasks(state.tasks.filter(item => !sameId(item.id, taskId)));
      }

      if (sameId(state.editingId, taskId)) resetForm();
      render();
      setStatus("Task deleted.", "success");
    } catch (error) {
      setStatus(error.message || "Could not delete the task.", "error");
    }
  }

  elements.form.addEventListener("submit", submitTask);
  elements.cancel.addEventListener("click", resetForm);

  elements.list.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const task = state.tasks.find(item => sameId(item.id, button.dataset.id));
    if (!task) return;
    if (button.dataset.action === "edit") startEditing(task);
    if (button.dataset.action === "delete") deleteTask(task.id);
  });

  elements.list.addEventListener("change", event => {
    if (event.target.matches('input[data-action="toggle"]')) {
      toggleTask(event.target.dataset.id, event.target);
    }
  });

  async function start() {
    let config;
    try {
      config = await readConfig();
    } catch {
      config = {};
      setStatus("Could not read config.json. Start the app with a local web server.", "error");
    }

    state.config = config;
    if (config.studentId && config.studentId !== "STUDENT_ID") {
      elements.studentId.textContent = config.studentId;
    }

    if (hasRemoteConfig(config)) {
      state.mode = "remote";
      setStatus("Loading tasks from Supabase…");
      try {
        await reloadRemoteTasks();
        setStatus("Tasks loaded from Supabase.");
      } catch (error) {
        state.loadFailed = true;
        render();
        setStatus(error.message || "Could not load tasks from Supabase.", "error");
      }
      return;
    }

    state.mode = "local";
    state.tasks = localTasks();
    render();
    if (config.supabaseUrl || config.supabasePublishableKey) {
      setStatus("Add your project URL and public API key to config.json to connect. Local mode is active.");
    } else {
      setStatus("Local mode: tasks are saved in this browser. Supabase is not connected yet.");
    }
  }

  start();
})();
