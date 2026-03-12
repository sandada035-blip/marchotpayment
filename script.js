const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbxYV5gn8h2Z9pf_Y2P406YV2hTw0lglZL-I5KTTpVGpECnbj7-7wgLWp7LQzU4hdg6Adw/exec";

const state = {
  token: localStorage.getItem("token") || "",
  role: localStorage.getItem("role") || "",
  username: localStorage.getItem("username") || "",
  records: [],
  teachers: [],
  summary: {
    recordCount: 0,
    teacherCount: 0,
    total80: 0,
    total20: 0
  },
  editingRecordId: null
};

function $(id) {
  return document.getElementById(id);
}

function getApiUrl() {
  return localStorage.getItem("apiUrl") || DEFAULT_API_URL;
}

function setApiUrl(url) {
  localStorage.setItem("apiUrl", url);
}

function setApiStatus(text, ok = false) {
  const el = $("apiStatus");
  if (!el) return;
  el.textContent = `API: ${text}`;
  el.style.color = ok ? "#86efac" : "#fca5a5";
}

function setError(message = "") {
  const el = $("errorText");
  if (!el) return;
  el.textContent = message;
}

function formatKHR(value) {
  return `${Number(value || 0).toLocaleString()} KHR`;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showLoginPanel() {
  $("loginPanel")?.classList.remove("hidden");
  $("appPanel")?.classList.add("hidden");
}

function showAppPanel() {
  $("loginPanel")?.classList.add("hidden");
  $("appPanel")?.classList.remove("hidden");
}

function saveSession(data) {
  localStorage.setItem("token", data.token || "");
  localStorage.setItem("role", data.role || "");
  localStorage.setItem("username", data.username || "");

  state.token = data.token || "";
  state.role = data.role || "";
  state.username = data.username || "";
}

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("username");

  state.token = "";
  state.role = "";
  state.username = "";
}

function renderUserInfo() {
  $("roleText").textContent = state.role || "-";
  $("userText").textContent = state.username || "-";
}

function syncApiInputs() {
  const url = getApiUrl();
  if ($("apiUrl")) $("apiUrl").value = url;
  if ($("apiUrlSettings")) $("apiUrlSettings").value = url;
}

function saveApiUrlFromInput(inputId) {
  const input = $(inputId);
  const url = input?.value?.trim() || "";

  if (!url) {
    alert("សូមបញ្ចូល API URL");
    return false;
  }

  setApiUrl(url);
  syncApiInputs();
  alert("រក្សាទុក URL បានហើយ");
  return true;
}

async function testApiWithUrl(url) {
  try {
    const res = await fetch(`${url}?action=ping&_ts=${Date.now()}`, {
      method: "GET",
      cache: "no-store"
    });

    const data = await res.json();
    return !!data.success;
  } catch (err) {
    console.error("testApiWithUrl error:", err);
    return false;
  }
}

async function testApi(inputId = "apiUrl") {
  const input = $(inputId);
  const url = input?.value?.trim() || getApiUrl();

  if (!url) {
    alert("សូមបញ្ចូល API URL");
    return false;
  }

  setApiStatus("Loading...", true);
  const ok = await testApiWithUrl(url);

  if (ok) {
    setApiUrl(url);
    syncApiInputs();
    setApiStatus("Connected", true);
    setError("");
    alert("API Connected");
    return true;
  }

  setApiStatus("Error", false);
  setError("មិនអាចភ្ជាប់ API បានទេ");
  alert("API មិនទាន់ភ្ជាប់បានទេ");
  return false;
}

async function apiGet(action, extra = {}) {
  const url = getApiUrl();
  const params = new URLSearchParams({
    action,
    token: state.token,
    _ts: String(Date.now()),
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)]))
  });

  const res = await fetch(`${url}?${params.toString()}`, {
    method: "GET",
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json();
}

async function apiPost(action, payload = {}) {
  const url = getApiUrl();

  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action,
      token: state.token,
      payload
    })
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json();
}

async function login() {
  const username = $("username")?.value?.trim() || "";
  const password = $("password")?.value?.trim() || "";
  const apiUrl = $("apiUrl")?.value?.trim() || getApiUrl();

  if (!apiUrl) {
    alert("សូមបញ្ចូល API URL ជាមុនសិន");
    return;
  }

  if (!username || !password) {
    alert("សូមបញ្ចូល Username និង Password");
    return;
  }

  setApiUrl(apiUrl);
  syncApiInputs();

  const apiOk = await testApiWithUrl(apiUrl);
  if (!apiOk) {
    setApiStatus("Error", false);
    alert("API URL មិនត្រឹមត្រូវ ឬមិនទាន់ deploy");
    return;
  }

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "login",
        payload: { username, password }
      })
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Login មិនជោគជ័យ");
      return;
    }

    saveSession(data);
    renderUserInfo();
    showAppPanel();
    setApiStatus("Connected", true);
    setError("");
    clearForm();
    await loadDashboard();
    alert("Login ជោគជ័យ");
  } catch (err) {
    console.error("login error:", err);
    setApiStatus("Error", false);
    setError("មិនអាច Login បានទេ");
    alert("មិនអាច Login បានទេ");
  }
}

