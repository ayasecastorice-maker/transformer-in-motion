'use strict';
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {pathToFileURL}=require('node:url');
const {execFileSync,spawnSync}=require('node:child_process');
const {findPlaywright,findBrowser}=require('./environment.cjs');
const {film,outputName}=require('./production.cjs');

async function main() {
  const names=process.env.PYTHON?[process.env.PYTHON]:
    (process.platform==='win32'?['python','python3']:['python3','python']);
  const python=names.find(name=>spawnSync(name,['-c','from PIL import Image'],{stdio:'ignore',windowsHide:true}).status===0);
  if(!python)throw new Error('Install Pillow for Python 3 or set PYTHON to its interpreter path.');
  const root=path.resolve(__dirname,'..');
  const edits=[['rope',1.35],['linear',6.5],['cache',7.5],['gqa',4.2]];
  const clips=edits.map(([id,offset])=>{
    const shot=film.shots.find(s=>s.id===id);
    if(!shot)throw new Error('Missing preview shot '+id);
    return {id,frame:Math.round((shot.start+offset)*film.fps)};
  });
  const browser=await findPlaywright().api.chromium.launch({executablePath:findBrowser(),headless:true,args:['--force-color-profile=srgb']});
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'transformer-motion-'));
  try{
    const page=await browser.newPage({viewport:{width:800,height:450},deviceScaleFactor:1});
    await page.goto(pathToFileURL(path.join(__dirname,'probe.html')).href);
    const video=pathToFileURL(path.join(root,outputName)).href;
    await page.evaluate(async url=>{
      const video=document.createElement('video');video.id='v';video.src=url;
      video.preload='auto';video.style.cssText='display:block;width:800px;height:450px;object-fit:fill';
      document.body.style.cssText='margin:0;overflow:hidden';document.body.replaceChildren(video);
      await new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=reject;});
    },video);
    let index=0;
    for(const clip of clips){
      for(let j=0;j<27;j++){
        const clock=(clip.frame+j*film.fps/15+.05)/film.fps;
        await page.evaluate(async time=>{
          const video=document.getElementById('v');
          const ready=new Promise((resolve,reject)=>{video.onseeked=resolve;video.onerror=reject;});
          video.currentTime=time;await ready;
          await new Promise(requestAnimationFrame);
        },clock);
        await page.screenshot({path:path.join(temp,String(index++).padStart(3,'0')+'.png')});
      }
    }
    const output=path.join(root,'frames','motion-preview.webp');
    const pack=[
      'from pathlib import Path',
      'from PIL import Image,ImageChops',
      'import sys',
      'frames=[Image.open(p).convert("RGB") for p in sorted(Path(sys.argv[1]).glob("*.png"))]',
      'assert all(any(ImageChops.difference(a,b).getbbox() for a,b in zip(frames[k:k+26],frames[k+1:k+27])) for k in range(0,len(frames),27))',
      'frames[0].save(sys.argv[2],save_all=True,append_images=frames[1:],duration=[67,67,66]*(len(frames)//3),loop=0,quality=78,method=3)',
      'im=Image.open(sys.argv[2]);assert im.is_animated and im.n_frames>90',
      'print(f"Animated preview: {im.n_frames} frames, {im.size}, {Path(sys.argv[2]).stat().st_size} bytes")'
    ].join('\n');
    execFileSync(python,['-c',pack,temp,output],{stdio:'inherit'});
    console.log(JSON.stringify(clips));
  }finally{
    await browser.close();
    for(const name of fs.readdirSync(temp))fs.unlinkSync(path.join(temp,name));
    fs.rmdirSync(temp);
  }
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
