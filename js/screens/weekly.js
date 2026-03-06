// ========================================
// Weekly Results Screen
// ========================================

import { registerScreen, getCurrentUser } from '../app.js';
import { getEntriesForDateRange, todayStr, getWeekDays, calcDailyTotals, groupEntriesByDate } from '../data/firestore.js';

async function loadWeeklyData() {
  const user = getCurrentUser();
  if (!user) return;

  const today = todayStr();
  const weekDays = getWeekDays(today);
  const startDate = weekDays[0];
  const endDate = weekDays[6];

  // Get previous week too for improvement calculation
  const prevStart = new Date(startDate + 'T00:00:00');
  prevStart.setDate(prevStart.getDate() - 7);
  const prevStartStr = prevStart.toISOString().slice(0, 10);
  const prevEndStr = new Date(startDate + 'T00:00:00');
  prevEndStr.setDate(prevEndStr.getDate() - 1);
  const prevEndString = prevEndStr.toISOString().slice(0, 10);

  try {
    const [currentEntries, prevEntries] = await Promise.all([
      getEntriesForDateRange(user.uid, startDate, endDate),
      getEntriesForDateRange(user.uid, prevStartStr, prevEndString)
    ]);

    const currentByDate = groupEntriesByDate(currentEntries);
    const prevByDate = groupEntriesByDate(prevEntries);

    // Calculate current week stats
    let totalWeight = 0;
    let totalResistance = 0;
    let totalVibes = 0;
    let daysWithEntries = 0;

    weekDays.forEach(day => {
      const dayEntries = currentByDate[day] || [];
      if (dayEntries.length > 0) {
        daysWithEntries++;
        const totals = calcDailyTotals(dayEntries);
        totalWeight += totals.net;
        totalResistance += totals.redTotal;
        totalVibes += dayEntries.length;
      }
    });

    const avgWeight = daysWithEntries > 0 ? Math.round(totalWeight / daysWithEntries) : 0;
    const avgResistance = daysWithEntries > 0 ? Math.round(totalResistance / daysWithEntries) : 0;

    // Previous week stats for improvement
    let prevTotalWeight = 0;
    let prevDays = 0;
    let prevTotalResistance = 0;

    Object.values(prevByDate).forEach(dayEntries => {
      prevDays++;
      const totals = calcDailyTotals(dayEntries);
      prevTotalWeight += totals.net;
      prevTotalResistance += totals.redTotal;
    });

    const prevAvgWeight = prevDays > 0 ? Math.round(prevTotalWeight / prevDays) : 0;
    const prevAvgResistance = prevDays > 0 ? Math.round(prevTotalResistance / prevDays) : 0;

    // Improvement rates
    const weightImprovement = prevAvgWeight !== 0
      ? Math.round(((prevAvgWeight - avgWeight) / Math.abs(prevAvgWeight)) * 100) : 0;
    const resistanceImprovement = prevAvgResistance !== 0
      ? Math.round(((prevAvgResistance - avgResistance) / Math.abs(prevAvgResistance)) * 100) : 0;

    // Render cards
    renderWeeklyCard('weekly-weight', {
      daily: avgWeight,
      weekly: totalWeight,
      improvement: weightImprovement,
      label: 'Mind Weight'
    });

    renderWeeklyCard('weekly-resistance', {
      daily: avgResistance,
      weekly: totalResistance,
      improvement: resistanceImprovement,
      label: 'No Resistance Progress'
    });

    renderWeeklyCard('weekly-vibes', {
      daily: daysWithEntries > 0 ? Math.round(totalVibes / daysWithEntries) : 0,
      weekly: totalVibes,
      improvement: 0,
      label: 'Total Vibrations'
    });

  } catch (err) {
    console.error('Failed to load weekly data:', err);
  }
}

function renderWeeklyCard(id, data) {
  const el = document.getElementById(id);
  if (!el) return;

  const sign = data.daily > 0 ? '+' : '';
  const weekSign = data.weekly > 0 ? '+' : '';
  const impClass = data.improvement > 0 ? 'positive' : data.improvement < 0 ? 'negative' : '';
  const impSign = data.improvement > 0 ? '+' : '';

  el.querySelector('.weekly-daily').textContent = sign + data.daily.toLocaleString();
  el.querySelector('.weekly-total').textContent = weekSign + data.weekly.toLocaleString();

  const impEl = el.querySelector('.weekly-improvement');
  if (impEl) {
    impEl.textContent = data.improvement !== 0 ? `${impSign}${data.improvement}% vs last week` : 'No prior data';
    impEl.className = 'weekly-improvement ' + impClass;
  }
}

registerScreen('weekly', {
  init() {},
  enter() {
    // Force video autoplay on mobile
    const vid = document.querySelector('#screen-weekly .weekly-video-header video');
    if (vid) vid.play().catch(() => {});

    loadWeeklyData();
  },
  leave() {}
});
