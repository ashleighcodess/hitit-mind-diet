// ========================================
// Onboarding — Get Started Pages (2 swipeable pages)
// ========================================

import { registerScreen, navigate } from '../app.js';

let currentPage = 0;

function updatePage() {
  document.querySelectorAll('.onboard-page').forEach((page, i) => {
    page.classList.toggle('active', i === currentPage);
  });
  document.querySelectorAll('#screen-onboarding .dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === currentPage);
  });
  const nextBtn = document.getElementById('onboard-next');
  nextBtn.textContent = currentPage === 1 ? 'Start Tracking' : 'Next';
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
        currentPage = i;
        updatePage();
      });
    });
  },
  enter() {
    currentPage = 0;
    updatePage();
  },
  leave() {}
});