async function logout() {
  try {
    if (state.token) {
      await apiPost("logout", {});
    }
  } catch (err) {
    console.warn("logout error:", err);
  }

  clearSession();
  renderUserInfo();
  showLoginPanel();
  setError("");
  clearForm();
}

function switchView(viewId) {
  document.querySelectorAll(".view-section").forEach((section) => {
    section.classList.add("hidden");
  });

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  $(viewId)?.classList.remove("hidden");

  const activeBtn = document.querySelector(`[data-view="${viewId}"]`);
  if (activeBtn) activeBtn.classList.add("active");

  const titles = {
    dashboardView: "Dashboard",
    formView: "បញ្ចូលសិស្ស",
    tableView: "តារាងកែតម្រូវ",
    settingsView: "Settings"
  };

  $("pageTitle").textContent = titles[viewId] || "Dashboard";
}

function renderSummary() {
  $("studentCount").textContent = state.summary.recordCount || 0;
  $("teacherCount").textContent = state.summary.teacherCount || 0;
  $("total80").textContent = formatKHR(state.summary.total80 || 0);
  $("total20").textContent = formatKHR(state.summary.total20 || 0);
}

function renderTeacherOptions() {
  const teacherFilter = $("teacherFilter");
  if (!teacherFilter) return;

  const current = teacherFilter.value;
  const options = ['<option value="">គ្រប់គ្រូ</option>'];

  state.teachers.forEach((t) => {
    options.push(`<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</option>`);
  });

  teacherFilter.innerHTML = options.join("");

  if ([...teacherFilter.options].some(opt => opt.value === current)) {
    teacherFilter.value = current;
  }
}

function getFilteredRecords() {
  const keyword = ($("searchInput")?.value || "").trim().toLowerCase();
  const teacher = $("teacherFilter")?.value || "";

  return state.records.filter((r) => {
    const matchesKeyword =
      !keyword ||
      String(r.studentName || "").toLowerCase().includes(keyword) ||
      String(r.teacherName || "").toLowerCase().includes(keyword) ||
      String(r.studentClass || "").toLowerCase().includes(keyword) ||
      String(r.recordId || "").toLowerCase().includes(keyword);

    const matchesTeacher =
      !teacher || String(r.teacherName || "") === teacher;

    return matchesKeyword && matchesTeacher;
  });
}

