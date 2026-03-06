// ========================================
// HIT IT Mind Diet — Animations & Effects
// ========================================

// ---- Animated Canvas Waveforms ----
// Replaces static waveform images with live oscillating canvas waves

const activeCanvases = new Set();
let waveAnimRunning = false;

function getTierFromElement(el) {
  const section = el.closest('.tier-section, .tier-red, .tier-green, .tier-blue, .tier-purple, .tier-white');
  if (!section) return 'blue';
  for (const tier of ['red', 'green', 'blue', 'purple', 'white']) {
    if (section.classList.contains(`tier-${tier}`)) return tier;
  }
  return 'blue';
}

// Shared: fade edges to black
function fadeEdges(ctx, w, h) {
  ctx.globalAlpha = 1.0;
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, 'rgba(10, 10, 10, 0.8)');
  grad.addColorStop(0.08, 'transparent');
  grad.addColorStop(0.92, 'transparent');
  grad.addColorStop(1, 'rgba(10, 10, 10, 0.8)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

// ============================================================
// RED — SLOWEST vibration. Tiny, gentle, barely moving.
// 2 lines, very low frequency, small amplitude, very slow speed.
// Think: a lazy, sluggish pulse barely oscillating.
// ============================================================
function drawRedWave(ctx, w, h, time) {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);
  const midY = h / 2;

  for (let i = 0; i < 2; i++) {
    const opacity = 0.4 + i * 0.3;
    const speed = 0.08 + i * 0.02;   // VERY slow
    const amp = midY * 0.15;          // SMALL amplitude
    const freq = 0.8 + i * 0.2;      // LOW frequency — barely one full wave

    ctx.beginPath();
    ctx.moveTo(0, midY);
    for (let x = 0; x <= w; x++) {
      const xN = x / w;
      const envelope = Math.sin(xN * Math.PI);
      const wave = Math.sin(xN * freq * Math.PI * 2 + time * speed + i * 1.5);
      const y = midY + wave * amp * envelope;
      ctx.lineTo(x, y);
    }

    ctx.strokeStyle = 'rgba(255, 68, 68, 0.3)';
    ctx.lineWidth = 4;
    ctx.globalAlpha = opacity * 0.3;
    ctx.stroke();

    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = opacity;
    ctx.stroke();
  }

  fadeEdges(ctx, w, h);
}

// ============================================================
// GREEN — A step up from red. Slightly faster, slightly taller,
// 3 lines with a gentle secondary harmonic.
// ============================================================
function drawGreenWave(ctx, w, h, time) {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);
  const midY = h / 2;

  for (let i = 0; i < 3; i++) {
    const opacity = 0.3 + i * 0.2;
    const speed = 0.18 + i * 0.04;   // Noticeably faster than red
    const amp = midY * 0.2;           // A bit taller
    const freq = 1.2 + i * 0.3;      // Slightly higher freq

    ctx.beginPath();
    ctx.moveTo(0, midY);
    for (let x = 0; x <= w; x++) {
      const xN = x / w;
      const envelope = Math.sin(xN * Math.PI);
      const wave1 = Math.sin(xN * freq * Math.PI * 2 + time * speed + i * 0.8);
      const wave2 = Math.sin(xN * freq * 2.0 * Math.PI * 2 + time * speed * 0.6 + i * 2.0) * 0.15;
      const y = midY + (wave1 + wave2) * amp * envelope;
      ctx.lineTo(x, y);
    }

    ctx.strokeStyle = 'rgba(68, 204, 68, 0.3)';
    ctx.lineWidth = 4;
    ctx.globalAlpha = opacity * 0.25;
    ctx.stroke();

    ctx.strokeStyle = '#44cc44';
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = opacity;
    ctx.stroke();
  }

  fadeEdges(ctx, w, h);
}

