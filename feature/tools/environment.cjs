'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function loadPlaywright(modulePath) {
  const api = require(modulePath);
  if (!api.chromium || typeof api.chromium.launch !== 'function') {
    throw new Error('Expected a Playwright package with Chromium support at ' + modulePath);
  }
  return { api, modulePath };
}

function findPlaywright() {
  if (process.env.PLAYWRIGHT_MODULE_PATH) {
    return loadPlaywright(require.resolve(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)));
  }
  // The working directory may be the repository, feature, or prototype.
  const paths = [process.cwd(), __dirname];
  for (const name of ['playwright-core', 'playwright']) {
    let modulePath;
    try {
      modulePath = require.resolve(name, { paths });
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
      continue;
    }
    return loadPlaywright(modulePath);
  }
  throw new Error('Install playwright-core in the project or set PLAYWRIGHT_MODULE_PATH to an installed Playwright module.');
}

function isExecutable(filename) {
  try {
    fs.accessSync(filename, fs.constants.X_OK);
    return fs.statSync(filename).isFile();
  } catch {
    return false;
  }
}

function findBrowser() {
  if (process.env.BROWSER_PATH) {
    const selected = path.resolve(process.env.BROWSER_PATH);
    if (isExecutable(selected)) return selected;
    throw new Error('BROWSER_PATH does not point to an executable file: ' + selected);
  }
  const candidates = [];
  if (process.platform === 'win32') {
    const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean);
    for (const root of roots) {
      candidates.push(path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      candidates.push(path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
  } else if (process.platform === 'darwin') {
    for (const root of ['/Applications', path.join(os.homedir(), 'Applications')]) {
      candidates.push(path.join(root, 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'));
      candidates.push(path.join(root, 'Microsoft Edge.app', 'Contents', 'MacOS', 'Microsoft Edge'));
    }
  }
  const names = process.platform === 'win32'
    ? ['chrome.exe', 'msedge.exe', 'chromium.exe']
    : ['google-chrome-stable', 'google-chrome', 'microsoft-edge-stable', 'microsoft-edge', 'chromium', 'chromium-browser'];
  for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    for (const name of names) candidates.push(path.join(dir, name));
  }
  const systemBrowser = candidates.find(isExecutable);
  if (systemBrowser) return systemBrowser;
  const bundledBrowser = findPlaywright().api.chromium.executablePath();
  if (isExecutable(bundledBrowser)) return bundledBrowser;
  throw new Error('Set BROWSER_PATH to a recent Chrome or Edge executable that provides the required WebCodecs encoders.');
}

module.exports = { findPlaywright, findBrowser };

