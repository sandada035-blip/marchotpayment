const API_URL = "https://script.google.com/macros/s/AKfycbxYV5gn8h2Z9pf_Y2P406YV2hTw0lglZL-I5KTTpVGpECnbj7-7wgLWp7LQzU4hdg6Adw/exec";

const state = {
  records: [],
  teachers: [],
  summary: {
    recordCount: 0,
    teacherCount: 0,
    total80: 0,
    total20: 0
  },
  role: localStorage.getItem("role") || "",
  username: localStorage.getItem("username") || "",
  token: localStorage.getItem("token") || "",
  editingRecordId: null
};

function $(id) {
  return document.getElementById(id);
}

function setApiStatus(text, isOk) {
  const el = $("apiStatus");
  if (!el) return;
  el.textContent = `API: ${text}`;
  el.style.color = isOk ? "#86efac" : "#fca5a5";
}

function formatKHR(value) {
  const num = Number(value || 0);
  return `${num.toLocaleString()} KHR`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function saveSession(data) {
  if (data.token) localStorage.setItem("token", data.token);
  if (data.role) localStorage.setItem("role", data.role);
  if (data.username) localStorage.setItem("username", data.username);

  state.token = localStorage.getItem("token") || "";
  state.role = localStorage.getItem("role") || "";
  state.username = localStorage.getItem("username") || "";
}

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("username");
  state.token = "";
  state.role = "";
  state.username = "";
}

