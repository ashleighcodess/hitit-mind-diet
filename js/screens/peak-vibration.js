// ========================================
// Peak Vibration Screen — Mobile-First 3-Part Layout
// ========================================

import { registerScreen, getCurrentUser, showToast } from '../app.js';
import { getUserData } from '../app.js';
import { updateUserSettings } from '../data/firestore.js';

// 18 vibration emotions
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

const FUNNEL_BANDS = [
  { min: 0,   max: 50,   color: '#cc2222', label: 'Shame' },
  { min: 50,  max: 100,  color: '#dd3333', label: 'Grief' },
  { min: 100, max: 175,  color: '#ee4444', label: 'Fear' },
  { min: 175, max: 350,  color: '#44cc44', label: 'Courage' },
  { min: 350, max: 600,  color: '#4a9eff', label: 'Love' },
  { min: 600, max: 800,  color: '#aa66ff', label: 'Enlightenment' },
  { min: 800, max: 1000, color: '#e0e0e0', label: 'Miracles' }
];

function getScoreTier(score) {
  if (score >= 800) return { color: '#e0e0e0', label: 'WHITE', name: 'Ultimate Consciousness', level: 5 };
  if (score >= 600) return { color: '#aa66ff', label: 'PURPLE', name: 'Enlightenment', level: 4 };
  if (score >= 350) return { color: '#4a9eff', label: 'BLUE', name: 'Love', level: 3 };
  if (score >= 175) return { color: '#44cc44', label: 'GREEN', name: 'Willing', level: 2 };
  if (score > 0)    return { color: '#ff4444', label: 'RED', name: 'Fear', level: 1 };
  return { color: '#666666', label: '', name: '', level: 0 };
}

function getNextTier(score) {
  if (score >= 800) return null;
  if (score >= 600) return { name: 'Miracles', min: 800, color: '#e0e0e0' };
  if (score >= 350) return { name: 'Enlightenment', min: 600, color: '#aa66ff' };
  if (score >= 175) return { name: 'Love', min: 350, color: '#4a9eff' };
  if (score > 0)    return { name: 'Courage', min: 175, color: '#44cc44' };
  return { name: 'Start', min: 1, color: '#ff4444' };
}

function getChipColor(value) {
  if (value >= 800) return '#e0e0e0';
  if (value >= 600) return '#aa66ff';
  if (value >= 350) return '#4a9eff';
  if (value >= 175) return '#44cc44';
  return '#ff4444';
}

let lastTierLevel = 0;
let selected = new Map(); // value → label

// ---- Celebrations ----
function fireConfetti(container) {
  const colors = ['#e0e0e0', '#aa66ff', '#4a9eff', '#44cc44', '#ff4444', '#ffd700', '#ff69b4', '#00d4ff'];
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:absolute;inset:0;overflow:visible;pointer-events:none;z-index:10;';
  container.appendChild(wrapper);

  const particles = [];
  for (let i = 0; i < 50; i++) {
    const p = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 4 + Math.random() * 5;
    const isCircle = Math.random() > 0.5;
    p.style.cssText = `position:absolute;width:${size}px;height:${isCircle ? size : size * 0.4}px;background:${color};border-radius:${isCircle ? '50%' : '1px'};left:50%;top:50%;pointer-events:none;`;
    wrapper.appendChild(p);
    const angle = ((Math.random() - 0.5) * 140) * Math.PI / 180;
    particles.push({ el: p, x: 0, y: 0, vx: Math.sin(angle) * (3 + Math.random() * 5), vy: -(4 + Math.random() * 7), gravity: 0.15 + Math.random() * 0.1, rotation: 0, rotSpeed: (Math.random() - 0.5) * 15, opacity: 1, decay: 0.01 + Math.random() * 0.012 });
  }

  let frame;
  function animate() {
    let alive = false;
    for (const p of particles) {
      if (p.opacity <= 0) continue;
      alive = true;
      p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.rotation += p.rotSpeed; p.opacity -= p.decay;
      if (p.opacity < 0) p.opacity = 0;
      p.el.style.transform = `translate(${p.x}px,${p.y}px) rotate(${p.rotation}deg)`;
      p.el.style.opacity = p.opacity;
    }
    if (alive) frame = requestAnimationFrame(animate);
    else wrapper.remove();
  }
  frame = requestAnimationFrame(animate);
  setTimeout(() => { cancelAnimationFrame(frame); wrapper.remove(); }, 4000);
}

