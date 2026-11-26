'use strict';

// One scalar channel of the same weighted sum, evaluated with an online softmax.
const FlashPlate = (() => {
  const {ink, vermilion:warm}=Art;
  const muted='#57564d', hair='#8c877a';
  const scores=[1,.5,1.5,0], values=[1,0,1,0], names=['小猫','坐在','垫子','上'];
  const tiles=[[0,1],[2,3]];
  const checkpoints=[];
  let m=-Infinity,l=0,u=0, lattice;
  for(const tile of tiles){
    const next=Math.max(m,...tile.map(i=>scores[i]));
    const factor=Math.exp(m-next);
    l=l*factor;u=u*factor;
    for(const i of tile){
      const e=Math.exp(scores[i]-next);l+=e;u+=e*values[i];
    }
    m=next;checkpoints.push({m,l,u,factor});
  }
  const {fade,text,line,withAlpha,mono,serif,song}=Art;
  function label(s,x,y,size=21,align='left',color=muted){
    text(s,x,y,size,song,align,color);
  }
  function number(s,x,y,size,align='left',color=ink){
    text(s,x,y,size,mono,align,color);
  }
  function createLattice(){
    const c=document.createElement('canvas');c.width=c.height=384;
    const d=c.getContext('2d');
    for(let row=0;row<64;row++)for(let col=0;col<64;col++){
      const wave=(Math.sin(col*.39-row*.21)+Math.cos(row*.62+col*.32))*.25+.5;
      const a=.17+wave*.55+.19*Math.exp(-Math.abs(row-col)/6);
      d.fillStyle='rgba(43,41,34,'+Math.min(1,a)+')';
      d.fillRect(col*6,row*6,4.1,4.1);
    }
    return c;
  }
  function squareCost(t){
    if(!lattice)lattice=createLattice();
    const stage=t<.65?0:t<1.3?1:t<2?2:3;
    const n=[64,256,1024,4096][stage];
    const zoom=1.95-.95*fade(0,2.55,t);
    const ox=932,oy=168,w=428;
    g.save();g.beginPath();g.rect(ox,oy,w,w);g.clip();
    g.drawImage(lattice,ox,oy,w*zoom,w*zoom);
    const side=w/4, active=Math.min(15,Math.floor(t*4.3));
    g.fillStyle='rgba(165,56,45,.13)';g.fillRect(ox+(active%4)*side,oy+(active>>2)*side,side,side);
    g.strokeStyle=warm;g.lineWidth=3;g.strokeRect(ox+(active%4)*side+2,oy+(active>>2)*side+2,side-4,side-4);
    g.restore();
    number('N × N',ox,oy-24,22);label('分数矩阵示意',ox+w,oy+w+39,22,'right');
    text('N²',171,347,154,serif,'left',ink,'italic');
    number(n.toLocaleString('en-US')+' × '+n.toLocaleString('en-US'),177,442,47);
    number((n*n).toLocaleString('en-US'),177,535,69,'left',warm);
    label('每头分数个数',183,581,25);
    withAlpha(fade(1.85,2.45,t),()=>{
      line(178,625,804,625,hair);
      number('FP16',178,673,27);
      text('32 MiB',805,676,43,serif,'right',ink);
    });
  }
  function ticket(i,cx,cy,active){
    const w=248,h=190;
    g.fillStyle=active?'#f2e8d8':'#dddace';g.fillRect(cx-w/2,cy-h/2,w,h);
    g.strokeStyle=active?warm:hair;g.lineWidth=active?2:1;g.strokeRect(cx-w/2,cy-h/2,w,h);
    g.fillStyle=active?warm:hair;
    for(let k=0;k<12;k++){
      g.beginPath();g.arc(cx-w/2+11+k*20.5,cy-h/2,3,0,2*Math.PI);g.fill();
      g.beginPath();g.arc(cx-w/2+11+k*20.5,cy+h/2,3,0,2*Math.PI);g.fill();
    }
    const ids=tiles[i];
    text('K / V    '+String(i+1).padStart(2,'0'),cx-w/2+17,cy-h/2+34,19,mono,'left','#282723');
    for(let col=0;col<2;col++){
      const idx=ids[col],x=cx+(col?62:-62);
      text(names[idx],x,cy-22,24,song,'center','#39362f');
      text(String(scores[idx]),x,cy+28,39,mono,'center','#1b1c18');
      text(String(values[idx]),x,cy+69,27,mono,'center','#38372f');
    }
  }
  function stream(t){
    const switched=fade(7.05,8.25,t);
    const finished=fade(11.85,13.45,t);
    const {m:firstM,l:firstL,u:firstU}=checkpoints[0], second=checkpoints[1];
    const seen=t>=8;
    const factors=seen?second:checkpoints[0];
    text('FlashAttention',108,202,82,serif,'left',ink);
    number(seen?'02  /  02':'01  /  02',111,247,23);label('同一行查询 · 两块 K/V',287,248,24);
    const stride=283, center=351;
    g.save();g.beginPath();g.rect(151,292,524,237);g.clip();
    ticket(0,center-stride*.64*switched,412,switched<.5);
    ticket(1,center+stride-stride*.64*switched,412,switched>=.5);
    g.restore();
    number('s',121,438,22,'center');number('v₁',121,481,21,'center');
    const contact=center+103*switched;
    line(158,543,674,543,hair,1.5);
    g.fillStyle=warm;g.beginPath();g.moveTo(contact,531);g.lineTo(contact-9,546);g.lineTo(contact+9,546);g.closePath();g.fill();
    label('键与值分块送入片上存储',159,591,23);
    // Each small pulse reaches the accumulator only after a tile is read.
    const wireY=416;
    line(689,wireY,856,wireY,hair,1.6);line(844,wireY-8,856,wireY,ink,1.5);line(844,wireY+8,856,wireY,ink,1.5);
    for(let j=0;j<3;j++){
      const x=692+((t*.48+j/3)%1)*145;
      g.fillStyle=j===1?warm:ink;g.fillRect(x,wireY-2.7,6,5.4);
    }
    label('逐块更新的三个量',910,251,28,'left',ink);
    const show=fade(4.10,5.15,t);
    const items=[['m','最大分数',factors.m.toFixed(1)],
      ['ℓ','指数和',factors.l.toFixed(3)],['u','带权的值之和',factors.u.toFixed(3)]];
    items.forEach(([letter,cn,val],index)=>{
      const y=321+index*81;
      line(914,y+22,1462,y+22,hair);
      text(letter,916,y,43,serif,'left',ink,'italic');label(cn,982,y,22);
      withAlpha(show,()=>number(val,1458,y,45,'right',seen?warm:ink));
    });
    withAlpha((1-finished)*fade(7.5,8.5,t),()=>{
      label('旧累积量的换算因子',919,569,21);
      text('exp(1 − 1.5) ≈ '+second.factor.toFixed(3),1460,619,36,serif,'right',warm);
    });
    withAlpha(finished,()=>{
      line(906,560,1463,560,warm,1.6);
      text('u / ℓ  =',910,642,53,serif,'left',ink,'italic');
      number((second.u/second.l).toFixed(3),1461,651,86,'right',warm);
    });
    withAlpha((1-switched)*fade(5.0,6.1,t),()=>{
      text('m = '+firstM+'     ℓ = '+firstL.toFixed(3)+'     u = '+firstU,158,672,27,serif,'left',ink);
    });
    withAlpha(switched,()=>{
      text('m′ = max(m, max s)',157,671,28,serif,'left',ink);
    });
  }
  function draw(t){
    if(t<3.98)withAlpha(1-fade(3.55,3.98,t),()=>squareCost(t));
    if(t>3.55)withAlpha(fade(3.55,4.03,t),()=>stream(t));
  }
  return {draw};
})();
