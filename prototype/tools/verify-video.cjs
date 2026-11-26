'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { findPlaywright, findBrowser } = require('./render.cjs');

async function main() {
  const root = path.resolve(__dirname, '..');
  const browser = await findPlaywright().api.chromium.launch({ executablePath: findBrowser(), headless: true, args: ['--force-color-profile=srgb'] });
  const report = { file: 'transformer-in-motion.mp4', decodedFrames: [], errors: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    page.on('pageerror', (error) => report.errors.push(error.message));
    await page.goto(pathToFileURL(path.join(root, 'tools/probe.html')).href);
    report.metadata = await page.evaluate(async (url) => {
      document.body.replaceChildren();
      document.body.style.cssText = 'margin:0;overflow:hidden;background:black';
      const video = document.createElement('video');
      video.id = 'verification-video';
      video.style.cssText = 'display:block;width:1920px;height:1080px';
      video.preload = 'auto';
      video.src = url;
      document.body.append(video);
      await new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = () => reject(new Error('MP4 decoding failed')); });
      return { width: video.videoWidth, height: video.videoHeight, duration: video.duration };
    }, pathToFileURL(path.join(root, 'transformer-in-motion.mp4')).href);
    for (const frame of [192, 447, 750, 1005]) {
      const timestamp = await page.evaluate(async (frame) => {
        const video = document.getElementById('verification-video');
        video.currentTime = (frame + 0.05) / 30;
        await new Promise((resolve, reject) => { video.onseeked = resolve; video.onerror = () => reject(new Error('Seek failed')); });
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
        return video.currentTime;
      }, frame);
      const filename = `video-${String(frame).padStart(4, '0')}.png`;
      await page.screenshot({ path: path.join(root, 'frames', filename) });
      report.decodedFrames.push({ frame, timestamp, file: 'frames/' + filename });
    }
    fs.writeFileSync(path.join(root, 'video-verification.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
