/* Original procedural score. No samples, external music, or network dependencies. */
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.TransformerScore = value;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  function render({ film, duration = film.duration, sampleRate = 48000 }) {
    const cuts=film.shots.map(shot=>shot.start);
    cuts.push(film.duration);
    const ending=film.shots.at(-1).start;
    const length = Math.round(duration * sampleRate);
    const left = new Float32Array(length), right = new Float32Array(length);
    let seed = 0x41a71;
    const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296 * 2 - 1; };
    function add(start, seconds, pan, sample) {
      if (start >= duration || start+seconds<0) return;
      const first = Math.round(start * sampleRate), count = Math.ceil(seconds * sampleRate);
      const l = Math.sqrt((1 - pan) * .5), r = Math.sqrt((1 + pan) * .5);
      for (let j = 0; j < count; j++) {
        const i = first + j;
        const value = sample(j / sampleRate, j, seconds);
        if (i >= 0 && i < length) { left[i] += value * l; right[i] += value * r; }
      }
    }
    // Soft paper contact: filtered deterministic noise, short resonant wood/paper body.
    function paper(at, level, pan, long = false) {
      let filter = 0, last = 0;
      const seconds = long ? .38 : .085;
      add(at, seconds, pan, (t) => {
        filter = .77 * filter + .23 * random();
        const grain = filter - last * .74; last = filter;
        const envelope = (1 - Math.exp(-t / .0018)) * Math.exp(-t / (long ? .095 : .017));
        return level * envelope * (grain * .7 + Math.sin(2 * Math.PI * 165 * t) * .05);
      });
    }
    function note(at, hz, level, pan, seconds = 1.8) {
      add(at, seconds, pan, t => {
        const envelope = (1 - Math.exp(-t / .012)) * Math.exp(-t / .46) * smooth((seconds - t) / .2);
        return level * envelope * (Math.sin(2 * Math.PI * hz * t) + .15 * Math.sin(2 * Math.PI * hz * 2.003 * t));
      });
    }
    // One damped wooden reed for each nonzero partial product or matrix column.
    function reed(at, hz, level, pan, release=.36) {
      add(at, release, pan, t=>{
        const env=(1-Math.exp(-t/.005))*Math.exp(-5*t/release);
        return env*level*(Math.sin(2*Math.PI*hz*t)+.21*Math.sin(2*Math.PI*hz*2.76*t));
      });
    }
    function attentionVoices(id, at) {
      if (id==='dotlab') {
        [1,0,2,0].forEach((v,i)=>{
          const time=at+1.25+i*.72;
          paper(time,.055,(i-1.5)*.38);
          if(v)reed(time,220*Math.pow(1.5,v-1),.030,(i-1.5)*.36);
        });
        note(at+6.0,330,.021,0,1.3);
      }
      if (id==='matrixlab') {
        const rows=[[0,1,0,1],[2,1,3,0],[1,1,2,1],[0,1,0,2]];
        rows.forEach((scores,row)=>{
          const exp=scores.map(v=>Math.exp(v/2)), sum=exp.reduce((a,b)=>a+b,0);
          exp.forEach((v,col)=>reed(at+1.0+row*2.5+col*.205,
            [220,261.63,329.63,392][col],.058*Math.sqrt(v/sum),(col-1.5)*.46,.27));
        });
      }
      if (id==='headlab') {
        for(let i=0;i<7;i++){
          reed(at+1+i*1.08,[220,293.66,329.63][i%3],.027,-.64,.55);
          reed(at+1.29+i*1.08,[392,329.63,293.66][i%3],.021,.64,.55);
        }
        // The separate stereo heads settle into a central chord on concatenation.
        [220,293.66,392].forEach((hz,i)=>note(at+10.2+i*.055,hz,.012,0,1.4));
      }
      if(id==='flash') {
        for(let block=0;block<4;block++){
          let last=0;
          add(at+2+block*2.0,.34,block%2?.43:-.43,(t,j,sec)=>{
            last=.93*last+.07*random();
            return .075*Math.sin(Math.PI*t/sec)**2*last;
          });
          reed(at+2.35+block*2,146.83,.015,0,.22);
        }
      }
      if(id==='rope') {
        // Recur at the same pitch while rotating the location in the stereo field.
        for(let step=0;step<9;step++){
          const angle=step*Math.PI/4;
          reed(at+1.3+step*.78,261.63,.018,Math.cos(angle)*.55,.52);
          reed(at+1.3+step*.78,392,.014,Math.sin(angle)*.55,.62);
        }
      }
      if(id==='linear') {
        for(let i=0;i<4;i++){
          const time=at+3.1+i*1.8;
          reed(time,220+i*11,.019,-.48,.34);
          reed(time+.19,329.63,.022,.48,.40);
          note(time+.41,261.63,.012,0,.9);
        }
      }
      if(id==='cache') {
        for(let token=0;token<5;token++){
          const time=at+2+token*2.5;
          paper(time,.052,-.35);
          reed(time+.18,[220,261.63,293.66,329.63,392][token],.023,.35,.48);
        }
      }
      if(id==='gqa') {
        // Several query voices share the same pair of lower-register answers.
        for(let i=0;i<8;i++){
          const time=at+1.4+i*1.15;
          reed(time,[392,440,493.88,523.25][i%4],.017,(i%4-1.5)*.38,.26);
          reed(time+.30,i%4<2?196:261.63,.019,i%4<2?-.35:.35,.54);
        }
      }
    }
    // 96 BPM is an editorial grid, not a drum loop: most divisions remain silent.
    const beat = .625, tones = [220, 329.627557, 293.664768, 440, 261.625565, 329.627557];
    for (let n = 0; n * beat < duration; n++) {
      const t = n * beat + .08;
      const chapter = Math.max(0, cuts.findIndex((v, i) => t >= v && t < cuts[i + 1]));
      const id=film.shots[chapter].id;
      const density = id==='opening'||id==='end' ? .48 :
        ['dotlab','matrixlab','headlab','flash','rope','linear','cache','gqa'].includes(id) ? .43 : .72;
      if (n % 2 === 0) paper(t, .07 * density, ((n % 7) - 3) * .12);
      if (n % 4 === 0 && t < ending) {
        const hz = [55, 65.406391, 73.416192, 55][Math.floor(chapter / 3) % 4];
        add(t, .7, 0, d => .042 * density * (1 - Math.exp(-d / .016)) * Math.exp(-d / .22) * Math.sin(2 * Math.PI * hz * d));
      }
      if (n % 8 === 2 && t < ending-2) note(t, tones[Math.floor(n / 8) % tones.length], .035 * density, ((n % 3) - 1) * .28);
      if (chapter > 1 && n % 16 === 11 && t < ending-4) note(t, tones[(Math.floor(n / 16) + 2) % tones.length] * 2, .011, .35, 1.25);
    }
    for (let c = 1; c < film.shots.length; c++) {
      const {start:at,id}=film.shots[c];
      if(at-.42>=duration)break;
      let low = 0;
      // Brief brushed-paper inhale before the cut, with no synthetic impact boom.
      add(at - .42, .55, c % 2 ? -.18 : .18, (t, j, seconds) => {
        low = .91 * low + .09 * random();
        const envelope = Math.pow(Math.sin(Math.PI * t / seconds), 2);
        return .035 * low * envelope;
      });
      paper(at + .035, .115, 0, true);
      if (['gather','memory','end'].includes(id)) note(at + .07, id==='end' ? 220 : 440, .025, 0, 3);
      attentionVoices(id,at);
    }
    // Two quiet sine components give the empty space a stable, nonmelodic floor.
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const bed = .0045 * (Math.sin(2 * Math.PI * 110 * t + .25 * Math.sin(t * .31)) + .36 * Math.sin(2 * Math.PI * 165 * t));
      const envelope = smooth(t / 1.8) * smooth((film.duration - t) / 5.5);
      left[i] = (left[i] + bed) * envelope;
      right[i] = (right[i] + bed * .96) * envelope;
    }
    let peak = 0, energy = 0;
    for (let i = 0; i < length; i++) { peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i])); energy += (left[i] ** 2 + right[i] ** 2) / 2; }
    // Constant intentional mastering gain keeps short and full exports identical.
    const gain = 10;
    for (let i = 0; i < length; i++) { left[i] *= gain; right[i] *= gain; }
    return { channels: [left, right], sampleRate, length, duration, peak: peak * gain, rms: Math.sqrt(energy / length) * gain, cues: cuts };
  }
  return { render };
});
