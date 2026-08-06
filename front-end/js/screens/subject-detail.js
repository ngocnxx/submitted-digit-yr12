// Subject detail screen. Shows topics, review history, and coverage.

import { api } from '../api.js';
import { $, esc, toast } from '../dom.js';
import { icon, subjectIcon } from '../icons.js';
import { coverageOf, statusBadge, statusOf } from '../schedule.js';
import { openLogReview } from './log-review.js';
import { navigate, route } from '../router.js';
import { trace } from '../debug.js';

const CONF_LABEL = { shaky: 'Need more time', okay: 'Getting there', solid: 'Pretty well' };

function avgConfidence(topic) {
  const last = (topic.reviews || []).filter((r) => r.confidence).slice(-1)[0];
  return last ? CONF_LABEL[last.confidence] || last.confidence : null;
}

function topicRow(topic, isPriority = false) {
  const badge = statusBadge(topic);
  const pct = topic.reviewCount ? Math.min(100, topic.reviewCount * 25) : 0;
  const conf = avgConfidence(topic);
  const history = (topic.reviews || []).length
    ? `<details class="topic-history"><summary>View history (${topic.reviews.length})</summary>
         <ul>${topic.reviews
           .map(
             (r, i) =>
               `<li>R${i + 1} · ${esc(r.reviewedDate)}${r.confidence ? ` · ${esc(CONF_LABEL[r.confidence] || r.confidence)}` : ''} → due ${esc(r.nextDue)}${
                 r.reflection ? `<span class="hist-note">“${esc(r.reflection)}”</span>` : ''
               }</li>`,
           )
           .join('')}</ul></details>`
    : '';
  return `
    <div class="topic-row${isPriority ? ' topic-priority' : ''}">
      <div class="topic-main">
        <div class="topic-name">${esc(topic.name)}${topic.standardNumber ? ` <span class="std">${esc(topic.standardNumber)}</span>` : ''}</div>
        <div class="topic-meta">${topic.reviewCount ? `Reviewed ${topic.reviewCount}× · ${pct}%` : 'Not yet reviewed'}${conf ? ` · <span class="conf-tag">${esc(conf)}</span>` : ''}</div>
        ${history}
      </div>
      <div class="topic-side">
        <button class="btn btn-soft btn-sm" data-action="open-log" data-topic-id="${topic.id}">${icon('circle-check-big', { size: 15 })} Log review</button>
        <span class="status-badge ${badge.cls}">${badge.label}</span>
      </div>
    </div>`;
}

export async function renderSubjectDetail(subjectId) {
  trace('subject-detail: render', subjectId);
  const root = $('#screen-subject');
  const { subjects } = await api('GET', '/api/subjects');
  const subject = subjects.find((s) => String(s.id) === String(subjectId));
  if (!subject) {
    navigate('#dashboard');
    return;
  }

  const topics = subject.topics || [];
  const cov = coverageOf(topics);
  const reviewed = topics.filter((t) => (t.reviewCount || 0) >= 1).length;
  // Find the most urgent topic to show at the top
  const RANK = { overdue: 3, due: 2, new: 1, ok: 0 };
  const sorted = [...topics].sort((a, b) => {
    const ra = statusOf(a);
    const rb = statusOf(b);
    return RANK[rb.status] - RANK[ra.status] || rb.days - ra.days;
  });
  const priority = sorted[0] && statusOf(sorted[0]).status !== 'ok' ? sorted[0] : null;
  const internal = !!subject.internalMode; // true if internal mode is on

  root.innerHTML = `
    <div class="subject-detail">
      <button class="link-back" data-action="nav-dashboard">${icon('log-out', { size: 16, cls: 'flip' })} Back</button>

      <div class="sd-head">
        <h1 class="sd-title">${icon(subjectIcon(subject.name), { size: 30, cls: 'subject-icon' })} ${esc(subject.name)}</h1>
        <div class="sd-actions">
          <button class="btn btn-soft btn-sm" data-action="add-topic" data-subject-id="${subject.id}" data-subject-name="${esc(subject.name)}">${icon('plus', { size: 15 })} Add topics</button>
        </div>
      </div>

      <p class="sd-coverage">Coverage: ${cov}% (${reviewed} of ${topics.length} topics reviewed)</p>
      <div class="progress"><span class="progress-fill" style="width:${cov}%"></span></div>

      ${internal ? '<div class="internal-banner">Internal mode is on — this subject is paused while you focus on the assessment.</div>' : ''}

      ${priority ? `<h3 class="sd-section">Today's priority</h3>${topicRow(priority, true)}` : ''}

      <h3 class="sd-section">All topics</h3>
      ${topics.length ? topics.map((t) => topicRow(t)).join('') : '<p class="muted small">No topics yet — add some to get started.</p>'}

      <button class="btn btn-internal" data-action="toggle-internal" data-subject-id="${subject.id}">
        ${internal ? 'Stop' : 'Start'} Internal mode for ${esc(subject.name)}
      </button>
    </div>`;
}

// Toggle internal (assessment) mode on or off for this subject
export async function onToggleInternal(id) {
  try {
    const { subjects } = await api('GET', '/api/subjects');
    const subject = subjects.find((s) => String(s.id) === String(id));
    const on = subject && subject.internalMode;
    await api('POST', on ? '/api/assessment-mode-end' : '/api/assessment-mode-start', {
      subjectId: Number(id),
    });
    trace('subject-detail: internal mode', on ? 'ended' : 'started', id);
    toast(on ? 'Internal mode ended — topics caught up' : 'Internal mode on — subject paused');
    route();
  } catch (e) {
    toast(e.message || 'Could not update internal mode');
  }
}
