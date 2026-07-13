// Debug tracer — a learning/debugging aid for following the app end-to-end.
//
// OFF by default (zero console noise in normal use). Turn it ON by opening the
// app with ?debug=1 in the URL like e.g.  http://127.0.0.1:5500/?debug=1
// (or set window.NRN_DEBUG = true before the modules load).

// trace(...) is just console.log under the hood where output shows in DevTools →
// Console. To find/remove every trace later:  the codebase for `trace(`.
export const DEBUG =
  new URLSearchParams(window.location.search).has('debug') || window.NRN_DEBUG === true;

export function trace(...args) {
  if (DEBUG) console.log('%c[trace]', 'color:#2563EB;font-weight:700', ...args);
}
//if debug= if normal student then dont print anythibg (trace= professional console log)
//%c[trace]'= apply custom styles to banner
