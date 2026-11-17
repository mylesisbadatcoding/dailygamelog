/* rank2.day - app logic (no build step, no dependencies) */
(function () {
  'use strict';

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const cfg = window.PIXELRANK_CONFIG || {};
  const POINTS = cfg.points || [3, 2, 1];
  const SESSION = 'pixelrank.session';
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
    user: null,           // { name, key }
    group: 'home',
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

  function allEntries() {
    const out = [];
    for (const [uk, u] of Object.entries(state.db.users)) {
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
    for (const [uk, u] of Object.entries(state.db.users)) {
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
    for (const uk of Object.keys(state.db.users)) {
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

  /* ---------- login ---------- */
  function initLogin() {
    const box = $('#profiles');
    const profs = Store.localProfiles();
    if (profs.length) {
      box.innerHTML =
        '<div class="label">SAVE FILES ON THIS DEVICE</div>' +
        profs.map((p, i) => `<button type="button" class="btn small ghost" data-prof="${i}">${esc(p.name)}${Store.remote ? ' @' + esc(p.group) : ''}</button>`).join(' ');
      box.onclick = (ev) => {
        const b = ev.target.closest('[data-prof]');
        if (!b) return;
        const p = profs[Number(b.dataset.prof)];
        login(p.name, p.group);
      };
    } else {
      box.innerHTML = '';
    }

    $('#login-form').onsubmit = (ev) => {
      ev.preventDefault();
      login($('#in-name').value, $('#in-crew').value);
    };

    try {
      const s = JSON.parse(localStorage.getItem(SESSION));
      if (s && s.name) login(s.name, s.crew, true);
    } catch (e) { /* ignore */ }
  }

  async function login(name, crew, silent) {
    name = String(name || '').trim().slice(0, 20);
    const key = Store.slug(name);
    if (!key) { $('#login-err').textContent = 'Enter a username (letters or numbers).'; return; }
    $('#login-err').textContent = '';
    state.user = { name, key };
    state.group = Store.slug(crew) || cfg.defaultGroup || 'home';
    localStorage.setItem(SESSION, JSON.stringify({ name, crew: state.group }));
    $('#login-screen').hidden = true;
    $('#app').hidden = false;
    $('#who').textContent = name;
    $('#crew-tag').textContent = Store.remote ? '@' + state.group : '';
    await refresh();
    if (!state.db.users[key]) {
      state.db.users[key] = { name, entries: {} }; // creates the new save folder
      Store.saveLocal(state.group, state.db);
      Store.putUserName(state.group, key, name);
      renderAll();
      if (!silent) toast('New save file created for ' + name);
    }
    startPolling();
  }

  function logout() {
    localStorage.removeItem(SESSION);
    location.reload();
  }

  /* ---------- sync ---------- */
  async function refresh() {
    const { db, online } = await Store.load(state.group);
    state.db = db;
    state.online = online;
    renderAll();
  }

  let pollTimer;
  function startPolling() {
    clearInterval(pollTimer);
    if (!Store.remote) return;
    pollTimer = setInterval(() => { if (!document.hidden) refresh(); }, (cfg.refreshSeconds || 30) * 1000);
  }

  function renderSync() {
    const el = $('#sync');
    if (!Store.remote) { el.textContent = 'LOCAL ONLY'; el.className = 'pill'; el.title = 'Scores are saved in this browser. See README to share with friends.'; }
    else if (state.online) { el.textContent = 'SHARED ONLINE'; el.className = 'pill ok'; el.title = 'Synced with the shared database'; }
    else { el.textContent = 'OFFLINE'; el.className = 'pill bad'; el.title = 'Cannot reach the database; showing the local copy'; }
  }

  /* ---------- render: today ---------- */
  function renderAll() {
    renderSync();
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
    const user = (state.db.users[key] = state.db.users[key] || { name, entries: {} });
    user.name = name;
    user.entries = user.entries || {};
    const jobs = [];
    for (const r of state.parsed) {
      const entry = JSON.parse(JSON.stringify({
        game: r.game, gameName: r.gameName, puzzle: r.puzzle, score: r.score, tie: r.tie,
        display: r.display, fail: !!r.fail, date: state.date, ts: Date.now(), raw: String(r.raw).slice(0, 500),
      }));
      const ek = `${state.date}_${r.game}`;
      user.entries[ek] = entry;
      jobs.push(Store.putEntry(state.group, key, ek, entry));
    }
    Store.saveLocal(state.group, state.db);
    const n = state.parsed.length;
    $('#paste').value = '';
    renderAll();
    const results = await Promise.all(jobs);
    if (Store.remote && results.some((ok) => !ok)) { state.online = false; renderSync(); toast(`Saved ${n} locally. Could not reach shared database.`); }
    else toast(`Saved ${n} score${n > 1 ? 's' : ''}!`);
  }

  async function deleteEntry(ek) {
    if (!confirm('Delete this score?')) return;
    const u = state.db.users[state.user.key];
    if (u && u.entries) delete u.entries[ek];
    Store.saveLocal(state.group, state.db);
    renderAll();
    await Store.removeEntry(state.group, state.user.key, ek);
    toast('Score deleted');
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
        <p>Mode: <b>${Store.remote ? 'SHARED (' + esc(state.group) + ')' : 'LOCAL ONLY'}</b>. ${Store.remote ? '' : 'Scores live in this browser. Add a Firebase URL in <code>js/config.js</code> to share with friends.'}</p>
        <div class="btnrow">
          <button class="btn small" id="d-export">EXPORT JSON</button>
          <button class="btn small" id="d-import">IMPORT JSON</button>
          <button class="btn small ghost" id="d-refresh">REFRESH</button>
          <button class="btn small danger" id="d-wipe">DELETE MY SAVE</button>
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
    const blob = new Blob([JSON.stringify({ app: 'pixel-rank', group: state.group, exported: new Date().toISOString(), users: state.db.users }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rank2-day-${state.group}-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importData(ev) {
    const f = ev.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const incoming = data.users || {};
      let added = 0;
      for (const [uk, u] of Object.entries(incoming)) {
        const mine = (state.db.users[uk] = state.db.users[uk] || { name: u.name || uk, entries: {} });
        mine.entries = mine.entries || {};
        for (const [ek, e] of Object.entries(u.entries || {})) {
          if (!mine.entries[ek] || (e.ts || 0) > (mine.entries[ek].ts || 0)) { mine.entries[ek] = e; added++; }
        }
      }
      Store.saveLocal(state.group, state.db);
      await Store.replaceUsers(state.group, state.db.users);
      renderAll();
      toast(`Imported ${added} scores`);
    } catch (e) {
      toast('Import failed: not a valid rank2.day file');
    }
    ev.target.value = '';
  }

  async function wipeMine() {
    if (!confirm('Delete ALL of your scores for this crew? This cannot be undone.')) return;
    const key = state.user.key;
    state.db.users[key] = { name: state.user.name, entries: {} };
    Store.saveLocal(state.group, state.db);
    await Store.removeUser(state.group, key);
    await Store.putUserName(state.group, key, state.user.name);
    renderAll();
    toast('Your save was cleared');
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
    $('#btn-games').onclick = () => toggleDrawer(true);
    $('#drawer-close').onclick = () => toggleDrawer(false);
    $('#backdrop').onclick = () => toggleDrawer(false);
    $('#link-filter').oninput = (e) => renderLinks(e.target.value);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleDrawer(false); });
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
    document.addEventListener('visibilitychange', () => { if (!document.hidden && state.user && Store.remote) refresh(); });

    renderLinks('');
    initLogin();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
