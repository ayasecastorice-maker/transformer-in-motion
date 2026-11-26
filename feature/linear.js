/* Kernel linear attention: two exactly equivalent orders for one positive kernel.
   Local shot time: 18 s. All data shown below are post-feature-map values. */
(function () {
  'use strict';
  const INK='#191918', PAPER='#e9e7df', RED='#b9352c';
  const SERIF='"Iowan Old Style", "Baskerville", "Times New Roman", "Songti SC", "SimSun", serif';
  const features=[[1,1],[2,1],[1,2]], values=[2,4,1], query=[1,2];
  const zStates=[[0,0],[1,1],[3,2],[4,4]], sStates=[[0,0],[2,2],[10,6],[11,8]];
  const weights=features.map(a=>a[0]*query[0]+a[1]*query[1]);
  const weighted=weights.map((w,i)=>w*values[i]);
  let c,time=0;
  const clamp=v=>Math.max(0,Math.min(1,v)), ease=v=>{v=clamp(v);return v*v*(3-2*v);};
  const fract=v=>v-Math.floor(v), hash=n=>fract(Math.sin(n*127.1+311.7)*43758.5453123);
  function alpha(a,draw){c.save();c.globalAlpha*=clamp(a);draw();c.restore();}
  function text(value,x,y,size=24,color=INK,align='center',italic=false){c.save();c.fillStyle=color;c.font=`${italic?'italic ':''}${size}px ${SERIF}`;c.textAlign=align;c.textBaseline='middle';c.fillText(value,x,y);c.restore();}
  function line(points,color=INK,width=1.8,opacity=1){if(points.length<2)return;c.save();c.globalAlpha*=opacity;c.strokeStyle=color;c.lineWidth=width;c.lineCap='butt';c.lineJoin='miter';c.beginPath();c.moveTo(...points[0]);points.slice(1).forEach(p=>c.lineTo(...p));c.stroke();c.restore();}
  function rect(x,y,w,h,fill=null,stroke=INK,width=1.8){c.save();if(fill){c.fillStyle=fill;c.fillRect(x,y,w,h);}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.strokeRect(x,y,w,h);}c.restore();}
  function circle(x,y,r,fill=RED){c.save();c.fillStyle=fill;c.beginPath();c.arc(x,y,r,0,2*Math.PI);c.fill();c.restore();}
  function grain(x,y,w,h,seed,opacity=.11){c.save();c.globalAlpha*=opacity;c.fillStyle=INK;for(let i=0;i<w*h/125;i++){const r=.5+hash(i*7.3+seed);c.fillRect(x+2+hash(i*3.9+seed)*(w-4),y+2+hash(i*9.1+seed)*(h-4),r,r);}c.restore();}
  function plate(cx,cy,w,h,selected=false,seed=1){const x=cx-w/2,y=cy-h/2;rect(x,y,w,h,PAPER,selected?RED:INK,selected?2.5:1.8);grain(x,y,w,h,seed);for(let yy=y+7;yy<y+h-5;yy+=8)line([[x+5,yy],[x+w-5,yy]],INK,.6,.07);}
  function pathData(points){const lengths=[];let total=0;for(let i=1;i<points.length;i++){const length=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);lengths.push(length);total+=length;}return{lengths,total};}
  function sample(points,amount){const{lengths,total}=pathData(points);let d=clamp(amount)*total;for(let i=0;i<lengths.length;i++){if(d<=lengths[i]||i===lengths.length-1){const u=lengths[i]?d/lengths[i]:0;return[points[i][0]+(points[i+1][0]-points[i][0])*u,points[i][1]+(points[i+1][1]-points[i][1])*u];}d-=lengths[i];}return points[0];}
  function segment(points,from,to,color=RED,width=2.6,opacity=1){from=clamp(from);to=clamp(to);if(to<=from)return;const{lengths,total}=pathData(points);const part=[sample(points,from)];let passed=0;for(let i=0;i<lengths.length-1;i++){passed+=lengths[i];const u=passed/total;if(u>from&&u<to)part.push(points[i+1]);}part.push(sample(points,to));line(part,color,width,opacity);}
  function travel(points,start,duration,color=RED,keep=false){const p=ease((time-start)/duration);if(p<=0)return;alpha(keep?1:1-ease((time-start-duration)/.65),()=>{line(points,INK,1.6,.16);segment(points,Math.max(0,p-.24),p,color,2.8);const xy=sample(points,p);circle(xy[0],xy[1],4,color);if(keep)segment(points,0,p,color,1.8,.55);});}
  function vector(value){return '['+value.join(', ')+']';}
  function printRegister(){[[102,103],[1495,103],[102,722],[1495,722]].forEach(([x,y])=>{line([[x-4,y],[x+4,y]],INK,.8,.18);line([[x,y-4],[x,y+4]],INK,.8,.18);});}

  function inputs(){
    const keyX=[620,960,1300];
    text('KERNEL LINEAR ATTENTION',112,113,28,INK,'left');
    text('一个核 · 两条计算路径',1473,113,25,INK,'right');
    text('正特征 φ(x) = ELU(x) + 1     κ(q,k) = φ(q)ᵀφ(k)',800,153,24);
    // Input cards show positive post-map features; they are not raw q/k coordinates.
    plate(230,222,230,88,time<3||time>=10&&time<12,11);
    text('u = φ(q)',230,201,24);text(vector(query),230,241,32,RED);
    keyX.forEach((x,i)=>{
      const active=(time>=3+i*.85&&time<3.8+i*.85)||(time>=6.2+i*1.15&&time<7.25+i*1.15);
      plate(x,222,270,88,active,20+i);
      text('a'+['₁','₂','₃'][i]+' = φ(k'+['₁','₂','₃'][i]+') = '+vector(features[i]),x,201,25);
      text('v'+['₁','₂','₃'][i]+' = '+values[i],x,241,27,active?RED:INK);
      if(time<3){const scan=ease((time-i*.35)/1.4);line([[x-126+252*scan,184],[x-126+252*scan,260]],RED,1.4,.35*(1-ease((time-2.3)/.5)));}
    });
  }
  function pairwise(){
    text('逐对计算',390,320,30);text('κⱼ = uᵀaⱼ',390,356,23,INK,'center',true);
    const ys=[403,455,507];
    ys.forEach((y,i)=>{
      const progress=ease((time-3.25-i*.85)/.45),active=time>=3+i*.85&&time<4+i*.85;
      line([[147,y+24],[677,y+24]],INK,1.2,.22);
      text('j = '+(i+1),174,y,23,active?RED:INK);
      alpha(.2+.8*progress,()=>{
        text(query[0]+'×'+features[i][0]+' + '+query[1]+'×'+features[i][1],326,y,25);
        text('= '+weights[i],457,y,28,active?RED:INK);
        text('× '+values[i]+' = '+weighted[i],590,y,29,active?RED:INK);
      });
      // Source marks arrive at each row, then the complete expression is inked.
      travel([[620+i*340,266],[620+i*340,282+i*7],[752,282+i*7],[752,y],[690,y]],3+i*.85,.55,RED);
      if(active)line([[147,y-18],[147,y+18]],RED,3);
    });
    travel([[230,266],[230,289],[119,289],[119,403],[144,403]],2.6,.7,RED);
    const final=ease((time-14.2)/.75);
    alpha(ease((time-5.65)/.6)*(1-final),()=>{
      text('Σ κⱼvⱼ = 6 + 16 + 5 = 27',402,565,27);
      text('Σ κⱼ = 3 + 4 + 5 = 12',402,604,26);
    });
  }
  function accumulators(){
    text('先累积，再查询',1190,320,30);
    const starts=[6.2,7.35,8.5],state=starts.reduce((n,start)=>n+(time>=start+.75?1:0),0);
    let active=-1;for(let i=0;i<starts.length;i++)if(time>=starts[i]&&time<starts[i]+1.05)active=i;
    text('z = Σ aⱼ',907,395,28,INK,'left',true);text('S = Σ aⱼvⱼᵀ',907,473,28,INK,'left',true);
    plate(1288,394,218,60,active>=0,91);plate(1288,472,218,60,active>=0,92);
    text(vector(zStates[state]),1288,394,34,active>=0?RED:INK);
    text(vector(sStates[state]),1288,472,34,active>=0?RED:INK);
    // Discrete state values update only when each complete contribution arrives.
    for(let i=0;i<3;i++){
      const start=starts[i],x=[620,960,1300][i];
      travel([[x,266],[x,278+i*8],[1463,278+i*8],[1463,394],[1399,394]],start,.75,RED);
      travel([[x,266],[x,278+i*8],[1463,278+i*8],[1463,472],[1399,472]],start,.75,INK);
    }
    if(active>=0&&time<starts[active]+.75){
      const a=features[active],v=values[active];
      alpha(1-ease((time-starts[active]-.5)/.25),()=>{
        text('+ '+vector(a),1122,395,21,RED);
        text('+ '+vector(a.map(x=>x*v)),1122,473,21,RED);
      });
    }
    text('z: 2 个数     S: 2 × 1 个数',1197,526,21,'#6f6b62');
    const final=ease((time-14.2)/.75),queryReveal=ease((time-10.25)/.55);
    alpha(queryReveal*(1-final),()=>{
      text('uᵀS = 1×11 + 2×8 = 27',1191,565,26);
      text('uᵀz = 1×4 + 2×4 = 12 > 0',1191,604,25);
    });
    travel([[230,266],[230,280],[815,280],[815,565],[912,565]],9.5,1.1,RED);
    // A brief row-wise readout highlights the two dot products separately.
    if(time>=10.3&&time<11.8){const y=time<11?565:604;line([[925,y+17],[1457,y+17]],RED,2.1,.6);}
  }
  function merge(){
    const reveal=ease((time-11.7)/1.0);
    alpha(1-ease((time-14.2)/.75),()=>{
      travel([[570,565],[673,565],[673,653],[691,653]],11.7,.9,RED,true);
      travel([[1018,565],[927,565],[927,653],[909,653]],11.7,.9,RED,true);
    });
    alpha(.12+.88*reveal,()=>{
      plate(800,647,210,102,reveal>.5,410);
      text('y = uᵀS / uᵀz',800,616,21,INK,'center',true);
      text(reveal>.2?'2.25':'?',800,659,49,RED);
      if(reveal>.2)text('27 / 12',800,689,19);
    });
  }
  function scaling(){
    const a=ease((time-14.2)/.75);if(a<=0)return;
    alpha(a,()=>{
      const length=4+Math.min(8,Math.floor(Math.max(0,time-14.4)*2.5)),cell=9;
      text('把查询也扩展到 T 个',397,554,23);
      for(let row=0;row<length;row++)for(let col=0;col<length;col++){
        const focused=row===Math.floor(time*3)%length;
        rect(149+col*cell,574+row*cell,6,6,focused?RED:INK,null);
      }
      text('T = '+length,424,596,29);text('T × T 个两两权重',424,636,24);text('O(T²)',424,679,31,INK,'center',true);
      text('固定 r、dᵥ：累积状态尺寸不随 T 增长',1187,554,22);
      // The number of state slots stays four as the input stream gets longer.
      const x0=1041;
      for(let i=0;i<4;i++){
        plate(x0+i*95,605,70,52,false,520+i);
        text(['z₁','z₂','S₁','S₂'][i],x0+i*95,605,27,i===Math.floor(time*3)%4?RED:INK);
      }
      text('z',1088,650,22,INK,'center',true);text('S',1278,650,22,INK,'center',true);
      line([[1006,637],[1170,637]],INK,1.2,.6);line([[1196,637],[1360,637]],INK,1.2,.6);
      text('核心计算 O(T r dᵥ) → 对 T 线性',1187,685,25,RED);
      // Travelling source marks change count, not the state dimensions.
      for(let i=0;i<length;i++){const p=fract(time*.25+i/length);rect(941+p*472,536,3,3,RED,null);}
    });
  }
  function notes(){
    let value='以下为映射后的正特征；本例三个键均可见。';
    if(time>=6.2&&time<11.7)value='结合律：先计算 S、z；因果版本只累积截至当前位置的前缀。';
    else if(time>=11.7&&time<14.2)value='同一个核，两条路径：27 ÷ 12 = 2.25。';
    else if(time>=14.2)value='通常改变或近似 softmax；同一核两路等价 ≠ 任意 softmax 精确加速。';
    text(value,800,724,22,time>=14.2?RED:INK);
  }
  window.drawLinearShot=function(t){
    c=window.g||(typeof g!=='undefined'?g:null);if(!c)throw new Error('drawLinearShot requires the global Canvas2D context g.');
    time=Math.max(0,Math.min(18,Number.isFinite(t)?t:0));
    c.save();c.beginPath();c.rect(75,85,1450,650);c.clip();
    printRegister();pairwise();accumulators();inputs();merge();scaling();notes();
    c.restore();
  };
})();
