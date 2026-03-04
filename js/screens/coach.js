// ========================================
// Coach Dashboard Screen (SPA)
// ========================================

import { registerScreen, getCurrentUser, showToast, escapeHtml } from '../app.js';
import { getUserData } from '../app.js';
import { getEmotionLabel } from '../data/emotions.js';
import {
  getClientsByCoach, subscribeToEntries, todayStr, formatTime,
  calcDailyTotals, countByEmotion, updateUserSettings,
  createAssignment, getAssignments, uploadAssignmentFile, updateAssignment
} from '../data/firestore.js';
import { getUserDoc } from '../data/firestore.js';

let selectedClientId = null;
let unsubClientEntries = null;

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

    clientList.innerHTML = clients.map(client => {
      return `
        <div class="client-card" data-client-id="${client.id}">
          <div class="client-card-header">
            <span class="client-name">${escapeHtml(client.name)}</span>
          </div>
          <div class="client-meta">
            <span>${client.email}</span>
          </div>
        </div>
      `;
    }).join('');

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
    listEl.innerHTML = '<h4 class="coach-sub-title">Sent Assignments</h4>' +
      assignments.map(a => {
        const status = a.completedAt ? 'Completed' : 'Pending';
        const statusClass = a.completedAt ? 'coach-status-done' : 'coach-status-pending';
        const due = a.dueDate || '';
        return `
          <div class="coach-assign-item">
            <div class="coach-assign-item-header">
              <span class="coach-assign-item-type">${a.type}</span>
              <span class="${statusClass}">${status}</span>
            </div>
            <div class="coach-assign-item-title">${escapeHtml(a.title)}</div>
            ${a.description ? `<div class="coach-assign-item-desc">${escapeHtml(a.description)}</div>` : ''}
            ${a.uploadUrl ? `<div class="coach-assign-media">${a.type === 'video' ? `<video src="${a.uploadUrl}" controls preload="metadata"></video>` : `<img src="${a.uploadUrl}" alt="Attachment">`}</div>` : ''}
            ${due ? `<div class="coach-assign-item-due">Due: ${due}</div>` : ''}
          </div>
        `;
      }).join('');
  } catch (err) {
    console.error('Failed to load assignments:', err);
    listEl.innerHTML = '';
  }
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

    // Show/hide file upload based on type
    const typeSelect = document.getElementById('coach-assign-type');
    const fileGroup = document.getElementById('coach-assign-file-group');
    typeSelect.addEventListener('change', () => {
      const showFile = typeSelect.value === 'video' || typeSelect.value === 'visual';
      fileGroup.style.display = showFile ? 'block' : 'none';
    });

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
      const file = fileInput.files[0] || null;

      if (!title) {
        showToast('Please enter a title');
        return;
      }

      sendBtn.disabled = true;
      sendBtn.textContent = file ? 'Uploading...' : 'Sending...';

      try {
        const docRef = await createAssignment({
          clientId: selectedClientId,
          coachId: user.uid,
          type,
          title,
          description,
          dueDate,
          questions: ''
        });

        // Upload file if provided
        if (file) {
          const url = await uploadAssignmentFile(file, docRef.id);
          await updateAssignment(docRef.id, { uploadUrl: url });
        }

        showToast('Assignment sent!', 'success');

        // Clear form
        document.getElementById('coach-assign-title').value = '';
        document.getElementById('coach-assign-desc').value = '';
        document.getElementById('coach-assign-due').value = '';
        fileInput.value = '';
        fileGroup.style.display = 'none';
        typeSelect.value = 'task';

        // Refresh list
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
  },

  leave() {
    if (unsubClientEntries) {
      unsubClientEntries();
      unsubClientEntries = null;
    }
  }
});
