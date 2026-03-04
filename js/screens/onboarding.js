// ========================================
// Onboarding — Two Interactive Demos
// Page 1: RED → GREEN/BLUE (burn negativity)
// Page 2: PURPLE → WHITE (peak vibration)
// ========================================

import { registerScreen, navigate } from '../app.js';

let currentPage = 0;
let demoTimeouts = [];
let demoRunning = false;

// ---- Shared score state ----
let demo1Score = 0;
let demo2Score = 0;

function clearAllTimeouts() {
  demoTimeouts.forEach(t => clearTimeout(t));
  demoTimeouts = [];
  demoRunning = false;
}

// ---- Animated score counter ----
function animateScoreTo(scoreVar, target, scoreElId, barFillId, opts = {}) {
  const start = scoreVar === 1 ? demo1Score : demo2Score;
  const diff = target - start;
  const duration = opts.duration || 400;
  const startTime = performance.now();
  const maxVal = opts.max || 9000;

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + diff * eased);

    if (scoreVar === 1) demo1Score = current;
    else demo2Score = current;

    updateScoreDisplay(current, scoreElId, barFillId, maxVal, opts);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function updateScoreDisplay(value, scoreElId, barFillId, maxVal, opts = {}) {
  const scoreEl = document.getElementById(scoreElId);
  const barFill = document.getElementById(barFillId);
  if (!scoreEl || !barFill) return;

  scoreEl.textContent = value >= 0
    ? '+' + value.toLocaleString()
    : value.toLocaleString();

  // Color classes
  scoreEl.classList.toggle('high', value > 0);
  scoreEl.classList.toggle('negative', value < 0 && value > -3000);
  scoreEl.classList.toggle('deep-negative', value <= -3000);

  // Bar
  const pct = Math.max(0, Math.min(100, (Math.abs(value) / maxVal) * 100));
  barFill.style.width = pct + '%';
  barFill.classList.toggle('cooling', value <= 0);
}

// ========================================
// DEMO 1: RED → GREEN/BLUE
// ========================================
function startDemo1() {
  const meter = document.querySelector('#onboard-demo .demo-meter');
  const narration = document.getElementById('demo-narration');
  const redRow = document.getElementById('demo-red-row');
  const positiveRow = document.getElementById('demo-positive-row');
  const success = document.getElementById('demo-success');

  if (!redRow) return;

  // Reset
  demo1Score = 0;
  updateScoreDisplay(0, 'demo-score', 'demo-bar-fill', 9000);
  document.getElementById('demo-score').textContent = '0';
  narration.textContent = 'Watch what happens when negative thoughts hit...';
  positiveRow.style.opacity = '0';
  positiveRow.style.pointerEvents = 'none';
  success.style.display = 'none';

  const redChips = redRow.querySelectorAll('.demo-chip');
  redChips.forEach(c => c.classList.remove('visible'));
  const posChips = positiveRow.querySelectorAll('.demo-tappable');
  posChips.forEach(c => c.classList.remove('visible', 'pulse', 'tapped'));

  // Phase 1: Red chips appear
  let runningTotal = 0;
  redChips.forEach((chip, i) => {
    const t = setTimeout(() => {
      if (!demoRunning) return;
      chip.classList.add('visible');
      runningTotal += parseInt(chip.dataset.cal);
      animateScoreTo(1, runningTotal, 'demo-score', 'demo-bar-fill');
      meter.classList.remove('shake');
      void meter.offsetWidth;
      meter.classList.add('shake');
    }, 800 + i * 700);
    demoTimeouts.push(t);
  });

  // Phase 2: Show positive row
  const afterRedsDelay = 800 + redChips.length * 700 + 600;
  demoTimeouts.push(setTimeout(() => {
    if (!demoRunning) return;
    narration.textContent = 'Now tap the positive actions to burn them off!';
    positiveRow.style.opacity = '1';
    positiveRow.style.pointerEvents = 'auto';
    positiveRow.style.transition = 'opacity 0.4s ease';

    posChips.forEach((chip, i) => {
      const t2 = setTimeout(() => {
        if (!demoRunning) return;
        chip.classList.add('visible', 'pulse');
      }, i * 200);
      demoTimeouts.push(t2);
    });
  }, afterRedsDelay));
}

function handleDemo1Tap(chip) {
  if (chip.classList.contains('tapped')) return;
  chip.classList.add('tapped');
  chip.classList.remove('pulse');

  const cal = parseInt(chip.dataset.cal);
  animateScoreTo(1, demo1Score + cal, 'demo-score', 'demo-bar-fill');

  const allTapped = document.querySelectorAll('.demo-tappable:not(.tapped)');
  if (allTapped.length === 0) {
    setTimeout(() => {
      if (!demoRunning) return;
      document.getElementById('demo-narration').textContent = '';
      document.getElementById('demo-success').style.display = 'block';
    }, 500);
  }
}

