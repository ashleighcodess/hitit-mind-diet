// ========================================
// Auth Screens — Login + Register (SPA)
// ========================================

import { auth } from '../firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { createUserDoc, getCoachUid } from '../data/firestore.js';
import { registerScreen, navigate, showToast } from '../app.js';

let selectedRole = 'client';

// ---- Login screen ----
registerScreen('login', {
  init() {
    const form = document.getElementById('login-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('login-btn');
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      if (!email || !password) {
        showToast('Please fill in all fields');
        return;
      }

      btn.disabled = true;
      btn.querySelector('.btn-text').textContent = 'Signing in...';

      try {
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged in app.js handles navigation
      } catch (err) {
        let message = 'Login failed';
        if (err.code === 'auth/user-not-found') message = 'No account found with this email';
        else if (err.code === 'auth/wrong-password') message = 'Incorrect password';
        else if (err.code === 'auth/invalid-email') message = 'Invalid email address';
        else if (err.code === 'auth/invalid-credential') message = 'Invalid email or password';
        showToast(message);
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'Sign In';
      }
    });
  },
  enter() {
    // Reset form
    const form = document.getElementById('login-form');
    if (form) form.reset();
    const btn = document.getElementById('login-btn');
    if (btn) {
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = 'Sign In';
    }
  },
  leave() {}
});

// ---- Register screen ----
registerScreen('register', {
  init() {
    // Role toggle
    document.querySelectorAll('#screen-register .role-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#screen-register .role-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedRole = btn.dataset.role;
      });
    });

    const form = document.getElementById('register-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('register-btn');
      const name = document.getElementById('register-name').value.trim();
      const email = document.getElementById('register-email').value.trim();
      const password = document.getElementById('register-password').value;

      if (!name || !email || !password) {
        showToast('Please fill in all fields');
        return;
      }
      if (password.length < 6) {
        showToast('Password must be at least 6 characters');
        return;
      }

      btn.disabled = true;
      btn.querySelector('.btn-text').textContent = 'Creating account...';

      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        // Auto-link clients to the coach
        let coachId = '';
        if (selectedRole === 'client') {
          coachId = await getCoachUid() || '';
        }
        await createUserDoc(cred.user.uid, { name, email, role: selectedRole, coachId });
        // onAuthStateChanged handles navigation
      } catch (err) {
        let message = 'Registration failed';
        if (err.code === 'auth/email-already-in-use') message = 'Email already in use';
        else if (err.code === 'auth/invalid-email') message = 'Invalid email address';
        else if (err.code === 'auth/weak-password') message = 'Password is too weak';
        showToast(message);
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'Create Account';
      }
    });
  },
  enter() {
    const form = document.getElementById('register-form');
    if (form) form.reset();
    selectedRole = 'client';
    document.querySelectorAll('#screen-register .role-btn').forEach(b => b.classList.remove('active'));
    const clientBtn = document.querySelector('#screen-register .role-btn[data-role="client"]');
    if (clientBtn) clientBtn.classList.add('active');
    const btn = document.getElementById('register-btn');
    if (btn) {
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = 'Create Account';
    }
  },
  leave() {}
});

// ---- Logout (global) ----
window.hititLogout = async function() {
  try {
    await signOut(auth);
    navigate('splash');
  } catch (err) {
    showToast('Logout failed');
  }
};
