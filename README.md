# daily.my1es.com
- A leaderboard for friends to share their daily games scores. No more threads full of copy paste nonsense.
- Paste the "share" text from Wordle, Krillion, Costcodle and friends; it figures out the game and score, ranks everyone, and keeps a history.
- The site is static so we can use Github pages (weeee)

## TODO
- [ ] fix nerdle _ game file is off, maybe i forgot to add it
- [ ] fix geozee _ the percentile raking is wrong, we can remove it.

## Features

- **Username login**: no password. A new name creates a new save file.
- **Paste anything**: one game or a whole pile at once. The parser finds each game's header and reads its score.
- **Daily board**: per-game rankings with 🥇🥈🥉 and points, plus a day leaderboard.
- **Archive panels**: all-time standings, day-by-day history, a cumulative points chart, per-game bests/averages, JSON export/import.
- **Games drawer**: a pop-out list of daily game links (`js/links.js`).
- **Works offline / solo**: data is saved in the browser by default.

## Quick facts:
- Run locally: open `index.html`, or `npx serve .`.
- you can use: https://htmlpreview.github.io/? before the index.html url to fast render any changes (like if you are working on a branch or something)
- the realtime database rules are incredibly lax at the moment


## Scoring

Per game, per day, players are ranked (ties share a rank). With 2+ players on a game: 1st = 3 pts, 2nd = 2, 3rd = 1 (`points` in `js/config.js`). A game played by one person scores no points.

| Game | Parsed from | Winner |
| --- | --- | --- |
| Noillirk | meters | highest |
| Wordle | tries (X = 7) | lowest |
| Costcodle | total dollars off | lowest |
| Scale of Things | score / 1,000 | highest |
| Krillion | points | highest |
| NYT Mini | time | lowest |
| Daily Red / Blue / Lance | lives left, then fewer turns | highest |
| Connections | mistakes (fail = 5) | lowest |
| Strands | hints used (💡 count) | lowest |
| Quordle | total guesses | lowest |
| Anything like `Name 123 4/6` | tries | lowest |

Wrong direction for a game? Flip `higher` in `js/games.js`. Krillion and Costcodle are the two I was least sure of.

## Add a new game

I made a claude skill that does this well, i just need to add it to the repo.

In `js/parsers.js`, add to `PARSERS`:

```js
{
  name: 'mygame',
  re: /MyGame\s+#(\d+)/gi,            // finds the header line
  parse: (block, m) => ({             // block = text until the next game
    game: 'mygame', puzzle: Number(m[1]),
    score: Number(block.match(/Score:\s*(\d+)/)[1]),
    display: 'Score ' + block.match(/Score:\s*(\d+)/)[1],
  }),
}
```

Then add its entry to `GAMES` in `js/games.js` (name, icon, `higher`). Add a sample to `tests/sample.txt` and run `npm test`.

## Files

```
index.html          page
css/style.css       8-bit theme
js/config.js        settings (Firebase URL, points)
js/parsers.js       share-text parsing engine
js/games.js         per-game rules and display
js/links.js         game directory for the drawer
js/storage.js       localStorage + Firebase sync
js/app.js           UI and leaderboard logic
assets/             logo and favicon
tests/              parser tests (npm test)
firebase-rules.json database rules to paste
```

## Notes

- Dates are your local date. Use the date picker to log a missed day.
- Pasting the same game twice on the same date replaces your earlier score.
- Back up with **DATA → EXPORT JSON**.
