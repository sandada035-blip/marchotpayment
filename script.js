const state = {
  apiUrl: localStorage.getItem("apiUrl") || "",
  teachers: [],
  summary: {
    teacherCount: 0,
    recordCount: 0,
    total80: 0,
    total20: 0
  },
  recent: [],
  records: [],
  deferredPrompt: null
};

const els = {
  views: document.querySelectorAll(".view"),
  navBtns: document.querySelectorAll(".nav-btn"),
  pageTitle: document.getElementById("pageTitle"),
  apiStatus: document.getElementById("apiStatus"),
  teacherCount: document.getElementById("teacherCount"),
  recordCount: document.getElementById("recordCount"),
  total80: document.getElementById("total80"),
  total20: document.getElementById("total20"),
  teacherList: document.getElementById("teacherList"),
  recentRecords: document.getElementById("recentRecords"),
  paymentForm: document.getElementById("paymentForm"),
  resetFormBtn: document.getElementById("resetFormBtn"),
  submitBtn: document.getElementById("submitBtn"),
  teacherName: document.getElementById("teacherName"),
  filterTeacher: document.getElementById("filterTeacher"),
  recordsTableBody: document.getElementById("recordsTableBody"),
  searchInput: document.getElementById("searchInput"),
  searchBtn: document.getElementById("searchBtn"),
  apiUrl: document.getElementById("apiUrl"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  testConnectionBtn: document.getElementById("testConnectionBtn"),
  toast: document.getElementById("toast"),
  refreshBtn: document.getElementById("refreshBtn"),
  installBtn: document.getElementById("installBtn"),
  menuBtn: document.getElementById("menuBtn"),
  sidebar: document.getElementById("sidebar")
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  els.apiUrl.value = state.apiUrl;
  bindEvents();
  registerSW();
  updateApiStatus();

  if (state.apiUrl) {
    bootstrapData();
  } else {
    showToast("សូមដាក់ Apps Script Web App URL នៅ Settings ជាមុនសិន");
  }
}

function bindEvents() {
  els.navBtns.forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  document.querySelectorAll("[data-go]").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.go));
  });

  els.saveSettingsBtn.addEventListener("click", saveSettings);
  els.testConnectionBtn.addEventListener("click", testConnection);
  els.paymentForm.addEventListener("submit", submitPaymentForm);
  els.resetFormBtn.addEventListener("click", resetForm);
  els.searchBtn.addEventListener("click", renderRecordsTable);
  els.filterTeacher.addEventListener("change", renderRecordsTable);
  els.refreshBtn.addEventListener("click", bootstrapData);
  els.menuBtn.addEventListener("click", () => els.sidebar.classList.toggle("open"));

  const monthlyFeeEl = document.getElementById("monthlyFee");
  const daysEl = document.getElementById("days");
  if (monthlyFeeEl) monthlyFeeEl.addEventListener("input", autoCalculateSplit);
  if (daysEl) daysEl.addEventListener("input", autoCalculateDailyPrice);

  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    state.deferredPrompt = e;
    els.installBtn.classList.remove("hidden");
  });

  els.installBtn.addEventListener("click", async () => {
    if (!state.deferredPrompt) return;
    state.deferredPrompt.prompt();
    await state.deferredPrompt.userChoice;
    state.deferredPrompt = null;
    els.installBtn.classList.add("hidden");
  });
}

function switchView(viewName) {
  const titles = {
    dashboard: "Dashboard",
    payments: "បញ្ចូលការបង់ប្រាក់",
    records: "កែទិន្នន័យ",
    settings: "Settings"
  };

  els.views.forEach(v => v.classList.remove("active"));
  const target = document.getElementById(`${viewName}View`);
  if (target) target.classList.add("active");

  els.navBtns.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });

  els.pageTitle.textContent = titles[viewName] || "Dashboard";
  els.sidebar.classList.remove("open");
}

function saveSettings() {
  const url = (els.apiUrl.value || "").trim();
  if (!url) {
    showToast("សូមបញ្ចូល Web App URL");
    return;
  }

  localStorage.setItem("apiUrl", url);
  state.apiUrl = url;
  updateApiStatus();
  showToast("បានរក្សាទុក Settings");
  bootstrapData();
}

async function testConnection() {
  if (!state.apiUrl) {
    showToast("មិនទាន់មាន API URL");
    return;
  }

  try {
    const data = await apiGet("action=init");
    if (data && data.success) {
      updateApiStatus(true);
      showToast("ភ្ជាប់បានជោគជ័យ");
    } else {
      updateApiStatus(false);
      showToast(data.message || "Connection មិនទាន់ត្រឹមត្រូវ");
    }
  } catch (err) {
    updateApiStatus(false);
    showToast(err.message || "Connection failed");
  }
}

function updateApiStatus(connected = null) {
  if (!state.apiUrl) {
    els.apiStatus.textContent = "API: Not Connected";
    return;
  }

  if (connected === true) {
    els.apiStatus.textContent = "API: Connected";
  } else if (connected === false) {
    els.apiStatus.textContent = "API: Error";
  } else {
    els.apiStatus.textContent = "API: Configured";
  }
}

