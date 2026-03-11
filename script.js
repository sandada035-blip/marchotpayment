/**
 * School Pay Dashboard - Frontend Script
 * ធានាភាពស៊ីគ្នាជាមួយ Google Apps Script ថ្មី
 */

// ប្តូរ URL នេះជាមួយ Web App URL ថ្មីរបស់អ្នកក្រោយពេល Deploy ក្នុង Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbzdBQUfTR7CaxOF9f5qYT2etzogQjz1zJeyn6aqfmJfzwX-9SnZB2vsm_V578bNHo7fFw/exec";

const state = {
  apiUrl: API_URL,
  teachers: [],
  summary: { teacherCount: 0, recordCount: 0, total80: 0, total20: 0 },
  recent: [],
  records: [],
  reportRows: [],
  monthlyRows: [],
  chartInstance: null,
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
  toast: document.getElementById("toast"),
  refreshBtn: document.getElementById("refreshBtn"),
  installBtn: document.getElementById("installBtn"),
  menuBtn: document.getElementById("menuBtn"),
  sidebar: document.getElementById("sidebar"),

  reportDate: document.getElementById("reportDate"),
  reportTeacher: document.getElementById("reportTeacher"),
  previewReportBtn: document.getElementById("previewReportBtn"),
  printDailyBtn: document.getElementById("printDailyBtn"),
  reportTableBody: document.getElementById("reportTableBody"),
  reportCount: document.getElementById("reportCount"),
  reportMonthlyFee: document.getElementById("reportMonthlyFee"),
  report80: document.getElementById("report80"),
  report20: document.getElementById("report20"),

  monthlyReportMonth: document.getElementById("monthlyReportMonth"),
  monthlyTeacher: document.getElementById("monthlyTeacher"),
  previewMonthlyBtn: document.getElementById("previewMonthlyBtn"),
  printMonthlyBtn: document.getElementById("printMonthlyBtn"),
  monthlyTableBody: document.getElementById("monthlyTableBody"),
  monthlyCount: document.getElementById("monthlyCount"),
  monthlyFeeTotal: document.getElementById("monthlyFeeTotal"),
  monthly80: document.getElementById("monthly80"),
  monthly20: document.getElementById("monthly20"),

  chartType: document.getElementById("chartType"),
  chartMetric: document.getElementById("chartMetric"),
  refreshChartBtn: document.getElementById("refreshChartBtn"),
  dashboardChart: document.getElementById("dashboardChart")
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  bindEvents();
  registerSW();
  updateApiStatus();

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if (els.reportDate) els.reportDate.value = today;
  if (els.monthlyReportMonth) els.monthlyReportMonth.value = monthStr;

  const invoiceDateEl = document.getElementById("invoiceDate");
  const startDateEl = document.getElementById("startDate");
  if (invoiceDateEl) invoiceDateEl.value = today;
  if (startDateEl) startDateEl.value = today;

  if (state.apiUrl && state.apiUrl.includes("script.google.com")) {
    bootstrapData();
  } else {
    updateApiStatus(false);
    showToast("សូមដាក់ API URL ដែលត្រឹមត្រូវក្នុង script.js");
  }
}

function bindEvents() {
  els.navBtns.forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  document.querySelectorAll("[data-go]").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.go));
  });

  els.paymentForm?.addEventListener("submit", submitPaymentForm);
  els.resetFormBtn?.addEventListener("click", resetForm);
  els.filterTeacher?.addEventListener("change", renderRecordsTable);
  els.searchInput?.addEventListener("input", renderRecordsTable);
  els.refreshBtn?.addEventListener("click", bootstrapData);
  els.menuBtn?.addEventListener("click", () => els.sidebar.classList.toggle("open"));

  const monthlyFeeEl = document.getElementById("monthlyFee");
  const daysEl = document.getElementById("days");
  if (monthlyFeeEl) monthlyFeeEl.addEventListener("input", autoCalculateSplit);
  if (daysEl) daysEl.addEventListener("input", autoCalculateDailyPrice);

  els.previewReportBtn?.addEventListener("click", previewDailyReport);
  els.printDailyBtn?.addEventListener("click", printDailyReport);
  els.reportTeacher?.addEventListener("change", previewDailyReport);
  els.reportDate?.addEventListener("change", previewDailyReport);

  els.previewMonthlyBtn?.addEventListener("click", previewMonthlyReport);
  els.printMonthlyBtn?.addEventListener("click", printMonthlyReport);
  els.monthlyTeacher?.addEventListener("change", previewMonthlyReport);
  els.monthlyReportMonth?.addEventListener("change", previewMonthlyReport);

  els.refreshChartBtn?.addEventListener("click", renderDashboardChart);
  els.chartType?.addEventListener("change", renderDashboardChart);
  els.chartMetric?.addEventListener("change", renderDashboardChart);

  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    state.deferredPrompt = e;
    els.installBtn?.classList.remove("hidden");
  });

  els.installBtn?.addEventListener("click", async () => {
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
    reports: "របាយការណ៍ប្រចាំថ្ងៃ",
    monthly: "របាយការណ៍ប្រចាំខែ"
  };

  els.views.forEach(v => v.classList.remove("active"));
  const target = document.getElementById(`${viewName}View`);
  if (target) target.classList.add("active");

  els.navBtns.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });

  els.pageTitle.textContent = titles[viewName] || "Dashboard";
  els.sidebar.classList.remove("open");

  if (viewName === "reports") previewDailyReport();
  if (viewName === "monthly") previewMonthlyReport();
  if (viewName === "dashboard") renderDashboardChart();
}

