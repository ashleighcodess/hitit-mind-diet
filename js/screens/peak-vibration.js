// ========================================
// Peak Vibration Screen
// ========================================

import { registerScreen, getCurrentUser, showToast } from '../app.js';
import { getUserData, setUserData } from '../app.js';
import { EMOTIONS } from '../data/emotions.js';
import { updateUserSettings } from '../data/firestore.js';

const MILESTONES = [
  { level: 1, label: 'Love', vibes: 500, color: '#4a9eff' },
  { level: 2, label: 'Enlightenment', vibes: 700, color: '#aa66ff' },
  { level: 3, label: 'Miracles', vibes: 1000, color: '#e0e0e0' }
];

function renderMilestones(currentLevel) {
  const container = document.getElementById('peak-milestones');
  container.innerHTML = MILESTONES.map(m => {
    const achieved = currentLevel >= m.level;
    return `
      <div class="milestone ${achieved ? 'achieved' : ''}" style="--milestone-color: ${m.color}">
        <div class="milestone-wave">
          <img src="assets/vibrations/Vibrations ${m.label === 'Love' ? 'Blue' : m.label === 'Enlightenment' ? 'Purple' : 'White'}.${m.label === 'Miracles' ? 'png' : 'jpg'}" alt="${m.label}">
        </div>
        <div class="milestone-info">
          <span class="milestone-label">${m.label}</span>
          <span class="milestone-vibes">${m.vibes} Vibes</span>
        </div>
        <div class="milestone-check">${achieved ? '&#10003;' : ''}</div>
      </div>
    `;
  }).join('');
}

function renderEmotionPicker() {
  const container = document.getElementById('peak-emotion-picker');
  // Show all non-red emotions for the daily top-3 picker
  const positiveEmotions = EMOTIONS.filter(e => e.tier !== 'red');
  container.innerHTML = positiveEmotions.map(emo => `
    <button class="peak-emo-btn" data-emotion="${emo.key}">
      <img src="assets/icons/${emo.icon}" alt="${emo.label}">
      <span>${emo.label}</span>
    </button>
  `).join('');

  // Selection logic (max 3)
  const selected = new Set();
  container.querySelectorAll('.peak-emo-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.emotion;
      if (selected.has(key)) {
        selected.delete(key);
        btn.classList.remove('selected');
      } else if (selected.size < 3) {
        selected.add(key);
        btn.classList.add('selected');
      } else {
        showToast('Max 3 emotions per day');
        return;
      }

      // Calculate vibe score from selected emotions
      const vibeScore = [...selected].reduce((sum, k) => {
        const emo = EMOTIONS.find(e => e.key === k);
        return sum + (emo ? Math.abs(emo.calories) : 0);
      }, 0);

      document.getElementById('peak-vibe-score').textContent = vibeScore.toLocaleString();

      // Save to user settings
      const user = getCurrentUser();
      if (user) {
        const milestone = vibeScore >= 1000 ? 3 : vibeScore >= 700 ? 2 : vibeScore >= 500 ? 1 : 0;
        await updateUserSettings(user.uid, 'settings.peakVibe', vibeScore);
        await updateUserSettings(user.uid, 'settings.milestone', milestone);
        renderMilestones(milestone);
      }
    });
  });
}

registerScreen('peak-vibration', {
  init() {
    renderEmotionPicker();
  },

  enter() {
    const userData = getUserData();
    const vibeScore = userData?.settings?.peakVibe || 0;
    const milestone = userData?.settings?.milestone || 0;
    document.getElementById('peak-vibe-score').textContent = vibeScore.toLocaleString();
    renderMilestones(milestone);
  },

  leave() {}
});
