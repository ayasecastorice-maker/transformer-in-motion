/* Inference plates: exact causal KV reuse and grouped-query attention.
   Pure functions of local shot time; the host provides g and the paper. */
(function () {
  'use strict';
  const INK = '#191918', RED = '#b9352c', PAPER = '#e9e7df';
  const SERIF = 'Georgia,"Times New Roman",serif';
  const CN = '"Noto Serif SC","Source Han Serif SC","Songti SC","SimSun",serif';
  const TAU = Math.PI * 2;
  const WORDS = ['小猫', '坐在', '垫子', '上', '看着', '窗外'];
  const clamp = x => Math.max(0, Math.min(1, x));
  const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const ramp = (t, a, b) => ease((t - a) / (b - a));
  const mix = (a, b, u) => a + (b - a) * u;
  const seed = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  function alpha(a, fn) { if (a <= 0) return; g.save(); g.globalAlpha *= clamp(a); fn(); g.restore(); }
  function text(s, x, y, size = 30, color = INK, align = 'center', chinese = false, italic = false) {
    g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic';
    g.font = (italic ? 'italic ' : '') + size + 'px ' + (chinese ? CN : SERIF);
    g.fillText(String(s), x, y);
  }
  function path(points, color = INK, width = 1) {
    if (!points.length) return;
    g.beginPath(); g.moveTo(...points[0]);
    for (let j = 1; j < points.length; j++) g.lineTo(...points[j]);
    g.strokeStyle = color; g.lineWidth = width; g.stroke();
  }
  function line(x1, y1, x2, y2, color = INK, width = 1) { path([[x1, y1], [x2, y2]], color, width); }
  function etched(x1, y1, x2, y2, color = INK, width = 0.8) {
    const points = [];
    for (let j = 0; j <= 32; j++) {
      const u = j / 32;
      points.push([mix(x1, x2, u) + Math.sin(j * 1.71) * 0.4, mix(y1, y2, u) + Math.sin(j * 2.17) * 0.4]);
    }
    path(points, color, width);
  }
  function grain(x, y, radius = 1.4, color = INK) {
    g.beginPath(); g.arc(x, y, radius, 0, TAU); g.fillStyle = color; g.fill();
  }
  function bracket(x, y, height, direction = 1, color = INK) {
    path([[x + 11 * direction, y], [x, y], [x, y + height], [x + 11 * direction, y + height]], color, 1.2);
  }
  function arrow(x1, y1, x2, y2, color = INK, width = 1) {
    line(x1, y1, x2, y2, color, width);
    const a = Math.atan2(y2 - y1, x2 - x1), r = 10;
    path([[x2 - Math.cos(a - 0.5) * r, y2 - Math.sin(a - 0.5) * r], [x2, y2],
      [x2 - Math.cos(a + 0.5) * r, y2 - Math.sin(a + 0.5) * r]], color, width);
  }
  function heading(title, right) {
    text(title, 91, 125, 22, INK, 'left');
    text(right, 1500, 125, 22, INK, 'right', true);
  }
  function stipple(cx, cy, width, height, salt, reveal = 1, color = INK) {
    const cols = 11, rows = 5;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const n = r * cols + c, random = seed(salt + n * 7.9);
      const appear = ramp(reveal, random * 0.62, random * 0.62 + 0.38);
      alpha(appear * (0.4 + random * 0.6), () => {
        grain(cx + (c / (cols - 1) - 0.5) * width,
          cy + (r / (rows - 1) - 0.5) * height, 0.9 + random * 1.7, color);
      });
    }
  }
  function cacheColumn(x, ky, vy, i, appear, highlight, compression = 0) {
    const color = highlight ? RED : INK;
    stipple(x, ky, 81, 36, i * 147, appear, color);
    stipple(x, vy, 81, 36, i * 147 + 91, appear, color);
    alpha(appear, () => {
      bracket(x - 55, ky - 27, 54, 1, color); bracket(x + 55, ky - 27, 54, -1, color);
      bracket(x - 55, vy - 27, 54, 1, color); bracket(x + 55, vy - 27, 54, -1, color);
      text(i + 1, x, mix(vy + 46, vy + 42, compression), 23, color);
    });
  }

  function cache(t) {
    heading('PREFILL / INCREMENTAL DECODE', 'KV CACHE · 因果解码');
    const fill = ramp(t, 0.6, 3.9), decode = ramp(t, 4.0, 5.6);
    const summary = ramp(t, 12.7, 15.0), settled = ramp(t, 15.0, 17.8);
    const ky = mix(420, 358, summary), vy = mix(529, 458, summary);
    const present = t < 9.5 ? 5 : 6;
    const current = present - 1;
    const append = present === 5 ? ramp(t, 5.4, 7.3) : ramp(t, 9.9, 11.6);
    const newArrival = [0, 0, 0, 0, ramp(t, 5.4, 7.3), ramp(t, 9.9, 11.6)];
    const positions = [];
    for (let i = 0; i < 6; i++) positions.push(i < 4 ? mix(360 + i * 290, 340 + i * 160, decode) : 340 + i * 160);

    alpha(1 - decode, () => {
      text('PREFILL', 800, 186, 31, INK);
      for (let i = 0; i < 4; i++) {
        const appear = ramp(t, i * 0.16, 1.1 + i * 0.16), x = positions[i];
        alpha(appear, () => {
          text(WORDS[i], x, 265, 52, INK, 'center', true);
          arrow(x, 293, x, 351, INK, 0.85);
          text('k' + (i + 1) + ' / v' + (i + 1), x, 379, 27, INK, 'center', false, true);
        });
      }
    });
    text('K', 163, ky + 18, 58, INK, 'center', false, true);
    text('V', 163, vy + 18, 58, INK, 'center', false, true);
    alpha(fill, () => {
      text('第 ℓ 层', 163, vy + 87, 24, INK, 'center', true);
      text('图示单头', 163, vy + 115, 20, INK, 'center', true);
      const cacheRight = mix(1300, 1235, decode);
      bracket(245, ky - 46, vy - ky + 92, 1);
      bracket(cacheRight, ky - 46, vy - ky + 92, -1);
    });
    for (let i = 0; i < 6; i++) {
      const reveal = i < 4 ? ramp(t, 1.25 + i * 0.2, 3.65 + i * 0.12) : newArrival[i];
      const isNew = i === current && decode > 0.5 && summary < 0.6;
      cacheColumn(positions[i], ky, vy, i, reveal, isNew, summary);
    }

    alpha(decode * (1 - summary), () => {
      // The next token is sampled from the previous step, then fed back as this input.
      text('本步输入：' + WORDS[current], 800, 206, 38, INK, 'center', true);
      arrow(655, 225, 366, 263, RED, 1);
      arrow(945, 225, 1212, 263, INK, 1);
      text('q' + present, 302, 298, 62, RED, 'center', false, true);
      text('k' + present + ', v' + present, 1285, 295, 39, RED, 'center', false, true);
      const newestX = positions[current];
      alpha(append, () => {
        path([[1285, 310], [1285, ky - 80], [newestX, ky - 80]], RED, 0.8);
        arrow(newestX, ky - 80, newestX, ky - 34, RED, 0.8);
      });
      // One horizontal reading rail, then separate taps into every visible cached key.
      const read = present === 5 ? ramp(t, 6.8, 8.6) : ramp(t, 11.1, 12.8);
      const railY = ky - 62, lastX = positions[current];
      alpha(read, () => {
        path([[302, 312], [302, railY], [lastX, railY]], RED, 1.1);
        for (let j = 0; j < present; j++) {
          arrow(positions[j], railY, positions[j], ky - 32, RED, 0.75);
          const u = (t * 0.65 + j * 0.13) % 1;
          grain(positions[j], mix(ky + 29, vy - 31, u), 1.5, j === current ? RED : INK);
        }
        const scan = ((t - (present === 5 ? 6.8 : 11.1)) * 0.43) % 1;
        grain(mix(positions[0], lastX, Math.max(0, scan)), railY, 3.2, RED);
      });
      text('读取长度  ' + present, 1375, 431, 29, RED, 'center', true);
      text('1 … ' + present, 1375, 473, 32, INK);
      text('追加', 1375, 548, 27, RED, 'center', true);
      text('qₜ K≤ₜᵀ / √dₕ  →  softmax  →  α V≤ₜ', 800, 648, 31, INK, 'center', false, true);
      alpha(append, () => {
        text('旧 K/V 保留', 580, 606, 25, INK, 'center', true);
        text('新 K/V 写入', newestX, 606, 25, RED, 'center', true);
      });
    });
    alpha((1 - summary), () => {
      text('每层分别保存  K, V : [ B, hKV, T, dₕ ]', 800, 705, 28, INK, 'center', true);
    });
    alpha(summary, () => {
      text('精确复用 · 旧 K/V 无须重算', 800, 228, 45, INK, 'center', true);
      text('因果注意力 · 相同位置定义 · 推理模式', 800, 274, 27, INK, 'center', true);
      text('缓存随前缀增长', 1375, 365, 26, INK, 'center', true);
      text('T = 6', 1375, 415, 40, RED);
      const scan = (t * 0.27) % 1;
      line(285, ky - 64, 1195, ky - 64, RED, 0.7);
      grain(mix(285, 1195, scan), ky - 64, 3.4, RED);
      text('每层 K, V : [ B, hKV, t, dₕ ]', 800, 568, 32, INK);
      alpha(settled, () => {
        text('每层每样本  O(t · hQ · dₕ)', 440, 629, 30, RED, 'center', true);
        text('KV存储  O(L · B · t · hKV · dₕ)', 1133, 629, 29, INK, 'center', true);
        text('读遍可见前缀；代价包括计算、缓存容量和读取带宽', 800, 703, 29, INK, 'center', true);
      });
    });
  }

  function queryHead(x, y, i, color = INK) {
    g.beginPath(); g.ellipse(x, y, 36, 36, 0, 0, TAU); g.strokeStyle = color; g.lineWidth = 1.1; g.stroke();
    text('Q' + (i + 1), x, y + 10, 29, color, 'center', false, true);
  }
  function kvPair(x, ky, vy, i, reveal, wide, color = INK, labelAlpha = 1) {
    const w = mix(66, 242, wide), labelX = x - mix(0, 165, wide);
    alpha(reveal, () => {
      // A pair is two tensors, K and V, not two different KV heads.
      stipple(x, ky, w, 28, i * 271 + 8, 1, color);
      stipple(x, vy, w, 28, i * 271 + 96, 1, color);
      bracket(x - w / 2 - 12, ky - 25, 50, 1, color);
      bracket(x + w / 2 + 12, ky - 25, 50, -1, color);
      bracket(x - w / 2 - 12, vy - 25, 50, 1, color);
      bracket(x + w / 2 + 12, vy - 25, 50, -1, color);
      if (wide < 0.5) {
        alpha(labelAlpha, () => {
          text('K' + (i + 1), x, ky - 39, 26, color);
          text('V' + (i + 1), x, vy + 56, 26, color);
        });
      } else {
        text('K', labelX, ky + 12, 36, color, 'center', false, true);
        text('V', labelX, vy + 12, 36, color, 'center', false, true);
      }
    });
  }
  function gqa(t) {
    // This morph compares head topologies. It is not an exact conversion of MHA
    // weights or an instruction to average an already-populated KV cache.
    heading('GROUPED KEY / VALUE HEADS', '分组查询注意力');
    const enter = ramp(t, 0, 1.8), grouping = ramp(t, 3.0, 6.7);
    const merged = ramp(t, 5.6, 7.8), memory = ramp(t, 8.9, 11.4), detail = ramp(t, 10.7, 13.7);
    const qy = mix(253, 225, memory), railY = mix(340, 304, memory);
    const ky = mix(455, 373, memory), vy = mix(553, 450, memory);
    const qxs = Array.from({ length: 8 }, (_, i) => 240 + 160 * i);
    const centres = [480, 1120];
    alpha(enter, () => {
      text('8 Q HEADS', 800, 178, 30, INK);
      for (let i = 0; i < 8; i++) {
        const phase = ramp(t, i * 0.1, 1.0 + i * 0.1);
        alpha(phase, () => queryHead(qxs[i], qy, i, i < 4 && merged > 0.2 ? RED : INK));
        const group = Math.floor(i / 4), cx = centres[group];
        const kx = mix(qxs[i], cx, grouping);
        alpha(1 - merged, () => {
          path([[qxs[i], qy + 42], [qxs[i], railY], [kx, railY], [kx, ky - 80]], INK, 0.75);
          kvPair(kx, ky, vy, i, 1 - merged, 0, INK, 1 - ramp(grouping, 0.08, 0.4));
        });
      }
      alpha(1 - merged, () => text('8 KV HEADS = 8 对 K / V', 800, 674, 31, INK, 'center', true));
      for (let group = 0; group < 2; group++) {
        const cx = centres[group], color = group === 0 ? RED : INK;
        alpha(merged, () => {
          const first = group * 4;
          // Each group's orthogonal rail is disjoint. No query crosses to the other KV group.
          line(qxs[first], railY, qxs[first + 3], railY, color, 1.2);
          for (let j = first; j < first + 4; j++) {
            line(qxs[j], qy + 42, qxs[j], railY, color, 0.9);
            const travel = (t * 0.32 + j * 0.17) % 1;
            grain(qxs[j], mix(qy + 42, railY, travel), 2, color);
          }
          arrow(cx, railY, cx, ky - 40, color, 1.1);
          kvPair(cx, ky, vy, group, 1, 1, color);
          alpha(1 - memory, () => text('4 个 Q → 1 对 K/V', cx, 654, 29, color, 'center', true));
          alpha(memory, () => text('GROUP ' + (group + 1), cx, 509, 27, color));
        });
      }
    });
    alpha(memory, () => {
      text('2 KV HEADS', 800, 509, 26, INK);
      text('512 MiB', 475, 613, 74, INK);
      text('128 MiB', 1125, 613, 74, RED);
      arrow(700, 585, 895, 585, INK, 1.4);
      text('KV ÷ 4', 800, 641, 27, RED);
      alpha(detail, () => {
        text('2 × B × L × T × hKV × dₕ × 2 bytes', 800, 687, 29, INK);
        text('B = 1   L = 32   T = 4096   dₕ = 128   FP16   hKV : 8 → 2', 800, 727, 26, INK);
        // Sweep all eight old head slots; only two physical KV groups remain.
        const reveal = ramp(t, 11.4, 14.0);
        etched(930, 626, 930 + 390 * reveal, 626, RED, 1.2);
      });
    });
  }

  const shots = { cache, gqa };
  window.drawInferenceShot = function drawInferenceShot(id, t) {
    if (!shots[id]) return;
    t = Math.max(0, Number.isFinite(t) ? t : 0);
    g.save(); g.beginPath(); g.rect(75, 86, 1450, 655); g.clip();
    g.lineCap = 'round'; g.lineJoin = 'round'; shots[id](t); g.restore();
  };
}());
