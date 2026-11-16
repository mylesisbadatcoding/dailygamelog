# PIXEL RANK

An 8-bit daily game leaderboard. Paste the "share" text from Wordle, Krillion, Costcodle and friends; it figures out the game and score, ranks everyone, and keeps a history.

Pure static site (HTML/CSS/JS, no build step), so it hosts free on GitHub Pages.

## Features

- **Username login**: no password. A new name creates a new save file.
- **Paste anything**: one game or a whole pile at once. The parser finds each game's header and reads its score.
- **Daily board**: per-game rankings with 🥇🥈🥉 and points, plus a day leaderboard.
- **Archive panels**: all-time standings, day-by-day history, a cumulative points chart, per-game bests/averages, JSON export/import.
- **Games drawer**: a pop-out list of daily game links (`js/links.js`).
- **Works offline / solo**: data is saved in the browser by default.
- **Shared mode (optional)**: add a free Firebase Realtime Database URL so friends see the same board.

## Deploy to GitHub Pages

1. Create a new GitHub repo and push these files to `main`.
2. Repo **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, folder = `/ (root)`.
3. Wait a minute. Your site is at `https://<you>.github.io/<repo>/`.

Run locally: open `index.html`, or `npx serve .`.

## Share scores with friends (important)

GitHub Pages is static, so by default each browser keeps its own data. To share one leaderboard:

1. Go to <https://console.firebase.google.com>, create a project (free Spark plan).
2. **Build → Realtime Database → Create database** (any region, start in locked mode).
3. Open the **Rules** tab and paste the contents of `firebase-rules.json`, then Publish.
4. Copy the database URL (looks like `https://xxxx-default-rtdb.firebaseio.com`).
5. Put it in `js/config.js` as `firebaseUrl`, commit, push.
6. Everyone logs in with their own username and the **same crew code**.

Those rules are open: anyone who has your database URL and crew code could read or write scores. That fits a friends game. Do not put anything private in here.

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
| Quordle | total guesses | lowest |
| Anything like `Name 123 4/6` | tries | lowest |

Wrong direction for a game? Flip `higher` in `js/games.js`. Krillion and Costcodle are the two I was least sure of.

## Add a new game

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
assets/             logo, favicon, low-poly header
tests/              parser tests (npm test)
firebase-rules.json database rules to paste
```

## Notes

- Dates are your local date. Use the date picker to log a missed day.
- Pasting the same game twice on the same date replaces your earlier score.
- Back up with **DATA → EXPORT JSON**.
