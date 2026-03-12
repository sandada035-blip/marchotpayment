const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbxYV5gn8h2Z9pf_Y2P406YV2hTw0lglZL-I5KTTpVGpECnbj7-7wgLWp7LQzU4hdg6Adw/exec";

const state = {
  apiUrl: localStorage.getItem("schoolpay_api_url") || DEFAULT_API_URL,
  token: localStorage.getItem("schoolpay_token") || "",
  role: localStorage.getItem("schoolpay_role") || "",
  username: localStorage.getItem("schoolpay_username") || "",
  records: [],
  teachers: [],
  summary: { recordCount: 0, teacherCount: 0, total80: 0, total20: 0 },
  editingRecordId: null,
  currentView: "dashboard"
};

function $(id) { return document.getElementById(id); }
function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function setStatus(text, ok = false) {
  const el = $("apiStatus");
  if (!el) return;
  el.textContent = `API: ${text}`;
  el.style.color = ok ? "#86efac" : "#fca5a5";
}
function setMessage(text) {
  const el = $("errorText");
  if (el) el.textContent = text;
}
function formatKHR(n) { return `${Number(n || 0).toLocaleString()} KHR`; }
function persistSession() {
  localStorage.setItem("schoolpay_api_url", state.apiUrl);
  localStorage.setItem("schoolpay_token", state.token);
  localStorage.setItem("schoolpay_role", state.role);
  localStorage.setItem("schoolpay_username", state.username);
}
function clearSession() {
  state.token = "";
  state.role = "";
  state.username = "";
  persistSession();
}
function syncApiInputs() {
  if ($("apiUrlInput")) $("apiUrlInput").value = state.apiUrl;
  if ($("apiUrlInputSettings")) $("apiUrlInputSettings").value = state.apiUrl;
}
function saveApiUrl(fromSettings = false) {
  const value = (fromSettings ? $("apiUrlInputSettings") : $("apiUrlInput")).value.trim();
  if (!value) {
    alert("សូមបញ្ចូល API URL");
    return;
  }
  state.apiUrl = value;
  persistSession();
  syncApiInputs();
  setStatus("Saved", true);
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { cache: "no-store", ...options });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function testApi() {
  if (!state.apiUrl) {
    setStatus("Not set", false);
    return false;
  }
  try {
    const data = await fetchJson(`${state.apiUrl}?action=ping&_ts=${Date.now()}`);
    if (data.success) {
      setStatus("Connected", true);
      setMessage("API តភ្ជាប់បានជោគជ័យ");
      return true;
    }
    throw new Error(data.message || "API ping failed");
  } catch (err) {
    console.error(err);
    setStatus("Error", false);
    setMessage(err.message || "Failed to fetch");
    return false;
  }
}
async function apiGet(action, extra = {}) {
  const params = new URLSearchParams({ action, token: state.token, _ts: String(Date.now()) });
  Object.entries(extra).forEach(([k, v]) => params.set(k, String(v)));
  return fetchJson(`${state.apiUrl}?${params.toString()}`);
}
async function apiPost(action, payload = {}) {
  return fetchJson(state.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, token: state.token, payload })
  });
}

async function login() {
  const username = $("username").value.trim();
  const password = $("password").value.trim();
  if (!state.apiUrl) return alert("សូមដាក់ API URL សិន");
  if (!username || !password) return alert("សូមបញ្ចូល Username និង Password");

  try {
    setStatus("Loading...", true);
    const data = await fetchJson(state.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", payload: { username, password } })
    });

    if (!data.success) {
      alert(data.message || "Login failed");
      return;
    }

    state.token = data.token || "";
    state.role = data.role || "";
    state.username = data.username || username;
    persistSession();
    renderSession();
    showApp();
    await loadDashboard();
  } catch (err) {
    console.error(err);
    setStatus("Error", false);
    setMessage(err.message || "Failed to fetch");
    alert("Login មិនបានជោគជ័យ");
  }
}

async function logout() {
  try {
    if (state.token) await apiPost("logout", {});
  } catch (err) {
    console.warn("logout error", err);
  }
  clearSession();
  state.records = [];
  state.teachers = [];
  state.summary = { recordCount: 0, teacherCount: 0, total80: 0, total20: 0 };
  renderSession();
  showLogin();
}

