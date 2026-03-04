// ========================================
// SPA Router + Screen Manager
// ========================================

import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getUserDoc } from './data/firestore.js';

// ---- Screen registry ----
const screens = {};
let currentScreen = null;
let currentUser = null;
let userDoc = null;

// Public screens (no auth needed)
const PUBLIC_SCREENS = ['splash', 'onboarding', 'login', 'register'];

// Screens that show the bottom nav
const NAV_SCREENS = ['tracker', 'daily', 'weekly', 'peak-vibration', 'exercises', 'reference', 'coach'];

export function registerScreen(name, { init, enter, leave }) {
  screens[name] = { init, enter, leave, initialized: false };
}

export function getCurrentUser() {
  return currentUser;
}

export function getUserData() {
  return userDoc;
}

export function setUserData(data) {
  userDoc = data;
}

// ---- Navigation ----
export function navigate(screen) {
  if (window.location.hash === '#' + screen) {
    // Force re-enter if already on this screen
    activateScreen(screen);
  } else {
    window.location.hash = screen;
  }
}

function activateScreen(name) {
  const screenDef = screens[name];
  if (!screenDef) {
    console.warn('Unknown screen:', name);
    navigate('splash');
    return;
  }

  // Auth guard
  if (!PUBLIC_SCREENS.includes(name) && !currentUser) {
    navigate('login');
    return;
  }

  // Coach guard
  if (name === 'coach' && userDoc?.role !== 'coach') {
    navigate('tracker');
    return;
  }

  // Leave current screen
  if (currentScreen && screens[currentScreen]?.leave) {
    screens[currentScreen].leave();
  }

  // Hide all screens
  document.querySelectorAll('.screen').forEach(el => {
    el.classList.remove('screen-active');
  });

  // Show target screen
  const screenEl = document.getElementById('screen-' + name);
  if (screenEl) {
    screenEl.classList.add('screen-active');
  }

  // Bottom nav visibility
  const bottomNav = document.getElementById('bottom-nav');
  if (bottomNav) {
    bottomNav.classList.toggle('nav-visible', NAV_SCREENS.includes(name));
  }

  // Update nav active state
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.screen === name);
  });

  // Initialize screen if first visit
  if (!screenDef.initialized && screenDef.init) {
    screenDef.init();
    screenDef.initialized = true;
  }

  // Enter screen
  if (screenDef.enter) {
    screenDef.enter();
  }

  currentScreen = name;
}

// ---- Toast helper ----
export function showToast(message, type = 'error') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => { toast.className = 'toast'; }, 3000);
}

// ---- Escape HTML ----
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ---- Hash change listener ----
function onHashChange() {
  const hash = window.location.hash.slice(1) || 'splash';
  activateScreen(hash);
}

// ---- Init ----
export function initApp() {
  // Bottom nav click handlers
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(tab.dataset.screen);
    });
  });

  // Auth state listener
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      try {
        userDoc = await getUserDoc(user.uid);
      } catch (err) {
        console.error('Failed to load user data:', err);
      }

      // If on a public screen, redirect to tracker
      const hash = window.location.hash.slice(1) || 'splash';
      if (PUBLIC_SCREENS.includes(hash)) {
        // Check if user has seen onboarding
        const hasOnboarded = localStorage.getItem('hitit_onboarded');
        if (hasOnboarded) {
          if (userDoc?.role === 'coach') {
            navigate('coach');
          } else {
            navigate('tracker');
          }
        } else {
          navigate('onboarding');
        }
      } else {
        activateScreen(hash);
      }
    } else {
      currentUser = null;
      userDoc = null;
      const hash = window.location.hash.slice(1) || 'splash';
      if (!PUBLIC_SCREENS.includes(hash)) {
        navigate('login');
      } else {
        activateScreen(hash);
      }
    }
  });

  // Listen for hash changes
  window.addEventListener('hashchange', onHashChange);
}
