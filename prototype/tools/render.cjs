'use strict';

// Render the authored Canvas2D film using only an existing local browser.
// Browser automation uses Playwright's pipe and isolated temporary profile.
// Local file URLs avoid opening any server or network/debugging port.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const { muxAvcMp4 } = require('./mp4-mux.cjs');

const ROOT = path.resolve(__dirname, '..');
const WIDTH = 1920, HEIGHT = 1080, FPS = 30, TOTAL_FRAMES = 1080;
const STILL_FRAMES = [192, 447, 750, 1005];

const { findPlaywright, findBrowser } = require('../../feature/tools/environment.cjs');

async function codecProbe(page) {
  return page.evaluate(async () => {
    if (!('VideoEncoder' in window)) return { available: false, reason: 'VideoEncoder is unavailable on this browser/origin.' };
    const results = [];
    for (const hardwareAcceleration of ['prefer-hardware', 'prefer-software', 'no-preference']) {
      const config = { codec: 'avc1.640028', width: 1920, height: 1080, framerate: 30, bitrate: 8000000, latencyMode: 'realtime', hardwareAcceleration, avc: { format: 'avc' } };
      let encoder;
      try {
        const support = await VideoEncoder.isConfigSupported(config);
        if (!support.supported) { results.push({ hardwareAcceleration, supported: false }); continue; }
        let encodedBytes = 0, hasDecoderConfig = false, encoderError = null, colorSpace = null;
        encoder = new VideoEncoder({
          output: (chunk, metadata) => { encodedBytes += chunk.byteLength; hasDecoderConfig ||= !!metadata?.decoderConfig?.description; colorSpace = metadata?.decoderConfig?.colorSpace || colorSpace; },
          error: (error) => { encoderError = String(error); },
        });
        encoder.configure(config);
        const canvas = document.createElement('canvas');
        canvas.width = 1920; canvas.height = 1080;
        canvas.getContext('2d').fillRect(0, 0, 1920, 1080);
        const frame = new VideoFrame(canvas, { timestamp: 0, duration: 33333 });
        encoder.encode(frame, { keyFrame: true });
        frame.close();
        await encoder.flush();
        if (encoderError || !encodedBytes || !hasDecoderConfig) throw new Error(encoderError || 'No AVC chunk/config emitted');
        results.push({ hardwareAcceleration, supported: true, encodedBytes, hasDecoderConfig, colorSpace });
      } catch (error) { results.push({ hardwareAcceleration, supported: false, error: error.message }); }
      finally { if (encoder && encoder.state !== 'closed') encoder.close(); }
    }
    return { available: true, h264: results };
  });
}

async function encodeFilm(page, preference) {
  await page.exposeFunction('__reportRenderProgress', (frame, total) => {
    console.log(`Encoded input ${frame}/${total} (${Math.round(frame / total * 100)}%)`);
  });
  return page.evaluate(async ({ fps, total, width, height, preference }) => {
    const source = document.getElementById('film');
    if (!(source instanceof HTMLCanvasElement)) throw new Error('Expected a Canvas2D element with id="film".');
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = height;
    const exportContext = exportCanvas.getContext('2d', { alpha: false });
    const chunks = [];
    let decoderDescription = null, encoderError = null, colorSpace = null;
    const encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        chunks.push({ data, type: chunk.type, timestamp: chunk.timestamp });
        if (metadata?.decoderConfig?.description) decoderDescription = new Uint8Array(metadata.decoderConfig.description).slice();
        if (metadata?.decoderConfig?.colorSpace) colorSpace = metadata.decoderConfig.colorSpace;
      },
      error: (error) => { encoderError = String(error); },
    });
    encoder.configure({ codec: 'avc1.640028', width, height, framerate: fps, bitrate: 8000000, latencyMode: 'realtime', hardwareAcceleration: preference, avc: { format: 'avc' } });
    for (let frame = 0; frame < total; frame++) {
      if (encoderError) throw new Error(encoderError);
      await window.seekFrame(frame);
      exportContext.fillStyle = '#000';
      exportContext.fillRect(0, 0, width, height);
      exportContext.drawImage(source, 0, 0, width, height);
      const timestamp = Math.round(frame * 1000000 / fps);
      const duration = Math.round((frame + 1) * 1000000 / fps) - timestamp;
      const videoFrame = new VideoFrame(exportCanvas, { timestamp, duration });
      encoder.encode(videoFrame, { keyFrame: frame % (fps * 2) === 0 });
      videoFrame.close();
      if (encoder.encodeQueueSize > 12) await encoder.flush();
      if ((frame + 1) % 120 === 0) await window.__reportRenderProgress(frame + 1, total);
    }
    await encoder.flush();
    encoder.close();
    if (encoderError) throw new Error(encoderError);
    if (chunks.length !== total || !decoderDescription) throw new Error(`Incomplete AVC output: ${chunks.length}/${total} chunks, config=${!!decoderDescription}`);
    const payload = new Blob(chunks.map((chunk) => chunk.data));
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(payload);
    });
    return {
      base64,
      avcC: Array.from(decoderDescription),
      colorSpace,
      samples: chunks.map((chunk) => ({ size: chunk.data.length, type: chunk.type, timestamp: chunk.timestamp })),
      sourceSize: { width: source.width, height: source.height },
    };
  }, { fps: FPS, total: TOTAL_FRAMES, width: WIDTH, height: HEIGHT, preference });
}

