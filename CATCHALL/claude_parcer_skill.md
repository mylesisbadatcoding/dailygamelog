---
name: add-game-parser
description: Add a new daily-game share-text parser and game rule to the rank2.day leaderboard site. Use when the user pastes an example share result and asks for a parser for that game.
---
 
# Add a game parser to rank2.day
 
The site is a static GitHub Pages repo (`js/parsers.js`, `js/games.js`). The user pastes an example share text, sometimes with the scoring rule ("count the lightbulbs, lower wins"). Reply with snippets only.
 
## Output rules
- Give only the lines to add. Never regenerate whole files, rebuild the zip, or send file cards unless asked.
- Two snippets, each labeled with its file path:
  1. `js/parsers.js`: new object inside `PARSERS`, above the `// Generic tries-style fallback` entry.
  2. `js/games.js`: new entry inside `GAMES`.
- After the snippets, add 2-3 short bullets: what the example parses to (puzzle, score), the win direction, and any guess made.
- If the user says an existing parser is broken, give a full replacement for that parser object only.
- Keep it brief, no filler or affirmations. Link the game's official site when it is known.
## Parser conventions
Helpers available in `parsers.js`: `num`, `fmtInt`, `firstLine`, `cap`, `mmss`, `slug`.
 
```js
{
  name: 'mygame',
  re: /MyGame\s+#(\d+)/gi,      // matches the header; needs the g flag
  parse: (b, m) => {            // b = text from this header to the next game's header, m = header match
    ...
    return { game: 'mygame', puzzle: Number(m[1]), score, tie, display, fail };
  },
},
```
 
- Return `null` if the score can't be found.
- `game`: lowercase id, matches the key in `GAMES`.
- `puzzle`: puzzle number, or `null` for date-based games with no number (the site logs by the date selected in the UI).
- `score`: the number that ranks players. `display`: the text shown on the tile.
- `tie`: optional tiebreaker, lower wins (turns, hints, worse board).
- `fail`: true on a failed or given-up result. Score a failure as max tries + 1.
- Anchor `re` on a stable header or a distinctive line. Emoji is fragile, so only use it when nothing else is stable.
- Multi-board games (Dordle style): score is the total guesses, `tie` is the worse board.
## games.js entry
```js
mygame: { name: 'My Game', icon: '🎯', higher: false, fmt: 'int', url: 'https://example.com' },
```
- `higher: true` if bigger wins, `false` if smaller wins.
- `fmt` is optional: `'int'`, `'time'`, or `'money'`, used for averages.
## Verify before replying
1. Copy the current `parsers.js` to the scratchpad and insert the new parser above the generic fallback. Do not edit the repo copy.
2. Run `parseAll` from the copy under node on:
   - the example alone,
   - the example plus the other pasted games in one blob,
   - the example mixed with an existing parser's sample (for example Wordle),
   - the failure case, if its format is known.
3. Confirm the generic parser doesn't double-match and neighbors still parse. Report only what was actually run.
## Scoring defaults
- Tries-style games: lower wins, X counts as max + 1.
- Points, time, distance: whichever direction the user states or the game implies. State the guess in a bullet.
- If a failure format is unknown, say so and ask for a sample.