async function bootstrapData() {
  if (!state.apiUrl) return;

  try {
    const data = await apiGet("action=init");
    if (!data.success) throw new Error(data.message || "Init failed");

    state.teachers = Array.isArray(data.teachers) ? data.teachers : [];
    state.summary = data.summary || { teacherCount: 0, recordCount: 0, total80: 0, total20: 0 };
    state.recent = Array.isArray(data.recent) ? data.recent : [];
    state.records = Array.isArray(data.records) ? data.records : [];

    fillTeacherSelects();
    renderDashboard();
    renderRecordsTable();
    updateApiStatus(true);
  } catch (err) {
    console.error(err);
    updateApiStatus(false);
    showToast(err.message || "មានបញ្ហាក្នុងការទាញទិន្នន័យ");
  }
}

function fillTeacherSelects() {
  const teacherOptions = [
    '<option value="">ជ្រើសរើសគ្រូ</option>',
    ...state.teachers.map(t => `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</option>`)
  ].join("");

  els.teacherName.innerHTML = teacherOptions;

  els.filterTeacher.innerHTML = [
    '<option value="">គ្រូទាំងអស់</option>',
    ...state.teachers.map(t => `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</option>`)
  ].join("");
}

function renderDashboard() {
  els.teacherCount.textContent = formatInt(state.summary.teacherCount);
  els.recordCount.textContent = formatInt(state.summary.recordCount);
  els.total80.textContent = formatKHR(state.summary.total80);
  els.total20.textContent = formatKHR(state.summary.total20);

  els.teacherList.innerHTML = state.teachers.length
    ? state.teachers.map(t => `
      <div class="teacher-item">
        <div>
          <strong>${escapeHtml(t.name)}</strong>
          <div class="muted">${formatInt(t.count || 0)} records</div>
        </div>
        <span class="badge">Sheet</span>
      </div>
    `).join("")
    : `<div class="teacher-item">មិនទាន់មាន Teacher Sheets</div>`;

  els.recentRecords.innerHTML = state.recent.length
    ? state.recent.map(r => `
      <div class="recent-item">
        <strong>${escapeHtml(r.studentName || "")}</strong>
        <div class="muted">${escapeHtml(r.teacherName || "")}</div>
        <div>${formatKHR(r.monthlyFee)} | 80%: ${formatKHR(r.paid80)} | 20%: ${formatKHR(r.paid20)}</div>
        <div class="muted">ថ្នាក់: ${escapeHtml(r.studentClass || "")} | ថ្ងៃបង់: ${escapeHtml(r.invoiceDate || "")}</div>
      </div>
    `).join("")
    : `<div class="recent-item">មិនទាន់មានកំណត់ត្រា</div>`;
}

