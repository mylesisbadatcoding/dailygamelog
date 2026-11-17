/*
 * Score rules + display for each game the parsers can emit.
 * higher: true  -> bigger score wins.   higher: false -> smaller score wins.
 * fmt: how to print averages ('int' | 'time' | 'money' | undefined)
 * Games not listed here (found by the generic parser) default to
 * "lower is better, tries style".
 */
(function (root) {
  'use strict';
  const GAMES = {
    noillirk:      { name: 'Noillirk',        icon: '🎈', higher: true,  fmt: 'int',   url: 'https://playdaily.org/noillirk' },
    wordle:        { name: 'Wordle',          icon: '🟩', higher: false,               url: 'https://www.nytimes.com/games/wordle/index.html' },
    costcodle:     { name: 'Costcodle',       icon: '🛒', higher: false, fmt: 'money', url: 'https://www.costcodle.com' },
    scale:         { name: 'Scale of Things', icon: '📏', higher: true,  fmt: 'int',   url: 'https://playdaily.org/size-it-up' },
    krillion:      { name: 'Krillion',        icon: '🦐', higher: true,  fmt: 'int',   url: 'https://krillion.io' },
    nytmini:       { name: 'NYT Mini',        icon: '⏱️', higher: false, fmt: 'time',  url: 'https://www.nytimes.com/crosswords/game/mini' },
    'daily-red':   { name: 'Daily Red',       icon: '🟥', higher: true,                url: 'https://daily-red.com' },
    'daily-blue':  { name: 'Daily Blue',      icon: '🟦', higher: true,                url: 'https://daily-red.com/blue' },
    'daily-lance': { name: 'Daily Lance',     icon: '🟪', higher: true,                url: 'https://daily-red.com/lance' },
    connections:   { name: 'Connections',     icon: '🔗', higher: false,               url: 'https://www.nytimes.com/games/connections' },
    strands:       { name: 'Strands',         icon: '💡', higher: false,               url: 'https://www.nytimes.com/games/strands' },
    quordle:       { name: 'Quordle',         icon: '4️⃣', higher: false,               url: 'https://www.merriam-webster.com/games/quordle' },
    nerdle:        { name: 'Nerdle',          icon: '🤓', higher: false,               url: 'https://nerdlegame.com' },
    dordle:        { name: 'Dordle',          icon: '2️⃣', higher: false,               url: 'https://zaratustra.itch.io/dordle' },
    worldle:       { name: 'Worldle',         icon: '🌍', higher: false,               url: 'https://worldle.teuteuf.fr' },
    maptap:        { name: 'MapTap',          icon: '📍', higher: true,  fmt: 'int',   url: 'https://www.maptap.gg' },
    globle:        { name: 'Globle',          icon: '🌐', higher: false,               url: 'https://globle-game.com' },
    contexto:      { name: 'Contexto',        icon: '🔎', higher: false,               url: 'https://contexto.me' },
  };

  function meta(id, entry) {
    const g = GAMES[id];
    if (g) return Object.assign({ id }, g);
    return { id, name: (entry && entry.gameName) || id, icon: '🎯', higher: false };
  }

  function fmtValue(m, v) {
    if (v == null || isNaN(v)) return '-';
    if (m.fmt === 'time') { v = Math.round(v); return Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0'); }
    if (m.fmt === 'money') return '$' + Number(v).toFixed(2);
    if (m.fmt === 'int') return Math.round(v).toLocaleString('en-US');
    return (Math.round(v * 10) / 10).toString();
  }

  root.Games = { GAMES, meta, fmtValue };
})(window);
