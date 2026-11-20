/*
 * Storage + auth layer (Firebase Authentication + Realtime Database, both via REST).
 *
 * Database shape:
 *   usernames/<key>   { name, claimed }        public list, drives the login screen
 *   loginEmail/<key>  "email"                  readable per key, used to sign in by username
 *   uids/<uid>        "<key>"                  Firebase uid -> username key
 *   users/<key>       { uid, name, role, crews: {code:true}, entries: {"<date>_<game>": entry} }
 *   groups/...        legacy crew > user > entries data (read-only, see migrateLegacy)
 *
 * A crew code is a per-user setting (users/<key>/crews). The crew "all" is virtual:
 * it shows every account. Any other code shows only accounts that saved that code.
 */
(function (root) {
  'use strict';
  const cfg = root.PIXELRANK_CONFIG || {};
  const LS_CACHE = 'pixelrank.v2.cache';
  const base = (cfg.firebaseUrl || '').trim().replace(/\/+$/, '');
  const API_KEY = (cfg.firebaseApiKey || '').trim();
  const ADMIN_KEY = (cfg.adminUsername || 'myles').toLowerCase();
  const ALL = cfg.allCrew || 'all';

  const AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:';
  const TOKEN_URL = 'https://securetoken.googleapis.com/v1/token';

  const slug = (s) =>
    String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);

  let auth = null; // { idToken, refreshToken, uid, email, expiresAt }

  /* ---------- local cache (offline fallback only) ---------- */
  function readCache() {
    try { return JSON.parse(localStorage.getItem(LS_CACHE)) || null; } catch (e) { return null; }
  }
  function writeCache(d) {
    try { localStorage.setItem(LS_CACHE, JSON.stringify(d)); } catch (e) { /* full or blocked */ }
  }
  function normalize(d) {
    const out = { users: {} };
    const src = d && typeof d === 'object' && d.users && typeof d.users === 'object' ? d.users : {};
    for (const [k, u] of Object.entries(src)) {
      if (!u || typeof u !== 'object') continue;
      out.users[k] = {
        uid: u.uid || null,
        name: u.name || k,
        role: u.role === 'admin' ? 'admin' : 'player',
        crews: u.crews && typeof u.crews === 'object' ? u.crews : {},
        entries: u.entries && typeof u.entries === 'object' ? u.entries : {},
      };
    }
    return out;
  }

  /* ---------- Firebase Auth (REST) ---------- */
  function fail(code, msg, extra) {
    return Object.assign(new Error(msg || code), { code }, extra);
  }

  async function authCall(endpoint, body) {
    if (!API_KEY) throw fail('NOT_CONFIGURED', 'firebaseApiKey is not set in js/config.js');
    const res = await fetch(`${AUTH_URL}${endpoint}?key=${encodeURIComponent(API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const raw = (json.error && json.error.message) || 'HTTP ' + res.status;
      throw fail(String(raw).split(/[\s:]/)[0], raw);
    }
    return json;
  }

  function setAuth(r) {
    auth = {
      idToken: r.idToken,
      refreshToken: r.refreshToken,
      uid: r.localId,
      email: r.email || (auth && auth.email) || '',
      expiresAt: Date.now() + (Number(r.expiresIn) || 3600) * 1000,
    };
    return auth;
  }

  async function refreshToken() {
    if (!auth || !auth.refreshToken) throw fail('NO_SESSION', 'Not signed in');
    const res = await fetch(`${TOKEN_URL}?key=${encodeURIComponent(API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(auth.refreshToken),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const raw = (json.error && json.error.message) || 'HTTP ' + res.status;
      throw fail(String(raw).split(/[\s:]/)[0], raw);
    }
    auth = {
      idToken: json.id_token,
      refreshToken: json.refresh_token,
      uid: json.user_id,
      email: auth.email,
      expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
    };
  }

  async function token() {
    if (!auth) throw fail('NO_SESSION', 'Not signed in');
    if (Date.now() > auth.expiresAt - 60000) await refreshToken();
    return auth.idToken;
  }

  /* ---------- Realtime Database (REST) ---------- */
  async function rest(method, path, body, isPublic) {
    const q = isPublic ? '' : '?auth=' + encodeURIComponent(await token());
    const res = await fetch(`${base}/${path}.json${q}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw fail('HTTP_' + res.status, 'HTTP ' + res.status, { status: res.status });
    return res.json();
  }
  const ok = async (p) => { try { await p; return true; } catch (e) { return false; } };

  const Store = {
    slug,
    ALL,
    ADMIN_KEY,
    configured: !!(base && API_KEY),

    /* ----- session ----- */
    get session() { return auth; },
    signOut() { auth = null; },

    async signIn(email, password) {
      return setAuth(await authCall('signInWithPassword', { email, password, returnSecureToken: true }));
    },
    /** Resume from a saved refresh token. Returns the auth object (with email). */
    async restore(refresh) {
      auth = { refreshToken: refresh, email: '', uid: '', idToken: '', expiresAt: 0 };
      try {
        await refreshToken();
        const r = await authCall('lookup', { idToken: auth.idToken });
        auth.email = (r.users && r.users[0] && r.users[0].email) || '';
        return auth;
      } catch (e) { auth = null; throw e; }
    },
    sendReset(email) { return authCall('sendOobCode', { requestType: 'PASSWORD_RESET', email }); },

    /** Verify the current password, then change email and/or password. */
    async updateAccount({ currentPassword, email, password }) {
      const cur = auth && auth.email;
      if (!cur) throw fail('NO_SESSION', 'Not signed in');
      await Store.signIn(cur, currentPassword); // fresh token + proves the password
      const body = { idToken: auth.idToken, returnSecureToken: true };
      if (email) body.email = email;
      if (password) body.password = password;
      setAuth(await authCall('update', body));
      return auth;
    },

    /* ----- public login data ----- */
    async listUsernames() {
      const d = (await rest('GET', 'usernames', undefined, true)) || {};
      return Object.entries(d)
        .filter(([, v]) => v && typeof v === 'object')
        .map(([key, v]) => ({ key, name: v.name || key, claimed: !!v.claimed }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async loginEmail(key) {
      const e = await rest('GET', `loginEmail/${key}`, undefined, true);
      return typeof e === 'string' ? e : null;
    },

    /* ----- accounts ----- */
    /**
     * Create a Firebase account and claim a username key. Works for brand-new
     * usernames and for legacy ones (users/<key> exists but has no uid yet).
     */
    async register({ key, name, email, password }) {
      await Store.signUpRaw(email, password);
      try {
        await rest('PUT', `users/${key}/uid`, auth.uid); // the claim; rules reject it if taken
      } catch (e) {
        try { await authCall('delete', { idToken: auth.idToken }); } catch (e2) { /* orphan is harmless */ }
        auth = null;
        throw fail('USERNAME_TAKEN', 'That username is already claimed');
      }
      await Store.ensureProfile({ key, name, email });
      return auth;
    },
    async signUpRaw(email, password) {
      return setAuth(await authCall('signUp', { email, password, returnSecureToken: true }));
    },

    /** Idempotent: makes sure every lookup record for the signed-in user exists. */
    async ensureProfile({ key, name, email }) {
      const u = (await rest('GET', `users/${key}`)) || {};
      if (u.uid !== auth.uid) throw fail('NOT_OWNER', 'This login does not own that username');
      const finalName = u.name || name || key;
      if (!u.name) await rest('PUT', `users/${key}/name`, finalName);
      if (!u.role) await rest('PUT', `users/${key}/role`, key === ADMIN_KEY ? 'admin' : 'player');
      const mapped = await rest('GET', `uids/${auth.uid}`);
      if (mapped !== key) await rest('PUT', `uids/${auth.uid}`, key);
      const un = await rest('GET', `usernames/${key}`, undefined, true);
      if (!un || !un.claimed || un.name !== finalName) await rest('PUT', `usernames/${key}`, { name: finalName, claimed: true });
      const em = email || auth.email;
      if (em && (await rest('GET', `loginEmail/${key}`, undefined, true)) !== em) await rest('PUT', `loginEmail/${key}`, em);
      return { name: finalName, role: u.role || (key === ADMIN_KEY ? 'admin' : 'player') };
    },

    async setLoginEmail(key, email) { return rest('PUT', `loginEmail/${key}`, email); },

    /* ----- data ----- */
    /** Load all accounts. Remote first, cached copy as fallback. */
    async loadAll() {
      try {
        const db = normalize({ users: await rest('GET', 'users') });
        writeCache(db);
        return { db, online: true };
      } catch (e) {
        console.warn('Remote load failed, using local cache', e);
        return { db: normalize(readCache()), online: false };
      }
    },
    saveLocal(db) { writeCache(db); },

    putEntry: (key, ek, entry) => ok(rest('PUT', `users/${key}/entries/${ek}`, entry)),
    removeEntry: (key, ek) => ok(rest('DELETE', `users/${key}/entries/${ek}`)),
    clearEntries: (key) => ok(rest('DELETE', `users/${key}/entries`)),
    mergeEntries: (key, entries) => ok(rest('PATCH', `users/${key}/entries`, entries)),
    addCrew: (key, code) => ok(rest('PUT', `users/${key}/crews/${code}`, true)),
    removeCrew: (key, code) => ok(rest('DELETE', `users/${key}/crews/${code}`)),
    setRole: (key, role) => ok(rest('PUT', `users/${key}/role`, role)),

    /**
     * Admin only. Copies legacy groups/<crew>/users/<name>/entries into users/<key>,
     * records each legacy crew as a crew code on that user, and lists the name on the
     * login screen as unclaimed. Existing uid/role are never touched.
     */
    async migrateLegacy() {
      const groups = (await rest('GET', 'groups')) || {};
      const merged = {};
      for (const [g, grp] of Object.entries(groups)) {
        const code = slug(g);
        for (const [uk, u] of Object.entries((grp && grp.users) || {})) {
          const key = slug(uk);
          if (!key || !u) continue;
          const m = (merged[key] = merged[key] || { name: u.name || uk, entries: {}, crews: {} });
          if (code) m.crews[code] = true;
          for (const [ek, e] of Object.entries(u.entries || {})) {
            if (!m.entries[ek] || (e.ts || 0) > (m.entries[ek].ts || 0)) m.entries[ek] = e;
          }
        }
      }
      let users = 0, entries = 0;
      for (const [key, m] of Object.entries(merged)) {
        const cur = (await rest('GET', `users/${key}`)) || {};
        const mergedEntries = Object.assign({}, m.entries);
        for (const [ek, e] of Object.entries(cur.entries || {})) {
          if (!mergedEntries[ek] || (e.ts || 0) >= (mergedEntries[ek].ts || 0)) mergedEntries[ek] = e;
        }
        const patch = { entries: mergedEntries, crews: Object.assign({}, m.crews, cur.crews || {}) };
        if (!cur.name) patch.name = m.name;
        await rest('PATCH', `users/${key}`, patch);
        const un = await rest('GET', `usernames/${key}`, undefined, true);
        if (!un) await rest('PUT', `usernames/${key}`, { name: cur.name || m.name, claimed: !!cur.uid });
        users++;
        entries += Object.keys(mergedEntries).length;
      }
      return { users, entries };
    },
  };

  root.Store = Store;
  if (typeof module === 'object' && module.exports) module.exports = Store;
})(typeof window !== 'undefined' ? window : globalThis);