function fireGlowRing(container, color) {
  const ring = document.createElement('div');
  ring.className = 'tier-glow-ring';
  ring.style.cssText = `position:absolute;top:50%;left:50%;width:60px;height:60px;border-radius:50%;border:3px solid ${color};transform:translate(-50%,-50%) scale(0.5);opacity:1;pointer-events:none;z-index:10;animation:glowRingBurst 0.8s ease-out forwards;box-shadow:0 0 20px ${color},0 0 40px ${color}80;`;
  container.appendChild(ring);
  setTimeout(() => ring.remove(), 1000);
}

function triggerHaptic() {
  if (navigator.vibrate) navigator.vibrate(50);
}

// ---- Milestone ----
let milestoneTarget = 600;

function initMilestoneSlider() {
  const slider = document.getElementById('milestone-slider');
  const display = document.getElementById('milestone-value');
  if (!slider || !display) return;

  const userData = getUserData();
  milestoneTarget = userData?.settings?.milestoneTarget || 600;
  slider.value = milestoneTarget;
  display.textContent = milestoneTarget;

  // Goal icon
  updateGoalBadge(currentVibeScore);

  slider.addEventListener('input', () => {
    milestoneTarget = parseInt(slider.value, 10);
    display.textContent = milestoneTarget;
    updateGoalBadge(currentVibeScore);
    drawFunnel(currentFillScore);
  });

  slider.addEventListener('change', async () => {
    const user = getCurrentUser();
    if (user) {
      await updateUserSettings(user.uid, 'settings.milestoneTarget', milestoneTarget);
    }
  });
}

function updateGoalBadge(score) {
  const icon = document.getElementById('pv-goal-icon');
  if (icon) {
    icon.textContent = score >= milestoneTarget ? '\u2605' : '\u2691'; // star vs flag
    icon.style.color = score >= milestoneTarget ? '#ffd700' : 'rgba(255,215,0,0.5)';
  }
}

// ---- Canvas Funnel ----
let funnelCanvas = null;
let funnelCtx = null;
let currentFillScore = 0;
let targetFillScore = 0;
let funnelAnimId = null;
let funnelW = 0;
let funnelH = 0;
let currentVibeScore = 0;
let pulsingBandIndex = -1;
let pulseStart = 0;

function initFunnel() {
  funnelCanvas = document.getElementById('vibe-funnel-canvas');
  if (!funnelCanvas) return;
  funnelCtx = funnelCanvas.getContext('2d');
  sizeFunnel();
  drawFunnel(currentFillScore);
}

