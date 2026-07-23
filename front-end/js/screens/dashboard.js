// Dashboard (#screen-dashboard) — the homepage. .
import { api } from '../api.js';
import { $, esc } from '../dom.js';
import { state } from '../state.js';
import { icon, subjectIcon } from '../icons.js';
import { coverageOf, statusBadge } from '../schedule.js';
import { trace } from '../debug.js';

let dashTab = 'priorities'; // remembered across re-renders

export function setDashTab(tab) {
  dashTab = tab;
  trace('dashboard: tab →', tab);
  renderDashboard();
}

export async function renderDashboard() {
  trace('dashboard: render (tab=' + dashTab + ')');
  const root = $('#screen-dashboard');
  const name = esc(state?.currentUser?.name || 'there');

  // Subjects for the panels + the SERVER serve priority feed.
  const [{ subjects }, feed] = await Promise.all([
    api('GET', '/api/subjects'),
    api('GET', '/api/priorities'),
  ]);
  const coverage = feed.coverage;
  const reviewed = feed.reviewedCount;
  const totalTopics = feed.totalTopics;

  root.innerHTML = `
    <div class="dashboard">
      <div class="dash-tabs">
        <button class="dash-tab${dashTab === 'priorities' ? ' active' : ''}" data-action="dash-tab" data-tab="priorities">Priorities</button>
        <button class="dash-tab${dashTab === 'subjects' ? ' active' : ''}" data-action="dash-tab" data-tab="subjects">Subject Details</button>
      </div>

      ${dashTab === 'priorities' ? prioritiesTab(subjects, feed) : subjectsTab(subjects)}
      
      <div class="intro-cards">
        <div class="intro-card intro-greeting">
          <span class="intro-icon">${icon('hand', { size: 26 })}</span>
          <h1 class="intro-name">Kia ora (Hello), ${name}</h1>
        </div>
        <div class="intro-card intro-stat">
          <div class="intro-pct">${coverage}%</div>
          <div>
            <p class="intro-stat-label">Coverage</p>
            <p class="intro-stat-sub">${reviewed} of ${totalTopics} topics reviewed</p>
          </div>
        </div>
      </div>

    

      <p class="wellbeing-footer">
        Schools and exams can be quite overwhelming for some people. Do you need someone to talk? Youthline : 0800 376 633 or text 234 can give you great support.
      </p>
    </div>`;
}

function prioritiesTab(subjects, feed) {
  if (!subjects.length) {
    return `<div class="empty-state">
        <p class="dashboard-sub">Let's add your first subject to get started.</p>
        <button class="btn btn-primary" data-action="add-subject">${icon('plus', { size: 15 })} Add subject</button>
      </div>`;
  }
  // Left column: today's review feed (chosen + ranked by the SERVER). Right: the panel.
  const { shown, moreCount, overdue, dueToday } = feed;
  trace('dashboard: prioritiesTab', { shown: shown.length, overdue, dueToday, moreCount });
  const feedHtml = shown.length
    ? `<p class="feed-summary">You have ${overdue} topics overdue, where ${dueToday} due today</p>
       ${shown.map(priorityCard).join('')}
       ${moreCount ? `<p class="more-when-ready">+${moreCount} more topics when you're ready</p>` : ''}`
    : `<p class="dashboard-sub">You're all caught up. Nice work!</p>`;
  return `
    <div class="dash-cols">
      <div class="feed-col">${feedHtml}</div>
      ${subjectsPanel(subjects)}
    </div>`;
}

// The "Your subjects" panel that sits BESIDE the priorities feed .
function subjectsPanel(subjects) {
  trace('dashboard: subjectsPanel', subjects.length, 'subjects');
  return `
    <aside class="subjects-panel">
      <h3 class="sp-title">Your subjects</h3>
      ${subjects.map(subjectPanelRow).join('')}
      <button class="btn btn-soft btn-block" data-action="add-subject">${icon('plus', { size: 15 })} Add subject</button>
    </aside>`;
}

function subjectPanelRow(subject) {
  const cov = coverageOf(subject.topics || []);
  return `
    <div class="sp-row">
      <div class="sp-head">
        <span class="sp-icon">${icon(subjectIcon(subject.name), { size: 18 })}</span>
        <span class="sp-name">${esc(subject.name)}</span>
        <span class="sp-pct">${cov}%</span>
      </div>
      <div class="progress"><span class="progress-fill" style="width:${cov}%"></span></div>
      <button class="sp-addtopic" data-action="add-topic" data-subject-id="${subject.id}" data-subject-name="${esc(subject.name)}">+ Add topics</button>
    </div>`;
}

//priority card

function priorityCard(item) {
  const badge = statusBadge(item);
  return `
    <div class="priority-card">
      <div class="pc-left">
        <span class="subject-tag">${esc(item.subjectName)}</span>
        <div class="pc-topic">${esc(item.name)}${item.standardNumber ? ` <span class="std">${esc(item.standardNumber)}</span>` : ''}</div>
        <div class="pc-meta">${item.reviewCount ? `Reviewed ${item.reviewCount}× · ready for review` : 'New topic- first review'}</div>
        <span class="status-badge ${badge.cls}">${badge.label}</span>
      </div>
      <button class="btn btn-soft" data-action="open-log" data-topic-id="${item.id}">${icon('circle-check-big', { size: 15 })} Log review</button>
    </div>`;
}

function subjectsTab(subjects) {
  if (!subjects.length) {
    return `<div class="empty-state">
        <p>You don't have any subjects yet but that's okay. You can add them any time=)</p>
        <button class="btn btn-primary" data-action="add-subject">${icon('plus', { size: 15 })} Add subject</button>
      </div>`;
  }
  return `${subjects.map(subjectSummaryCard).join('')}
    <button class="btn btn-soft btn-block add-subjects-btn" data-action="add-subject">${icon('plus', { size: 15 })} Add subjects</button>`;
}

function subjectSummaryCard(subject) {
  const topics = subject.topics || [];
  const cov = coverageOf(topics);
  const reviewed = topics.filter((t) => (t.reviewCount || 0) >= 1).length;
  return `
    <div class="subject-summary">
      <span class="ss-icon">${icon(subjectIcon(subject.name), { size: 26 })}</span>
      <div class="ss-body">
        <div class="ss-name">${esc(subject.name)}</div>
        <div class="ss-meta">You have reviewed ${reviewed} of ${topics.length} topics</div>
        <div class="progress"><span class="progress-fill" style="width:${cov}%"></span></div>
      </div>
      <div class="ss-pct">${cov}%</div>
    </div>`;
}
