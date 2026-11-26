/* Three attention microscope shots. All coordinates are for a 1600 × 900 canvas.
   Stateless, seekable motion; the host paints paper and subtitles. */
(function () {
  'use strict';
  const INK = '#191918', RED = '#b9352c', BLUE = '#52667a', PAPER = '#e9e7df';
  const SERIF = 'Georgia,"Times New Roman",serif';
  const CN = '"Noto Serif SC","Source Han Serif SC","Songti SC","SimSun",serif';
  const TAU = Math.PI * 2;
  const TOKENS = ['小猫', '坐在', '垫子', '上'];
  const K = [[1, 0, 1, 0], [0, 1, 1, 0], [1, 0, 2, 0], [0, 1, 0, 1]];
  const Q = [[0, 1, 0, 0], [1, 0, 1, 0], [0, 0, 1, 1], [0, 1, 0, 1]];
  const dotProduct = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const softmax = row => {
    const m = Math.max(...row), e = row.map(x => Math.exp(x - m));
    const sum = e.reduce((a, b) => a + b, 0);
    return e.map(x => x / sum);
  };
  const DOTS = Q.map(q => K.map(k => dotProduct(q, k)));
  const SCORES = DOTS.map(row => row.map(x => x / 2));
  const A = SCORES.map(softmax);
  // Both heads start from exactly the same X = K. P12 swaps features 1 and 2.
  // Q1 = X P12, Q2 = X; K1 = K2 = X. Query row is token 2, "坐在".
  // V1 = X[:, [0,1]], V2 = X[:, [2,3]], so d_k=4 but d_v=2 in this toy.
  // Different projection matrices are learned parameters in a trained model.
  const HEAD_Q = [[1, 0, 1, 0], [0, 1, 1, 0]];
  const HEAD_A = HEAD_Q.map(q => softmax(K.map(k => dotProduct(q, k) / 2)));
  const HEAD_V = [K.map(row => row.slice(0, 2)), K.map(row => row.slice(2, 4))];
  const HEAD_OUT = HEAD_A.map((w, h) => [0, 1].map(d => w.reduce((s, a, j) => s + a * HEAD_V[h][j][d], 0)));
  const JOINED = HEAD_OUT.flat();
  // Row-vector convention: z W_O. This 4x4 output projection preserves d_model=4.
  const WO = [[1, 0, 0, 0], [0, 1, 0, 0], [0.5, 0, 1, 0], [0, 0.5, 0, 1]];
  const OUTPUT = [0, 1, 2, 3].map(j => JOINED.reduce((s, z, i) => s + z * WO[i][j], 0));

  const clamp = x => Math.max(0, Math.min(1, x));
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const ramp = (t, a, b) => smooth((t - a) / (b - a));
  const lerp = (a, b, u) => a + (b - a) * u;
  const rnd = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const pct = p => (p * 100).toFixed(1) + '%';
  const fixed = x => x.toFixed(3);
  function fade(a, fn) {
    if (a <= 0) return;
    g.save(); g.globalAlpha *= clamp(a); fn(); g.restore();
  }
  function txt(s, x, y, size = 30, color = INK, align = 'center', chinese = false, italic = false) {
    g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic';
    g.font = (italic ? 'italic ' : '') + size + 'px ' + (chinese ? CN : SERIF);
    g.fillText(String(s), x, y);
  }
  function path(pts, color = INK, width = 1) {
    if (!pts.length) return;
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let n = 1; n < pts.length; n++) g.lineTo(pts[n][0], pts[n][1]);
    g.lineWidth = width; g.strokeStyle = color; g.stroke();
  }
  function line(x1, y1, x2, y2, color = INK, width = 1) { path([[x1, y1], [x2, y2]], color, width); }
  function grain(x, y, radius = 1.2, color = INK) {
    g.beginPath(); g.arc(x, y, radius, 0, TAU); g.fillStyle = color; g.fill();
  }
  function etched(x1, y1, x2, y2, color = INK, width = 0.8, wobble = 0.6) {
    const pts = [];
    for (let n = 0; n <= 32; n++) {
      const u = n / 32;
      pts.push([lerp(x1, x2, u) + Math.sin(n * 1.7) * wobble,
        lerp(y1, y2, u) + Math.sin(n * 2.1) * wobble]);
    }
    path(pts, color, width);
  }
  function bracket(x, y, height, direction = 1, color = INK) {
    path([[x + direction * 12, y], [x, y], [x, y + height], [x + direction * 12, y + height]], color, 1.2);
  }
  function arrow(x1, y1, x2, y2, color = INK, width = 1) {
    line(x1, y1, x2, y2, color, width);
    const a = Math.atan2(y2 - y1, x2 - x1), length = 12;
    path([[x2 - Math.cos(a - 0.5) * length, y2 - Math.sin(a - 0.5) * length],
      [x2, y2], [x2 - Math.cos(a + 0.5) * length, y2 - Math.sin(a + 0.5) * length]], color, width);
  }
  function curve(a, b, c, d, u) {
    const v = 1 - u;
    return [v * v * v * a[0] + 3 * v * v * u * b[0] + 3 * v * u * u * c[0] + u * u * u * d[0],
      v * v * v * a[1] + 3 * v * v * u * b[1] + 3 * v * u * u * c[1] + u * u * u * d[1]];
  }
  function arcRoute(a, b, c, d, end = 1, color = INK, width = 1) {
    const pts = [];
    for (let n = 0; n <= 48; n++) pts.push(curve(a, b, c, d, end * n / 48));
    path(pts, color, width);
  }
  function heading(english, chinese) {
    txt(english, 91, 125, 22, INK, 'left');
    txt(chinese, 1500, 125, 23, INK, 'right', true);
  }
  function matrix(data, cx, cy, dx = 66, dy = 62, size = 32, select = -1) {
    const rows = data.length, cols = data[0].length;
    const left = cx - (cols - 1) * dx / 2, top = cy - (rows - 1) * dy / 2;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const value = data[r][c] === 0.5 ? '½' : data[r][c];
      txt(value, left + c * dx, top + r * dy + size * 0.34, size, r === select ? RED : INK);
    }
    bracket(left - dx * 0.6, top - dy * 0.52, dy * (rows - 0.05), 1);
    bracket(left + dx * (cols - 0.4), top - dy * 0.52, dy * (rows - 0.05), -1);
  }
  function inkBurst(cx, cy, progress, salt, spread = 90, color = INK) {
    for (let j = 0; j < 44; j++) {
      const angle = rnd(j + salt) * TAU;
      const radius = (10 + spread * rnd(j * 2.9 + salt)) * Math.sin(progress * Math.PI);
      fade(Math.sin(progress * Math.PI) * 0.55, () => grain(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * 0.6,
        0.7 + rnd(j + 7) * 1.1, color));
    }
  }

  function dotlab(t) {
    heading('INSIDE A SINGLE DOT PRODUCT', '坐在 → 垫子');
    const q = [1, 0, 1, 0], k = [1, 0, 2, 0], product = [1, 0, 2, 0], partial = [1, 1, 3, 3];
    const cols = [440, 680, 920, 1160];
    const paired = ramp(t, 1.4, 3.5), accumulating = ramp(t, 3.8, 6.3);
    const collapse = ramp(t, 6.0, 8.3), scaling = ramp(t, 8.1, 10.9);
    fade(1 - collapse, () => {
      fade(1 - paired * 0.72, () => {
        txt('q', 225, 282, 72, RED, 'center', false, true);
        txt('k', 225, 509, 72, INK, 'center', false, true);
        txt('坐在', 225, 328, 26, INK, 'center', true);
        txt('垫子', 225, 554, 26, INK, 'center', true);
      });
      for (let d = 0; d < 4; d++) {
        const phase = ramp(t, 0.15 + d * 0.22, 1.4 + d * 0.22);
        const x = cols[d];
        fade(phase * (1 - paired), () => {
          txt('d' + (d + 1), x, 202, 25, INK, 'center', false, true);
          txt(q[d], x, lerp(282, 382, paired), 82, RED);
          txt(k[d], x, lerp(509, 420, paired), 82, INK);
          txt('×', x, 392, 41, INK);
          etched(x, 306, x, 343, INK, 0.6); etched(x, 410, x, 445, INK, 0.6);
        });
        inkBurst(x, 391, paired, d * 110, 100, d === 2 ? RED : INK);
        fade(paired, () => {
          txt(q[d] + ' × ' + k[d], x, 273, 35, INK);
          txt(product[d], x, lerp(425, 366, accumulating), 92, d === 2 ? RED : INK);
          if (d < 3) txt('+', (x + cols[d + 1]) / 2, lerp(417, 359, accumulating), 45, INK);
        });
        const sum = ramp(t, 3.75 + d * 0.56, 4.7 + d * 0.56);
        fade(sum, () => {
          arrow(x, 398, x, 461, d === 2 ? RED : INK, 0.8);
          txt(partial[d], x, 548, 65, d > 1 ? RED : INK);
          if (d < 3) arrow(x + 47, 525, cols[d + 1] - 47, 525, INK, 0.7);
        });
      }
      fade(accumulating, () => txt('部分和   1 → 1 → 3 → 3', 800, 650, 32, INK, 'center', true));
    });
    fade(collapse, () => {
      const x = lerp(800, 475, scaling);
      txt('3', x, lerp(463, 399, scaling), lerp(223, 132, scaling), INK);
      fade(1 - scaling, () => {
        txt('1 + 0 + 2 + 0', 800, 576, 40, INK);
        txt('q · k', 800, 240, 55, RED, 'center', false, true);
      });
      for (let n = 0; n < 17; n++) {
        const u = n / 16;
        fade(0.18 * (1 - scaling), () => etched(540 - u * 66, 310 + u * 195, 672 - u * 25, 310 + u * 195,
          INK, 0.7, 0.9));
      }
      fade(scaling, () => {
        etched(390, 426, 560, 426, INK, 1.4);
        txt('√4 = 2', 475, 490, 43, INK);
        txt('=', 685, 427, 64, INK);
        txt('1.5', 930, 447, 158, RED);
        txt('scaled score', 930, 514, 29, INK, 'center', false, true);
        txt('Var(q · k) ≈ dₖ', 490, 618, 38, INK, 'center', false, true);
        arrow(710, 604, 810, 604, INK, 1.1);
        txt('Var(q · k / √dₖ) ≈ 1', 1110, 618, 36, INK, 'center', false, true);
      });
      fade(ramp(t, 9.5, 11.8), () => {
        txt('条件：各分量相互独立、零均值、单位方差', 800, 694, 28, INK, 'center', true);
        const scan = ramp(t, 9.6, 12.0);
        etched(457, 708, 457 + 686 * scan, 708, RED, 1.3);
      });
    });
  }

  function matrixlab(t) {
    heading('EVERY QUERY, EVERY KEY', '逐行归一化');
    const reveal = ramp(t, 1.9, 4.1), scale = ramp(t, 3.9, 5.1), compare = ramp(t, 9.65, 10.85);
    fade(1 - reveal, () => {
      txt('Q', 365, 223, 64, RED, 'center', false, true);
      txt('K', 1235, 223, 64, INK, 'center', false, true);
      matrix(Q, 365, 408, 72, 66, 43, 1);
      matrix(K, 1235, 408, 72, 66, 43, 2);
      txt('QKᵀ', 800, 391, 80, INK, 'center', false, true);
      txt('4 × 4', 800, 459, 37, INK);
      const u = ramp(t, 0.5, 2.6);
      arrow(570, 405, 570 + 100 * u, 405, INK, 1);
      arrow(1030 - 100 * u, 405, 1030, 405, INK, 1);
      txt('每一行都是一个 token 的投影', 800, 651, 31, INK, 'center', true);
    });
    fade(reveal, () => {
      const left = 475, top = 236, dx = 168, dy = 98;
      txt('KEY / 键', 813, 177, 24, INK);
      txt('QUERY', 243, 217, 23, RED);
      for (let c = 0; c < 4; c++) txt(TOKENS[c], left + c * dx + dx / 2, 217, 29, INK, 'center', true);
      for (let r = 0; r < 4; r++) {
        const rowMix = ramp(t, 5.0 + r * 1.12, 6.15 + r * 1.12);
        const active = Math.max(0, Math.min(3, Math.floor((t - 5.05) / 1.12)));
        const y = top + r * dy;
        txt(TOKENS[r], 355, y + 52, 34, r === 1 ? RED : INK, 'center', true);
        fade(ramp(t, 4.9, 5.4) * (1 - compare) * (active === r ? 0.8 : 0.16), () => {
          etched(left - 24, y + 3, left + dx * 4 + 24, y + 3, RED, 1.5);
          etched(left - 24, y + dy - 4, left + dx * 4 + 24, y + dy - 4, RED, 1.5);
        });
        for (let c = 0; c < 4; c++) {
          const x = left + c * dx + dx / 2;
          const emphasis = (r === 1 && c === 2) || (r === 2 && c === 1);
          const color = compare > 0.1 && emphasis ? RED : INK;
          fade(1 - rowMix, () => {
            fade(1 - scale, () => txt(DOTS[r][c], x, y + 53, 42, color));
            fade(scale, () => txt(Number(SCORES[r][c].toFixed(1)), x, y + 53, 42, color));
          });
          fade(rowMix, () => {
            txt(pct(A[r][c]), x, y + 45, 34, color);
            const grains = Math.round(A[r][c] * 92);
            for (let n = 0; n < grains; n++) {
              const gx = x - 46 + (n % 12) * 8.2, gy = y + 65 + Math.floor(n / 12) * 6.1;
              grain(gx + rnd(n + r * 100 + c * 20) * 1.3, gy, 0.9 + rnd(n + c * 90) * 0.9, color);
            }
          });
          if (emphasis) fade(compare, () => {
            bracket(x - 70, y + 10, 72, 1, RED); bracket(x + 70, y + 10, 72, -1, RED);
          });
        }
        fade(rowMix, () => {
          txt('Σ = 1', 1308, y + 53, 31, INK);
          arrow(1170, y + 43, 1228, y + 43, INK, 0.8);
        });
      }
      bracket(left - 24, top - 3, dy * 4 + 3, 1);
      bracket(left + dx * 4 + 24, top - 3, dy * 4 + 3, -1);
      fade(1 - ramp(t,9.35,9.65), () => {
        txt(t < 5.1 ? 'QKᵀ / √4' : 'A = softmax(QKᵀ / 2)', 800, 690, 37, INK, 'center', false, true);
      });
      fade(compare, () => {
        txt('坐在 → 垫子  ' + pct(A[1][2]), 470, 687, 32, RED, 'center', true);
        txt('≠', 800, 690, 48, INK);
        txt('垫子 → 坐在  ' + pct(A[2][1]), 1135, 687, 32, INK, 'center', true);
        txt('双向可见，也不要求权重对称', 800, 728, 25, INK, 'center', true);
      });
    });
  }

  function headlab(t) {
    heading('DIFFERENT PROJECTIONS, PARALLEL READINGS', '教学例：dₖ = 4，dᵥ = 2');
    const split = ramp(t, 1.5, 3.9), attend = ramp(t, 3.6, 6.2);
    const aggregate = ramp(t, 6.2, 9.2), join = ramp(t, 9.8, 12.0), output = ramp(t, 11.6, 13.4);
    fade(1 - split, () => {
      txt('X', 800, 223, 73, INK, 'center', false, true);
      matrix(K, 800, 408, 82, 68, 45, 1);
      for (let r = 0; r < 4; r++) txt(TOKENS[r], 526, 322 + r * 68, 31, r === 1 ? RED : INK, 'center', true);
      txt('同一组输入，两个不同的投影', 800, 644, 35, INK, 'center', true);
    });
    fade(split * (1 - join), () => {
      txt('K₁ = K₂ = X', 800, 180, 27, INK);
      for (let h = 0; h < 2; h++) {
        const cx = h === 0 ? 440 : 1160, color = h === 0 ? RED : INK;
        txt('HEAD ' + (h + 1), cx, 227, 33, color);
        txt(h === 0 ? 'Q₁ = X P₁₂' : 'Q₂ = X', cx, 280, 39, INK, 'center', false, true);
        txt(h === 0 ? 'P₁₂：交换第 1、2 维' : '保留原查询投影', cx, 320, 23, INK, 'center', true);
        txt('q = [ ' + HEAD_Q[h].join('  ') + ' ]', cx, 365, 29, color);
        fade(attend, () => {
          for (let j = 0; j < 4; j++) {
            const x = cx - 210 + j * 140;
            txt(TOKENS[j], x, 416, 27, INK, 'center', true);
            txt(pct(HEAD_A[h][j]), x, 460, 32, color);
            const height = HEAD_A[h][j] * 215;
            fade(1 - aggregate, () => {
              for (let n = 0; n < 9; n++) {
                const xx = x - 25 + n * 6;
                etched(xx, 590, xx, 590 - height * attend, INK, n % 3 === 0 ? 1.25 : 0.6, 0.4);
              }
              line(x - 31, 594, x + 31, 594, INK, 0.65);
            });
            fade(aggregate, () => {
              txt('[ ' + HEAD_V[h][j].join('  ') + ' ]', x, 504, 26, INK);
              const a = [x, 520], b = [x, 556], c = [cx, 565], d = [cx, 597];
              arcRoute(a, b, c, d, aggregate, color, 0.7 + HEAD_A[h][j] * 1.7);
              const u = (t * 0.35 + j * 0.23) % 1, p = curve(a, b, c, d, u);
              grain(p[0], p[1], 2.2, color);
            });
          }
          fade(1 - aggregate, () => {
            txt(h === 0 ? '点积 [2, 1, 3, 0] / 2' : '点积 [1, 2, 2, 1] / 2', cx, 650, 28, INK, 'center', true);
          });
        });
        fade(aggregate, () => {
          txt('[ ' + HEAD_OUT[h].map(fixed).join('   ') + ' ]', cx, 650, 46, color);
          txt(h === 0 ? 'V₁ = (x₁, x₂)' : 'V₂ = (x₃, x₄)', cx, 698, 28, INK);
        });
      }
      // A printed register separates the two experiments, not a pair of UI cards.
      fade(split, () => etched(800, 235, 800, 668, INK, 0.6, 0.3));
    });
    fade(join, () => {
      txt('CONCATENATE', 800, 209, 32, INK);
      const centres = [530, 710, 890, 1070];
      for (let d = 0; d < 4; d++) {
        const startingX = d < 2 ? 380 + d * 120 : 1100 + (d - 2) * 120;
        txt(fixed(JOINED[d]), lerp(startingX, centres[d], join), lerp(650, 294, join), 48, d < 2 ? RED : INK);
      }
      bracket(415, 242, 71, 1); bracket(1185, 242, 71, -1);
      line(800, 253, 800, 303, INK, 0.6);
      fade(ramp(t, 10.8, 12.7), () => {
        arrow(800, 330, 800, 360, INK, 1);
        txt('Wᴼ =', 569, 472, 42, INK, 'center', false, true);
        matrix(WO, 838, 458, 66, 42, 31);
        txt('4 × 4', 1095, 472, 27, INK);
      });
      fade(output, () => {
        arrow(800, 568, 800, 594, INK, 1);
        txt('[ ' + OUTPUT.map(fixed).join('   ') + ' ]', 800, 650, 45, INK);
        etched(461, 667, 461 + ramp(t, 12.3, 14.8) * 678, 667, RED, 1.3);
      });
      fade(ramp(t, 12.8, 14.9), () => {
        txt('通常 dₖ = dᵥ = dmodel / h    ·    Transformer base：512 / 8 = 64', 800, 720, 27, INK, 'center', true);
      });
    });
  }

  const shots = { dotlab, matrixlab, headlab };
  window.drawAttentionLab = function drawAttentionLab(id, t) {
    const draw = shots[id];
    if (!draw) return;
    t = Math.max(0, Number.isFinite(t) ? t : 0);
    g.save(); g.beginPath(); g.rect(75, 86, 1450, 655); g.clip();
    g.lineCap = 'round'; g.lineJoin = 'round'; draw(t); g.restore();
  };
}());
