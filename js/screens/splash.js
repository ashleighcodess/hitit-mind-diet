// ========================================
// Splash Screen
// ========================================

import { registerScreen, navigate } from '../app.js';

registerScreen('splash', {
  init() {
    document.getElementById('splash-get-started').addEventListener('click', (e) => {
      e.preventDefault();
      navigate('onboarding');
    });
  },
  enter() {},
  leave() {}
});
