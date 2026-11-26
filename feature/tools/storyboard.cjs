'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {findPlaywright, findBrowser}=require('./environment.cjs');
const {film}=require('./production.cjs');

async function makeSheet(){
  const root=path.resolve(__dirname,'..');
  const out=path.join(root,'frames');
  fs.mkdirSync(out,{recursive:true});
  const browser=await findPlaywright().api.chromium.launch({executablePath:findBrowser(),headless:true});
  try{
    const page=await browser.newPage({viewport:{width:960,height:540}});
    page.on('pageerror',e=>{throw e;});
    await page.goto(pathToFileURL(path.join(root,'index.html')).href+'?export=1');
    const shots=film.shots.map((shot,i)=>{
      const end=film.shots[i+1]?.start ?? film.duration;
      return film.reviewSeconds.find(s=>s>=shot.start && s<end) ?? (shot.start+(end-shot.start)*.63);
    });
    const files=[];
    for(const sec of shots){
      await page.evaluate(f=>window.seekFrame(f),Math.round(sec*film.fps));
      files.push((await page.screenshot({type:'jpeg',quality:91})).toString('base64'));
    }
    const buffer=await page.evaluate(async inputs=>{
      const c=document.createElement('canvas'), cols=Math.ceil(Math.sqrt(inputs.length));
      c.width=600*cols;c.height=339*Math.ceil(inputs.length/cols);
      const ctx=c.getContext('2d');
      ctx.fillStyle='#bcb9ae';ctx.fillRect(0,0,c.width,c.height);
      for(let j=0;j<inputs.length;j++){
        const img=new Image();img.src='data:image/jpeg;base64,'+inputs[j];await img.decode();
        ctx.drawImage(img,600*(j%cols),339*Math.floor(j/cols),598,337);
      }
      return c.toDataURL('image/jpeg',.94).split(',')[1];
    },files);
    fs.writeFileSync(path.join(out,'storyboard.jpg'),Buffer.from(buffer,'base64'));
  }finally{await browser.close();}
}
makeSheet().catch(e=>{console.error(e);process.exitCode=1;});