// ========================================
// DEMO 2: PURPLE → WHITE (ascension)
// ========================================
function startDemo2() {
  const meter = document.getElementById('demo2-meter');
  const narration = document.getElementById('demo2-narration');
  const purpleRow = document.getElementById('demo2-purple-row');
  const whiteRow = document.getElementById('demo2-white-row');
  const success = document.getElementById('demo2-success');

  if (!purpleRow) return;

  // Start at +3000 (leftover from page 1 concept)
  demo2Score = 3000;
  updateScoreDisplay(3000, 'demo2-score', 'demo2-bar-fill', 9000);
  narration.textContent = 'But there are even higher vibrations...';
  whiteRow.style.opacity = '0';
  whiteRow.style.pointerEvents = 'none';
  success.style.display = 'none';

  const purpleChips = purpleRow.querySelectorAll('.demo-chip');
  purpleChips.forEach(c => c.classList.remove('visible'));
  const whiteChips = whiteRow.querySelectorAll('.demo-tappable2');
  whiteChips.forEach(c => c.classList.remove('visible', 'pulse', 'tapped'));

  // Phase 1: Purple chips auto-animate in
  let runningTotal = 3000;
  purpleChips.forEach((chip, i) => {
    const t = setTimeout(() => {
      if (!demoRunning) return;
      chip.classList.add('visible');
      runningTotal += parseInt(chip.dataset.cal);
      animateScoreTo(2, runningTotal, 'demo2-score', 'demo2-bar-fill');
      meter.classList.remove('glow-purple');
      void meter.offsetWidth;
      meter.classList.add('glow-purple');
    }, 800 + i * 700);
    demoTimeouts.push(t);
  });

  // Phase 2: Show white row
  const afterPurpleDelay = 800 + purpleChips.length * 700 + 600;
  demoTimeouts.push(setTimeout(() => {
    if (!demoRunning) return;
    narration.textContent = 'Tap to reach peak vibration!';
    whiteRow.style.opacity = '1';
    whiteRow.style.pointerEvents = 'auto';
    whiteRow.style.transition = 'opacity 0.4s ease';

    whiteChips.forEach((chip, i) => {
      const t2 = setTimeout(() => {
        if (!demoRunning) return;
        chip.classList.add('visible', 'pulse');
      }, i * 200);
      demoTimeouts.push(t2);
    });
  }, afterPurpleDelay));
}

function handleDemo2Tap(chip) {
  if (chip.classList.contains('tapped')) return;
  chip.classList.add('tapped');
  chip.classList.remove('pulse');

  const cal = parseInt(chip.dataset.cal);
  animateScoreTo(2, demo2Score + cal, 'demo2-score', 'demo2-bar-fill');

  const allTapped = document.querySelectorAll('.demo-tappable2:not(.tapped)');
  if (allTapped.length === 0) {
    setTimeout(() => {
      if (!demoRunning) return;
      document.getElementById('demo2-narration').textContent = '';
      document.getElementById('demo2-success').style.display = 'block';
    }, 500);
  }
}

// ========================================
// Page management
// ========================================
function updatePage() {
  document.querySelectorAll('.onboard-page').forEach((page, i) => {
    page.classList.toggle('active', i === currentPage);
  });
  document.querySelectorAll('#screen-onboarding .dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === currentPage);
  });
  const nextBtn = document.getElementById('onboard-next');
  nextBtn.textContent = currentPage === 1 ? 'Start Tracking' : 'Next';

  // Start the appropriate demo
  clearAllTimeouts();
  demoRunning = true;
  if (currentPage === 0) startDemo1();
  else startDemo2();
}

registerScreen('onboarding', {
  init() {
    document.getElementById('onboard-next').addEventListener('click', () => {
      if (currentPage === 0) {
        currentPage = 1;
        updatePage();
      } else {
        localStorage.setItem('hitit_onboarded', '1');
        navigate('login');
      }
    });

    document.getElementById('onboard-skip').addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.setItem('hitit_onboarded', '1');
      navigate('login');
    });

    // Swipe support
    let touchStartX = 0;
    const container = document.getElementById('onboard-pages');
    container.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    container.addEventListener('touchend', (e) => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        if (diff > 0 && currentPage === 0) {
          currentPage = 1;
          updatePage();
        } else if (diff < 0 && currentPage === 1) {
          currentPage = 0;
          updatePage();
        }
      }
    }, { passive: true });

    // Dot navigation
    document.querySelectorAll('#screen-onboarding .dot').forEach((dot, i) => {
      dot.addEventListener('click', () => {
        if (currentPage !== i) {
          currentPage = i;
          updatePage();
        }
      });
    });

    // Page 1 tappable chips
    document.querySelectorAll('.demo-tappable').forEach(chip => {
      chip.addEventListener('click', () => handleDemo1Tap(chip));
    });

    // Page 2 tappable chips
    document.querySelectorAll('.demo-tappable2').forEach(chip => {
      chip.addEventListener('click', () => handleDemo2Tap(chip));
    });
  },
  enter() {
    currentPage = 0;
    demoRunning = true;
    updatePage();
  },
  leave() {
    clearAllTimeouts();
  }
});
