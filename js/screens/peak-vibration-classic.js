// ========================================
// Peak Vibration Screen — Classic Layout (Client Mockup)
// ========================================

import { registerScreen, getCurrentUser, showToast } from '../app.js';
import { getUserData } from '../app.js';
import { updateUserSettings } from '../data/firestore.js';

// 18 vibration emotions — 3 across, 6 rows
const VIBE_EMOTIONS = [
  { value: 20,   label: 'Shame' },
  { value: 30,   label: 'Guilt' },
  { value: 50,   label: 'Lifelessness' },
  { value: 75,   label: 'Grief' },
  { value: 100,  label: 'Fear' },
  { value: 125,  label: 'Anxiety' },
  { value: 150,  label: 'Anger' },
  { value: 175,  label: 'Pride' },
  { value: 200,  label: 'Courage' },
  { value: 250,  label: 'Determined' },
  { value: 300,  label: 'Willingness' },
  { value: 350,  label: 'Agreeable' },
  { value: 400,  label: 'Happy' },
  { value: 500,  label: 'Love' },
  { value: 540,  label: 'Joy' },
  { value: 600,  label: 'Peace' },
  { value: 700,  label: 'Enlightenment' },
  { value: 1000, label: 'No Resistance' }
];

// Tier color for a given value
function getColor(v) {
  if (v <= 50) return '#cc2222';
  if (v <= 175) return '#ff4444';
  if (v <= 350) return '#44cc44';
  if (v <= 540) return '#4a9eff';
  if (v <= 700) return '#aa66ff';
  return '#e0e0e0';
}

const selected = new Set();

function renderEmotionGrid() {
  const container = document.getElementById('pvc-emotion-grid');
  container.innerHTML = VIBE_EMOTIONS.map(emo => `
    <button class="pvc-emo-btn" data-value="${emo.value}">
      <span class="pvc-emo-value" style="color:${getColor(emo.value)}">${emo.value}</span>
      <span class="pvc-emo-label">${emo.label}</span>
    </button>
  `).join('');

  container.querySelectorAll('.pvc-emo-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const val = parseInt(btn.dataset.value, 10);
      if (selected.has(val)) {
        selected.delete(val);
        btn.classList.remove('selected');
      } else if (selected.size < 3) {
        selected.add(val);
        btn.classList.add('selected');
      } else {
        showToast('Max 3 emotions per day');
        return;
      }
      updateScore();
    });
  });
}

async function updateScore() {
  const total = [...selected].reduce((sum, v) => sum + v, 0);
  const avg = selected.size > 0 ? Math.round(total / selected.size) : 0;

  document.getElementById('pvc-score-value').textContent = avg;

  const user = getCurrentUser();
  if (user) {
    await updateUserSettings(user.uid, 'settings.peakVibe', avg).catch(() => {});
  }
}

function initMilestoneSlider() {
  const slider = document.getElementById('pvc-milestone-slider');
  const display = document.getElementById('pvc-milestone-value');
  if (!slider) return;

  slider.addEventListener('input', async () => {
    display.textContent = slider.value;
    const user = getCurrentUser();
    if (user) {
      await updateUserSettings(user.uid, 'settings.milestoneTarget', parseInt(slider.value, 10)).catch(() => {});
    }
  });
}

registerScreen('peak-vibration', {
  init() {
    renderEmotionGrid();
    initMilestoneSlider();
  },

  enter() {
    const userData = getUserData();
    const vibeScore = userData?.settings?.peakVibe || 0;
    const milestoneTarget = userData?.settings?.milestoneTarget || 600;
    document.getElementById('pvc-score-value').textContent = vibeScore;
    const slider = document.getElementById('pvc-milestone-slider');
    const display = document.getElementById('pvc-milestone-value');
    if (slider) {
      slider.value = milestoneTarget;
      display.textContent = milestoneTarget;
    }

    // Reset selections on re-enter
    selected.clear();
    document.querySelectorAll('.pvc-emo-btn').forEach(btn => btn.classList.remove('selected'));
  },

  leave() {}
});
