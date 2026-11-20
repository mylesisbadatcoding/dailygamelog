// Run with: node tests/accounts.test.js
// Exercises js/storage.js against an in-memory fake of Firebase Auth + Realtime Database.
// The fake does NOT enforce firebase-rules.json (except "a uid can only be claimed once"),
// so this checks the client flow, not the security rules.
const assert = require('assert');

const BASE = 'https://fake-rtdb.test';
globalThis.PIXELRANK_CONFIG = { firebaseUrl: BASE + '/', firebaseApiKey: 'KEY', adminUsername: 'myles', allCrew: 'all' };
const mem = {};
globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };

/* ---------- fake backend ---------- */
const accounts = {};   // uid -> { email, password, refresh }
const tokens = {};     // idToken -> uid
let seq = 0;
let tree = {};
const resp = (status, body) => ({ ok: status < 400, status, json: async () => body });
const issue = (uid) => {
  const idToken = 'id' + ++seq;
  tokens[idToken] = uid;
  return { idToken, refreshToken: accounts[uid].refresh, localId: uid, email: accounts[uid].email, expiresIn: '3600' };
};
const seg = (p) => p.split('/').filter(Boolean);
function getAt(path) { let n = tree; for (const s of seg(path)) { if (n == null || typeof n !== 'object') return null; n = n[s]; } return n === undefined ? null : n; }
function setAt(path, v) {
  const parts = seg(path);
  if (!parts.length) { tree = v || {}; return; }
  let n = tree;
  parts.slice(0, -1).forEach((s) => { if (n[s] == null || typeof n[s] !== 'object') n[s] = {}; n = n[s]; });
  if (v === null) delete n[parts[parts.length - 1]]; else n[parts[parts.length - 1]] = v;
}

globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  const body = opts.body && (opts.headers && /json/.test(opts.headers['Content-Type'] || '') ? JSON.parse(opts.body) : opts.body);
  if (u.host === 'identitytoolkit.googleapis.com') {
    const ep = u.pathname.split(':')[1];
    if (ep === 'signUp') {
      if (Object.values(accounts).some((a) => a.email === body.email)) return resp(400, { error: { message: 'EMAIL_EXISTS' } });
      if (body.password.length < 6) return resp(400, { error: { message: 'WEAK_PASSWORD : too short' } });
      const uid = 'uid' + ++seq;
      accounts[uid] = { email: body.email, password: body.password, refresh: 'rt' + uid };
      return resp(200, issue(uid));
    }
    if (ep === 'signInWithPassword') {
      const uid = Object.keys(accounts).find((k) => accounts[k].email === body.email && accounts[k].password === body.password);
      return uid ? resp(200, issue(uid)) : resp(400, { error: { message: 'INVALID_LOGIN_CREDENTIALS' } });
    }
    if (ep === 'update') {
      const uid = tokens[body.idToken];
      if (!uid) return resp(400, { error: { message: 'INVALID_ID_TOKEN' } });
      if (body.email) accounts[uid].email = body.email;
      if (body.password) accounts[uid].password = body.password;
      return resp(200, issue(uid));
    }
    if (ep === 'lookup') return resp(200, { users: [{ email: accounts[tokens[body.idToken]].email }] });
    if (ep === 'delete') { delete accounts[tokens[body.idToken]]; return resp(200, {}); }
    if (ep === 'sendOobCode') return resp(200, { email: body.email });
  }
  if (u.host === 'securetoken.googleapis.com') {
    const rt = new URLSearchParams(opts.body).get('refresh_token');
    const uid = Object.keys(accounts).find((k) => accounts[k].refresh === rt);
    if (!uid) return resp(400, { error: { message: 'INVALID_REFRESH_TOKEN' } });
    const t = issue(uid);
    return resp(200, { id_token: t.idToken, refresh_token: t.refreshToken, user_id: uid, expires_in: '3600' });
  }
  if (u.host === 'fake-rtdb.test') {
    const path = decodeURIComponent(u.pathname).replace(/\.json$/, '');
    const authTok = u.searchParams.get('auth');
    const isPublic = /^\/(usernames|loginEmail)(\/|$)/.test(path) && opts.method === 'GET';
    if (!isPublic && !tokens[authTok]) return resp(401, { error: 'Permission denied' });
    const m = opts.method || 'GET';
    if (m === 'GET') return resp(200, getAt(path));
    const val = opts.body === undefined ? undefined : JSON.parse(opts.body);
    if (m === 'PUT' && /^\/users\/[^/]+\/uid$/.test(path) && getAt(path) != null) return resp(401, { error: 'Permission denied' });
    if (m === 'PUT') setAt(path, val);
    else if (m === 'DELETE') setAt(path, null);
    else if (m === 'PATCH') for (const [k, v] of Object.entries(val)) setAt(path + '/' + k, v);
    return resp(200, val === undefined ? null : val);
  }
  throw new Error('unexpected fetch ' + url);
};

const Store = require('../js/storage.js');

