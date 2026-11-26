'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createHash } = require('node:crypto');
const { findPlaywright, findBrowser } = require('./environment.cjs');
const { film, reviewFrames, outputName } = require('./production.cjs');
const { inspectMovie } = require('./mp4-mux.cjs');
const ROOT = path.resolve(__dirname, '..');
async function main() {
  const browser = await findPlaywright().api.chromium.launch({ executablePath: findBrowser(), headless: true, args: ['--force-color-profile=srgb'] });
  const report = { file: outputName, decodedFrames: [], errors: [] };
  try {
    const page = await browser.newPage({ viewport: { width: film.width, height: film.height }, deviceScaleFactor: 1 });
    page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(pathToFileURL(path.join(__dirname, 'probe.html')).href);
    report.metadata = await page.evaluate(async url => {
      const video = document.createElement('video'); video.id = 'verification-video';
      video.style.cssText = 'display:block;width:100vw;height:100vh'; video.preload = 'auto'; video.src = url;
      document.body.replaceChildren(video); document.body.style.cssText = 'margin:0;overflow:hidden;background:black';
      await new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = () => reject(new Error('MP4 decoding failed')); });
      return { width: video.videoWidth, height: video.videoHeight, duration: video.duration };
    }, pathToFileURL(path.join(ROOT,outputName)).href);
    report.index = inspectMovie(path.join(ROOT,outputName)).facts;
    if(report.index.video.fps!==film.fps || report.index.video.frames!==film.duration*film.fps ||
      report.index.video.width!==film.width || report.index.video.height!==film.height)throw new Error('Native video format mismatch');
    fs.mkdirSync(path.join(ROOT, 'frames'), { recursive: true });
    const seek=frame=>page.evaluate(async time => {
        const video = document.getElementById('verification-video'); video.currentTime = time;
        await new Promise((resolve, reject) => { video.onseeked = resolve; video.onerror = () => reject(new Error('Seek failed')); });
        await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); return video.currentTime;
      }, (frame + .05) / film.fps);
    for (const frame of reviewFrames) {
      const timestamp=await seek(frame);
      const filename = `video-${String(frame).padStart(4, '0')}.png`;
      await page.screenshot({ path: path.join(ROOT, 'frames', filename) }); report.decodedFrames.push({ frame, timestamp, file: 'frames/' + filename });
    }
    // In addition to the 60 fps sample table, inspect decoded neighboring
    // pictures in a moving shot to detect duplicated 30-to-60 export frames.
    const motion=film.shots.find(s=>s.id==='rope');
    const first=Math.round((motion.start+2.1)*film.fps);
    report.adjacentMotionFrames=[];
    for(let frame=first;frame<first+6;frame++){
      const t=await seek(frame);
      const png=await page.screenshot();
      report.adjacentMotionFrames.push({frame,seconds:t,sha256:createHash('sha256').update(png).digest('hex')});
    }
    if(new Set(report.adjacentMotionFrames.map(f=>f.sha256)).size!==6)throw new Error('Unexpected repeated pictures in the rotating position shot.');
    fs.writeFileSync(path.join(ROOT, 'video-verification.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
    if (report.errors.length) throw new Error(report.errors.join('; '));
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e.stack || e); process.exitCode = 1; });
