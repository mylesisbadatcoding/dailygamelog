# rank2.day
- A leaderboard for friends to share their daily games scores. No more threads full of copy paste nonsense.
- Paste the "share" text from Wordle, Krillion, Costcodle and friends; it figures out the game and score, ranks everyone, and keeps a history.
- The site is static so we can use Github pages (weeee)

## TODO
- [ ] fix nerdle _ game file is off, maybe i forgot to add it
  - [ ] this is done, but need to backfill data that was logged wrong
- [ ] fix geozee _ the percentile raking is wrong, we can remove it.
- [ ] fix noillirk _ wont accept stink's perfect score
- [ ] 4x3 doesnt except failures
  - [ ] Example: November 26, 2026
Out of guesses • 3 mistakes
🟨🟨🌟
🟩🟨🟩
🟪🟪🟨
🟪🟨🟪
https://4x3.fun

## Features

- **Accounts**: username + email + password (Firebase Authentication). Every username shows up around the login box so nobody forgets theirs. Old accounts without an email/password are asked to set one up the first time they log in.
- **Crew codes are per account**: log in once, then add or switch crew codes from the CREW button. `all` shows everyone; any other code shows only accounts that saved it.
- **Roles**: `player` or `admin`. The `myles` account is the admin (`adminUsername` in `js/config.js`). Admins can change roles and run the legacy data import from the account popup.
- **Paste anything**: one game or a whole pile at once. The parser finds each game's header and reads its score.
- **Daily board**: per-game rankings with 🥇🥈🥉 and points, plus a day leaderboard.
- **Archive panels**: all-time standings, day-by-day history, a cumulative points chart, per-game bests/averages, JSON export/import.
- **Games drawer**: a pop-out list of daily game links (`js/links.js`).
- **Offline fallback**: the last loaded board is cached in the browser, but you need the database to log in and save.

## Quick facts:
- Run locally: open `index.html`, or `npx serve .`.
- you can use: https://htmlpreview.github.io/? before the index.html url to fast render any changes (like if you are working on a branch or something)
- database rules live in `CATCHALL/firebase-rules.json` (paste into Realtime Database > Rules)
- `npm run test:accounts` runs the account flow against a fake in-memory Firebase


## Accounts setup (one time)

1. Firebase console > Authentication > Sign-in method > enable **Email/Password**.
2. Project settings > General > copy the **Web API key** into `firebaseApiKey` in `js/config.js` (not a secret; the rules protect the data).
3. Realtime Database > Rules: paste `CATCHALL/firebase-rules.json` and publish.
4. Open the site, enter `myles`, and fill in an email + password to claim it. Do this first: whoever claims `myles` first becomes admin.
5. Account popup (click your name) > ADMIN > **IMPORT LEGACY DATA**. Every old name appears on the login screen with a dashed `!` chip, and its owner sets an email + password on first login. Old crews become crew codes on those accounts.

Notes:
- Crew codes are a view filter, not a privacy wall: any signed-in account can read all scores.
- Usernames are fixed once claimed (scores are keyed by them). Email and password can be changed in the account popup.
- To log in by username the site reads that username's email from `loginEmail/<username>`, so anyone who knows a username can look up its email. That is what makes username login and password-reset emails work.
- Forgot password: FORGOT PASSWORD? on the login screen emails a reset link.

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
js/storage.js       Firebase Auth + Realtime Database (REST)
js/app.js           UI and leaderboard logic
assets/             logo and favicon
tests/              parser tests (npm test), account flow tests (npm run test:accounts)
CATCHALL/firebase-rules.json  database rules to paste
```

## Notes

- Dates are your local date. Use the date picker to log a missed day.
- Pasting the same game twice on the same date replaces your earlier score.
- Back up with **DATA → EXPORT JSON**.
