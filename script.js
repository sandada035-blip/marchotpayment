const API_URL = "https://script.google.com/macros/s/AKfycby1fD9n9I4zNujCg3OpSEBb834aTHBxjGXj5H4WhA1IpG-BrnZQ5O874q6l7W6xOcpJ7A/exec";
const state = {
  apiUrl: API_URL,
  teachers: [],
  summary: {
    teacherCount: 0,
    recordCount: 0,
    total80: 0,
    total20: 0
  },
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

  if (state.apiUrl) {
    bootstrapData();
  } else {
    updateApiStatus(false);
    showToast("សូមដាក់ API URL ក្នុង script.js");
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
    els.installBtn.classList.remove("hidden");
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
    previewDailyReport();
    previewMonthlyReport();
    renderDashboardChart();
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

  if (els.teacherName) els.teacherName.innerHTML = teacherOptions;

  if (els.filterTeacher) {
    els.filterTeacher.innerHTML = [
      '<option value="">គ្រូទាំងអស់</option>',
      ...state.teachers.map(t => `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</option>`)
    ].join("");
  }

  if (els.reportTeacher) {
    els.reportTeacher.innerHTML = [
      '<option value="">គ្រូទាំងអស់</option>',
      ...state.teachers.map(t => `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</option>`)
    ].join("");
  }

  if (els.monthlyTeacher) {
    els.monthlyTeacher.innerHTML = [
      '<option value="">គ្រូទាំងអស់</option>',
      ...state.teachers.map(t => `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</option>`)
    ].join("");
  }
}

function renderDashboard() {
  // គណនាទឹកប្រាក់សរុបដោយផ្ទាល់ពីទិន្នន័យ Records ទាំងអស់ដែលបានទាញយកមក
  const calcTotal80 = state.records.reduce((sum, r) => sum + moneyToNumber(r.paid80), 0);
  const calcTotal20 = state.records.reduce((sum, r) => sum + moneyToNumber(r.paid20), 0);

  // បង្ហាញទិន្នន័យនៅលើ Dashboard
  els.teacherCount.textContent = formatInt(state.summary.teacherCount || state.teachers.length);
  els.recordCount.textContent = formatInt(state.summary.recordCount || state.records.length);
  
  // ប្រើប្រាស់លទ្ធផលដែលគណនាបានខាងលើ
  els.total80.textContent = formatKHR(calcTotal80);
  els.total20.textContent = formatKHR(calcTotal20);

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
        <div class="muted">ថ្នាក់: ${escapeHtml(r.studentClass || "")} | ថ្ងៃបង់: ${escapeHtml(normalizeDate(r.invoiceDate) || "")}</div>
      </div>
    `).join("")
    : `<div class="recent-item">មិនទាន់មានកំណត់ត្រា</div>`;
}

function renderRecordsTable() {
  const teacher = (els.filterTeacher?.value || "").trim();
  const search = (els.searchInput?.value || "").trim().toLowerCase();

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
        <td>${escapeHtml(normalizeDate(r.invoiceDate) || "")}</td>
        <td>
          <div class="table-actions">
            <button class="small-btn edit-btn" onclick="editRecord('${escapeJs(r.recordId)}')">Edit</button>
            <button class="small-btn secondary-btn" onclick="exportInvoicePdf('${escapeJs(r.recordId)}')">PDF</button>
            <button class="small-btn delete-btn" onclick="deleteRecord('${escapeJs(r.recordId)}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="9">មិនមានទិន្នន័យ</td></tr>`;
}

function previewDailyReport() {
  const selectedDate = (els.reportDate?.value || "").trim();
  const selectedTeacher = (els.reportTeacher?.value || "").trim();

  let rows = [...state.records];

  if (selectedDate) {
    rows = rows.filter(r => normalizeDate(r.invoiceDate) === selectedDate);
  }

  if (selectedTeacher) {
    rows = rows.filter(r => String(r.teacherName || "") === selectedTeacher);
  }

  rows.sort((a, b) => String(a.teacherName || "").localeCompare(String(b.teacherName || "")));
  state.reportRows = rows;

  const totalCount = rows.length;
  const totalFee = rows.reduce((sum, r) => sum + moneyToNumber(r.monthlyFee), 0);
  const total80 = rows.reduce((sum, r) => sum + moneyToNumber(r.paid80), 0);
  const total20 = rows.reduce((sum, r) => sum + moneyToNumber(r.paid20), 0);

  if (els.reportCount) els.reportCount.textContent = formatInt(totalCount);
  if (els.reportMonthlyFee) els.reportMonthlyFee.textContent = formatKHR(totalFee);
  if (els.report80) els.report80.textContent = formatKHR(total80);
  if (els.report20) els.report20.textContent = formatKHR(total20);

  if (els.reportTableBody) {
    els.reportTableBody.innerHTML = rows.length
      ? rows.map(r => `
        <tr>
          <td>${escapeHtml(r.studentName || "")}</td>
          <td>${escapeHtml(r.gender || "")}</td>
          <td>${escapeHtml(r.studentClass || "")}</td>
          <td>${escapeHtml(r.teacherName || "")}</td>
          <td>${formatKHR(r.monthlyFee)}</td>
          <td>${formatKHR(r.paid80)}</td>
          <td>${formatKHR(r.paid20)}</td>
          <td>${escapeHtml(normalizeDate(r.invoiceDate) || "")}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="8">មិនមានទិន្នន័យសម្រាប់ថ្ងៃនេះ</td></tr>`;
  }
}

function previewMonthlyReport() {
  const selectedMonth = (els.monthlyReportMonth?.value || "").trim();
  const selectedTeacher = (els.monthlyTeacher?.value || "").trim();

  let rows = [...state.records];

  if (selectedMonth) {
    rows = rows.filter(r => {
      const d = normalizeDate(r.invoiceDate);
      return d && d.slice(0, 7) === selectedMonth;
    });
  }

  if (selectedTeacher) {
    rows = rows.filter(r => String(r.teacherName || "") === selectedTeacher);
  }

  rows.sort((a, b) => new Date(a.invoiceDate || 0) - new Date(b.invoiceDate || 0));
  state.monthlyRows = rows;

  const totalCount = rows.length;
  const totalFee = rows.reduce((sum, r) => sum + moneyToNumber(r.monthlyFee), 0);
  const total80 = rows.reduce((sum, r) => sum + moneyToNumber(r.paid80), 0);
  const total20 = rows.reduce((sum, r) => sum + moneyToNumber(r.paid20), 0);

  if (els.monthlyCount) els.monthlyCount.textContent = formatInt(totalCount);
  if (els.monthlyFeeTotal) els.monthlyFeeTotal.textContent = formatKHR(totalFee);
  if (els.monthly80) els.monthly80.textContent = formatKHR(total80);
  if (els.monthly20) els.monthly20.textContent = formatKHR(total20);

  if (els.monthlyTableBody) {
    els.monthlyTableBody.innerHTML = rows.length
      ? rows.map(r => `
        <tr>
          <td>${escapeHtml(r.studentName || "")}</td>
          <td>${escapeHtml(r.gender || "")}</td>
          <td>${escapeHtml(r.studentClass || "")}</td>
          <td>${escapeHtml(r.teacherName || "")}</td>
          <td>${formatKHR(r.monthlyFee)}</td>
          <td>${formatKHR(r.paid80)}</td>
          <td>${formatKHR(r.paid20)}</td>
          <td>${escapeHtml(normalizeDate(r.invoiceDate) || "")}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="8">មិនមានទិន្នន័យសម្រាប់ខែនេះ</td></tr>`;
  }
}

function renderDashboardChart() {
  if (!els.dashboardChart || typeof Chart === "undefined") return;

  const type = els.chartType?.value || "teacher";
  const metric = els.chartMetric?.value || "monthlyFee";
  const grouped = {};

  if (type === "teacher") {
    state.records.forEach(r => {
      const key = r.teacherName || "Unknown";
      if (!grouped[key]) grouped[key] = { count: 0, monthlyFee: 0, paid80: 0, paid20: 0 };
      grouped[key].count += 1;
      grouped[key].monthlyFee += moneyToNumber(r.monthlyFee);
      grouped[key].paid80 += moneyToNumber(r.paid80);
      grouped[key].paid20 += moneyToNumber(r.paid20);
    });
  } else {
    state.records.forEach(r => {
      const key = normalizeDate(r.invoiceDate) || "Unknown";
      if (!grouped[key]) grouped[key] = { count: 0, monthlyFee: 0, paid80: 0, paid20: 0 };
      grouped[key].count += 1;
      grouped[key].monthlyFee += moneyToNumber(r.monthlyFee);
      grouped[key].paid80 += moneyToNumber(r.paid80);
      grouped[key].paid20 += moneyToNumber(r.paid20);
    });
  }

  const labels = Object.keys(grouped).sort();
  const data = labels.map(label => grouped[label][metric]);

  if (state.chartInstance) state.chartInstance.destroy();

  state.chartInstance = new Chart(els.dashboardChart, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: metric, data }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function printDailyReport() {
  const reportDate = els.reportDate?.value || "";
  const teacherName = els.reportTeacher?.value || "";
  const rows = state.reportRows || [];

  if (!rows.length) {
    showToast("មិនមានទិន្នន័យសម្រាប់ print");
    return;
  }

  const totalFee = rows.reduce((sum, r) => sum + moneyToNumber(r.monthlyFee), 0);
  const total80 = rows.reduce((sum, r) => sum + moneyToNumber(r.paid80), 0);
  const total20 = rows.reduce((sum, r) => sum + moneyToNumber(r.paid20), 0);

  const html = `
    <html>
      <head>
        <title>Daily Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
          h1, h2, p { margin: 0 0 10px; }
          .summary { display:flex; gap:16px; flex-wrap:wrap; margin:18px 0; }
          .box { border:1px solid #ccc; border-radius:10px; padding:12px 16px; min-width:180px; }
          table { width:100%; border-collapse:collapse; margin-top:18px; }
          th, td { border:1px solid #333; padding:8px; text-align:left; }
          th { background:#f3f4f6; }
        </style>
      </head>
      <body>
        <h1>School Pay</h1>
        <h2>របាយការណ៍ប្រចាំថ្ងៃ</h2>
        <p><strong>ថ្ងៃបង់ប្រាក់:</strong> ${escapeHtml(reportDate || "ទាំងអស់")}</p>
        <p><strong>គ្រូ:</strong> ${escapeHtml(teacherName || "គ្រូទាំងអស់")}</p>

        <div class="summary">
          <div class="box"><strong>ចំនួនសិស្ស</strong><br>${formatInt(rows.length)}</div>
          <div class="box"><strong>សរុបតម្លៃសិក្សា</strong><br>${formatKHR(totalFee)}</div>
          <div class="box"><strong>សរុបប្រាក់គ្រូ 80%</strong><br>${formatKHR(total80)}</div>
          <div class="box"><strong>សរុបប្រាក់សាលា 20%</strong><br>${formatKHR(total20)}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>ឈ្មោះសិស្ស</th>
              <th>ភេទ</th>
              <th>ថ្នាក់</th>
              <th>គ្រូ</th>
              <th>តម្លៃសិក្សា</th>
              <th>80%</th>
              <th>20%</th>
              <th>ថ្ងៃបង់</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${escapeHtml(r.studentName || "")}</td>
                <td>${escapeHtml(r.gender || "")}</td>
                <td>${escapeHtml(r.studentClass || "")}</td>
                <td>${escapeHtml(r.teacherName || "")}</td>
                <td>${formatKHR(r.monthlyFee)}</td>
                <td>${formatKHR(r.paid80)}</td>
                <td>${formatKHR(r.paid20)}</td>
                <td>${escapeHtml(normalizeDate(r.invoiceDate) || "")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const w = window.open("", "_blank", "width=1200,height=800");
  if (!w) return showToast("Browser បានបិទ popup សម្រាប់ print");
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

function printMonthlyReport() {
  const selectedMonth = els.monthlyReportMonth?.value || "";
  const teacherName = els.monthlyTeacher?.value || "";
  const rows = state.monthlyRows || [];

  if (!rows.length) {
    showToast("មិនមានទិន្នន័យសម្រាប់ print");
    return;
  }

  const totalFee = rows.reduce((sum, r) => sum + moneyToNumber(r.monthlyFee), 0);
  const total80 = rows.reduce((sum, r) => sum + moneyToNumber(r.paid80), 0);
  const total20 = rows.reduce((sum, r) => sum + moneyToNumber(r.paid20), 0);

  const html = `
    <html>
      <head>
        <title>Monthly Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
          .summary { display:flex; gap:16px; flex-wrap:wrap; margin:18px 0; }
          .box { border:1px solid #ccc; border-radius:10px; padding:12px 16px; min-width:180px; }
          table { width:100%; border-collapse:collapse; margin-top:18px; }
          th, td { border:1px solid #333; padding:8px; text-align:left; }
          th { background:#f3f4f6; }
        </style>
      </head>
      <body>
        <h1>របាយការណ៍ប្រចាំខែ</h1>
        <p><strong>ខែ:</strong> ${escapeHtml(selectedMonth || "ទាំងអស់")}</p>
        <p><strong>គ្រូ:</strong> ${escapeHtml(teacherName || "គ្រូទាំងអស់")}</p>

        <div class="summary">
          <div class="box"><strong>ចំនួនសិស្ស</strong><br>${formatInt(rows.length)}</div>
          <div class="box"><strong>សរុបតម្លៃសិក្សា</strong><br>${formatKHR(totalFee)}</div>
          <div class="box"><strong>សរុបប្រាក់គ្រូ 80%</strong><br>${formatKHR(total80)}</div>
          <div class="box"><strong>សរុបប្រាក់សាលា 20%</strong><br>${formatKHR(total20)}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>ឈ្មោះសិស្ស</th>
              <th>ភេទ</th>
              <th>ថ្នាក់</th>
              <th>គ្រូ</th>
              <th>តម្លៃសិក្សា</th>
              <th>80%</th>
              <th>20%</th>
              <th>ថ្ងៃបង់</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${escapeHtml(r.studentName || "")}</td>
                <td>${escapeHtml(r.gender || "")}</td>
                <td>${escapeHtml(r.studentClass || "")}</td>
                <td>${escapeHtml(r.teacherName || "")}</td>
                <td>${formatKHR(r.monthlyFee)}</td>
                <td>${formatKHR(r.paid80)}</td>
                <td>${formatKHR(r.paid20)}</td>
                <td>${escapeHtml(normalizeDate(r.invoiceDate) || "")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const w = window.open("", "_blank", "width=1200,height=800");
  if (!w) return showToast("Browser បានបិទ popup");
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

window.exportInvoicePdf = function(recordId) {
  const r = state.records.find(x => String(x.recordId) === String(recordId));
  if (!r) return showToast("រកមិនឃើញ invoice");

  const html = `
    <html>
      <head>
        <title>Invoice</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
          .invoice { max-width: 800px; margin: 0 auto; border: 1px solid #ddd; padding: 24px; border-radius: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          td, th { border: 1px solid #ccc; padding: 10px; text-align: left; }
          th { background: #f3f4f6; width: 35%; }
        </style>
      </head>
      <body>
        <div class="invoice">
          <h1>School Pay</h1>
          <h2>Invoice</h2>
          <table>
            <tr><th>ឈ្មោះសិស្ស</th><td>${escapeHtml(r.studentName || "")}</td></tr>
            <tr><th>ភេទ</th><td>${escapeHtml(r.gender || "")}</td></tr>
            <tr><th>ថ្នាក់</th><td>${escapeHtml(r.studentClass || "")}</td></tr>
            <tr><th>គ្រូ</th><td>${escapeHtml(r.teacherName || "")}</td></tr>
            <tr><th>តម្លៃសិក្សា</th><td>${formatKHR(r.monthlyFee)}</td></tr>
            <tr><th>ប្រាក់គ្រូ 80%</th><td>${formatKHR(r.paid80)}</td></tr>
            <tr><th>ប្រាក់សាលា 20%</th><td>${formatKHR(r.paid20)}</td></tr>
            <tr><th>ថ្ងៃចាប់ផ្តើម</th><td>${escapeHtml(normalizeDate(r.startDate) || "")}</td></tr>
            <tr><th>ថ្ងៃបង់ប្រាក់</th><td>${escapeHtml(normalizeDate(r.invoiceDate) || "")}</td></tr>
            <tr><th>ចំនួនថ្ងៃ</th><td>${escapeHtml(String(r.days || ""))}</td></tr>
          </table>
        </div>
      </body>
    </html>
  `;

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return showToast("Browser បានបិទ popup");
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
};

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
    showToast("មិនទាន់មាន API URL");
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
  els.paymentForm?.reset();

  const recordIdEl = document.getElementById("recordId");
  if (recordIdEl) recordIdEl.value = "";

  const daysEl = document.getElementById("days");
  if (daysEl) daysEl.value = 30;

  const today = new Date().toISOString().slice(0, 10);
  const invoiceDateEl = document.getElementById("invoiceDate");
  const startDateEl = document.getElementById("startDate");
  if (invoiceDateEl) invoiceDateEl.value = today;
  if (startDateEl) startDateEl.value = today;

  els.submitBtn.textContent = "រក្សាទុក";
}

window.editRecord = function(recordId) {
  const r = state.records.find(x => String(x.recordId) === String(recordId));
  if (!r) return showToast("រកមិនឃើញ record");

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

  document.getElementById("startDate").value = normalizeDate(r.startDate) || "";
  document.getElementById("invoiceDate").value = normalizeDate(r.invoiceDate) || "";
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
  // Adding cache-busting timestamp to bypass hard browser caching
  const t = new Date().getTime();
  const url = `${state.apiUrl}${state.apiUrl.includes("?") ? "&" : "?"}${queryString}&t=${t}`;
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

function normalizeDate(value) {
  if (!value) return "";
  // Check if it's already a clean string yyyy-mm-dd
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.slice(0,10))) return value.slice(0,10);
  
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).trim();
  return d.toISOString().slice(0, 10);
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