async function main() {
  const flags = new Set(process.argv.slice(2));
  const probeOnly = flags.has('--probe');
  const doVideo = flags.has('--video') || flags.has('--all');
  const doFrames = flags.has('--frames') || flags.has('--all') || (!doVideo && !probeOnly);
  const { api, modulePath } = findPlaywright();
  const executablePath = findBrowser();
  const ffmpeg = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-version'], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
  console.log(JSON.stringify({ node: process.version, playwright: modulePath, browser: executablePath, ffmpegAvailable: ffmpeg.status === 0 }, null, 2));
  const localFile = (name) => pathToFileURL(path.join(ROOT, name)).href;
  let browser;
  const started = Date.now();
  try {
    browser = await api.chromium.launch({ executablePath, headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--force-color-profile=srgb'] });
    const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1, colorScheme: 'dark' });
    const page = await context.newPage();
    page.on('pageerror', (error) => console.error('PAGE ERROR:', error.message));
    if (probeOnly) {
      await page.goto(localFile('tools/probe.html'));
      console.log('Codec support:', JSON.stringify(await codecProbe(page), null, 2));
      return;
    }
    if (!fs.existsSync(path.join(ROOT, 'index.html'))) throw new Error('index.html is not ready yet.');
    await page.goto(localFile('index.html') + '?export=1', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(() => typeof window.seekFrame === 'function', null, { timeout: 30000 });
    await page.evaluate(async () => { await document.fonts.ready; });
    if (doFrames) {
      const directory = path.join(ROOT, 'frames');
      fs.mkdirSync(directory, { recursive: true });
      for (const frame of STILL_FRAMES) {
        await page.evaluate(async (value) => { await window.seekFrame(value); await new Promise(requestAnimationFrame); }, frame);
        const target = path.join(directory, `frame-${String(frame).padStart(4, '0')}.png`);
        await page.screenshot({ path: target, type: 'png', fullPage: false, animations: 'disabled' });
        console.log('PNG:', target);
      }
    }
    if (doVideo) {
      const support = await codecProbe(page);
      const selected = support.h264?.find((item) => item.supported);
      if (!selected) throw new Error('This browser cannot encode H.264 using WebCodecs. No dependencies were installed.');
      console.log('Encoding:', selected.hardwareAcceleration);
      const encoded = await encodeFilm(page, selected.hardwareAcceleration);
      const data = Buffer.from(encoded.base64, 'base64');
      let offset = 0;
      const samples = encoded.samples.map((sample) => {
        const result = { ...sample, data: data.subarray(offset, offset + sample.size) };
        offset += sample.size;
        return result;
      });
      const output = path.join(ROOT, 'transformer-in-motion.mp4');
      const mp4 = muxAvcMp4({ samples, avcC: Buffer.from(encoded.avcC), width: WIDTH, height: HEIGHT, fps: FPS, colorSpace: encoded.colorSpace });
      fs.writeFileSync(output, mp4);
      const check = await context.newPage();
      await check.goto(localFile('tools/probe.html'));
      const metadata = await check.evaluate(async (videoUrl) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = videoUrl;
        await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = () => reject(new Error('Browser could not decode exported MP4')); });
        const metadata = { width: video.videoWidth, height: video.videoHeight, duration: video.duration };
        video.currentTime = 14.9;
        await new Promise((resolve, reject) => { video.onseeked = resolve; video.onerror = reject; });
        return { ...metadata, decodedSeek: video.currentTime };
      }, localFile('transformer-in-motion.mp4'));
      if (metadata.width !== WIDTH || metadata.height !== HEIGHT || Math.abs(metadata.duration - TOTAL_FRAMES / FPS) > 0.05) throw new Error('MP4 metadata validation failed: ' + JSON.stringify(metadata));
      const manifest = { format: 'H.264/AVC in MP4', width: WIDTH, height: HEIGHT, fps: FPS, frames: samples.length, duration: TOTAL_FRAMES / FPS, audio: false, sourceCanvas: encoded.sourceSize, encoderPreference: selected.hardwareAcceleration, colorSpace: encoded.colorSpace, bytes: mp4.length, browserVerification: metadata, elapsedSeconds: (Date.now() - started) / 1000 };
      fs.writeFileSync(path.join(ROOT, 'render-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
      console.log('MP4:', output, JSON.stringify(manifest));
    }
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { findPlaywright, findBrowser };
if (require.main === module) main().catch((error) => { console.error(error.stack || String(error)); process.exitCode = 1; });