function renderSession() {
  $("roleText").textContent = state.role || "-";
  $("userText").textContent = state.username || "-";
}
function showLogin() {
  $("loginSection").classList.remove("hidden");
  $("appSection").classList.add("hidden");
  $("pageTitle").textContent = "Login";
  setMessage("សូម Login ដើម្បីចូលប្រើប្រព័ន្ធ");
}
function showApp() {
  $("loginSection").classList.add("hidden");
  $("appSection").classList.remove("hidden");
  switchView(state.currentView);
}
function switchView(view) {
  state.currentView = view;
  const map = {
    dashboard: "Dashboard",
    students: "បញ្ជីសិស្ស",
    reports: "របាយការណ៍",
    settings: "Settings"
  };
  $("pageTitle").textContent = map[view] || "Dashboard";
  document.querySelectorAll(".view").forEach(el => el.classList.add("hidden"));
  document.querySelectorAll(".menu-btn").forEach(btn => btn.classList.remove("active"));
  const viewEl = document.getElementById(`${view}View`);
  if (viewEl) viewEl.classList.remove("hidden");
  document.querySelector(`.menu-btn[data-view="${view}"]`)?.classList.add("active");
}

function renderSummary() {
  $("studentCount").textContent = state.summary.recordCount || 0;
  $("teacherCount").textContent = state.summary.teacherCount || 0;
  $("total80").textContent = formatKHR(state.summary.total80);
  $("total20").textContent = formatKHR(state.summary.total20);
}
function renderTeacherOptions() {
  const select = $("teacherFilter");
  const current = select.value;
  select.innerHTML = `<option value="">គ្រប់គ្រូ</option>` + state.teachers.map(t => `<option value="${esc(t.name)}">${esc(t.name)} (${Number(t.count || 0)})</option>`).join("");
  if ([...select.options].some(o => o.value === current)) select.value = current;
}
function filteredRecords() {
  const keyword = $("searchInput").value.trim().toLowerCase();
  const teacher = $("teacherFilter").value;
  return state.records.filter(r => {
    const txt = [r.studentName, r.studentClass, r.teacherName, r.recordId].join(" ").toLowerCase();
    return (!keyword || txt.includes(keyword)) && (!teacher || String(r.teacherName || "") === teacher);
  });
}
function renderRecords() {
  const rows = filteredRecords().map((r, i) => {
    const id = String(r.recordId || "").replace(/'/g, "\\'");
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(r.recordId)}</td>
        <td>${esc(r.studentName)}</td>
        <td>${esc(r.gender)}</td>
        <td>${esc(r.studentClass)}</td>
        <td>${esc(r.teacherName)}</td>
        <td>${esc(r.monthlyFee)}</td>
        <td>${esc(r.invoiceDate)}</td>
        <td>${esc(r.note || "")}</td>
        <td>
          <button class="ghost" onclick="openEdit('${id}')">Edit</button>
          ${state.role === "admin" ? `<button class="danger" onclick="removeRecord('${id}')">Delete</button>` : ""}
        </td>
      </tr>`;
  }).join("");
  $("recordsTableBody").innerHTML = rows || `<tr><td colspan="10">មិនមានទិន្នន័យ</td></tr>`;
}
function renderReports() {
  const host = $("teacherReport");
  host.innerHTML = state.teachers.map(t => `
    <div class="report-card">
      <div>${esc(t.name)}</div>
      <strong>${Number(t.count || 0)}</strong>
      <div class="muted">សិស្ស</div>
    </div>`).join("") || `<div class="muted">មិនមានទិន្នន័យគ្រូ</div>`;
}
function fillForm(r) {
  $("studentName").value = r.studentName || "";
  $("gender").value = r.gender || "";
  $("studentClass").value = r.studentClass || "";
  $("teacherName").value = r.teacherName || "";
  $("monthlyFee").value = r.monthlyFee || 0;
  $("paid80").value = r.paid80 || 0;
  $("paid20").value = r.paid20 || 0;
  $("dailyPrice").value = r.dailyPrice || 0;
  $("startDate").value = r.startDate || "";
  $("invoiceDate").value = r.invoiceDate || "";
  $("days").value = r.days || 30;
  $("note").value = r.note || "";
}
function clearForm() {
  state.editingRecordId = null;
  $("formTitle").textContent = "បញ្ចូលទិន្នន័យ";
  fillForm({ days: 30 });
}
window.openEdit = function(recordId) {
  const record = state.records.find(r => String(r.recordId) === String(recordId));
  if (!record) return alert("រកមិនឃើញ Record");
  state.editingRecordId = recordId;
  $("formTitle").textContent = `កែប្រែទិន្នន័យ (${recordId})`;
  fillForm(record);
  switchView("students");
};
function payloadFromForm() {
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
    startDate: $("startDate").value,
    invoiceDate: $("invoiceDate").value,
    days: Number($("days").value || 30),
    note: $("note").value.trim()
  };
}
async function saveRecord() {
  if (state.role !== "admin") return alert("User មិនអាចកែប្រែបានទេ");
  const payload = payloadFromForm();
  if (!payload.studentName) return alert("សូមបញ្ចូលឈ្មោះសិស្ស");

  try {
    const action = state.editingRecordId ? "updateRecord" : "addRecord";
    const data = await apiPost(action, payload);
    if (!data.success) return alert(data.message || "Save failed");
    alert(data.message || "រក្សាទុកបានជោគជ័យ");
    clearForm();
    await loadDashboard();
  } catch (err) {
    console.error(err);
    alert(err.message || "Save error");
  }
}
window.removeRecord = async function(recordId) {
  if (state.role !== "admin") return alert("User មិនអាចលុបបានទេ");
  if (!confirm("តើអ្នកចង់លុប Record នេះមែនទេ?")) return;
  try {
    const data = await apiPost("deleteRecord", { recordId });
    if (!data.success) return alert(data.message || "Delete failed");
    alert(data.message || "លុបបានជោគជ័យ");
    await loadDashboard();
  } catch (err) {
    console.error(err);
    alert(err.message || "Delete error");
  }
};

async function loadDashboard() {
  if (!state.token) {
    showLogin();
    return;
  }
  try {
    setStatus("Loading...", true);
    const ok = await testApi();
    if (!ok) return;
    const data = await apiGet("init");
    if (!data.success) {
      if (data.message === "Unauthorized") {
        clearSession();
        showLogin();
        return alert("Session ផុតកំណត់ សូម Login ម្តងទៀត");
      }
      throw new Error(data.message || "API Error");
    }
    state.records = Array.isArray(data.records) ? data.records : [];
    state.teachers = Array.isArray(data.teachers) ? data.teachers : [];
    state.summary = data.summary || state.summary;
    if (data.user) {
      state.role = data.user.role || state.role;
      state.username = data.user.username || state.username;
      persistSession();
    }
    renderSession();
    renderSummary();
    renderTeacherOptions();
    renderRecords();
    renderReports();
    setMessage("ទិន្នន័យបានធ្វើបច្ចុប្បន្នភាព");
    setStatus("Connected", true);
  } catch (err) {
    console.error(err);
    setStatus("Error", false);
    setMessage(err.message || "Failed to fetch");
  }
}

function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) await reg.unregister();
      await navigator.serviceWorker.register("./sw.js");
    } catch (err) {
      console.warn("SW failed", err);
    }
  });
}

function bind() {
  $("saveApiUrlBtn").addEventListener("click", () => saveApiUrl(false));
  $("saveApiUrlSettingsBtn").addEventListener("click", () => saveApiUrl(true));
  $("testApiBtn").addEventListener("click", testApi);
  $("testApiSettingsBtn").addEventListener("click", testApi);
  $("loginBtn").addEventListener("click", login);
  $("logoutBtn").addEventListener("click", logout);
  $("refreshBtn").addEventListener("click", loadDashboard);
  $("saveBtn").addEventListener("click", saveRecord);
  $("clearBtn").addEventListener("click", clearForm);
  $("searchInput").addEventListener("input", renderRecords);
  $("teacherFilter").addEventListener("change", renderRecords);
  document.querySelectorAll(".menu-btn").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.view)));
  document.querySelectorAll("[data-view-target]").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.viewTarget)));
}

document.addEventListener("DOMContentLoaded", () => {
  syncApiInputs();
  renderSession();
  bind();
  registerSW();
  if (state.token) {
    showApp();
    loadDashboard();
  } else {
    showLogin();
    testApi();
  }
});
