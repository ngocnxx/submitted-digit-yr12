// In-browser mock backend- front-end-only dev (no Flask, no SQLite).

// Enabled by `?mock=1` (see config.js USE_MOCK). 

import { trace } from './debug.js';
import { addDaysISO, buildPriorities, coverageOf, intervalFor, todayISO } from './schedule.js';

const DB_KEY = 'nrn_mock_db';
const MIN_PASSWORD_LEN = 4;
const MAX_NAME_LEN = 80;
const LATENCY_MS = 120; // a little delay so pending/disabled UI states are visible

function load() {
  let db;
  try {
    db = JSON.parse(localStorage.getItem(DB_KEY)) ?? blank();
  } catch {
    db = blank();
  }
  db.reviews = db.reviews || []; // added later, keeps old saved data working
  return db;
}

function blank() {
  return { 
    // Seeded test account so  don't get the "empty room" login error.
    users: [
      {
        id: 1,
        name: "Test Student",
        email: "student@school.com",
        password: "password123",
        yearLevel: 12,
        onboarding_done: 0
      }
    ], 
    subjects: [], 
    topics: [], 
    reviews: [], 
    seq: 1 // set to 1 because ID 1 is occupied by our test student
  };
}

function save(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function nextId(db) {
  db.seq += 1;
  return db.seq;
}

// Throws an error the same way the real server does
function fail(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

function requireStr(value, field, maxLen = MAX_NAME_LEN) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) fail(`Please enter a ${field}.`);
  if (text.length > maxLen) fail(`That ${field} is too long (max ${maxLen} characters).`);
  return text;
}

function userFromToken(db, token) {
  const id = token && token.startsWith('mock.') ? Number(token.slice(5)) : NaN;
  const user = db.users.find((u) => u.id === id);
  if (!user) fail('Authentication required.', 401);
  return user;
}

// Build subject list in the same format as the real server
function subjectsForUser(db, user) {
  return db.subjects
    .filter((s) => s.userId === user.id && !s.archived)
    .map((s) => ({
      ...subjectPublic(s),
      topics: db.topics.filter((t) => t.subjectId === s.id && !t.archived).map(topicPublic),
    }));
}

// Format data to match what the real server sends back
const userPublic = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  yearLevel: u.yearLevel,
  onboarding_done: u.onboarding_done,
  dailyCap: u.dailyCap ?? 5,
});
const subjectPublic = (s) => ({
  id: s.id,
  name: s.name,
  emoji: s.emoji,
  colour: s.colour,
  internalMode: s.internalMode ? 1 : 0,
});
const topicPublic = (t) => ({
  id: t.id,
  subjectId: t.subjectId,
  name: t.name,
  emoji: t.emoji,
  standardNumber: t.standardNumber,
  reviewCount: t.reviewCount,
  nextDue: t.nextDue,
});

