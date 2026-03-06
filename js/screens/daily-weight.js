// ========================================
// Daily Mind Weight Screen
// ========================================

import { registerScreen, getCurrentUser, showToast } from '../app.js';
import { TIERS, EMOTIONS, getEmotionsByTier, TIER_ORDER } from '../data/emotions.js';
import { subscribeToEntries, todayStr, formatTime, calcDailyTotals, countByEmotion } from '../data/firestore.js';
import { staggerDailyCards } from '../animations.js';

let unsubEntries = null;

function renderDailyWeight(entries) {
  const container = document.getElementById('daily-tiers');
  const totals = calcDailyTotals(entries);
  const emotionCounts = countByEmotion(entries);

  // Build tier cards
  let html = '';
  TIER_ORDER.forEach(tierKey => {
    const tier = TIERS[tierKey];
    const tierEmotions = getEmotionsByTier(tierKey);

    html += `
      <div class="daily-tier-card" style="border-color: ${tier.color}20">
        <div class="daily-tier-header">
          <img src="${tier.waveImage}" alt="${tier.name}" class="daily-wave-thumb">
          <div>
            <div class="daily-tier-name" style="color: ${tier.color}">${tier.name}</div>
            <div class="daily-tier-range">${tier.vibeRange} Vibrations</div>
          </div>
        </div>
        <div class="daily-emotion-rows">
    `;

    tierEmotions.forEach(emo => {
      const count = emotionCounts[emo.key] || 0;
      const emoEntries = entries.filter(e => e.emotion === emo.key);
      const lastTime = emoEntries.length > 0 && emoEntries[0].timestamp
        ? formatTime(emoEntries[0].timestamp.toDate()) : '--';
      const sign = emo.calories > 0 ? '+' : '';

      html += `
        <div class="daily-emotion-row">
          <span class="daily-emo-cal" style="color: ${tier.color}">${sign}${Math.abs(emo.calories).toLocaleString()}</span>
          <span class="daily-emo-name">${emo.label}</span>
          <span class="daily-emo-time">${lastTime}</span>
          <span class="daily-emo-count">${count}x</span>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Animate cards in with stagger
  staggerDailyCards();

  // Footer totals
  document.getElementById('daily-red-total').textContent = '+' + totals.redTotal.toLocaleString();
  document.getElementById('daily-positive-total').textContent = totals.positiveTotal.toLocaleString();
  const net = totals.net;
  const netEl = document.getElementById('daily-net-total');
  netEl.textContent = (net > 0 ? '+' : '') + net.toLocaleString();
  netEl.className = 'daily-net-value ' + (net < 0 ? 'positive' : net > 0 ? 'negative' : 'neutral');
}

registerScreen('daily', {
  init() {},

  enter() {
    const user = getCurrentUser();
    if (!user) return;

    // Force video autoplay on mobile
    const vid = document.querySelector('#screen-daily .video-header video');
    if (vid) vid.play().catch(() => {});

    document.getElementById('daily-date').textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric'
    });

    if (unsubEntries) unsubEntries();
    unsubEntries = subscribeToEntries(user.uid, todayStr(), (entries) => {
      renderDailyWeight(entries);
    }, (err) => {
      console.error('Daily entries error:', err);
    });
  },

  leave() {
    if (unsubEntries) {
      unsubEntries();
      unsubEntries = null;
    }
  }
});
