// Log Review modal — the accountability heart of the app.
//
// Opened from the priorities feed (dashboard) and the subject-detail screen.
// Collects: confidence (recorded, never changes the schedule — per the spec),
// Evidence of Learning, and Reflection. On submit it calls POST /api/log-review
// then runs the caller's onDone() so the screen behind it refreshes.

import { api } from '../api.js';
import { $, closeModal, esc, openModalFromHTML, toast, withPending } from '../dom.js';
import { icon } from '../icons.js';
import { trace } from '../debug.js';

// Confidence options — encouraging, non-judgemental language (per the tone rules).
const CONFIDENCE = [
  { key: 'shaky', label: 'Need more time' },
  { key: 'okay', label: 'Getting there' },
  { key: 'solid', label: 'Pretty well' },
];

let pending = null; // { topicId, onDone } for the currently-open modal

export function openLogReview(topic, onDone) {
  trace('log-review: open modal', { topicId: topic.id, name: topic.name });
  pending = { topicId: topic.id, onDone };
  openModalFromHTML(`
    <div class="modal-card">
      <h2>Log a review</h2>
      <p class="modal-sub">${icon('circle-check-big', { size: 16 })} ${esc(topic.name)}</p>

      <div class="field">
        <label>How well did it go?</label>
        <div class="confidence-row" id="lr-confidence">
          ${CONFIDENCE.map(
            (c, i) =>
              `<button type="button" class="conf-pill${i === 1 ? ' active' : ''}" data-conf="${c.key}">${esc(c.label)}</button>`,
          ).join('')}
        </div>
      </div>

      <div class="field">
        <label for="lr-evidence">Evidence of Learning</label>
        <textarea class="input" id="lr-evidence" rows="3" placeholder="You can paste a key formula, list main points you revised, or describe what you did (notes, questions answered, etc.) or attach a Google Docs link"></textarea>
        <div class="lr-attach">
          <button type="button" class="btn btn-ghost btn-sm" data-action="lr-attach">${icon('plus', { size: 14 })} Attach file / photo</button>
          <span id="lr-attach-name" class="muted small"></span>
          <input type="file" id="lr-file" class="hidden" accept="image/*,.pdf,.doc,.docx">
        </div>
      </div>

      <div class="field">
        <label for="lr-reflection">Reflection</label>
        <textarea class="input" id="lr-reflection" rows="3" placeholder="You can write: One thing you understood better / One question you still have / What areas do you need to improve?"></textarea>
      </div>

      <p class="modal-note">These are just optional but they helps build real understanding and long-term retention to support your learning</p>

      <div class="modal-actions">
        <button class="btn btn-ghost" data-action="modal-cancel">Cancel</button>
        <button class="btn btn-primary" data-action="lr-submit">Log review</button>
      </div>
    </div>
  `);

  // Confidence pills: a small local listener (this markup only lives while open).
  const row = $('#lr-confidence');
  row.addEventListener('click', (e) => {
    const b = e.target.closest('[data-conf]');
    if (!b) return;
    row.querySelectorAll('.conf-pill').forEach((p) => p.classList.remove('active'));
    b.classList.add('active');
    trace('log-review: confidence →', b.dataset.conf);
  });
}

// Front-end-only file attach: shows the chosen filename (no upload backend yet).
export function attachFile() {
  const input = $('#lr-file');
  input.onchange = () => {
    const f = input.files && input.files[0];
    $('#lr-attach-name').textContent = f ? `Attached: ${f.name}` : '';
    trace('log-review: file attached', f && f.name);
  };
  input.click();
}

export async function submitLogReview(btn) {
  if (!pending) return;
  const confidence = $('#lr-confidence .conf-pill.active')?.dataset.conf || 'okay';
  const evidence = $('#lr-evidence').value.trim();
  const reflection = $('#lr-reflection').value.trim();
  trace('log-review: submit → POST /api/log-review', {
    topicId: pending.topicId,
    confidence,
    hasEvidence: !!evidence,
    hasReflection: !!reflection,
  });
  try {
    await withPending(btn, 'Saving…', () =>
      api('POST', '/api/log-review', {
        topicId: pending.topicId,
        confidence,
        evidence,
        reflection,
      }),
    );
    const done = pending.onDone;
    pending = null;
    closeModal();
    toast('Review logged — nice work!');
    if (done) await done(); // refresh the screen behind the modal
  } catch (e) {
    trace('log-review: submit FAILED', e.message);
    toast(e.message || 'Could not log review');
  }
}
