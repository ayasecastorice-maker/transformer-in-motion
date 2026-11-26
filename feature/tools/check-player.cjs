'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { findPlaywright, findBrowser } = require('./environment.cjs');
const { film, frames } = require('./production.cjs');
const ROOT = path.resolve(__dirname, '..');
async function main() {
  const complete = process.argv.includes('--complete');
  const browser = await findPlaywright().api.chromium.launch({ executablePath: findBrowser(), headless: true });
  const report = { complete, states: {}, pageErrors: [], failedRequests: [], cancelledMediaRequests: [] };
  try {
    const page = await browser.newPage({ viewport: { width: film.width, height: film.height }, deviceScaleFactor: 1 });
    page.on('pageerror', e => report.pageErrors.push(e.message));
    page.on('requestfailed', r => {
      const request = { url: r.url().split('/').pop(), error: r.failure()?.errorText };
      // Seeking a local media stream can cancel its old range read normally.
      (r.resourceType() === 'media' && request.error === 'net::ERR_ABORTED' ? report.cancelledMediaRequests : report.failedRequests).push(request);
    });
    await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href);
    await page.waitForFunction(() => typeof window.seekFrame === 'function' && document.getElementById('score').readyState >= 2);
    const state = () => page.evaluate(() => ({ frame: Number(document.getElementById('scrub').value), play: document.getElementById('play').textContent, clock: document.getElementById('clock').textContent, audioTime: document.getElementById('score').currentTime, audioPaused: document.getElementById('score').paused, audioMuted: document.getElementById('score').muted, audioDuration: document.getElementById('score').duration, sound: document.getElementById('sound').textContent, chapter: document.getElementById('chapter').value }));
    report.states.initial = await state(); assert.equal(report.states.initial.audioDuration, film.duration);
    await page.locator('#play').click(); await page.waitForTimeout(500);
    report.states.playing = await state(); assert.equal(report.states.playing.audioPaused, false); assert.equal(report.states.playing.play, '暂停'); assert.ok(report.states.playing.frame > 4); assert.ok(Math.abs(report.states.playing.frame / film.fps - report.states.playing.audioTime) < .1);
    await page.locator('#play').click(); const paused = await state(); await page.waitForTimeout(150);
    report.states.paused = await state(); assert.equal(report.states.paused.frame, paused.frame); assert.equal(report.states.paused.audioPaused, true);
    const scrubFrame=Math.round(film.duration*film.fps*.17);
    await page.locator('#scrub').evaluate((e,value) => { e.value=value; e.dispatchEvent(new Event('input', { bubbles: true })); },scrubFrame);
    report.states.scrubbed = await state(); assert.equal(report.states.scrubbed.frame, scrubFrame); assert.ok(Math.abs(report.states.scrubbed.audioTime - scrubFrame/film.fps) < .05); assert.equal(report.states.scrubbed.audioPaused, true);
    await page.locator('#play').click(); await page.waitForTimeout(250); await page.locator('#sound').click();
    report.states.muted = await state(); assert.equal(report.states.muted.audioMuted, true); assert.equal(report.states.muted.audioPaused, false); assert.equal(report.states.muted.sound, '声音关');
    await page.locator('#sound').click(); report.states.unmuted = await state(); assert.equal(report.states.unmuted.audioMuted, false);
    await page.locator('#chapter').selectOption('3'); await page.waitForTimeout(200);
    report.states.chapter = await state(); assert.equal(report.states.chapter.chapter, '3'); assert.ok(report.states.chapter.frame >= film.shots[3].start * film.fps); assert.equal(report.states.chapter.audioPaused, false); assert.ok(Math.abs(report.states.chapter.frame / film.fps - report.states.chapter.audioTime) < .1);
    await page.locator('#play').click();
    if (complete) {
      await page.evaluate(last => window.seekFrame(last - 12),frames); await page.locator('#play').click(); await page.waitForTimeout(700);
      report.states.ended = await state(); assert.equal(report.states.ended.frame, frames-1); assert.equal(report.states.ended.play, '重播'); assert.equal(report.states.ended.audioPaused, true);
      await page.locator('#play').click(); await page.waitForTimeout(250);
      report.states.replay = await state(); assert.ok(report.states.replay.frame < film.fps); assert.equal(report.states.replay.audioPaused, false);
      await page.locator('#play').click();
    }
    assert.deepEqual(report.pageErrors, []);
    if (complete) assert.deepEqual(report.failedRequests, []);
    fs.writeFileSync(path.join(ROOT, complete ? 'player-verification.json' : 'tools/player-early-check.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e.stack || e); process.exitCode = 1; });