function sizeFunnel() {
  if (!funnelCanvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = funnelCanvas.getBoundingClientRect();
  funnelW = rect.width;
  funnelH = rect.height;
  funnelCanvas.width = funnelW * dpr;
  funnelCanvas.height = funnelH * dpr;
  funnelCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawFunnel(score) {
  const ctx = funnelCtx;
  if (!ctx) return;
  const w = funnelW;
  const h = funnelH;

  ctx.clearRect(0, 0, w, h);

  const funnelTop = 8;
  const funnelBottom = h - 8;
  const funnelHeight = funnelBottom - funnelTop;
  const topWidth = w * 0.92;
  const bottomWidth = w * 0.22;
  const centerX = w / 2;
  const gap = 2;
  const bands = FUNNEL_BANDS.length;
  const scoreNorm = Math.max(0, Math.min(1, score / 1000));

  // Pulse effect timing
  const now = performance.now();
  const pulseElapsed = now - pulseStart;
  const showPulse = pulsingBandIndex >= 0 && pulseElapsed < 600;
  const pulseAlpha = showPulse ? Math.max(0, 1 - pulseElapsed / 600) * 0.4 : 0;

  for (let i = 0; i < bands; i++) {
    const band = FUNNEL_BANDS[i];
    const bandBottomY = funnelBottom - (i / bands) * funnelHeight + (i > 0 ? gap / 2 : 0);
    const bandTopY = funnelBottom - ((i + 1) / bands) * funnelHeight - (i < bands - 1 ? gap / 2 : 0);

    const progressBottom = i / bands;
    const progressTop = (i + 1) / bands;
    const widthBottom = bottomWidth + (topWidth - bottomWidth) * progressBottom;
    const widthTop = bottomWidth + (topWidth - bottomWidth) * progressTop;

    const bandMinNorm = band.min / 1000;
    const bandMaxNorm = band.max / 1000;
    const isFilled = scoreNorm >= bandMaxNorm;
    const isPartial = scoreNorm > bandMinNorm && scoreNorm < bandMaxNorm;

    ctx.beginPath();
    ctx.moveTo(centerX - widthBottom / 2, bandBottomY);
    ctx.lineTo(centerX + widthBottom / 2, bandBottomY);
    ctx.lineTo(centerX + widthTop / 2, bandTopY);
    ctx.lineTo(centerX - widthTop / 2, bandTopY);
    ctx.closePath();

    if (isFilled) {
      const grad = ctx.createLinearGradient(0, bandBottomY, 0, bandTopY);
      grad.addColorStop(0, hexToRgba(band.color, 0.5));
      grad.addColorStop(1, hexToRgba(band.color, 0.7));
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = hexToRgba(band.color, 0.45);
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (isPartial) {
      const partialProgress = (scoreNorm - bandMinNorm) / (bandMaxNorm - bandMinNorm);
      const splitY = bandBottomY - (bandBottomY - bandTopY) * partialProgress;
      const splitWidth = widthBottom + (widthTop - widthBottom) * partialProgress;

      // Dim upper
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX - splitWidth / 2, splitY);
      ctx.lineTo(centerX + splitWidth / 2, splitY);
      ctx.lineTo(centerX + widthTop / 2, bandTopY);
      ctx.lineTo(centerX - widthTop / 2, bandTopY);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(band.color, 0.08);
      ctx.fill();
      ctx.restore();

      // Lit lower
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX - widthBottom / 2, bandBottomY);
      ctx.lineTo(centerX + widthBottom / 2, bandBottomY);
      ctx.lineTo(centerX + splitWidth / 2, splitY);
      ctx.lineTo(centerX - splitWidth / 2, splitY);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, bandBottomY, 0, splitY);
      grad.addColorStop(0, hexToRgba(band.color, 0.5));
      grad.addColorStop(1, hexToRgba(band.color, 0.7));
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      // Pulsing score marker
      const time = performance.now() * 0.003;
      const pulse = 0.5 + Math.sin(time) * 0.5;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX - splitWidth / 2 - 4, splitY);
      ctx.lineTo(centerX + splitWidth / 2 + 4, splitY);
      ctx.strokeStyle = hexToRgba(band.color, pulse);
      ctx.lineWidth = 3;
      ctx.shadowColor = band.color;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.fillStyle = hexToRgba(band.color, 0.08);
      ctx.fill();
    }

    // Band pulse animation
    if (i === pulsingBandIndex && showPulse) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX - widthBottom / 2, bandBottomY);
      ctx.lineTo(centerX + widthBottom / 2, bandBottomY);
      ctx.lineTo(centerX + widthTop / 2, bandTopY);
      ctx.lineTo(centerX - widthTop / 2, bandTopY);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(band.color, pulseAlpha);
      ctx.fill();
      ctx.restore();
    }

    // Band label — name centered, range on left
    const labelY = (bandTopY + bandBottomY) / 2;
    const isCurrent = isFilled || isPartial;
    const fontSize = Math.max(11, Math.min(14, w * 0.038));
    const rangeFontSize = Math.max(8, Math.min(10, w * 0.026));

    // Centered band name
    ctx.font = `${isCurrent ? '700' : '500'} ${isCurrent ? fontSize : fontSize - 1}px Montserrat, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isCurrent ? hexToRgba(band.color, 1) : hexToRgba(band.color, 0.25);
    ctx.fillText(band.label, centerX, labelY);

    // Vibe range on left edge
    const midWidth = widthBottom + (widthTop - widthBottom) * 0.5;
    const leftEdge = centerX - midWidth / 2;
    const rangeText = band.max >= 1000 ? '1000' : `${band.min}\u2013${band.max}`;
    ctx.font = `${isCurrent ? '700' : '400'} ${rangeFontSize}px Montserrat, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = isCurrent ? hexToRgba(band.color, 0.8) : hexToRgba(band.color, 0.18);
    ctx.fillText(rangeText, leftEdge - 4, labelY);
  }

  // Milestone marker
  if (milestoneTarget > 0) {
    const msNorm = milestoneTarget / 1000;
    const msY = funnelBottom - msNorm * funnelHeight;
    const msWidth = bottomWidth + (topWidth - bottomWidth) * msNorm;

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(centerX - msWidth / 2 - 6, msY);
    ctx.lineTo(centerX + msWidth / 2 + 6, msY);
    ctx.strokeStyle = score >= milestoneTarget ? '#ffd700' : 'rgba(255,215,0,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Flag label
    const flagX = centerX + msWidth / 2 + 8;
    ctx.save();
    ctx.font = '700 10px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = score >= milestoneTarget ? '#ffd700' : 'rgba(255,215,0,0.4)';
    ctx.fillText(score >= milestoneTarget ? '\u2605 Goal' : '\u2691 Goal', flagX, msY);
    ctx.restore();
  }
}