function renderRecordsTable() {
  const teacher = (els.filterTeacher.value || "").trim();
  const search = (els.searchInput.value || "").trim().toLowerCase();

  let rows = [...state.records];

  if (teacher) {
    rows = rows.filter(r => String(r.teacherName || "") === teacher);
  }

  if (search) {
    rows = rows.filter(r => String(r.studentName || "").toLowerCase().includes(search));
  }

  rows.sort((a, b) => new Date(b.invoiceDate || 0) - new Date(a.invoiceDate || 0));

  els.recordsTableBody.innerHTML = rows.length
    ? rows.map(r => `
      <tr>
        <td>${escapeHtml(r.studentName || "")}</td>
        <td>${escapeHtml(r.gender || "")}</td>
        <td>${escapeHtml(r.studentClass || "")}</td>
        <td>${escapeHtml(r.teacherName || "")}</td>
        <td>${formatKHR(r.monthlyFee)}</td>
        <td>${formatKHR(r.paid80)}</td>
        <td>${formatKHR(r.paid20)}</td>
        <td>${escapeHtml(r.invoiceDate || "")}</td>
        <td>
          <div class="table-actions">
            <button class="small-btn edit-btn" onclick="editRecord('${escapeJs(r.recordId)}')">Edit</button>
            <button class="small-btn delete-btn" onclick="deleteRecord('${escapeJs(r.recordId)}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="9">មិនមានទិន្នន័យ</td></tr>`;
}

function autoCalculateSplit() {
  const monthlyFee = moneyToNumber(document.getElementById("monthlyFee").value);
  const paid80El = document.getElementById("paid80");
  const paid20El = document.getElementById("paid20");

  if (paid80El) paid80El.value = Math.round(monthlyFee * 0.8);
  if (paid20El) paid20El.value = Math.round(monthlyFee * 0.2);

  autoCalculateDailyPrice();
}

function autoCalculateDailyPrice() {
  const monthlyFee = moneyToNumber(document.getElementById("monthlyFee").value);
  const days = moneyToNumber(document.getElementById("days").value) || 30;
  const dailyEl = document.getElementById("dailyPrice");
  if (dailyEl) dailyEl.value = Math.round(monthlyFee / days);
}

async function submitPaymentForm(e) {
  e.preventDefault();

  if (!state.apiUrl) {
    showToast("សូមកំណត់ API URL ជាមុនសិន");
    switchView("settings");
    return;
  }

  const payload = getFormData();

  if (!payload.studentName || !payload.teacherName || !payload.monthlyFee) {
    showToast("សូមបំពេញព័ត៌មានចាំបាច់");
    return;
  }

  els.submitBtn.disabled = true;
  els.submitBtn.textContent = payload.recordId ? "កំពុងកែ..." : "កំពុងរក្សាទុក...";

  try {
    const data = await apiPost({
      action: payload.recordId ? "updateRecord" : "addRecord",
      payload
    });

    if (!data.success) throw new Error(data.message || "Save failed");

    showToast(payload.recordId ? "បានកែទិន្នន័យរួចរាល់" : "បានបញ្ចូលទិន្នន័យរួចរាល់");
    resetForm();
    await bootstrapData();
    switchView("records");
  } catch (err) {
    console.error(err);
    showToast(err.message || "រក្សាទុកមិនបានជោគជ័យ");
  } finally {
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = "រក្សាទុក";
  }
}

function getFormData() {
  return {
    recordId: (document.getElementById("recordId").value || "").trim(),
    studentName: (document.getElementById("studentName").value || "").trim(),
    gender: (document.getElementById("gender").value || "").trim(),
    studentClass: (document.getElementById("studentClass").value || "").trim(),
    teacherName: (document.getElementById("teacherName").value || "").trim(),
    monthlyFee: moneyToNumber(document.getElementById("monthlyFee").value),
    paid80: moneyToNumber(document.getElementById("paid80").value),
    paid20: moneyToNumber(document.getElementById("paid20").value),
    dailyPrice: moneyToNumber(document.getElementById("dailyPrice").value),
    startDate: document.getElementById("startDate").value || "",
    invoiceDate: document.getElementById("invoiceDate").value || "",
    days: moneyToNumber(document.getElementById("days").value) || 30,
    note: (document.getElementById("note")?.value || "").trim()
  };
}

function resetForm() {
  els.paymentForm.reset();
  document.getElementById("recordId").value = "";
  const daysEl = document.getElementById("days");
  if (daysEl) daysEl.value = 30;
  els.submitBtn.textContent = "រក្សាទុក";
}

window.editRecord = function(recordId) {
  const r = state.records.find(x => String(x.recordId) === String(recordId));
  if (!r) {
    showToast("រកមិនឃើញ record");
    return;
  }

  document.getElementById("recordId").value = r.recordId || "";
  document.getElementById("studentName").value = r.studentName || "";
  document.getElementById("gender").value = r.gender || "";
  document.getElementById("studentClass").value = r.studentClass || "";
  document.getElementById("teacherName").value = r.teacherName || "";
  document.getElementById("monthlyFee").value = r.monthlyFee || "";
  document.getElementById("paid80").value = r.paid80 || "";
  document.getElementById("paid20").value = r.paid20 || "";
  const dailyPriceEl = document.getElementById("dailyPrice");
  if (dailyPriceEl) dailyPriceEl.value = r.dailyPrice || "";
  document.getElementById("startDate").value = r.startDate || "";
  document.getElementById("invoiceDate").value = r.invoiceDate || "";
  document.getElementById("days").value = r.days || 30;
  const noteEl = document.getElementById("note");
  if (noteEl) noteEl.value = r.note || "";

  els.submitBtn.textContent = "កែទិន្នន័យ";
  switchView("payments");
  showToast("អ្នកអាចកែទិន្នន័យបានហើយ");
};

window.deleteRecord = async function(recordId) {
  if (!confirm("តើអ្នកពិតជាចង់លុបកំណត់ត្រានេះមែនទេ?")) return;

  try {
    const data = await apiPost({
      action: "deleteRecord",
      payload: { recordId }
    });

    if (!data.success) throw new Error(data.message || "Delete failed");

    showToast("បានលុបទិន្នន័យរួចរាល់");
    await bootstrapData();
  } catch (err) {
    console.error(err);
    showToast(err.message || "លុបទិន្នន័យមិនបាន");
  }
};

async function apiGet(queryString) {
  const url = `${state.apiUrl}${state.apiUrl.includes("?") ? "&" : "?"}${queryString}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error("API GET error");
  return res.json();
}

async function apiPost(body) {
  const res = await fetch(state.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error("API POST error");
  return res.json();
}

function moneyToNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;

  const n = Number(
    String(value)
      .replace(/,/g, "")
      .replace(/KHR/gi, "")
      .replace(/៛/g, "")
      .replace(/[^\d.-]/g, "")
      .trim()
  );

  return Number.isFinite(n) ? n : 0;
}

function formatKHR(value) {
  return `${moneyToNumber(value).toLocaleString()} KHR`;
}

function formatInt(value) {
  return moneyToNumber(value).toLocaleString();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    els.toast.classList.remove("show");
  }, 2600);
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[s]));
}

function escapeJs(str) {
  return String(str ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  }
}