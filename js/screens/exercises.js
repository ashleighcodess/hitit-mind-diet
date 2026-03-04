// ========================================
// Exercises Screen
// ========================================

import { registerScreen, getCurrentUser } from '../app.js';
import { getAssignments } from '../data/firestore.js';

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
  },
  {
    key: 'fears',
    title: 'Consistent Fears',
    icon: 'assets/exercises/fear-loop-head.png',
    description: 'Track and address your recurring fears'
  }
];

async function loadExercises() {
  const user = getCurrentUser();
  if (!user) return;

  const container = document.getElementById('exercises-list');

  try {
    const assignments = await getAssignments(user.uid);

    container.innerHTML = CATEGORIES.map(cat => {
      const catAssignments = assignments.filter(a => a.type === cat.key);
      const pending = catAssignments.filter(a => !a.completedAt).length;

      return `
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
    }).join('');

  } catch (err) {
    console.error('Failed to load exercises:', err);
    container.innerHTML = '<div class="empty-state">No exercises assigned yet.</div>';
  }
}

registerScreen('exercises', {
  init() {},
  enter() {
    loadExercises();
  },
  leave() {}
});
