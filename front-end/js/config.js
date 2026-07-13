
// Configuration & constants.
// Split-origin setup: the API runs on a different origin to this static SPA,
// published host port is 5050 (see docker-compose.yml). Keep this in sync with it.

//established
export const API_BASE = window.NRN_API_BASE || 'http://127.0.0.1:5050'; //door number that the flask is running. || = or, can define  window.NRN_API_BASE for the actual web


const _params = new URLSearchParams(window.location.search)//look at messy text start at ? mark; URLSearchParams= built in tool to turn messy string to easy to use checklist
export const USE_MOCK = _params.has('mock')
  ? /* is teh condition to the left true*/ true // Rule 1: Is '?mock' in the URL? If yes, USE_MOCK = true.No then move below // ? or : used for assign a single value immediately 
  :  /* otherwise*/_params.has('real') // Rule 2: If not, is '?real' in the URL? If yes, USE_MOCK = false!
    ? false
    : typeof window.NRN_USE_MOCK === 'boolean' // Otherwise, did the developer explicitly set a true/false setting in the window settings (NRN_USE_MOCK)?
      ? window.NRN_USE_MOCK
      : !window.NRN_API_BASE; // no real API configured → mock

export const TOKEN_KEY = 'ncea_token'; //label written on the storage locker-> use label key to open the box