// ============================================================
// BLUE — Medium. Clearly moving, 3 lines with layered harmonics.
// Faster and more complex than green.
// ============================================================
function drawBlueWave(ctx, w, h, time) {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);
  const midY = h / 2;

  for (let i = 0; i < 3; i++) {
    const opacity = 0.25 + i * 0.22;
    const speed = 0.35 + i * 0.08;   // Moderate speed
    const amp = midY * 0.25;          // Medium amplitude
    const freq = 1.8 + i * 0.5;      // Higher freq than green

    ctx.beginPath();
    ctx.moveTo(0, midY);
    for (let x = 0; x <= w; x++) {
      const xN = x / w;
      const envelope = Math.sin(xN * Math.PI);
      const wave1 = Math.sin(xN * freq * Math.PI * 2 + time * speed + i * 1.0);
      const wave2 = Math.sin(xN * freq * 1.5 * Math.PI * 2 + time * speed * 0.7 + i * 2.2) * 0.25;
      const wave3 = Math.sin(xN * freq * 2.5 * Math.PI * 2 + time * speed * 0.4 + i * 3.5) * 0.1;
      const y = midY + (wave1 + wave2 + wave3) * amp * envelope;
      ctx.lineTo(x, y);
    }

    ctx.strokeStyle = 'rgba(74, 158, 255, 0.25)';
    ctx.lineWidth = 4;
    ctx.globalAlpha = opacity * 0.25;
    ctx.stroke();

    ctx.strokeStyle = i === 2 ? '#6ab4ff' : '#4a9eff';
    ctx.lineWidth = 1.3;
    ctx.globalAlpha = opacity;
    ctx.stroke();
  }

  fadeEdges(ctx, w, h);
}

// ============================================================
// PURPLE — Fast. 4 lines, complex harmonics, rapid motion.
// Clearly energetic, building toward the peak.
// ============================================================
function drawPurpleWave(ctx, w, h, time) {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);
  const midY = h / 2;

  for (let i = 0; i < 4; i++) {
    const opacity = 0.2 + i * 0.18;
    const speed = 0.6 + i * 0.12;    // Fast
    const amp = midY * 0.28;          // Taller
    const freq = 2.5 + i * 0.7;      // High frequency

    ctx.beginPath();
    ctx.moveTo(0, midY);
    for (let x = 0; x <= w; x++) {
      const xN = x / w;
      const envelope = Math.sin(xN * Math.PI);
      const wave1 = Math.sin(xN * freq * Math.PI * 2 + time * speed + i * 0.9);
      const wave2 = Math.cos(xN * freq * 1.618 * Math.PI * 2 + time * speed * 0.7 + i * 1.8) * 0.25;
      const wave3 = Math.sin(xN * freq * 2.5 * Math.PI * 2 + time * speed * 0.5 + i * 3.0) * 0.12;
      const y = midY + (wave1 + wave2 + wave3) * amp * envelope;
      ctx.lineTo(x, y);
    }

    ctx.strokeStyle = 'rgba(170, 102, 255, 0.2)';
    ctx.lineWidth = 4;
    ctx.globalAlpha = opacity * 0.2;
    ctx.stroke();

    ctx.strokeStyle = i >= 2 ? '#c088ff' : '#aa66ff';
    ctx.lineWidth = 1.3;
    ctx.globalAlpha = opacity;
    ctx.stroke();
  }

  fadeEdges(ctx, w, h);
}

// ============================================================
// WHITE — FASTEST. 5 lines, highest frequency, biggest amplitude,
// chaotic harmonics, noise, rapid buzzing movement.
// Pure consciousness — the highest vibration.
// ============================================================
function drawWhiteWave(ctx, w, h, time) {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);
  const midY = h / 2;

  for (let i = 0; i < 5; i++) {
    const opacity = 0.15 + i * 0.16;
    const speed = 1.0 + i * 0.2;     // VERY fast
    const amp = midY * 0.32;          // Tallest amplitude
    const freq = 3.5 + i * 1.2;      // HIGHEST frequency

    ctx.beginPath();
    ctx.moveTo(0, midY);
    for (let x = 0; x <= w; x++) {
      const xN = x / w;
      const envelope = Math.sin(xN * Math.PI);
      const wave1 = Math.sin(xN * freq * Math.PI * 2 + time * speed + i * 1.5);
      const spike = Math.sin(xN * freq * 2.5 * Math.PI * 2 + time * speed * 1.6 + i) * 0.3;
      const buzz = Math.sin(xN * freq * 4.0 * Math.PI * 2 + time * speed * 2.0 + i * 2.5) * 0.12;
      const noise = (Math.random() - 0.5) * 0.18;
      const y = midY + (wave1 + spike + buzz + noise) * amp * envelope;
      ctx.lineTo(x, y);
    }

    ctx.strokeStyle = 'rgba(224, 224, 224, 0.15)';
    ctx.lineWidth = 3;
    ctx.globalAlpha = opacity * 0.25;
    ctx.stroke();

    ctx.strokeStyle = i >= 3 ? '#f0f0f0' : '#e0e0e0';
    ctx.lineWidth = 1.1;
    ctx.globalAlpha = opacity;
    ctx.stroke();
  }

  fadeEdges(ctx, w, h);
}

