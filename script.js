const CONFIG = {
  storageKeys: {
    apiUrl: 'schoolpay_api_url',
    session: 'schoolpay_session_v4'
  }
};

const state = {
  apiUrl: localStorage.getItem(CONFIG.storageKeys.apiUrl) || '',
  session: loadSession(),
  records: [],
  filteredRecords: [],
  teachers: [],
  summary: { teacherCount: 0, recordCount: 0, total80: 0, total20: 0 },
  recordMap: new Map(),
  deferredPrompt: null,
  currentView: 'dashboardView'
};

const els = {};

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  bindElements();
  bindEvents();
  initSettings();
  registerServiceWorker();
  setupInstallPrompt();
  renderAuth();
}

function bindElements() {
  const ids = [
    'appLoader','loginView','appView','loginForm','loginUsername','loginPassword','loginError','userRoleBadge','currentUserText',
    'logoutBtn','refreshBtn','installBtn','pageTitle','statusText','apiBadge','gotoFormBtn','gotoRecordsBtn','teacherCount',
    'recordCount','total80','total20','recentList','chartCanvas','chartTypeSelect','refreshChartBtn','recordForm','recordId',
    'formTitle','formSubtitle','resetFormBtn','studentName','gender','studentClass','teacherName','teacherOptions','monthlyFee',
    'paid80','paid20','dailyPrice','startDate','invoiceDate','days','note','cancelEditBtn','saveBtn','searchInput','teacherFilter',
    'classFilter','recordsTableBody','teacherCards','classSummary','genderSummary','apiUrlInput','saveSettingsBtn',
    'clearSettingsBtn','exportCsvBtn'
  ];
  ids.forEach((id) => (els[id] = document.getElementById(id)));
  els.navBtns = Array.from(document.querySelectorAll('.nav-btn'));
  els.views = Array.from(document.querySelectorAll('.view-section'));
  els.adminOnly = Array.from(document.querySelectorAll('.admin-only'));
}

function bindEvents() {
  els.loginForm.addEventListener('submit', handleLogin);
  els.logoutBtn.addEventListener('click', logout);
  els.refreshBtn.addEventListener('click', bootstrapData);
  els.gotoFormBtn.addEventListener('click', () => switchView('formView'));
  els.gotoRecordsBtn.addEventListener('click', () => switchView('recordsView'));
  els.refreshChartBtn.addEventListener('click', drawChart);
  els.recordForm.addEventListener('submit', submitRecord);
  els.resetFormBtn.addEventListener('click', resetForm);
  els.cancelEditBtn.addEventListener('click', cancelEdit);
  els.searchInput.addEventListener('input', applyFilters);
  els.teacherFilter.addEventListener('change', applyFilters);
  els.classFilter.addEventListener('change', applyFilters);
  els.saveSettingsBtn.addEventListener('click', saveApiUrl);
  els.clearSettingsBtn.addEventListener('click', clearApiUrl);
  els.exportCsvBtn.addEventListener('click', exportCsv);
  els.monthlyFee.addEventListener('input', autoCalculateShares);
  els.installBtn.addEventListener('click', installApp);
  els.navBtns.forEach((btn) => btn.addEventListener('click', () => switchView(btn.dataset.view)));
}

function initSettings() {
  els.apiUrlInput.value = state.apiUrl;
}

function loadSession() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKeys.session);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(CONFIG.storageKeys.session, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(CONFIG.storageKeys.session);
}

function renderAuth() {
  els.appLoader.classList.add('hidden');
  if (!state.session) {
    els.loginView.classList.remove('hidden');
    els.appView.classList.add('hidden');
    return;
  }

  els.loginView.classList.add('hidden');
  els.appView.classList.remove('hidden');
  els.userRoleBadge.textContent = state.session.role;
  els.currentUserText.textContent = state.session.name;
  els.apiUrlInput.value = state.apiUrl;
  applyRoleUi();
  bootstrapData();
}

