// ========================================
// Coach Dashboard — SaaS Command Center
// ========================================

import { registerScreen, getCurrentUser, showToast, escapeHtml } from '../app.js';
import { getUserData } from '../app.js';
import { getEmotionLabel } from '../data/emotions.js';
import {
  getClientsByCoach, subscribeToEntries, todayStr, formatTime,
  calcDailyTotals, countByEmotion, updateUserSettings,
  createAssignment, getAssignments, getAllAssignments, reviewAssignment,
  subscribeToNotifications, markAllNotificationsRead,
  getEntriesForDate, uploadFile
} from '../data/firestore.js';
import { getUserDoc } from '../data/firestore.js';

// ---- Coach Jaynie's UID (used for all coach queries) ----
const COACH_UID = 'bYrV0rVnuMWYtkmtUK9u883kHOO2';

// ---- State ----
let selectedClientId = null;
let unsubClientEntries = null;
let unsubLogEntries = null;
let unsubNotifications = null;
let cachedClients = [];
let cachedAllAssignments = [];
let cachedClientVibes = {}; // { clientId: { net, entries, status, label, color } }
let currentPage = 'dashboard';
let currentFilter = 'all';
let logViewDate = null; // date string for the coach log tab (null = today)
let assignFilterClient = 'all';       // filter for client workspace assignments
let assignFilterClientFull = 'all';   // filter for client workspace "All Assignments" tab
let assignFilterGlobal = 'all';       // filter for global All Assignments page
let expandedAssignId = null;          // accordion: currently expanded assignment id
let cachedClientAssignments = [];     // cached assignments for current client

// ---- Helpers ----

