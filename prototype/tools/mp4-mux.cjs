'use strict';

// Minimal, dependency-free ISO BMFF muxer for one H.264/AVC video track.
// Input samples must use AVCC length-prefixed NAL units in presentation order.
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
const zeros = (n) => Buffer.alloc(n);
const ascii = (s) => Buffer.from(s, 'ascii');
function box(type, ...parts) {
  const payload = Buffer.concat(parts);
  return Buffer.concat([u32(payload.length + 8), ascii(type), payload]);
}
const full = (type, flags, ...parts) => box(type, u32(flags), ...parts);
const matrix = () => Buffer.concat([
  u32(0x10000), u32(0), u32(0),
  u32(0), u32(0x10000), u32(0),
  u32(0), u32(0), u32(0x40000000),
]);

function muxAvcMp4({ samples, avcC, width, height, fps, colorSpace }) {
  if (!samples.length || !avcC?.length) throw new Error('Encoded samples and AVC decoder configuration are required.');
  if (samples[0].type !== 'key') throw new Error('The first encoded sample must be a key frame.');
  if (!Number.isInteger(fps) || 90000 % fps !== 0) throw new Error('fps must divide the 90000 Hz track timescale.');
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].timestamp <= samples[i - 1].timestamp) throw new Error('Reordered frames are unsupported; use latencyMode=realtime.');
  }
  const timescale = 90000;
  const delta = timescale / fps;
  const duration = samples.length * delta;
  const ftyp = box('ftyp', ascii('isom'), u32(0x200), ascii('isomiso2avc1mp41'));
  const mdat = box('mdat', ...samples.map((sample) => sample.data));
  const movieHeader = full('mvhd', 0,
    u32(0), u32(0), u32(timescale), u32(duration), u32(0x10000), u16(0x100),
    zeros(10), matrix(), zeros(24), u32(2));
  const trackHeader = full('tkhd', 7,
    u32(0), u32(0), u32(1), u32(0), u32(duration), zeros(8),
    u16(0), u16(0), u16(0), u16(0), matrix(), u32(width * 65536), u32(height * 65536));
  const mediaHeader = full('mdhd', 0,
    u32(0), u32(0), u32(timescale), u32(duration), u16(0x55c4), u16(0));
  const handler = full('hdlr', 0, u32(0), ascii('vide'), zeros(12), ascii('VideoHandler\0'));
  const compressor = Buffer.alloc(32);
  compressor[0] = 15;
  compressor.write('Canvas WebCodecs', 1, 'ascii');
  const primaries = { bt709: 1, bt470bg: 5, smpte170m: 6, bt2020: 9 };
  const transfers = { bt709: 1, 'iec61966-2-1': 13, smpte2084: 16, 'arib-std-b67': 18 };
  const matrices = { rgb: 0, bt709: 1, bt470bg: 5, smpte170m: 6, 'bt2020-ncl': 9 };
  const color = colorSpace ? box('colr', ascii('nclx'),
    u16(primaries[colorSpace.primaries] ?? 2), u16(transfers[colorSpace.transfer] ?? 2),
    u16(matrices[colorSpace.matrix] ?? 2), Buffer.from([colorSpace.fullRange ? 0x80 : 0])) : Buffer.alloc(0);
  const avc1 = box('avc1', zeros(6), u16(1), zeros(16), u16(width), u16(height),
    u32(0x00480000), u32(0x00480000), u32(0), u16(1), compressor,
    u16(0x18), u16(0xffff), box('avcC', avcC), color);
  const stsd = full('stsd', 0, u32(1), avc1);
  const stts = full('stts', 0, u32(1), u32(samples.length), u32(delta));
  const stsc = full('stsc', 0, u32(1), u32(1), u32(samples.length), u32(1));
  const stsz = full('stsz', 0, u32(0), u32(samples.length), ...samples.map((sample) => u32(sample.data.length)));
  const stco = full('stco', 0, u32(1), u32(ftyp.length + 8));
  const keys = samples.flatMap((sample, index) => sample.type === 'key' ? [u32(index + 1)] : []);
  const stss = full('stss', 0, u32(keys.length), ...keys);
  const sampleTable = box('stbl', stsd, stts, stsc, stsz, stco, stss);
  const dataInfo = box('dinf', full('dref', 0, u32(1), full('url ', 1)));
  const mediaInfo = box('minf', full('vmhd', 1, u16(0), zeros(6)), dataInfo, sampleTable);
  const media = box('mdia', mediaHeader, handler, mediaInfo);
  const track = box('trak', trackHeader, media);
  const moov = box('moov', movieHeader, track);
  return Buffer.concat([ftyp, mdat, moov]);
}

module.exports = { muxAvcMp4 };