async function handleLogin(event) {
  event.preventDefault();
  const username = els.loginUsername.value.trim();
  const password = els.loginPassword.value.trim();

  if (!state.apiUrl) {
    els.loginError.textContent = 'សូមកំណត់ Google Apps Script Web App URL មុនសិន។';
    return;
  }

  try {
    const res = await apiPost('login', { username, password }, false);
    if (!res.success) throw new Error(res.message || 'Login failed');

    state.session = {
      token: res.token,
      role: res.role,
      username: res.username,
      name: res.name || res.username
    };
    saveSession(state.session);
    els.loginError.textContent = '';
    els.loginForm.reset();
    renderAuth();
  } catch (error) {
    els.loginError.textContent = error.message || 'Login failed';
  }
}

async function logout() {
  try {
    if (state.session?.token && state.apiUrl) {
      await apiPost('logout', {}, true);
    }
  } catch {}

  clearSession();
  state.session = null;
  state.records = [];
  state.filteredRecords = [];
  state.recordMap = new Map();
  renderAuth();
}

function applyRoleUi() {
  const isAdmin = state.session?.role === 'admin';
  els.formSubtitle.textContent = isAdmin
    ? 'Admin អាចបន្ថែម កែប្រែ និងលុបទិន្នន័យបាន។'
    : 'User អាចមើលបានតែប៉ុណ្ណោះ។';

  els.adminOnly.forEach((el) => {
    el.style.display = isAdmin ? '' : 'none';
  });

  els.recordForm.querySelectorAll('input, select, textarea, button[type="submit"]').forEach((el) => {
    if (el.id === 'cancelEditBtn') return;
    if (el.id === 'recordId') return;
    el.disabled = !isAdmin;
  });
  els.saveBtn.disabled = !isAdmin;
}

async function bootstrapData() {
  if (!state.apiUrl) {
    updateStatus('សូមកំណត់ Google Apps Script Web App URL ជាមុនសិន', false);
    switchView('settingsView');
    return;
  }

  if (!state.session?.token) {
    renderAuth();
    return;
  }

  try {
    updateStatus('កំពុងទាញទិន្នន័យ...', true);
    const data = await apiGet(`action=init&token=${encodeURIComponent(state.session.token)}`);
    if (!data.success) throw new Error(data.message || 'Init failed');

    state.records = normalizeRecords(Array.isArray(data.records) ? data.records : []);
    state.recordMap = new Map(state.records.map((r) => [String(r.recordId), r]));
    state.teachers = Array.isArray(data.teachers) ? data.teachers : [];
    state.summary = data.summary || state.summary;
    state.filteredRecords = [...state.records];

    renderDashboard();
    buildFilters();
    applyFilters();
    renderTeacherReports();
    renderSummaryReports();
    populateTeacherOptions();
    updateStatus('ទិន្នន័យបានធ្វើបច្ចុប្បន្នភាព', true);
  } catch (error) {
    if ((error.message || '').includes('Unauthorized')) {
      clearSession();
      state.session = null;
      renderAuth();
      return;
    }
    console.error(error);
    updateStatus(`មានបញ្ហា: ${error.message}`, false);
  }
}

function normalizeRecords(records) {
  return records
    .map((r, idx) => ({
      studentName: r.studentName || '',
      gender: r.gender || '',
      studentClass: r.studentClass || '',
      teacherName: r.teacherName || '',
      monthlyFee: Number(r.monthlyFee || 0),
      paid80: Number(r.paid80 || 0),
      paid20: Number(r.paid20 || 0),
      dailyPrice: Number(r.dailyPrice || 0),
      startDate: r.startDate || '',
      invoiceDate: r.invoiceDate || '',
      days: Number(r.days || 0),
      recordId: String(r.recordId || `row-${idx + 2}`),
      note: r.note || ''
    }))
    .filter((r) => r.recordId);
}