function getEmbedUrl(url) {
  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  m = url.match(/vimeo\.com\/(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  return null;
}

function renderMedia(url, type, mediaType) {
  const embed = getEmbedUrl(url);
  if (embed) {
    return `<iframe src="${embed}" frameborder="0" allowfullscreen style="width:100%;aspect-ratio:16/9;border-radius:8px;"></iframe>`;
  }
  if (type === 'video' || (mediaType && mediaType.startsWith('video/'))) {
    return `<video src="${url}" controls preload="metadata" style="width:100%;border-radius:8px;"></video>`;
  }
  // Check if URL looks like an image (extension in path or MIME type)
  const lc = url.toLowerCase();
  const isImage = (mediaType && mediaType.startsWith('image/'))
    || /\.(jpg|jpeg|png|gif|webp)/i.test(lc);
  if (isImage) {
    return `<img src="${url}" alt="Attachment" style="width:100%;border-radius:8px;">`;
  }
  // PDF, Word docs, and other files — show as download link
  const fileName = decodeURIComponent(lc).match(/\/([^/?]+)\?/)?.[1] || 'Attachment';
  return `<a href="${url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;color:var(--accent-gold);font-size:0.85rem;text-decoration:underline;">📎 View Attachment</a>`;
}

function timeAgo(seconds) {
  if (!seconds) return '';
  const now = Date.now() / 1000;
  const diff = now - seconds;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return new Date(seconds * 1000).toLocaleDateString();
}

function clientInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function isOverdue(a) {
  if (!a.dueDate || a.status === 'reviewed') return false;
  return a.dueDate < todayStr();
}

function isSentThisWeek(a) {
  if (!a.createdAt?.seconds) return false;
  const weekAgo = (Date.now() / 1000) - 604800;
  return a.createdAt.seconds >= weekAgo;
}

function clientNameById(id) {
  const c = cachedClients.find(cl => cl.id === id);
  return c ? c.name : 'Unknown';
}

// ---- Week Grouping Helpers ----

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekLabel(date) {
  const now = new Date();
  const thisWeekStart = getWeekStart(now);
  const weekStart = getWeekStart(date);
  const diff = Math.round((thisWeekStart - weekStart) / (7 * 86400000));
  if (diff === 0) return 'This Week';
  if (diff === 1) return 'Last Week';
  const mo = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `Week of ${mo}`;
}

function groupByWeek(assignments) {
  const groups = [];
  const map = new Map();
  for (const a of assignments) {
    const ts = a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date();
    const ws = getWeekStart(ts).getTime();
    if (!map.has(ws)) {
      const group = { key: ws, label: weekLabel(ts), startDate: new Date(ws), assignments: [] };
      map.set(ws, group);
      groups.push(group);
    }
    map.get(ws).assignments.push(a);
  }
  // Sort groups newest first
  groups.sort((a, b) => b.key - a.key);
  return groups;
}

function formatAssignDate(createdAt) {
  if (!createdAt?.seconds) return '';
  const d = new Date(createdAt.seconds * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOlderThan4Weeks(createdAt) {
  if (!createdAt?.seconds) return false;
  const fourWeeksAgo = (Date.now() / 1000) - (28 * 86400);
  return createdAt.seconds < fourWeeksAgo;
}

// ---- Vibration Status ----

function getVibeStatus(net, entryCount) {
  if (entryCount === 0) return { status: 'inactive', label: 'No Activity', color: 'var(--text-muted)' };
  // Net < 0 means they burned more than they gained = positive vibration (good)
  // Net >= 0 means they haven't made progress = negative vibration (needs work)
  if (net < 0) return { status: 'positive', label: 'Positive Vibration', color: 'var(--tier-green)' };
  return { status: 'negative', label: 'Negative Vibration', color: 'var(--tier-red)' };
}

async function loadClientVibes(clients) {
  const today = todayStr();
  const vibes = {};

  await Promise.all(clients.map(async (c) => {
    try {
      const entries = await getEntriesForDate(c.id, today);
      const totals = calcDailyTotals(entries);
      const vibe = getVibeStatus(totals.net, entries.length);
      vibes[c.id] = {
        net: totals.net,
        redTotal: totals.redTotal,
        positiveTotal: totals.positiveTotal,
        entries: entries.length,
        ...vibe
      };
    } catch (e) {
      vibes[c.id] = { net: 0, redTotal: 0, positiveTotal: 0, entries: 0, status: 'inactive', label: 'No Activity', color: 'var(--text-muted)' };
    }
  }));

  cachedClientVibes = vibes;
  return vibes;
}

function renderVibeIndicator(clientId) {
  const v = cachedClientVibes[clientId];
  if (!v || v.status === 'inactive') {
    return '<span class="vibe-indicator vibe-inactive">No Activity</span>';
  }
  const cls = v.status === 'positive' ? 'vibe-positive' : 'vibe-negative';
  return `<span class="vibe-indicator ${cls}">${v.label}</span>`;
}

// ---- Page Navigation ----

function navigateTo(page) {
  currentPage = page;
  // Update sidebar
  document.querySelectorAll('#sidebar-nav .sidebar-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
  // Update mobile pills
  document.querySelectorAll('#coach-mobile-pills .coach-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
  // Show page
  document.querySelectorAll('#screen-coach .coach-page').forEach(p => {
    p.classList.toggle('active', p.id === `coach-page-${page}`);
  });
  // Close mobile sidebar if open
  closeMobileSidebar();
  // Reset client workspace when leaving clients
  if (page !== 'clients') {
    hideWorkspace();
  }
  // Load page-specific data
  if (page === 'dashboard') loadDashboard();
  if (page === 'clients') loadClients();
  if (page === 'review') loadReviewQueue();
  if (page === 'assignments') loadAllAssignments();
  if (page === 'insights') loadGlobalInsights();
  if (page === 'log') loadGlobalLog();
}

function openMobileSidebar() {
  document.getElementById('coach-sidebar').classList.add('open');
  document.getElementById('coach-sidebar-overlay').classList.add('active');
}

function closeMobileSidebar() {
  document.getElementById('coach-sidebar').classList.remove('open');
  document.getElementById('coach-sidebar-overlay').classList.remove('active');
}

// ---- Slide Panel ----

function openSlidePanel(clientId) {
  const panel = document.getElementById('coach-slide-panel');
  const overlay = document.getElementById('coach-slide-overlay');
  const clientGroup = document.getElementById('slide-client-group');
  const clientSelect = document.getElementById('coach-assign-client');

  // If opened from workspace, pre-select client and hide selector
  if (clientId) {
    clientSelect.value = clientId;
    clientGroup.style.display = 'none';
  } else {
    clientGroup.style.display = '';
    // Populate client dropdown
    clientSelect.innerHTML = '<option value="">Select client...</option>' +
      cachedClients.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  }

  panel.classList.add('open');
  overlay.classList.add('active');
}

function closeSlidePanel() {
  document.getElementById('coach-slide-panel').classList.remove('open');
  document.getElementById('coach-slide-overlay').classList.remove('active');
}

function clearAssignmentForm() {
  document.getElementById('coach-assign-title').value = '';
  document.getElementById('coach-assign-field-1').value = '';
  document.getElementById('coach-assign-field-2').value = '';
  document.getElementById('coach-assign-field-3').value = '';
  document.getElementById('coach-assign-field-4').value = '';
  document.getElementById('coach-assign-due').value = '';
  document.getElementById('coach-assign-url').value = '';
  document.querySelectorAll('.coach-video-url').forEach(i => i.value = '');
  document.getElementById('coach-video-slots').style.display = 'none';
  const fileInput = document.getElementById('coach-assign-file');
  if (fileInput) fileInput.value = '';
  document.getElementById('coach-assign-type').value = 'task';
  document.getElementById('coach-assign-client').value = '';
}

// ---- Dashboard ----

async function loadDashboard() {
  const user = getCurrentUser();
  if (!user) return;

  try {
    // Load clients + all assignments + vibes in parallel
    const [clients, allAssign] = await Promise.all([
      getClientsByCoach(COACH_UID),
      getAllAssignments(COACH_UID)
    ]);
    cachedClients = clients;
    cachedAllAssignments = allAssign;

    // Load vibration data for all clients
    await loadClientVibes(clients);

    // KPIs
    const needsReview = allAssign.filter(a => a.status === 'submitted');
    const sentWeek = allAssign.filter(isSentThisWeek);
    const overdue = allAssign.filter(isOverdue);

    document.getElementById('kpi-active-clients').textContent = clients.length;
    document.getElementById('kpi-needs-review').textContent = needsReview.length;
    document.getElementById('kpi-sent-week').textContent = sentWeek.length;
    document.getElementById('kpi-overdue').textContent = overdue.length;

    // Update sidebar badge
    const badge = document.getElementById('sidebar-review-badge');
    if (badge) {
      badge.textContent = needsReview.length;
      badge.style.display = needsReview.length > 0 ? 'flex' : 'none';
    }

    // Needs Attention panel — clients with submitted or overdue items
    const attentionEl = document.getElementById('dash-needs-attention');
    const attentionClients = clients.filter(c => {
      const clientAssigns = allAssign.filter(a => a.clientId === c.id);
      return clientAssigns.some(a => a.status === 'submitted') || clientAssigns.some(isOverdue);
    });

    if (attentionClients.length > 0) {
      attentionEl.innerHTML = attentionClients.map(c => {
        const ca = allAssign.filter(a => a.clientId === c.id);
        const revCount = ca.filter(a => a.status === 'submitted').length;
        const overdueCount = ca.filter(isOverdue).length;
        return `
          <div class="client-row" data-client-id="${c.id}" style="margin-bottom:6px">
            <div class="client-row-avatar">${clientInitials(c.name)}</div>
            <div class="client-row-info">
              <div class="client-row-name">${escapeHtml(c.name)}</div>
            </div>
            <div class="client-row-stats">
              ${revCount > 0 ? `<span class="client-stat-pill review">${revCount} to review</span>` : ''}
              ${overdueCount > 0 ? `<span class="client-stat-pill overdue">${overdueCount} overdue</span>` : ''}
            </div>
          </div>
        `;
      }).join('');
      attentionEl.querySelectorAll('.client-row').forEach(row => {
        row.addEventListener('click', () => {
          navigateTo('clients');
          setTimeout(() => openClientWorkspace(row.dataset.clientId), 100);
        });
      });
    } else {
      attentionEl.innerHTML = '<p class="text-muted" style="padding:12px 0">All caught up!</p>';
    }

    // Recent Submissions panel
    const subEl = document.getElementById('dash-recent-submissions');
    const recentSubs = allAssign
      .filter(a => a.status === 'submitted' || a.status === 'reviewed')
      .slice(0, 5);

    if (recentSubs.length > 0) {
      subEl.innerHTML = recentSubs.map(a => `
        <div class="activity-item">
          <div class="activity-dot ${a.status === 'submitted' ? 'blue' : 'green'}"></div>
          <div class="activity-text">
            <strong>${escapeHtml(clientNameById(a.clientId))}</strong> ${a.status === 'submitted' ? 'submitted' : 'reviewed'}: ${escapeHtml(a.title)}
          </div>
          <div class="activity-time">${timeAgo(a.submittedAt?.seconds || a.reviewedAt?.seconds)}</div>
        </div>
      `).join('');
    } else {
      subEl.innerHTML = '<p class="text-muted" style="padding:12px 0">No submissions yet.</p>';
    }

    // Recent Activity panel
    const actEl = document.getElementById('dash-recent-activity');
    const recent = allAssign.slice(0, 8);
    if (recent.length > 0) {
      actEl.innerHTML = recent.map(a => {
        let dotColor = 'yellow';
        let verb = 'created';
        if (a.status === 'submitted') { dotColor = 'blue'; verb = 'submitted'; }
        if (a.status === 'reviewed') { dotColor = 'green'; verb = 'reviewed'; }
        const ts = a.reviewedAt?.seconds || a.submittedAt?.seconds || a.createdAt?.seconds;
        return `
          <div class="activity-item">
            <div class="activity-dot ${dotColor}"></div>
            <div class="activity-text">${escapeHtml(a.title)} — <span style="color:var(--text-muted)">${verb}</span></div>
            <div class="activity-time">${timeAgo(ts)}</div>
          </div>
        `;
      }).join('');
    } else {
      actEl.innerHTML = '<p class="text-muted" style="padding:12px 0">No activity yet.</p>';
    }

    // Vibration Overview panel
    const vibeEl = document.getElementById('dash-vibration-overview');
    if (vibeEl && clients.length > 0) {
      const vibeValues = Object.values(cachedClientVibes);
      const posCount = vibeValues.filter(v => v.status === 'positive').length;
      const negCount = vibeValues.filter(v => v.status === 'negative').length;
      const inactiveCount = vibeValues.filter(v => v.status === 'inactive').length;

      vibeEl.innerHTML = `
        <div class="vibe-summary-grid vibe-summary-3">
          <div class="vibe-summary-item vibe-summary-positive">
            <span class="vibe-summary-count">${posCount}</span>
            <span class="vibe-summary-label">Positive</span>
          </div>
          <div class="vibe-summary-item vibe-summary-negative">
            <span class="vibe-summary-count">${negCount}</span>
            <span class="vibe-summary-label">Negative</span>
          </div>
          <div class="vibe-summary-item vibe-summary-inactive">
            <span class="vibe-summary-count">${inactiveCount}</span>
            <span class="vibe-summary-label">No Activity</span>
          </div>
        </div>
        <div class="vibe-client-list">
          ${clients.map(c => {
            const v = cachedClientVibes[c.id];
            if (!v) return '';
            return `
              <div class="vibe-client-row" data-client-id="${c.id}">
                <div class="client-row-avatar" style="width:30px;height:30px;font-size:0.7rem">${clientInitials(c.name)}</div>
                <span class="vibe-client-name">${escapeHtml(c.name)}</span>
                ${renderVibeIndicator(c.id)}
              </div>
            `;
          }).join('')}
        </div>
      `;

      vibeEl.querySelectorAll('.vibe-client-row').forEach(row => {
        row.addEventListener('click', () => {
          navigateTo('clients');
          setTimeout(() => openClientWorkspace(row.dataset.clientId), 100);
        });
      });
    }
  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

// ---- Client List ----

async function loadClients() {
  const user = getCurrentUser();
  if (!user) return;

  const listEl = document.getElementById('coach-client-list');

  try {
    const [clients, allAssign] = await Promise.all([
      getClientsByCoach(COACH_UID),
      getAllAssignments(COACH_UID)
    ]);
    cachedClients = clients;
    cachedAllAssignments = allAssign;

    if (clients.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <h2>No Clients Yet</h2>
          <p>When clients register, they will automatically appear here.</p>
        </div>
      `;
      return;
    }

    // Load vibration data if not cached yet
    if (Object.keys(cachedClientVibes).length === 0) {
      await loadClientVibes(clients);
    }

    renderClientList(clients, allAssign);
  } catch (err) {
    console.error('Failed to load clients:', err);
    showToast('Failed to load clients');
  }
}

function renderClientList(clients, allAssign) {
  const listEl = document.getElementById('coach-client-list');

  // Apply filter
  let filtered = clients;
  if (currentFilter === 'review') {
    filtered = clients.filter(c => allAssign.some(a => a.clientId === c.id && a.status === 'submitted'));
  } else if (currentFilter === 'overdue') {
    filtered = clients.filter(c => allAssign.some(a => a.clientId === c.id && isOverdue(a)));
  } else if (currentFilter === 'active') {
    filtered = clients.filter(c => allAssign.some(a => a.clientId === c.id && (!a.status || a.status === 'pending')));
  } else if (currentFilter === 'positive') {
    filtered = clients.filter(c => {
      const v = cachedClientVibes[c.id];
      return v && v.status === 'positive';
    });
  } else if (currentFilter === 'negative') {
    filtered = clients.filter(c => {
      const v = cachedClientVibes[c.id];
      return v && v.status === 'negative';
    });
  }

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="empty-state"><p>No clients match this filter.</p></div>';
    return;
  }

  listEl.innerHTML = filtered.map(c => {
    const ca = allAssign.filter(a => a.clientId === c.id);
    const revCount = ca.filter(a => a.status === 'submitted').length;
    const pendCount = ca.filter(a => !a.status || a.status === 'pending').length;
    const overdueCount = ca.filter(isOverdue).length;

    return `
      <div class="client-row" data-client-id="${c.id}">
        <div class="client-row-avatar">${clientInitials(c.name)}</div>
        <div class="client-row-info">
          <div class="client-row-name">${escapeHtml(c.name)}</div>
          <div class="client-row-email">${escapeHtml(c.email)}</div>
        </div>
        <div class="client-row-stats">
          ${renderVibeIndicator(c.id)}
          ${revCount > 0 ? `<span class="client-stat-pill review">${revCount} to review</span>` : ''}
          ${pendCount > 0 ? `<span class="client-stat-pill pending">${pendCount} active</span>` : ''}
          ${overdueCount > 0 ? `<span class="client-stat-pill overdue">${overdueCount} overdue</span>` : ''}
        </div>
        <button class="client-row-action">Open</button>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.client-row').forEach(row => {
    row.addEventListener('click', () => openClientWorkspace(row.dataset.clientId));
  });
}

// ---- Client Workspace ----

function showWorkspace() {
  document.getElementById('clients-list-view').style.display = 'none';
  document.getElementById('clients-workspace-view').style.display = '';
}

function hideWorkspace() {
  document.getElementById('clients-list-view').style.display = '';
  document.getElementById('clients-workspace-view').style.display = 'none';
  if (unsubClientEntries) {
    unsubClientEntries();
    unsubClientEntries = null;
  }
  if (unsubLogEntries) {
    unsubLogEntries();
    unsubLogEntries = null;
  }
  selectedClientId = null;
  logViewDate = null;
}

function switchWorkspaceTab(tabName) {
  document.querySelectorAll('#workspace-tabs .ws-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.wstab === tabName);
  });
  document.querySelectorAll('.workspace-main .ws-panel').forEach(p => {
    p.style.display = p.id === `ws-panel-${tabName}` ? '' : 'none';
  });
}

async function openClientWorkspace(clientId) {
  selectedClientId = clientId;
  showWorkspace();
  navigateToPage('clients');

  const user = getCurrentUser();
  if (user) {
    markAllNotificationsRead(COACH_UID).catch(() => {});
  }

  try {
    const client = await getUserDoc(clientId);
    if (!client) {
      showToast('Client not found');
      return;
    }
    document.getElementById('coach-detail-name').textContent = client.name;
    document.getElementById('coach-goal-daily').value = client.goals?.dailyTarget || '';
    document.getElementById('coach-goal-weekly').value = client.goals?.weeklyTarget || '';
    renderClientFearsGratitudes(client);
  } catch (err) {
    console.error('Failed to load client:', err);
  }

  // Subscribe to today's entries for stats/overview
  if (unsubClientEntries) unsubClientEntries();
  unsubClientEntries = subscribeToEntries(clientId, todayStr(), (entries) => {
    renderClientStats(entries);
    renderRedSummary(entries);
  }, (err) => {
    console.error('Client entries error:', err);
  });

  // Initialize log view to today
  logViewDate = todayStr();
  loadLogForDate(clientId, logViewDate);

  loadClientAssignments(clientId);
  switchWorkspaceTab('overview');
}

// ---- Coach Log Date Navigation ----

function formatLogDateLabel(dateStr) {
  const today = todayStr();
  if (dateStr === today) return "Today's Log";
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function loadLogForDate(clientId, dateStr) {
  // Update label
  const label = document.getElementById('coach-log-date-label');
  if (label) label.textContent = formatLogDateLabel(dateStr);

  // Disable next button if viewing today
  const nextBtn = document.getElementById('coach-log-next');
  if (nextBtn) nextBtn.disabled = (dateStr >= todayStr());

  // Unsubscribe previous log listener
  if (unsubLogEntries) unsubLogEntries();

  // Subscribe to entries for the selected date
  unsubLogEntries = subscribeToEntries(clientId, dateStr, (entries) => {
    renderClientLog(entries);
  }, (err) => {
    console.error('Log entries error:', err);
  });
}

// Navigate to page without re-triggering loads (for internal use)
function navigateToPage(page) {
  document.querySelectorAll('#sidebar-nav .sidebar-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
  document.querySelectorAll('#coach-mobile-pills .coach-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
  document.querySelectorAll('#screen-coach .coach-page').forEach(p => {
    p.classList.toggle('active', p.id === `coach-page-${page}`);
  });
}

// ---- Client Data Renderers ----

function renderClientFearsGratitudes(client) {
  const fears = client.settings?.topFears || [];
  const fearCounts = client.settings?.fearCounts || [];
  const gratitudes = client.settings?.gratitudes || [];

  const fearsEl = document.getElementById('coach-client-fears-list');
  const gratEl = document.getElementById('coach-client-gratitudes-list');

  const filledFears = fears.map((f, i) => ({ text: f, count: fearCounts[i] || 0 })).filter(f => f.text);
  const filledGrats = gratitudes.filter(g => g);
  const fearTotal = filledFears.reduce((s, f) => s + f.count, 0);

  fearsEl.innerHTML = filledFears.length > 0
    ? `<h4 class="coach-sub-title" style="padding:0">Fears (${filledFears.length}) — ${fearTotal} total</h4>` +
      filledFears.map(f => `<div class="coach-list-item coach-fear-item" style="display:flex;justify-content:space-between"><span>${escapeHtml(f.text)}</span><span style="font-weight:700">${f.count}x</span></div>`).join('')
    : '<p class="text-muted" style="font-size:0.82rem;font-style:italic">No fears entered yet.</p>';

  gratEl.innerHTML = filledGrats.length > 0
    ? `<h4 class="coach-sub-title" style="padding:0;margin-top:12px">Grateful For (${filledGrats.length})</h4>` +
      filledGrats.map(g => `<div class="coach-list-item coach-grat-item">${escapeHtml(g)}</div>`).join('')
    : '<p class="text-muted" style="font-size:0.82rem;font-style:italic;margin-top:8px">No gratitudes entered yet.</p>';
}

function renderClientStats(entries) {
  const totals = calcDailyTotals(entries);
  const totalCal = totals.net;
  document.getElementById('coach-stat-cal').textContent = (totalCal > 0 ? '+' : '') + totalCal.toLocaleString();
  document.getElementById('coach-stat-entries').textContent = entries.length;

  const goalDaily = parseInt(document.getElementById('coach-goal-daily').value, 10) || 0;
  const statusEl = document.getElementById('coach-stat-goal');
  if (goalDaily > 0) {
    const burned = Math.abs(Math.min(0, totalCal));
    statusEl.textContent = burned >= goalDaily ? 'Met' : 'Not Met';
    statusEl.style.color = burned >= goalDaily ? 'var(--tier-green)' : 'var(--tier-red)';
  } else {
    statusEl.textContent = '--';
    statusEl.style.color = '';
  }

  // Update workspace vibration status
  const vibe = getVibeStatus(totalCal, entries.length);
  const vibeEl = document.getElementById('ws-vibe-status');
  if (vibeEl) {
    const cls = vibe.status === 'positive' ? 'vibe-positive' : vibe.status === 'negative' ? 'vibe-negative' : 'vibe-inactive';
    const sign = totalCal > 0 ? '+' : '';
    vibeEl.innerHTML = `
      <div class="ws-vibe-big ${cls}">
        <span class="ws-vibe-label">${vibe.label}</span>
        ${entries.length > 0 ? `<span class="ws-vibe-score">${sign}${totalCal.toLocaleString()} cal</span>` : ''}
      </div>
      <div class="ws-vibe-breakdown">
        <span class="ws-vibe-detail negative">+${totals.redTotal.toLocaleString()} red</span>
        <span class="ws-vibe-detail positive">${totals.positiveTotal.toLocaleString()} positive</span>
      </div>
    `;
  }
}

function renderClientLog(entries) {
  const logList = document.getElementById('coach-log-list');
  if (entries.length === 0) {
    const isToday = logViewDate === todayStr();
    logList.innerHTML = `<div class="log-empty">No entries ${isToday ? 'yet today' : 'on this date'}.</div>`;
    return;
  }
  logList.innerHTML = entries.map(entry => {
    const time = entry.timestamp ? formatTime(entry.timestamp.toDate()) : '--';
    const label = getEmotionLabel(entry.emotion);
    const cal = entry.calories;
    const sign = cal > 0 ? '+' : '';
    return `
      <div class="log-entry">
        <span class="log-time">${time}</span>
        <span class="log-emotion">${label}${entry.details ? ' &mdash; ' + escapeHtml(entry.details) : ''}</span>
        <span class="log-cal ${entry.tier}">${sign}${cal.toLocaleString()}</span>
      </div>
    `;
  }).join('');
}

function renderRedSummary(entries) {
  const redEntries = entries.filter(e => e.tier === 'red');
  const summaryList = document.getElementById('coach-red-summary');

  if (redEntries.length === 0) {
    summaryList.innerHTML = '<p class="text-muted">No red thoughts logged today.</p>';
    return;
  }

  const grouped = countByEmotion(redEntries);
  summaryList.innerHTML = Object.entries(grouped).map(([emotion, count]) => `
    <div class="red-item">
      <span>${getEmotionLabel(emotion)}</span>
      <span class="red-count">${count}x</span>
    </div>
  `).join('');
}

// ---- Assignment Cards ----

function renderCoachFileList(files) {
  if (!files || files.length === 0) return '';
  return `
    <div style="margin-bottom:8px">
      <div class="review-expand-label">Attached Files (${files.length})</div>
      ${files.map(f => {
        const isImage = f.type && f.type.startsWith('image/');
        return `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(255,255,255,0.02);border:1px solid var(--border-color);border-radius:6px;margin-bottom:4px">
            ${isImage ? `<img src="${escapeHtml(f.url)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:4px;flex-shrink:0">` : ''}
            <a href="${escapeHtml(f.url)}" target="_blank" style="font-size:0.75rem;color:var(--accent-blue);text-decoration:underline;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(f.name)}</a>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderVideoResponses(a) {
  if (!a.videoResponses || !a.videoLinks) return '';
  const responses = a.videoResponses.filter(r => r);
  if (responses.length === 0) return '';
  return `
    <div style="margin-top:8px">
      <div class="review-expand-label">Video Responses</div>
      ${a.videoLinks.map((url, i) => {
        const resp = a.videoResponses[i];
        if (!resp) return '';
        return `
          <div style="margin-bottom:6px">
            <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:2px">Video ${i + 1}</div>
            <div class="review-expand-response">${escapeHtml(resp)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderAssignCard(a, opts = {}) {
  const statusLabels = { pending: 'Pending', submitted: 'Needs Review', reviewed: 'Reviewed' };
  const status = a.status || 'pending';
  const due = a.dueDate || '';
  const overdue = isOverdue(a);
  const isExpanded = expandedAssignId === a.id;
  const dateStr = formatAssignDate(a.createdAt);
  const statusColor = status === 'submitted' ? 'var(--accent-blue)' : status === 'reviewed' ? 'var(--tier-green)' : '#f0a030';

  return `
    <div class="assign-compact-row${isExpanded ? ' expanded' : ''}" data-assign-id="${a.id}" style="border-left:3px solid ${statusColor}">
      <div class="assign-row-main">
        <div class="assign-row-left">
          <span class="assign-row-title">${escapeHtml(a.title)}</span>
          <span class="assign-row-type">${a.type}${opts.showClient ? ` — ${escapeHtml(clientNameById(a.clientId))}` : ''}</span>
        </div>
        <div class="assign-row-right">
          <span class="status-badge ${status}">${statusLabels[status]}</span>
          ${overdue ? '<span class="assign-row-overdue">Overdue</span>' : (dateStr ? `<span class="assign-row-date">${dateStr}</span>` : '')}
          <svg class="assign-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      <div class="assign-detail"${isExpanded ? '' : ' style="display:none"'}>
        ${a.description ? `<div class="coach-assign-item-desc">${escapeHtml(a.description)}</div>` : ''}
        ${a.mediaUrl ? `<div class="coach-assign-media">${renderMedia(a.mediaUrl, a.type, a.mediaType)}</div>` : ''}
        ${a.videoLinks && a.videoLinks.length > 0 ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:6px">${a.videoLinks.length} video${a.videoLinks.length > 1 ? 's' : ''} assigned</div>` : ''}
        ${due ? `<div class="coach-assign-item-due">${overdue ? '<span style="color:var(--tier-red)">Overdue — </span>' : ''}Due: ${due}</div>` : ''}

        ${status === 'submitted' ? `
          <div class="review-expand">
            <div class="review-expand-label">Client's Response</div>
            <div class="review-expand-response">${escapeHtml(a.response || 'No written response')}</div>
            ${renderVideoResponses(a)}
            ${renderCoachFileList(a.responseFiles)}
            <textarea class="coach-review-note" placeholder="Add feedback (optional)..." rows="2"></textarea>
            <button class="coach-review-btn btn btn-primary" data-id="${a.id}" style="width:100%">Mark Reviewed</button>
          </div>
        ` : ''}

        ${status === 'reviewed' ? `
          <div class="review-expand">
            <div class="review-expand-label">Client's Response</div>
            <div class="review-expand-response">${escapeHtml(a.response || 'No written response')}</div>
            ${renderVideoResponses(a)}
            ${renderCoachFileList(a.responseFiles)}
            ${a.coachNote ? `
              <div class="review-expand-label" style="color:var(--tier-green)">Your Feedback</div>
              <div class="review-expand-response" style="border-left-color:var(--tier-green);background:rgba(68,204,68,0.04)">${escapeHtml(a.coachNote)}</div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function renderWeekGroup(group, opts = {}) {
  const now = new Date();
  const thisWeekStart = getWeekStart(now);
  const isCurrentWeek = group.key === thisWeekStart.getTime();
  const collapsed = !isCurrentWeek;

  return `
    <div class="assign-week-group${collapsed ? ' collapsed' : ''}" data-week="${group.key}">
      <div class="assign-week-header">
        <span class="assign-week-label">${group.label}</span>
        <span class="assign-week-count">${group.assignments.length}</span>
        <svg class="assign-week-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="assign-week-body">
        ${group.assignments.map(a => renderAssignCard(a, opts)).join('')}
      </div>
    </div>
  `;
}

function attachAccordionHandlers(container, refreshFn) {
  // Row click → expand/collapse (accordion)
  container.querySelectorAll('.assign-compact-row').forEach(row => {
    row.querySelector('.assign-row-main').addEventListener('click', () => {
      const id = row.dataset.assignId;
      if (expandedAssignId === id) {
        expandedAssignId = null;
      } else {
        expandedAssignId = id;
      }
      // Toggle details within this container only
      container.querySelectorAll('.assign-compact-row').forEach(r => {
        const detail = r.querySelector('.assign-detail');
        if (r.dataset.assignId === expandedAssignId) {
          r.classList.add('expanded');
          detail.style.display = '';
        } else {
          r.classList.remove('expanded');
          detail.style.display = 'none';
        }
      });
    });
  });

  // Week header click → collapse/expand week
  container.querySelectorAll('.assign-week-header').forEach(header => {
    header.addEventListener('click', () => {
      const group = header.closest('.assign-week-group');
      group.classList.toggle('collapsed');
    });
  });
}

function renderFilteredWeekGroups(assignments, container, opts = {}, refreshFn = null) {
  if (assignments.length === 0) {
    container.innerHTML = '<p class="text-muted" style="padding:16px">No assignments match this filter.</p>';
    return;
  }

  // Separate: recent vs older (reviewed 4+ weeks ago)
  const recent = [];
  const older = [];
  for (const a of assignments) {
    if (a.status === 'reviewed' && isOlderThan4Weeks(a.createdAt)) {
      older.push(a);
    } else {
      recent.push(a);
    }
  }

  const weekGroups = groupByWeek(recent);
  let html = weekGroups.map(g => renderWeekGroup(g, opts)).join('');

  if (older.length > 0) {
    const olderGroups = groupByWeek(older);
    // Show first batch collapsed under "Older" heading
    html += `
      <div class="assign-older-section" data-showing="0">
        <div class="assign-week-header assign-older-header" style="margin-top:8px">
          <span class="assign-week-label">Older</span>
          <span class="assign-week-count">${older.length}</span>
        </div>
        <div class="assign-older-content" style="display:none">
          ${olderGroups.map(g => renderWeekGroup(g, opts)).join('')}
        </div>
        <button class="assign-show-older-btn">Show older assignments</button>
      </div>
    `;
  }

  container.innerHTML = html;

  // "Show older" button
  const olderSection = container.querySelector('.assign-older-section');
  if (olderSection) {
    const btn = olderSection.querySelector('.assign-show-older-btn');
    const content = olderSection.querySelector('.assign-older-content');
    btn.addEventListener('click', () => {
      content.style.display = '';
      btn.style.display = 'none';
      attachAccordionHandlers(content, refreshFn);
      attachReviewHandlers(content, refreshFn);
    });
  }

  attachAccordionHandlers(container, refreshFn);
  if (refreshFn) attachReviewHandlers(container, refreshFn);
}

function setupFilterTabs(tabContainerId, filterVar, assignments, listEl, opts = {}, refreshFn = null) {
  const tabContainer = document.getElementById(tabContainerId);
  if (!tabContainer) return;

  tabContainer.querySelectorAll('.assign-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      tabContainer.querySelectorAll('.assign-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;

      // Update the correct filter variable
      if (tabContainerId === 'assign-filter-tabs') assignFilterClient = filter;
      else if (tabContainerId === 'assign-filter-tabs-full') assignFilterClientFull = filter;
      else if (tabContainerId === 'assign-filter-tabs-global') assignFilterGlobal = filter;

      expandedAssignId = null;
      const filtered = filter === 'all' ? assignments : assignments.filter(a => (a.status || 'pending') === filter);
      renderFilteredWeekGroups(filtered, listEl, opts, refreshFn);
    });
  });
}

function attachReviewHandlers(container, refreshFn) {
  container.querySelectorAll('.coach-review-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const assignId = btn.dataset.id;
      const card = btn.closest('.assign-compact-row') || btn.closest('.coach-assign-item');
      const noteInput = card.querySelector('.coach-review-note');
      const note = noteInput ? noteInput.value.trim() : '';

      btn.disabled = true;
      btn.textContent = 'Saving...';

      try {
        await reviewAssignment(assignId, note);
        showToast('Assignment reviewed!', 'success');
        if (refreshFn) refreshFn();
      } catch (err) {
        console.error('Failed to review:', err);
        showToast('Failed to save review');
        btn.disabled = false;
        btn.textContent = 'Mark Reviewed';
      }
    });
  });
}

// ---- Load Client Assignments (workspace) ----

async function loadClientAssignments(clientId) {
  const listEl = document.getElementById('coach-assign-list');
  const fullEl = document.getElementById('coach-assign-list-full');

  try {
    const assignments = await getAssignments(clientId);
    cachedClientAssignments = assignments;
    expandedAssignId = null;

    const refreshFn = () => loadClientAssignments(clientId);

    // Overview tab — all assignments, week-grouped
    if (assignments.length === 0) {
      listEl.innerHTML = '<p class="text-muted" style="padding:16px">No assignments sent yet.</p>';
    } else {
      const filtered = assignFilterClient === 'all' ? assignments : assignments.filter(a => (a.status || 'pending') === assignFilterClient);
      renderFilteredWeekGroups(filtered, listEl, {}, refreshFn);
    }
    setupFilterTabs('assign-filter-tabs', 'assignFilterClient', assignments, listEl, {}, refreshFn);

    // Full assignments tab — same data, separate filter state
    if (assignments.length === 0) {
      fullEl.innerHTML = '<p class="text-muted" style="padding:16px">No assignments sent yet.</p>';
    } else {
      const filteredFull = assignFilterClientFull === 'all' ? assignments : assignments.filter(a => (a.status || 'pending') === assignFilterClientFull);
      renderFilteredWeekGroups(filteredFull, fullEl, {}, refreshFn);
    }
    setupFilterTabs('assign-filter-tabs-full', 'assignFilterClientFull', assignments, fullEl, {}, refreshFn);

  } catch (err) {
    console.error('Failed to load assignments:', err);
    listEl.innerHTML = '';
    fullEl.innerHTML = '';
  }
}

// ---- Review Queue (global) ----

async function loadReviewQueue() {
  const user = getCurrentUser();
  if (!user) return;

  const el = document.getElementById('coach-review-queue');

  try {
    const [allAssign, clients] = await Promise.all([
      getAllAssignments(COACH_UID),
      cachedClients.length ? Promise.resolve(cachedClients) : getClientsByCoach(COACH_UID)
    ]);
    cachedClients = clients;
    cachedAllAssignments = allAssign;

    const submitted = allAssign.filter(a => a.status === 'submitted');

    if (submitted.length === 0) {
      el.innerHTML = '<div class="empty-state"><h2>All Clear</h2><p>No submissions waiting for review.</p></div>';
      return;
    }

    // Review queue: all cards expanded by default so review controls are visible
    expandedAssignId = null;
    el.innerHTML = submitted.map(a => {
      const saved = expandedAssignId;
      expandedAssignId = a.id; // force expanded
      const html = renderAssignCard(a, { showClient: true });
      expandedAssignId = saved;
      return html;
    }).join('');
    // Make all details visible
    el.querySelectorAll('.assign-detail').forEach(d => d.style.display = '');
    el.querySelectorAll('.assign-compact-row').forEach(r => r.classList.add('expanded'));
    attachReviewHandlers(el, loadReviewQueue);
  } catch (err) {
    console.error('Failed to load review queue:', err);
  }
}

// ---- All Assignments (global) ----

async function loadAllAssignments() {
  const user = getCurrentUser();
  if (!user) return;

  const el = document.getElementById('coach-all-assignments');

  try {
    const allAssign = await getAllAssignments(COACH_UID);
    cachedAllAssignments = allAssign;
    expandedAssignId = null;

    if (allAssign.length === 0) {
      el.innerHTML = '<div class="empty-state"><p>No assignments created yet.</p></div>';
      return;
    }

    const opts = { showClient: true };
    const filtered = assignFilterGlobal === 'all' ? allAssign : allAssign.filter(a => (a.status || 'pending') === assignFilterGlobal);
    renderFilteredWeekGroups(filtered, el, opts, loadAllAssignments);
    setupFilterTabs('assign-filter-tabs-global', 'assignFilterGlobal', allAssign, el, opts, loadAllAssignments);
  } catch (err) {
    console.error('Failed to load all assignments:', err);
  }
}

// ---- Global Insights ----

async function loadGlobalInsights() {
  const el = document.getElementById('coach-global-insights');
  if (cachedClients.length === 0) {
    el.innerHTML = '<div class="empty-state"><p>No clients yet.</p></div>';
    return;
  }

  let html = '';
  for (const client of cachedClients) {
    try {
      const doc = await getUserDoc(client.id);
      if (!doc) continue;
      const fears = doc.settings?.topFears || [];
      const fearCounts = doc.settings?.fearCounts || [];
      const gratitudes = doc.settings?.gratitudes || [];

      const filledFears = fears.map((f, i) => ({ text: f, count: fearCounts[i] || 0 })).filter(f => f.text);
      const filledGrats = gratitudes.filter(g => g);

      if (filledFears.length === 0 && filledGrats.length === 0) continue;

      html += `
        <div class="coach-client-fears" style="margin-bottom:16px">
          <h3>${escapeHtml(client.name)}</h3>
          ${filledFears.length > 0 ? filledFears.map(f => `<div class="coach-list-item coach-fear-item" style="display:flex;justify-content:space-between"><span>${escapeHtml(f.text)}</span><span style="font-weight:700">${f.count}x</span></div>`).join('') : ''}
          ${filledGrats.length > 0 ? `<div style="margin-top:8px">${filledGrats.map(g => `<div class="coach-list-item coach-grat-item">${escapeHtml(g)}</div>`).join('')}</div>` : ''}
        </div>
      `;
    } catch (e) { /* skip */ }
  }

  el.innerHTML = html || '<div class="empty-state"><p>No client insights available yet.</p></div>';
}

// ---- Global Activity Log ----

async function loadGlobalLog() {
  const el = document.getElementById('coach-global-log');

  if (cachedAllAssignments.length === 0) {
    el.innerHTML = '<div class="empty-state"><p>No activity yet.</p></div>';
    return;
  }

  const sorted = [...cachedAllAssignments].sort((a, b) => {
    const tsA = a.reviewedAt?.seconds || a.submittedAt?.seconds || a.createdAt?.seconds || 0;
    const tsB = b.reviewedAt?.seconds || b.submittedAt?.seconds || b.createdAt?.seconds || 0;
    return tsB - tsA;
  });

  el.innerHTML = sorted.slice(0, 20).map(a => {
    let dotColor = 'yellow';
    let verb = 'assigned';
    if (a.status === 'submitted') { dotColor = 'blue'; verb = 'was submitted by'; }
    if (a.status === 'reviewed') { dotColor = 'green'; verb = 'was reviewed for'; }
    const ts = a.reviewedAt?.seconds || a.submittedAt?.seconds || a.createdAt?.seconds;
    return `
      <div class="activity-item">
        <div class="activity-dot ${dotColor}"></div>
        <div class="activity-text"><strong>${escapeHtml(a.title)}</strong> ${verb} <span style="color:var(--accent-blue)">${escapeHtml(clientNameById(a.clientId))}</span></div>
        <div class="activity-time">${timeAgo(ts)}</div>
      </div>
    `;
  }).join('');
}

// ---- Screen Registration ----

registerScreen('coach', {
  init() {
    // Sidebar nav
    document.querySelectorAll('#sidebar-nav .sidebar-item').forEach(btn => {
      if (btn.dataset.page) {
        btn.addEventListener('click', () => navigateTo(btn.dataset.page));
      }
    });

    // Mobile pills
    document.querySelectorAll('#coach-mobile-pills .coach-pill').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.page));
    });

    // Mobile menu toggle
    document.getElementById('coach-mobile-menu').addEventListener('click', openMobileSidebar);
    document.getElementById('coach-sidebar-overlay').addEventListener('click', closeMobileSidebar);

    // Workspace back button
    document.getElementById('coach-back-btn').addEventListener('click', () => {
      hideWorkspace();
      loadClients();
    });

    // Workspace tabs (mobile)
    document.querySelectorAll('#workspace-tabs .ws-tab').forEach(btn => {
      btn.addEventListener('click', () => switchWorkspaceTab(btn.dataset.wstab));
    });

    // Log date navigation
    document.getElementById('coach-log-prev').addEventListener('click', () => {
      if (!selectedClientId || !logViewDate) return;
      logViewDate = shiftDate(logViewDate, -1);
      loadLogForDate(selectedClientId, logViewDate);
    });
    document.getElementById('coach-log-next').addEventListener('click', () => {
      if (!selectedClientId || !logViewDate) return;
      if (logViewDate >= todayStr()) return;
      logViewDate = shiftDate(logViewDate, 1);
      loadLogForDate(selectedClientId, logViewDate);
    });

    // Save goals
    document.getElementById('coach-save-goals').addEventListener('click', async () => {
      if (!selectedClientId) return;
      const daily = parseInt(document.getElementById('coach-goal-daily').value, 10) || 0;
      const weekly = parseInt(document.getElementById('coach-goal-weekly').value, 10) || 0;
      try {
        await updateUserSettings(selectedClientId, 'goals.dailyTarget', daily);
        await updateUserSettings(selectedClientId, 'goals.weeklyTarget', weekly);
        showToast('Goals saved!', 'success');
      } catch (err) {
        showToast('Failed to save goals');
      }
    });

    // Client filters
    document.querySelectorAll('#client-filters .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentFilter = btn.dataset.filter;
        document.querySelectorAll('#client-filters .filter-btn').forEach(b => b.classList.toggle('active', b === btn));
        renderClientList(cachedClients, cachedAllAssignments);
      });
    });

    // New Assignment buttons (header + workspace sidebar)
    document.getElementById('coach-new-assign-btn').addEventListener('click', () => {
      openSlidePanel(selectedClientId || null);
    });
    document.getElementById('coach-ws-new-assign').addEventListener('click', () => {
      if (selectedClientId) openSlidePanel(selectedClientId);
    });

    // Slide panel close
    document.getElementById('coach-slide-close').addEventListener('click', closeSlidePanel);
    document.getElementById('coach-slide-overlay').addEventListener('click', closeSlidePanel);

    // Assignment type change — video slots
    const typeSelect = document.getElementById('coach-assign-type');
    typeSelect.addEventListener('change', () => {
      document.getElementById('coach-video-slots').style.display = typeSelect.value === 'video' ? 'block' : 'none';
    });

    // Send assignment
    document.getElementById('coach-assign-send').addEventListener('click', async () => {
      const user = getCurrentUser();
      if (!user) return;

      const clientSelect = document.getElementById('coach-assign-client');
      const targetClient = selectedClientId || clientSelect.value;

      if (!targetClient) {
        showToast('Please select a client');
        return;
      }

      const type = document.getElementById('coach-assign-type').value;
      const title = document.getElementById('coach-assign-title').value.trim();
      const dueDate = document.getElementById('coach-assign-due').value;
      const fileInput = document.getElementById('coach-assign-file');
      const file = fileInput?.files[0] || null;
      const pastedUrl = document.getElementById('coach-assign-url').value.trim();

      const instructionFields = [
        document.getElementById('coach-assign-field-1').value.trim(),
        document.getElementById('coach-assign-field-2').value.trim(),
        document.getElementById('coach-assign-field-3').value.trim(),
        document.getElementById('coach-assign-field-4').value.trim()
      ];
      const description = instructionFields.filter(f => f).join('\n\n');

      const videoLinks = [];
      document.querySelectorAll('.coach-video-url').forEach(input => {
        const v = input.value.trim();
        if (v) videoLinks.push(v);
      });

      if (!title) {
        showToast('Please enter a title');
        return;
      }

      const sendBtn = document.getElementById('coach-assign-send');
      sendBtn.disabled = true;
      let mediaUrl = pastedUrl;
      let mediaType = '';

      if (file) {
        sendBtn.textContent = 'Uploading...';
        try {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = `assignments/${Date.now()}-${safeName}`;
          mediaUrl = await uploadFile(file, path);
          mediaType = file.type || '';
        } catch (err) {
          console.error('Upload failed:', err);
          showToast('File upload failed — try pasting a URL instead');
          sendBtn.disabled = false;
          sendBtn.textContent = 'Send to Client';
          return;
        }
      }

      sendBtn.textContent = 'Sending...';
      try {
        await createAssignment({
          clientId: targetClient,
          coachId: COACH_UID,
          type,
          title,
          description,
          instructionFields,
          videoLinks,
          dueDate,
          mediaUrl,
          mediaType,
          questions: ''
        });
        showToast('Assignment sent!', 'success');
        clearAssignmentForm();
        closeSlidePanel();

        // Refresh relevant views
        if (selectedClientId === targetClient) {
          loadClientAssignments(targetClient);
        }
        if (currentPage === 'dashboard') loadDashboard();
        if (currentPage === 'assignments') loadAllAssignments();
      } catch (err) {
        console.error('Failed to create assignment:', err);
        showToast('Failed to send assignment');
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send to Client';
      }
    });

    // Logout buttons
    document.getElementById('coach-logout-btn').addEventListener('click', () => {
      if (window.hititLogout) window.hititLogout();
    });
    document.getElementById('coach-logout-sidebar').addEventListener('click', () => {
      if (window.hititLogout) window.hititLogout();
    });
  },

  enter() {
    navigateTo('dashboard');

    // Set coach welcome
    const nameEl = document.getElementById('coach-welcome-name');
    if (nameEl) nameEl.textContent = 'Coach Jayne!';

    const greetEl = document.getElementById('coach-greeting');
    if (greetEl) {
      const h = new Date().getHours();
      greetEl.textContent = h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : 'Good evening,';
    }

    // Notifications
    const user = getCurrentUser();
    if (user && !unsubNotifications) {
      unsubNotifications = subscribeToNotifications(COACH_UID, (notifs) => {
        const unread = notifs.filter(n => !n.read);
        const badge = document.getElementById('coach-notif-badge');
        if (badge) {
          badge.textContent = unread.length;
          badge.style.display = unread.length > 0 ? 'flex' : 'none';
        }
      });
    }
  },

  leave() {
    if (unsubClientEntries) {
      unsubClientEntries();
      unsubClientEntries = null;
    }
    if (unsubNotifications) {
      unsubNotifications();
      unsubNotifications = null;
    }
    closeMobileSidebar();
    closeSlidePanel();
    selectedClientId = null;
  }
});
