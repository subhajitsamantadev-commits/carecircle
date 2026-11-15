/**
 * CareCircle Frontend Application
 * Single Page Application for Elderly Care & Medication Management
 */

(function () {
  'use strict';

  // Application State
  const state = {
    currentUser: null, // { role, viewOnly, profile }
    elderMode: false,
    currentTab: 'today',
    schedule: [],
    medications: [],
    appointments: [],
    adherence: null,
    activityLogs: []
  };

  // DOM Elements Cache
  const elements = {
    app: document.getElementById('app'),
    mainNav: document.getElementById('main-nav'),
    viewLogin: document.getElementById('view-login'),
    profileBar: document.getElementById('profile-summary-bar'),
    elderNameHeader: document.getElementById('header-elder-name'),
    elderDetailsHeader: document.getElementById('header-elder-details'),
    roleBadge: document.getElementById('role-badge'),
    roleBadgeText: document.getElementById('role-badge-text'),
    roleBadgeIcon: document.getElementById('role-badge-icon'),
    familyBanner: document.getElementById('family-viewonly-banner'),
    btnLogout: document.getElementById('btn-logout'),
    btnToggleElder: document.getElementById('btn-toggle-elder-mode'),
    elderModeStatus: document.getElementById('elder-mode-status'),
    btnSendTestReminder: document.getElementById('btn-send-test-reminder'),
    toastContainer: document.getElementById('toast-container'),

    // Login Elements
    formLogin: document.getElementById('form-login'),
    inputPasscode: document.getElementById('input-passcode'),
    loginError: document.getElementById('login-error-msg'),
    btnTogglePasscodeVis: document.getElementById('btn-toggle-passcode-vis'),

    // Navigation Tabs
    navTabs: document.querySelectorAll('.nav-tab'),
    navPendingBadge: document.getElementById('nav-pending-badge'),
    tabPanes: document.querySelectorAll('.tab-pane'),

    // Today's Tab
    todayHeading: document.getElementById('today-heading'),
    todayDateSubtitle: document.getElementById('today-date-subtitle'),
    pillTaken: document.getElementById('pill-today-taken'),
    pillMissed: document.getElementById('pill-today-missed'),
    pillPending: document.getElementById('pill-today-pending'),
    todayProgressBar: document.getElementById('today-progress-bar'),
    todayProgressFill: document.getElementById('today-progress-fill'),
    todayProgressPercent: document.getElementById('today-progress-percent'),
    todayDosesContainer: document.getElementById('today-doses-container'),

    // Adherence Tab
    metricScoreCircle: document.getElementById('metric-score-circle'),
    metricAdherenceRate: document.getElementById('metric-adherence-rate'),
    metricStatusGrade: document.getElementById('metric-status-grade'),
    metricDosesTaken: document.getElementById('metric-doses-taken'),
    metricDosesMissed: document.getElementById('metric-doses-missed'),
    metricStreakDays: document.getElementById('metric-streak-days'),
    adherenceChartBars: document.getElementById('adherence-chart-bars'),
    adherenceTableBody: document.getElementById('adherence-table-body'),
    btnRefreshAdherence: document.getElementById('btn-refresh-adherence'),

    // Medications Tab
    medicationsGrid: document.getElementById('medications-grid'),
    btnOpenAddMed: document.getElementById('btn-open-add-med'),
    formAiParse: document.getElementById('form-ai-parse'),
    inputAiPrompt: document.getElementById('input-ai-prompt'),
    btnAiSubmit: document.getElementById('btn-ai-submit'),
    aiBtnText: document.getElementById('ai-btn-text'),
    aiBtnSpinner: document.getElementById('ai-btn-spinner'),

    // Appointments Tab
    appointmentsContainer: document.getElementById('appointments-container'),
    btnOpenAddApt: document.getElementById('btn-open-add-apt'),

    // Activity Tab
    activityLogsContainer: document.getElementById('activity-logs-container'),
    btnTriggerCron: document.getElementById('btn-trigger-cron'),
    btnRefreshLogs: document.getElementById('btn-refresh-logs'),

    // Modals
    modalMedication: document.getElementById('modal-medication'),
    formMedication: document.getElementById('form-medication'),
    modalMedTitle: document.getElementById('modal-med-title'),
    scheduleTimesWrapper: document.getElementById('schedule-times-wrapper'),
    btnAddScheduleTime: document.getElementById('btn-add-schedule-time'),

    modalAppointment: document.getElementById('modal-appointment'),
    formAppointment: document.getElementById('form-appointment'),
    modalAptTitle: document.getElementById('modal-apt-title')
  };

  // ==========================================================================
  // Toast Helper
  // ==========================================================================
  function showToast(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'danger') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ==========================================================================
  // Elder Mode Toggle
  // ==========================================================================
  function initElderMode() {
    const saved = localStorage.getItem('carecircle_elder_mode');
    state.elderMode = saved !== null ? saved === 'true' : true; // Default to ON for elder convenience
    applyElderMode(state.elderMode);

    elements.btnToggleElder.addEventListener('click', () => {
      state.elderMode = !state.elderMode;
      localStorage.setItem('carecircle_elder_mode', String(state.elderMode));
      applyElderMode(state.elderMode);
    });
  }

  function applyElderMode(enabled) {
    if (enabled) {
      document.body.classList.add('elder-mode');
      elements.elderModeStatus.textContent = 'ON';
      elements.btnToggleElder.setAttribute('aria-pressed', 'true');
    } else {
      document.body.classList.remove('elder-mode');
      elements.elderModeStatus.textContent = 'OFF';
      elements.btnToggleElder.setAttribute('aria-pressed', 'false');
    }
  }

  // ==========================================================================
  // Authentication & Session
  // ==========================================================================
  async function checkSession() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.authenticated) {
        setUserSession({
          role: data.role,
          viewOnly: data.viewOnly,
          profile: data.profile
        });
        showDashboard();
      } else {
        showLoginView();
      }
    } catch (err) {
      console.warn('Session check failed:', err);
      showLoginView();
    }
  }

  function setUserSession(user) {
    state.currentUser = user;

    // UI Updates
    elements.btnLogout.classList.remove('hidden');
    elements.profileBar.classList.remove('hidden');
    elements.roleBadge.classList.remove('hidden');
    elements.mainNav.classList.remove('hidden');

    // Role Badge details
    elements.roleBadgeText.textContent = user.role.toUpperCase();
    elements.roleBadge.className = `role-badge role-${user.role}`;

    let roleIcon = '👵';
    if (user.role === 'caretaker') roleIcon = '🩺';
    if (user.role === 'family') roleIcon = '👨‍👩‍👧';
    elements.roleBadgeIcon.textContent = roleIcon;

    // Family View-Only Controls
    if (user.viewOnly) {
      elements.familyBanner.classList.remove('hidden');
      document.querySelectorAll('.role-write-only').forEach(el => el.classList.add('hidden'));
    } else {
      elements.familyBanner.classList.add('hidden');
      document.querySelectorAll('.role-write-only').forEach(el => el.classList.remove('hidden'));
    }

    if (user.profile) {
      elements.elderNameHeader.textContent = user.profile.name || 'Eleanor Vance';
      elements.elderDetailsHeader.textContent = `Age ${user.profile.age} • Blood Type ${user.profile.bloodType} • Primary: ${user.profile.primaryDoctor?.split('(')[0]}`;
    }
  }

  function showLoginView() {
    state.currentUser = null;
    elements.viewLogin.classList.remove('hidden');
    elements.mainNav.classList.add('hidden');
    elements.btnLogout.classList.add('hidden');
    elements.profileBar.classList.add('hidden');
    elements.roleBadge.classList.add('hidden');
    elements.familyBanner.classList.add('hidden');
    elements.tabPanes.forEach(pane => pane.classList.add('hidden'));
    elements.inputPasscode.value = '';
    elements.loginError.classList.add('hidden');
  }

  function showDashboard() {
    elements.viewLogin.classList.add('hidden');
    elements.mainNav.classList.remove('hidden');
    switchTab(state.currentTab || 'today');
    loadDashboardData();
  }

  async function handleLogin(passcode) {
    elements.loginError.classList.add('hidden');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      showToast(`Welcome! Logged in as ${data.role.toUpperCase()}`, 'success');
      await checkSession();
    } catch (err) {
      elements.loginError.textContent = err.message;
      elements.loginError.classList.remove('hidden');
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      showToast('Logged out successfully.', 'info');
      showLoginView();
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  // ==========================================================================
  // Tab Switching
  // ==========================================================================
  function switchTab(tabName) {
    state.currentTab = tabName;

    elements.navTabs.forEach(tab => {
      const isActive = tab.getAttribute('data-tab') === tabName;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });

    elements.tabPanes.forEach(pane => {
      const isTarget = pane.id === `tab-${tabName}`;
      pane.classList.toggle('hidden', !isTarget);
    });

    // Refresh tab content
    if (tabName === 'today') loadTodaySchedule();
    if (tabName === 'adherence') loadWeeklyAdherence();
    if (tabName === 'medications') loadMedications();
    if (tabName === 'appointments') loadAppointments();
    if (tabName === 'activity') loadActivityLogs();
  }

  async function loadDashboardData() {
    await Promise.all([
      loadTodaySchedule(),
      loadWeeklyAdherence(),
      loadMedications(),
      loadAppointments(),
      loadActivityLogs()
    ]);
  }

  // ==========================================================================
  // TAB 1: Today's Schedule & Dose Tracking
  // ==========================================================================
  async function loadTodaySchedule() {
    try {
      const res = await fetch('/api/doses/today');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      state.schedule = data.schedule || [];

      // Update date header
      const todayDate = new Date();
      const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
      elements.todayDateSubtitle.textContent = todayDate.toLocaleDateString('en-US', options);

      // Update summary pills
      elements.pillTaken.textContent = `${data.summary.taken} Taken`;
      elements.pillMissed.textContent = `${data.summary.missed} Missed`;
      elements.pillPending.textContent = `${data.summary.pending} Pending`;
      elements.navPendingBadge.textContent = data.summary.pending;
      elements.navPendingBadge.style.display = data.summary.pending > 0 ? 'inline-block' : 'none';

      // Update progress bar
      const total = data.summary.total || 1;
      const pct = Math.round((data.summary.taken / total) * 100);
      elements.todayProgressPercent.textContent = `${pct}% Complete`;
      elements.todayProgressBar.setAttribute('aria-valuenow', pct);
      elements.todayProgressFill.style.width = `${pct}%`;

      renderTodayDoses(state.schedule);
    } catch (err) {
      console.error('Failed to load today schedule:', err);
    }
  }

  function renderTodayDoses(doses) {
    elements.todayDosesContainer.innerHTML = '';

    if (doses.length === 0) {
      elements.todayDosesContainer.innerHTML = `
        <div class="card text-center" style="padding: 2.5rem;">
          <p style="font-size: 1.2rem; font-weight: 700;">No doses scheduled for today!</p>
          <p class="text-muted">Take a relaxing break or review full prescriptions in the Medications tab.</p>
        </div>
      `;
      return;
    }

    doses.forEach(dose => {
      const card = document.createElement('div');
      card.className = `dose-card status-${dose.status}`;

      // Time format (e.g. 08:00 -> 8:00 AM)
      const [h, m] = dose.scheduledTime.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      const formattedTime = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;

      let statusBadge = `<span class="dose-status-tag tag-pending">⏳ Due Today</span>`;
      if (dose.status === 'taken') {
        statusBadge = `<span class="dose-status-tag tag-taken">✅ Taken (${dose.loggedBy || 'confirmed'})</span>`;
      } else if (dose.status === 'missed') {
        statusBadge = `<span class="dose-status-tag tag-missed">❌ Missed</span>`;
      }

      // Action buttons
      let actionButtons = '';
      if (!state.currentUser?.viewOnly) {
        actionButtons = `
          <div class="dose-actions">
            <button
              type="button"
              class="btn ${dose.status === 'taken' ? 'btn-outline' : 'btn-success'}"
              data-action="taken"
              data-med-id="${dose.medicationId}"
              data-time="${dose.scheduledTime}"
              aria-label="Mark ${dose.medicationName} at ${dose.scheduledTime} as taken"
            >
              ${dose.status === 'taken' ? '✔ Taken' : 'Mark Taken'}
            </button>
            <button
              type="button"
              class="btn ${dose.status === 'missed' ? 'btn-outline' : 'btn-outline-danger'}"
              data-action="missed"
              data-med-id="${dose.medicationId}"
              data-time="${dose.scheduledTime}"
              aria-label="Mark ${dose.medicationName} at ${dose.scheduledTime} as missed"
            >
              ${dose.status === 'missed' ? '✖ Missed' : 'Mark Missed'}
            </button>
          </div>
        `;
      } else {
        actionButtons = `
          <div class="dose-actions">
            <span class="pill pill-warning" title="Family accounts are view-only">View Only</span>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="dose-card-left">
          <div class="dose-time-box">
            <span class="dose-time">${formattedTime}</span>
            <span class="dose-slot-label">${dose.scheduledTime}</span>
          </div>
          <div class="dose-info">
            <div class="dose-name-row">
              <span class="dose-name">${dose.medicationName}</span>
              <span class="dose-dosage">${dose.dosage}</span>
            </div>
            <p class="dose-instructions">${dose.instructions || 'Take as prescribed'}</p>
            ${statusBadge}
          </div>
        </div>
        ${actionButtons}
      `;

      elements.todayDosesContainer.appendChild(card);
    });

    // Add event listeners for dose marking buttons
    elements.todayDosesContainer.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const action = btn.getAttribute('data-action');
        const medId = btn.getAttribute('data-med-id');
        const time = btn.getAttribute('data-time');
        await markDose(medId, time, action);
      });
    });
  }

  async function markDose(medicationId, scheduledTime, status) {
    try {
      const res = await fetch('/api/doses/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicationId,
          scheduledTime,
          status
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message, status === 'taken' ? 'success' : 'danger');
      await loadTodaySchedule();
      await loadWeeklyAdherence();
      await loadActivityLogs();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  }

  // ==========================================================================
  // TAB 2: Weekly Adherence Dashboard
  // ==========================================================================
  async function loadWeeklyAdherence() {
    try {
      const res = await fetch('/api/adherence/weekly');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      state.adherence = data;

      // Metric numbers
      elements.metricAdherenceRate.textContent = `${data.summary.overallRate}%`;
      elements.metricStatusGrade.textContent = data.summary.statusGrade;
      elements.metricStatusGrade.style.color = data.summary.statusColor;
      elements.metricScoreCircle.style.borderColor = data.summary.statusColor;

      elements.metricDosesTaken.textContent = data.summary.totalTaken;
      elements.metricDosesMissed.textContent = data.summary.totalMissed;
      elements.metricStreakDays.textContent = `${data.summary.streak}d`;

      // Render Bar Chart
      renderAdherenceChart(data.days);

      // Render Table
      renderAdherenceTable(data.days);
    } catch (err) {
      console.error('Failed to load adherence:', err);
    }
  }

  function renderAdherenceChart(days) {
    elements.adherenceChartBars.innerHTML = '';
    const maxVal = Math.max(...days.map(d => (d.taken + d.missed) || d.scheduled || 1), 6);

    days.forEach(day => {
      const col = document.createElement('div');
      col.className = 'chart-col';

      const takenHeight = Math.round((day.taken / maxVal) * 140);
      const missedHeight = Math.round((day.missed / maxVal) * 140);

      col.innerHTML = `
        <span class="chart-col-percent">${day.adherencePercentage}%</span>
        <div class="chart-bar-wrap" title="${day.dayName}: ${day.taken} taken, ${day.missed} missed">
          <div class="bar-segment-taken" style="height: ${takenHeight}px;"></div>
          <div class="bar-segment-missed" style="height: ${missedHeight}px;"></div>
        </div>
        <span class="chart-col-date">${day.dayName}${day.isToday ? ' (Today)' : ''}</span>
      `;
      elements.adherenceChartBars.appendChild(col);
    });
  }

  function renderAdherenceTable(days) {
    elements.adherenceTableBody.innerHTML = '';
    days.forEach(day => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${day.displayDate}</strong> ${day.isToday ? '<span class="pill pill-warning" style="font-size:0.7rem; padding: 2px 6px;">Today</span>' : ''}</td>
        <td>${day.scheduled}</td>
        <td><span class="text-success" style="font-weight: 700;">${day.taken}</span></td>
        <td><span class="text-danger" style="font-weight: 700;">${day.missed}</span></td>
        <td>${day.pending}</td>
        <td><strong>${day.adherencePercentage}%</strong></td>
      `;
      elements.adherenceTableBody.appendChild(tr);
    });
  }

  // ==========================================================================
  // TAB 3: Medications & Gemini AI Natural Language Parser
  // ==========================================================================
  async function loadMedications() {
    try {
      const res = await fetch('/api/medications');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      state.medications = data.medications || [];
      renderMedications(state.medications);
    } catch (err) {
      console.error('Failed to load medications:', err);
    }
  }

  function renderMedications(meds) {
    elements.medicationsGrid.innerHTML = '';

    if (meds.length === 0) {
      elements.medicationsGrid.innerHTML = `<p class="text-muted">No medications on file.</p>`;
      return;
    }

    meds.forEach(med => {
      const card = document.createElement('div');
      card.className = 'card';

      const timesFormatted = (med.scheduleTimes || []).join(', ');
      const daysFormatted = (med.daysOfWeek || []).join(', ');

      let actionButtons = '';
      if (!state.currentUser?.viewOnly) {
        actionButtons = `
          <div class="card-actions">
            <button type="button" class="btn btn-outline btn-sm flex-1" data-edit-med="${med.id}">Edit</button>
            <button type="button" class="btn btn-outline-danger btn-sm" data-delete-med="${med.id}" aria-label="Delete ${med.name}">Delete</button>
          </div>
        `;
      }

      card.innerHTML = `
        <div>
          <div class="card-header-row">
            <div>
              <h3 class="card-title">${med.name}</h3>
              <span class="card-badge">${med.dosage}</span>
            </div>
            <span class="pill pill-success">${med.refillRemaining} refills left</span>
          </div>
          <div class="card-body">
            <p><strong>Instructions:</strong> ${med.instructions || 'As directed'}</p>
            <ul class="card-meta-list">
              <li class="card-meta-item"><strong>Condition:</strong> ${med.purpose || 'Maintenance'}</li>
              <li class="card-meta-item"><strong>Times:</strong> ${timesFormatted}</li>
              <li class="card-meta-item"><strong>Days:</strong> ${daysFormatted}</li>
              <li class="card-meta-item"><strong>Prescriber:</strong> ${med.prescribedBy || 'Physician'}</li>
            </ul>
          </div>
        </div>
        ${actionButtons}
      `;

      elements.medicationsGrid.appendChild(card);
    });

    // Edit and Delete buttons
    elements.medicationsGrid.querySelectorAll('button[data-edit-med]').forEach(btn => {
      btn.addEventListener('click', () => {
        const medId = btn.getAttribute('data-edit-med');
        const med = state.medications.find(m => m.id === medId);
        if (med) openMedicationModal(med);
      });
    });

    elements.medicationsGrid.querySelectorAll('button[data-delete-med]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const medId = btn.getAttribute('data-delete-med');
        if (confirm('Are you sure you want to remove this medication from Eleanor’s regimen?')) {
          await deleteMedication(medId);
        }
      });
    });
  }

  async function deleteMedication(id) {
    try {
      const res = await fetch(`/api/medications/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message, 'info');
      await loadMedications();
      await loadTodaySchedule();
      await loadActivityLogs();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  }

  // ==========================================================================
  // Gemini AI Prescription Assistant
  // ==========================================================================
  async function handleAiParse(promptText) {
    if (!promptText || promptText.trim().length === 0) return;

    elements.aiBtnText.textContent = 'Parsing...';
    elements.aiBtnSpinner.classList.remove('hidden');
    elements.btnAiSubmit.disabled = true;

    try {
      const res = await fetch('/api/ai/parse-medication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Open Add Medication Modal and Auto-populate
      openMedicationModal(data.medication, true);
      showToast(`✨ Successfully auto-populated with AI (${data.source}). Review details below.`, 'success', 5000);
    } catch (err) {
      showToast(`AI Parsing error: ${err.message}`, 'danger');
    } finally {
      elements.aiBtnText.textContent = 'Parse with AI ✨';
      elements.aiBtnSpinner.classList.add('hidden');
      elements.btnAiSubmit.disabled = false;
    }
  }

  // ==========================================================================
  // Medication Modal Handling
  // ==========================================================================
  function openMedicationModal(medData = null, isAiPrefill = false) {
    elements.formMedication.reset();
    renderScheduleTimeInputs(['08:00']);

    if (medData) {
      elements.modalMedTitle.textContent = isAiPrefill
        ? '✨ AI Parsed Medication (Review & Save)'
        : (medData.id ? 'Edit Medication' : 'Add Medication');

      document.getElementById('med-id').value = medData.id || '';
      document.getElementById('med-name').value = medData.name || '';
      document.getElementById('med-dosage').value = medData.dosage || '';
      document.getElementById('med-instructions').value = medData.instructions || '';
      document.getElementById('med-purpose').value = medData.purpose || '';
      document.getElementById('med-doctor').value = medData.prescribedBy || '';
      document.getElementById('med-refills').value = medData.refillRemaining || 30;

      // Schedule Times
      if (Array.isArray(medData.scheduleTimes) && medData.scheduleTimes.length > 0) {
        renderScheduleTimeInputs(medData.scheduleTimes);
      }

      // Days of week checkboxes
      const days = medData.daysOfWeek || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      elements.formMedication.querySelectorAll('input[name="days"]').forEach(cb => {
        cb.checked = days.includes(cb.value);
      });
    } else {
      elements.modalMedTitle.textContent = 'Add Medication';
      document.getElementById('med-id').value = '';
    }

    elements.modalMedication.classList.remove('hidden');
  }

  function renderScheduleTimeInputs(times) {
    elements.scheduleTimesWrapper.innerHTML = '';
    times.forEach(t => {
      const div = document.createElement('div');
      div.className = 'time-input-pill';
      div.innerHTML = `
        <input type="time" class="form-input" style="padding: 2px 6px; width: 105px;" value="${t}" required>
        <button type="button" class="btn-close-pill" style="border:none;background:none;cursor:pointer;color:#94a3b8;" aria-label="Remove time">&times;</button>
      `;
      div.querySelector('.btn-close-pill').addEventListener('click', () => {
        if (elements.scheduleTimesWrapper.children.length > 1) {
          div.remove();
        } else {
          showToast('At least one schedule time is required', 'warning');
        }
      });
      elements.scheduleTimesWrapper.appendChild(div);
    });
  }

  async function handleSaveMedication(e) {
    e.preventDefault();
    const id = document.getElementById('med-id').value;
    const name = document.getElementById('med-name').value.trim();
    const dosage = document.getElementById('med-dosage').value.trim();
    const instructions = document.getElementById('med-instructions').value.trim();
    const purpose = document.getElementById('med-purpose').value.trim();
    const prescribedBy = document.getElementById('med-doctor').value.trim();
    const refillRemaining = parseInt(document.getElementById('med-refills').value, 10) || 0;

    // Collect schedule times
    const timeInputs = elements.scheduleTimesWrapper.querySelectorAll('input[type="time"]');
    const scheduleTimes = Array.from(timeInputs).map(inp => inp.value).filter(Boolean);

    // Collect days
    const checkedDays = Array.from(elements.formMedication.querySelectorAll('input[name="days"]:checked')).map(cb => cb.value);

    const payload = {
      name,
      dosage,
      instructions,
      purpose,
      prescribedBy,
      refillRemaining,
      scheduleTimes: scheduleTimes.length > 0 ? scheduleTimes : ['08:00'],
      daysOfWeek: checkedDays.length > 0 ? checkedDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    };

    try {
      const url = id ? `/api/medications/${id}` : '/api/medications';
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message, 'success');
      elements.modalMedication.classList.add('hidden');
      await loadMedications();
      await loadTodaySchedule();
      await loadActivityLogs();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  }

  // ==========================================================================
  // TAB 4: Doctor Appointments
  // ==========================================================================
  async function loadAppointments() {
    try {
      const res = await fetch('/api/appointments');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      state.appointments = data.appointments || [];
      renderAppointments(state.appointments);
    } catch (err) {
      console.error('Failed to load appointments:', err);
    }
  }

  function renderAppointments(apts) {
    elements.appointmentsContainer.innerHTML = '';

    if (apts.length === 0) {
      elements.appointmentsContainer.innerHTML = `<p class="text-muted">No upcoming appointments scheduled.</p>`;
      return;
    }

    apts.forEach(apt => {
      const card = document.createElement('div');
      card.className = 'appointment-card';

      // Parse date components
      const [year, month, day] = apt.date.split('-');
      const dateObj = new Date(year, month - 1, day);
      const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });

      // Format time
      const [h, m] = apt.time.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      const formattedTime = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;

      let actions = '';
      if (!state.currentUser?.viewOnly) {
        actions = `
          <div class="appointment-actions" style="display:flex;gap:0.5rem;">
            <button type="button" class="btn btn-outline btn-sm" data-edit-apt="${apt.id}">Edit</button>
            <button type="button" class="btn btn-outline-danger btn-sm" data-delete-apt="${apt.id}" aria-label="Cancel appointment with ${apt.doctorName}">Cancel</button>
          </div>
        `;
      }

      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1.25rem;">
          <div class="appointment-date-badge">
            <span class="apt-month">${monthName}</span>
            <span class="apt-day">${day}</span>
            <span class="apt-time">${formattedTime}</span>
          </div>
          <div class="appointment-info">
            <div>
              <span class="apt-doctor-name">${apt.doctorName}</span>
              <span class="apt-specialty">${apt.specialty}</span>
            </div>
            <p class="apt-title">${apt.title}</p>
            <p class="apt-location">📍 ${apt.location || 'Consultation Office'}</p>
            ${apt.notes ? `<p class="apt-notes">📝 ${apt.notes}</p>` : ''}
          </div>
        </div>
        ${actions}
      `;

      elements.appointmentsContainer.appendChild(card);
    });

    elements.appointmentsContainer.querySelectorAll('button[data-edit-apt]').forEach(btn => {
      btn.addEventListener('click', () => {
        const aptId = btn.getAttribute('data-edit-apt');
        const apt = state.appointments.find(a => a.id === aptId);
        if (apt) openAppointmentModal(apt);
      });
    });

    elements.appointmentsContainer.querySelectorAll('button[data-delete-apt]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const aptId = btn.getAttribute('data-delete-apt');
        if (confirm('Cancel this doctor visit?')) {
          await deleteAppointment(aptId);
        }
      });
    });
  }

  function openAppointmentModal(aptData = null) {
    elements.formAppointment.reset();

    if (aptData) {
      elements.modalAptTitle.textContent = 'Edit Appointment';
      document.getElementById('apt-id').value = aptData.id || '';
      document.getElementById('apt-doctor').value = aptData.doctorName || '';
      document.getElementById('apt-specialty').value = aptData.specialty || '';
      document.getElementById('apt-title-input').value = aptData.title || '';
      document.getElementById('apt-date').value = aptData.date || '';
      document.getElementById('apt-time').value = aptData.time || '';
      document.getElementById('apt-location').value = aptData.location || '';
      document.getElementById('apt-notes').value = aptData.notes || '';
    } else {
      elements.modalAptTitle.textContent = 'Schedule Doctor Visit';
      document.getElementById('apt-id').value = '';
      // Default to tomorrow 10:00 AM
      const tmrw = new Date();
      tmrw.setDate(tmrw.getDate() + 1);
      const yyyy = tmrw.getFullYear();
      const mm = String(tmrw.getMonth() + 1).padStart(2, '0');
      const dd = String(tmrw.getDate()).padStart(2, '0');
      document.getElementById('apt-date').value = `${yyyy}-${mm}-${dd}`;
      document.getElementById('apt-time').value = '10:00';
    }

    elements.modalAppointment.classList.remove('hidden');
  }

  async function handleSaveAppointment(e) {
    e.preventDefault();
    const id = document.getElementById('apt-id').value;
    const doctorName = document.getElementById('apt-doctor').value.trim();
    const specialty = document.getElementById('apt-specialty').value.trim();
    const title = document.getElementById('apt-title-input').value.trim();
    const date = document.getElementById('apt-date').value;
    const time = document.getElementById('apt-time').value;
    const location = document.getElementById('apt-location').value.trim();
    const notes = document.getElementById('apt-notes').value.trim();

    const payload = { doctorName, specialty, title, date, time, location, notes };

    try {
      const url = id ? `/api/appointments/${id}` : '/api/appointments';
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message, 'success');
      elements.modalAppointment.classList.add('hidden');
      await loadAppointments();
      await loadActivityLogs();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  }

  async function deleteAppointment(id) {
    try {
      const res = await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message, 'info');
      await loadAppointments();
      await loadActivityLogs();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  }

  // ==========================================================================
  // TAB 5: Activity & Reminder Stream
  // ==========================================================================
  async function loadActivityLogs() {
    try {
      const res = await fetch('/api/activity-logs');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      state.activityLogs = data.logs || [];
      renderActivityLogs(state.activityLogs);
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    }
  }

  function renderActivityLogs(logs) {
    elements.activityLogsContainer.innerHTML = '';

    if (logs.length === 0) {
      elements.activityLogsContainer.innerHTML = `<li class="text-muted">No activity records yet.</li>`;
      return;
    }

    logs.forEach(log => {
      const li = document.createElement('li');
      li.className = 'activity-item';

      let icon = '📌';
      if (log.action.includes('DOSE_TAKEN')) icon = '✅';
      else if (log.action.includes('DOSE_MISSED') || log.action.includes('MISSED_DOSE')) icon = '⚠️';
      else if (log.action.includes('REMINDER')) icon = '🔔';
      else if (log.action.includes('APPOINTMENT')) icon = '🗓️';
      else if (log.action.includes('MEDICATION')) icon = '💊';

      const timeAgo = formatTimeAgo(new Date(log.timestamp));

      li.innerHTML = `
        <div class="activity-icon-bubble" aria-hidden="true">${icon}</div>
        <div class="activity-text-group">
          <p class="activity-desc">${log.description}</p>
          <div class="activity-meta">
            <span>By: <strong>${log.performedBy}</strong></span>
            <span>•</span>
            <time datetime="${log.timestamp}">${timeAgo}</time>
          </div>
        </div>
      `;
      elements.activityLogsContainer.appendChild(li);
    });
  }

  function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // ==========================================================================
  // Trigger Reminders & Cron
  // ==========================================================================
  async function triggerTestReminder() {
    try {
      showToast('Dispatching test health reminder...', 'info');
      const res = await fetch('/api/reminders/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message, 'success', 6000);
      await loadActivityLogs();
    } catch (err) {
      showToast(`Reminder failed: ${err.message}`, 'danger');
    }
  }

  async function triggerCronReminders() {
    try {
      showToast('Evaluating upcoming doses, missed doses, and appointments...', 'info');
      const res = await fetch('/api/cron/run-reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': 'carecircle-cron-secret-token'
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(`Cron Cycle Complete: ${data.sentCount} alert(s) processed.`, 'success', 5000);
      await loadActivityLogs();
    } catch (err) {
      showToast(`Cron failed: ${err.message}`, 'danger');
    }
  }

  // ==========================================================================
  // Event Listeners Setup
  // ==========================================================================
  function setupEventListeners() {
    // Navigation Tabs
    elements.navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        switchTab(tabName);
      });
    });

    // Login Form
    elements.formLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = elements.inputPasscode.value.trim();
      if (code) handleLogin(code);
    });

    // Role Card Quick Clicks
    document.querySelectorAll('.role-card').forEach(card => {
      card.addEventListener('click', () => {
        const code = card.getAttribute('data-passcode');
        elements.inputPasscode.value = code;
        handleLogin(code);
      });
    });

    // Keypad Clicks
    document.querySelectorAll('.keypad-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-key');
        if (key === 'clear') {
          elements.inputPasscode.value = '';
        } else if (key === 'back') {
          elements.inputPasscode.value = elements.inputPasscode.value.slice(0, -1);
        } else {
          if (elements.inputPasscode.value.length < 8) {
            elements.inputPasscode.value += key;
          }
        }
      });
    });

    // Passcode Visibility
    elements.btnTogglePasscodeVis.addEventListener('click', () => {
      const isPwd = elements.inputPasscode.type === 'password';
      elements.inputPasscode.type = isPwd ? 'text' : 'password';
      elements.btnTogglePasscodeVis.textContent = isPwd ? '🔒' : '👁️';
    });

    // Logout
    elements.btnLogout.addEventListener('click', handleLogout);

    // Test Reminder Button
    elements.btnSendTestReminder.addEventListener('click', triggerTestReminder);

    // Refresh Buttons
    elements.btnRefreshAdherence.addEventListener('click', loadWeeklyAdherence);
    elements.btnRefreshLogs.addEventListener('click', loadActivityLogs);
    elements.btnTriggerCron.addEventListener('click', triggerCronReminders);

    // Gemini AI Form & Chips
    elements.formAiParse.addEventListener('submit', (e) => {
      e.preventDefault();
      handleAiParse(elements.inputAiPrompt.value);
    });

    document.querySelectorAll('.prompt-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const example = chip.getAttribute('data-example');
        elements.inputAiPrompt.value = example;
        handleAiParse(example);
      });
    });

    // Modal Triggers
    elements.btnOpenAddMed.addEventListener('click', () => openMedicationModal());
    elements.formMedication.addEventListener('submit', handleSaveMedication);
    elements.btnAddScheduleTime.addEventListener('click', () => {
      const currentTimes = Array.from(elements.scheduleTimesWrapper.querySelectorAll('input[type="time"]')).map(i => i.value);
      currentTimes.push('12:00');
      renderScheduleTimeInputs(currentTimes);
    });

    elements.btnOpenAddApt.addEventListener('click', () => openAppointmentModal());
    elements.formAppointment.addEventListener('submit', handleSaveAppointment);

    // Close Modals
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close');
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('hidden');
      });
    });

    // Keyboard Shortcuts (Escape to close modals)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        elements.modalMedication.classList.add('hidden');
        elements.modalAppointment.classList.add('hidden');
      }
    });
  }

  // Application Initialization
  async function init() {
    initElderMode();
    setupEventListeners();
    await checkSession();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