// All the mock routes, matched by "METHOD path"
const routes = {
  'POST /api/auth/signup': (db, body) => {
    const name = requireStr(body.name, 'name');
    const email = requireStr(body.email, 'email');
    const password = body.password || '';
    if (password.length < MIN_PASSWORD_LEN)
      fail(`Password must be at least ${MIN_PASSWORD_LEN} characters.`);
    if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase()))
      fail('An account with that email already exists.');
    const yearLevel = Number(body.yearLevel) || 12;
    const user = { id: nextId(db), name, email, password, yearLevel, onboarding_done: 0 };
    db.users.push(user);
    save(db);
    return { token: `mock.${user.id}`, user: userPublic(user) };
  },

  'POST /api/auth/login': (db, body) => {
    const email = (body.email || '').trim();
    const password = body.password || '';
    if (!email || !password) fail('Please enter your email and password.');
    const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user || user.password !== password) fail('Incorrect email or password.', 401);
    return { token: `mock.${user.id}`, user: userPublic(user) };
  },

  'GET /api/auth/me': (db, _body, token) => ({ user: userPublic(userFromToken(db, token)) }),

  'POST /api/auth/logout': () => ({ ok: true }),

  'PUT /api/user/onboarding': (db, _body, token) => {
    const user = userFromToken(db, token);
    user.onboarding_done = 1;
    save(db);
    return { ok: true };
  },

  'POST /api/subjects': (db, body, token) => {
    const user = userFromToken(db, token);
    const name = requireStr(body.name, 'subject name');
    if (db.subjects.some((s) => s.userId === user.id && s.name === name && !s.archived))
      fail(`You already have a subject called “${name}”.`);
    const subject = {
      id: nextId(db),
      userId: user.id,
      name,
      emoji: (body.emoji || '').trim() || null,
      colour: (body.colour || '').trim() || null,
      archived: 0,
    };
    db.subjects.push(subject);
    save(db);
    return { subject: subjectPublic(subject) };
  },

  'GET /api/subjects': (db, _body, token) => {
    const user = userFromToken(db, token);
    const subjects = db.subjects
      .filter((s) => s.userId === user.id && !s.archived)
      .map((s) => ({
        ...subjectPublic(s),
        topics: db.topics
          .filter((t) => t.subjectId === s.id && !t.archived)
          .map((t) => ({
            ...topicPublic(t),
            reviews: db.reviews
              .filter((r) => r.topicId === t.id)
              .map((r) => ({
                reviewedDate: r.reviewedDate,
                confidence: r.confidence,
                evidence: r.evidence,
                reflection: r.reflection,
                nextDue: r.nextDue,
              })),
          })),
      }));
    return { subjects };
  },

  // Today's priority feed, same logic as the real server
  'GET /api/priorities': (db, _body, token) => {
    const user = userFromToken(db, token);
    const subjects = subjectsForUser(db, user);
    const feed = buildPriorities(subjects, user.dailyCap ?? 5);
    const allTopics = subjects.flatMap((s) => s.topics);
    feed.coverage = coverageOf(allTopics);
    feed.reviewedCount = allTopics.filter((t) => (t.reviewCount || 0) >= 1).length;
    feed.totalTopics = allTopics.length;
    return feed;
  },

  'PUT /api/settings': (db, body, token) => {
    const user = userFromToken(db, token);
    const cap = Number(body.dailyCap);
    if (!Number.isFinite(cap)) fail('Daily cap must be a number.');
    user.dailyCap = Math.max(3, Math.min(8, cap)); // clamp, never reject
    save(db);
    return { dailyCap: user.dailyCap };
  },

  'POST /api/assessment-mode-start': (db, body, token) => {
    const user = userFromToken(db, token);
    const subject = db.subjects.find(
      (s) => s.id === body.subjectId && s.userId === user.id && !s.archived,
    );
    if (!subject) fail('That subject could not be found.', 404);
    subject.internalMode = 1; // paused, hidden from the review feed
    save(db);
    return { ok: true };
  },

  'POST /api/assessment-mode-end': (db, body, token) => {
    const user = userFromToken(db, token);
    const subject = db.subjects.find(
      (s) => s.id === body.subjectId && s.userId === user.id && !s.archived,
    );
    if (!subject) fail('That subject could not be found.', 404);
    const today = todayISO();
    const nextDue = addDaysISO(today, 7);
    db.topics
      .filter((t) => t.subjectId === subject.id && !t.archived)
      .forEach((t) => {
        t.reviewCount = Math.max(t.reviewCount || 0, 3); // catch up, never rewind
        t.nextDue = nextDue;
        db.reviews.push({
          id: nextId(db),
          topicId: t.id,
          reviewedDate: today,
          confidence: 'internal_assessment',
          evidence: null,
          reflection: null,
          interval: 7,
          nextDue,
        });
      });
    subject.internalMode = 0;
    save(db);
    return { ok: true };
  },

  'POST /api/topics': (db, body, token) => {
    const user = userFromToken(db, token);
    const name = requireStr(body.name, 'topic name');
    const subject = db.subjects.find(
      (s) => s.id === body.subjectId && s.userId === user.id && !s.archived,
    );
    if (!subject) fail('That subject could not be found.', 404);
    const topic = {
      id: nextId(db),
      subjectId: subject.id,
      name,
      emoji: (body.emoji || '').trim() || null,
      standardNumber: (body.standardNumber || '').trim() || null,
      reviewCount: 0,
      nextDue: null,
      archived: 0,
    };
    db.topics.push(topic);
    save(db);
    return { topic: topicPublic(topic) };
  },

  // Record a review and move the topic's next due date forward
  'POST /api/log-review': (db, body, token) => {
    const user = userFromToken(db, token);
    const topic = db.topics.find((t) => t.id === body.topicId && !t.archived);
    const subject =
      topic && db.subjects.find((s) => s.id === topic.subjectId && s.userId === user.id);
    if (!topic || !subject) fail('That topic could not be found.', 404);

    const count = (topic.reviewCount || 0) + 1;
    const interval = intervalFor(count);
    const reviewedDate = todayISO();
    const nextDue = addDaysISO(reviewedDate, interval);
    topic.reviewCount = count;
    topic.nextDue = nextDue;

    const review = {
      id: nextId(db),
      topicId: topic.id,
      reviewedDate,
      confidence: (body.confidence || '').trim() || null,
      evidence: (body.evidence || '').trim() || null, // accountability field
      reflection: (body.reflection || '').trim() || null, // accountability field
      interval,
      nextDue,
    };
    db.reviews.push(review);
    save(db);
    return { topic: topicPublic(topic), review };
  },
};

// Entry point for mock requests, called from api.js
export async function mockApi(method, path, body, token) {
  await new Promise((r) => setTimeout(r, LATENCY_MS));
  trace(`mock: handling ${method} ${path}`);
  const handler = routes[`${method} ${path}`];
  if (!handler) fail('Not found.', 404);
  return handler(load(), body || {}, token);
}