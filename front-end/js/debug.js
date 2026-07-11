// trace(...) is just console.log under the hood where output shows in DevTools →
export const DEBUG =
  new URLSearchParams(window.location.search).has('debug') || window.NRN_DEBUG === true;

export function trace(...args) {
  if (DEBUG) console.log('%c[trace]', 'color:#2563EB;font-weight:700', ...args);
}
//if debug= if normal student then dont print anythibg (trace= professional console log)