function updateApiStatus(connected = null) {
  if (!state.apiUrl) {
    els.apiStatus.textContent = "API: Missing";
    return;
  }
  if (connected === true) {
    els.apiStatus.textContent = "API: Connected";
  } else if (connected === false) {
    els.apiStatus.textContent = "API: Error";
  } else {
    els.apiStatus.textContent = "API: Ready";
  }
}

async function bootstrapData() {
  updateApiStatus(null);
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
    renderDashboardChart();
    updateApiStatus(true);
  } catch (err) {
    console.error(err);
    updateApiStatus(false);
    showToast("បញ្ហាទាញទិន្នន័យ៖ " + err.message);
  }
}

function fillTeacherSelects() {
  const options = [
    '<option value="">ជ្រើសរើសគ្រូ</option>',
    ...state.teachers.map(t => `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</option>`)
  ].join("");

  if (els.teacherName) els.teacherName.innerHTML = options;
  if (els.filterTeacher) els.filterTeacher.innerHTML = '<option value="">គ្រូទាំងអស់</option>' + state.teachers.map(t => `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</option>`).join("");
  if (els.reportTeacher) els.reportTeacher.innerHTML = '<option value="">គ្រូទាំងអស់</option>' + state.teachers.map(t => `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</option>`).join("");
  if (els.monthlyTeacher) els.monthlyTeacher.innerHTML = '<option value="">គ្រូទាំងអស់</option>' + state.teachers.map(t => `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</option>`).join("");
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
          <div class="muted">${formatInt(t.count || 0)} នាក់</div>
        </div>
        <span class="badge">Sheet</span>
      </div>
    `).join("")
    : `<div class="teacher-item">មិនទាន់មានទិន្នន័យគ្រូ</div>`;

  els.recentRecords.innerHTML = state.recent.length
    ? state.recent.map(r => `
      <div class="recent-item">
        <strong>${escapeHtml(r.studentName || "")}</strong>
        <div class="muted">${escapeHtml(r.teacherName || "")}</div>
        <div>${formatKHR(r.monthlyFee)} | 80%: ${formatKHR(r.paid80)}</div>
        <div class="muted">ថ្ងៃបង់៖ ${escapeHtml(r.invoiceDate || "")}</div>
      </div>
    `).join("")
    : `<div class="recent-item">មិនទាន់មានកំណត់ត្រា</div>`;
}

function renderRecordsTable() {
  const teacher = (els.filterTeacher?.value || "").trim();
  const search = (els.searchInput?.value || "").trim().toLowerCase();

  let rows = [...state.records];
  if (teacher) rows = rows.filter(r => String(r.teacherName || "") === teacher);
  if (search) rows = rows.filter(r => String(r.studentName || "").toLowerCase().includes(search));

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
            <button class="small-btn delete-btn" onclick="deleteRecord('${escapeJs(r.recordId)}')">Del</button>
          </div>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="9">មិនមានទិន្នន័យ</td></tr>`;
}

async function submitPaymentForm(e) {
  e.preventDefault();
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

    if (!data.success) throw new Error(data.message || "រក្សាទុកបរាជ័យ");

    showToast(payload.recordId ? "បានកែទិន្នន័យរួចរាល់" : "បានបញ្ចូលទិន្នន័យរួចរាល់");
    resetForm();
    await bootstrapData();
    switchView("records");
  } catch (err) {
    showToast(err.message);
  } finally {
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = "រក្សាទុក";
  }
}

