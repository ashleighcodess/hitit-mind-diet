// ========================================
// Coach Dashboard Screen (SPA)
// ========================================

import { registerScreen, getCurrentUser, showToast, escapeHtml } from '../app.js';
import { getUserData } from '../app.js';
import { getEmotionLabel } from '../data/emotions.js';
import {
  getClientsByCoach, subscribeToEntries, todayStr, formatTime,
  calcDailyTotals, countByEmotion, updateUserSettings
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
          <p>When clients register and link to your account, they will appear here.</p>
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
