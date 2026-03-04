// ========================================
// Reference Charts Screen (2 sub-pages)
// ========================================

import { registerScreen } from '../app.js';

let currentPage = 0;

function updateRefPage() {
  document.querySelectorAll('.ref-page').forEach((page, i) => {
    page.classList.toggle('active', i === currentPage);
  });
  document.querySelectorAll('#screen-reference .ref-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === currentPage);
  });
}

registerScreen('reference', {
  init() {
    // Page navigation
    document.querySelectorAll('#screen-reference .ref-dot').forEach((dot, i) => {
      dot.addEventListener('click', () => {
        currentPage = i;
        updateRefPage();
      });
    });

    // Swipe support
    let touchStartX = 0;
    const container = document.getElementById('ref-pages');
    container.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    container.addEventListener('touchend', (e) => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        if (diff > 0 && currentPage === 0) {
          currentPage = 1;
          updateRefPage();
        } else if (diff < 0 && currentPage === 1) {
          currentPage = 0;
          updateRefPage();
        }
      }
    }, { passive: true });
  },

  enter() {
    currentPage = 0;
    updateRefPage();
  },

  leave() {}
});
