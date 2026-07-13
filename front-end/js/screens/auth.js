// Auth screen (#screen-auth) — login + create-account forms.

// Responsibilities: read the form inputs, run  client-side validation, call
// the auth API (mock or Flask via api()), and on success store the JWT and route
// to the dashboard. Every failure surfaces as a friendly message in the screen's
// `.error-msg` slot  never a blank screen or a raw error.
//
// DEBUG: this file is traced end-to-end. Open the app with ?debug=1 and watch the
// Console to follow each step. trace(...) is console.log gated by that flag.

import { api, setToken } from '../api.js';
import { $, $$, hide, show, withPending } from '../dom.js';
import { state } from '../state.js';
import { trace } from '../debug.js';
import { navigate } from '../router.js';

// Mirrors the backend's minimum; the server re-checks, this is just fast feedback.
const MIN_PASSWORD_LEN = 4;

// Reset the screen to a clean slate every time it is (re)entered: default to the
// login tab, clear all fields, hide any leftover error. Called by route().
export function hydrateAuth() {
  trace('auth: hydrateAuth() — reset fields, default to login tab');
  setAuthMode('login');
  ['login-email', 'login-pw', 'signup-name', 'signup-email', 'signup-pw', 'signup-pw2'].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) {
        el.value = '';
        el.classList.remove('input-error'); // drop any leftover error highlight
      }
    },
  );
  hide($('#login-err'));
  hide($('#signup-err'));
}

// Switch between the login and signup tabs: highlight the active tab and reveal
// the matching form (the other is hidden). Records the mode so the Enter-key
// shortcut in main.js knows which form to submit.
export function setAuthMode(mode) {
  trace('auth: setAuthMode →', mode);
  state.authMode = mode;
  $$('.auth-tabs button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  $('#auth-login').classList.toggle('hidden', mode !== 'login');
  $('#auth-signup').classList.toggle('hidden', mode !== 'signup');
}

// Handle a "Sign in" click. `btn` is the clicked button so withPending() can
// disable it and show a pending label for the duration of the request (which both
// gives feedback and prevents a double-submit).
export async function doLogin(btn) {
  trace('auth: doLogin() start');
  const err = $('#login-err');
  hide(err);

  // Layer 1 — client-side guard: avoid a pointless round-trip on empty input.
  const email = $('#login-email').value.trim();
  const password = $('#login-pw').value;
  if (!email || !password) {
    trace('auth: doLogin VALIDATION FAILED — empty email or password');
    err.textContent = 'You havent enter your gmail or password.';
    show(err);
    return;
  }

  // Tip: an alert() is a quick "freeze and look" probe, but it BLOCKS the page —
  // never leave one in shipped code. Uncomment to try it once, then remove:
  //   alert('about to call the login API for ' + email);

  try {
    // Layer 2 — the backend authenticates. On success it returns { token, user }.
    trace('auth: doLogin → POST /api/auth/login', { email }); // never log the password
    const r = await withPending(btn, 'Signing in…', () =>
      api('POST', '/api/auth/login', { email, password }),
    );
    trace('auth: doLogin OK ← user:', r.user, '→ setToken + go #dashboard');
    setToken(r.token); // persist the JWT (localStorage: ncea_token)
    state.currentUser = r.user;
    navigate('#dashboard');
  } catch (e) {
    // 401 (bad credentials), 400, or a network/timeout error — all friendly here.
    trace('auth: doLogin FAILED', { status: e.status, message: e.message });
    err.textContent = e.message || 'Your login process failed. Please try again:(';
    show(err);
  }
}

// Handle a "Create account" click. Runs three client-side guards (required fields,
// passwords match, min length) BEFORE the network call; the backend still
// re-validates everything and owns duplicate-email detection (→ 400).
export async function doSignup(btn) {
  trace('auth: doSignup() start');
  const err = $('#signup-err');
  hide(err);

  // Grab the two password fields as ELEMENTS (not just their values) so we can
  // toggle the red `.input-error` highlight on them. Clear any highlight left
  // over from a previous attempt before we re-validate.
  const pw = $('#signup-pw');
  const pw2 = $('#signup-pw2');
  pw.classList.remove('input-error');
  pw2.classList.remove('input-error');

  const name = $('#signup-name').value.trim();
  const email = $('#signup-email').value.trim();
  const password = pw.value;
  const password2 = pw2.value;
  const yearLevel = $('#signup-year').value;

  if (!name || !email || !password) {
    trace('auth: doSignup VALIDATION FAILED — missing required field');
    err.textContent = 'You havent fill in all the required field';
    show(err);
    return;
  }
  if (password !== password2) {
    trace('auth: doSignup VALIDATION FAILED — passwords do not match');
    err.textContent = "Passwords don't match.";
    // Red-border BOTH password fields so the user sees exactly where to fix.
    pw.classList.add('input-error');
    pw2.classList.add('input-error');
    show(err);
    return;
  }
  if (password.length < MIN_PASSWORD_LEN) {
    trace('auth: doSignup VALIDATION FAILED — password too short');
    err.textContent = `Your password must be at least ${MIN_PASSWORD_LEN} characters.`;
    pw.classList.add('input-error'); // highlight the offending field directly
    show(err);
    return;
  }

  try {
    // New accounts come back with onboarding_done = 0, so route() will send the
    // user to onboarding (not the dashboard) on the next pass.
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
    err.textContent = e.message || 'Your signup process failed. Please try again:(';
    show(err);
  }
}
