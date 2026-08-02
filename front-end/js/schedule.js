// Scheduling helpers used on the front end for display.

import { trace } from './debug.js';

export const INTERVALS = { 1: 1, 2: 3, 3: 7 };
export const INTERVAL_MAX = 14;

export function intervalFor(reviewCount) {
  return INTERVALS[reviewCount] || INTERVAL_MAX;
}

// Format a date as YYYY-MM-DD
function fmtLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return fmtLocal(new Date());
}

export function addDaysISO(iso, days) {
  const d = new Date(iso + 'T00:00:00'); // parse as local midnight
  d.setDate(d.getDate() + days);
  return fmtLocal(d);
}

// Whole days from a -> b (b - a). Positive = b is later.
export function daysBetween(aISO, bISO) {
  return Math.round((new Date(bISO + 'T00:00:00') - new Date(aISO + 'T00:00:00')) / 86400000);
}

// Work out a topic's status (new, overdue, due today, or ok).
export function statusOf(topic, today = todayISO()) {
  if (!topic.nextDue) return { status: 'new', days: 0 };
  const diff = daysBetween(topic.nextDue, today); // today - nextDue
  if (diff > 0) return { status: 'overdue', days: diff };
  if (diff === 0) return { status: 'due', days: 0 };
  return { status: 'ok', days: -diff }; // due in |diff| days
}

// Return badge text and style for a topic's status.
export function statusBadge(topic) {
  const st = statusOf(topic);
  if (st.status === 'new') return { cls: 'is-new', label: 'NEW' };
  if (st.status === 'overdue') return { cls: 'is-overdue', label: `${st.days}d overdue` };
  if (st.status === 'due') return { cls: 'is-due', label: 'due today' };
  return { cls: 'is-ok', label: `due in ${st.days}d` };
}

// Percentage of topics reviewed at least once.
export function coverageOf(topics = []) {
  if (!topics.length) return 0;
  const reviewed = topics.filter((t) => (t.reviewCount || 0) >= 1).length;
  return Math.round((reviewed / topics.length) * 100);
}

// Build the review list for today, capped by the daily limit.
export function buildPriorities(subjects = [], cap = 5) {
  
  const today = todayISO();
  const active = [];
  const news = [];
  subjects.forEach((s) => {
    if (s.internalMode) return; // paused while the student focuses on an internal
    (s.topics || []).forEach((t) => {
      const st = statusOf(t, today);
      const item = {
        ...t,
        subjectName: s.name,
        subjectId: s.id ?? t.subjectId,
        status: st.status,
        days: st.days,
        statusLabel: statusBadge(t).label,
      };
      if (st.status === 'overdue' || st.status === 'due') active.push(item);
      else if (st.status === 'new') news.push(item);
    });
  });
  const overdue = active.filter((i) => i.status === 'overdue').length;
  const dueToday = active.filter((i) => i.status === 'due').length;
  active.sort((a, b) => b.days - a.days); // most overdue first

  
  news.sort((a, b) => a.subjectId - b.subjectId || (a.id || 0) - (b.id || 0));
  const firstPerSubject = [];
  const seen = new Set();
  news.forEach((i) => {
    if (!seen.has(i.subjectId)) {
      seen.add(i.subjectId);
      firstPerSubject.push(i);
    }
  });
  firstPerSubject.sort((a, b) => (a.id || 0) - (b.id || 0));

  const display = [...active, ...firstPerSubject];
  const shown = display.slice(0, cap);
  const totalReviewable = active.length + news.length;
  trace('schedule: buildPriorities', { shown: shown.length, overdue, dueToday });
  return {
    shown,
    moreCount: totalReviewable - shown.length,
    overdue,
    dueToday,
  };
}
