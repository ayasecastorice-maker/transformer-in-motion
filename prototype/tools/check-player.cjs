'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const { findPlaywright, findBrowser } = require('./render.cjs');

async function main() {
  const root = path.resolve(__dirname, '..');
  const browser = await findPlaywright().api.chromium.launch({ executablePath: findBrowser(), headless: true });
  const report = { pageErrors: [], checks: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    page.on('pageerror', (error) => report.pageErrors.push(error.message));
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'networkidle' });
    await page.evaluate(async () => { await document.fonts.ready; });
    const position = () => page.locator('#scrub').inputValue().then(Number);
    const play = page.locator('#play');
    if ((await play.textContent()) === '暂停') await play.click();
    const pausedAt = await position();
    await page.waitForTimeout(180);
    assert.equal(await position(), pausedAt, 'paused frame should be stable');
    report.checks.push({ check: 'pause', frame: pausedAt, passed: true });
    await play.click();
    await page.waitForTimeout(250);
    const playingAt = await position();
    assert(playingAt > pausedAt, 'play should advance the frame');
    await play.click();
    report.checks.push({ check: 'play', from: pausedAt, to: playingAt, passed: true });
    const slider = await page.locator('#scrub').boundingBox();
    await page.mouse.move(slider.x + slider.width * 0.1, slider.y + slider.height / 2);
    await page.mouse.down();
    await page.mouse.move(slider.x + slider.width * 0.63, slider.y + slider.height / 2, { steps: 8 });
    await page.mouse.up();
    const draggedTo = await position();
    assert(draggedTo > 500 && draggedTo < 800, 'slider drag should change position');
    assert.equal(await play.textContent(), '播放', 'scrubbing should pause playback');
    report.checks.push({ check: 'drag', frame: draggedTo, passed: true });
    for (const chapter of [0, 300, 570, 840]) {
      await page.locator('#chapters').selectOption(String(chapter));
      assert.equal(await position(), chapter + 21);
      report.checks.push({ check: 'chapter', chapter, frame: await position(), passed: true });
    }
    await page.locator('#scrub').focus();
    await page.keyboard.press('End');
    assert.equal(await position(), 1079, 'end scrub position should be the final frame');
    assert.equal(report.pageErrors.length, 0, 'no uncaught page errors');
    report.checks.push({ check: 'last scene', frame: await position(), clock: await page.locator('#clock').textContent(), passed: true });
    fs.mkdirSync(path.join(root, 'frames'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'frames', 'player-check.png') });
    fs.writeFileSync(path.join(root, 'player-check.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
