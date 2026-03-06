// ========================================
// Coach Dashboard Screen (SPA)
// ========================================

import { registerScreen, getCurrentUser, showToast, escapeHtml } from '../app.js';
import { getUserData } from '../app.js';
import { getEmotionLabel } from '../data/emotions.js';
import {
  getClientsByCoach, subscribeToEntries, todayStr, formatTime,
  calcDailyTotals, countByEmotion, updateUserSettings,
  createAssignment, getAssignments, reviewAssignment,
  subscribeToNotifications, markAllNotificationsRead
} from '../data/firestore.js';
import { getUserDoc } from '../data/firestore.js';

let selectedClientId = null;
let unsubClientEntries = null;
let unsubNotifications = null;

function getEmbedUrl(url) {
  // YouTube
  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  // Vimeo
  m = url.match(/vimeo\.com\/(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  return null;
}

function renderMedia(url, type) {
  const embed = getEmbedUrl(url);
  if (embed) {
    return `<iframe src="${embed}" frameborder="0" allowfullscreen style="width:100%;aspect-ratio:16/9;border-radius:8px;"></iframe>`;
  }
  if (type === 'video') {
    return `<video src="${url}" controls preload="metadata" style="width:100%;border-radius:8px;"></video>`;
  }
  return `<img src="${url}" alt="Attachment" style="width:100%;border-radius:8px;">`;
}

function showListView() {
  document.getElementById('coach-list-view').style.display = 'block';
  document.getElementById('coach-detail-view').style.display = 'none';
  if (unsubClientEntries) {
    unsubClientEntries();
    unsubClientEntries = null;
  }
}

function showDetailView() {
  document.getElementById('coach-list-view').style.display = 'none';
  document.getElementById('coach-detail-view').style.display = 'block';
  // Reset to Overview tab
  switchTab('overview');
}

function switchTab(tabName) {
  document.querySelectorAll('#coach-tab-bar .coach-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('#coach-detail-view .coach-tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `coach-panel-${tabName}`);
  });
}

async function loadClients() {
  const user = getCurrentUser();
  if (!user) return;

  const clientList = document.getElementById('coach-client-list');

  try {
    const clients = await getClientsByCoach(user.uid);

    if (clients.length === 0) {
      clientList.innerHTML = `
        <div class="empty-state">
          <h2>No Clients Yet</h2>
          <p>When clients register, they will automatically appear here.</p>
        </div>
      `;
      return;
    }

    // Fetch assignment counts per client
    const clientCards = await Promise.all(clients.map(async (client) => {
      let submittedCount = 0;
      let pendingCount = 0;
      try {
        const assigns = await getAssignments(client.id);
        submittedCount = assigns.filter(a => a.status === 'submitted').length;
        pendingCount = assigns.filter(a => !a.status || a.status === 'pending').length;
      } catch (e) { /* ignore */ }

      return `
        <div class="client-card" data-client-id="${client.id}">
          <div class="client-card-header">
            <span class="client-name">${escapeHtml(client.name)}</span>
            ${submittedCount > 0 ? `<span style="font-size:0.65rem;font-weight:600;color:var(--tier-blue);background:rgba(74,158,255,0.12);padding:2px 8px;border-radius:10px;">${submittedCount} to review</span>` : ''}
          </div>
          <div class="client-meta">
            <span>${client.email}</span>
            ${pendingCount > 0 ? `<span style="font-size:0.65rem;color:var(--text-muted)">${pendingCount} pending</span>` : ''}
          </div>
        </div>
      `;
    }));

    clientList.innerHTML = clientCards.join('');

    clientList.querySelectorAll('.client-card').forEach(card => {
      card.addEventListener('click', () => openClientDetail(card.dataset.clientId));
    });

  } catch (err) {
    console.error('Failed to load clients:', err);
    showToast('Failed to load clients');
  }
}

async function openClientDetail(clientId) {
  selectedClientId = clientId;
  showDetailView();

  // Mark notifications read for this coach
  const user = getCurrentUser();
  if (user) {
    markAllNotificationsRead(user.uid).catch(() => {});
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

    // Show client fears & gratitudes
    renderClientFearsGratitudes(client);
  } catch (err) {
    console.error('Failed to load client:', err);
  }

  // Subscribe to entries
  if (unsubClientEntries) unsubClientEntries();
  unsubClientEntries = subscribeToEntries(clientId, todayStr(), (entries) => {
    renderClientStats(entries);
    renderClientLog(entries);
    renderRedSummary(entries);
  }, (err) => {
    console.error('Client entries error:', err);
  });

  // Load existing assignments
  loadClientAssignments(clientId);
}

function renderClientFearsGratitudes(client) {
  const fears = client.settings?.topFears || [];
  const gratitudes = client.settings?.gratitudes || [];

  const fearsEl = document.getElementById('coach-client-fears-list');
  const gratEl = document.getElementById('coach-client-gratitudes-list');

  const filledFears = fears.filter(f => f);
  const filledGrats = gratitudes.filter(g => g);

  fearsEl.innerHTML = filledFears.length > 0
    ? `<h4 class="coach-sub-title">Fears (${filledFears.length})</h4>` +
      filledFears.map(f => `<div class="coach-list-item coach-fear-item">${escapeHtml(f)}</div>`).join('')
    : '<p class="text-muted" style="font-size:0.8rem;font-style:italic">No fears entered yet.</p>';

  gratEl.innerHTML = filledGrats.length > 0
    ? `<h4 class="coach-sub-title" style="margin-top:12px">Grateful For (${filledGrats.length})</h4>` +
      filledGrats.map(g => `<div class="coach-list-item coach-grat-item">${escapeHtml(g)}</div>`).join('')
    : '<p class="text-muted" style="font-size:0.8rem;font-style:italic;margin-top:8px">No gratitudes entered yet.</p>';
}

async function loadClientAssignments(clientId) {
  const listEl = document.getElementById('coach-assign-list');
  try {
    const assignments = await getAssignments(clientId);
    if (assignments.length === 0) {
      listEl.innerHTML = '<p class="text-muted" style="font-size:0.8rem;font-style:italic">No assignments sent yet.</p>';
      return;
    }

    const submitted = assignments.filter(a => a.status === 'submitted');
    const pending = assignments.filter(a => !a.status || a.status === 'pending');
    const reviewed = assignments.filter(a => a.status === 'reviewed');

    let html = '';

    // Show submitted first (needs attention)
    if (submitted.length > 0) {
      html += `<h4 class="coach-sub-title" style="color:var(--tier-blue)">Needs Review (${submitted.length})</h4>`;
      html += submitted.map(a => renderCoachAssignCard(a, 'submitted')).join('');
    }

    if (pending.length > 0) {
      html += `<h4 class="coach-sub-title" style="margin-top:16px">Pending (${pending.length})</h4>`;
      html += pending.map(a => renderCoachAssignCard(a, 'pending')).join('');
    }

    if (reviewed.length > 0) {
      html += `<h4 class="coach-sub-title" style="margin-top:16px;color:var(--tier-green)">Reviewed (${reviewed.length})</h4>`;
      html += reviewed.map(a => renderCoachAssignCard(a, 'reviewed')).join('');
    }

    listEl.innerHTML = html;

    // Attach review buttons
    listEl.querySelectorAll('.coach-review-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const assignId = btn.dataset.id;
        const card = btn.closest('.coach-assign-item');
        const noteInput = card.querySelector('.coach-review-note');
        const note = noteInput ? noteInput.value.trim() : '';

        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
          await reviewAssignment(assignId, note);
          showToast('Assignment reviewed!', 'success');
          loadClientAssignments(clientId);
        } catch (err) {
          console.error('Failed to review:', err);
          showToast('Failed to save review');
          btn.disabled = false;
          btn.textContent = 'Mark Reviewed';
        }
      });
    });

  } catch (err) {
    console.error('Failed to load assignments:', err);
    listEl.innerHTML = '';
  }
}

