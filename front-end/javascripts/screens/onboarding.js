// Onboarding screen — the 3-step first-run flow:
//   step 1  welcome  → step 2  add first subject → step 3  add topics.
// State lives in state.onboarding (step / createdSubject / addedTopics) so the
// screen can be re-rendered from a single source of truth.

import { $, $$, show, hide, esc, withPending } from '../dom.js';
import { state, resetOnboarding } from '../state.js';
import { trace } from '../debug.js';
import { navigate } from '../router.js';
import { api } from '../api.js';

// Show the card for the current step, update the progress dots, and (re)draw
// any Lucide icons that just became visible.
function renderStep() {
  const step = state.onboarding.step;
  trace('onboarding: renderStep →', step);

  [1, 2, 3].forEach((n) => {
    const el = document.getElementById(`ob-step-${n}`);
    if (el) el.classList.toggle('hidden', n !== step);
  });

  $$('#ob-dots .dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === step - 1);
    dot.classList.toggle('done', i < step - 1);
  });

  // Lucide is loaded from a CDN as a global; re-scan for <i data-lucide> icons.
  if (window.lucide) window.lucide.createIcons();
}

// Called by the router every time the onboarding screen is shown.
export function hydrateOnboarding() {
  trace('onboarding: hydrateOnboarding()');
  renderStep();

  // Reveal the free-text field only when "Other" is picked. Bind once.
  const sel = $('#ob-subj-select');
  if (sel && !sel.dataset.bound) {
    sel.dataset.bound = '1';
    sel.addEventListener('change', () => {
      const isOther = sel.value.startsWith('Other');
      $('#ob-custom-field').classList.toggle('hidden', !isOther);
    });
  }
}

function showErr(sel, msg) {
  const el = $(sel);
  if (!el) return;
  el.textContent = msg;
  show(el);
}

// ── Step 1 → Step 2 ─────────────────────────────────────────────
export function obNext() {
  state.onboarding.step = 2;
  renderStep();
}

// ── Step 2: create the first subject, then advance to step 3 ─────
export async function obAddSubject(btn) {
  hide($('#ob-subject-err'));
  const sel = $('#ob-subj-select');
  const custom = $('#ob-custom').value.trim();
  const name = (sel.value.startsWith('Other') ? custom : sel.value).trim();

  if (!name) {
    showErr('#ob-subject-err', 'Please choose or type a subject.');
    return;
  }

  try {
    const r = await withPending(btn, 'Adding…', () =>
      api('POST', '/api/subjects', { name }),
    );
    state.onboarding.createdSubject = r.subject;
    $('#ob-subject-name').textContent = name;
    state.onboarding.step = 3;
    renderStep();
  } catch (e) {
    showErr('#ob-subject-err', e.message || 'Could not add that subject.');
  }
}

// ── Step 3: add a topic to the created subject, show it as a chip ─
export async function obAddTopic() {
  hide($('#ob-topic-err'));
  const input = $('#ob-topic-input');
  const name = input.value.trim();
  if (!name) return;

  const subject = state.onboarding.createdSubject;
  if (!subject) {
    showErr('#ob-topic-err', 'Add a subject first.');
    return;
  }

  try {
    await api('POST', '/api/topics', { subjectId: subject.id, name });
    state.onboarding.addedTopics.push(name);
    input.value = '';
    input.focus();
    renderChips();
  } catch (e) {
    showErr('#ob-topic-err', e.message || 'Could not add that topic.');
  }
}

function renderChips() {
  const wrap = $('#ob-topic-chips');
  if (!wrap) return;
  wrap.innerHTML = state.onboarding.addedTopics
    .map((t) => `<span class="chip">${esc(t)}</span>`)
    .join('');
}

// ── Finish / Skip: mark onboarding complete on the server, move on ─
async function complete(btn, label) {
  await withPending(btn, label, () => api('PUT', '/api/user/onboarding'));
  if (state.currentUser) state.currentUser.onboarding_done = 1;
  resetOnboarding();
  navigate('#dashboard');
}

export function obFinish(btn) {
  return complete(btn, 'Finishing…');
}
export function obSkip(btn) {
  return complete(btn, 'Skipping…');
}
