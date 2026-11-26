'use strict';
// Dependency-free ISO BMFF muxer: one AVC track + one AAC-LC track.
// AVC samples are AVCC, no B frames; AAC packets use raw access units (not ADTS).
const fs = require('node:fs');
const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
const z = n => Buffer.alloc(n), a = s => Buffer.from(s, 'ascii');
const box = (type, ...parts) => { const p = Buffer.concat(parts); return Buffer.concat([u32(p.length + 8), a(type), p]); };
const full = (type, flags, ...parts) => box(type, u32(flags), ...parts);
const matrix = () => Buffer.concat([u32(65536), u32(0), u32(0), u32(0), u32(65536), u32(0), u32(0), u32(0), u32(0x40000000)]);
function desc(tag, bytes) {
  let n = bytes.length; const size = [n & 127];
  while (n >>= 7) size.unshift((n & 127) | 128);
  return Buffer.concat([Buffer.from([tag, ...size]), bytes]);
}
function sampleTable(entry, samples, delta, offset, video) {
  const keys = samples.flatMap((s, i) => s.type === 'key' ? [u32(i + 1)] : []);
  return box('stbl', full('stsd', 0, u32(1), entry),
    full('stts', 0, u32(1), u32(samples.length), u32(delta)),
    full('stsc', 0, u32(1), u32(1), u32(samples.length), u32(1)),
    full('stsz', 0, u32(0), u32(samples.length), ...samples.map(s => u32(s.size))),
    full('stco', 0, u32(1), u32(offset)),
    ...(video ? [full('stss', 0, u32(keys.length), ...keys)] : []));
}
function track({ id, duration, mediaDuration, timescale, entry, samples, delta, offset, width = 0, height = 0 }) {
  const video = width > 0;
  const header = full('tkhd', 7, u32(0), u32(0), u32(id), u32(0), u32(duration), z(8), u16(0), u16(0), u16(video ? 0 : 256), u16(0), matrix(), u32(width * 65536), u32(height * 65536));
  // AAC's last frame can extend beyond the film; the edit clips it to exact duration.
  const edit = box('edts', full('elst', 0, u32(1), u32(duration), u32(0), u16(1), u16(0)));
  const mdhd = full('mdhd', 0, u32(0), u32(0), u32(timescale), u32(mediaDuration), u16(0x55c4), u16(0));
  const hdlr = full('hdlr', 0, u32(0), a(video ? 'vide' : 'soun'), z(12), a(video ? 'VideoHandler\0' : 'SoundHandler\0'));
  const dinf = box('dinf', full('dref', 0, u32(1), full('url ', 1)));
  const minf = box('minf', video ? full('vmhd', 1, u16(0), z(6)) : full('smhd', 0, u16(0), u16(0)), dinf, sampleTable(entry, samples, delta, offset, video));
  return box('trak', header, edit, box('mdia', mdhd, hdlr, minf));
}
function movieAtoms({ video, audio, width, height, fps, sampleRate = 48000, channels = 2 }) {
  if (!video.samples.length || !video.description?.length || !audio.samples.length || !audio.description?.length) throw new Error('Both encoded tracks and decoder descriptions are required.');
  if (video.samples[0].type !== 'key' || 90000 % fps) throw new Error('Expected an initial keyframe and an integer frame rate dividing 90000.');
  for (let i = 1; i < video.samples.length; i++) if (video.samples[i].timestamp <= video.samples[i - 1].timestamp) throw new Error('AVC reordering is unsupported.');
  const timescale = 90000, duration = video.samples.length * timescale / fps;
  const ftyp = box('ftyp', a('isom'), u32(0x200), a('isomiso2avc1mp41'));
  const videoBytes = video.samples.reduce((n, s) => n + s.size, 0);

  const mvhd = full('mvhd', 0, u32(0), u32(0), u32(timescale), u32(duration), u32(65536), u16(256), z(10), matrix(), z(24), u32(3));
  const compressor = Buffer.alloc(32); compressor[0] = 15; compressor.write('Canvas WebCodecs', 1, 'ascii');
  const cs = video.colorSpace || {};
  const p = { bt709: 1, bt470bg: 5, smpte170m: 6, bt2020: 9 };
  const t = { bt709: 1, 'iec61966-2-1': 13, smpte2084: 16, 'arib-std-b67': 18 };
  const m = { rgb: 0, bt709: 1, bt470bg: 5, smpte170m: 6, 'bt2020-ncl': 9 };
  const color = box('colr', a('nclx'), u16(p[cs.primaries] ?? 2), u16(t[cs.transfer] ?? 2), u16(m[cs.matrix] ?? 2), Buffer.from([cs.fullRange ? 128 : 0]));
  const avc1 = box('avc1', z(6), u16(1), z(16), u16(width), u16(height), u32(0x00480000), u32(0x00480000), u32(0), u16(1), compressor, u16(24), u16(65535), box('avcC', video.description), color);
  const decoder = desc(4, Buffer.concat([Buffer.from([0x40, 0x15, 0, 0, 0]), u32(160000), u32(160000), desc(5, audio.description)]));
  const esds = full('esds', 0, desc(3, Buffer.concat([u16(2), Buffer.from([0]), decoder, desc(6, Buffer.from([2]))])));
  const mp4a = box('mp4a', z(6), u16(1), z(8), u16(channels), u16(16), u16(0), u16(0), u32(sampleRate * 65536), esds);
  const vtrack = track({ id: 1, duration, mediaDuration: duration, timescale, entry: avc1, samples: video.samples, delta: timescale / fps, offset: ftyp.length + 8, width, height });
  const atrack = track({ id: 2, duration, mediaDuration: audio.samples.length * 1024, timescale: sampleRate, entry: mp4a, samples: audio.samples, delta: 1024, offset: ftyp.length + 8 + videoBytes });
  return {ftyp, moov: box('moov', mvhd, vtrack, atrack)};
}

