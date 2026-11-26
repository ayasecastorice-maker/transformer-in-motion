'use strict';
const {findPlaywright,findBrowser}=require('./environment.cjs');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
  const {api}=findPlaywright();
  const browser=await api.chromium.launch({executablePath:findBrowser(),headless:true});
  try{
    const page=await browser.newPage();
    await page.goto(pathToFileURL(path.join(__dirname,'probe.html')).href);
    console.log(JSON.stringify(await page.evaluate(async()=>{
      const results=[];
      for(const codec of ['mp4a.40.2','opus']){
        const config={codec,sampleRate:48000,numberOfChannels:2,bitrate:128000};
        let encoder;
        try{
          const support=await AudioEncoder.isConfigSupported(config);
          if(!support.supported){results.push({codec,supported:false});continue;}
          const chunks=[];let dc=null,error=null;
          encoder=new AudioEncoder({output:(chunk,metadata)=>{chunks.push({timestamp:chunk.timestamp,duration:chunk.duration,size:chunk.byteLength});if(metadata?.decoderConfig)dc={...metadata.decoderConfig,description:Array.from(new Uint8Array(metadata.decoderConfig.description||[]))};},error:e=>error=String(e)});
          encoder.configure(config);
          for(let i=0;i<48;i++){
            const a=new Float32Array(1024*2);for(let j=0;j<1024;j++){a[j]=a[j+1024]=.1*Math.sin(2*Math.PI*440*(i*1024+j)/48000);}
            const audio=new AudioData({format:'f32-planar',sampleRate:48000,numberOfChannels:2,numberOfFrames:1024,timestamp:Math.round(i*1024/48000*1e6),data:a});encoder.encode(audio);audio.close();
          }
          await encoder.flush();
          results.push({codec,supported:true,error,decoderConfig:dc,count:chunks.length,first:chunks.slice(0,4),last:chunks.slice(-3)});
        }catch(e){results.push({codec,supported:false,error:String(e)});}
        finally{if(encoder&&encoder.state!=='closed')encoder.close();}
      }
      return results;
    }),null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
