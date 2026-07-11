import { $, hide, show } from './dom.js';
import { state } from './state.js';
import { trace } from './debug.js'; 
import { hydrateAuth } from './screens/auth.js'; // Goes into sub-folder
import { hydrateOnboarding } from './screens/onboarding.js';
import { api, getToken, clearToken } from './api.js';

const SCREENS = [
  'screen-auth',
  'screen-onboarding',
  'screen-dashboard'
];

export function showScreen(id) {
  SCREENS.forEach((s) => {
    const el = document.getElementById(s);
    if (el) el.classList.toggle('hidden', s !== id);
  });
}

export function navigate(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

export async function route() {
  // The router decides which screen to show. Trace its inputs every time it runs.
  trace('router: route()', { hash: location.hash || '#', hasToken: !!getToken() });

  // No token → not logged in → show auth.
  if (!getToken()) {
    trace('router: no token → showing AUTH screen');
    state.currentUser = null;
    hide($('#topbar'));
    showScreen('screen-auth');
    hydrateAuth();
    return;
  }

  // Have a token but no user object yet → fetch it (token may be expired).
  if (!state.currentUser) {
    try {
      state.currentUser = (await api('GET', '/api/auth/me')).user;
    } catch {
      clearToken();
      return route();
    }
  }

  //  FIXED: The code is now safely nested inside the route() function!
  // Logged in but onboarding not finished → onboarding flow.
  if (!state.currentUser.onboarding_done) {
    trace('router: logged in, onboarding not done → ONBOARDING screen');
    hide($('#topbar'));
    showScreen('screen-onboarding');
    hydrateOnboarding();
    return;
  }

  trace('router: logged in + onboarded → DASHBOARD');
  showScreen('screen-dashboard');
} //  The function cleanly ends here now.