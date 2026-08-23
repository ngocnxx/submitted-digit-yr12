// Handles all server requests and stores the login token.

import { API_BASE, TOKEN_KEY, USE_MOCK } from './config.js';
import { trace } from './debug.js';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const REQUEST_TIMEOUT_MS = 10000;

// Send a request to the server with the login token
export async function api(method, path, body) {
  trace(`api: ${method} ${path}`, USE_MOCK ? '→ MOCK backend' : '→ REAL backend (fetch)');

  // Use the mock backend (for testing without Flask)
  if (USE_MOCK) {
    const { mockApi } = await import('./api.mock.js');
    try {
      const data = await mockApi(method, path, body, getToken());
      trace(`api: ${method} ${path} ← OK (mock)`);
      return data;
    } catch (e) {
      trace(`api: ${method} ${path} FAILED ${e.status} (mock)`, e.message);
      throw e;
    }
  }

  // Real server request
  const opts = { method, headers: {} };
  const tok = getToken();
  if (tok) opts.headers['Authorization'] = 'Bearer ' + tok;
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  // Stop the request if the server takes too long
  const ac = new AbortController();
  opts.signal = ac.signal;
  const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(API_BASE + path, opts);
  } catch (e) {
    const msg =
      e.name === 'AbortError'
        ? 'The server took too long to respond. Please try again.'
        : "Couldn't reach the server. Check your connection and try again.";
    trace(`api: ${method} ${path} FAILED network/timeout`, e.name);
    const err = new Error(msg);
    err.status = 0; // network/timeout, not an HTTP status
    throw err;
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* an empty body is fine */
  }

  if (!res.ok) {
    trace(`api: ${method} ${path} FAILED ${res.status}`, data && data.error);
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  trace(`api: ${method} ${path} ← ${res.status} OK`);
  return data;
}
