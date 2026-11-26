'use strict';

const canvas = document.querySelector('#film');
const g = canvas.getContext('2d',{alpha:false});
const exporting = new URLSearchParams(location.search).has('export');
if(exporting) document.body.classList.add('export');

const {fps,duration} = filmSettings;
const total = fps * duration;
const totalTime = timeString(duration);
const slider=document.querySelector('#scrub'), play=document.querySelector('#play');
const menu=document.querySelector('#chapter'), clock=document.querySelector('#clock');
const score=document.querySelector('#score'), sound=document.querySelector('#sound');
let frame=0, playing=false, requestId=0, startTime=0, reportedAudio=false, playGeneration=0;
slider.max=String(total-1);
const roman=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];

plates.forEach((plate,i)=>{
  const option=new Option(timeString(plate.start)+'  '+plate.name,String(i));
  menu.add(option);
});
function timeString(seconds){
  return Math.floor(seconds/60)+':'+String(Math.floor(seconds)%60).padStart(2,'0');
}
function numberOfPlate(f){
  for(let i=plates.length-1;i>=0;i--) if(f>=plates[i].start*fps) return i;
  return 0;
}
function margins(i, t, secs) {
  const {text,serif,mono,ink,song,line}=Art;
  const color=ink;
  text('字 间',78,59,24,song,'left',color);
  line(149,38,149,61,'#746f66',1);
  text('Between tokens',170,59,22,serif,'left',color,'italic');
  text('FIG.  '+roman[i],1521,58,18,mono,'right',color);
  const p=plates[i];
  const cue=p.cues.filter(([from])=>from<=t).at(-1);
  if(cue) {
    const enter=Art.fade(cue[0],cue[0]+.19,t);
    Art.withAlpha(enter,()=>{
      g.font='600 29px '+song;
      const lines=subtitleLines(cue[1]);
      lines.forEach((s,j)=>text(s,800,(lines.length===1?795:777+j*38)+4*(1-enter),29,song,'center',color,'600'));
    });
  }
  text(p.en,79,861,17,serif,'left',color,'italic');
  text(timeString(secs)+'  /  '+totalTime,1521,861,16,mono,'right','#58554d');
}
const wrappedCues = new Map();
function subtitleLines(s) {
  if(wrappedCues.has(s))return wrappedCues.get(s);
  let lines=[s];
  if(g.measureText(s).width>1400){
    const candidates=Array.from(s.matchAll(/[，。、；：？！]/g), m=>m.index+1)
      .filter(n=>n>1&&n<s.length-1);
    const viable=candidates.filter(n=>
      g.measureText(s.slice(0,n)).width<1400 && g.measureText(s.slice(n)).width<1400);
    const cut=viable.sort((a,b)=>Math.abs(s.length/2-a)-Math.abs(s.length/2-b))[0]??Math.floor(s.length/2);
    lines=[s.slice(0,cut),s.slice(cut)];
  }
  wrappedCues.set(s,lines);
  return lines;
}
function drawPlate(i,t){
  const shot=plates[i];
  const id=shot.id;
  const seconds=(plates[i+1]?.start??duration)-shot.start;
  t*= (shot.drawSeconds??seconds)/seconds;
  if(id==='opening')return Art.opening(t);
  if(id==='expand')return Art.expansion(t);
  if(id==='gate')return Art.rectifier(t);
  if(id==='end'){
    const impression=Art.fade(2.45,3.05,t);
    Art.withAlpha(1-impression,()=>Atlas(t));
    return Art.withAlpha(impression,()=>Art.ending(t-2.45));
  }
  if(['tokens','qkv','scores','gather'].includes(id))return window.drawAttentionShot(id,t);
  if(['dotlab','matrixlab','headlab'].includes(id))return window.drawAttentionLab(id,t);
  if(id==='rope')return drawRotaryShot(t);
  if(id==='flash')return FlashPlate.draw(t);
  if(id==='linear')return window.drawLinearShot(t);
  if(id==='cache'||id==='gqa')return window.drawInferenceShot(id,t);
  return window.drawArchitectureShot(id,t);
}
function impression(i,t){
  Art.ground();
  g.save();drawPlate(i,t);g.restore();
}
// Iris, paired shutters and a registration wipe echo operations inside each plate.
function printCut(i,t){
  const id=plates[i].id;
  const mode={dotlab:'iris', headlab:'shutters', rope:'iris', memory:'wipe', cache:'wipe', gqa:'shutters'}[id];
  const length=mode ? 0.55 : 0.22;
  if(!i || t>=length){
    impression(i,t);return;
  }
  impression(i-1,plates[i].start-plates[i-1].start);
  const p=Art.fade(0,length,t);
  g.save();
  if(mode){
    g.beginPath();
    if(mode==='iris')g.arc(805,411,1100*p,0,2*Math.PI);
    else if(mode==='shutters'){
      g.rect(0,0,800*p,900);g.rect(1600-800*p,0,800*p,900);
    }else g.rect(0,0,1600*p,900);
    g.clip();
    impression(i,t);
  }else{
    // Cross-dissolve the ink only so the opaque paper does not fade it twice.
    Art.withAlpha(p,()=>Art.ground());
    Art.withAlpha(p,()=>drawPlate(i,t));
  }
  g.restore();
}
function render(value){
  frame=Math.max(0,Math.min(total-1,Math.round(value)));
  const secs=frame/fps, i=numberOfPlate(frame), t=secs-plates[i].start;
  g.setTransform(canvas.width/1600,0,0,canvas.height/900,0,0);
  printCut(i,t);
  margins(i,t,secs);
  slider.value=frame; menu.value=i;
  clock.textContent=timeString(frame===total-1?duration:secs)+' / '+totalTime;
}
function markPlaying(value) {
  playing=value;
  play.textContent=value?'暂停':frame===total-1?'重播':'播放';
  play.setAttribute('aria-pressed',String(value));
}
function setScoreTime(seconds) {
  if(Math.abs(score.currentTime-seconds)>.046)score.currentTime=seconds;
}
function stop(){
  playGeneration++;
  cancelAnimationFrame(requestId);
  score.pause();
  markPlaying(false);
}
function playFilm() {
  const generation=++playGeneration;
  if(frame===total-1)render(0);
  setScoreTime(frame/fps);
  startTime=performance.now()-frame*1000/fps;
  markPlaying(true);
  reportedAudio=false;
  score.play().then(()=>{
    if(playing && generation===playGeneration)reportedAudio=true;
  }).catch(()=>{
    if(playing && generation===playGeneration && !score.muted) {
      sound.textContent='音轨未就绪';
    }
  });
  requestId=requestAnimationFrame(tick);
}
function tick(now){
  if(!playing)return;
  // Once playback starts, the decoded soundtrack is the presentation clock.
  const secs=reportedAudio && !score.paused?score.currentTime:(now-startTime)/1000;
  if(secs>=duration || score.ended){render(total-1);stop();return;}
  const target=Math.floor(secs*fps);
  if(target!==frame)render(target);
  requestId=requestAnimationFrame(tick);
}
window.seekFrame=value=>{
  if(exporting){render(value);return frame;}
  stop();render(value);markPlaying(false);setScoreTime(frame/fps);
  return frame;
};
function goTo(value,resume){
  window.seekFrame(value);
  if(resume)playFilm();
}
slider.addEventListener('input',()=>goTo(Number(slider.value),false));
menu.addEventListener('change',()=>goTo(plates[Number(menu.value)].start*fps+7,playing));
play.addEventListener('click',()=>playing?stop():playFilm());
score.addEventListener('ended',()=>{if(playing){render(total-1);stop();}});
sound.addEventListener('click',()=>{
  score.muted=!score.muted;
  sound.textContent=score.muted?'声音关':'声音开';
  sound.setAttribute('aria-pressed',String(!score.muted));
});
document.querySelector('#full').addEventListener('click',async()=>{
  if(document.fullscreenElement)await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
});
document.addEventListener('keydown',e=>{
  if(e.target.matches('button,input,select'))return;
  if(e.code==='Space'){e.preventDefault();playing?stop():playFilm();}
  else if(e.code==='ArrowLeft'||e.code==='ArrowRight'){
    e.preventDefault();goTo(frame+(e.code==='ArrowLeft'?-fps:fps),false);
  }
});
function resize(){
  const dpr=exporting?1:Math.min(1.65,window.devicePixelRatio||1);
  const w=Math.max(16,Math.round(canvas.getBoundingClientRect().width*dpr));
  if(canvas.width!==w || canvas.height!==Math.round(w*9/16)){
    canvas.width=w;canvas.height=Math.round(w*9/16);
  }
  render(frame);
}
window.addEventListener('resize',resize);
resize();

