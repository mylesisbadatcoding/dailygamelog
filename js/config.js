/*
 * rank2.day settings. Edit this file, commit, done.
 *
 * firebaseUrl:    Realtime Database URL.
 * firebaseApiKey: the Web API key of the same Firebase project
 *                 (Console > Project settings > General > Web API Key).
 *                 It is not a secret; the database rules are what protect data.
 *                 Email/Password sign-in must be enabled under Authentication.
 * adminUsername:  this username gets the admin role when its account is created or
 *                 claimed. Keep it in sync with the 'myles' check in firebase-rules.json.
 * allCrew:        the built-in crew code that shows every account.
 */
window.PIXELRANK_CONFIG = {
  title: 'rank2.day',
  firebaseUrl: 'https://dailygamelog-bd048-default-rtdb.firebaseio.com/',
  firebaseApiKey: '',
  adminUsername: 'myles',
  allCrew: 'all',
  points: [3, 2, 1],    // points for 1st, 2nd, 3rd place per game per day
  refreshSeconds: 30,   // how often the board re-checks for new scores
};
