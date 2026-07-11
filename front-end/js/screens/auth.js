import { $, $$, hide, show, withPending } from '../dom.js'; // Note the ../
import { state } from '../state.js';
import { trace } from '../debug.js';
import { navigate } from '../router.js';
import { api, setToken } from '../api.js'; // Added this so doLogin doesn't crash!

const MIN_PASSWORD_LEN = 6;

// ==========================================
// CORE AUTHENTICATION FUNCTIONS
// ==========================================

// Log tab, clear all fields, hide any leftover error. Called by route().
export function hydrateAuth() {
  trace('auth: hydrateAuth(), reset fields, default to login tab');
    setAuthMode('login');
  ['login-email', 'login-pw', 'signup-name', 'signup-email', 'signup-pw', 'signup-pw2'].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    },
  );
  hide($('#login-err'));
  hide($('#signup-err'));
}

// Switch between the login and signup tabs
export function setAuthMode(mode) {
  trace('auth: setAuthMode →', mode);
  state.authMode = mode;
 $$('.auth-tabs button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
     $('#auth-login').classList.toggle('hidden', mode !== 'login');
  $('#auth-signup').classList.toggle('hidden', mode !== 'signup');
}

// Handle a "Sign in" click.
export async function doLogin(btn) {
  trace('auth: doLogin() start');
  const err = $('#login-err');
  hide(err);

  const email = $('#login-email').value.trim();
  const password = $('#login-pw').value;
  
  if (!email || !password) {
    trace('auth: doLogin VALIDATION FAILED — empty email or password');
       err.textContent = 'You haven\'t entered your email or password.';
    show(err);
    return;
  }
  
  try {
    trace('auth: doLogin → POST /api/auth/login', { email }); 
     const r = await withPending(btn, 'Signing in…', () =>
      api('POST', '/api/auth/login', { email, password }),
    );
    trace('auth: doLogin OK ← user:', r.user, '→ setToken + go #dashboard');
    setToken(r.token); 
    state.currentUser = r.user;
    navigate('#dashboard');
  } catch (e) {
    trace('auth: doLogin FAILED', { status: e.status, message: e.message });
 err.textContent = e.message || 'Your login process failed. Please try again :(';
    show(err);
  }
}

// Handle a "Create account" click. 
export async function doSignup(btn) {
  trace('auth: doSignup() start');
  const err = $('#signup-err');
  hide(err);

  const name = $('#signup-name').value.trim();
  const email = $('#signup-email').value.trim();
  const password = $('#signup-pw').value;
  const password2 = $('#signup-pw2').value;
  const yearLevel = $('#signup-year').value;

  if (!name || !email || !password) {
    trace('auth: doSignup VALIDATION FAILED — missing required field');
    err.textContent = 'You haven\'t filled in all the required fields.';
 show(err);
    return;
  }
  if (password !== password2) {
    trace('auth: doSignup VALIDATION FAILED — passwords do not match');
     err.textContent = "Passwords don't match.";
    show(err);
    return;
  }
  if (password.length < MIN_PASSWORD_LEN) {
    trace('auth: doSignup VALIDATION FAILED — password too short');
    err.textContent = `Your password must be at least ${MIN_PASSWORD_LEN} characters.`;
    show(err);
    return;
  }

  try {
    trace('auth: doSignup → POST /api/auth/signup', { name, email, yearLevel });
    const r = await withPending(btn, 'Creating account…', () =>
      api('POST', '/api/auth/signup', { name, email, yearLevel, password }),
    );
    trace('auth: doSignup OK ← user:', r.user, '→ setToken + go #dashboard');
    setToken(r.token);
     state.currentUser = r.user;
    navigate('#dashboard');
  } catch (e) {
    trace('auth: doSignup FAILED', { status: e.status, message: e.message });
    err.textContent = e.message || 'Your signup process failed. Please try again :(';
    show(err);
  }
}