// Dispatch to tier-specific draw function
function drawWave(ctx, w, h, time, tier) {
  switch (tier) {
    case 'red':    drawRedWave(ctx, w, h, time); break;
    case 'green':  drawGreenWave(ctx, w, h, time); break;
    case 'blue':   drawBlueWave(ctx, w, h, time); break;
    case 'purple': drawPurpleWave(ctx, w, h, time); break;
    case 'white':  drawWhiteWave(ctx, w, h, time); break;
    default:       drawBlueWave(ctx, w, h, time); break;
  }
}

function animateAllWaves(time) {
  if (!waveAnimRunning) return;
  const t = time * 0.001; // seconds
  activeCanvases.forEach(({ canvas, ctx, tier }) => {
    // Only animate if canvas is in a visible screen
    const screen = canvas.closest('.screen');
    if (screen && screen.classList.contains('screen-active')) {
      drawWave(ctx, canvas.width, canvas.height, t, tier);
    }
  });
  requestAnimationFrame(animateAllWaves);
}

export function initWavePulses() {
  // Replace each .tier-wave img with an animated canvas
  document.querySelectorAll('.tier-wave').forEach(wave => {
    if (wave.querySelector('.wave-canvas')) return;
    const img = wave.querySelector('img');
    if (!img) return;

    const tier = getTierFromElement(wave);

    const canvas = document.createElement('canvas');
    canvas.classList.add('wave-canvas');
    canvas.width = 440; // 2x for retina
    canvas.height = 124; // ~3.5:1 ratio matching source images

    // Style to match the original img size
    canvas.style.cssText = img.style.cssText;

    const ctx = canvas.getContext('2d');

    // Hide original image, insert canvas before it
    img.style.display = 'none';
    wave.insertBefore(canvas, img);

    activeCanvases.add({ canvas, ctx, tier });
  });

  // Start the shared animation loop
  if (!waveAnimRunning && activeCanvases.size > 0) {
    waveAnimRunning = true;

    // Respect reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Draw once, static
      activeCanvases.forEach(({ canvas, ctx, tier }) => {
        drawWave(ctx, canvas.width, canvas.height, 0, tier);
      });
      waveAnimRunning = false;
    } else {
      requestAnimationFrame(animateAllWaves);
    }
  }
}

// ---- Stagger Entrance (Intersection Observer) ----
// Reveals tier sections and daily cards as they scroll into view
export function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  // Tier sections in tracker
  document.querySelectorAll('.tier-section').forEach(el => observer.observe(el));

  // Daily tier cards
  document.querySelectorAll('.daily-tier-card').forEach(el => observer.observe(el));
}

// ---- Animated Score Counter ----
// Smoothly counts from current value to new value
let scoreAnimFrame = null;

export function animateScore(element, newValue, duration = 600) {
  if (scoreAnimFrame) cancelAnimationFrame(scoreAnimFrame);

  const currentText = element.textContent.replace(/[^0-9-]/g, '');
  const startValue = parseInt(currentText, 10) || 0;
  const diff = newValue - startValue;
  if (diff === 0) return;

  const startTime = performance.now();

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(startValue + diff * eased);

    element.textContent = (current > 0 ? '+' : '') + current.toLocaleString();

    if (progress < 1) {
      scoreAnimFrame = requestAnimationFrame(update);
    } else {
      // Add bump animation
      element.classList.add('score-bump');
      setTimeout(() => element.classList.remove('score-bump'), 400);

      // Add glow to score bar
      const scoreBar = element.closest('.score-bar');
      if (scoreBar) {
        scoreBar.classList.remove('glowing', 'glow-positive', 'glow-negative');
        void scoreBar.offsetWidth; // force reflow
        scoreBar.classList.add('glowing');
        if (newValue < 0) scoreBar.classList.add('glow-positive'); // negative = good (burning)
        else if (newValue > 0) scoreBar.classList.add('glow-negative');
        setTimeout(() => scoreBar.classList.remove('glowing', 'glow-positive', 'glow-negative'), 1000);
      }
    }
  }

  scoreAnimFrame = requestAnimationFrame(update);
}

