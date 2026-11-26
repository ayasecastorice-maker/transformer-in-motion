/* Orthogonal engraved-paper illustrations. Local time is deterministic and seekable. */
(function () {
  'use strict';
  const INK='#191918', PAPER='#e9e7df', RED='#b9352c';
  const SERIF='"Iowan Old Style", "Baskerville", "Times New Roman", "Songti SC", "SimSun", serif';
  let c, clock=0;
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const ease=v=>{v=clamp(v);return v*v*(3-2*v);};
  const fract=v=>v-Math.floor(v), hash=n=>fract(Math.sin(n*127.1+311.7)*43758.5453123);
  function alpha(a,draw){c.save();c.globalAlpha*=clamp(a);draw();c.restore();}
  function text(value,x,y,size=24,color=INK,align='center',italic=false){c.save();c.fillStyle=color;c.font=`${italic?'italic ':''}${size}px ${SERIF}`;c.textAlign=align;c.textBaseline='middle';c.fillText(value,x,y);c.restore();}
  function line(points,color=INK,width=1.8,opacity=1){if(points.length<2)return;c.save();c.globalAlpha*=opacity;c.strokeStyle=color;c.lineWidth=width;c.lineJoin='miter';c.lineCap='butt';c.beginPath();c.moveTo(...points[0]);points.slice(1).forEach(p=>c.lineTo(...p));c.stroke();c.restore();}
  function rect(x,y,w,h,fill=null,stroke=INK,width=1.8){c.save();if(fill){c.fillStyle=fill;c.fillRect(x,y,w,h);}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.strokeRect(x,y,w,h);}c.restore();}
  function circle(x,y,r,fill=null,stroke=INK,width=1.6){c.save();c.beginPath();c.arc(x,y,r,0,2*Math.PI);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}c.restore();}
  function arrow(x,y,direction,color=INK,size=7){const dx=Math.cos(direction),dy=Math.sin(direction);line([[x-size*dx+size*.45*dy,y-size*dy-size*.45*dx],[x,y],[x-size*dx-size*.45*dy,y-size*dy+size*.45*dx]],color,1.8);}
  function stipple(x,y,w,h,count,seed,color=INK,opacity=.13){c.save();c.fillStyle=color;c.globalAlpha*=opacity;for(let i=0;i<count;i++){const r=.5+hash(seed+i*2.7);c.fillRect(x+hash(seed+i*4.3)*Math.max(0,w-r),y+hash(seed+i*7.1)*Math.max(0,h-r),r,r);}c.restore();}
  // Flat axis-aligned silhouettes, without perspective, rotation, or offset shadow.
  function plate(cx,cy,w,h,seed=1,selected=false){const x=cx-w/2,y=cy-h/2;rect(x,y,w,h,PAPER,selected?RED:INK,selected?2.6:2);alpha(.08,()=>{for(let yy=y+7;yy<y+h-5;yy+=7)line([[x+6,yy],[x+w-6,yy]],INK,.65);});stipple(x+5,y+5,w-10,h-10,Math.floor(w*h/100),seed);}
  function pathInfo(points){const lengths=[];let total=0;for(let i=1;i<points.length;i++){const d=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);lengths.push(d);total+=d;}return{lengths,total};}
  function sampled(points,progress){const{lengths,total}=pathInfo(points);let remaining=clamp(progress)*total;for(let i=0;i<lengths.length;i++){if(remaining<=lengths[i]||i===lengths.length-1){const u=lengths[i]?remaining/lengths[i]:0;return[points[i][0]+(points[i+1][0]-points[i][0])*u,points[i][1]+(points[i+1][1]-points[i][1])*u];}remaining-=lengths[i];}return points[0];}
  // Draw only a travelled interval, retaining all right-angle corners.
  function pathInterval(points,from,to,color=RED,width=2.8,opacity=1){from=clamp(from);to=clamp(to);if(to<=from)return;const{lengths,total}=pathInfo(points);if(!total)return;const segment=[sampled(points,from)];let distance=0;for(let i=0;i<lengths.length-1;i++){distance+=lengths[i];const u=distance/total;if(u>from&&u<to)segment.push(points[i+1]);}segment.push(sampled(points,to));line(segment,color,width,opacity);}
  function flow(points,phase=0,color=RED,speed=.2,opacity=1,reveal=1){line(points,INK,1.8,opacity*.4);const end=clamp(reveal),u=fract(clock*speed+phase)*end;pathInterval(points,0,end,INK,1.8,opacity*.4);pathInterval(points,Math.max(0,u-.2),u,color,2.8,opacity);if(end>.01){const p=sampled(points,u);alpha(opacity,()=>circle(p[0],p[1],3.5,color,null));if(end<1){const q=sampled(points,end);alpha(opacity,()=>circle(q[0],q[1],3.7,color,null));}}if(end>.98){const last=points[points.length-1],before=points[points.length-2];alpha(opacity,()=>arrow(last[0],last[1],Math.atan2(last[1]-before[1],last[0]-before[0]),color,6));}}
  function journey(points,start,duration,color=RED,opacity=1){const progress=ease((clock-start)/duration);line(points,INK,1.8,.28*opacity);pathInterval(points,0,progress,color,2.6,opacity);if(progress>0&&progress<1){const p=sampled(points,progress);alpha(opacity,()=>circle(p[0],p[1],4,color,null));}if(progress===1)flow(points,start*.13,color,.17,.6*opacity);}
  function registration(){[[103,122],[1496,122],[103,689],[1496,689]].forEach(([x,y])=>{line([[x-4,y],[x+4,y]],INK,.8,.18);line([[x,y-4],[x,y+4]],INK,.8,.18);});}
  function plusNode(x,y,selected=false){circle(x,y,18,PAPER,selected?RED:INK,2);line([[x-7,y],[x+7,y]],selected?RED:INK,2);line([[x,y-7],[x,y+7]],selected?RED:INK,2);}
  function layerNorm(x,y,selected){plate(x,y,230,40,81,selected);text('LayerNorm',x,y,24,selected?RED:INK);}

  function block(t){
    const x=790,phase=Math.min(4,Math.floor(t/2.55));
    text('POST-LN · 2017',165,143,26,INK,'left');
    line([[374,207],[348,207],[348,612],[374,612]],INK,2,.65);
    text('N ×',260,393,50,INK,'center',true);text('完整编码器层',258,447,23);
    text('y = LN(z + FFN(z))',1140,276,24,phase>=3?INK:'#8b887f','left',true);
    text('z = LN(x + Attention(x))',1140,492,22,phase>=1?INK:'#8b887f','left',true);
    // Original upward Post-LN order: attention, Add, Norm, FFN, Add, Norm.
    journey([[x,656],[x,608]],.1,.8);journey([[x,526],[x,511]],1.4,.55);
    journey([[x,475],[x,466]],3,.35);journey([[x,426],[x,397]],4.1,.7);
    journey([[x,309],[x,296]],6.4,.55);journey([[x,260],[x,252]],8,.35);
    journey([[x,212],[x,171]],9.5,1.1);
    journey([[x,629],[514,629],[514,493],[772,493]],1.8,1.3,phase===1?RED:INK);
    journey([[x,411],[1082,411],[1082,278],[808,278]],6.7,1.25,phase===3?RED:INK);
    text('x',492,564,29,INK,'center',true);text('z',1100,346,29,INK,'center',true);
    plate(x,567,390,82,83,phase===0);
    for(let h=0;h<4;h++){const hx=x-137+h*91,active=phase===0&&h===Math.floor(t*1.8)%4;for(let row=0;row<3;row++)for(let col=0;col<6;col++){const amount=.17+hash(h*51+row*7+col)*.65;alpha(amount,()=>rect(hx+col*9,539+row*9,6,6,active?RED:INK,null));}}
    text('Multi-head attention',x,587,25,phase===0?RED:INK);
    plusNode(x,493,phase===1);layerNorm(x,446,phase===1);
    plate(x,353,360,88,144,phase===2);
    const columns=[[x-123,4],[x,8],[x+123,4]];
    columns.forEach(([px,count],column)=>{for(let j=0;j<count;j++){const yy=326+j*38/(count-1);if(column<2)line([[px+5,yy],[px+62,yy],[px+62,345],[columns[column+1][0]-5,345]],INK,.8,.24);circle(px,yy,3.5,phase===2&&(j+column)%3===Math.floor(t*2)%3?RED:PAPER,INK,1.1);}});
    text('d → d_ff → d',x,382,20);text('Feed-forward',553,351,25,phase===2?RED:INK,'right');
    plusNode(x,278,phase===3);layerNorm(x,232,phase===3);text('下一层',842,172,23,INK,'left');
    for(let i=0;i<8;i++){const height=15+hash(i+41)*16,bx=x-101+i*27;rect(bx,674-height,13,height,i===Math.floor(t*1.1)%8?RED:INK,null);stipple(bx,674-height,13,height,8,i+12,PAPER,.55);}
    text('token 表示 x',974,662,23,INK,'left');
    alpha(ease((t-8)/1.2),()=>{text('Add → Norm',1182,568,30,RED,'left');text('残差相加后，再归一化',1182,611,22,INK,'left');text('图中省略 Dropout',1182,652,20,INK,'left');});
  }

  function decoderLayer(x,y,selected,seed){
    plate(x,y,430,126,seed,selected);line([[x-215,y-21],[x+215,y-21]],INK,1.4,.4);line([[x-215,y+21],[x+215,y+21]],INK,1.4,.4);
    text('Feed-forward',x+12,y-42,25);text('Cross attention',x+12,y,27,selected?RED:INK);text('Masked self attention',x+12,y+42,24);
    const qx=x-180;flow([[qx,y+41],[qx,y+2]],seed*.03,selected?RED:INK,.26,.85);rect(qx-14,y+16,28,23,PAPER,null);text('Q',qx,y+28,21,RED,'center',true);
  }
  function memory(t){
    const ex=290,dx=1215,bus=755,ys=[560,405,250];
    const selected=Math.min(2,Math.floor(Math.max(0,t-4.8)/2.6));
    text('ENCODER',ex,132,30);text('DECODER',dx,132,30);text('最终表示 H',618,124,25);
    ys.forEach((cy,i)=>{plate(ex,cy,300,116,30+i,t<2.5&&i===Math.min(2,Math.floor(t/.8)));for(let row=0;row<4;row++)for(let col=0;col<12;col++)alpha(.09+hash(row*35+col*3+i)*.14,()=>rect(ex-123+col*22,cy-40+row*23,8,7,INK,null));rect(ex-100,cy-22,200,44,PAPER,null);text(i===2?'Encoder N':i===1?'···':'Encoder 1',ex,cy,i===1?36:28);if(i<2)journey([[ex,cy-58],[ex,ys[i+1]+58]],.5+i*.75,.5,INK);});
    flow([[ex,645],[ex,618]],.1,RED,.25);text('源序列',ex,675,25);
    journey([[ex,192],[ex,173],[548,173]],1.8,1.1);
    // Share H, not projected K/V: each decoder layer has its own learned projections.
    for(let row=0;row<4;row++)for(let col=0;col<8;col++){const xx=558+col*21,yy=153+row*18,active=Math.floor((t-2)*7)%8===col;rect(xx,yy,11,10,active&&t>2?RED:INK,null);}
    journey([[717,173],[bus,173],[bus,560]],2.7,2.1);text('H',bus,133,27,RED,'center',true);
    ys.forEach((cy,i)=>{const active=i===selected&&t>=4.8,reveal=ease((t-4.8-i*2.6)/.95);
      flow([[bus,cy],[805,cy]],i*.23,active?RED:INK,.2,.35+.65*reveal,reveal);circle(bus,cy,4.2,PAPER,active?RED:INK,1.7);
      plate(855,cy,100,76,190+i,active);line([[805,cy],[905,cy]],INK,1.2,.35);
      text('Wᴷ'+(i===2?'ᴺ':String(i+1)),855,cy-19,23,active?RED:INK);text('Wⱽ'+(i===2?'ᴺ':String(i+1)),855,cy+19,23,active?RED:INK);
      flow([[905,cy-12],[1000,cy-12]],.25+i*.25,active?RED:INK,.27,.3+.7*reveal,reveal);flow([[905,cy+12],[1000,cy+12]],.6+i*.25,active?RED:INK,.27,.3+.7*reveal,reveal);
      text('Kℓ',951,cy-34,21,active?RED:INK,'center',true);text('Vℓ',951,cy+34,21,active?RED:INK,'center',true);
      decoderLayer(dx,cy,active,100+i);if(i<2)flow([[dx,cy-63],[dx,ys[i+1]+63]],i*.3,RED,.22,.85);
    });
    flow([[dx,647],[dx,623]],.5,RED,.24);text('右移的目标前缀',dx,677,25);
    text('同一 H，各层独立投影 Kℓ、Vℓ',755,644,23);text('各子层的 Add → Norm 示意省略',755,680,20,'#69665f');
  }

  function mask(t){
    const x=484,y=183,cell=73,n=6,rx=1010,step=74,labels=['BOS','猫','坐','下','…','…'];
    const selected=Math.min(3,Math.floor(t/3.2)),local=t-selected*3.2,previous=Math.max(0,selected-1),transition=ease(local/.55);
    const centerY=y+(previous+(selected-previous)*transition+.5)*cell;
    const scores=[.4,1.2,.8,.6,1,.2],denominator=scores.slice(0,selected+1).reduce((sum,z)=>sum+Math.exp(z),0),weights=scores.map((z,i)=>i<=selected?Math.exp(z)/denominator:0),sweep=clamp(local/1.15)*n;
    text('KEY / 可读取的位置',x+cell*n/2,123,25);labels.forEach((value,i)=>text(value,x+(i+.5)*cell,157,value==='BOS'?21:25));
    for(let row=0;row<n;row++)for(let col=0;col<n;col++){const bx=x+col*cell,by=y+row*cell,visible=col<=row;if(visible){rect(bx+3,by+3,cell-6,cell-6,'rgba(25,25,24,0.035)',null);const active=row===selected&&col<=sweep;for(let k=0;k<62;k++)circle(bx+9+hash(k*3.7+row*98+col*5)*(cell-18),by+9+hash(k*7.4+row*51+col*43)*(cell-18),.85+hash(k*8+col),active?RED:INK,null);}else text('−∞',bx+cell/2,by+cell/2,23,row===selected&&col<=sweep?RED:'#a6a298');}
    for(let i=0;i<=n;i++){line([[x+i*cell,y],[x+i*cell,y+n*cell]],INK,i===0||i===n?2:1.1,i===0||i===n?.8:.28);line([[x,y+i*cell],[x+n*cell,y+i*cell]],INK,i===0||i===n?2:1.1,i===0||i===n?.8:.28);}
    rect(x,y+selected*cell,cell*(selected+1),cell,null,RED,2.6);if(local<1.15)line([[x+sweep*cell,y+selected*cell],[x+sweep*cell,y+(selected+1)*cell]],RED,2.5,.8);
    circle(248,centerY,49,PAPER,INK,2);text('Q',248,centerY-1,59,INK,'center',true);flow([[297,centerY],[470,centerY]],.15,RED,.27);text('当前位置 i',248,centerY+79,25);text('QUERY',248,138,25);
    text('只读取 j ≤ i',250,590,26,RED);text('未来位置权重为 0',250,634,22);text('可见前缀：'+labels.slice(0,selected+1).join('  '),x+cell*n/2,659,24);
    // Attention normalization is distinct from the output vocabulary distribution.
    text('MASK → SOFTMAX',1220,135,28);text('一行 attention logits（示意）',1220,192,23);
    labels.forEach((value,i)=>text(value,rx+i*step,233,value==='BOS'?19:23));scores.forEach((z,i)=>text(z.toFixed(1),rx+i*step,275,25));
    alpha(ease((local-.45)/.5),()=>{line([[998,304],[1392,304]],INK,1.4,.4);text('+ causal mask',1220,332,23,RED);scores.forEach((z,i)=>{rect(rx+i*step-31,365,62,49,i>selected?'rgba(185,53,44,0.045)':PAPER,i>selected?RED:INK,1.3);text(i<=selected?z.toFixed(1):'−∞',rx+i*step,389,24,i<=selected?INK:RED);});});
    const normalized=ease((local-1.25)/.8);
    alpha(normalized,()=>{text('softmax：仅在可见位置归一化',1220,450,22);weights.forEach((value,i)=>{const height=value*112*normalized;rect(rx+i*step-22,574-height,44,height,i<=selected?RED:INK,null);line([[rx+i*step-25,574],[rx+i*step+25,574]],INK,1.2,.6);text(value.toFixed(2),rx+i*step,601,23,i<=selected?RED:'#8b887f');});text('Σ αᵢⱼ = 1',1220,645,26,RED,'center',true);});
    text('注意力权重 ≠ 输出词概率',1220,683,22);
  }

  function output(t){
    const stage=Math.min(2,Math.floor(t/4)),local=t-stage*4,words=['猫','坐','下'];
    const candidates=[[['猫',.72],['狗',.18],['鸟',.10]],[['坐',.62],['站',.23],['跑',.15]],[['下',.81],['好',.11],['着',.08]]][stage];
    const ex=248,dx=590,bus=420,ys=[539,411,283],activeLayer=local<1.8?Math.min(2,Math.floor(local/.6)):-1;
    const distribution=ease((local-1.65)/.55),chosen=ease((local-2.2)/.4),returned=ease((local-2.65)/.95);
    text('ENCODER',ex,140,28);text('DECODER',dx,140,28);
    ys.forEach((cy,i)=>{plate(ex,cy,218,86,330+i);text(i===2?'Eᴺ':'E'+(i+1),ex,cy,32,INK,'center',true);plate(dx,cy,218,86,340+i,activeLayer===i);text(i===2?'Dᴺ':'D'+(i+1),dx,cy,32,activeLayer===i?RED:INK,'center',true);
      if(i<2){flow([[ex,cy-43],[ex,ys[i+1]+43]],i*.3,INK,.21,.65);const p=ease((local-.45-i*.6)/.35),path=[[dx,cy-43],[dx,ys[i+1]+43]];line(path,INK,1.8,.35);pathInterval(path,0,p,RED,3.2);if(p>0){const q=sampled(path,p);circle(q[0],q[1],3.4,RED,null);}}
    });
    flow([[ex,240],[ex,199],[bus,199],[bus,539]],.13,INK,.12,.7);text('H → Kℓ,Vℓ',bus,174,21,RED,'center',true);ys.forEach((cy,i)=>flow([[bus,cy],[481,cy]],.2+i*.24,activeLayer===i?RED:INK,.22,activeLayer===i?1:.5));
    flow([[ex,626],[ex,582]],.31,INK,.24);text('源序列',ex,653,25);
    const input=[[dx,618],[dx,582]];line(input,INK,1.8,.35);pathInterval(input,0,ease(local/.45),RED,2.8);
    const feedback=[[1144,577],[1144,610],[dx,610],[dx,582]];alpha(chosen,()=>{line(feedback,INK,1.8,.4);pathInterval(feedback,0,returned,RED,2.8);if(returned>0){const p=sampled(feedback,returned);circle(p[0],p[1],4,RED,null);}});
    text(['BOS',...words.slice(0,stage+(returned>=.99?1:0))].join('  '),dx,653,26,RED);text('推理：每个新词均经过全部 N 层',450,690,23);
    const readout=[[dx,240],[dx,201],[829,201],[829,285],[951,285]];line(readout,INK,1.8,.35);pathInterval(readout,0,ease((local-1.35)/.6),RED,2.8);text('Linear → Softmax',737,176,23);
    text('已生成',1191,132,25);['BOS',...words].forEach((token,i)=>{const tx=989+i*130,current=i===stage+1,visible=i<=stage||current&&chosen>0;if(visible)alpha(current?chosen:1,()=>{plate(tx,206,108,72,440+i,current);text(token,tx,206,i===0?25:47,current?RED:INK);});else line([[tx-36,241],[tx+36,241]],INK,1.5,.23);});
    text('p(next token | prefix)',1202,284,25,INK,'center',true);
    candidates.forEach(([token,probability],i)=>{const yy=351+i*76,width=probability*366*distribution;text(token,958,yy,43,i===0?RED:INK);alpha(.15+.85*distribution,()=>{rect(1005,yy-16,width,32,i===0?RED:INK,null);if(width>2)stipple(1005,yy-16,width,32,Math.floor(width/2),555+i*77,PAPER,.55);text(Math.round(probability*100)+'%',1420,yy,27,i===0?RED:INK);});});
    alpha(chosen,()=>text('本次选择：'+words[stage],1194,566,26,RED));
    text('训练：真实前缀 + 因果掩码，并行预测',1192,637,22);text('输入 BOS 猫 坐 → 目标 猫 坐 下',1192,665,21);text('以上概率为人工示意，非模型实测',1192,691,20,'#69665f');
  }
  window.drawArchitectureShot=function(id,t){c=window.g||(typeof g!=='undefined'?g:null);if(!c)throw new Error('drawArchitectureShot requires the global Canvas2D context g.');clock=Math.max(0,Number.isFinite(t)?t:0);c.save();c.beginPath();c.rect(75,100,1450,600);c.clip();registration();if(id==='block')block(clock);else if(id==='memory')memory(clock);else if(id==='mask')mask(clock);else if(id==='output')output(clock);c.restore();};
})();
