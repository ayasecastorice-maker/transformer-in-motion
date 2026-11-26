'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {randomUUID}=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {findPlaywright,findBrowser}=require('./environment.cjs');
const {createMovieWriter,inspectMovie}=require('./mp4-mux.cjs');
const {film,frames:filmFrames,reviewFrames,outputName}=require('./production.cjs');

const root=path.resolve(__dirname,'..');
const local=relative=>pathToFileURL(path.join(root,relative)).href;

async function encode(page,writer,{width,height,fps,frames}) {
  await page.addScriptTag({path:path.join(root,'score.js')});
  await page.exposeFunction('__appendFilmPackets',(track,packets)=>writer.append(track,packets));
  await page.exposeFunction('__reportFilmFrames',n=>console.log('Encoded '+n+' / '+frames+' ('+Math.round(n/frames*100)+'%)'));
  return page.evaluate(async ({width,height,fps,frames,program})=>{
    const canvas=document.querySelector('#film');
    if(canvas.width!==width||canvas.height!==height)throw new Error('Incorrect native canvas dimensions: '+canvas.width+' × '+canvas.height);
    let failure;
    function stream(Encoder,track){
      let packets=[],sequence=0, description,colorSpace,firstTimestamp;
      const encoder=new Encoder({
        output(chunk,meta){
          const a=new Uint8Array(chunk.byteLength);chunk.copyTo(a);
          if(sequence===0)firstTimestamp=chunk.timestamp;
          packets.push({type:chunk.type,timestamp:chunk.timestamp,base64:a.toBase64()});
          sequence++;
          if(meta?.decoderConfig?.description)description=Array.from(new Uint8Array(meta.decoderConfig.description));
          if(meta?.decoderConfig?.colorSpace)colorSpace=meta.decoderConfig.colorSpace;
        },
        error(e){failure=String(e);}
      });
      async function transfer(){
        if(failure)throw new Error(failure);
        if(packets.length){
          const batch=packets;packets=[];
          await window.__appendFilmPackets(track,batch);
        }
      }
      async function drain(){await encoder.flush();await transfer();}
      return {encoder,drain,transfer,meta(){return {description,colorSpace,count:sequence,firstTimestamp};}};
    }
    const video=stream(VideoEncoder,'video'),audio=stream(AudioEncoder,'audio');
    const defaultVideo={width,height,framerate:fps,bitrate:25000000,latencyMode:'realtime',avc:{format:'avc'}};
    let videoConfig;
    for(const pref of ['prefer-hardware','prefer-software']){
      for(const codec of ['avc1.640033','avc1.640034']){
        const cfg={...defaultVideo,codec,hardwareAcceleration:pref};
        if((await VideoEncoder.isConfigSupported(cfg)).supported){videoConfig=cfg;break;}
      }
      if(videoConfig)break;
    }
    if(!videoConfig)throw new Error('No capable H.264 High 5.1+ encoder for the native canvas.');
    video.encoder.configure(videoConfig);
    const stamp=n=>Math.round(n*1000000/fps);
    const checkpoints=[];
    for(let i=0;i<frames;i++){
      const actual=await window.seekFrame(i);
      if(actual!==undefined&&typeof actual==='number'&&actual!==i)throw new Error('Frame seek mismatch at '+i);
      const f=new VideoFrame(canvas,{timestamp:stamp(i),duration:stamp(i+1)-stamp(i)});
      video.encoder.encode(f,{keyFrame:i%(2*fps)===0});f.close();
      if(video.encoder.encodeQueueSize>12 || (i+1)%fps===0)await video.drain();
      if(i<4 || i===frames-1)checkpoints.push({frame:i,timestampUs:stamp(i)});
      if((i+1)%(fps*10)===0)await window.__reportFilmFrames(i+1);
    }
    await video.drain();video.encoder.close();
    if(video.meta().count!==frames)throw new Error('The encoded frame count is incomplete.');
    const aconfig={codec:'mp4a.40.2',sampleRate:48000,numberOfChannels:2,bitrate:160000};
    if(!(await AudioEncoder.isConfigSupported(aconfig)).supported)throw new Error('AAC encoder unavailable.');
    audio.encoder.configure(aconfig);
    const score=window.TransformerScore.render({film:program,duration:frames/fps});
    for(let i=0;i<score.length;i+=1024){
      const data=new Float32Array(2048);
      for(let c=0;c<2;c++)data.set(score.channels[c].subarray(i,i+1024),c*1024);
      const f=new AudioData({format:'f32-planar',sampleRate:48000,numberOfChannels:2,numberOfFrames:1024,timestamp:Math.round(i*1000000/48000),data});
      audio.encoder.encode(f);f.close();
      if(audio.encoder.encodeQueueSize>128)await audio.drain();
      else if(i>0 && i%(1024*128)===0)await audio.transfer();
    }
    await audio.drain();audio.encoder.close();
    return {video:video.meta(),audio:audio.meta(),config:videoConfig,score:{peak:score.peak,rms:score.rms},checkpoints,canvas:{width:canvas.width,height:canvas.height}};
  },{width,height,fps,frames,program:film});
}
async function verify(context,pathname,expected){
  const {facts,audioFile}=inspectMovie(pathname);
  if(facts.video.width!==expected.width||facts.video.height!==expected.height||facts.video.fps!==expected.fps||
    facts.video.frames!==expected.frames||facts.duration!==expected.frames/expected.fps)throw new Error('Encoded MP4 index did not match the requested format: '+JSON.stringify(facts));
  const page=await context.newPage();
  try{
    await page.goto(local('tools/probe.html'));
    const browser=await page.evaluate(async ({url,encodedAudio})=>{
      const v=document.createElement('video');
      v.preload='metadata';v.src=url;document.body.replaceChildren(v);
      await new Promise((ok,fail)=>{v.onloadedmetadata=ok;v.onerror=()=>fail(Error('Video read failed'));});
      v.currentTime=1.1;
      await new Promise((ok,fail)=>{v.onseeked=ok;v.onerror=()=>fail(Error('Video seek failed'));});
      const a=new AudioContext({sampleRate:48000});
      const buffer=await a.decodeAudioData(Uint8Array.fromBase64(encodedAudio).buffer);
      const s=buffer.getChannelData(0);
      let power=0;for(let i=48000;i<96000;i++)power+=s[i]*s[i];
      await a.close();
      return {width:v.videoWidth,height:v.videoHeight,duration:v.duration,decodedSeek:v.currentTime,
        audioDuration:buffer.duration,audioChannels:buffer.numberOfChannels,audioSampleRate:buffer.sampleRate,decodedAudioRms:Math.sqrt(power/48000)};
    },{url:pathToFileURL(pathname).href,encodedAudio:audioFile.toString('base64')});
    if(browser.width!==expected.width||browser.height!==expected.height||Math.abs(browser.audioDuration-facts.duration)>.03 ||
      browser.audioChannels!==2||browser.decodedAudioRms<.001)throw new Error('A/V decode failed: '+JSON.stringify(browser));
    return {index:facts,browser};
  }finally{await page.close();}
}
async function main(){
  const flags=new Set(process.argv.slice(2)),sample=flags.has('--sample');
  const doVideo=sample||flags.has('--video')||flags.has('--all');
  const doFrames=!sample&&(flags.has('--frames')||flags.has('--all')||!doVideo);
  const {width,height,fps}=film;
  const frames=sample?6*fps:filmFrames;
  if(!(width>0&&height>0))throw new Error('timeline.js must provide native width and height.');
  const format={width,height,fps,frames};
  const started=Date.now();
  const browser=await findPlaywright().api.chromium.launch({executablePath:findBrowser(),headless:true,
    args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--force-color-profile=srgb','--autoplay-policy=no-user-gesture-required']});
  try{
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
    const page=await context.newPage(),pageErrors=[];
    page.on('pageerror',e=>pageErrors.push(e.message));
    await page.goto(local(sample?'tools/probe.html':'index.html')+'?export=1');
    await page.waitForFunction(()=>typeof window.seekFrame==='function');
    if(sample)await page.evaluate(({width,height})=>{const c=document.querySelector('#film');c.width=width;c.height=height;},{width,height});
    await page.evaluate(()=>document.fonts.ready);
    if(doFrames){
      fs.mkdirSync(path.join(root,'frames'),{recursive:true});
      for(const frame of reviewFrames){
        await page.evaluate(f=>window.seekFrame(f),frame);
        const p=path.join(root,'frames','frame-'+String(frame).padStart(4,'0')+'.png');
        await page.screenshot({path:p});console.log('PNG: '+p);
      }
    }
    if(doVideo){
      const output=path.join(root,sample?'tools/av-sample.mp4':outputName);
      const temporary=output+'.'+randomUUID()+'.mp4';
      const writer=createMovieWriter(temporary);
      try{
        const encoded=await encode(page,writer,format);
        const result=writer.finish(encoded,format);
        if(pageErrors.length)throw new Error(pageErrors.join('; '));
        const verification=await verify(context,temporary,format);
        fs.renameSync(temporary,output);
        const manifest={format:'MP4 / H.264 High + AAC-LC',width,height,fps,frames,duration:frames/fps,bytes:result.bytes,
          encoder:encoded.config,sps:result.sps,sourceCanvas:encoded.canvas,timingCheckpoints:encoded.checkpoints,
          colorSpace:encoded.video.colorSpace,audio:{codec:'mp4a.40.2',sampleRate:48000,channels:2,packets:result.audioPackets,firstTimestampUs:encoded.audio.firstTimestamp,score:encoded.score},
          ...verification,pageErrors,elapsedSeconds:(Date.now()-started)/1000};
        fs.writeFileSync(path.join(root,sample?'tools/sample-manifest.json':'render-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
        console.log('MP4: '+output+' '+JSON.stringify(manifest));
      }finally{
        writer.close();
        if(fs.existsSync(temporary))fs.unlinkSync(temporary);
      }
    }
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

