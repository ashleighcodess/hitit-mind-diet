// ========================================
// Tracker Screen — Emotion Tapping
// ========================================

import { registerScreen, getCurrentUser, showToast, escapeHtml } from '../app.js';
import { TIERS, EMOTIONS, getEmotionsByTier, getEmotionLabel, TIER_ORDER } from '../data/emotions.js';
import { logEntry, subscribeToEntries, todayStr, formatTime, updateUserSettings } from '../data/firestore.js';
import { getUserData } from '../app.js';

let unsubEntries = null;
let todayEntries = [];
let pendingEmotion = null;

function updateScore() {
  const scoreEl = document.getElementById('tracker-score');
  const total = todayEntries.reduce((sum, e) => sum + e.calories, 0);
  scoreEl.textContent = (total > 0 ? '+' : '') + total.toLocaleString();
  scoreEl.classList.remove('positive', 'negative', 'neutral');
  if (total < 0) scoreEl.classList.add('positive');
  else if (total > 0) scoreEl.classList.add('negative');
  else scoreEl.classList.add('neutral');
}

function renderLog() {
  const logList = document.getElementById('tracker-log-list');
  if (todayEntries.length === 0) {
    logList.innerHTML = '<div class="log-empty">No entries yet. Tap an emotion above to start tracking.</div>';
    return;
  }
  logList.innerHTML = todayEntries.map(entry => {
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

registerScreen('tracker', {
  init() {
    // Set today's date
    document.getElementById('tracker-date').textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    });

    // Emotion button taps
    document.querySelectorAll('#screen-tracker .emotion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const emotionKey = btn.dataset.emotion;
        const tier = btn.dataset.tier;
        const calories = parseInt(btn.dataset.calories, 10);

        btn.classList.add('tapped');
        setTimeout(() => btn.classList.remove('tapped'), 400);

        if (tier === 'red') {
          pendingEmotion = { emotion: emotionKey, tier, calories };
          const modal = document.getElementById('tracker-modal');
          document.getElementById('tracker-modal-title').textContent =
            `What triggered "${getEmotionLabel(emotionKey)}"?`;
          document.getElementById('tracker-modal-details').value = '';
          modal.classList.add('active');
          document.getElementById('tracker-modal-details').focus();
        } else {
          const user = getCurrentUser();
          if (!user) { showToast('Please sign in first'); return; }
          logEntry(user.uid, emotionKey, tier, calories, '')
            .then(() => showToast(`${getEmotionLabel(emotionKey)} logged!`, 'success'))
            .catch((err) => { console.error('Log error:', err); showToast('Failed to log entry'); });
        }
      });
    });

    // Modal handlers
    const modal = document.getElementById('tracker-modal');
    document.getElementById('tracker-modal-cancel').addEventListener('click', () => {
      modal.classList.remove('active');
      pendingEmotion = null;
    });

    document.getElementById('tracker-modal-save').addEventListener('click', () => {
      if (!pendingEmotion) return;
      const user = getCurrentUser();
      if (!user) { showToast('Please sign in first'); return; }
      const details = document.getElementById('tracker-modal-details').value.trim();
      const emo = pendingEmotion; // capture before nulling
      modal.classList.remove('active');
      pendingEmotion = null;
      logEntry(user.uid, emo.emotion, emo.tier, emo.calories, details)
        .then(() => showToast(`${getEmotionLabel(emo.emotion)} logged!`, 'success'))
        .catch((err) => { console.error('Log error:', err); showToast('Failed to log entry'); });
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
        pendingEmotion = null;
      }
    });

    // Intention save
    let intentionTimeout;
    const intentionInput = document.getElementById('tracker-intention');
    if (intentionInput) {
      intentionInput.addEventListener('input', () => {
        clearTimeout(intentionTimeout);
        intentionTimeout = setTimeout(() => {
          const user = getCurrentUser();
          if (!user) return;
          updateUserSettings(user.uid, 'settings.intention', intentionInput.value.trim())
            .catch(err => console.error('Failed to save intention:', err));
        }, 800);
      });
    }
  },

  enter() {
    const user = getCurrentUser();
    if (!user) return;

    // Load intention
    const userData = getUserData();
    const intentionInput = document.getElementById('tracker-intention');
    if (intentionInput && userData?.settings?.intention) {
      intentionInput.value = userData.settings.intention;
    }

    // Update date
    document.getElementById('tracker-date').textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    });

    // Subscribe to entries
    if (unsubEntries) unsubEntries();
    unsubEntries = subscribeToEntries(user.uid, todayStr(), (entries) => {
      todayEntries = entries;
      updateScore();
      renderLog();
    }, (err) => {
      console.error('Entries listener error:', err);
      if (err.code === 'failed-precondition') {
        showToast('Setting up database index... Please refresh in a moment.');
      }
    });
  },

  leave() {
    if (unsubEntries) {
      unsubEntries();
      unsubEntries = null;
    }
  }
});