function updateStatus(message, connected) {
  els.statusText.textContent = message;
  els.apiBadge.textContent = connected ? 'API: Connected' : 'API: Error';
  els.apiBadge.style.color = connected ? '#9be7c4' : '#ffb4b4';
}

function saveApiUrl() {
  const value = els.apiUrlInput.value.trim();
  state.apiUrl = value;
  localStorage.setItem(CONFIG.storageKeys.apiUrl, value);
  updateStatus('បានរក្សាទុក API URL', true);
}

function clearApiUrl() {
  state.apiUrl = '';
  localStorage.removeItem(CONFIG.storageKeys.apiUrl);
  els.apiUrlInput.value = '';
  updateStatus('បានលុប API URL', false);
}

async function apiGet(queryString) {
  const separator = state.apiUrl.includes('?') ? '&' : '?';
  const url = `${state.apiUrl}${separator}${queryString}&_ts=${Date.now()}`;
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!res.ok) throw new Error('API GET error');
  const json = await res.json();
  if (json && json.message === 'Unauthorized') throw new Error('Unauthorized');
  return json;
}

async function apiPost(action, payload, withToken = true) {
  const body = {
    action,
    payload: withToken ? { ...payload, token: state.session?.token || '' } : payload
  };

  const res = await fetch(state.apiUrl, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error('API POST error');
  const json = await res.json();
  if (json && json.message === 'Unauthorized') throw new Error('Unauthorized');
  return json;
}

function renderDashboard() {
  els.teacherCount.textContent = formatNumber(state.summary.teacherCount || 0);
  els.recordCount.textContent = formatNumber(state.summary.recordCount || 0);
  els.total80.textContent = `${formatNumber(state.summary.total80 || 0)} KHR`;
  els.total20.textContent = `${formatNumber(state.summary.total20 || 0)} KHR`;
  renderRecentList();
  drawChart();
}

function renderRecentList() {
  const list = state.records.slice(-8).reverse();
  els.recentList.innerHTML = list.length
    ? list.map((r) => `
      <div class="recent-item">
        <strong>${escapeHtml(r.studentName)}</strong>
        <div class="muted-row">${escapeHtml(r.teacherName || '-')} • ${escapeHtml(r.studentClass || '-')}</div>
        <div class="muted-row">${formatNumber(r.monthlyFee)} KHR • ID: ${escapeHtml(r.recordId)}</div>
      </div>`).join('')
    : '<div class="recent-item">មិនទាន់មានទិន្នន័យ</div>';
}

function populateTeacherOptions() {
  const names = [...new Set(state.teachers.map((t) => t.name).filter(Boolean))].sort();
  els.teacherOptions.innerHTML = names.map((name) => `<option value="${escapeHtml(name)}"></option>`).join('');
}

function buildFilters() {
  const teacherNames = ['គ្រូទាំងអស់', ...new Set(state.records.map((r) => r.teacherName).filter(Boolean))];
  const classNames = ['ថ្នាក់ទាំងអស់', ...new Set(state.records.map((r) => r.studentClass).filter(Boolean))];
  els.teacherFilter.innerHTML = teacherNames.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  els.classFilter.innerHTML = classNames.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
}

function applyFilters() {
  const term = (els.searchInput.value || '').trim().toLowerCase();
  const teacher = els.teacherFilter.value;
  const studentClass = els.classFilter.value;

  state.filteredRecords = state.records.filter((r) => {
    const haystack = [r.studentName, r.teacherName, r.studentClass, r.gender, r.note, r.recordId]
      .join(' ')
      .toLowerCase();
    const matchesTerm = !term || haystack.includes(term);
    const matchesTeacher = !teacher || teacher === 'គ្រូទាំងអស់' || r.teacherName === teacher;
    const matchesClass = !studentClass || studentClass === 'ថ្នាក់ទាំងអស់' || r.studentClass === studentClass;
    return matchesTerm && matchesTeacher && matchesClass;
  });

  renderRecordsTable();
}

function renderRecordsTable() {
  const isAdmin = state.session?.role === 'admin';
  els.recordsTableBody.innerHTML = state.filteredRecords.length
    ? state.filteredRecords.map((r) => `
      <tr data-record-id="${escapeHtml(r.recordId)}">
        <td>${escapeHtml(r.studentName)}</td>
        <td>${escapeHtml(r.gender)}</td>
        <td>${escapeHtml(r.studentClass)}</td>
        <td>${escapeHtml(r.teacherName)}</td>
        <td>${formatNumber(r.monthlyFee)}</td>
        <td>${formatNumber(r.paid80)}</td>
        <td>${formatNumber(r.paid20)}</td>
        <td>${escapeHtml(r.startDate)}</td>
        <td>${escapeHtml(r.invoiceDate)}</td>
        <td>${formatNumber(r.days)}</td>
        <td><small>${escapeHtml(r.note)}</small></td>
        <td><small>${escapeHtml(r.recordId)}</small></td>
        <td>
          <div class="table-actions">
            <button class="btn-sm btn-view" data-action="view" data-id="${escapeHtml(r.recordId)}">View</button>
            ${isAdmin ? `<button class="btn-sm btn-edit" data-action="edit" data-id="${escapeHtml(r.recordId)}">Edit</button>` : ''}
            ${isAdmin ? `<button class="btn-sm btn-del" data-action="delete" data-id="${escapeHtml(r.recordId)}">Delete</button>` : ''}
          </div>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="13">មិនមានទិន្នន័យ</td></tr>';

  els.recordsTableBody.onclick = (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    handleTableAction(btn.dataset.action, String(btn.dataset.id || ''));
  };
}

function handleTableAction(action, id) {
  const record = state.recordMap.get(String(id));
  if (!record) {
    alert('រកមិនឃើញ Record នេះទេ។ សូម Refresh ម្តងទៀត។');
    return;
  }

  if (action === 'view') {
    fillForm(record, true);
    switchView('formView');
    return;
  }

  if (state.session?.role !== 'admin') return;

  if (action === 'edit') {
    fillForm(record, false);
    switchView('formView');
    return;
  }

  if (action === 'delete') {
    deleteRecord(record);
  }
}

function fillForm(record, readOnlyMode) {
  els.recordId.value = record.recordId || '';
  els.studentName.value = record.studentName || '';
  els.gender.value = record.gender || 'ប្រុស';
  els.studentClass.value = record.studentClass || '';
  els.teacherName.value = record.teacherName || '';
  els.monthlyFee.value = record.monthlyFee || 0;
  els.paid80.value = record.paid80 || 0;
  els.paid20.value = record.paid20 || 0;
  els.dailyPrice.value = record.dailyPrice || 0;
  els.startDate.value = normalizeDateInput(record.startDate);
  els.invoiceDate.value = normalizeDateInput(record.invoiceDate);
  els.days.value = record.days || 30;
  els.note.value = record.note || '';
  els.formTitle.textContent = readOnlyMode ? 'មើលព័ត៌មានកំណត់ត្រា' : `កែប្រែកំណត់ត្រា (${record.recordId})`;
  els.cancelEditBtn.classList.toggle('hidden', readOnlyMode);

  const disabled = readOnlyMode || state.session?.role !== 'admin';
  els.recordForm.querySelectorAll('input, select, textarea').forEach((el) => {
    if (el.id === 'recordId') return;
    el.disabled = disabled;
  });
  els.saveBtn.disabled = disabled;
}

function resetForm() {
  els.recordForm.reset();
  els.recordId.value = '';
  els.days.value = 30;
  els.formTitle.textContent = 'បញ្ចូលការបង់ប្រាក់ថ្មី';
  els.cancelEditBtn.classList.add('hidden');
  applyRoleUi();
}

function cancelEdit() {
  resetForm();
}

async function submitRecord(event) {
  event.preventDefault();
  if (state.session?.role !== 'admin') return;

  const payload = {
    recordId: els.recordId.value.trim(),
    studentName: els.studentName.value.trim(),
    gender: els.gender.value,
    studentClass: els.studentClass.value.trim(),
    teacherName: els.teacherName.value.trim(),
    monthlyFee: Number(els.monthlyFee.value || 0),
    paid80: Number(els.paid80.value || 0),
    paid20: Number(els.paid20.value || 0),
    dailyPrice: Number(els.dailyPrice.value || 0),
    startDate: els.startDate.value,
    invoiceDate: els.invoiceDate.value,
    days: Number(els.days.value || 30),
    note: els.note.value.trim()
  };

  try {
    const action = payload.recordId ? 'updateRecord' : 'addRecord';
    const res = await apiPost(action, payload, true);
    if (!res.success) throw new Error(res.message || 'Save failed');
    resetForm();
    await bootstrapData();
    switchView('recordsView');
    alert(res.message || 'រក្សាទុកបានជោគជ័យ');
  } catch (error) {
    alert(error.message);
  }
}

async function deleteRecord(record) {
  const ok = window.confirm(`តើអ្នកចង់លុប ${record.studentName} (${record.recordId}) មែនទេ?`);
  if (!ok) return;

  try {
    const res = await apiPost('deleteRecord', { recordId: record.recordId }, true);
    if (!res.success) throw new Error(res.message || 'Delete failed');
    await bootstrapData();
    alert(res.message || 'លុបបានជោគជ័យ');
  } catch (error) {
    alert(error.message);
  }
}

function renderTeacherReports() {
  const map = new Map();
  state.records.forEach((r) => {
    const key = r.teacherName || 'មិនបានកំណត់';
    if (!map.has(key)) map.set(key, { count: 0, total80: 0, total20: 0, totalFee: 0 });
    const item = map.get(key);
    item.count += 1;
    item.total80 += Number(r.paid80 || 0);
    item.total20 += Number(r.paid20 || 0);
    item.totalFee += Number(r.monthlyFee || 0);
  });

  const entries = Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  els.teacherCards.innerHTML = entries.length
    ? entries.map(([name, data]) => `
      <div class="teacher-card">
        <strong>${escapeHtml(name)}</strong>
        <div class="muted-row">ចំនួនសិស្ស: ${formatNumber(data.count)}</div>
        <div class="amounts">
          <div><span class="muted-row">សរុបតម្លៃ</span><br>${formatNumber(data.totalFee)} KHR</div>
          <div><span class="muted-row">ប្រាក់គ្រូ 80%</span><br>${formatNumber(data.total80)} KHR</div>
          <div><span class="muted-row">ប្រាក់សាលា 20%</span><br>${formatNumber(data.total20)} KHR</div>
        </div>
      </div>`).join('')
    : '<div class="teacher-card">មិនមានទិន្នន័យ</div>';
}

function renderSummaryReports() {
  renderGroupedSummary('classSummary', groupRecordsBy((r) => r.studentClass || 'មិនបានកំណត់'));
  renderGroupedSummary('genderSummary', groupRecordsBy((r) => r.gender || 'មិនបានកំណត់'));
}

function renderGroupedSummary(targetId, items) {
  const container = els[targetId];
  container.innerHTML = items.length
    ? items.map((item) => `
      <div class="summary-item">
        <div class="label">${escapeHtml(item.name)}</div>
        <strong>${formatNumber(item.count)} នាក់</strong>
        <div class="muted-row">សរុប: ${formatNumber(item.total)} KHR</div>
      </div>`).join('')
    : '<div class="summary-item">មិនមានទិន្នន័យ</div>';
}

function groupRecordsBy(getKey) {
  const map = new Map();
  state.records.forEach((r) => {
    const key = getKey(r);
    if (!map.has(key)) map.set(key, { name: key, count: 0, total: 0 });
    const item = map.get(key);
    item.count += 1;
    item.total += Number(r.monthlyFee || 0);
  });
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function drawChart() {
  const canvas = els.chartCanvas;
  const ctx = canvas.getContext('2d');
  const type = els.chartTypeSelect.value;
  const grouped = type === 'teacher'
    ? groupRecordsBy((r) => r.teacherName || 'N/A')
    : type === 'class'
    ? groupRecordsBy((r) => r.studentClass || 'N/A')
    : groupRecordsBy((r) => r.gender || 'N/A');

  const data = grouped.slice(0, 6);
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(300, rect.width) * dpr;
  canvas.height = 280 * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, Math.max(300, rect.width), 280);

  const width = Math.max(300, rect.width);
  ctx.fillStyle = '#0b1629';
  roundRect(ctx, 0, 0, width, 280, 18, true);

  if (!data.length) {
    ctx.fillStyle = '#a8b9de';
    ctx.font = '16px Arial';
    ctx.fillText('មិនមានទិន្នន័យសម្រាប់បង្ហាញ', 24, 36);
    return;
  }

  const max = Math.max(...data.map((i) => i.total || i.count), 1);
  const padding = { top: 24, right: 20, bottom: 58, left: 20 };
  const chartWidth = width - padding.left - padding.right;
  const barGap = 14;
  const barWidth = Math.max(28, (chartWidth - barGap * (data.length - 1)) / data.length);
  const maxHeight = 160;

  data.forEach((item, index) => {
    const value = item.total || item.count;
    const height = (value / max) * maxHeight;
    const x = padding.left + index * (barWidth + barGap);
    const y = 220 - height;

    ctx.fillStyle = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#14b8a6'][index % 6];
    roundRect(ctx, x, y, barWidth, height, 12, true);

    ctx.fillStyle = '#e7eefc';
    ctx.font = '12px Arial';
    ctx.fillText(shortLabel(item.name, 10), x, 246);
    ctx.fillText(formatShortNumber(value), x, y - 8);
  });
}

function roundRect(ctx, x, y, width, height, radius, fill) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  if (fill) ctx.fill();
}

function switchView(viewId) {
  state.currentView = viewId;
  els.views.forEach((view) => view.classList.toggle('hidden', view.id !== viewId));
  els.navBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === viewId));

  const titles = {
    dashboardView: 'Dashboard',
    formView: 'បញ្ចូលការបង់ប្រាក់',
    recordsView: 'ទិន្នន័យ',
    teachersView: 'របាយការណ៍គ្រូ',
    reportsView: 'របាយការណ៍សង្ខេប',
    settingsView: 'ការកំណត់'
  };
  els.pageTitle.textContent = titles[viewId] || 'School Pay';
}

function exportCsv() {
  const rows = [
    ['Student Name', 'Gender', 'Class', 'Teacher', 'Monthly Fee', '80%', '20%', 'Start Date', 'Invoice Date', 'Days', 'Record ID', 'Note'],
    ...state.filteredRecords.map((r) => [
      r.studentName,
      r.gender,
      r.studentClass,
      r.teacherName,
      r.monthlyFee,
      r.paid80,
      r.paid20,
      r.startDate,
      r.invoiceDate,
      r.days,
      r.recordId,
      r.note
    ])
  ];

  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'school-pay-records.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function autoCalculateShares() {
  const fee = Number(els.monthlyFee.value || 0);
  els.paid80.value = Math.round(fee * 0.8);
  els.paid20.value = Math.round(fee * 0.2);
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    els.installBtn.classList.remove('hidden');
  });
}

async function installApp() {
  if (!state.deferredPrompt) return;
  state.deferredPrompt.prompt();
  await state.deferredPrompt.userChoice;
  state.deferredPrompt = null;
  els.installBtn.classList.add('hidden');
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  }
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatShortNumber(value) {
  const num = Number(value || 0);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}

function shortLabel(text, len) {
  const str = String(text || '');
  return str.length > len ? `${str.slice(0, len)}...` : str;
}

function normalizeDateInput(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
