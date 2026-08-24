
// Configuration & constants.

// Work out where the Flask back-end is.
//
// On a normal computer both servers run on 127.0.0.1, so the back-end is
// simply 127.0.0.1:5050.
//
// In GitHub Codespaces the servers run in the cloud, not on the person's
// laptop, and every port gets its own https address that looks like
// https://<name>-5500.app.github.dev. So 127.0.0.1 would point at their own
// laptop where nothing is running. Instead we take the address of this page
// and swap the front-end port for the back-end port.
function backendUrl() {
  if (window.NRN_API_BASE) return window.NRN_API_BASE; // manual override
  if (location.hostname.endsWith('.app.github.dev')) {
    return location.origin.replace('-5500.', '-5050.');
  }
  return 'http://127.0.0.1:5050';
}

export const API_BASE = backendUrl();

export const TOKEN_KEY = 'ncea_token'; //label written on the storage locker-> use label key to open the box
