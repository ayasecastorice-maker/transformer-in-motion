'use strict';
const fs = require('node:fs');
const path = require('node:path');
const score = require('../score.js');
function wav(rendered) {
  const { channels, sampleRate, length } = rendered;
  const dataSize = length * channels.length * 2;
  const out = Buffer.alloc(44 + dataSize);
  out.write('RIFF'); out.writeUInt32LE(36 + dataSize, 4); out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(channels.length, 22);
  out.writeUInt32LE(sampleRate, 24); out.writeUInt32LE(sampleRate * channels.length * 2, 28);
  out.writeUInt16LE(channels.length * 2, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < length; i++) for (let c = 0; c < channels.length; c++) out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, channels[c][i])) * 32767), 44 + (i * channels.length + c) * 2);
  return out;
}
if (require.main === module) {
  const { film } = require('./production.cjs');
  const rendered = score.render({ film });
  if (rendered.peak >= 1) throw new Error('Score clips: ' + rendered.peak);
  const output = path.resolve(__dirname, '../score.wav');
  fs.writeFileSync(output, wav(rendered));
  const metadata = { original: true, sampledExternalWorks: false, sampleRate: rendered.sampleRate, channels: 2, duration: rendered.duration, peak: rendered.peak, rms: rendered.rms, peakDbfs: 20 * Math.log10(rendered.peak), rmsDbfs: 20 * Math.log10(rendered.rms), cues: rendered.cues, description: 'Original restrained procedural sine pulses, filtered paper grains and brushed transitions; deterministic seed, no samples.' };
  fs.writeFileSync(path.resolve(__dirname, '../score.json'), JSON.stringify(metadata, null, 2) + '\n');
  console.log(output, JSON.stringify(metadata));
}
module.exports = { wav };