function renderCoachFileList(files) {
  if (!files || files.length === 0) return '';
  return `
    <div style="margin-bottom:8px">
      <div style="font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Attached Files (${files.length})</div>
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

function renderCoachAssignCard(a, status) {
  const statusLabels = { pending: 'Pending', submitted: 'Submitted', reviewed: 'Reviewed' };
  const statusColors = { pending: '#f0a030', submitted: 'var(--tier-blue)', reviewed: 'var(--tier-green)' };
  const due = a.dueDate || '';

  return `
    <div class="coach-assign-item" style="border-left:3px solid ${statusColors[status]}">
      <div class="coach-assign-item-header">
        <span class="coach-assign-item-type">${a.type}</span>
        <span style="font-size:0.7rem;font-weight:600;color:${statusColors[status]}">${statusLabels[status]}</span>
      </div>
      <div class="coach-assign-item-title">${escapeHtml(a.title)}</div>
      ${a.description ? `<div class="coach-assign-item-desc">${escapeHtml(a.description)}</div>` : ''}
      ${a.mediaUrl ? `<div class="coach-assign-media">${renderMedia(a.mediaUrl, a.type)}</div>` : ''}
      ${due ? `<div class="coach-assign-item-due">Due: ${due}</div>` : ''}

      ${status === 'submitted' ? `
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border-color)">
          <div style="font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Client's Response</div>
          <div style="font-size:0.8rem;color:var(--text-secondary);padding:8px 10px;background:rgba(74,158,255,0.06);border-radius:6px;border-left:3px solid var(--tier-blue);white-space:pre-wrap;margin-bottom:8px">${escapeHtml(a.response || 'No written response')}</div>
          ${renderCoachFileList(a.responseFiles)}
          <textarea class="coach-review-note" placeholder="Add feedback (optional)..." rows="2" style="width:100%;background:var(--bg-input);border:1px solid var(--border-color);border-radius:6px;padding:8px 10px;font-size:0.8rem;color:var(--text-primary);resize:none;font-family:inherit;margin-bottom:8px"></textarea>
          <button class="coach-review-btn btn btn-primary" data-id="${a.id}" style="width:100%;padding:10px;font-size:0.8rem">Mark Reviewed</button>
        </div>
      ` : ''}

      ${status === 'reviewed' ? `
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border-color)">
          <div style="font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Client's Response</div>
          <div style="font-size:0.8rem;color:var(--text-secondary);padding:8px 10px;background:rgba(74,158,255,0.06);border-radius:6px;border-left:3px solid var(--tier-blue);white-space:pre-wrap;margin-bottom:8px">${escapeHtml(a.response || 'No written response')}</div>
          ${renderCoachFileList(a.responseFiles)}
          ${a.coachNote ? `
            <div style="font-size:0.7rem;font-weight:600;color:var(--tier-green);text-transform:uppercase;margin-bottom:4px">Your Feedback</div>
            <div style="font-size:0.8rem;color:var(--text-secondary);padding:8px 10px;background:rgba(68,204,68,0.06);border-radius:6px;border-left:3px solid var(--tier-green);white-space:pre-wrap">${escapeHtml(a.coachNote)}</div>
          ` : ''}
        </div>
      ` : ''}
    </div>
  `;
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
}

function renderClientLog(entries) {
  const logList = document.getElementById('coach-log-list');
  if (entries.length === 0) {
    logList.innerHTML = '<div class="log-empty">No entries yet today.</div>';
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
    summaryList.innerHTML = '<p class="text-muted" style="font-style:italic">No red thoughts logged today.</p>';
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

registerScreen('coach', {
  init() {
    document.getElementById('coach-back-btn').addEventListener('click', showListView);

    // Tab switching
    document.querySelectorAll('#coach-tab-bar .coach-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

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

    const typeSelect = document.getElementById('coach-assign-type');
    const mediaGroup = document.getElementById('coach-assign-media-group');

    // Assignment creation
    const sendBtn = document.getElementById('coach-assign-send');
    sendBtn.addEventListener('click', async () => {
      if (!selectedClientId) return;
      const user = getCurrentUser();
      if (!user) return;

      const type = document.getElementById('coach-assign-type').value;
      const title = document.getElementById('coach-assign-title').value.trim();
      const description = document.getElementById('coach-assign-desc').value.trim();
      const dueDate = document.getElementById('coach-assign-due').value;
      const fileInput = document.getElementById('coach-assign-file');
      const file = fileInput?.files[0] || null;
      const pastedUrl = document.getElementById('coach-assign-url').value.trim();

      if (!title) {
        showToast('Please enter a title');
        return;
      }

      sendBtn.disabled = true;
      let mediaUrl = pastedUrl;

      // Upload file to R2 if provided (takes priority over pasted URL)
      if (file) {
        sendBtn.textContent = 'Uploading...';
        try {
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch('/api/upload', { method: 'POST', body: formData });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Upload failed');
          mediaUrl = data.url;
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
          clientId: selectedClientId,
          coachId: user.uid,
          type,
          title,
          description,
          dueDate,
          mediaUrl,
          questions: ''
        });
        showToast('Assignment sent!', 'success');

        // Clear form
        document.getElementById('coach-assign-title').value = '';
        document.getElementById('coach-assign-desc').value = '';
        document.getElementById('coach-assign-due').value = '';
        document.getElementById('coach-assign-url').value = '';
        if (fileInput) fileInput.value = '';
        typeSelect.value = 'task';

        loadClientAssignments(selectedClientId);
      } catch (err) {
        console.error('Failed to create assignment:', err);
        showToast('Failed to send assignment');
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send to Client';
      }
    });

    document.getElementById('coach-logout-btn').addEventListener('click', () => {
      if (window.hititLogout) window.hititLogout();
    });
  },

  enter() {
    showListView();
    loadClients();

    // Set coach welcome name
    const userData = getUserData();
    const nameEl = document.getElementById('coach-welcome-name');
    if (nameEl && userData?.name) {
      nameEl.textContent = `Coach ${userData.name.split(' ')[0]}!`;
    }

    // Time-based greeting
    const greetEl = document.getElementById('coach-greeting');
    if (greetEl) {
      const h = new Date().getHours();
      greetEl.textContent = h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : 'Good evening,';
    }

    // Subscribe to notifications for badge updates
    const user = getCurrentUser();
    if (user && !unsubNotifications) {
      unsubNotifications = subscribeToNotifications(user.uid, (notifs) => {
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
  }
});
