// ========================================
// Firebase Configuration — HIT IT Mind Diet
// ========================================
// IMPORTANT: Replace these placeholder values with your actual
// Firebase project config from the Firebase Console:
// Project Settings > General > Your apps > Web app > Config
// ========================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyBqF4WQ3cliDFZ4B1WV7kB71NNNrB7Z3UQ",
  authDomain: "hitit-mind-diet.firebaseapp.com",
  projectId: "hitit-mind-diet",
  storageBucket: "hitit-mind-diet.firebasestorage.app",
  messagingSenderId: "1076011378072",
  appId: "1:1076011378072:web:5456f4aa12b4248fbcf7ed"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
