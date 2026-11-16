/*
 * Storage layer.
 *  - Always keeps a copy in localStorage (works offline, zero setup).
 *  - If config.firebaseUrl is set, ALSO syncs through the Firebase Realtime
 *    Database REST API so everyone in the same crew code shares one board.
 *
 * Data shape (per crew/group):
 *   { users: { <userKey>: { name, entries: { "<date>_<game>": entry } } } }
 */
(function (root) {
  'use strict';
  const cfg = root.PIXELRANK_CONFIG || {};
  const LS = 'pixelrank.v1';
  const base = (cfg.firebaseUrl || '').trim().replace(/\/+$/, '');

  const slug = (s) =>
    String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);

  function readAll() {
    try { return JSON.parse(localStorage.getItem(LS)) || { groups: {} }; }
    catch (e) { return { groups: {} }; }
  }
  function writeAll(d) {
    try { localStorage.setItem(LS, JSON.stringify(d)); } catch (e) { /* storage full / blocked */ }
  }
  function normalize(g) {
    g = g && typeof g === 'object' ? g : {};
    g.users = g.users && typeof g.users === 'object' ? g.users : {};
    for (const u of Object.values(g.users)) {
      if (!u.entries || typeof u.entries !== 'object') u.entries = {};
    }
    return g;
  }

  async function rest(method, path, body) {
    const res = await fetch(`${base}/${path}.json`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  const Store = {
    remote: !!base,
    slug,

    /** Load a group. Remote first (if configured), local cache as fallback. */
    async load(group) {
      const all = readAll();
      if (base) {
        try {
          const data = normalize(await rest('GET', `groups/${group}`));
          all.groups[group] = data;
          writeAll(all);
          return { db: data, online: true };
        } catch (e) {
          console.warn('Remote load failed, using local cache', e);
          return { db: normalize(all.groups[group]), online: false };
        }
      }
      return { db: normalize(all.groups[group]), online: false };
    },

    saveLocal(group, db) {
      const all = readAll();
      all.groups[group] = db;
      writeAll(all);
    },

    /** Known profiles saved in this browser: [{name, group}] */
    localProfiles() {
      const out = [];
      const all = readAll();
      for (const [g, data] of Object.entries(all.groups)) {
        for (const u of Object.values(normalize(data).users)) out.push({ name: u.name, group: g });
      }
      return out;
    },

    async putUserName(group, userKey, name) {
      if (!base) return true;
      try { await rest('PUT', `groups/${group}/users/${userKey}/name`, name); return true; }
      catch (e) { return false; }
    },
    async putEntry(group, userKey, entryKey, entry) {
      if (!base) return true;
      try { await rest('PUT', `groups/${group}/users/${userKey}/entries/${entryKey}`, entry); return true; }
      catch (e) { return false; }
    },
    async removeEntry(group, userKey, entryKey) {
      if (!base) return true;
      try { await rest('DELETE', `groups/${group}/users/${userKey}/entries/${entryKey}`); return true; }
      catch (e) { return false; }
    },
    async removeUser(group, userKey) {
      if (!base) return true;
      try { await rest('DELETE', `groups/${group}/users/${userKey}`); return true; }
      catch (e) { return false; }
    },
    async replaceUsers(group, users) {
      if (!base) return true;
      try { await rest('PUT', `groups/${group}/users`, users); return true; }
      catch (e) { return false; }
    },
  };

  root.Store = Store;
})(window);
