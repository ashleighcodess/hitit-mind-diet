// ========================================
// Reference Charts Screen (continuous scroll)
// ========================================

import { registerScreen } from '../app.js';

registerScreen('reference', {
  init() {},

  enter() {
    // Scroll to top when entering
    const screen = document.getElementById('screen-reference');
    if (screen) screen.scrollTop = 0;
  },

  leave() {}
});
