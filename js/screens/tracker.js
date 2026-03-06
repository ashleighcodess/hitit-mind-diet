// ========================================
// Tracker Screen — Emotion Tapping
// ========================================

import { registerScreen, getCurrentUser, showToast, escapeHtml } from '../app.js';
import { TIERS, EMOTIONS, getEmotionsByTier, getEmotionByKey, getEmotionLabel, TIER_ORDER } from '../data/emotions.js';
import { logEntry, updateEntry, subscribeToEntries, todayStr, formatTime, updateUserSettings } from '../data/firestore.js';
import { getUserData } from '../app.js';
import { animateScore, showCalorieFlash } from '../animations.js';

let unsubEntries = null;
let todayEntries = [];
let prevEntryCount = 0;
let pendingEmotion = null;
let editingEntryId = null;

function updateScore() {
  const scoreEl = document.getElementById('tracker-score');
  const total = todayEntries.reduce((sum, e) => sum + e.calories, 0);

  // Animate the score counter
  animateScore(scoreEl, total);

  // Show calorie flash for new entries
  if (todayEntries.length > prevEntryCount && prevEntryCount > 0) {
    const newest = todayEntries[0]; // sorted newest first
    if (newest) {
      const scoreBar = document.querySelector('.score-bar');
      showCalorieFlash(scoreBar, newest.calories);
    }
  }
  prevEntryCount = todayEntries.length;

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
      <div class="log-entry" data-entry-id="${entry.id}">
        <span class="log-time">${time}</span>
        <span class="log-emotion">${label}${entry.details ? ' &mdash; ' + escapeHtml(entry.details) : ''}</span>
        <span class="log-cal ${entry.tier}">${sign}${cal.toLocaleString()}</span>
        <button class="log-edit-btn" data-entry-id="${entry.id}" title="Edit">&#9998;</button>
      </div>
    `;
  }).join('');

  // Attach edit handlers
  logList.querySelectorAll('.log-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const entryId = btn.dataset.entryId;
      const entry = todayEntries.find(en => en.id === entryId);
      if (!entry) return;
      openEditModal(entry);
    });
  });
}

function openEditModal(entry) {
  editingEntryId = entry.id;
  const modal = document.getElementById('edit-modal');
  const select = document.getElementById('edit-emotion-select');
  const textarea = document.getElementById('edit-details');

  // Build emotion options from all tiers
  select.innerHTML = '';
  TIER_ORDER.forEach(tier => {
    const emotions = getEmotionsByTier(tier);
    emotions.forEach(emo => {
      const opt = document.createElement('option');
      opt.value = emo.key;
      opt.textContent = emo.label;
      opt.dataset.tier = tier;
      opt.dataset.calories = emo.calories;
      if (emo.key === entry.emotion) opt.selected = true;
      select.appendChild(opt);
    });
  });

  textarea.value = entry.details || '';
  modal.classList.add('active');
}

registerScreen('tracker', {
  init() {
    // Set today's date
    document.getElementById('tracker-date').textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    });

    // Emotion button taps — ALL tiers now open LOG IT modal
    document.querySelectorAll('#screen-tracker .emotion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const emotionKey = btn.dataset.emotion;
        const tier = btn.dataset.tier;
        const calories = parseInt(btn.dataset.calories, 10);

        btn.classList.add('tapped');
        setTimeout(() => btn.classList.remove('tapped'), 600);

        pendingEmotion = { emotion: emotionKey, tier, calories };
        const modal = document.getElementById('tracker-modal');
        document.getElementById('tracker-modal-title').textContent =
          `What triggered "${getEmotionLabel(emotionKey)}"?`;
        document.getElementById('tracker-modal-details').value = '';
        modal.classList.add('active');
        // Delay focus so modal animates in first, then keyboard opens
        setTimeout(() => {
          const textarea = document.getElementById('tracker-modal-details');
          textarea.focus();
          // Scroll textarea into view if keyboard obscures it
          setTimeout(() => textarea.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
        }, 350);
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

    // Edit modal handlers
    const editModal = document.getElementById('edit-modal');
    document.getElementById('edit-modal-cancel').addEventListener('click', () => {
      editModal.classList.remove('active');
      editingEntryId = null;
    });

    document.getElementById('edit-modal-save').addEventListener('click', async () => {
      if (!editingEntryId) return;
      const select = document.getElementById('edit-emotion-select');
      const selectedOpt = select.options[select.selectedIndex];
      const newEmotion = select.value;
      const newTier = selectedOpt.dataset.tier;
      const newCalories = parseInt(selectedOpt.dataset.calories, 10);
      const newDetails = document.getElementById('edit-details').value.trim();

      editModal.classList.remove('active');
      try {
        await updateEntry(editingEntryId, {
          emotion: newEmotion,
          tier: newTier,
          calories: newCalories,
          details: newDetails
        });
        showToast('Entry updated!', 'success');
      } catch (err) {
        console.error('Edit error:', err);
        showToast('Failed to update entry');
      }
      editingEntryId = null;
    });

    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) {
        editModal.classList.remove('active');
        editingEntryId = null;
      }
    });

    // Menu toggle + logout
    const menuBtn = document.getElementById('topbar-menu-btn');
    const dropdown = document.getElementById('topbar-dropdown');
    if (menuBtn && dropdown) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
      });
      document.addEventListener('click', () => dropdown.classList.remove('open'));
      dropdown.addEventListener('click', (e) => e.stopPropagation());
    }

    const logoutBtn = document.getElementById('tracker-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        const { signOut } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
        const { auth } = await import('../firebase-config.js');
        await signOut(auth);
        window.location.hash = 'splash';
      });
    }

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