const ftypHeader = () => box('ftyp', a('isom'), u32(0x200), a('isomiso2avc1mp41'));

// Write individual batches directly behind mdat. Only sample sizes and clock values
// remain in Node while the browser is synthesising the next second of video.
function createMovieWriter(filename) {
  const fd = fs.openSync(filename,'wx');
  const ftyp = ftypHeader();
  fs.writeFileSync(fd,Buffer.concat([ftyp,u32(0),a('mdat')]));
  const tracks = {video:{samples:[],bytes:0},audio:{samples:[],bytes:0}};
  let closed=false;
  function append(name, packets) {
    const track=tracks[name];
    if(!track || (name==='video' && tracks.audio.samples.length)) throw new Error('Unexpected track order.');
    for (const packet of packets) {
      const data=Buffer.from(packet.base64,'base64');
      fs.writeFileSync(fd,data);
      track.bytes+=data.length;
      track.samples.push({size:data.length,type:packet.type,timestamp:packet.timestamp});
    }
  }
  function finish(meta,options) {
    for(const name of ['video','audio']){
      tracks[name].description=Buffer.from(meta[name].description);
      tracks[name].colorSpace=meta[name].colorSpace;
    }
    const {moov}=movieAtoms({...tracks,...options});
    const payload=tracks.video.bytes+tracks.audio.bytes;
    if(payload+8>0xffffffff)throw new Error('Media payload exceeded the 32-bit mdat size.');
    fs.writeSync(fd,u32(payload+8),0,4,ftyp.length);
    fs.writeFileSync(fd,moov);
    fs.closeSync(fd);closed=true;
    return {videoFrames:tracks.video.samples.length,audioPackets:tracks.audio.samples.length,
      sps:{profile:tracks.video.description[1],level:tracks.video.description[3]},
      bytes:ftyp.length+8+payload+moov.length};
  }
  return {append,finish,close(){if(!closed){fs.closeSync(fd);closed=true;}}};
}
function boxes(b,start=0,end=b.length) {
  const result=[];
  for(let pos=start;pos<end;){
    const size=b.readUInt32BE(pos), type=b.toString('ascii',pos+4,pos+8);
    if(size<8 || pos+size>end)throw new Error('Malformed MP4 atom '+type);
    result.push({type,at:pos,size});pos+=size;
  }
  return result;
}
function child(b,parent,type) {
  const result=boxes(b,parent.at+8,parent.at+parent.size).find(x=>x.type===type);
  if(!result)throw new Error('Missing MP4 atom '+type);
  return result;
}
function readAt(fd,size,pos){
  const out=Buffer.allocUnsafe(size);
  let have=0;
  while(have<size){
    const n=fs.readSync(fd,out,have,size-have,pos+have);
    if(!n)throw new Error('Incomplete MP4 read.');
    have+=n;
  }
  return out;
}
// Extract the compressed AAC track from the real output without loading its
// much larger video payload. The edit list, timescale and codec config survive.
function inspectMovie(filename) {
  const fd=fs.openSync(filename,'r');
  try{
    const size=fs.fstatSync(fd).size;
    let moov;
    for(let pos=0;pos<size;){
      const h=readAt(fd,8,pos),length=h.readUInt32BE(0);
      if(length<8||pos+length>size)throw new Error('Invalid top-level atom');
      if(h.toString('ascii',4,8)==='moov'){moov=readAt(fd,length,pos);break;}
      pos+=length;
    }
    if(!moov)throw new Error('No MP4 movie index');
    const top=boxes(moov)[0], children=boxes(moov,8,moov.length);
    const mvhd=child(moov,top,'mvhd'), rate=moov.readUInt32BE(mvhd.at+20);
    const facts={duration:moov.readUInt32BE(mvhd.at+24)/rate};
    let audioFile;
    for(const trak of children.filter(x=>x.type==='trak')){
      const mdia=child(moov,trak,'mdia'),handler=child(moov,mdia,'hdlr'), mdhd=child(moov,mdia,'mdhd');
      const kind=moov.toString('ascii',handler.at+16,handler.at+20);
      const stbl=child(moov,child(moov,mdia,'minf'),'stbl');
      const stsz=child(moov,stbl,'stsz'),stts=child(moov,stbl,'stts'),stco=child(moov,stbl,'stco');
      const count=moov.readUInt32BE(stsz.at+16);
      const scale=moov.readUInt32BE(mdhd.at+20),delta=moov.readUInt32BE(stts.at+20);
      if(moov.readUInt32BE(stts.at+12)!==1||moov.readUInt32BE(stts.at+16)!==count) throw new Error('Unexpected MP4 time mapping.');
      if(kind==='vide'){
        const trackHeader=child(moov,trak,'tkhd');
        facts.video={frames:count,fps:scale/delta,constantFrameDuration:delta,mediaTimescale:scale,
          width:moov.readUInt32BE(trackHeader.at+trackHeader.size-8)/65536,
          height:moov.readUInt32BE(trackHeader.at+trackHeader.size-4)/65536};
      }
      if(kind==='soun'){
        if(moov.readUInt32BE(stco.at+12)!==1)throw new Error('AAC spans multiple media chunks.');
        const bytes=Array.from({length:count},(_,i)=>moov.readUInt32BE(stsz.at+20+i*4)).reduce((sum,v)=>sum+v,0);
        const originalOffset=moov.readUInt32BE(stco.at+16);
        const data=readAt(fd,bytes,originalOffset);
        const audioTrak=Buffer.from(moov.subarray(trak.at,trak.at+trak.size));
        const ftyp=ftypHeader();
        audioTrak.writeUInt32BE(ftyp.length+8,stco.at-trak.at+16);
        const audioMoov=box('moov',moov.subarray(mvhd.at,mvhd.at+mvhd.size),audioTrak);
        audioFile=Buffer.concat([ftyp,u32(bytes+8),a('mdat'),data,audioMoov]);
        facts.audio={packets:count,sampleRate:scale,durationPerPacket:delta,bytes};
      }
    }
    if(!facts.video||!audioFile)throw new Error('Missing encoded track');
    return {facts,audioFile};
  }finally{fs.closeSync(fd);}
}
module.exports={createMovieWriter,inspectMovie};


