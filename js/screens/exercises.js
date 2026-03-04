// ========================================
// Exercises Screen
// ========================================

import { registerScreen, getCurrentUser, getUserData, showToast } from '../app.js';
import { getAssignments, updateUserSettings } from '../data/firestore.js';

const CATEGORIES = [
  {
    key: 'task',
    title: 'Task Assignments',
    icon: 'assets/exercises/mountain-flag.png',
    description: 'Daily and weekly tasks from your coach'
  },
  {
    key: 'video',
    title: 'Videos',
    icon: 'assets/exercises/mental-mind.png',
    description: 'Principle videos and guided practices'
  },
  {
    key: 'visual',
    title: 'Visuals',
    icon: 'assets/exercises/mental-mind.png',
    description: 'Vision boards and visual exercises'
  },
  {
    key: 'mental',
    title: 'Mental Exercises',
    icon: 'assets/exercises/mental-mind.png',
    description: 'Mind training and awareness practices'
  }
];

let fearTimeout = null;
let gratitudeTimeout = null;

function getEmbedUrl(url) {
  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  m = url.match(/vimeo\.com\/(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  return null;
}

function renderMedia(url, type) {
  const embed = getEmbedUrl(url);
  if (embed) {
    return `<iframe src="${embed}" frameborder="0" allowfullscreen class="exercise-media-video" style="aspect-ratio:16/9;"></iframe>`;
  }
  if (type === 'video') {
    return `<video src="${url}" controls preload="metadata" class="exercise-media-video"></video>`;
  }
  return `<img src="${url}" alt="" class="exercise-media-img">`;
}

function saveFears() {
  clearTimeout(fearTimeout);
  fearTimeout = setTimeout(() => {
    const user = getCurrentUser();
    if (!user) return;
    const fears = [];
    document.querySelectorAll('.fear-input').forEach(input => {
      fears.push(input.value.trim());
    });
    updateUserSettings(user.uid, 'settings.topFears', fears)
      .catch(err => console.error('Failed to save fears:', err));
  }, 800);
}

function saveGratitudes() {
  clearTimeout(gratitudeTimeout);
  gratitudeTimeout = setTimeout(() => {
    const user = getCurrentUser();
    if (!user) return;
    const gratitudes = [];
    document.querySelectorAll('.gratitude-input').forEach(input => {
      gratitudes.push(input.value.trim());
    });
    updateUserSettings(user.uid, 'settings.gratitudes', gratitudes)
      .catch(err => console.error('Failed to save gratitudes:', err));
  }, 800);
}

async function loadExercises() {
  const user = getCurrentUser();
  if (!user) return;

  const container = document.getElementById('exercises-list');
  const userData = getUserData();
  const fears = userData?.settings?.topFears || ['', '', '', ''];
  const gratitudes = userData?.settings?.gratitudes || ['', '', '', '', '', ''];

  try {
    const assignments = await getAssignments(user.uid);

    let html = '';

    // Assignment category cards
    html += CATEGORIES.map(cat => {
      const catAssignments = assignments.filter(a => a.type === cat.key);
      const pending = catAssignments.filter(a => !a.completedAt).length;

      let cardHtml = `
        <div class="exercise-card" data-category="${cat.key}">
          <img src="${cat.icon}" alt="${cat.title}" class="exercise-icon">
          <div class="exercise-info">
            <h3 class="exercise-title">${cat.title}</h3>
            <p class="exercise-desc">${cat.description}</p>
            ${pending > 0 ? `<span class="exercise-badge">${pending} pending</span>` : ''}
          </div>
          <span class="exercise-arrow">&rsaquo;</span>
        </div>
      `;

      // Show assigned media items below the category card
      if (catAssignments.length > 0) {
        cardHtml += catAssignments.map(a => {
          let mediaHtml = '';
          if (a.mediaUrl) {
            mediaHtml = renderMedia(a.mediaUrl, a.type);
          }
          return `
            <div class="exercise-assignment-item">
              <div class="exercise-assign-title">${escapeAttr(a.title)}</div>
              ${a.description ? `<div class="exercise-assign-desc">${escapeAttr(a.description)}</div>` : ''}
              ${mediaHtml}
              ${a.dueDate ? `<div class="exercise-assign-due">Due: ${a.dueDate}</div>` : ''}
            </div>
          `;
        }).join('');
      }

      return cardHtml;
    }).join('');

    // Fears + Gratitudes card
    html += `
      <div class="exercise-card exercise-card-full">
        <div class="exercise-card-inner">
          <div class="exercise-card-row">
            <img src="assets/exercises/fear-loop-head.png" alt="Fears" class="exercise-icon">
            <div class="exercise-info">
              <h3 class="exercise-title">Your Most Consistent Fears</h3>
              <p class="exercise-desc">4 Fear Drop Downs to fill out</p>
            </div>
            <span class="exercise-count">${fears.filter(f => f).length} Fears</span>
          </div>
          <div class="exercise-dropdowns">
            ${fears.map((f, i) => `
              <input type="text" class="fear-input exercise-dropdown"
                     placeholder="Fear ${i + 1}" value="${escapeAttr(f)}" maxlength="100">
            `).join('')}
          </div>

          <div class="exercise-divider"></div>

          <div class="exercise-card-row">
            <div class="exercise-info">
              <h3 class="exercise-title">What I Am Grateful For</h3>
              <p class="exercise-desc">6 Grateful Drop Downs — can be filled out</p>
            </div>
            <span class="exercise-count">${gratitudes.filter(g => g).length} Gratefuls</span>
          </div>
          <div class="exercise-dropdowns">
            ${gratitudes.map((g, i) => `
              <input type="text" class="gratitude-input exercise-dropdown"
                     placeholder="Grateful ${i + 1}" value="${escapeAttr(g)}" maxlength="100">
            `).join('')}
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Attach input listeners
    container.querySelectorAll('.fear-input').forEach(input => {
      input.addEventListener('input', saveFears);
    });
    container.querySelectorAll('.gratitude-input').forEach(input => {
      input.addEventListener('input', saveGratitudes);
    });

  } catch (err) {
    console.error('Failed to load exercises:', err);
    container.innerHTML = '<div class="empty-state">No exercises assigned yet.</div>';
  }
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

registerScreen('exercises', {
  init() {},
  enter() {
    loadExercises();
  },
  leave() {}
});
