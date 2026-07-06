// 1. Import the worker functions from the auth file
import { setAuthMode, doLogin, doSignup } from './screens/auth.js';
// Global click delegation
document.body.addEventListener('click', async (e) => {
  
  // Let an open modal manage its own clicks first
  if (e.target.closest('#modal-overlay')) {
    if (e.target.closest('[data-action="modal-cancel"]')) {
      if (typeof closeModal === 'function') closeModal();
      return;
    }
  }

  // Look for elements with data-action
  const act = e.target.closest('[data-action]');
  if (!act) return;

  try {
    // Route the action to the functions we imported above!
    switch (act.dataset.action) {
      case 'auth-tab':
        setAuthMode(act.dataset.mode);
        break;
      case 'do-login':
        await doLogin(act);
        break;
      case 'do-signup':
        await doSignup(act);
        break;
    }
  } catch (err) {
    console.error("Action system caught an error:", err);
  }
});