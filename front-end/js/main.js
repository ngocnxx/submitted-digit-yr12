
// Composition root that imports every screen handler,  one delegated click listener + keyboard shortcuts, and starts the router. This is the only script  the HTML loads (`<script type="module" src="js/main.js">`).
//import all these things from these files so i can use them
import { api, clearToken } from './api.js';
import { $, closeModal, toast } from './dom.js';
import { state } from './state.js';
import { navigate, route } from './router.js';
import { doLogin, doSignup, setAuthMode } from './screens/auth.js';
import {
  obAddSubject,
  obAddTopic,
  obFinish,
  obNext,
  obSkip,
} from './screens/onboarding.js';
import { trace } from './debug.js'; // debug tracer (on with ?debug=1)
import { hydrateIcons } from './icons.js';
import { setDashTab } from './screens/dashboard.js';
import { attachFile, openLogReview, submitLogReview } from './screens/log-review.js';
import { openAddSubject, openAddTopic, submitAddSubject, submitAddTopic } from './screens/add.js';
// Signal that the ES-module graph loaded and ran.
window.__NRN_BOOTED = true;

//  Global click delegation 
//hey browser, stad guard at top page-> run this everytime users click on screen.
document.body.addEventListener('click', async (e) => {
  // Let an open modal manage its own clicks first.
  if (e.target.closest('#modal-overlay')) {
    // Backdrop-click close is handled in dom.js. Here we only special-case Cancel,
    // then let real modal buttons (lr-submit, lr-attach) fall through to dispatch.
    if (e.target.closest('[data-action="modal-cancel"]')) {
      closeModal();
      return;
    }
  }

  const act = e.target.closest('[data-action]');
  if (!act) return;

  // STEP 1 of the flow: a click on a [data-action] element is dispatched here.
  trace('main: click →', act.dataset.action + (act.dataset.mode ? ` (mode=${act.dataset.mode})` : ''));


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
        obAddTopic();
        break;
      case 'ob-finish':
        await obFinish(act);
        break;
      case 'ob-skip':
        await obSkip();
        break;

      // Dashboard tabs / log review
      case 'dash-tab':
        setDashTab(act.dataset.tab);
        break;
      case 'open-log': {
        // Look the topic up fresh, then open the modal; refresh the screen on save.
        const tid = Number(act.dataset.topicId);
        const { subjects } = await api('GET', '/api/subjects');
        const topic = subjects.flatMap((s) => s.topics).find((t) => t.id === tid);
        if (topic) openLogReview(topic, route);
        break;
      }
      case 'lr-submit':
        await submitLogReview(act);
        break;
      case 'lr-attach':
        attachFile();
        break;
     
      // Add subject / add topic (modals, refresh the screen on success)
      case 'add-subject':
        openAddSubject(route);
        break;
      case 'add-subject-submit':
        await submitAddSubject(act);
        break;
      case 'add-topic':
        openAddTopic(act.dataset.subjectId, act.dataset.subjectName, route);
        break;
      case 'add-topic-submit':
        await submitAddTopic(act);
        break;

      // Navigation
      case 'nav-dashboard':
        navigate('#dashboard');
        break;
      case 'do-logout':
        try {
          await api('POST', '/api/auth/logout');
        } catch {
          // logging out is best-effort //
        }
        clearToken();
        state.currentUser = null;
        navigate('#');
        route();
        break;
    }
  } catch (err) {
    toast(err.message || 'Something went wrong');
  }
});


// Keyboard shortcuts 
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if ($('#modal-overlay').classList.contains('show')) closeModal();
    return;
  }
  // Enter submits the auth form.
  if (e.key === 'Enter' && !$('#screen-auth').classList.contains('hidden')) {
    trace('main: Enter key submits the', state.authMode, 'form');
    if (state.authMode === 'login') doLogin($('[data-action="do-login"]'));
    else doSignup($('[data-action="do-signup"]'));
  }
  // Enter adds a topic in onboarding step 3.
  if (e.key === 'Enter' && document.activeElement?.id === 'ob-topic-input') {
    obAddTopic();
  }
});
//Startup 
window.addEventListener('hashchange', route);
route(); // modules are deferred, so the DOM is already parsed here.
hydrateIcons(); // replace every static [data-icon] element with its Lucide SVG
