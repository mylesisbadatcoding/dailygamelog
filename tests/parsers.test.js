// Run with: node tests/parsers.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { parseAll } = require('../js/parsers.js');

const sample = fs.readFileSync(path.join(__dirname, 'sample.txt'), 'utf8');
const res = parseAll(sample);
const by = Object.fromEntries(res.map((r) => [r.game, r]));

const expect = {
  noillirk: { puzzle: 51, score: 5713 },
  wordle: { puzzle: 1975, score: 3 },
  costcodle: { puzzle: 6, score: 46.39 },
  scale: { score: 454 },
  krillion: { puzzle: 123, score: 465 },
  nytmini: { score: 16 },
  'daily-red': { puzzle: 16, score: 3, tie: 15 },
  'daily-blue': { puzzle: 10, score: 6, tie: 12 },
  'daily-lance': { puzzle: 1, score: 2, tie: 15 },
};
for (const [g, want] of Object.entries(expect)) {
  assert.ok(by[g], 'missing game: ' + g);
  for (const [k, v] of Object.entries(want)) assert.strictEqual(by[g][k], v, `${g}.${k}`);
}
assert.strictEqual(res.length, Object.keys(expect).length, 'unexpected extra results: ' + res.map((r) => r.game));

// individual pastes
assert.strictEqual(parseAll('Wordle 1,975 X/6*')[0].score, 7);
assert.strictEqual(parseAll('NYT mini: 1:05')[0].score, 65);
const conn = parseAll('Connections\nPuzzle #500\n🟨🟨🟨🟨\n🟩🟩🟦🟩\n🟩🟩🟩🟩\n🟦🟦🟦🟦\n🟪🟪🟪🟪')[0];
assert.strictEqual(conn.score, 1);
const nerdle = parseAll('Nerdle 812 4/6\n⬛⬛')[0];
assert.strictEqual(nerdle.game, 'nerdle');
assert.strictEqual(nerdle.score, 4);
const str = parseAll('Strands #988\n\u201cWhat\'s the big idea?\u201d\n🔵💡🔵🟡\n🔵🔵🔵🔵')[0];
assert.strictEqual(str.game, 'strands');
assert.strictEqual(str.puzzle, 988);
assert.strictEqual(str.score, 1);
assert.strictEqual(parseAll('Strands #1\n🔵🔵🔵')[0].score, 0);
assert.strictEqual(parseAll('hello world').length, 0);

console.log('OK - ' + res.length + ' results parsed from sample');
res.forEach((r) => console.log(' ', r.game.padEnd(12), String(r.puzzle).padEnd(5), r.display));
