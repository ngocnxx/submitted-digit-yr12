// Log review modal. Opened from the dashboard or subject detail screen.
// Collects confidence, evidence of learning, and reflection notes.

import { api } from '../api.js';
import { $, closeModal, esc, openModalFromHTML, toast, withPending } from '../dom.js';
import { icon } from '../icons.js';
import { trace } from '../debug.js';

// Confidence choices with friendly labels
const CONFIDENCE = [
  { key: 'shaky', label: 'Need more time' },
  { key: 'okay', label: 'Getting there' },
  { key: 'solid', label: 'Pretty well' },
];

let pending = null; // stores the topic being reviewed right now

export function openLogReview(topic, onDone) {
  trace('log-review: open modal', { topicId: topic.id, name: topic.name });
  pending = { topicId: topic.id, topicName: topic.name, onDone };
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

  // Listen for confidence pill clicks
  const row = $('#lr-confidence');
  row.addEventListener('click', (e) => {
    const b = e.target.closest('[data-conf]');
    if (!b) return;
    row.querySelectorAll('.conf-pill').forEach((p) => p.classList.remove('active'));
    b.classList.add('active');
    trace('log-review: confidence →', b.dataset.conf);
  });
}

// Show the name of the attached file
export function attachFile() {
  const input = $('#lr-file');
  input.onchange = () => {
    const f = input.files && input.files[0];
    $('#lr-attach-name').textContent = f ? `Attached: ${f.name}` : '';
    trace('log-review: file attached', f && f.name);
  };
  input.click();
}

// How long to show the "Log saved!" message before closing
const SUCCESS_HOLD_MS = 1100;

// Show "Log saved!" inside the modal
function showSavedState(topicName) {
  const card = $('#modal-overlay .modal-card');
  if (!card) return;
  card.innerHTML = `
    <div class="lr-success" role="status" aria-live="polite">
      <span class="lr-success-tick">${icon('circle-check-big', { size: 46 })}</span>
      <h2>Log saved!</h2>
      <p class="lr-success-sub">
        ${topicName ? `${esc(topicName)} is recorded` : 'Your review is recorded'} and your next
        review is now scheduled.
      </p>
    </div>`;
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
    // Server confirmed the review was saved
    trace('log-review: saved OK → showing confirmation');
    const done = pending.onDone;
    const topicName = pending.topicName;
    pending = null;

    showSavedState(topicName); // 1. tick + "Log saved!" in the modal
    await new Promise((r) => setTimeout(r, SUCCESS_HOLD_MS));
    closeModal();
    toast('Review logged- nice work!', 'success'); // 2. green toast as it closes
    if (done) await done(); // 3. refresh the screen behind the modal
  } catch (e) {
    trace('log-review: submit FAILED', e.message);
    toast(e.message || 'Could not log review');
  }
}
