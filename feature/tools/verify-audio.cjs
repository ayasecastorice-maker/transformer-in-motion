'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { findPlaywright, findBrowser } = require('./environment.cjs');
const { film, outputName } = require('./production.cjs');
const { inspectMovie } = require('./mp4-mux.cjs');
const ROOT = path.resolve(__dirname, '..');
async function main() {
  const sample = process.argv.includes('--sample');
  const filename = sample ? 'tools/av-sample.mp4' : outputName;
  const duration = sample ? 6 : film.duration;
  const { api } = findPlaywright();
  const browser = await api.chromium.launch({ executablePath: findBrowser(), headless: true });
  try {
    const page = await browser.newPage(); await page.goto(pathToFileURL(path.join(__dirname, 'probe.html')).href);
    await page.addScriptTag({ path: path.join(ROOT, 'score.js') });
    const result = await page.evaluate(async ({ base64, duration, film }) => {
      const bytes = Uint8Array.fromBase64 ? Uint8Array.fromBase64(base64) : Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const context = new AudioContext({ sampleRate: 48000 });
      const decoded = await context.decodeAudioData(bytes.buffer);
      const reference = window.TransformerScore.render({ duration, film });
      const actual = decoded.getChannelData(0), original = reference.channels[0];
      const begin = 14400, end = Math.min(original.length - 4096, 7 * 48000);
      function correlation(lag) {
        let xy = 0, xx = 0, yy = 0;
        for (let i = begin; i < end; i += 4) { const x = original[i], y = actual[i + lag] || 0; xy += x * y; xx += x * x; yy += y * y; }
        return xy / Math.sqrt(xx * yy);
      }
      let bestLag = 0, best = -1;
      for (let lag = -2048; lag <= 2048; lag += 16) { const score = correlation(lag); if (score > best) { best = score; bestLag = lag; } }
      const coarse = bestLag;
      for (let lag = coarse - 15; lag <= coarse + 15; lag++) { const score = correlation(lag); if (score > best) { best = score; bestLag = lag; } }
      const chapterSync=film.shots.filter(s=>s.start+2<duration).map(shot=>{
        const first=Math.round((shot.start+.5)*48000);
        const until=Math.min(first+48000*3,actual.length);
        let ab=0,aa=0,bb=0;
        for(let i=first;i<until;i+=4){
          const a=original[i],b=actual[i];ab+=a*b;aa+=a*a;bb+=b*b;
        }
        return {id:shot.id, time:shot.start+.5, correlation:ab/Math.sqrt(aa*bb)};
      });
      let power = 0, peak = 0, tailPower = 0;
      for (let i = 0; i < actual.length; i++) { power += actual[i] * actual[i]; peak = Math.max(peak, Math.abs(actual[i])); if (i > actual.length - 24000) tailPower += actual[i] * actual[i]; }
      await context.close();
      return { duration: decoded.duration, sampleRate: decoded.sampleRate, channels: decoded.numberOfChannels, sampleFrames: decoded.length, rms: Math.sqrt(power / actual.length), peak, lastHalfSecondRms: Math.sqrt(tailPower / 24000), bestCorrelation: best, bestLagSamples: bestLag, bestLagMilliseconds: bestLag / 48, zeroLagCorrelation: correlation(0), chapterSync };
    }, { base64: inspectMovie(path.join(ROOT, filename)).audioFile.toString('base64'), duration, film });
    fs.writeFileSync(path.join(ROOT, sample ? 'tools/sample-audio-check.json' : 'audio-verification.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
    if (result.channels !== 2 || result.sampleRate !== 48000 || Math.abs(result.duration - duration) > .03 || result.rms < .005 || result.bestCorrelation < .9 || Math.abs(result.bestLagSamples) > 1536 || result.chapterSync.some(s=>s.correlation<.90)) throw new Error('Decoded MP4 audio did not meet validation bounds.');
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e.stack || e); process.exitCode = 1; });
