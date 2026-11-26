/* Attention, in four editorial shots. 1600 × 900; time is local seconds.
   All motion is a pure function of time. This file never clears the paper. */
(function () {
  'use strict';

  const INK = '#191918', RED = '#b9352c', BLUE = '#52667a', PAPER = '#e9e7df';
  const SERIF = 'Georgia,"Times New Roman",serif';
  const CN = '"Noto Serif SC","Source Han Serif SC","Songti SC","SimSun",serif';
  const TAU = Math.PI * 2;
  const words = ['小猫', '坐在', '垫子', '上'];
  const weights = [0.2760043447, 0.1674050973, 0.4550542339, 0.1015363241];
  const percentages = ['27.6%', '16.7%', '45.5%', '10.2%'];
  const rawScores = [2, 1, 3, 0], scaledScores = ['1', '0.5', '1.5', '0'];
  const values = [[1, 0, 1, 0], [0, 1, 0, 1], [1, 1, 0, 0], [0, 0, 1, 1]];
  const result = ['0.731', '0.622', '0.378', '0.269'];
  const xs = [290, 630, 970, 1310];
  const glyphCache = new Map();

  function clamp(x, a = 0, b = 1) { return Math.max(a, Math.min(b, x)); }
  function ease(x) { x = clamp(x); return x * x * (3 - 2 * x); }
  function ramp(t, a, b) { return ease((t - a) / (b - a)); }
  function mix(a, b, k) { return a + (b - a) * k; }
  function seed(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); }
  function alpha(amount, fn) { g.save(); g.globalAlpha *= clamp(amount); fn(); g.restore(); }
  function text(s, x, y, size, color = INK, align = 'center', chinese = false, italic = false) {
    g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic';
    g.font = (italic ? 'italic ' : '') + size + 'px ' + (chinese ? CN : SERIF);
    g.fillText(s, x, y);
  }
  function stroke(points, color = INK, width = 1) {
    if (points.length < 2) return;
    g.beginPath(); g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
    g.strokeStyle = color; g.lineWidth = width; g.stroke();
  }
  function line(x, y, xx, yy, color = INK, width = 1) { stroke([[x, y], [xx, yy]], color, width); }
  function dot(x, y, r = 1.3, color = INK) {
    g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  function ellipse(x, y, rx, ry, angle = 0, color = INK, width = 1) {
    g.beginPath(); g.ellipse(x, y, rx, ry, angle, 0, TAU); g.lineWidth = width; g.strokeStyle = color; g.stroke();
  }
  function roughLine(x, y, xx, yy, amount = 1, color = INK, width = 1) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      pts.push([mix(x, xx, u) + Math.sin(i * 2.1) * amount,
        mix(y, yy, u) + Math.sin(i * 1.73 + 0.5) * amount]);
    }
    stroke(pts, color, width);
  }
  function bracket(x, y, height, direction = 1, color = INK) {
    stroke([[x + 12 * direction, y], [x, y], [x, y + height], [x + 12 * direction, y + height]], color, 1.3);
  }
  function crop(x, y, w, h, opacity) {
    alpha(opacity, () => {
      const a = 15, d = 9;
      for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
        const xx = x + dx * w / 2, yy = y + dy * h / 2;
        line(xx + dx * d, yy, xx + dx * (d + a), yy, INK, 0.8);
        line(xx, yy + dy * d, xx, yy + dy * (d + a), INK, 0.8);
      }
    });
  }
  function caption(title, right = '') {
    text(title, 91, 133, 22, INK, 'left');
    if (right) text(right, 1504, 133, 20, INK, 'right', true);
  }
  function curvePoint(a, b, c, d, u) {
    const v = 1 - u;
    return [v * v * v * a[0] + 3 * v * v * u * b[0] + 3 * v * u * u * c[0] + u * u * u * d[0],
      v * v * v * a[1] + 3 * v * v * u * b[1] + 3 * v * u * u * c[1] + u * u * u * d[1]];
  }
  function bezier(a, b, c, d, end = 1, color = INK, width = 1) {
    const pts = [];
    for (let k = 0; k <= 38; k++) pts.push(curvePoint(a, b, c, d, end * k / 38));
    stroke(pts, color, width);
  }
  function hatchOrb(cx, cy, rx, ry, t, count = 40, opacity = 1) {
    alpha(opacity, () => {
      for (let j = 0; j < count; j++) {
        const a = j / Math.max(1, count - 1), pts = [];
        for (let i = 0; i <= 70; i++) {
          const p = i / 70 * TAU;
          const r = 0.2 + 0.8 * a;
          const warp = 1 + 0.07 * Math.sin(p * 3 + a * 7 + t * 0.23);
          pts.push([cx + Math.cos(p) * rx * r * warp + Math.sin(p * 2 + a * 2) * 9,
            cy + Math.sin(p) * ry * r * warp + Math.sin(p * 4 + t * 0.14) * a * 4]);
        }
        stroke(pts, INK, j % 9 === 0 ? 1.35 : 0.65);
      }
    });
  }

  // Capture glyph silhouettes once, then reassemble their ink with seeded grains.
  function glyph(s, size) {
    const key = s + ':' + size;
    if (glyphCache.has(key)) return glyphCache.get(key);
    const surface = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(420, 180) : document.createElement('canvas');
    surface.width = 420; surface.height = 180;
    const c = surface.getContext('2d', { willReadFrequently: true });
    c.font = size + 'px ' + CN; c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(s, 210, 90);
    const pixels = c.getImageData(0, 0, 420, 180).data, points = [];
    for (let y = 4; y < 177; y += 4) for (let x = 4; x < 417; x += 4) {
      if (pixels[(y * 420 + x) * 4 + 3] > 90) points.push([x - 210, y - 90]);
    }
    glyphCache.set(key, points); return points;
  }
  function inkWord(s, cx, cy, size, progress, index, time) {
    const pts = glyph(s, size);
    const solid = ramp(progress, 0.77, 1);
    alpha(1 - solid * 0.7, () => {
      for (let n = 0; n < pts.length; n++) {
        const r = seed(n + index * 1201), r2 = seed(n * 1.7 + index * 88 + 40);
        const p = ease(clamp(progress * 1.35 - r * 0.35));
        const home = pts[n];
        const angle = r * TAU + (1 - p) * 1.8;
        const distance = 80 + r2 * 240;
        const x = cx + mix(Math.cos(angle) * distance, home[0], p);
        const y = cy + mix(Math.sin(angle) * distance * 0.55, home[1], p);
        alpha(0.35 + 0.65 * p, () => dot(x + Math.sin(time + n) * (1 - p), y, mix(0.7 + r * 0.7, 1.7, p)));
      }
    });
    alpha(solid, () => text(s, cx, cy + size * 0.35, size, INK, 'center', true));
  }
  function seedVector(cx, cy, columns, rows, salt, amount = 1, highlighted = false) {
    alpha(amount, () => {
      for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
        const r = seed(salt + row * 31 + col * 17);
        const x = cx + (col - (columns - 1) / 2) * 13;
        const y = cy + row * 13;
        if (r > 0.16) dot(x, y, 0.8 + r * 1.7, highlighted && row === 1 && col % 3 === 0 ? RED : INK);
        else alpha(0.34, () => line(x - 2, y, x + 2, y, INK, 0.7));
      }
    });
  }

  function tokens(t) {
    caption('A SENTENCE, MADE DISCRETE', '词 → 数字');
    const splitting = ramp(t, 2.7, 5.0), embedding = ramp(t, 5.0, 7.7);
    const pick = ramp(t, 7.9, 10.6);
    const initial = [440, 700, 960, 1175];
    const target = [285, 625, 965, 1305];
    for (let j = 0; j < 4; j++) {
      const cx = mix(initial[j], target[j], splitting);
      const cy = mix(366, 320, embedding) - (j === 1 ? pick * 12 : 0);
      const enter = ramp(t, 0.1 + j * 0.19, 2.65 + j * 0.1);
      inkWord(words[j], cx, cy, 102, enter, j, t);
      crop(cx, cy, j === 3 ? 116 : 228, 125, splitting * (1 - embedding * 0.7));
      alpha(splitting, () => {
        text('0' + (j + 1), cx, 470 - embedding * 25, 25, j === 1 && pick > 0.1 ? RED : INK);
        if (j < 3) roughLine((cx + mix(initial[j + 1], target[j + 1], splitting)) / 2,
          257, (cx + mix(initial[j + 1], target[j + 1], splitting)) / 2, 390, 0.4, INK, 0.7);
      });
      const grow = ramp(t, 5.15 + j * 0.13, 7.7 + j * 0.13);
      alpha(grow, () => {
        const rows = 11;
        for (let r = 0; r < rows; r++) {
          const y = 488 + r * 13;
          const rowReveal = ramp(grow, r / 18, r / 18 + 0.4);
          seedVector(cx, y, 10, 1, j * 911 + r * 37, rowReveal * (j === 1 ? 1 : 1 - pick * 0.55));
        }
        bracket(cx - 77, 479, 152, 1, j === 1 && pick > 0.5 ? RED : INK);
        bracket(cx + 77, 479, 152, -1, j === 1 && pick > 0.5 ? RED : INK);
      });
    }
    alpha(embedding * (1 - pick), () => text('token embedding  +  position', 800, 682, 27, INK, 'center', false, true));
    alpha(pick, () => {
      const cx = target[1], extent = 110 * ramp(t, 8.2, 9.7);
      roughLine(cx - extent, 388, cx + extent, 388, 0.7, RED, 2.3);
      text('本次观察的位置', cx, 680, 25, RED, 'center', true);
      for (let k = 0; k < 16; k++) {
        const u = (t * 0.35 + k / 16) % 1;
        const x = cx - 60 + k * 8;
        dot(x, 462 + u * 165, 1 + seed(k) * 0.6, k % 5 === 0 ? RED : INK);
      }
    });
  }

  function qkv(t) {
    caption('THREE READINGS OF THE SAME X', 'Q · K · V');
    const emerge = ramp(t, 0, 2.4), transform = ramp(t, 5.8, 8.8);
    const names = ['Q', 'K', 'V'], labels = ['QUERY', 'KEY', 'VALUE'];
    const positions = [355, 800, 1245];
    const triptych = 1 - transform;
    alpha(triptych, () => {
      text('X', 800, 238, 60, INK, 'center', false, true);
      alpha(1 - ramp(t, 3.4, 5.6), () => {
        for (let j = 0; j < 4; j++) text(words[j], 645 + j * 106, 184, 23, INK, 'center', true);
      });
      for (let j = 0; j < 3; j++) {
        const x = positions[j], ready = ramp(t, 0.2 + j * 0.3, 2.9 + j * 0.3);
        const source = [800, 250], destination = [x, 307];
        bezier(source, [800, 285], [x, 260], destination, ready, INK, 0.85);
        const symbolY = 515 + 45 * (1 - ready);
        alpha(0.1, () => text(names[j], x + 8, symbolY - 5, 235, INK));
        alpha(ready, () => text(names[j], x, symbolY, 235, j === 0 ? RED : INK));
        alpha(ramp(t, 2.4, 4.7), () => {
          text('W' + names[j], mix(800, x, 0.58), 282, 25, INK, 'center', false, true);
          text(labels[j], x, 577, 24, INK);
          text(['找什么', '如何匹配', '传递什么'][j], x, 616, 28, INK, 'center', true);
        });
        alpha(ramp(t, 3.9, 5.9), () => {
          for (let n = 0; n < 4; n++) seedVector(x, 654 + n * 9, 11, 1, j * 700 + n * 80, n === 1 && j === 0 ? 1 : 0.36, j === 0);
        });
      }
    });
    alpha(transform, () => {
      const qx = mix(355, 345, transform), qy = mix(515, 462, transform);
      text('Q', qx, qy, 210, RED);
      text('坐在', qx, 553, 42, INK, 'center', true);
      text('[ 1  0  1  0 ]', qx, 613, 31, INK);
      const keys = ['[ 1  0  1  0 ]', '[ 0  1  1  0 ]', '[ 1  0  2  0 ]', '[ 0  1  0  1 ]'];
      for (let j = 0; j < 4; j++) {
        const yy = 235 + j * 110, scan = ramp(t, 8.4 + j * 0.6, 10.5 + j * 0.6);
        const start = [475, 405], end = [1040, yy - 8];
        bezier(start, [680, 405 + (j - 1.5) * 70], [860, yy], end, scan, INK, 0.75);
        if (scan > 0.2) {
          const u = ((t - 8.4) * 0.32 + j * 0.19) % 1;
          const p = curvePoint(start, [680, 405 + (j - 1.5) * 70], [860, yy], end, u);
          dot(p[0], p[1], 3, j === 2 ? RED : INK);
        }
        text('K' + (j + 1), 1074, yy, 33, INK, 'right', false, true);
        text(keys[j], 1242, yy, 30, INK);
        text(words[j], 1440, yy, 31, j === 2 ? RED : INK, 'center', true);
        roughLine(1107, yy + 18, 1364, yy + 18, 0.38, INK, 0.6);
      }
      alpha(ramp(t, 10.6, 13.3), () => {
        text('dₖ = 4', 800, 679, 28, INK);
        text('V', 1418, 659, 58, INK, 'center', false, true);
        text('稍后汇合', 1418, 690, 21, INK, 'center', true);
      });
    });
    // The print mark advances until the cut rather than settling into a still.
    alpha(emerge * (1 - transform), () => roughLine(120, 684, 120 + 920 * ramp(t, 1.5, 6.2), 684, 0.45, INK, 0.65));
  }

  function probabilityDots(t, circular) {
    const counts = [276, 167, 455, 102];
    const entered = ramp(t, 6.5, 9.7);
    let offset = -Math.PI / 2;
    for (let j = 0; j < 4; j++) {
      const arc = weights[j] * TAU;
      for (let i = 0; i < counts[j]; i++) {
        const salt = j * 5003 + i;
        const col = i % 24, row = Math.floor(i / 24);
        const x0 = xs[j] + (col - 11.5) * 8.5 + seed(salt) * 2.5;
        const y0 = 620 - row * 14 + seed(salt + 8) * 3;
        const a = offset + arc * seed(salt * 2.7 + 20) + 0.1 * Math.sin(t * 0.2);
        const radius = Math.sqrt(0.15 + seed(salt * 3.4 + 18) * 0.85) * 220;
        const x1 = 800 + Math.cos(a) * radius;
        const y1 = 421 + Math.sin(a) * radius;
        const appear = ramp(entered, seed(salt + 43) * 0.65, 0.34 + seed(salt + 43) * 0.65);
        const x = mix(x0, x1, circular), y = mix(y0 + 100 * (1 - appear), y1, circular);
        alpha(appear * (0.4 + seed(salt + 11) * 0.6), () => dot(x, y, 0.75 + seed(salt + 7) * 1.55));
      }
      const centerAngle = offset + arc / 2 + 0.1 * Math.sin(t * 0.2);
      alpha(circular, () => {
        const lx = 800 + Math.cos(centerAngle) * 335, ly = 421 + Math.sin(centerAngle) * 230;
        text(percentages[j], lx, ly, 42, j === 2 ? RED : INK);
        text(words[j], lx, ly + 35, 26, INK, 'center', true);
        const p1 = [800 + Math.cos(centerAngle) * 228, 421 + Math.sin(centerAngle) * 228];
        const p2 = [800 + Math.cos(centerAngle) * 266, 421 + Math.sin(centerAngle) * 237];
        line(...p1, ...p2, j === 2 ? RED : INK, 0.8);
      });
      if (j === 2) alpha(circular, () => {
        g.beginPath(); g.arc(800, 421, 234, offset + 0.1 * Math.sin(t * 0.2), offset + arc + 0.1 * Math.sin(t * 0.2));
        g.strokeStyle = RED; g.lineWidth = 2.1; g.stroke();
      });
      offset += arc;
    }
  }

  function scores(t) {
    caption('FROM COMPATIBILITY TO PROBABILITY', '单头 · 人工数值');
    const divide = ramp(t, 2.7, 5.7), soften = ramp(t, 6.2, 8.8), circular = ramp(t, 10.3, 13.6);
    alpha(1 - soften, () => {
      text('QKᵀ', 800, 222, 58, INK, 'center', false, true);
      for (let j = 0; j < 4; j++) {
        const enter = ramp(t, j * 0.18, 1.65 + j * 0.18);
        alpha(enter, () => {
          text(String(rawScores[j]), xs[j], mix(402, 335, divide) + (1 - enter) * 30, 104, INK);
          alpha(divide, () => {
            roughLine(xs[j] - 90, 360, xs[j] + 90, 360, 0.8, INK, 1.2);
            text('2', xs[j], 427, 53, INK);
            text(scaledScores[j], xs[j], 548, 75, j === 2 ? RED : INK);
          });
          text(words[j], xs[j], 636, 35, INK, 'center', true);
          for (let k = 0; k < rawScores[j]; k++) {
            alpha(0.5 * (1 - divide), () => ellipse(xs[j] + (k - (rawScores[j] - 1) / 2) * 25, 476, 7, 15, -0.25, INK, 1.1));
          }
        });
      }
      alpha(divide, () => text('√dₖ = √4 = 2', 800, 688, 30, INK));
    });
    alpha(soften, () => {
      alpha(1 - circular, () => {
        text('softmax', 800, 233, 61, INK, 'center', false, true);
        for (let j = 0; j < 4; j++) {
          text(percentages[j], xs[j], 330, 61, j === 2 ? RED : INK);
          text(words[j], xs[j], 674, 31, INK, 'center', true);
          line(xs[j] - 113, 636, xs[j] + 113, 636, INK, 0.65);
        }
      });
      probabilityDots(t, circular);
      alpha(circular, () => {
        // Small unprinted center makes the sum readable without a UI panel.
        g.fillStyle = PAPER; g.beginPath(); g.ellipse(800, 421, 87, 66, 0, 0, TAU); g.fill();
        text('Σ α = 1', 800, 432, 37, INK, 'center', false, true);
        text('softmax', 800, 185, 42, INK, 'center', false, true);
      });
    });
  }

  function valueSeeds(cx, cy, index, opacity, time, scale = 1) {
    alpha(opacity, () => {
      g.save(); g.translate(cx, cy); g.scale(scale, scale);
      for (let component = 0; component < 4; component++) {
        const height = values[index][component] ? 83 : 19;
        const x = (component - 1.5) * 23;
        for (let n = 0; n < 35; n++) {
          const r = seed(index * 1907 + component * 311 + n);
          dot(x + (seed(n * 3.3 + index) - 0.5) * 12,
            (r - 0.5) * height + Math.sin(time * 0.9 + n) * 0.45,
            0.7 + seed(n + 7) * 1.2);
        }
      }
      bracket(-56, -56, 112); bracket(56, -56, 112, -1);
      g.restore();
    });
  }

  function wovenMemory(t, appear, unfurl) {
    // Four families of contours become a single ink fingerprint, then four coordinates.
    const coordinates = [0.7310585786, 0.6224593312, 0.3775406688, 0.2689414214];
    for (let family = 0; family < 4; family++) {
      const count = 24 + Math.round(weights[family] * 80);
      alpha(appear * (0.54 + weights[family] * 0.55), () => {
        for (let j = 0; j < count; j++) {
          const u = j / (count - 1), pts = [];
          for (let n = 0; n <= 100; n++) {
            const a = n / 100 * TAU;
            const radius = 28 + 180 * u;
            const rot = family * 0.55 + t * 0.035;
            const ripple = 1 + 0.12 * Math.sin(3 * a + family + u * 4);
            const px = Math.cos(a + rot) * radius * ripple;
            const py = Math.sin(a + rot) * radius * (0.72 + family * 0.06);
            const sourceX = 800 + px, sourceY = 416 + py;
            const destX = 650 + family * 184 + Math.cos(a) * (7 + 33 * u);
            const destY = 420 + Math.sin(a) * (20 + coordinates[family] * 180 * u);
            pts.push([mix(sourceX, destX, unfurl), mix(sourceY, destY, unfurl)]);
          }
          stroke(pts, INK, j % 11 === 0 ? 1.15 : 0.55);
        }
      });
    }
  }

  function gather(t) {
    caption('VALUES BECOME CONTEXT', '加权汇合');
    const enter = ramp(t, 0, 2.3), converge = ramp(t, 3.2, 7.4);
    const imprint = ramp(t, 6.0, 9.5), unfurl = ramp(t, 10.9, 14.9);
    const origins = [[268, 280], [448, 585], [1152, 280], [1332, 585]];
    for (let j = 0; j < 4; j++) {
      const origin = origins[j], faded = 1 - ramp(t, 8.6, 11.7);
      alpha(enter * faded, () => {
        text('V' + (j + 1), origin[0] - 83, origin[1] + 17, 51, INK, 'center', false, true);
        text(words[j], origin[0], origin[1] - 88, 30, INK, 'center', true);
        text(percentages[j], origin[0], origin[1] + 104, 35, j === 2 ? RED : INK);
      });
      valueSeeds(origin[0], origin[1], j, enter * faded, t, 1 - converge * 0.3);
      const strandCount = Math.round(12 + weights[j] * 48);
      for (let strand = 0; strand < strandCount; strand++) {
        const spread = (strand / Math.max(1, strandCount - 1) - 0.5) * (20 + weights[j] * 85);
        const dest = [800 + Math.cos(j * 1.57) * spread, 416 + Math.sin(j * 1.57) * spread];
        const start = [origin[0] + spread * 0.2, origin[1] + spread];
        const control1 = [mix(origin[0], 800, 0.28), origin[1] + (j % 2 ? -90 : 90) + spread];
        const control2 = [800 + (j < 2 ? -180 : 180), 416 + (j % 2 ? 110 : -110) + spread];
        alpha(converge * (1 - unfurl) * (strand % 4 === 0 ? 0.8 : 0.3), () => {
          bezier(start, control1, control2, dest, ramp(t, 2.7 + strand * 0.012, 6.0 + j * 0.19), INK, strand % 9 === 0 ? 1.1 : 0.6);
          const progress = (t * (0.19 + weights[j] * 0.08) + strand * 0.09) % 1;
          const p = curvePoint(start, control1, control2, dest, progress);
          dot(p[0], p[1], strand % 11 === 0 ? 2 : 0.8, j === 2 && strand % 11 === 0 ? RED : INK);
        });
      }
    }
    wovenMemory(t, imprint, unfurl);
    alpha(imprint * (1 - unfurl), () => {
      // A paper aperture, like a printmaker's untouched center.
      g.fillStyle = PAPER; g.beginPath(); g.ellipse(800, 416, 77, 45, -0.08, 0, TAU); g.fill();
      text('坐在', 800, 432, 42, INK, 'center', true);
      alpha(ramp(t, 8.0, 10.7), () => {
        text('a contextual fingerprint', 800, 674, 31, INK, 'center', false, true);
        roughLine(670, 238, 930, 238, 0.7, RED, 1.8);
      });
    });
    alpha(unfurl, () => {
      text('坐在', 293, 410, 83, INK, 'center', true);
      text('新的表示', 293, 465, 29, RED, 'center', true);
      line(416, 411, 530, 411, INK, 1.2);
      stroke([[516, 401], [530, 411], [516, 421]], INK, 1.2);
      bracket(575, 239, 365, 1); bracket(1278, 239, 365, -1);
      for (let j = 0; j < 4; j++) {
        text(result[j], 650 + j * 184, 650, 39, INK);
        const sweep = (t * 0.18 + j * 0.19) % 1;
        const sy = 280 + sweep * 280;
        line(618 + j * 184, sy, 682 + j * 184, sy, j === 0 ? RED : BLUE, 0.85);
      }
    });
    alpha(enter * (1 - ramp(t, 5.5, 6.2)), () => text('Σ αⱼ Vⱼ', 800, 445, 70, INK, 'center', false, true));
    alpha(ramp(t, 12.2, 15.8), () => text('Σ αⱼ Vⱼ  ≈  [ 0.731   0.622   0.378   0.269 ]', 800, 695, 25, INK));
  }

  const shots = { tokens, qkv, scores, gather };
  window.drawAttentionShot = function drawAttentionShot(id, t) {
    const shot = shots[id];
    if (!shot) return;
    const time = Math.max(0, Number.isFinite(t) ? t : 0);
    g.save();
    g.beginPath(); g.rect(75, 100, 1450, 600); g.clip();
    g.lineCap = 'round'; g.lineJoin = 'round';
    shot(time);
    g.restore();
  };
}());