function animateFunnel() {
  const diff = targetFillScore - currentFillScore;
  if (Math.abs(diff) > 0.5) {
    currentFillScore += diff * 0.08;
  } else {
    currentFillScore = targetFillScore;
  }
  drawFunnel(currentFillScore);
  funnelAnimId = requestAnimationFrame(animateFunnel);
}

function setFunnelScore(score) {
  targetFillScore = score;
  if (!funnelAnimId) {
    funnelAnimId = requestAnimationFrame(animateFunnel);
  }
}

function stopFunnelAnim() {
  if (funnelAnimId) {
    cancelAnimationFrame(funnelAnimId);
    funnelAnimId = null;
  }
}

// Trigger band pulse for the band containing this score
function pulseBand(score) {
  const norm = score / 1000;
  for (let i = 0; i < FUNNEL_BANDS.length; i++) {
    const b = FUNNEL_BANDS[i];
    if (norm >= b.min / 1000 && norm < b.max / 1000) {
      pulsingBandIndex = i;
      pulseStart = performance.now();
      return;
    }
  }
  if (norm >= 1) {
    pulsingBandIndex = FUNNEL_BANDS.length - 1;
    pulseStart = performance.now();
  }
}

// ---- Score display ----
function animateScoreCountUp(targetScore) {
  const el = document.getElementById('pv-score-big');
  const headerEl = document.getElementById('peak-vibe-score');
  if (!el) return;

  const startScore = parseInt(el.textContent.replace(/,/g, ''), 10) || 0;
  const diff = targetScore - startScore;
  if (diff === 0) return;

  const duration = 400;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = Math.round(startScore + diff * eased);
    el.textContent = current.toLocaleString();
    if (headerEl) headerEl.textContent = current.toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function updateScoreDisplay(score, celebrate = true) {
  const scoreEl = document.getElementById('peak-vibe-score');
  const scoreBig = document.getElementById('pv-score-big');
  const scoreCard = document.getElementById('pv-score-card');
  const tierLabel = document.getElementById('peak-tier-indicator');
  const tierName = document.getElementById('pv-tier-name');
  const nextTierEl = document.getElementById('pv-tier-next');
  const tier = getScoreTier(score);
  const next = getNextTier(score);

  // Animate count-up
  if (celebrate && score !== currentVibeScore) {
    animateScoreCountUp(score);
  } else {
    if (scoreEl) scoreEl.textContent = Math.round(score).toLocaleString();
    if (scoreBig) scoreBig.textContent = Math.round(score).toLocaleString();
  }

  currentVibeScore = score;

  // Header colors
  if (scoreEl) scoreEl.style.color = tier.color;
  if (scoreBig) scoreBig.style.color = tier.color;

  // Header tier label
  if (tierLabel) {
    if (tier.label) {
      tierLabel.textContent = `${tier.label} \u2014 ${tier.name}`;
      tierLabel.style.color = tier.color;
    } else {
      tierLabel.textContent = 'Select 3 emotions below';
      tierLabel.style.color = 'var(--text-secondary)';
    }
  }

  // Next tier hint
  if (nextTierEl) {
    if (next) {
      nextTierEl.innerHTML = `Next: <span style="color:${next.color};font-weight:600">${next.name}</span> (${next.min}+)`;
    } else {
      nextTierEl.textContent = 'Maximum vibration reached!';
    }
  }

  // Score card glow
  if (scoreCard) {
    scoreCard.style.borderColor = score > 0 ? tier.color + '50' : 'var(--border-color)';
    scoreCard.style.boxShadow = score > 0 ? `0 0 30px ${tier.color}18` : 'none';
  }

  // Tier name under score
  if (tierName) {
    if (tier.label) {
      tierName.innerHTML = `<span>${tier.label}</span> &mdash; ${tier.name}`;
      tierName.style.color = tier.color;
      tierName.style.display = 'block';
    } else {
      tierName.style.display = 'none';
    }
  }

  // Goal badge
  updateGoalBadge(score);

  // Celebrations
  if (celebrate && tier.level > lastTierLevel && lastTierLevel > 0 && scoreCard) {
    triggerHaptic();
    if (tier.level >= 5) {
      fireConfetti(scoreCard);
      showToast('Ultimate Consciousness! You are in the vortex!', 'success');
    } else if (tier.level >= 2) {
      fireGlowRing(scoreCard, tier.color);
      const msgs = { 2: 'GREEN! Willingness activated!', 3: 'BLUE vibrations! Love energy!', 4: 'PURPLE! Enlightenment unlocked!' };
      showToast(msgs[tier.level] || `${tier.label} reached!`, 'success');
    }
  }
  lastTierLevel = tier.level;

  setFunnelScore(score);
}

// ---- Selected chips display ----
function updateSelectedChips() {
  const container = document.getElementById('pv-selected-chips');
  if (!container) return;

  const entries = [...selected.entries()];
  let html = '';
  for (let i = 0; i < 3; i++) {
    if (entries[i]) {
      const [val, label] = entries[i];
      const color = getChipColor(val);
      // Shorten label for chip display
      const shortLabel = label.length > 6 ? label.slice(0, 6) + '.' : label;
      html += `<span class="pv-chip-filled" style="border-color:${color};background:${hexToRgba(color, 0.2)};color:${color}">${val} ${shortLabel}</span>`;
    } else {
      html += '<span class="pv-chip-empty"></span>';
    }
  }
  container.innerHTML = html;
}

// ---- Bottom sheet ----
function openSheet() {
  document.getElementById('pv-sheet-overlay').classList.add('open');
}

function closeSheet() {
  document.getElementById('pv-sheet-overlay').classList.remove('open');
}

// ---- Emotion picker ----
function renderEmotionPicker() {
  const container = document.getElementById('peak-emotion-picker');
  container.innerHTML = VIBE_EMOTIONS.map(emo => `
    <button class="vibe-pick-btn" data-value="${emo.value}">
      <span class="vibe-pick-value">${emo.value}</span>
      <span class="vibe-pick-label">${emo.label}</span>
    </button>
  `).join('');

  container.querySelectorAll('.vibe-pick-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const val = parseInt(btn.dataset.value, 10);
      const label = btn.querySelector('.vibe-pick-label').textContent;

      if (selected.has(val)) {
        selected.delete(val);
        btn.classList.remove('selected');
      } else if (selected.size < 3) {
        selected.set(val, label);
        btn.classList.add('selected');
      } else {
        showToast('Pick only 3 emotions');
        return;
      }

      // Average
      let vibeScore = 0;
      if (selected.size > 0) {
        const sum = [...selected.keys()].reduce((s, v) => s + v, 0);
        vibeScore = Math.round(sum / selected.size);
      }

      // Pulse the band
      pulseBand(vibeScore);

      updateSelectedChips();
      updateScoreDisplay(vibeScore);

      const user = getCurrentUser();
      if (user) {
        const milestone = vibeScore >= 1000 ? 3 : vibeScore >= 700 ? 2 : vibeScore >= 500 ? 1 : 0;
        await updateUserSettings(user.uid, 'settings.peakVibe', vibeScore);
        await updateUserSettings(user.uid, 'settings.milestone', milestone);
      }
    });
  });
}

