// App entry point — one delegated click listener routes every [data-action]
// button to its handler, plus a few keyboard shortcuts. Modules are deferred,
// so the DOM is already parsed when this runs.

import { clearToken } from './api.js';
import { $, closeModal } from './dom.js';
import { state } from './state.js';
import { navigate, route } from './router.js';
import { doLogin, doSignup, setAuthMode } from './screens/auth.js';
import {
  obNext,
  obSkip,
  obAddSubject,
  obAddTopic,
  obFinish,
} from './screens/onboarding.js';
import { trace } from './debug.js';
import { hydrateIcons } from './icons.js';

// Tell the serve-guard script in index.html that the module app did boot,
// so it doesn't flash the "this page needs to be served" hint on a working app.
window.__NRN_BOOTED = true;

// ── Global click delegation ──────────────────────────────────────
document.body.addEventListener('click', async (e) => {
  // Let an open modal manage its own clicks first.
  const overlay = $('#modal-overlay');
  if (overlay && e.target.closest('#modal-overlay')) {
    if (e.target.closest('[data-action="modal-cancel"]')) closeModal();
    return;
  }

  const act = e.target.closest('[data-action]');
  if (!act) return;

  try {
    switch (act.dataset.action) {
      // Auth
      case 'auth-tab':
        setAuthMode(act.dataset.mode);
        break;
      case 'do-login':
        await doLogin(act);
        break;
      case 'do-signup':
        await doSignup(act);
        break;

      // Onboarding
      case 'ob-next':
        obNext();
        break;
      case 'ob-add-subject':
        await obAddSubject(act);
        break;
      case 'ob-add-topic':
        await obAddTopic();
        break;
      case 'ob-finish':
        await obFinish(act);
        break;
      case 'ob-skip':
        await obSkip(act);
        break;

      // Top bar
      case 'nav-dashboard':
        navigate('#dashboard');
        break;
      case 'do-logout':
        clearToken();
        state.currentUser = null;
        navigate('#');
        break;
    }
  } catch (err) {
    console.error('Action system caught an error:', err);
  }
});

// ── Keyboard shortcuts ───────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const overlay = $('#modal-overlay');
    if (overlay && overlay.classList.contains('show')) closeModal();
    return;
  }

  // Enter submits the auth form when the auth screen is visible.
  if (e.key === 'Enter' && !$('#screen-auth').classList.contains('hidden')) {
    trace('main: Enter submits the', state.authMode, 'form');
    if (state.authMode === 'login') doLogin($('[data-action="do-login"]'));
    else doSignup($('[data-action="do-signup"]'));
    return;
  }

  // Enter adds a topic while typing in the onboarding topic field.
  if (e.key === 'Enter' && document.activeElement?.id === 'ob-topic-input') {
    obAddTopic();
  }
});

// ── Startup ──────────────────────────────────────────────────────
window.addEventListener('hashchange', route);
hydrateIcons();
route();
hydrateIcons(); 


