/* rank2.day - app logic (no build step, no dependencies) */
(function () {
  'use strict';

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const cfg = window.PIXELRANK_CONFIG || {};
  const POINTS = cfg.points || [3, 2, 1];
  const SESSION = 'pixelrank.session2';   // { key, refresh }
  const CREW_KEY = 'pixelrank.crew.';     // + user key -> active crew code on this device
  const ALL = Store.ALL;
  const MEDALS = ['🥇', '🥈', '🥉'];
  const PALETTE = ['#c8665e', '#6fa583', '#6a8fc4', '#cdb765', '#9a82b8', '#cf9a5a', '#6fa9ad', '#a39e92'];

  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); };
  const today = () => fmtDate(new Date());
  const prettyDate = (s) =>
    parseDate(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const state = {
    user: null,           // { name, key, uid, email, role }
    crew: ALL,            // active crew filter ('all' shows everyone)
    db: { users: {} },
    online: false,
    date: today(),
    tab: 'today',
    parsed: [],
  };

  /* ---------- data helpers ---------- */
  const meta = (id, e) => Games.meta(id, e);

  /** negative if a is better than b */
  function cmp(a, b) {
    const higher = meta(a.game, a).higher;
    const d = higher ? b.score - a.score : a.score - b.score;
    if (d) return d;
    return (a.tie || 0) - (b.tie || 0);
  }

  const isAdmin = () => !!(state.user && state.user.role === 'admin');

  /** Accounts the active crew code lets you see ('all' = everyone). */
  function visibleUsers() {
    if (state.crew === ALL) return state.db.users;
    const out = {};
    for (const [uk, u] of Object.entries(state.db.users)) {
      if ((u.crews && u.crews[state.crew]) || (state.user && uk === state.user.key)) out[uk] = u;
    }
    return out;
  }
  const myCrews = () => {
    const me = state.db.users[state.user.key];
    return Object.keys((me && me.crews) || {}).sort();
  };

  function allEntries() {
    const out = [];
    for (const [uk, u] of Object.entries(visibleUsers())) {
      for (const [ek, e] of Object.entries(u.entries || {})) out.push(Object.assign({ uk, ek, name: u.name || uk }, e));
    }
    return out;
  }

  function colorFor(uk) {
    const keys = Object.keys(state.db.users).sort();
    const i = Math.max(0, keys.indexOf(uk));
    return PALETTE[i % PALETTE.length];
  }
  const dot = (uk) => `<span class="dot" style="background:${colorFor(uk)}"></span>`;

  /** Per-day results: ranks, points, medals */
  function computeDay(date) {
    const byGame = {};
    for (const [uk, u] of Object.entries(visibleUsers())) {
      for (const [ek, e] of Object.entries(u.entries || {})) {
        if (e.date === date) (byGame[e.game] = byGame[e.game] || []).push({ uk, ek, name: u.name || uk, e });
      }
    }
    const totals = {};
    const bump = (uk, name) =>
      (totals[uk] = totals[uk] || { uk, name, pts: 0, gold: 0, silver: 0, bronze: 0, played: 0 });

    for (const list of Object.values(byGame)) {
      list.sort((a, b) => cmp(a.e, b.e));
      list.forEach((r, i) => { r.rank = i > 0 && cmp(list[i - 1].e, r.e) === 0 ? list[i - 1].rank : i + 1; });
      const contested = list.length >= 2;
      for (const r of list) {
        const t = bump(r.uk, r.name);
        t.played++;
        r.pts = 0;
        if (contested) {
          r.pts = POINTS[r.rank - 1] || 0;
          t.pts += r.pts;
          if (r.rank === 1) t.gold++;
          else if (r.rank === 2) t.silver++;
          else if (r.rank === 3) t.bronze++;
        }
      }
    }
    return { byGame, totals: sortTotals(Object.values(totals)) };
  }

  function sortTotals(arr) {
    arr.sort((a, b) => b.pts - a.pts || b.gold - a.gold || b.silver - a.silver || b.played - a.played || a.name.localeCompare(b.name));
    arr.forEach((t, i) => {
      t.rank = i > 0 && arr[i - 1].pts === t.pts && arr[i - 1].gold === t.gold ? arr[i - 1].rank : i + 1;
    });
    return arr;
  }

  /** All-time aggregate + cumulative series for the chart */
  function timeline() {
    const dates = [...new Set(allEntries().map((e) => e.date))].sort();
    const acc = {};
    const series = {};
    const days = [];
    for (const uk of Object.keys(visibleUsers())) {
      acc[uk] = { uk, name: state.db.users[uk].name || uk, pts: 0, gold: 0, silver: 0, bronze: 0, played: 0, days: 0 };
      series[uk] = [];
    }
    for (const d of dates) {
      const day = computeDay(d);
      days.push({ date: d, day });
      for (const t of day.totals) {
        const a = acc[t.uk];
        a.pts += t.pts; a.gold += t.gold; a.silver += t.silver; a.bronze += t.bronze; a.played += t.played; a.days++;
      }
      for (const uk of Object.keys(acc)) series[uk].push(acc[uk].pts);
    }
    return { dates, days, series, totals: sortTotals(Object.values(acc).filter((a) => a.played > 0)) };
  }

  function streakFor(uk) {
    const set = new Set(Object.values((state.db.users[uk] || {}).entries || {}).map((e) => e.date));
    let d = today();
    if (!set.has(d)) d = addDays(d, -1);
    let n = 0;
    while (set.has(d)) { n++; d = addDays(d, -1); }
    return n;
  }

  /* ---------- UI: toast ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------- errors ---------- */
  const ERRORS = {
    EMAIL_EXISTS: 'That email already has an account.',
    INVALID_EMAIL: 'That email address does not look right.',
    WEAK_PASSWORD: 'Password must be at least 6 characters.',
    INVALID_LOGIN_CREDENTIALS: 'Wrong username or password.',
    INVALID_PASSWORD: 'Wrong username or password.',
    EMAIL_NOT_FOUND: 'No account for that email.',
    USER_DISABLED: 'This account is disabled.',
    TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Wait a bit and try again.',
    OPERATION_NOT_ALLOWED: 'Email/password sign-in is not enabled (or email change needs verification) in Firebase.',
    CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'Please log in again, then retry.',
    USERNAME_TAKEN: 'That username is already claimed by someone else.',
    NOT_OWNER: 'This login does not own that username.',
    NOT_CONFIGURED: 'Setup needed: add firebaseApiKey to js/config.js.',
    API_KEY_INVALID: 'Setup needed: firebaseApiKey in js/config.js is invalid.',
    HTTP_401: 'Permission denied by the database rules.',
    HTTP_403: 'Permission denied by the database rules.',
  };
  const errText = (e) => ERRORS[e && e.code] || ((e && e.message) || 'Something went wrong.');

  /* ---------- login ---------- */
  const login = { mode: 'login', names: [] };   // mode: 'login' | 'signup' | 'claim'

  function setMode(mode, note) {
    login.mode = mode;
    const signup = mode !== 'login';
    $('#signup-fields').hidden = !signup;
    $('#signup-fields2').hidden = !signup;
    $('#in-email').required = signup;
    $('#in-pass2').required = signup;
    $('#in-pass').autocomplete = signup ? 'new-password' : 'current-password';
    $('#login-submit').textContent = mode === 'claim' ? 'SET UP ACCOUNT ▶' : signup ? 'CREATE ACCOUNT ▶' : 'LOG IN ▶';
    $('#login-toggle').textContent = signup ? 'BACK TO LOG IN' : 'CREATE ACCOUNT';
    $('#login-forgot').hidden = signup;
    const n = $('#login-note');
    n.hidden = !note;
    n.textContent = note || '';
    $('#login-err').textContent = '';
  }

  /** Match the typed username against the public list and pick the right form. */
  function syncModeToName() {
    const key = Store.slug($('#in-name').value);
    const hit = login.names.find((n) => n.key === key);
    if (hit && !hit.claimed) {
      if (login.mode !== 'claim') setMode('claim', 'Your account needs an email and a password. Set them up to continue.');
    } else if (hit && login.mode !== 'login') {
      setMode('login');
    } else if (!hit && login.mode === 'claim') {
      setMode('login');
    }
  }

  const CLOUD_COLORS = PALETTE;
  function renderCloud() {
    const box = $('#login-cloud');
    const names = login.names;
    box.innerHTML = names.map((n, i) =>
      `<button type="button" class="cloud-chip${n.claimed ? '' : ' new'}" data-name="${esc(n.name)}" style="--cc:${CLOUD_COLORS[i % CLOUD_COLORS.length]};--d:${((i * 0.37) % 2).toFixed(2)}s" title="${n.claimed ? 'Log in as ' : 'Set up '}${esc(n.name)}">${esc(n.name)}</button>`
    ).join('');
    placeCloud();
  }

  /** Scatter chips on an ellipse that circumscribes the login panel (CSS stacks them on narrow screens). */
  function placeCloud() {
    const box = $('#login-cloud');
    if (window.matchMedia('(max-width: 760px)').matches) return;
    const panel = $('.panel.login');
    const chips = $$('.cloud-chip', box);
    if (!chips.length || !panel) return;
    const W = box.clientWidth, H = box.clientHeight;
    const pw = panel.offsetWidth, ph = panel.offsetHeight;
    const cx = W / 2, cy = panel.offsetTop + ph / 2;
    const GAP = 14;
    const n = chips.length;
    const rings = Math.ceil(n / 14);               // spill into outer rings when crowded
    chips.forEach((c, i) => {
      const hw = c.offsetWidth / 2, hh = c.offsetHeight / 2;
      const ring = i % rings;
      const idxInRing = Math.floor(i / rings);
      const inRing = Math.ceil((n - ring) / rings);
      const seed = Math.sin((i + 1) * 12.9898) * 43758.5453;
      const jit = seed - Math.floor(seed);
      const ang = ((idxInRing + (ring % 2) * 0.5) / inRing) * Math.PI * 2 - Math.PI / 2 + (jit - 0.5) * 0.18;
      // ellipse through the panel's corners, pushed out by the chip size
      const rx = (pw / 2 + hw) * 1.42 + GAP + ring * 70 + jit * 16;
      const ry = (ph / 2 + hh) * 1.42 + GAP + ring * 44 + jit * 12;
      let x = cx + Math.cos(ang) * rx, y = cy + Math.sin(ang) * ry;
      const clamp = () => {
        x = Math.min(W - hw - 6, Math.max(hw + 6, x));
        y = Math.min(H - hh - 6, Math.max(hh + 6, y));
      };
      clamp();
      // if clamping to the viewport pushed it onto the panel, slide it out along the shorter way
      const px0 = cx - pw / 2 - GAP, px1 = cx + pw / 2 + GAP, py0 = panel.offsetTop - GAP, py1 = panel.offsetTop + ph + GAP;
      if (x + hw > px0 && x - hw < px1 && y + hh > py0 && y - hh < py1) {
        const toLeft = x + hw - px0, toRight = px1 - (x - hw), toTop = y + hh - py0, toBottom = py1 - (y - hh);
        const m = Math.min(toLeft, toRight, toTop, toBottom);
        if (m === toLeft) x = px0 - hw; else if (m === toRight) x = px1 + hw; else if (m === toTop) y = py0 - hh; else y = py1 + hh;
        clamp();
      }
      c.style.left = x + 'px';
      c.style.top = y + 'px';
    });
  }

  async function loadCloud() {
    try { login.names = await Store.listUsernames(); } catch (e) { login.names = []; }
    renderCloud();
    syncModeToName();
  }

  function initLogin() {
    if (!Store.configured) {
      $('#login-err').textContent = ERRORS.NOT_CONFIGURED;
      $('#login-submit').disabled = true;
      return;
    }
    $('#login-form').onsubmit = (ev) => { ev.preventDefault(); submitLogin(); };
    $('#in-name').addEventListener('input', syncModeToName);
    $('#login-toggle').onclick = () => {
      if (login.mode === 'login') setMode('signup'); else setMode('login');
    };
    $('#login-forgot').onclick = forgotPassword;
    $('#login-cloud').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-name]');
      if (!b) return;
      $('#in-name').value = b.dataset.name;
      syncModeToName();
      (login.mode === 'login' ? $('#in-pass') : $('#in-email')).focus();
    });
    window.addEventListener('resize', placeCloud);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeCloud);
    loadCloud();
    resumeSession();
  }

  async function resumeSession() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SESSION)); } catch (e) { /* ignore */ }
    if (!s || !s.key || !s.refresh) return;
    try {
      const a = await Store.restore(s.refresh);
      await enterApp(s.key, a.email, true);
    } catch (e) {
      localStorage.removeItem(SESSION);
    }
  }

  async function submitLogin() {
    const err = $('#login-err');
    err.textContent = '';
    const name = $('#in-name').value.trim().slice(0, 20);
    const key = Store.slug(name);
    const pass = $('#in-pass').value;
    if (!key) { err.textContent = 'Enter a username (letters or numbers).'; return; }
    const btn = $('#login-submit');
    btn.disabled = true;
    try {
      if (login.mode === 'login') {
        const email = await Store.loginEmail(key);
        if (!email) { err.textContent = 'No account with that username. Use CREATE ACCOUNT to make one.'; return; }
        await Store.signIn(email, pass);
        await enterApp(key, email, false, name);
      } else {
        const email = $('#in-email').value.trim();
        if (pass !== $('#in-pass2').value) { err.textContent = 'Passwords do not match.'; return; }
        const hit = login.names.find((n) => n.key === key);
        if (hit && hit.claimed) { err.textContent = 'That username is taken. Log in instead.'; return; }
        await Store.register({ key, name: hit ? hit.name : name, email, password: pass });
        await enterApp(key, email, false, name);
        toast(login.mode === 'claim' ? 'Account set up. Welcome back!' : 'Account created for ' + name);
      }
    } catch (e) {
      err.textContent = errText(e);
    } finally {
      btn.disabled = false;
    }
  }

  async function forgotPassword() {
    const err = $('#login-err');
    const key = Store.slug($('#in-name').value);
    if (!key) { err.textContent = 'Type your username first.'; return; }
    try {
      const email = await Store.loginEmail(key);
      if (!email) { err.textContent = 'No account with that username.'; return; }
      await Store.sendReset(email);
      err.textContent = '';
      toast('Password reset email sent to ' + email.replace(/^(.).*(@.*)$/, '$1***$2'));
    } catch (e) {
      err.textContent = errText(e);
    }
  }

  /** Common post-auth path: load data, verify ownership, repair lookup records, show the app. */
  async function enterApp(key, email, silent, typedName) {
    const { db, online } = await Store.loadAll();
    const me = db.users[key];
    const uid = Store.session && Store.session.uid;
    if (!me || me.uid !== uid) {
      Store.signOut();
      localStorage.removeItem(SESSION);
      throw Object.assign(new Error('NOT_OWNER'), { code: 'NOT_OWNER' });
    }
    state.db = db;
    state.online = online;
    state.user = { name: me.name || typedName || key, key, uid, email, role: me.role };
    state.crew = localStorage.getItem(CREW_KEY + key) || ALL;
    if (state.crew !== ALL && !myCrews().includes(state.crew)) state.crew = ALL;
    localStorage.setItem(SESSION, JSON.stringify({ key, refresh: Store.session.refreshToken }));
    try { await Store.ensureProfile({ key, name: state.user.name, email }); } catch (e) { /* repaired next login */ }
    $('#login-screen').hidden = true;
    $('#app').hidden = false;
    renderAll();
    startPolling();
  }

  function logout() {
    localStorage.removeItem(SESSION);
    Store.signOut();
    location.reload();
  }

  /* ---------- sync ---------- */
  async function refresh() {
    if (!state.user) return;
    const { db, online } = await Store.loadAll();
    state.db = db;
    state.online = online;
    const me = db.users[state.user.key];
    if (me) { state.user.role = me.role; state.user.name = me.name || state.user.name; }
    if (state.crew !== ALL && !myCrews().includes(state.crew)) state.crew = ALL;
    renderAll();
  }

  let pollTimer;
  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(() => { if (!document.hidden) refresh().catch(() => {}); }, (cfg.refreshSeconds || 30) * 1000);
  }

  function renderSync() {
    const el = $('#sync');
    if (state.online) { el.textContent = 'SHARED ONLINE'; el.className = 'pill ok'; el.title = 'Synced with the shared database'; }
    else { el.textContent = 'OFFLINE'; el.className = 'pill bad'; el.title = 'Cannot reach the database; showing the last copy'; }
  }

  function renderUserBar() {
    $('#who').textContent = state.user.name;
    const rt = $('#role-tag');
    rt.textContent = isAdmin() ? 'ADMIN' : '';
    rt.className = isAdmin() ? 'admin' : '';
    $('#crew-tag').textContent = '@' + state.crew;
  }

  /* ---------- render: today ---------- */
  function renderAll() {
    renderSync();
    renderUserBar();
    $('#date-input').value = state.date;
    $('#log-date').textContent = prettyDate(state.date) + (state.date === today() ? ' (TODAY)' : '');
    $('#log-date').classList.toggle('warn', state.date !== today());
    renderToday();
    renderPreview();
    renderTab();
  }

  function playerCell(uk, name) {
    const me = state.user && uk === state.user.key;
    return `${dot(uk)}${me ? `<span class="me">${esc(name)}</span>` : esc(name)}`;
  }

  function renderToday() {
    const day = computeDay(state.date);
    $('#today-title').textContent = state.date === today() ? "TODAY'S BOARD" : 'BOARD: ' + state.date;

    // leaderboard
    const b = $('#today-board');
    if (!day.totals.length) {
      b.innerHTML = '<p class="empty">No scores logged for this day yet.<br>Paste your results in the box ▶ to get on the board.</p>';
    } else {
      b.innerHTML =
        '<table class="tbl"><thead><tr><th>#</th><th>PLAYER</th><th>PTS</th><th>🥇</th><th>🥈</th><th>🥉</th><th>GAMES</th></tr></thead><tbody>' +
        day.totals.map((t) => `<tr class="${t.rank === 1 && t.pts > 0 ? 'lead' : ''}"><td>${t.rank === 1 && t.pts > 0 ? '★' : t.rank}</td><td>${playerCell(t.uk, t.name)}</td><td class="num">${t.pts}</td><td class="num">${t.gold}</td><td class="num">${t.silver}</td><td class="num">${t.bronze}</td><td class="num">${t.played}</td></tr>`).join('') +
        '</tbody></table>' +
        `<p class="hint">${POINTS.map((p, i) => MEDALS[i] + ' ' + p).join(' · ')} pts per game. Needs 2+ players on a game to score.</p>`;
    }

    // per-game cards
    const g = $('#today-games');
    const ids = Object.keys(day.byGame).sort(
    (a, b) => day.byGame[b].length - day.byGame[a].length || meta(a).name.localeCompare(meta(b).name)
    );
    if (!ids.length) { g.innerHTML = ''; return; }
    g.innerHTML = ids.map((id) => {
      const list = day.byGame[id];
      const m = meta(id, list[0].e);
      const puzzles = [...new Set(list.map((r) => r.e.puzzle).filter((p) => p != null))];
      const rows = list.map((r) => {
        const mine = state.user && r.uk === state.user.key;
        return `<li><span class="rk">${MEDALS[r.rank - 1] || r.rank}</span><span class="pl">${playerCell(r.uk, r.name)}</span><span class="sc${r.e.fail ? ' fail' : ''}">${esc(r.e.display)}</span><span class="pt">${list.length > 1 ? '+' + r.pts : ''}</span>${mine ? `<button class="x" title="Delete my score" data-del="${esc(r.ek)}">✕</button>` : '<span class="x-pad"></span>'}</li>`;
      }).join('');
      return `<article class="gcard"><header><span class="ic">${m.icon}</span><h3>${m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">${esc(m.name)}</a>` : esc(m.name)}</h3><span class="pz">${puzzles.length ? '#' + puzzles.join(', #') : ''}</span><span class="dir" title="${m.higher ? 'Higher score wins' : 'Lower score wins'}">${m.higher ? '▲ HIGH' : '▼ LOW'}</span></header><ul>${rows}</ul></article>`;
    }).join('');
  }

  /* ---------- paste + parse ---------- */
  function renderPreview() {
    const text = $('#paste').value;
    const box = $('#preview');
    const btn = $('#btn-save');
    state.parsed = text.trim() ? Parsers.parseAll(text) : [];
    if (!text.trim()) {
      box.innerHTML = '<p class="empty">Waiting for a paste…<br>Copy a share result from any game, or several at once.</p>';
      btn.disabled = true;
      btn.textContent = 'SAVE SCORES';
      return;
    }
    if (!state.parsed.length) {
      box.innerHTML = '<p class="err">No scores detected. Paste the full share text, including the game title line.</p>';
      btn.disabled = true;
      btn.textContent = 'SAVE SCORES';
      return;
    }
    const mine = (state.db.users[state.user.key] || {}).entries || {};
    box.innerHTML =
      '<ul class="found">' +
      state.parsed.map((r) => {
        const m = meta(r.game, r);
        const dup = mine[`${state.date}_${r.game}`];
        return `<li><span class="ic">${m.icon}</span><b>${esc(m.name)}</b>${r.puzzle != null ? ' #' + esc(r.puzzle) : ''}<span class="sc">${esc(r.display)}</span>${dup ? '<span class="tag">REPLACES</span>' : '<span class="tag new">NEW</span>'}</li>`;
      }).join('') + '</ul>';
    btn.disabled = false;
    btn.textContent = `SAVE ${state.parsed.length} SCORE${state.parsed.length > 1 ? 'S' : ''}`;
  }

  async function saveParsed() {
    if (!state.parsed.length || !state.user) return;
    const { key, name } = state.user;
    const user = (state.db.users[key] = state.db.users[key] || { name, entries: {}, crews: {}, role: state.user.role });
    user.entries = user.entries || {};
    const jobs = [];
    for (const r of state.parsed) {
      const entry = JSON.parse(JSON.stringify({
        game: r.game, gameName: r.gameName, puzzle: r.puzzle, score: r.score, tie: r.tie,
        display: r.display, fail: !!r.fail, date: state.date, ts: Date.now(), raw: String(r.raw).slice(0, 500),
      }));
      const ek = `${state.date}_${r.game}`;
      user.entries[ek] = entry;
      jobs.push(Store.putEntry(key, ek, entry));
    }
    Store.saveLocal(state.db);
    const n = state.parsed.length;
    $('#paste').value = '';
    renderAll();
    const results = await Promise.all(jobs);
    if (results.some((ok) => !ok)) { state.online = false; renderSync(); toast(`Saved ${n} locally. Could not reach shared database.`); }
    else toast(`Saved ${n} score${n > 1 ? 's' : ''}!`);
  }

  async function deleteEntry(ek) {
    if (!confirm('Delete this score?')) return;
    const u = state.db.users[state.user.key];
    if (u && u.entries) delete u.entries[ek];
    Store.saveLocal(state.db);
    renderAll();
    const done = await Store.removeEntry(state.user.key, ek);
    toast(done ? 'Score deleted' : 'Deleted locally. Could not reach shared database.');
  }

  /* ---------- tabs ---------- */
  function renderTab() {
    $$('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.tab));
    const isToday = state.tab === 'today';
    $('#view-today').hidden = !isToday;
    $('#view-archive').hidden = isToday;
    if (isToday) return;
    const titles = { alltime: 'ALL-TIME STANDINGS', history: 'HISTORY', trends: 'TRENDS', games: 'BY GAME', data: 'DATA' };
    const fn = { alltime: tabAllTime, history: tabHistory, trends: tabTrends, games: tabGames, data: tabData }[state.tab];
    $('#archive-title').textContent = titles[state.tab];
    const body = $('#tab-body');
    body.innerHTML = '';
    fn(body);
  }

  function tabAllTime(body) {
    const tl = timeline();
    if (!tl.totals.length) { body.innerHTML = '<p class="empty">No data yet. Log some scores!</p>'; return; }
    body.innerHTML =
      '<table class="tbl"><thead><tr><th>#</th><th>PLAYER</th><th>PTS</th><th>🥇</th><th>🥈</th><th>🥉</th><th>PLAYED</th><th>DAYS</th><th>STREAK</th></tr></thead><tbody>' +
      tl.totals.map((t) => `<tr class="${t.rank === 1 && t.pts > 0 ? 'lead' : ''}"><td>${t.rank === 1 && t.pts > 0 ? '★' : t.rank}</td><td>${playerCell(t.uk, t.name)}</td><td class="num">${t.pts}</td><td class="num">${t.gold}</td><td class="num">${t.silver}</td><td class="num">${t.bronze}</td><td class="num">${t.played}</td><td class="num">${t.days}</td><td class="num">${streakFor(t.uk)}🔥</td></tr>`).join('') +
      '</tbody></table>';
  }

  function tabHistory(body) {
    const tl = timeline();
    if (!tl.days.length) { body.innerHTML = '<p class="empty">No history yet.</p>'; return; }
    body.innerHTML =
      '<div class="scroll"><table class="tbl"><thead><tr><th>DATE</th><th>PLAYERS</th><th>SCORES</th><th>DAY WINNER</th><th></th></tr></thead><tbody>' +
      tl.days.slice().reverse().map(({ date, day }) => {
        const scores = Object.values(day.byGame).reduce((n, l) => n + l.length, 0);
        const top = day.totals[0];
        const winners = top && top.pts > 0 ? day.totals.filter((t) => t.rank === 1).map((t) => playerCell(t.uk, t.name) + ` (${t.pts})`).join(', ') : '-';
        return `<tr><td>${esc(date)}</td><td class="num">${day.totals.length}</td><td class="num">${scores}</td><td>${winners}</td><td><button class="btn small ghost" data-goto="${esc(date)}">VIEW</button></td></tr>`;
      }).join('') + '</tbody></table></div>';
  }

  function tabTrends(body) {
    const tl = timeline();
    if (!tl.dates.length) { body.innerHTML = '<p class="empty">The chart appears after your first scores.</p>'; return; }
    const users = Object.keys(tl.series).filter((uk) => tl.totals.some((t) => t.uk === uk));
    body.innerHTML =
      '<canvas id="trend" width="320" height="140"></canvas>' +
      '<div class="legend">' + users.map((uk) => `<span>${dot(uk)}${esc(state.db.users[uk].name || uk)}</span>`).join('') + '</div>' +
      `<p class="hint">Cumulative points by day (${esc(tl.dates[0])} → ${esc(tl.dates[tl.dates.length - 1])})</p>`;
    drawTrend($('#trend'), tl, users);
  }

  function drawTrend(canvas, tl, users) {
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0d0e11'; ctx.fillRect(0, 0, W, H);
    const pl = 26, pr = 8, pt = 8, pb = 8;
    const iw = W - pl - pr, ih = H - pt - pb;
    const max = Math.max(4, ...users.map((uk) => Math.max(...tl.series[uk])));
    const n = tl.dates.length;
    const X = (i) => Math.round(n < 2 ? pl + iw / 2 : pl + (i * iw) / (n - 1));
    const Y = (v) => Math.round(pt + ih - (v / max) * ih);

    ctx.fillStyle = '#2a2e37';
    for (let g = 0; g <= 4; g++) {
      const y = Math.round(pt + (ih * g) / 4);
      for (let x = pl; x < W - pr; x += 4) ctx.fillRect(x, y, 2, 1); // dotted grid
    }
    ctx.fillStyle = '#7d8290';
    ctx.font = '8px monospace';
    ctx.fillText(String(max), 1, pt + 3);
    ctx.fillText('0', 1, pt + ih + 3);

    users.forEach((uk) => {
      const col = colorFor(uk);
      ctx.fillStyle = col;
      const s = tl.series[uk];
      for (let i = 0; i < n; i++) {
        if (i > 0) {
          const x0 = X(i - 1), y0 = Y(s[i - 1]), x1 = X(i), y1 = Y(s[i]);
          const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
          for (let k = 0; k <= steps; k++) ctx.fillRect(Math.round(x0 + ((x1 - x0) * k) / steps), Math.round(y0 + ((y1 - y0) * k) / steps), 2, 2);
        }
        ctx.fillRect(X(i) - 2, Y(s[i]) - 2, 4, 4);
      }
    });
  }

  function tabGames(body) {
    const all = allEntries();
    if (!all.length) { body.innerHTML = '<p class="empty">No games logged yet.</p>'; return; }
    const byGame = {};
    all.forEach((e) => { (byGame[e.game] = byGame[e.game] || []).push(e); });
    body.innerHTML = Object.keys(byGame).sort((a, b) => meta(a).name.localeCompare(meta(b).name)).map((id) => {
      const m = meta(id, byGame[id][0]);
      const byUser = {};
      byGame[id].forEach((e) => { (byUser[e.uk] = byUser[e.uk] || []).push(e); });
      const rows = Object.entries(byUser).map(([uk, list]) => {
        const best = list.slice().sort(cmp)[0];
        const avg = list.reduce((s, e) => s + e.score, 0) / list.length;
        return { uk, name: list[0].name, plays: list.length, best, avg };
      }).sort((a, b) => cmp(a.best, b.best));
      return `<h3 class="gh">${m.icon} ${esc(m.name)} <small>${m.higher ? '▲ higher wins' : '▼ lower wins'}</small></h3>` +
        '<table class="tbl"><thead><tr><th>PLAYER</th><th>PLAYS</th><th>BEST</th><th>AVG</th></tr></thead><tbody>' +
        rows.map((r) => `<tr><td>${playerCell(r.uk, r.name)}</td><td class="num">${r.plays}</td><td class="num">${esc(r.best.display)}</td><td class="num">${esc(Games.fmtValue(m, r.avg))}</td></tr>`).join('') +
        '</tbody></table>';
    }).join('');
  }

  function tabData(body) {
    body.innerHTML =
      `<div class="data">
        <p>Signed in as <b>${esc(state.user.name)}</b>. Viewing crew <b>@${esc(state.crew)}</b>${state.crew === ALL ? ' (everyone)' : ''}.</p>
        <div class="btnrow">
          <button class="btn small" id="d-export">EXPORT JSON</button>
          <button class="btn small" id="d-import">IMPORT JSON</button>
          <button class="btn small ghost" id="d-refresh">REFRESH</button>
          <button class="btn small danger" id="d-wipe">DELETE MY SCORES</button>
        </div>
        <input type="file" id="d-file" accept="application/json" hidden>
      </div>`;
    $('#d-export').onclick = exportData;
    $('#d-import').onclick = () => $('#d-file').click();
    $('#d-file').onchange = importData;
    $('#d-refresh').onclick = async () => { await refresh(); toast('Refreshed'); };
    $('#d-wipe').onclick = wipeMine;
  }

  function exportData() {
    const vis = visibleUsers();
    const users = {};
    for (const [uk, u] of Object.entries(vis)) users[uk] = { name: u.name, entries: u.entries || {} };
    const blob = new Blob([JSON.stringify({ app: 'pixel-rank', crew: state.crew, exported: new Date().toISOString(), users }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rank2-day-${state.crew}-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /** Merges newer entries from a file. You can import your own scores; admins can import anyone's. */
  async function importData(ev) {
    const f = ev.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const incoming = data.users || {};
      let added = 0, skipped = 0;
      for (const [rawKey, u] of Object.entries(incoming)) {
        const uk = Store.slug(rawKey);
        const target = state.db.users[uk];
        if (!target || (uk !== state.user.key && !isAdmin())) { skipped++; continue; }
        const fresh = {};
        for (const [ek, e] of Object.entries((u && u.entries) || {})) {
          const cur = (target.entries || {})[ek];
          if (!cur || (e.ts || 0) > (cur.ts || 0)) { fresh[ek] = e; added++; }
        }
        if (Object.keys(fresh).length) {
          target.entries = Object.assign(target.entries || {}, fresh);
          await Store.mergeEntries(uk, fresh);
        }
      }
      Store.saveLocal(state.db);
      renderAll();
      toast(`Imported ${added} scores` + (skipped ? ` (${skipped} account${skipped > 1 ? 's' : ''} skipped)` : ''));
    } catch (e) {
      toast('Import failed: not a valid rank2.day file');
    }
    ev.target.value = '';
  }

  async function wipeMine() {
    if (!confirm('Delete ALL of your scores? Your account stays. This cannot be undone.')) return;
    const key = state.user.key;
    if (state.db.users[key]) state.db.users[key].entries = {};
    Store.saveLocal(state.db);
    renderAll();
    const done = await Store.clearEntries(key);
    toast(done ? 'Your scores were cleared' : 'Cleared locally. Could not reach shared database.');
  }

  /* ---------- modal: crew + account ---------- */
  function openModal(title, render) {
    $('#modal-title').textContent = title;
    $('#modal').hidden = false;
    render($('#modal-body'));
  }
  function closeModal() { $('#modal').hidden = true; $('#modal-body').innerHTML = ''; }

  function setCrew(code) {
    state.crew = code;
    localStorage.setItem(CREW_KEY + state.user.key, code);
    renderAll();
  }

  function crewMembers(code) {
    return Object.values(state.db.users).filter((u) => u.crews && u.crews[code]).length;
  }

  function openCrew() {
    openModal('CREW CODE', function draw(body) {
      const mine = myCrews().filter((c) => c !== ALL);
      const item = (code, label, removable) =>
        `<li class="${state.crew === code ? 'on' : ''}"><span class="tick">${state.crew === code ? '▸' : ''}</span><button type="button" class="pick" data-pick="${esc(code)}">@${esc(label)}</button>${removable ? `<button type="button" class="x" title="Remove this code" data-rm="${esc(code)}">✕</button>` : ''}</li>`;
      body.innerHTML =
        `<p class="hint" style="margin-top:0">Pick a crew to filter whose scores you see. Anyone who saves the same code shows up in it. <b>@${esc(ALL)}</b> shows everyone.</p>` +
        '<ul class="crew-list">' +
        item(ALL, ALL + ' (everyone)', false) +
        mine.map((c) => item(c, `${c} (${crewMembers(c)})`, true)).join('') +
        '</ul>' +
        '<label class="label" for="crew-add">ADD A CREW CODE</label>' +
        '<div class="row"><input id="crew-add" type="text" maxlength="32" placeholder="e.g. work-friends" autocomplete="off"><button type="button" class="btn small" id="crew-add-btn">ADD</button></div>' +
        '<p id="crew-msg" class="err" role="alert"></p>';

      body.onclick = async (ev) => {
        const pick = ev.target.closest('[data-pick]');
        if (pick) { setCrew(pick.dataset.pick); draw(body); return; }
        const rm = ev.target.closest('[data-rm]');
        if (rm) {
          const code = rm.dataset.rm;
          const me = state.db.users[state.user.key];
          if (me && me.crews) delete me.crews[code];
          if (state.crew === code) setCrew(ALL);
          Store.saveLocal(state.db);
          renderAll();
          draw(body);
          if (!(await Store.removeCrew(state.user.key, code))) toast('Removed locally. Could not reach shared database.');
          return;
        }
        if (ev.target.closest('#crew-add-btn')) add();
      };
      $('#crew-add').onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); add(); } };

      async function add() {
        const code = Store.slug($('#crew-add').value);
        if (!code) { $('#crew-msg').textContent = 'Use letters or numbers.'; return; }
        if (code === ALL) { setCrew(ALL); draw(body); return; }
        const me = state.db.users[state.user.key];
        if (!me) return;
        me.crews = me.crews || {};
        me.crews[code] = true;
        setCrew(code);
        Store.saveLocal(state.db);
        draw(body);
        if (!(await Store.addCrew(state.user.key, code))) toast('Added locally. Could not reach shared database.');
        else toast('Crew @' + code + ' saved');
      }
    });
  }

  function openAccount() {
    openModal('ACCOUNT', function draw(body) {
      const u = state.user;
      const me = state.db.users[u.key] || {};
      const crews = [ALL].concat(myCrews().filter((c) => c !== ALL));
      const adminBlock = isAdmin()
        ? '<h3>ADMIN</h3>' +
          '<table class="admin-users"><tbody>' +
          Object.entries(state.db.users).sort((a, b) => (a[1].name || a[0]).localeCompare(b[1].name || b[0])).map(([uk, x]) =>
            `<tr><td>${esc(x.name || uk)}${x.uid ? '' : ' <small class="hint">(unclaimed)</small>'}</td><td><select data-role="${esc(uk)}" ${uk === u.key ? 'disabled title="You cannot change your own role"' : ''}><option value="player"${x.role !== 'admin' ? ' selected' : ''}>player</option><option value="admin"${x.role === 'admin' ? ' selected' : ''}>admin</option></select></td></tr>`
          ).join('') +
          '</tbody></table>' +
          '<div class="btnrow"><button type="button" class="btn small ghost" id="adm-migrate">IMPORT LEGACY DATA</button></div>' +
          '<p class="hint">Legacy import copies the old crew &gt; name &gt; scores data into accounts. Old crews become crew codes. Names show on the login screen until their owners set up an email and password.</p>'
        : '';
      body.innerHTML =
        `<div class="kv"><span>USERNAME</span><span>${esc(u.name)}</span></div>` +
        `<div class="kv"><span>ROLE</span><span>${esc(me.role || u.role)}</span></div>` +
        `<div class="kv"><span>EMAIL</span><span>${esc(u.email || '-')}</span></div>` +
        `<div class="kv"><span>CREWS</span><span>${crews.map((c) => '@' + esc(c)).join(' ')}</span></div>` +
        '<h3>EDIT</h3>' +
        '<form id="acct-form" autocomplete="off">' +
        '<label class="label" for="ac-email">NEW EMAIL (optional)</label><input id="ac-email" type="email" placeholder="leave blank to keep">' +
        '<label class="label" for="ac-pass">NEW PASSWORD (optional)</label><input id="ac-pass" type="password" minlength="6" autocomplete="new-password" placeholder="leave blank to keep">' +
        '<label class="label" for="ac-pass2">CONFIRM NEW PASSWORD</label><input id="ac-pass2" type="password" minlength="6" autocomplete="new-password">' +
        '<label class="label" for="ac-cur">CURRENT PASSWORD (required to save)</label><input id="ac-cur" type="password" autocomplete="current-password" required>' +
        '<div class="btnrow"><button class="btn small" type="submit" id="ac-save">SAVE CHANGES</button></div>' +
        '<p id="ac-msg" class="err" role="alert"></p></form>' +
        adminBlock;

      $('#acct-form').onsubmit = async (ev) => {
        ev.preventDefault();
        const msg = $('#ac-msg');
        msg.className = 'err';
        const email = $('#ac-email').value.trim();
        const pass = $('#ac-pass').value;
        if (!email && !pass) { msg.textContent = 'Enter a new email or password to change.'; return; }
        if (pass && pass !== $('#ac-pass2').value) { msg.textContent = 'New passwords do not match.'; return; }
        const btn = $('#ac-save');
        btn.disabled = true;
        try {
          await Store.updateAccount({ currentPassword: $('#ac-cur').value, email: email || undefined, password: pass || undefined });
          if (email) { await Store.setLoginEmail(u.key, email); u.email = email; }
          localStorage.setItem(SESSION, JSON.stringify({ key: u.key, refresh: Store.session.refreshToken }));
          toast('Account updated');
          draw(body);
        } catch (e) {
          msg.textContent = errText(e);
        } finally {
          btn.disabled = false;
        }
      };

      body.onchange = async (ev) => {
        const sel = ev.target.closest('[data-role]');
        if (!sel) return;
        const uk = sel.dataset.role;
        const done = await Store.setRole(uk, sel.value);
        if (done) { state.db.users[uk].role = sel.value; Store.saveLocal(state.db); toast(`${state.db.users[uk].name || uk} is now ${sel.value}`); }
        else { toast('Could not change role.'); draw(body); }
      };
      const mig = $('#adm-migrate');
      if (mig) mig.onclick = async () => {
        if (!confirm('Import legacy crew data into accounts? Existing scores are kept (newest wins).')) return;
        mig.disabled = true;
        try {
          const r = await Store.migrateLegacy();
          await refresh();
          toast(`Imported ${r.users} accounts, ${r.entries} scores`);
          draw(body);
        } catch (e) {
          toast('Import failed: ' + errText(e));
          mig.disabled = false;
        }
      };
    });
  }

  /* ---------- games drawer ---------- */
  function renderLinks(filter) {
    const q = (filter || '').toLowerCase().trim();
    const html = (window.GAME_LINKS || []).map((c) => {
      const items = c.items.filter((i) => !q || (i.name + ' ' + (i.note || '')).toLowerCase().includes(q));
      if (!items.length) return '';
      return `<h4>${esc(c.cat)}</h4><ul>` + items.map((i) => `<li><a href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">${esc(i.name)}</a><small>${esc(i.note || '')}</small></li>`).join('') + '</ul>';
    }).join('');
    $('#link-list').innerHTML = html || '<p class="empty">No games match.</p>';
  }
  function toggleDrawer(open) {
    $('#drawer').classList.toggle('open', open);
    $('#backdrop').classList.toggle('show', open);
    $('#drawer').setAttribute('aria-hidden', String(!open));
    if (open) $('#link-filter').focus();
  }

  /* ---------- wire up ---------- */
  function setDate(d) { if (!d) return; state.date = d; renderAll(); }

  function init() {
    document.title = cfg.title ? cfg.title + ' - Daily Game Leaderboard' : document.title;
    $('#btn-prev').onclick = () => setDate(addDays(state.date, -1));
    $('#btn-next').onclick = () => setDate(addDays(state.date, 1));
    $('#btn-today').onclick = () => setDate(today());
    $('#date-input').onchange = (e) => setDate(e.target.value);
    $('#btn-logout').onclick = logout;
    $('#btn-crew').onclick = openCrew;
    $('#btn-account').onclick = openAccount;
    $('#modal-close').onclick = closeModal;
    $('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') closeModal(); });
    $('#btn-games').onclick = () => toggleDrawer(true);
    $('#drawer-close').onclick = () => toggleDrawer(false);
    $('#backdrop').onclick = () => toggleDrawer(false);
    $('#link-filter').oninput = (e) => renderLinks(e.target.value);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { toggleDrawer(false); closeModal(); } });
    $('#btn-crt').onclick = () => { document.body.classList.toggle('nocrt'); localStorage.setItem('pixelrank.nocrt', document.body.classList.contains('nocrt') ? '1' : ''); };
    if (localStorage.getItem('pixelrank.nocrt')) document.body.classList.add('nocrt');

    $('#paste').addEventListener('input', renderPreview);
    $('#btn-save').onclick = saveParsed;
    $('#btn-clear').onclick = () => { $('#paste').value = ''; renderPreview(); $('#paste').focus(); };
    $('#btn-clip').onclick = async () => {
      try { $('#paste').value = await navigator.clipboard.readText(); renderPreview(); }
      catch (e) { toast('Clipboard blocked. Paste with Ctrl/Cmd+V instead.'); $('#paste').focus(); }
    };

    $$('.tab').forEach((b) => (b.onclick = () => { state.tab = b.dataset.tab; renderTab(); }));
    document.addEventListener('click', (e) => {
      const del = e.target.closest('[data-del]');
      if (del) deleteEntry(del.dataset.del);
      const go = e.target.closest('[data-goto]');
      if (go) { state.tab = 'today'; setDate(go.dataset.goto); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && state.user) refresh().catch(() => {}); });

    renderLinks('');
    initLogin();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