// ---- Screen registration ----
registerScreen('peak-vibration', {
  init() {
    renderEmotionPicker();

    // Bottom sheet controls
    document.getElementById('pv-choose-btn').addEventListener('click', openSheet);
    document.getElementById('pv-sheet-done').addEventListener('click', closeSheet);
    document.getElementById('pv-sheet-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeSheet();
    });

    // Goal toggle
    document.getElementById('pv-goal-toggle').addEventListener('click', () => {
      const wrap = document.getElementById('pv-goal-slider-wrap');
      const isOpen = wrap.style.display !== 'none';
      wrap.style.display = isOpen ? 'none' : 'block';
    });
  },

  enter() {
    initFunnel();
    initMilestoneSlider();
    const userData = getUserData();
    const vibeScore = userData?.settings?.peakVibe || 0;
    currentVibeScore = vibeScore;
    currentFillScore = vibeScore;
    const tier = getScoreTier(vibeScore);
    lastTierLevel = tier.level;
    selected.clear();
    updateSelectedChips();
    updateScoreDisplay(vibeScore, false);

    // Sync selected state from saved data
    document.querySelectorAll('.vibe-pick-btn').forEach(btn => btn.classList.remove('selected'));
  },

  leave() {
    stopFunnelAnim();
    closeSheet();
  }
});
