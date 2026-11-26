'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// The browser and all output formats share the authored time base.
const source = fs.readFileSync(path.resolve(__dirname, '../timeline.js'), 'utf8');
const film = JSON.parse(vm.runInNewContext(source + `
  JSON.stringify({...filmSettings, shots: plates.map(({id, start})=>({id, start}))})
`, {}, {timeout: 1000}));
const frames = Math.round(film.fps * film.duration);
if (!(frames > 0 && film.shots.length && film.shots[0].start === 0)) {
  throw new Error('Invalid timeline or settings.');
}
const reviewFrames = film.reviewSeconds.map(s=>Math.round(s * film.fps));
if (reviewFrames.some(n=>n<0 || n>=frames)) throw new Error('A review time is outside the film.');
module.exports = { film, frames, reviewFrames, outputName:'transformer-4min-1440p60.mp4' };
