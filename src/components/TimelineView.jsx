import { useEffect, useRef } from 'react';
import { TAG_FIELDS, normalizeTag, getMatchingColors, hexToRgba } from '../utils/met';

const TOP_N = 18;
const LABEL_W = 210;
const LABEL_X = 20; // left-margin for country labels
const PAD_R = 40;
const PAD_T = 160;
const PAD_B = 48;
const NODE_R = 5;
const WHITE = '#ffffff';

function getYear(obj) {
  let year = obj.objectBeginDate;
  if (!year) {
    const m = (obj.objectDate || '').match(/\b(\d{4})\b/);
    if (m) year = parseInt(m[1]);
  }
  return year || null;
}

function hashJitter(id) {
  let h = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return ((h & 0xff) / 255) * 2 - 1;
}

function processData(objects) {
  const groups = {};
  objects.forEach(obj => {
    const year = getYear(obj);
    if (!year) return;
    const country = obj.country || (obj.culture ? obj.culture.split(',')[0].trim() : null);
    if (!country?.trim()) return;

    if (!groups[country]) groups[country] = [];
    // Store tag fields for color matching
    const tags = new Set(
      TAG_FIELDS.map(f => normalizeTag(obj[f] || '', f)).filter(v => v?.trim())
    );
    groups[country].push({
      year,
      title: obj.title,
      date: obj.objectDate,
      id: obj.objectID,
      tags,
    });
  });

  return Object.entries(groups)
    .map(([name, works]) => ({
      name,
      works: works.sort((a, b) => a.year - b.year),
      count: works.length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N)
    .sort((a, b) => a.works[0].year - b.works[0].year);
}

function getNodeFill(ctx, work, activeTags, tagColors, x, r) {
  if (activeTags.size === 0) return null; // use default white
  const matches = [...activeTags]
    .filter(tag => work.tags.has(tag))
    .map(tag => tagColors.get(tag))
    .filter(Boolean);
  if (matches.length === 0) return 'dim';
  if (matches.length === 1) return matches[0];
  // Gradient for 2+ matches
  const grad = ctx.createLinearGradient(x - r, 0, x + r, 0);
  grad.addColorStop(0, matches[0]);
  grad.addColorStop(1, matches[1]);
  return grad;
}

// Quantile-based x scale: more space for denser time periods
function buildXScale(rows) {
  const allYears = rows.flatMap(r => r.works.map(w => w.year)).sort((a, b) => a - b);
  const n = allYears.length;
  if (n <= 1) return { yearToFrac: () => 0.5, sortedYears: allYears };

  function yearToFrac(year) {
    let lo = 0, hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (allYears[mid] < year) lo = mid + 1;
      else hi = mid;
    }
    // Find full range of equal years
    let first = lo, last = lo;
    while (first > 0 && allYears[first - 1] === year) first--;
    while (last < n - 1 && allYears[last + 1] === year) last++;
    if (allYears[first] === year) return ((first + last) / 2) / (n - 1);
    // Interpolate between neighbors
    if (lo === 0) return 0;
    if (lo >= n) return 1;
    const t = (year - allYears[lo - 1]) / (allYears[lo] - allYears[lo - 1]);
    return ((lo - 1) + t) / (n - 1);
  }

  return { yearToFrac, sortedYears: allYears };
}

function getExpandedXOf(row, W) {
  const rowYears = row.works.map(w => w.year);
  const rowMin = Math.min(...rowYears);
  const rowMax = Math.max(...rowYears);
  const range = (rowMax - rowMin) || 100;
  const pad = Math.max(50, range * 0.12);
  const eMin = rowMin - pad;
  const eMax = rowMax + pad;
  return year => LABEL_W + ((year - eMin) / (eMax - eMin)) * (W - LABEL_W - PAD_R);
}

export default function TimelineView({ objects, activeTags, tagColors }) {
  const canvasRef = useRef(null);
  const tooltipRef = useRef(null);
  const closeRef = useRef(null);

  const stateRef = useRef({
    rows: [], minYear: 0, maxYear: 0,
    yearToFrac: () => 0.5, sortedYears: [],
    hRow: -1, hNode: -1,
    progress: 0,
    expandedRow: -1,
    expandProgress: 0,
  });
  const rafRef = useRef(null);
  const particleRafRef = useRef(null);
  const redrawRef = useRef(null);

  // Re-draw when filters change (without re-running the full effect)
  const filterRef = useRef({ activeTags, tagColors });
  filterRef.current = { activeTags, tagColors };

  useEffect(() => {
    const canvas = canvasRef.current;
    const tooltip = tooltipRef.current;
    const closeBtn = closeRef.current;
    if (!canvas || !tooltip || !closeBtn) return;

    const ctx = canvas.getContext('2d');
    const rows = processData(objects);

    const allYears = rows.flatMap(r => r.works.map(w => w.year));
    const minYear = rows.length ? Math.min(...allYears) : 0;
    const maxYear = rows.length ? Math.max(...allYears) : 1;

    const { yearToFrac, sortedYears } = buildXScale(rows);
    stateRef.current = { rows, minYear, maxYear, yearToFrac, sortedYears, hRow: -1, hNode: -1, progress: 0, expandedRow: -1, expandProgress: 0, particles: [] };

    function getLayout() {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      const chartW = W - LABEL_W - PAD_R;
      const chartH = H - PAD_T - PAD_B;
      const { rows, yearToFrac, minYear, maxYear } = stateRef.current;
      const rowH = rows.length ? chartH / rows.length : 1;
      const yearRange = (maxYear - minYear) || 1;
      const xOf = year => LABEL_W + yearToFrac(year) * chartW;
      const baseY = i => PAD_T + i * rowH + rowH / 2;
      const nodeY = (i, id) => baseY(i) + hashJitter(id) * rowH * 0.28;
      return { W, H, chartW, chartH, rowH, yearRange, xOf, baseY, nodeY };
    }

    function positionTooltip(e) {
      const tW = tooltip.offsetWidth;
      const left = e.clientX + 14 + tW > window.innerWidth - 8
        ? e.clientX - tW - 14
        : e.clientX + 14;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${e.clientY - 10}px`;
    }

    function redraw() {
      const { W, H, chartW, rowH, xOf, baseY, nodeY } = getLayout();
      const { rows, hRow, hNode, progress, expandedRow, expandProgress } = stateRef.current;
      const { activeTags, tagColors } = filterRef.current;
      const clipW = progress * chartW;
      const anyHovered = hRow !== -1;
      const anyFilter = activeTags.size > 0;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      if (!rows.length) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '11px Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('NO DATA', W / 2, H / 2);
        return;
      }

      // ── Expanded view ─────────────────────────────
      if (expandedRow !== -1 && expandProgress > 0) {
        const row = rows[expandedRow];
        const ep = expandProgress;
        const rowXOf = getExpandedXOf(row, W);
        const currentXOf = year => {
          const gx = xOf(year);
          const rx = rowXOf(year);
          return gx + (rx - gx) * ep;
        };
        const centerY = H / 2;
        const normalRowBaseY = baseY(expandedRow);
        const currentY = (id) => {
          const ny = normalRowBaseY + hashJitter(id) * rowH * 0.28;
          const ey = centerY + hashJitter(id) * H * 0.1;
          return ny + (ey - ny) * ep;
        };
        const nodeR = NODE_R + NODE_R * ep;

        // Lines (white, neutral)
        ctx.lineWidth = 0.5 + 0.5 * ep;
        ctx.strokeStyle = `rgba(255,255,255,${0.12 + 0.3 * ep})`;
        for (let j = 0; j < row.works.length - 1; j++) {
          ctx.beginPath();
          ctx.moveTo(currentXOf(row.works[j].year), currentY(row.works[j].id));
          ctx.lineTo(currentXOf(row.works[j + 1].year), currentY(row.works[j + 1].id));
          ctx.stroke();
        }

        // Pre-pass: collision detection for labels
        ctx.font = '12px Helvetica, Arial, sans-serif';
        const shownAbove = [];
        const shownBelow = [];
        row.works.forEach((w, j) => {
          const x = currentXOf(w.year);
          const above = j % 2 === 0;
          const arr = above ? shownAbove : shownBelow;
          let t = w.title || '';
          if (t.length > 28) t = t.slice(0, 27) + '…';
          const halfW = ctx.measureText(t).width / 2 + 8;
          const overlaps = arr.some(prev => Math.abs(prev.x - x) < prev.halfW + halfW);
          if (!overlaps) arr.push({ x, halfW, j });
        });
        const visibleLabels = new Set([
          ...shownAbove.map(e => e.j),
          ...shownBelow.map(e => e.j),
        ]);

        // Nodes
        row.works.forEach((w, j) => {
          const x = currentXOf(w.year);
          const y = currentY(w.id);
          const isHovered = hRow === expandedRow && hNode === j;
          const nr = isHovered ? nodeR + 1.5 : nodeR;
          const fill = getNodeFill(ctx, w, activeTags, tagColors, x, nr);

          if (fill === 'dim') {
            ctx.fillStyle = `rgba(255,255,255,${0.12 * ep})`;
          } else if (fill) {
            ctx.fillStyle = fill;
          } else {
            ctx.fillStyle = isHovered ? WHITE : `rgba(255,255,255,${0.45 + 0.5 * ep})`;
          }
          ctx.beginPath();
          ctx.arc(x, y, nr, 0, Math.PI * 2);
          ctx.fill();

          const showLabel = visibleLabels.has(j) || isHovered;
          if (ep > 0.6 && showLabel) {
            const alpha = Math.min(1, (ep - 0.6) / 0.4);
            ctx.save();
            ctx.font = '12px Helvetica, Arial, sans-serif';
            ctx.textAlign = 'center';
            const labelColor = fill && fill !== 'dim' && typeof fill === 'string' ? fill : WHITE;
            ctx.fillStyle = isHovered
              ? hexToRgba(labelColor === WHITE ? WHITE : labelColor, alpha)
              : `rgba(255,255,255,${alpha * 0.5})`;
            let title = w.title || '';
            if (title.length > 28) title = title.slice(0, 27) + '…';
            const yearLabel = w.date || (w.year < 0 ? `${Math.abs(w.year)} BC` : String(w.year));
            const above = j % 2 === 0;
            ctx.fillText(title, x, above ? y - nr - 14 : y + nr + 10);
            ctx.fillStyle = `rgba(255,255,255,${alpha * 0.3})`;
            ctx.fillText(yearLabel, x, above ? y - nr - 3 : y + nr + 21);
            ctx.restore();
          }
        });

        // Row name
        if (ep > 0.3) {
          const alpha = Math.min(1, (ep - 0.3) / 0.4);
          ctx.font = '12px Helvetica, Arial, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillStyle = `rgba(255,255,255,${alpha * 0.45})`;
          let name = row.name.toUpperCase();
          if (name.length > 17) name = name.slice(0, 16) + '…';
          ctx.fillText(name, LABEL_X, centerY + 4);
        }

        // Year axis (row-specific)
        if (ep > 0.4) {
          const alpha = Math.min(1, (ep - 0.4) / 0.4);
          ctx.textAlign = 'center';
          ctx.fillStyle = `rgba(255,255,255,${0.28 * alpha})`;
          ctx.font = '12px Helvetica, Arial, sans-serif';
          const rowYears = row.works.map(w => w.year);
          const rMin = Math.min(...rowYears);
          const rMax = Math.max(...rowYears);
          const rRange = (rMax - rMin) || 100;
          const rPad = Math.max(50, rRange * 0.12);
          const tickMin = rMin - rPad;
          const tickMax = rMax + rPad;
          for (let t = 0; t <= 5; t++) {
            const year = Math.round(tickMin + ((tickMax - tickMin) / 5) * t);
            const x = rowXOf(year);
            ctx.fillText(year < 0 ? `${Math.abs(year)} BC` : String(year), x, H - PAD_B + 20);
          }
        }

        drawParticles();
        return;
      }

      // ── Normal view ───────────────────────────────

      const needsClip = progress < 1;
      if (needsClip) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(LABEL_W, 0, clipW, H);
        ctx.clip();
      }

      // Lines (white always — neutral connectors)
      rows.forEach((row, i) => {
        const isHovered = hRow === i;
        ctx.lineWidth = isHovered ? 0.8 : 0.5;
        ctx.strokeStyle = anyHovered
          ? (isHovered ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.08)')
          : 'rgba(255,255,255,0.28)';

        for (let j = 0; j < row.works.length - 1; j++) {
          ctx.beginPath();
          ctx.moveTo(xOf(row.works[j].year), nodeY(i, row.works[j].id));
          ctx.lineTo(xOf(row.works[j + 1].year), nodeY(i, row.works[j + 1].id));
          ctx.stroke();
        }
      });

      // Nodes
      rows.forEach((row, i) => {
        const isHoveredRow = hRow === i;
        row.works.forEach((w, j) => {
          const x = xOf(w.year);
          const y = nodeY(i, w.id);
          const isHoveredNode = isHoveredRow && hNode === j;
          const nr = isHoveredNode ? NODE_R + 1.5 : NODE_R;
          const fill = getNodeFill(ctx, w, activeTags, tagColors, x, nr);

          if (anyHovered && !isHoveredRow) {
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
          } else if (fill === 'dim') {
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
          } else if (fill) {
            // Colored node — dim slightly if not hovered row
            ctx.fillStyle = fill;
            ctx.globalAlpha = isHoveredRow || !anyHovered ? 1 : 0.5;
          } else {
            // No filter active — white
            ctx.fillStyle = isHoveredNode ? WHITE
              : isHoveredRow ? 'rgba(255,255,255,0.75)'
              : 'rgba(255,255,255,0.42)';
          }

          ctx.beginPath();
          ctx.arc(x, y, nr, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        });
      });

      if (needsClip) ctx.restore();

      // Labels
      ctx.font = '12px Helvetica, Arial, sans-serif';
      ctx.textAlign = 'left';
      rows.forEach((row, i) => {
        const isHovered = hRow === i;
        ctx.fillStyle = anyHovered
          ? (isHovered ? WHITE : 'rgba(255,255,255,0.08)')
          : 'rgba(255,255,255,0.5)';
        let name = row.name.toUpperCase();
        if (name.length > 17) name = name.slice(0, 16) + '…';
        ctx.fillText(name, LABEL_X, baseY(i) + 3.5);
      });

      // Year ticks — quantile-based (evenly spaced by data density)
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.font = '12px Helvetica, Arial, sans-serif';
      const { sortedYears } = stateRef.current;
      const tickCount = 6;
      const tickYears = [];
      for (let t = 0; t < tickCount; t++) {
        const idx = Math.round((t / (tickCount - 1)) * (sortedYears.length - 1));
        const y = sortedYears[idx];
        if (!tickYears.includes(y)) tickYears.push(y);
      }
      tickYears.forEach(year => {
        const x = xOf(year);
        ctx.fillText(year < 0 ? `${Math.abs(year)} BC` : String(year), x, H - PAD_B + 20);
      });

      drawParticles();
    }

    function drawParticles() {
      const { particles } = stateRef.current;
      if (!particles.length) return;
      const { activeTags, tagColors } = filterRef.current;
      const filterColors = activeTags.size > 0
        ? [...activeTags].map(tag => tagColors.get(tag)).filter(Boolean)
        : null;
      particles.forEach((p, i) => {
        const alpha = p.baseAlpha + p.kickFade * 0.7;
        let fillStyle;
        if (filterColors?.length) {
          fillStyle = hexToRgba(filterColors[i % filterColors.length], alpha);
        } else {
          fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + p.kickFade * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = fillStyle;
        ctx.fill();
      });
    }

    redrawRef.current = redraw;

    const AMBIENT_COUNT = 80;

    function makeParticle(W, H) {
      return {
        x: Math.random() * W,
        y: PAD_T + Math.random() * Math.max(1, H - PAD_T - PAD_B),
        vx: (Math.random() * 0.28 + 0.04) * (Math.random() < 0.5 ? 1 : -1),
        vy: (Math.random() - 0.5) * 0.12,
        r: 0.8 + Math.random() * 1.4,
        baseAlpha: 0.2 + Math.random() * 0.35,
        kickVx: 0, kickVy: 0, kickFade: 0,
      };
    }

    function initParticles() {
      const W = canvas.offsetWidth, H = canvas.offsetHeight;
      stateRef.current.particles = Array.from({ length: AMBIENT_COUNT }, () => makeParticle(W, H));
    }

    function kickParticles(clickY) {
      stateRef.current.particles.forEach(p => {
        const dist = Math.abs(p.y - clickY);
        if (dist < 80) {
          const str = (1 - dist / 80) * 5;
          p.kickVx = (Math.random() - 0.5) * str * 3.5;
          p.kickVy = (Math.random() - 0.5) * str * 2;
          p.kickFade = 0.8 + Math.random() * 0.2;
        }
      });
    }

    function tickParticles() {
      const W = canvas.offsetWidth, H = canvas.offsetHeight;
      stateRef.current.particles.forEach(p => {
        if (p.kickFade > 0) {
          p.x += p.kickVx;
          p.y += p.kickVy;
          p.kickVx *= 0.87;
          p.kickVy *= 0.87;
          p.kickFade -= 0.035;
          if (p.kickFade < 0) p.kickFade = 0;
        }
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < PAD_T) p.y = H - PAD_B;
        if (p.y > H - PAD_B) p.y = PAD_T;
      });
    }

    function startAmbientLoop() {
      let lastTs = 0;
      function loop(ts) {
        if (ts - lastTs > 42) { // ~24fps
          lastTs = ts;
          tickParticles();
          redraw();
        }
        particleRafRef.current = requestAnimationFrame(loop);
      }
      particleRafRef.current = requestAnimationFrame(loop);
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles();
      redraw();
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    // Sweep animation
    const FRAMES = 75;
    let frame = 0;
    stateRef.current.progress = 0;

    function animate() {
      frame++;
      const t = Math.min(1, frame / FRAMES);
      stateRef.current.progress = 1 - Math.pow(1 - t, 3);
      redraw();
      if (frame < FRAMES) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        stateRef.current.progress = 1;
        redraw();
        startAmbientLoop();
      }
    }
    rafRef.current = requestAnimationFrame(animate);

    function animateExpand(targetProgress, onDone) {
      cancelAnimationFrame(rafRef.current);
      const start = stateRef.current.expandProgress;
      const FRAMES_EX = 30;
      let f = 0;
      function step() {
        f++;
        const t = Math.min(1, f / FRAMES_EX);
        stateRef.current.expandProgress = start + (1 - Math.pow(1 - t, 3)) * (targetProgress - start);
        redraw();
        if (f < FRAMES_EX) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          stateRef.current.expandProgress = targetProgress;
          redraw();
          if (onDone) onDone();
        }
      }
      rafRef.current = requestAnimationFrame(step);
    }

    function openExpanded(rowIndex) {
      stateRef.current.expandedRow = rowIndex;
      stateRef.current.hRow = rowIndex;
      stateRef.current.hNode = -1;
      closeBtn.classList.add('visible');
      animateExpand(1);
    }

    function closeExpanded() {
      animateExpand(0, () => {
        stateRef.current.expandedRow = -1;
        stateRef.current.hRow = -1;
        redraw();
      });
      closeBtn.classList.remove('visible');
      tooltip.style.display = 'none';
    }

    function onMouseMove(e) {
      if (stateRef.current.progress < 1) return;
      const { expandProgress, expandedRow } = stateRef.current;
      if (expandProgress > 0 && expandProgress < 1) return;

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { rows } = stateRef.current;
      const { W, H, rowH, xOf, nodeY } = getLayout();

      let foundRow = -1;
      let foundNode = -1;

      if (expandedRow !== -1) {
        const row = rows[expandedRow];
        const rowXOf = getExpandedXOf(row, W);
        const centerY = H / 2;
        row.works.forEach((w, j) => {
          const x = rowXOf(w.year);
          const y = centerY + hashJitter(w.id) * H * 0.1;
          if (Math.abs(mx - x) < 12 && Math.abs(my - y) < 12) {
            foundRow = expandedRow;
            foundNode = j;
          }
        });
        canvas.style.cursor = foundNode !== -1 ? 'pointer' : 'default';
      } else {
        const rowIndex = Math.floor((my - PAD_T) / rowH);
        foundRow = rowIndex >= 0 && rowIndex < rows.length ? rowIndex : -1;
        if (foundRow !== -1) {
          rows[foundRow].works.forEach((w, j) => {
            const x = xOf(w.year);
            const y = nodeY(foundRow, w.id);
            if (Math.abs(mx - x) < 9 && Math.abs(my - y) < 9) foundNode = j;
          });
        }
        canvas.style.cursor = foundRow !== -1 ? 'pointer' : 'default';
      }

      const prev = stateRef.current;
      if (prev.hRow !== foundRow || prev.hNode !== foundNode) {
        stateRef.current.hRow = foundRow;
        stateRef.current.hNode = foundNode;
        redraw();
      }

      if (foundNode !== -1 && foundRow !== -1) {
        const work = rows[foundRow].works[foundNode];
        const year = work.date || (work.year < 0 ? `${Math.abs(work.year)} BC` : work.year);
        tooltip.textContent = `${work.title} — ${year}`;
        tooltip.style.display = 'block';
        positionTooltip(e);
      } else {
        tooltip.style.display = 'none';
      }
    }

    function onClick(e) {
      if (stateRef.current.progress < 1) return;
      const { expandProgress, expandedRow, hNode } = stateRef.current;
      if (expandProgress > 0 && expandProgress < 1) return;

      if (expandedRow !== -1) {
        if (hNode === -1) closeExpanded();
      } else {
        if (stateRef.current.hRow !== -1) {
          const rect = canvas.getBoundingClientRect();
          kickParticles(e.clientY - rect.top);
          openExpanded(stateRef.current.hRow);
        }
      }
    }

    function onMouseLeave() {
      if (stateRef.current.expandedRow === -1) {
        stateRef.current.hRow = -1;
        stateRef.current.hNode = -1;
        redraw();
      }
      tooltip.style.display = 'none';
    }

    closeBtn.addEventListener('click', closeExpanded);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('click', onClick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(particleRafRef.current);
      ro.disconnect();
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('click', onClick);
      closeBtn.removeEventListener('click', closeExpanded);
      tooltip.style.display = 'none';
      closeBtn.classList.remove('visible');
    };
  }, [objects]);

  // Redraw when filters change (colors update immediately without re-animating)
  useEffect(() => {
    if (redrawRef.current && stateRef.current.rows.length) {
      redrawRef.current();
    }
  }, [activeTags, tagColors]);

  return (
    <div id="view-timeline">
      <canvas ref={canvasRef} id="timeline-canvas" />
      <button ref={closeRef} id="timeline-close">Close</button>
      <div ref={tooltipRef} id="timeline-tooltip" />
    </div>
  );
}