// ---- Calorie Flash ----
// Shows a floating +/- number near the score when an entry is logged
export function showCalorieFlash(container, calories) {
  const flash = document.createElement('div');
  flash.classList.add('score-flash');
  flash.classList.add(calories > 0 ? 'gain' : 'burn');
  flash.textContent = (calories > 0 ? '+' : '') + calories.toLocaleString();

  // Position near the score
  flash.style.left = '50%';
  flash.style.top = '50%';
  flash.style.transform = 'translate(-50%, -50%)';

  container.style.position = 'relative';
  container.appendChild(flash);

  setTimeout(() => flash.remove(), 1000);
}

// ---- Floating Energy Particles ----
// Creates subtle floating particles in a container
export function createParticles(container, count = 12, color = 'rgba(74, 158, 255, 0.3)') {
  if (container.querySelector('.particles-container')) return;

  const wrapper = document.createElement('div');
  wrapper.classList.add('particles-container');

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.classList.add('particle');

    const size = 3 + Math.random() * 5;
    const x = Math.random() * 100;
    const y = 20 + Math.random() * 60;
    const dur = 4 + Math.random() * 6;
    const delay = Math.random() * dur;
    const travel = -(40 + Math.random() * 80);
    const opacity = 0.15 + Math.random() * 0.25;

    p.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${x}%;
      top: ${y}%;
      background: ${color};
      --p-dur: ${dur}s;
      --p-delay: ${delay}s;
      --p-travel: ${travel}px;
      --p-opacity: ${opacity};
    `;

    wrapper.appendChild(p);
  }

  container.appendChild(wrapper);
}

// ---- Multi-color particles for splash ----
export function createSplashParticles(container) {
  const colors = [
    'rgba(74, 158, 255, 0.3)',   // blue
    'rgba(0, 212, 255, 0.25)',   // cyan
    'rgba(170, 102, 255, 0.25)', // purple
    'rgba(68, 204, 68, 0.2)',    // green
    'rgba(255, 255, 255, 0.15)'  // white
  ];

  if (container.querySelector('.particles-container')) return;

  const wrapper = document.createElement('div');
  wrapper.classList.add('particles-container');

  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.classList.add('particle');

    const size = 2 + Math.random() * 6;
    const x = Math.random() * 100;
    const y = 10 + Math.random() * 80;
    const dur = 5 + Math.random() * 8;
    const delay = Math.random() * dur;
    const travel = -(30 + Math.random() * 100);
    const opacity = 0.1 + Math.random() * 0.3;
    const color = colors[Math.floor(Math.random() * colors.length)];

    p.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${x}%;
      top: ${y}%;
      background: ${color};
      --p-dur: ${dur}s;
      --p-delay: ${delay}s;
      --p-travel: ${travel}px;
      --p-opacity: ${opacity};
    `;

    wrapper.appendChild(p);
  }

  container.appendChild(wrapper);
}

// ---- Daily Card Stagger ----
export function staggerDailyCards() {
  const cards = document.querySelectorAll('.daily-tier-card');
  cards.forEach((card, i) => {
    card.style.transitionDelay = `${i * 0.08}s`;
    // Trigger reveal after a micro-delay
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        card.classList.add('visible');
      });
    });
  });
}

// ---- Initialize All Animations ----
export function initAnimations() {
  initWavePulses();
  initScrollReveal();

  // Splash particles
  const splashHero = document.querySelector('.splash-hero');
  if (splashHero) {
    splashHero.style.position = 'relative';
    createSplashParticles(splashHero);
  }

  // Peak vibration particles
  const peakTriangle = document.querySelector('.peak-triangle');
  if (peakTriangle) {
    peakTriangle.style.position = 'relative';
    createParticles(peakTriangle, 10, 'rgba(170, 102, 255, 0.25)');
  }
}
