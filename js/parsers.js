/*
 * rank2.day - share-text parsers
 *
 * parseAll(text) accepts ANY pasted blob (one game or many) and returns an
 * array of results:
 *   { game, gameName?, puzzle, score, tie?, display, fail?, raw }
 *
 * How it works:
 *   1. Every parser has a `re` that finds the HEADER of its share format.
 *   2. All header hits are sorted by position; the text between one header
 *      and the next is that game's "block".
 *   3. The parser's parse(block, headerMatch) pulls the score out of the block.
 *   4. A generic "Name #123 4/6" parser catches unknown tries-style games.
 *
 * To support a new game, add an object to PARSERS below (see README).
 */
(function (root) {
  'use strict';

  const num = (s) => parseFloat(String(s).replace(/,/g, ''));
  const fmtInt = (n) => Number(n).toLocaleString('en-US');
  const firstLine = (s) => String(s).split('\n')[0];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const mmss = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const slug = (s) =>
    String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);

  const PARSERS = [
    // Noillirk 🎈 The Daily Climb · No. 51 · 5,713m
    {
      name: 'noillirk',
      re: /Noillirk[^\n]*?No\.?\s*(\d+)[^\n]*?([\d,]+)\s*m\b/gi,
      parse: (b, m) => ({
        game: 'noillirk',
        puzzle: num(m[1]),
        score: num(m[2]),
        display: fmtInt(num(m[2])) + 'm',
      }),
    },

    // Wordle 1,975 3/6
    {
      name: 'wordle',
      re: /\bWordle\s+([\d,]+)\s+([1-6X])\/6(\*?)/gi,
      parse: (b, m) => {
        const fail = /x/i.test(m[2]);
        const tries = fail ? 7 : Number(m[2]);
        return {
          game: 'wordle',
          puzzle: num(m[1]),
          score: tries,
          display: (fail ? 'X' : tries) + '/6' + (m[3] || ''),
          fail,
        };
      },
    },

    // Costcodle Checkout #6  (score = total dollars "off" - lower is better)
    {
      name: 'costcodle',
      re: /(?:^[^\n]*Costcodle[^\n]*\n)?Costcodle(?:\s+Checkout)?\s*#(\d+)/gim,
      parse: (b, m) => {
        let total = null;
        const t = b.match(/\$\s*([\d,]+(?:\.\d+)?)\s+total off/i);
        if (t) {
          total = num(t[1]);
        } else {
          let sum = 0;
          let n = 0;
          for (const x of b.matchAll(/^\s*\d+\.\s.*?\boff\s+\$([\d,]+(?:\.\d+)?)/gim)) {
            sum += num(x[1]);
            n++;
          }
          if (n) total = Math.round(sum * 100) / 100;
        }
        if (total == null) return null;
        return {
          game: 'costcodle',
          puzzle: num(m[1]),
          score: total,
          display: '$' + total.toFixed(2) + ' off',
        };
      },
    },

    // Scale of Things 📏 454 / 1,000
    {
      name: 'scale',
      re: /Scale of Things[^\n\d]*([\d,]+)\s*\/\s*([\d,]+)/gi,
      parse: (b, m) => ({
        game: 'scale',
        puzzle: null,
        score: num(m[1]),
        display: fmtInt(num(m[1])) + ' / ' + fmtInt(num(m[2])),
      }),
    },

    // Krillion #123 🦐 \n 465
    {
      name: 'krillion',
      re: /Krillion\s*#(\d+)[^\n]*\n\s*([\d,]+)/gi,
      parse: (b, m) => ({
        game: 'krillion',
        puzzle: num(m[1]),
        score: num(m[2]),
        display: fmtInt(num(m[2])) + ' pts',
      }),
    },

    // NYT mini: 16s   |   I solved the Mini in 0:16
        {
      name: 'nytmini',
      re: /nytimes\.com\/shared\/v2\/mini-xwd\.html\?[^\s]*?\bd=(\d{4}-\d{2}-\d{2})/gi,
      parse: (b, m) => {
        const t = b.match(/[?&]t=(\d+)/);
        if (!t) return null;
        const score = Number(t[1]);
        return { game: 'nytmini', puzzle: Number(m[1].replace(/-/g, '')), score, display: mmss(score) };
      },
    },
    //4x3
    {
      name: 'fourbythree',
      re: /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\s*\n\s*(\d+)\s+points?\b/gi,
      parse: (b, m) => {
        const mi = b.match(/(\d+)\s+mistakes?/i);
        return { game: 'fourbythree', puzzle: null, score: Number(m[1]), tie: mi ? Number(mi[1]) : 0, display: m[1] + ' pts' };
      },
    },
    //geozee
  {
    name: 'geozee',
    re: /Geozee\s+#(\d+)/gi,
    parse: (b, m) => {
      const s = b.match(/(\d+)\s*\/\s*(\d+)/);
      if (!s) return null;
      const t = b.match(/top\s+(\d+)%/i);
      return { game: 'geozee', puzzle: Number(m[1]), score: Number(s[1]), display: s[1] + '/' + s[2] + (t ? ' · top ' + t[1] + '%' : '') };
    },
  },
    //catfishing
  {
    name: 'catfishing',
    re: /catfishing\.net\s+#(\d+)/gi,
    parse: (b, m) => {
      const s = b.match(/-\s*(\d+|X)\s*\/\s*(\d+)/i);
      if (!s) return null;
      const max = Number(s[2]);
      const fail = /x/i.test(s[1]);
      return { game: 'catfishing', puzzle: Number(m[1]), score: fail ? max + 1 : Number(s[1]), display: s[1].toUpperCase() + '/' + max, fail };
    },
  },
    // Daily Red #16: Beat Red  \n 🟩🟩⬛⬛⬛🟩  3/6 left · 15 turns
    {
      name: 'daily-color',
      re: /Daily\s+([A-Za-z]+)\s*#(\d+)\s*:\s*(?:Beat|[A-Za-z]+\s+won)/gi,
      parse: (b, m) => {
        const turns = b.match(/(\d+)\s*turns?/i);
        const t = turns ? Number(turns[1]) : 0;
        const left = b.match(/(\d+)\s*\/\s*(\d+)\s*left/i);
        const ko = b.match(/(\d+)\s*\/\s*(\d+)\s*KO/i);
        let score, display;
        if (left) {
          score = Number(left[1]); // win: lives left, higher is better
          display = `${left[1]}/${left[2]} left \u00b7 ${t} turns`;
        } else if (ko) {
          score = 0; // "<Color> won" = a loss
          display = `Lost \u00b7 ${ko[1]}/${ko[2]} KO'd \u00b7 ${t} turns`;
        } else return null;
        return {
          game: 'daily-' + m[1].toLowerCase(),
          gameName: 'Daily ' + cap(m[1]),
          puzzle: Number(m[2]),
          score,
          tie: t, // fewer turns breaks ties
          display,
        };
      },
    },

    // Connections \n Puzzle #123 \n 🟨🟨🟨🟨 ...
    {
      name: 'connections',
      re: /Connections\s+Puzzle\s*#?([\d,]+)/gi,
      parse: (b, m) => {
        const rows = [...b.matchAll(/^[ \t]*([\u{1F7E8}\u{1F7E9}\u{1F7E6}\u{1F7EA}]{4})[ \t]*$/gmu)].map((x) =>
          Array.from(x[1])
        );
        if (!rows.length) return null;
        const solved = rows.filter((r) => r.every((c) => c === r[0])).length;
        const mistakes = rows.length - solved;
        const fail = solved < 4;
        return {
          game: 'connections',
          puzzle: num(m[1]),
          score: fail ? 5 : mistakes,
          display: fail ? 'FAILED' : mistakes === 0 ? 'PERFECT' : mistakes + (mistakes === 1 ? ' mistake' : ' mistakes'),
          fail,
        };
      },
    },

    // Daily Quordle 1234 \n 4️⃣5️⃣ \n 6️⃣🟥
    {
      name: 'quordle',
      re: /Daily Quordle\s*#?(\d+)/gi,
      parse: (b, m) => {
        const digits = [...b.matchAll(/([1-9])\uFE0F?\u20E3/g)].map((x) => Number(x[1]));
        const reds = (b.match(/\u{1F7E5}/gu) || []).length;
        if (!digits.length && !reds) return null;
        const total = digits.reduce((a, n) => a + n, 0) + reds * 10;
        return {
          game: 'quordle',
          puzzle: Number(m[1]),
          score: total,
          display: total + ' guesses' + (reds ? ' (' + reds + ' missed)' : ''),
          fail: reds > 0,
        };
      },
    },

    // Strands #988 \n "Theme" \n 🔵💡🔵🟡 ...   (score = number of 💡 hints, lower wins)
    {
      name: 'strands',
      re: /Strands\s+#(\d+)/gi,
      parse: (b, m) => {
        const hints = (b.match(/\u{1F4A1}/gu) || []).length;
        return {
          game: 'strands',
          puzzle: Number(m[1]),
          score: hints,
          display: hints === 0 ? 'No hints' : hints + (hints === 1 ? ' hint' : ' hints'),
        };
      },
    },

    // Daily Dordle 1757 3&5/7   (score = total guesses across both boards, lower wins)
    {
      name: 'dordle',
      re: /Daily Dordle\s+#?([\d,]+)\s+([1-9X])\s*&\s*([1-9X])\s*\/\s*(\d+)/gi,
      parse: (b, m) => {
        const max = Number(m[4]);
        const g = [m[2], m[3]].map((x) => (/x/i.test(x) ? max + 1 : Number(x)));
        const fail = /x/i.test(m[2] + m[3]);
        const total = g[0] + g[1];
        return {
          game: 'dordle',
          puzzle: num(m[1]),
          score: total,
          tie: Math.max(g[0], g[1]),
          display: `${m[2].toUpperCase()}&${m[3].toUpperCase()}/${max}`,
          fail,
        };
      },
    },
    
    // #Worldle #1760 (16.11.2026) 3/6 (100%)
    {
      name: 'worldle',
      re: /#?Worldle\s+#?([\d,]+)[^\n]*?\s([1-6X])\/6/gi,
      parse: (b, m) => {
        const fail = /x/i.test(m[2]);
        return {
          game: 'worldle',
          puzzle: num(m[1]),
          score: fail ? 7 : Number(m[2]),
          display: (fail ? 'X' : m[2]) + '/6',
          fail,
        };
      },
    },

    // maptap.gg November 16 \n 87🎓 75😂 ... \n Final score: 651   (higher wins)
    {
      name: 'maptap',
      re: /maptap\.gg\)?[^\n]*/gi,
      parse: (b) => {
        const f = b.match(/Final score:\s*([\d,]+)/i);
        if (!f) return null;
        return { game: 'maptap', puzzle: null, score: num(f[1]), display: fmtInt(num(f[1])) + ' pts' };
      },
    },
    
    // 🌎 Nov 16, 2026 🌍 \n 🔥 1 | Avg. Guesses: 14 \n ...🟩 = 14   (lower wins)
    {
      name: 'globle',
      re: /(?:[\u{1F30D}-\u{1F30F}][^\n]*\n)?[^\n]*Avg\.?\s*Guesses[^\n]*/giu,
      parse: (b) => {
        const g = b.match(/=\s*(\d+)/);
        if (!g) return null;
        return { game: 'globle', puzzle: null, score: Number(g[1]), display: g[1] + ' guesses' };
      },
    },
    
    // I played contexto.me 11/16/2026 and got it in 82 guesses and 2 hints.   (lower wins)
    {
      name: 'contexto',
      re: /contexto\.me[^\n]*?got it in\s+(\d+)\s+guesses?(?:\s+and\s+(\d+)\s+hints?)?/gi,
      parse: (b, m) => {
        const hints = m[2] ? Number(m[2]) : 0;
        return {
          game: 'contexto',
          puzzle: null,
          score: Number(m[1]),
          tie: hints,
          display: m[1] + ' guesses' + (hints ? ` \u00b7 ${hints} ${hints === 1 ? 'hint' : 'hints'}` : ''),
        };
      },
    },
    
    // Nerdle
    {
      name: 'nerdle',
      re: /nerdlegame\s+(\d+)\s+(\d+|X)\s*\/\s*(\d+)/gi,
      parse: (b, m) => {
        const max = Number(m[3]);
        const fail = /x/i.test(m[2]);
        return { game: 'nerdle', puzzle: Number(m[1]), score: fail ? max + 1 : Number(m[2]), display: m[2].toUpperCase() + '/' + max, fail };
      },
    },

    // Generic tries-style fallback: "Nerdle 123 4/6", "Worldle #900 X/6" ...
    {
      name: 'generic-tries',
      generic: true,
      re: /^[ \t]*([A-Za-z][A-Za-z0-9'&. -]{1,28}?)\s*#?\s*([\d,]+)\s+([1-9X])\/(\d{1,2})\*?/gim,
      parse: (b, m) => {
        const name = m[1].trim();
        const id = slug(name);
        if (!id) return null;
        const fail = /x/i.test(m[3]);
        const max = Number(m[4]);
        return {
          game: id,
          gameName: name,
          puzzle: num(m[2]),
          score: fail ? max + 1 : Number(m[3]),
          display: (fail ? 'X' : m[3]) + '/' + max,
          fail,
        };
      },
    },
  ];

  function parseAll(text) {
    text = String(text || '').replace(/\r\n?/g, '\n');
    const heads = [];
    for (const p of PARSERS) {
      for (const m of text.matchAll(p.re)) {
        heads.push({ p, m, start: m.index, end: m.index + m[0].length });
      }
    }
    const specific = heads.filter((h) => !h.p.generic);
    const kept = heads.filter(
      (h) => !h.p.generic || !specific.some((s) => s.start < h.end && h.start < s.end)
    );
    kept.sort((a, b) => a.start - b.start);

    const out = [];
    kept.forEach((h, i) => {
      const stop = i + 1 < kept.length ? kept[i + 1].start : text.length;
      const block = text.slice(h.start, stop).trim();
      let r = null;
      try {
        r = h.p.parse(block, h.m);
      } catch (e) {
        r = null;
      }
      if (r) {
        r.raw = block;
        out.push(r);
      }
    });
    return out;
  }

  const api = { parseAll, PARSERS, slug };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Parsers = api;
})(typeof window !== 'undefined' ? window : globalThis);