async function apiGet(action, extraParams = {}) {
  const params = new URLSearchParams({
    action,
    token: state.token,
    _ts: Date.now().toString(),
    ...Object.fromEntries(
      Object.entries(extraParams).map(([k, v]) => [k, String(v)])
    )
  });

  const url = `${API_URL}?${params.toString()}`;

  const res = await fetch(url, {
    method: "GET",
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json();
}

async function apiPost(action, payload = {}) {
  const res = await fetch(API_URL, {
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

async function testApi() {
  try {
    const res = await fetch(`${API_URL}?action=ping&_ts=${Date.now()}`, {
      method: "GET",
      cache: "no-store"
    });

    const data = await res.json();
    if (data.success) {
      setApiStatus("Connected", true);
      return true;
    }

    setApiStatus("Error", false);
    return false;
  } catch (err) {
    console.error("testApi error:", err);
    setApiStatus("Error", false);
    return false;
  }
}

async function login() {
  const username = $("username")?.value?.trim() || "";
  const password = $("password")?.value?.trim() || "";

  if (!username || !password) {
    alert("សូមបញ្ចូល Username និង Password");
    return;
  }

  try {
    const res = await fetch(API_URL, {
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
      alert(data.message || "Login failed");
      return;
    }

    saveSession(data);
    window.location.href = "index.html";
  } catch (err) {
    console.error("login error:", err);
    alert("មិនអាច Login បានទេ");
  }
}

async function logout() {
  try {
    await apiPost("logout", {});
  } catch (err) {
    console.warn("logout error:", err);
  }

  clearSession();
  window.location.href = "login.html";
}

function ensureAuthOrRedirect() {
  if (!state.token) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

function renderUserInfo() {
  const roleEl = $("roleText");
  const userEl = $("userText");

  if (roleEl) roleEl.textContent = state.role || "-";
  if (userEl) userEl.textContent = state.username || "-";
}

function renderSummary() {
  if ($("studentCount")) $("studentCount").textContent = state.summary.recordCount || 0;
  if ($("teacherCount")) $("teacherCount").textContent = state.summary.teacherCount || 0;
  if ($("total80")) $("total80").textContent = formatKHR(state.summary.total80);
  if ($("total20")) $("total20").textContent = formatKHR(state.summary.total20);
}

function renderTeacherOptions() {
  const select = $("teacherFilter");
  if (!select) return;

  const currentValue = select.value;
  const teacherNames = state.teachers.map(t => t.name).filter(Boolean);

  select.innerHTML = `<option value="">គ្រប់គ្រូ</option>` +
    teacherNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");

  if ([...select.options].some(opt => opt.value === currentValue)) {
    select.value = currentValue;
  }
}

function getFilteredRecords() {
  const keyword = ($("searchInput")?.value || "").trim().toLowerCase();
  const teacher = $("teacherFilter")?.value || "";

  return state.records.filter(r => {
    const matchKeyword =
      !keyword ||
      String(r.studentName || "").toLowerCase().includes(keyword) ||
      String(r.studentClass || "").toLowerCase().includes(keyword) ||
      String(r.teacherName || "").toLowerCase().includes(keyword) ||
      String(r.recordId || "").toLowerCase().includes(keyword);

    const matchTeacher = !teacher || String(r.teacherName || "") === teacher;

    return matchKeyword && matchTeacher;
  });
}

function renderRecords() {
  const tbody = $("recordsTableBody");
  if (!tbody) return;

  const records = getFilteredRecords();

  tbody.innerHTML = records.map((r, index) => `
    <tr>
      <td>${index + 1}</td>
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
        ${state.role === "admin" ? `<button onclick="removeRecord('${String(r.recordId || "").replace(/'/g, "\\'")}')" class="danger-btn">Delete</button>` : ""}
      </td>
    </tr>
  `).join("");
}

function fillForm(record) {
  if ($("studentName")) $("studentName").value = record.studentName || "";
  if ($("gender")) $("gender").value = record.gender || "";
  if ($("studentClass")) $("studentClass").value = record.studentClass || "";
  if ($("teacherName")) $("teacherName").value = record.teacherName || "";
  if ($("monthlyFee")) $("monthlyFee").value = record.monthlyFee || "";
  if ($("paid80")) $("paid80").value = record.paid80 || "";
  if ($("paid20")) $("paid20").value = record.paid20 || "";
  if ($("dailyPrice")) $("dailyPrice").value = record.dailyPrice || "";
  if ($("startDate")) $("startDate").value = record.startDate || "";
  if ($("invoiceDate")) $("invoiceDate").value = record.invoiceDate || "";
  if ($("days")) $("days").value = record.days || "";
  if ($("note")) $("note").value = record.note || "";
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

  const formTitle = $("formTitle");
  if (formTitle) formTitle.textContent = "បញ្ចូលទិន្នន័យ";
}

function openEditById(recordId) {
  const record = state.records.find(r => String(r.recordId) === String(recordId));
  if (!record) {
    alert("រកមិនឃើញ Record");
    return;
  }

  state.editingRecordId = recordId;
  fillForm(record);

  const formTitle = $("formTitle");
  if (formTitle) formTitle.textContent = `កែប្រែទិន្នន័យ (${recordId})`;
}

function getFormPayload() {
  return {
    recordId: state.editingRecordId,
    studentName: $("studentName")?.value?.trim() || "",
    gender: $("gender")?.value?.trim() || "",
    studentClass: $("studentClass")?.value?.trim() || "",
    teacherName: $("teacherName")?.value?.trim() || "",
    monthlyFee: Number($("monthlyFee")?.value || 0),
    paid80: Number($("paid80")?.value || 0),
    paid20: Number($("paid20")?.value || 0),
    dailyPrice: Number($("dailyPrice")?.value || 0),
    startDate: $("startDate")?.value || "",
    invoiceDate: $("invoiceDate")?.value || "",
    days: Number($("days")?.value || 30),
    note: $("note")?.value?.trim() || ""
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
      alert(data.message || "Save failed");
      return;
    }

    alert(data.message || "រក្សាទុកបានជោគជ័យ");
    clearForm();
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
  if (!ensureAuthOrRedirect()) return;

  try {
    setApiStatus("Loading...", true);

    const ok = await testApi();
    if (!ok) {
      throw new Error("API ping failed");
    }

    const data = await apiGet("init");

    if (!data.success) {
      if (data.message === "Unauthorized") {
        clearSession();
        alert("Session ផុតកំណត់ សូម Login ម្តងទៀត");
        window.location.href = "login.html";
        return;
      }
      throw new Error(data.message || "Unknown API error");
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
    setApiStatus("Connected", true);
  } catch (err) {
    console.error("loadDashboard error:", err);
    setApiStatus("Error", false);

    const errorText = $("errorText");
    if (errorText) {
      errorText.textContent = err.message || "Failed to fetch";
    }
  }
}

function bindEvents() {
  if ($("refreshBtn")) {
    $("refreshBtn").addEventListener("click", loadDashboard);
  }

  if ($("saveBtn")) {
    $("saveBtn").addEventListener("click", saveRecord);
  }

  if ($("clearBtn")) {
    $("clearBtn").addEventListener("click", clearForm);
  }

  if ($("logoutBtn")) {
    $("logoutBtn").addEventListener("click", logout);
  }

  if ($("searchInput")) {
    $("searchInput").addEventListener("input", renderRecords);
  }

  if ($("teacherFilter")) {
    $("teacherFilter").addEventListener("change", renderRecords);
  }
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
      console.log("Service Worker registered");
    } catch (err) {
      console.warn("SW register failed:", err);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  renderUserInfo();
  registerSW();

  if ($("loginPage")) {
    const loginBtn = $("loginBtn");
    if (loginBtn) loginBtn.addEventListener("click", login);
    testApi();
    return;
  }

  loadDashboard();
});