function renderRecords() {
  const tbody = $("recordsTableBody");
  if (!tbody) return;

  const records = getFilteredRecords();

  tbody.innerHTML = records.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(r.recordId || "")}</td>
      <td>${escapeHtml(r.studentName || "")}</td>
      <td>${escapeHtml(r.gender || "")}</td>
      <td>${escapeHtml(r.studentClass || "")}</td>
      <td>${escapeHtml(r.teacherName || "")}</td>
      <td>${escapeHtml(r.monthlyFee || "")}</td>
      <td>${escapeHtml(r.invoiceDate || "")}</td>
      <td>${escapeHtml(r.note || "")}</td>
      <td>
        <button onclick="openEditById('${String(r.recordId || "").replace(/'/g, "\\'")}')">Edit</button>
        ${state.role === "admin" ? `<button class="danger-btn" onclick="removeRecord('${String(r.recordId || "").replace(/'/g, "\\'")}')">Delete</button>` : ""}
      </td>
    </tr>
  `).join("");
}

function fillForm(r) {
  $("studentName").value = r.studentName || "";
  $("gender").value = r.gender || "";
  $("studentClass").value = r.studentClass || "";
  $("teacherName").value = r.teacherName || "";
  $("monthlyFee").value = r.monthlyFee || "";
  $("paid80").value = r.paid80 || "";
  $("paid20").value = r.paid20 || "";
  $("dailyPrice").value = r.dailyPrice || "";
  $("startDate").value = r.startDate || "";
  $("invoiceDate").value = r.invoiceDate || "";
  $("days").value = r.days || 30;
  $("note").value = r.note || "";
}

function clearForm() {
  state.editingRecordId = null;
  fillForm({
    studentName: "",
    gender: "",
    studentClass: "",
    teacherName: "",
    monthlyFee: "",
    paid80: "",
    paid20: "",
    dailyPrice: "",
    startDate: "",
    invoiceDate: "",
    days: 30,
    note: ""
  });
  $("formTitle").textContent = "បញ្ចូលទិន្នន័យ";
}

function openEditById(recordId) {
  const record = state.records.find((r) => String(r.recordId) === String(recordId));
  if (!record) {
    alert("រកមិនឃើញ Record");
    return;
  }

  state.editingRecordId = recordId;
  fillForm(record);
  $("formTitle").textContent = `កែប្រែទិន្នន័យ (${recordId})`;
  switchView("formView");
}

function getFormPayload() {
  return {
    recordId: state.editingRecordId,
    studentName: $("studentName").value.trim(),
    gender: $("gender").value.trim(),
    studentClass: $("studentClass").value.trim(),
    teacherName: $("teacherName").value.trim(),
    monthlyFee: Number($("monthlyFee").value || 0),
    paid80: Number($("paid80").value || 0),
    paid20: Number($("paid20").value || 0),
    dailyPrice: Number($("dailyPrice").value || 0),
    startDate: $("startDate").value || "",
    invoiceDate: $("invoiceDate").value || "",
    days: Number($("days").value || 30),
    note: $("note").value.trim()
  };
}

async function saveRecord() {
  if (state.role !== "admin") {
    alert("User មិនអាចកែប្រែបានទេ");
    return;
  }

  const payload = getFormPayload();

  if (!payload.studentName) {
    alert("សូមបញ្ចូលឈ្មោះសិស្ស");
    return;
  }

  try {
    const action = state.editingRecordId ? "updateRecord" : "addRecord";
    const data = await apiPost(action, payload);

    if (!data.success) {
      alert(data.message || "រក្សាទុកមិនជោគជ័យ");
      return;
    }

    alert(data.message || "រក្សាទុកបានជោគជ័យ");
    clearForm();
    switchView("tableView");
    await loadDashboard();
  } catch (err) {
    console.error("saveRecord error:", err);
    alert("Save error");
  }
}

async function removeRecord(recordId) {
  if (state.role !== "admin") {
    alert("User មិនអាចលុបបានទេ");
    return;
  }

  if (!confirm("តើអ្នកចង់លុបទិន្នន័យនេះមែនទេ?")) return;

  try {
    const data = await apiPost("deleteRecord", { recordId });

    if (!data.success) {
      alert(data.message || "Delete failed");
      return;
    }

    alert(data.message || "លុបបានជោគជ័យ");
    await loadDashboard();
  } catch (err) {
    console.error("removeRecord error:", err);
    alert("Delete error");
  }
}

async function loadDashboard() {
  if (!state.token) {
    showLoginPanel();
    return;
  }

  try {
    setApiStatus("Loading...", true);
    setError("");

    const data = await apiGet("init");

    if (!data.success) {
      if (data.message === "Unauthorized") {
        clearSession();
        renderUserInfo();
        showLoginPanel();
        alert("Session ផុតកំណត់ សូម Login ម្តងទៀត");
        return;
      }

      throw new Error(data.message || "API Error");
    }

    state.records = Array.isArray(data.records) ? data.records : [];
    state.teachers = Array.isArray(data.teachers) ? data.teachers : [];
    state.summary = data.summary || {
      recordCount: 0,
      teacherCount: 0,
      total80: 0,
      total20: 0
    };

    if (data.user) {
      state.role = data.user.role || state.role;
      state.username = data.user.username || state.username;
      localStorage.setItem("role", state.role);
      localStorage.setItem("username", state.username);
    }

    renderUserInfo();
    renderSummary();
    renderTeacherOptions();
    renderRecords();
    showAppPanel();
    setApiStatus("Connected", true);
  } catch (err) {
    console.error("loadDashboard error:", err);
    setApiStatus("Error", false);
    setError(err.message || "Failed to fetch");
  }
}

function bindEvents() {
  $("saveApiBtn")?.addEventListener("click", () => saveApiUrlFromInput("apiUrl"));
  $("saveApiBtn2")?.addEventListener("click", () => saveApiUrlFromInput("apiUrlSettings"));
  $("testApiBtn")?.addEventListener("click", () => testApi("apiUrl"));
  $("testApiBtn2")?.addEventListener("click", () => testApi("apiUrlSettings"));
  $("loginBtn")?.addEventListener("click", login);
  $("logoutBtn")?.addEventListener("click", logout);
  $("refreshBtn")?.addEventListener("click", loadDashboard);
  $("saveBtn")?.addEventListener("click", saveRecord);
  $("clearBtn")?.addEventListener("click", clearForm);
  $("searchInput")?.addEventListener("input", renderRecords);
  $("teacherFilter")?.addEventListener("change", renderRecords);

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.getAttribute("data-view");
      if (view) switchView(view);
    });
  });
}

function registerSW() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        await reg.unregister();
      }
      await navigator.serviceWorker.register("./sw.js");
    } catch (err) {
      console.warn("SW register failed:", err);
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  syncApiInputs();
  renderUserInfo();
  registerSW();

  if (state.token) {
    await loadDashboard();
  } else {
    showLoginPanel();
    setApiStatus("Waiting...", false);
  }
});
