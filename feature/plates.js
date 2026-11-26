'use strict';

const Art = (() => {
  const ink = '#20201d';
  const vermilion = '#a5382d';
  const paper = '#e9e7df';
  const serif = '"Baskerville Old Face", "Times New Roman", "Songti SC", SimSun, serif';
  const song = '"Songti SC", SimSun, PMingLiU, serif';
  const kai = 'KaiTi, STKaiti, "Songti SC", SimSun, serif';
  const mono = 'Consolas, "Courier New", monospace';
  const tau = 2 * Math.PI;
  let paperImage, letterSeeds;
  const clamp = n => Math.max(0, Math.min(1, n));
  function fade(a, b, v) {
    const n = clamp((v - a) / (b - a));
    return n * n * (3 - 2 * n);
  }
  function rng(seed) {
    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }
  function text(s, x, y, size, family=serif, align='center', color=ink, weight='normal') {
    g.fillStyle = color;
    g.font = weight + ' ' + size + 'px ' + family;
    g.textAlign = align;
    g.textBaseline = 'alphabetic';
    g.fillText(s, x, y);
  }
  function line(x, y, xx, yy, color=ink, width=1) {
    g.beginPath();
    g.moveTo(x,y);
    g.lineTo(xx,yy);
    g.strokeStyle=color;
    g.lineWidth=width;
    g.stroke();
  }
  function path(points, color=ink, width=1) {
    g.beginPath();
    points.forEach(([x,y], i) => i ? g.lineTo(x,y) : g.moveTo(x,y));
    g.lineWidth = width;
    g.strokeStyle = color;
    g.stroke();
  }
  function withAlpha(alpha, operation) {
    if (alpha<=0) return;
    g.save();
    g.globalAlpha *= clamp(alpha);
    operation();
    g.restore();
  }
  function createPaper(scale) {
    const sheet = document.createElement('canvas');
    sheet.width = Math.round(1600*scale);
    sheet.height = Math.round(900*scale);
    const c = sheet.getContext('2d', {alpha:false});
    const pixels = c.createImageData(sheet.width,sheet.height);
    const random = rng(20170612);
    const d = pixels.data;
    const gridW=32, gridH=19;
    const clouds=Array.from({length:gridW*gridH},()=>random()*4-2);
    const cell=52*scale;
    for(let y=0; y<sheet.height; y++){
      const gy=y/cell|0, fy=fade(0,1,(y%cell)/cell);
      for(let x=0; x<sheet.width; x++) {
        const gx=x/cell|0, fx=fade(0,1,(x%cell)/cell);
        const p=gy*gridW+gx;
        const top=clouds[p]*(1-fx)+clouds[p+1]*fx;
        const bottom=clouds[p+gridW]*(1-fx)+clouds[p+gridW+1]*fx;
        const v=(random()+random()-1)*7.8+top*(1-fy)+bottom*fy;
        const i=(y*sheet.width+x)*4;
        d[i]=234+v; d[i+1]=232+v; d[i+2]=224+v; d[i+3]=255;
      }
    }
    c.putImageData(pixels,0,0);
    c.scale(scale,scale);
    for(let i=0;i<12500;i++){
      const x=random()*1600, y=random()*900, len=1+random()**2*8;
      c.beginPath(); c.moveTo(x,y);
      c.quadraticCurveTo(x+len*.4,y-.8,x+len,y+random()*2-1);
      c.lineWidth=.25+random()*.65;
      c.strokeStyle=i%5?'rgba(71,64,51,.067)':'rgba(255,255,249,.37)';
      c.stroke();
    }
    return sheet;
  }
  function ground() {
    const width=Math.max(1600,Math.min(filmSettings.width,g.canvas.width));
    if (!paperImage||paperImage.width!==width){
      paperImage=createPaper(width/1600);
    }
    g.drawImage(paperImage,0,0,1600,900);
  }
  function getLetter() {
    if(letterSeeds) return letterSeeds;
    const tile=document.createElement('canvas');
    tile.width=420; tile.height=420;
    const c=tile.getContext('2d',{willReadFrequently:true});
    c.font='390px '+kai; c.textAlign='center'; c.textBaseline='middle';
    c.fillText('坐',210,219);
    const image=c.getImageData(0,0,420,420).data;
    const random=rng(782);
    letterSeeds=[];
    for(let y=0;y<420;y+=2.65){
      for(let x=0;x<420;x+=2.65){
        const xx=x+random()*2.5, yy=y+random()*2.5;
        if((xx|0)>419 || (yy|0)>419 || image[((yy|0)*420+(xx|0))*4+3]<90) continue;
        const a=random()*tau, r=26+Math.pow(random(),.65)*287;
        letterSeeds.push({x:xx-210,y:yy-210,dx:Math.cos(a)*r*1.62,dy:Math.sin(a)*r*.72,
          radius:1+random()*1.7,s:random(),phi:random()*tau});
      }
    }
    return letterSeeds;
  }
  function opening(t) {
    const seeds=getLetter();
    const unpack=fade(2.0,6.2,t);
    const spread=fade(3.4,7.2,t);
    const scatterAlpha=(1-fade(6.1,8.35,t));
    const focus=1.54-.18*fade(0,4,t);
    withAlpha(scatterAlpha,()=>{
      g.fillStyle=ink;
      for(const p of seeds) {
        const split=fade(2+p.s*.7,5.8+p.s,t);
        const x=800+p.x*focus+p.dx*split;
        const y=406+p.y*focus+p.dy*split+Math.sin(p.phi+t)*6*spread;
        const stamp=fade(-.9+p.s*.7,1.3+p.s,t);
        const s=p.radius*(1.72-unpack*.84)*stamp;
        if(s>.05)g.fillRect(x,y,s,s*1.19);
      }
    });
    withAlpha((1-unpack)*.79,()=>{
      g.save();g.translate(800,406);g.scale(focus,focus);
      g.font='390px '+kai;g.textAlign='center';g.textBaseline='middle';g.fillStyle=ink;
      g.fillText('坐',0,9);g.restore();
    });
    const title=fade(5.9,7.5,t)*(1-fade(10.7,12,t));
    withAlpha(title,()=>{
      text('Transformer',794,452,150,serif);
      text('字  间',800,277,37,song);
      line(767,510,833,510,ink,1.7);
      text('词如何读懂彼此',800,570,29,song);
    });
    const step=fade(10.55,12,t);
    withAlpha(step,()=>{
      for(let j=0;j<4;j++){
        const x=350+j*300;
        g.fillStyle=ink;g.beginPath();g.arc(800+(x-800)*step,406,3+step*2,0,tau);g.fill();
      }
    });
  }
  // An engraved surface maps hidden width to the radius of a transverse section.
  function vessel(u,a,t){
    const spread=fade(.4,5.3,t), pulse=Math.sin(t*.64)*.045;
    const shape=Math.pow(Math.max(0,Math.sin(Math.PI*u)),.84);
    const r=25+(111+31*spread)*shape*(1+.22*Math.sin(u*tau-.35));
    const twist=(.35+spread*.52)*Math.sin(1.18*tau*u-.88)+pulse;
    const theta=a+twist;
    const pleat=1+.072*Math.cos(8*a+u*5)+.044*Math.sin(5*a-2*u);
    return [
      296+u*1008+Math.cos(theta)*r*pleat*.48,
      430+Math.sin(theta)*r*pleat+50*Math.sin(tau*u-.55)
    ];
  }
  function sideView(t) {
    const growth=.16+.84*fade(-.5,4.0,t);
    const speed=t*.102;
    withAlpha(fade(-.4,1,t),()=>{
      text('f',800,215,88,serif,'center',ink,'italic');
      text('1',827,218,23,serif);
    });
    for(let k=0;k<94;k++) {
      const a=tau*k/94, pts=[];
      for(let j=0;j<=62;j++) pts.push(vessel(growth*j/62,a,t));
      const exposure=(Math.cos(a)+1)*.5;
      path(pts,'rgba(27,26,23,'+(.17+.61*exposure**1.9)+')',k%9===0?1.8:.8);
    }
    for(let z=0;z<=37;z++){
      const u=z/37;
      if(u>growth)continue;
      const pts=[];
      for(let i=0;i<=75;i++)pts.push(vessel(u,tau*i/75,t));
      path(pts,z===0||z===37?ink:'rgba(29,28,24,.19)',z%5===0?1.3:.7);
    }
    const sweep=(speed+.10)%1, pts=[];
    for(let j=0;j<=95;j++)pts.push(vessel(Math.min(sweep,growth),tau*j/95,t));
    path(pts,vermilion,2.2);
    for(const [x,s,val,label] of [[295,0,'512','输入宽度'],[795,3.1,'2048','隐层宽度'],[1305,6.5,'512','投回原宽度']]){
      withAlpha(fade(s,s+1.4,t),()=>{
        line(x,624,x,650,'#837d72'); text(val,x,687,38);text(label,x,718,19,song);
      });
    }
  }
  function expansion(t) {
    const turn=fade(8.3,10.5,t);
    if(turn<1){
      g.save();
      g.translate(800,410);
      g.scale(1-.69*turn,1+.12*turn);
      g.translate(-800,-410);
      withAlpha(1-turn,()=>sideView(t));
      g.restore();
    }
    withAlpha(turn,()=>{
      const labels=['−1.2','+0.7','−0.4','+1.6'];
      const targets=[[346,282],[1200,282],[349,570],[1204,570]];
      text('隐层截面',800,166,40,song);
      const rx=202,ry=183,cy=428;
      for(let band=0;band<53;band++){
        const f=.07+.93*band/52;
        const pts=[];
        for(let j=0;j<=92;j++){
          const a=j/92*tau,shape=1+.082*Math.cos(7*a+.45*t)*f+.05*Math.sin(4*a-f*2.3);
          pts.push([800+f*rx*Math.cos(a)*shape,cy+f*ry*Math.sin(a)*shape]);
        }
        path(pts,band%8===0?ink:'rgba(41,39,34,.53)',band%8===0?1.55:.7);
      }
      targets.forEach(([x,y],k)=>{
        const a=[-2.65,-.60,2.62,.55][k];
        const fraction=.31+.14*k;
        const px=800+Math.cos(a)*rx*fraction,py=cy+Math.sin(a)*ry*fraction;
        const growing=fade(9.1+k*.28,10.4+k*.28,t);
        withAlpha(growing,()=>{
          const elbow=x<800?x+115:x-115;
          path([[px,py],[elbow,py],[elbow,y-8],[x+(x<800?48:-48),y-8]],vermilion,1.4);
          g.fillStyle=vermilion;g.beginPath();g.arc(px,py,4,0,tau);g.fill();
          text(labels[k],x,y+3,38,mono);
        });
      });
      text('2048 个分量中取四个示例',800,700,25,song);
    });
  }
  function rectangle(ctx,x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
  function engravingBar(x,y,baseline,scale,index,t){
    const high=Math.min(y,baseline), low=Math.max(y,baseline);
    const wide=61*scale;
    if(low-high<2){line(x-wide,baseline,x+wide,baseline,vermilion,2.2);return;}
    g.save();g.beginPath();g.rect(x-wide,high,wide*2,low-high);g.clip();
    for(let k=-225;k<330;k+=4.5){
      const drift=Math.sin(k*1.7+index)*.7+Math.sin(t*.45)*.8;
      line(x-wide+k+drift,low+2,x-wide+k+(low-high)*.78+drift,high-2,ink,k%3?1:1.4);
    }
    if(index===1||index===3)rectangle(g,x+wide*.75,high,wide*.25,low-high,'rgba(29,27,23,.22)');
    g.restore();line(x-wide,y,x+wide,y,ink,2);
  }
  function rectifier(t) {
    const base=451, erase=fade(3.5,6.4,t), condense=fade(8.2,11.5,t);
    const values=[-1.2,.7,-.4,1.6], show=fade(-.4,1.3,t);
    const cols=[422,672,922,1172];
    text('ReLU',800,230,100);
    text('max (0, x)',800,276,28,serif,'center',ink,'italic');
    line(258,base,1342,base,'#7b766d',1.15);
    text('0',234,base+7,24,mono);
    const labels=['−1.2','+0.7','−0.4','+1.6'];
    for(let k=0;k<4;k++){
      const v=values[k], x=cols[k];
      const y=base-v*81*show*(v<0?1-erase:1);
      if(v<0)withAlpha(erase*(1-condense)*.44,()=>{
        g.save();g.setLineDash([2,5]);g.strokeStyle=ink;
        g.strokeRect(x-61,base,122,-v*81);g.restore();
      });
      engravingBar(x,y,base,1-condense*.16,k,t);
      const txt=v<0&&erase>.66?'0':labels[k];
      text(txt,x,632,34,serif,'center',v<0&&erase>.66?vermilion:ink);
    }
    withAlpha(condense,()=>{
      line(594,683,719,683,'#827d71');
      line(879,683,1002,683,'#827d71');
      text('2048 → 512',800,691,24);
    });
  }
  function ending(t) {
    const press=fade(0,.9,t);
    withAlpha(press,()=>{
      text('Transformer',796,419,145);
      text('字 间',800,537,52,song);
      const w=35+17*fade(.55,4,t);
      line(800-w,467,800+w,467,vermilion,1.85);
    });
    withAlpha(fade(.8,2.3,t),()=>{
      text('Attention Is All You Need',800,643,24,serif,'center',ink,'italic');
      text('VASWANI ET AL.  /  2017',800,678,15,mono);
    });
  }
  return {ground, opening, expansion, rectifier, ending, text, line, path, withAlpha,
    fade, ink, paper, serif, mono, song, vermilion};
})();