(async () => {
  assert.ok(Store.configured, 'store configured');

  // 1. brand-new accounts; the configured admin username gets admin, others player
  await Store.register({ key: 'myles', name: 'Myles', email: 'myles@x.com', password: 'secret1' });
  assert.strictEqual(tree.users.myles.role, 'admin');
  assert.strictEqual(tree.users.myles.name, 'Myles');
  assert.strictEqual(tree.loginEmail.myles, 'myles@x.com');
  assert.deepStrictEqual(tree.usernames.myles, { name: 'Myles', claimed: true });
  assert.strictEqual(tree.uids[tree.users.myles.uid], 'myles');
  const mylesSession = { ...Store.session };
  Store.signOut();

  await Store.register({ key: 'amy', name: 'Amy', email: 'amy@x.com', password: 'secret2' });
  assert.strictEqual(tree.users.amy.role, 'player');
  Store.signOut();

  // 2. a username can only be claimed once; the loser's auth user is cleaned up
  const before = Object.keys(accounts).length;
  await assert.rejects(Store.register({ key: 'amy', name: 'Amy', email: 'evil@x.com', password: 'secret3' }), { code: 'USERNAME_TAKEN' });
  assert.strictEqual(Object.keys(accounts).length, before, 'orphan auth user removed');

  // 3. legacy data: admin imports groups/<crew>/users/<name>; unclaimed names are listed
  tree.groups = {
    all: { users: { bob: { name: 'Bob', entries: { '2026-11-16_wordle': { game: 'wordle', score: 3, date: '2026-11-16', ts: 1 } } } } },
    work: { users: { bob: { name: 'Bob', entries: { '2026-11-16_wordle': { game: 'wordle', score: 4, date: '2026-11-16', ts: 5 } } }, myles: { name: 'myles', entries: {} } } },
  };
  await Store.signIn('myles@x.com', 'secret1');
  const r = await Store.migrateLegacy();
  assert.strictEqual(r.users, 2);
  assert.strictEqual(tree.users.bob.entries['2026-11-16_wordle'].score, 4, 'newest duplicate wins');
  assert.deepStrictEqual(Object.keys(tree.users.bob.crews).sort(), ['all', 'work']);
  assert.strictEqual(tree.users.myles.role, 'admin', 'migration never touches role');
  assert.ok(tree.users.myles.uid, 'migration never touches uid');
  Store.signOut();
  const names = await Store.listUsernames();
  assert.deepStrictEqual(names.map((n) => [n.key, n.claimed]), [['amy', true], ['bob', false], ['myles', true]]);

  // 4. a legacy user claims their account: scores and crews are kept
  await Store.register({ key: 'bob', name: 'bob', email: 'bob@x.com', password: 'secret4' });
  assert.strictEqual(tree.users.bob.name, 'Bob', 'legacy display name kept');
  assert.strictEqual(tree.users.bob.role, 'player');
  assert.strictEqual(Object.keys(tree.users.bob.entries).length, 1);
  assert.strictEqual(tree.usernames.bob.claimed, true);
  Store.signOut();

  // 5. username login: look up email, sign in, load everyone
  const email = await Store.loginEmail('amy');
  assert.strictEqual(email, 'amy@x.com');
  await assert.rejects(Store.signIn(email, 'wrong'), { code: 'INVALID_LOGIN_CREDENTIALS' });
  await Store.signIn(email, 'secret2');
  const { db, online } = await Store.loadAll();
  assert.ok(online);
  assert.deepStrictEqual(Object.keys(db.users).sort(), ['amy', 'bob', 'myles']);
  assert.strictEqual(db.users.myles.role, 'admin');

  // 6. crews are per user and deletable
  assert.ok(await Store.addCrew('amy', 'friends'));
  assert.strictEqual(tree.users.amy.crews.friends, true);
  assert.ok(await Store.removeCrew('amy', 'friends'));
  assert.strictEqual((tree.users.amy.crews || {}).friends, undefined);

  // 7. entries
  assert.ok(await Store.putEntry('amy', '2026-11-20_wordle', { game: 'wordle', score: 2 }));
  assert.ok(await Store.mergeEntries('amy', { '2026-11-20_nerdle': { game: 'nerdle', score: 4 } }));
  assert.strictEqual(Object.keys(tree.users.amy.entries).length, 2);
  assert.ok(await Store.clearEntries('amy'));
  assert.strictEqual(tree.users.amy.entries, undefined);

  // 8. email + password change needs the current password, then login uses the new ones
  await assert.rejects(Store.updateAccount({ currentPassword: 'nope', password: 'newpass1' }), { code: 'INVALID_LOGIN_CREDENTIALS' });
  await Store.updateAccount({ currentPassword: 'secret2', email: 'amy2@x.com', password: 'newpass1' });
  await Store.setLoginEmail('amy', 'amy2@x.com');
  Store.signOut();
  await Store.signIn(await Store.loginEmail('amy'), 'newpass1');

  // 9. ensureProfile refuses someone who does not own the key
  await assert.rejects(Store.ensureProfile({ key: 'myles', name: 'Myles' }), { code: 'NOT_OWNER' });
  Store.signOut();

  // 10. resume from a saved refresh token
  const resumed = await Store.restore(mylesSession.refreshToken);
  assert.strictEqual(resumed.email, 'myles@x.com');
  assert.strictEqual(resumed.uid, tree.users.myles.uid);
  Store.signOut();

  // 11. offline fallback: loadAll serves the cached copy when the database is unreachable
  await Store.signIn('myles@x.com', 'secret1');
  await Store.loadAll();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('network down'); };
  const off = await Store.loadAll();
  globalThis.fetch = realFetch;
  assert.strictEqual(off.online, false);
  assert.ok(off.db.users.myles, 'cache served');

  console.log('OK - accounts flow (sign-up, claim, login, crews, entries, account edit, legacy import, offline cache)');
})().catch((e) => { console.error(e); process.exit(1); });