function getFormData() {
  return {
    recordId: document.getElementById("recordId").value || "",
    studentName: document.getElementById("studentName").value.trim(),
    gender: document.getElementById("gender").value,
    studentClass: document.getElementById("studentClass").value.trim(),
    teacherName: document.getElementById("teacherName").value,
    monthlyFee: moneyToNumber(document.getElementById("monthlyFee").value),
    paid80: moneyToNumber(document.getElementById("paid80").value),
    paid20: moneyToNumber(document.getElementById("paid20").value),
    dailyPrice: moneyToNumber(document.getElementById("dailyPrice").value),
    startDate: document.getElementById("startDate").value,
    invoiceDate: document.getElementById("invoiceDate").value,
    days: moneyToNumber(document.getElementById("days").value) || 30,
    note: document.getElementById("note")?.value.trim() || ""
  };
}

window.editRecord = function(recordId) {
  const r = state.records.find(x => String(x.recordId) === String(recordId));
  if (!r) return showToast("រកមិនឃើញ record");

  document.getElementById("recordId").value = r.recordId;
  document.getElementById("studentName").value = r.studentName;
  document.getElementById("gender").value = r.gender;
  document.getElementById("studentClass").value = r.studentClass;
  document.getElementById("teacherName").value = r.teacherName;
  document.getElementById("monthlyFee").value = r.monthlyFee;
  document.getElementById("paid80").value = r.paid80;
  document.getElementById("paid20").value = r.paid20;
  document.getElementById("dailyPrice").value = r.dailyPrice;
  document.getElementById("startDate").value = normalizeDate(r.startDate);
  document.getElementById("invoiceDate").value = normalizeDate(r.invoiceDate);
  document.getElementById("days").value = r.days || 30;
  if(document.getElementById("note")) document.getElementById("note").value = r.note || "";

  els.submitBtn.textContent = "កែទិន្នន័យ";
  switchView("payments");
  showToast("របៀបកែសម្រួល៖ ប្តូរព័ត៌មានរួចចុច 'កែទិន្នន័យ'");
};

window.deleteRecord = async function(recordId) {
  if (!confirm("តើអ្នកពិតជាចង់លុបកំណត់ត្រានេះមែនទេ?")) return;
  try {
    const data = await apiPost({ action: "deleteRecord", payload: { recordId } });
    if (!data.success) throw new Error(data.message);
    showToast("បានលុបទិន្នន័យរួចរាល់");
    await bootstrapData();
  } catch (err) {
    showToast("លុបមិនបាន៖ " + err.message);
  }
};

// --- API Helpers ---
async function apiGet(queryString) {
  const res = await fetch(`${state.apiUrl}?${queryString}`);
  if (!res.ok) throw new Error("Network response was not ok");
  return res.json();
}

async function apiPost(body) {
  const res = await fetch(state.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("Post request failed");
  return res.json();
}

// --- Formatting Helpers ---
function moneyToNumber(v) {
  return Number(String(v || 0).replace(/[^\d.-]/g, "")) || 0;
}
function formatKHR(v) {
  return `${moneyToNumber(v).toLocaleString()} ៛`;
}
function formatInt(v) {
  return moneyToNumber(v).toLocaleString();
}
function normalizeDate(v) {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
}
function autoCalculateSplit() {
  const fee = moneyToNumber(document.getElementById("monthlyFee").value);
  document.getElementById("paid80").value = Math.round(fee * 0.8);
  document.getElementById("paid20").value = Math.round(fee * 0.2);
  autoCalculateDailyPrice();
}
function autoCalculateDailyPrice() {
  const fee = moneyToNumber(document.getElementById("monthlyFee").value);
  const days = moneyToNumber(document.getElementById("days").value) || 30;
  document.getElementById("dailyPrice").value = Math.round(fee / days);
}
function resetForm() {
  els.paymentForm?.reset();
  document.getElementById("recordId").value = "";
  document.getElementById("days").value = 30;
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById("invoiceDate").value = today;
  document.getElementById("startDate").value = today;
  els.submitBtn.textContent = "រក្សាទុក";
}
function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  setTimeout(() => els.toast.classList.remove("show"), 3000);
}
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
function escapeJs(s) {
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
function registerSW() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(console.error);
}




