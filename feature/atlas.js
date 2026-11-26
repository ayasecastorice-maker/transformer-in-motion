'use strict';

// The last impression revisits the example sentence as a natural-history plate.
const Atlas = (() => {
  const ink='#24231f';
  let cached;
  function drawCat(c) {
    const outline=new Path2D();
    outline.moveTo(73,131);
    outline.bezierCurveTo(72,121,74,107,80,98);
    outline.lineTo(74,62);outline.quadraticCurveTo(90,69,103,84);
    outline.quadraticCurveTo(115,77,128,77);outline.lineTo(147,48);
    outline.quadraticCurveTo(156,66,153,91);
    outline.bezierCurveTo(172,99,165,122,180,135);
    outline.bezierCurveTo(192,145,224,153,244,171);
    outline.bezierCurveTo(273,197,293,241,286,259);
    outline.bezierCurveTo(282,285,254,292,227,290);
    outline.lineTo(118,290);outline.quadraticCurveTo(96,289,98,282);
    outline.quadraticCurveTo(99,275,119,272);
    outline.bezierCurveTo(123,247,123,222,119,205);
    outline.bezierCurveTo(105,187,106,172,105,163);
    outline.quadraticCurveTo(85,163,80,151);
    outline.quadraticCurveTo(67,144,73,131);outline.closePath();
    c.save();c.clip(outline);
    c.fillStyle='#dedbd1';c.fillRect(60,45,240,252);
    for(let i=-55;i<285;i+=2.4){
      c.beginPath();c.moveTo(60+i,52);
      c.bezierCurveTo(135+i,102,82+i,186,157+i,215);
      c.quadraticCurveTo(195+i,240,161+i,294);
      c.strokeStyle=i%5<2?'#292824':'#69665e';c.lineWidth=i%7<3?1.3:.65;c.stroke();
    }
    for(let k=0;k<900;k++){
      const x=63+((k*137.5)%234), y=58+((k*93.37)%233);
      const a=.57+1.2*Math.sin(x*.027+y*.009);
      const l=2.3+3.4*Math.abs(Math.sin(k*53.2));
      c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+l*.55,y+a*.8,x+l*Math.cos(a),y+l*Math.sin(a));
      c.strokeStyle=k%4?'rgba(35,33,27,.63)':'rgba(242,240,225,.82)';c.lineWidth=.8;c.stroke();
    }
    c.restore();c.strokeStyle=ink;c.lineWidth=1.2;c.stroke(outline);
    function contour(points,width=1.4,stroke=ink) {
      c.beginPath();c.moveTo(...points[0]);
      for(const p of points.slice(1))c.bezierCurveTo(...p);
      c.lineWidth=width;c.strokeStyle=stroke;c.stroke();
    }
    contour([[263,250],[303,239,325,253,320,275],[313,301,267,310,223,298],[211,293,207,287,217,286],[243,283,273,291,293,275],[306,264,292,261,275,264]],7);
    contour([[253,216],[216,201,195,228,198,254],[202,271,202,278,183,281]],1.5);
    contour([[146,198],[150,230,144,248,144,275],[134,277,129,279,129,287]],1.7);
    contour([[78,130],[88,125,96,124,104,123]],2.3);
    contour([[76,140],[82,149,92,149,95,147]],1);
    c.fillStyle=ink;c.beginPath();c.ellipse(88,131,2.8,1.8,-.4,0,7);c.fill();
    for(let i=0;i<7;i++)contour([[83,146],[64,140+i*2.2,45,140+i*3.6,38+i*1.2,140+i*4.4]],.6);
    for(let i=0;i<14;i++){
      c.beginPath();c.ellipse(184,299+i*.55,158-i*1.2,12-i*.42,.009,0,7);
      c.lineWidth=.65;c.strokeStyle='rgba(44,42,34,.55)';c.stroke();
    }
  }
  function createAtlas(scale) {
    const sheet=document.createElement('canvas');sheet.width=Math.round(1600*scale);sheet.height=Math.round(900*scale);
    const c=sheet.getContext('2d');
    c.scale(scale,scale);
    const tau=Math.PI*2;
    function stroke(points,color=ink,w=1){
      c.strokeStyle=color;c.lineWidth=w;c.beginPath();
      points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
    }
    function note(s,x,y){
      c.fillStyle=ink;c.font='italic 17px Georgia, SimSun, serif';
      c.textAlign='center';c.fillText(s,x,y);
    }
    // A latticed torus drawn in two families of curves, without a raster asset.
    function coil(cx,cy,k){
      function point(u,v) {
        const r=78+30*Math.cos(v);
        return [cx+k*(r*Math.cos(u)+9*Math.sin(v)),cy+k*(r*Math.sin(u)*.53+Math.sin(v)*31)];
      }
      for(let j=0;j<51;j++)stroke(Array.from({length:47},(_,p)=>point(j*tau/51,p*tau/46)),'rgba(33,32,28,.65)',.8);
      for(let j=0;j<23;j++)stroke(Array.from({length:86},(_,p)=>point(p*tau/85,j*tau/23)),'rgba(33,32,28,.47)',.76);
    }
    coil(372,281,1); note('I.   Projection',372,399);
    c.save();c.translate(562,107);c.scale(1.32,1.32);drawCat(c);c.restore();
    note('Felis catus',810,555);
    for(let n=0;n<3;n++) {
      const ox=1132+n*55;
      for(let j=0;j<=12;j++){
        const yy=221+j*11;
        stroke([[ox-19,yy+4],[ox+5,yy-3],[ox+23,yy+4],[ox-1,yy+11],[ox-19,yy+4]],ink,.75);
      }
    }
    note('III.   Layers',1186,404);
    for(let n=0;n<10;n++){
      for(let j=0;j<=n;j++){
        const x=300+j*11+(9-n)*3, y=493+n*10;
        c.fillStyle='#2b2a26';c.beginPath();c.arc(x,y,1.2+((j+n)%4)*.66,0,7);c.fill();
      }
    }
    note('IV.   Causality',352,635);
    for(let i=0;i<44;i++){
      const pts=[];
      for(let k=0;k<=45;k++){
        const u=k/45, y=(i-22)*2.45;
        pts.push([1054+u*263,546+y*Math.cos(u*tau*.74)+34*Math.sin(u*tau*.8+y*.02)]);
      }
      stroke(pts,'rgba(35,32,28,.53)',.8);
    }
    note('VI.   Context',1191,635);
    for(let j=0;j<4;j++){
      const x=682+j*68;
      for(let n=0;n<13;n++) {
        const a=n*tau/13;
        stroke([[x,615],[x+17*Math.cos(a),615+17*Math.sin(a)]],'#47443c',.75);
      }
      c.beginPath();c.arc(x,615,17,0,tau);c.lineWidth=.8;c.stroke();
    }
    note('V.   Sequence',783,676);
    return sheet;
  }
  return function atlas(t){
    const width=Math.max(1600,Math.min(filmSettings.width,g.canvas.width));
    if(!cached||cached.width!==width)cached=createAtlas(width/1600);
    const zoom=1.02+.5*(1-Art.fade(0,2.2,t));
    g.save();g.translate(800,420);g.scale(zoom,zoom);g.translate(-800,-420);
    g.drawImage(cached,0,0,1600,900);g.restore();
  };
})();
