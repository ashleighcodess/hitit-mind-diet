// ========================================
// Shared Firestore Operations
// ========================================

import { db } from '../firebase-config.js';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ---- Date helpers ----
export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function formatTime(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// Get start of week (Monday)
export function weekStartStr(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

// Get all 7 days of the week containing dateStr
export function getWeekDays(dateStr) {
  const start = weekStartStr(dateStr);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start + 'T00:00:00');
    d.setDate(d.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

// ---- Entry operations ----
export async function logEntry(userId, emotion, tier, calories, details = '') {
  return addDoc(collection(db, 'entries'), {
    userId,
    emotion,
    tier,
    calories,
    details,
    timestamp: serverTimestamp(),
    date: todayStr()
  });
}

export function subscribeToEntries(userId, date, callback, onError) {
  const q = query(
    collection(db, 'entries'),
    where('userId', '==', userId),
    where('date', '==', date),
    orderBy('timestamp', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(entries);
  }, onError);
}

export async function getEntriesForDate(userId, date) {
  const q = query(
    collection(db, 'entries'),
    where('userId', '==', userId),
    where('date', '==', date),
    orderBy('timestamp', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getEntriesForDateRange(userId, startDate, endDate) {
  const q = query(
    collection(db, 'entries'),
    where('userId', '==', userId),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'desc'),
    orderBy('timestamp', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ---- User operations ----
export async function getUserDoc(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export async function createUserDoc(uid, data) {
  return setDoc(doc(db, 'users', uid), {
    name: data.name,
    email: data.email,
    role: data.role || 'client',
    coachId: data.coachId || '',
    createdAt: serverTimestamp(),
    settings: {
      ritual: '',
      intention: '',
      reward: '',
      consequence: '',
      topFears: ['', '', '', ''],
      peakVibe: 0,
      milestone: 0
    },
    goals: {
      dailyTarget: 0,
      weeklyTarget: 0
    }
  });
}

export async function updateUserSettings(uid, path, value) {
  return updateDoc(doc(db, 'users', uid), { [path]: value });
}

// ---- Coach operations ----
export async function getClientsByCoach(coachId) {
  const q = query(
    collection(db, 'users'),
    where('role', '==', 'client'),
    where('coachId', '==', coachId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ---- Assignment operations ----
export async function createAssignment(data) {
  return addDoc(collection(db, 'assignments'), {
    ...data,
    createdAt: serverTimestamp(),
    completedAt: null,
    uploadUrl: ''
  });
}

export async function getAssignments(clientId) {
  const q = query(
    collection(db, 'assignments'),
    where('clientId', '==', clientId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ---- Aggregation helpers ----
export function calcDailyTotals(entries) {
  const redTotal = entries
    .filter(e => e.tier === 'red')
    .reduce((sum, e) => sum + e.calories, 0);
  const positiveTotal = entries
    .filter(e => e.tier !== 'red')
    .reduce((sum, e) => sum + e.calories, 0);
  const net = entries.reduce((sum, e) => sum + e.calories, 0);
  return { redTotal, positiveTotal, net };
}

export function groupEntriesByDate(entries) {
  const grouped = {};
  entries.forEach(e => {
    if (!grouped[e.date]) grouped[e.date] = [];
    grouped[e.date].push(e);
  });
  return grouped;
}

export function countByEmotion(entries) {
  const counts = {};
  entries.forEach(e => {
    counts[e.emotion] = (counts[e.emotion] || 0) + 1;
  });
  return counts;
}
