'use strict';

// A drafting compass follows one two-dimensional feature pair of a rotary head.
function drawRotaryShot(t) {
  const {fade, text, line, path, withAlpha, ink, vermilion, song, mono, serif} = Art;
  const blue = '#425e68';
  const muted = '#706e65';
  const radians = Math.PI/180;
  const originX = 458, originY = 422, radius = 213;
  const positionAngle = 30;
  const unfold = fade(.85, 3.8, t);
  const commonShift = fade(7.55, 9.75, t);
  const qPosition = unfold + commonShift;
  const kPosition = 3*unfold + commonShift;
  const qAngle = positionAngle*qPosition;
  const kAngle = positionAngle*kPosition;
  function point(deg, r=radius, cx=originX, cy=originY) {
    return [cx+r*Math.cos(radians*deg), cy-r*Math.sin(radians*deg)];
  }
  function circle(cx,cy,r,color,w=1) {
    g.beginPath();g.arc(cx,cy,r,0,2*Math.PI);g.strokeStyle=color;g.lineWidth=w;g.stroke();
  }
  function arc(start,end,r,cx=originX,cy=originY) {
    const steps=Math.max(1,Math.ceil(Math.abs(end-start)/2));
    return Array.from({length:steps+1},(_,j)=>point(start+(end-start)*j/steps,r,cx,cy));
  }
  function hand(deg,color,name,labelRadius) {
    const [xx,yy]=point(deg);
    line(originX,originY,xx,yy,color,3.8);
    const a=radians*deg,dx=Math.cos(a),dy=-Math.sin(a);
    g.beginPath();g.moveTo(xx,yy);
    g.lineTo(xx-dx*16-dy*5.5,yy-dy*16+dx*5.5);
    g.lineTo(xx-dx*16+dy*5.5,yy-dy*16-dx*5.5);g.closePath();
    g.fillStyle=color;g.fill();
    const [lx,ly]=point(deg,labelRadius);
    const side=name==='q'?1:-1;
    text(name,lx-dy*side*17,ly+dx*side*17+5,30,serif,'center',color,'italic');
  }
  text('旋转位置编码',90,143,31,song,'left');
  text('RoPE',1516,143,28,serif,'right',ink,'italic');
  line(144,originY,750,originY,'#a8a59a');
  line(originX,164,originX,688,'#aaa79d');
  circle(originX,originY,radius+12,ink,1.35);
  circle(originX,originY,radius+24,'#79766c',.9);
  circle(originX,originY,136,'#aaa79c',.8);
  for(let j=0;j<180;j++){
    const v=j*2,r=radius+24,inner=j%15===0?14:j%5===0?8:3.5;
    line(...point(v,r),...point(v,r-inner),j%15===0?ink:'#827d72',j%15===0?1.8:.75);
  }
  for(const a of [0,30,60,90,120,180,270]){
    const [x,y]=point(a,radius+45);
    text(a+'°',x,y+6,18,mono,'center',muted);
  }
  if(kAngle>qAngle+.2) {
    const edge=arc(qAngle,kAngle,120);
    g.beginPath();g.moveTo(originX,originY);
    edge.forEach(([x,y])=>g.lineTo(x,y));g.closePath();
    g.fillStyle='rgba(180,60,43,.105)';g.fill();
    path(edge,vermilion,2);
    const [lx,ly]=point((qAngle+kAngle)/2,156);
    text(Math.round(kAngle-qAngle)+'°',lx,ly+8,27,mono,'center',vermilion);
  }
  // The dotted ghosts retain the previous positions while the pair translates.
  withAlpha(Math.sin(Math.PI*commonShift)*.52,()=>{
    g.setLineDash([3,6]);
    line(originX,originY,...point(30),vermilion,1.8);
    line(originX,originY,...point(90),blue,1.8);
    g.setLineDash([]);
  });
  hand(kAngle,blue,'k',radius-37);
  hand(qAngle,vermilion,'q',radius-12);
  g.beginPath();g.arc(originX,originY,7,0,2*Math.PI);g.fillStyle=ink;g.fill();
  function positionText(first) {
    if(unfold===0)return '位置 0';
    if(unfold<1)return '位置 0 → '+first;
    if(commonShift===0)return '位置 '+first;
    if(commonShift<1)return '位置 '+first+' → '+(first+1);
    return '位置 '+(first+1);
  }
  const projection=Math.cos((kAngle-qAngle)*radians);
  text('两支单位向量，从同一方向出发',878,232,27,song,'left',muted);
  text('q',882,316,52,serif,'left',vermilion,'italic');
  text(positionText(1),955,311,28,song,'left');
  text(Math.round(qAngle)+'°',1460,314,35,mono,'right',vermilion);
  line(879,336,1462,336,'#9c998d');
  text('k',882,392,52,serif,'left',blue,'italic');
  text(positionText(3),955,386,28,song,'left');
  text(Math.round(kAngle)+'°',1460,390,35,mono,'right',blue);
  line(879,414,1462,414,'#9c998d');
  text('旋转后点积',880,473,26,song,'left',muted);
  text('cos '+Math.round(kAngle-qAngle)+'°  =  '+projection.toFixed(2),
    879,545,53,serif,'left',ink);
  withAlpha(fade(5.05,6.0,t),()=>{
    const marker=(x,y,num,color)=>{
      g.fillStyle=color;g.beginPath();g.arc(x,y,5,0,2*Math.PI);g.fill();
      text(num,x,y-19,20,mono,'center',color);
    };
    const pos=(p)=>913+p*125;
    line(pos(0),642,pos(4)+32,642,'#afaca0',1.4);
    for(let n=0;n<=4;n++){line(pos(n),636,pos(n),648,muted);text(String(n),pos(n),676,18,mono,'center',muted);}
    marker(pos(qPosition),642,'q',vermilion);marker(pos(kPosition),642,'k',blue);
    path([[pos(qPosition),605],[pos(qPosition),596],[pos(kPosition),596],[pos(kPosition),605]],ink,1.25);
    text('间隔 2',pos((kPosition+qPosition)/2),580,21,song);
  });
  withAlpha(fade(10.65,11.8,t),()=>{
    text('(Rₘq)ᵀ(Rₙk)  =  qᵀ Rₙ₋ₘ k',457,728,26,serif,'center',ink,'italic');
  });
}
