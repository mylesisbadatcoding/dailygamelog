/*
 * PIXEL RANK settings. Edit this file, commit, done.
 *
 * firebaseUrl: leave '' for LOCAL-ONLY mode (data lives in this browser).
 *   To share one leaderboard between friends, paste a Firebase Realtime
 *   Database URL here (see README -> "Share scores with friends").
 *   Example: 'https://my-pixel-rank-default-rtdb.firebaseio.com'
 */
window.PIXELRANK_CONFIG = {
  title: 'PIXEL RANK',
  firebaseUrl: 'https://dailygamelog-bd048-default-rtdb.firebaseio.com/',
  defaultGroup: 'home', // crew code used when the field is left blank
  points: [3, 2, 1],    // points for 1st, 2nd, 3rd place per game per day
  refreshSeconds: 30,   // how often shared mode re-checks for new scores
};
