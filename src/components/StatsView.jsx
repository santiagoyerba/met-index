import { useEffect, useRef } from 'react';
import { normalizeTag } from '../utils/met';

const PAD_L  = 170;
const PAD_R  = 150;
const PAD_T  = 24;
const PAD_B  = 24;
const NODE_W = 5;
const NODE_GAP = 5;
const MAX_COUNTRY = 12;
const MAX_TYPE    = 12;
const MAX_PERIOD  = 6;

// Ambient palette for country nodes (countries have no filter chips)
const COUNTRY_PALETTE = [
  '#6b9fd4', '#d4866b', '#7ecfaa', '#d4c26b',
  '#a87ed4', '#d46b9a', '#6bc8d4', '#d4a96b',
  '#8fd46b', '#d46b6b', '#6b84d4', '#c8d46b',
];

const PERIOD_ORDER = ['Ancient', 'Medieval', 'Renaissance', 'Baroque', '19th Century', 'Modern'];

const NATIONALITY_TO_COUNTRY = {
  'italian': 'Italy', 'dutch': 'Netherlands', 'netherlandish': 'Netherlands',
  'flemish': 'Belgium', 'french': 'France', 'german': 'Germany',
  'spanish': 'Spain', 'british': 'United Kingdom', 'english': 'United Kingdom',
  'american': 'United States', 'greek': 'Greece', 'byzantine': 'Byzantine',
  'chinese': 'China', 'japanese': 'Japan', 'korean': 'Korea',
  'indian': 'India', 'persian': 'Iran', 'turkish': 'Turkey',
  'mexican': 'Mexico', 'austrian': 'Austria', 'portuguese': 'Portugal',
  'swiss': 'Switzerland', 'czech': 'Czech Republic', 'hungarian': 'Hungary',
  'polish': 'Poland', 'russian': 'Russia', 'swedish': 'Sweden',
  'ethiopian': 'Ethiopia', 'egyptian': 'Egypt', 'peruvian': 'Peru',
  'congolese': 'Congo', 'angolan': 'Angola',
};

function getCountry(obj) {
  const nat = obj.artistNationality
    ? obj.artistNationality.split(',')[0].trim().toLowerCase()
    : null;
  const natCountry = nat ? NATIONALITY_TO_COUNTRY[nat] : null;
  const raw = obj.country
    || (obj.culture ? obj.culture.split(',')[0].trim() : null)
    || natCountry;
  return NATIONALITY_TO_COUNTRY[raw?.toLowerCase()] || raw || null;
}

function getPeriod(obj) {
  const d = obj.objectBeginDate;
  if (d == null) return null;
  if (d < 500)  return 'Ancient';
  if (d < 1300) return 'Medieval';
  if (d < 1500) return 'Renaissance';
  if (d < 1700) return 'Baroque';
  if (d < 1900) return '19th Century';
  return 'Modern';
}

function buildSankeyData(objects) {
  const countryTotals = new Map();
  const typeTotals    = new Map();
  const periodTotals  = new Map();
  const leftMap  = new Map(); // country§type
  const rightMap = new Map(); // type§period

  objects.forEach(obj => {
    const country = getCountry(obj);
    const type    = normalizeTag(obj.objectName, 'objectName');
    const period  = getPeriod(obj);
    if (!country || !type || !period) return;

    countryTotals.set(country, (countryTotals.get(country) || 0) + 1);
    typeTotals.set(type,       (typeTotals.get(type)       || 0) + 1);
    periodTotals.set(period,   (periodTotals.get(period)   || 0) + 1);

    const lk = country + '§' + type;
    leftMap.set(lk,  (leftMap.get(lk)  || 0) + 1);
    const rk = type + '§' + period;
    rightMap.set(rk, (rightMap.get(rk) || 0) + 1);
  });

  const countries = [...countryTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_COUNTRY);
  const types     = [...typeTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_TYPE);
  const periods   = [...periodTotals.entries()]
    .sort((a, b) => PERIOD_ORDER.indexOf(a[0]) - PERIOD_ORDER.indexOf(b[0]))
    .slice(0, MAX_PERIOD);

  const countrySet = new Set(countries.map(c => c[0]));
  const typeSet    = new Set(types.map(t => t[0]));
  const periodSet  = new Set(periods.map(p => p[0]));

  const leftFlows = [];
  leftMap.forEach((count, key) => {
    const [country, type] = key.split('§');
    if (countrySet.has(country) && typeSet.has(type)) leftFlows.push({ country, type, count });
  });

  const rightFlows = [];
  rightMap.forEach((count, key) => {
    const [type, period] = key.split('§');
    if (typeSet.has(type) && periodSet.has(period)) rightFlows.push({ type, period, count });
  });

  return { countries, types, periods, leftFlows, rightFlows };
}

function placeNodes(entries, availH) {
  const sqrtTotal = entries.reduce((s, [, v]) => s + Math.sqrt(v), 0);
  const gaps  = NODE_GAP * (entries.length - 1);
  const usable = Math.max(1, availH - gaps);
  let y = PAD_T;
  return entries.map(([name, count]) => {
    const h = Math.max(8, (Math.sqrt(count) / sqrtTotal) * usable);
    const node = { name, count, y, h, inUsedH: 0, outUsedH: 0 };
    y += h + NODE_GAP;
    return node;
  });
}

function buildFlowPaths(flows, srcNodes, tgtNodes, srcX, tgtX, srcField, tgtField) {
  const srcMap = new Map(srcNodes.map(n => [n.name, n]));
  const tgtMap = new Map(tgtNodes.map(n => [n.name, n]));
  const midX   = srcX + (tgtX - srcX) * 0.5;

  const tgtYMap = new Map(tgtNodes.map(n => [n.name, n.y]));
  const sorted  = [...flows].sort((a, b) => {
    if (a[srcField] !== b[srcField]) return 0;
    return (tgtYMap.get(a[tgtField]) || 0) - (tgtYMap.get(b[tgtField]) || 0);
  });

  return sorted.map((f, origIdx) => {
    const src = srcMap.get(f[srcField]);
    const tgt = tgtMap.get(f[tgtField]);
    if (!src || !tgt) return null;

    const srcFlowH = (f.count / src.count) * src.h;
    const tgtFlowH = (f.count / tgt.count) * tgt.h;
    const srcY = src.y + src.outUsedH;
    const tgtY = tgt.y + tgt.inUsedH;
    src.outUsedH += srcFlowH;
    tgt.inUsedH  += tgtFlowH;

    const path = new Path2D();
    path.moveTo(srcX, srcY);
    path.bezierCurveTo(midX, srcY, midX, tgtY, tgtX, tgtY);
    path.lineTo(tgtX, tgtY + tgtFlowH);
    path.bezierCurveTo(midX, tgtY + tgtFlowH, midX, srcY + srcFlowH, srcX, srcY + srcFlowH);
    path.closePath();

    return { ...f, origIdx, path };
  }).filter(Boolean);
}

export default function StatsView({ objects, activeTags, tagColors }) {
  const canvasRef  = useRef(null);
  const tooltipRef = useRef(null);
  const stateRef   = useRef({
    hLeft: -1, hRight: -1, hNode: null, pinnedNode: null,
    leftPaths: [], rightPaths: [],
    countryNodes: [], typeNodes: [], periodNodes: [],
    col1X: 0, col2X: 0, col3X: 0,
  });
  const filterRef = useRef({ activeTags, tagColors });
  filterRef.current = { activeTags, tagColors };
  const redrawRef = useRef(null);

  useEffect(() => {
    const canvas  = canvasRef.current;
    const tooltip = tooltipRef.current;
    if (!canvas || !tooltip) return;

    const ctx = canvas.getContext('2d');
    const { countries, types, periods, leftFlows, rightFlows } = buildSankeyData(objects);

    function redraw() {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      const { activeTags, tagColors } = filterRef.current;
      const { hLeft, hRight, hNode, pinnedNode } = stateRef.current;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      if (!leftFlows.length) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '11px Geist, Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('NO DATA', W / 2, H / 2);
        return;
      }

      const availH = H - PAD_T - PAD_B;
      const countryNodes = placeNodes(countries, availH);
      const typeNodes    = placeNodes(types,    availH);
      const periodNodes  = placeNodes(periods,  availH);

      const col1X = PAD_L;
      const col2X = PAD_L + (W - PAD_L - PAD_R - NODE_W) * 0.48;
      const col3X = W - PAD_R - NODE_W;

      const leftPaths  = buildFlowPaths(leftFlows,  countryNodes, typeNodes,   col1X,          col2X, 'country', 'type');
      const rightPaths = buildFlowPaths(rightFlows, typeNodes,    periodNodes, col2X + NODE_W, col3X, 'type',    'period');

      stateRef.current.leftPaths    = leftPaths;
      stateRef.current.rightPaths   = rightPaths;
      stateRef.current.countryNodes = countryNodes;
      stateRef.current.typeNodes    = typeNodes;
      stateRef.current.periodNodes  = periodNodes;
      stateRef.current.col1X = col1X;
      stateRef.current.col2X = col2X;
      stateRef.current.col3X = col3X;

      // ── Color maps ──────────────────────────────────────────────────
      const countryColorMap = new Map();
      countries.forEach(([name], i) => countryColorMap.set(name, COUNTRY_PALETTE[i % COUNTRY_PALETTE.length]));

      const typeDominant = new Map();
      leftFlows.forEach(f => {
        const cur = typeDominant.get(f.type);
        if (!cur || f.count > cur.count) typeDominant.set(f.type, { country: f.country, count: f.count });
      });
      const typeColorMap = new Map();
      typeDominant.forEach((v, t) => {
        const typeTag = normalizeTag(t, 'objectName');
        typeColorMap.set(t, tagColors.get(typeTag) || countryColorMap.get(v.country) || '#fff');
      });

      // ── Hover / pin ─────────────────────────────────────────────────
      const anyFilter = activeTags.size > 0;
      const anyHover  = !!pinnedNode || hNode !== null || hLeft !== -1 || hRight !== -1;

      function getConnected(node) {
        const r = { countries: new Set(), types: new Set(), periods: new Set() };
        if (!node) return r;
        if (node.side === 'country') {
          r.countries.add(node.name);
          leftPaths.forEach(f => { if (f.country === node.name) r.types.add(f.type); });
        } else if (node.side === 'type') {
          r.types.add(node.name);
          leftPaths.forEach(f =>  { if (f.type === node.name) r.countries.add(f.country); });
          rightPaths.forEach(f => { if (f.type === node.name) r.periods.add(f.period); });
        } else if (node.side === 'period') {
          r.periods.add(node.name);
          rightPaths.forEach(f => { if (f.period === node.name) r.types.add(f.type); });
        }
        return r;
      }

      const pinC = getConnected(pinnedNode);
      const hovC = getConnected(hNode);
      const activeCountries = new Set([...pinC.countries, ...hovC.countries]);
      const activeTypes     = new Set([...pinC.types,     ...hovC.types]);
      const activePeriods   = new Set([...pinC.periods,   ...hovC.periods]);

      function isFlowActive(flow, side, node) {
        if (!node) return false;
        if (side === 'left') {
          return (node.side === 'country' && node.name === flow.country) ||
                 (node.side === 'type'    && node.name === flow.type);
        } else {
          return (node.side === 'type'   && node.name === flow.type)   ||
                 (node.side === 'period' && node.name === flow.period);
        }
      }

      function flowAlpha(flow, side) {
        const isHov    = side === 'left' ? hLeft === flow.origIdx : hRight === flow.origIdx;
        const connected = isFlowActive(flow, side, hNode) || isFlowActive(flow, side, pinnedNode);
        const typeTag   = flow.type ? normalizeTag(flow.type, 'objectName') : null;
        const hasColor  = (typeTag && activeTags.has(typeTag));

        if (isHov || connected) return 0.72;
        if (anyHover) return 0.04;
        if (anyFilter && !hasColor) return 0.03;
        if (anyFilter && hasColor)  return 0.45;
        return 0.18;
      }

      function flowColor(flow) {
        const typeTag    = flow.type ? normalizeTag(flow.type, 'objectName') : null;
        const typeFC     = typeTag && activeTags.has(typeTag) ? tagColors.get(typeTag) : null;
        if (typeFC) return typeFC;
        if (flow.country) return countryColorMap.get(flow.country) || '#fff';
        if (flow.type)    return typeColorMap.get(flow.type)       || '#fff';
        return '#fff';
      }

      // ── Draw flows ──────────────────────────────────────────────────
      function drawFlows(paths, side) {
        const dim = [], bright = [];
        paths.forEach(f => (flowAlpha(f, side) > 0.1 ? bright : dim).push(f));
        [...dim, ...bright].forEach(f => {
          ctx.globalAlpha = flowAlpha(f, side);
          ctx.fillStyle   = flowColor(f);
          ctx.fill(f.path);
          ctx.globalAlpha = 1;
        });
      }

      drawFlows(leftPaths,  'left');
      drawFlows(rightPaths, 'right');

      // ── Draw nodes ──────────────────────────────────────────────────
      const nodeBaseAlpha = anyHover ? 0.2 : 0.55;

      function drawNode(x, n, active, color, isPinned) {
        ctx.globalAlpha = active ? 1 : nodeBaseAlpha;
        ctx.fillStyle   = color || '#fff';
        ctx.fillRect(x, n.y, NODE_W, n.h);
        if (isPinned) {
          ctx.globalAlpha = 1;
          ctx.fillStyle   = color || '#fff';
          ctx.beginPath();
          ctx.arc(x + NODE_W / 2, n.y - 5, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      countryNodes.forEach(n => {
        const active   = activeCountries.has(n.name);
        const isPinned = pinnedNode?.side === 'country' && pinnedNode?.name === n.name;
        drawNode(col1X, n, active, countryColorMap.get(n.name), isPinned);
      });

      typeNodes.forEach(n => {
        const typeTag  = normalizeTag(n.name, 'objectName');
        const active   = activeTypes.has(n.name);
        const isPinned = pinnedNode?.side === 'type' && pinnedNode?.name === n.name;
        drawNode(col2X, n, active, tagColors.get(typeTag) || typeColorMap.get(n.name), isPinned);
      });

      periodNodes.forEach(n => {
        const active   = activePeriods.has(n.name);
        const isPinned = pinnedNode?.side === 'period' && pinnedNode?.name === n.name;
        drawNode(col3X, n, active, null, isPinned);
      });

      // ── Labels ──────────────────────────────────────────────────────
      ctx.font = '11px Geist, Helvetica, Arial, sans-serif';

      countryNodes.forEach(n => {
        ctx.globalAlpha = activeCountries.has(n.name) ? 1 : anyHover ? 0.18 : 0.48;
        ctx.fillStyle   = '#fff';
        ctx.textAlign   = 'right';
        let label = n.name.toUpperCase();
        if (label.length > 20) label = label.slice(0, 19) + '…';
        ctx.fillText(label, col1X - NODE_W - 8, n.y + n.h / 2 + 4);
        ctx.globalAlpha = 1;
      });

      typeNodes.forEach(n => {
        ctx.globalAlpha = activeTypes.has(n.name) ? 1 : anyHover ? 0.18 : 0.48;
        ctx.fillStyle   = '#fff';
        ctx.textAlign   = 'left';
        let label = n.name.toUpperCase();
        if (label.length > 12) label = label.slice(0, 11) + '…';
        ctx.fillText(label, col2X + NODE_W + 6, n.y + n.h / 2 + 4);
        ctx.globalAlpha = 1;
      });

      periodNodes.forEach(n => {
        ctx.globalAlpha = activePeriods.has(n.name) ? 1 : anyHover ? 0.18 : 0.48;
        ctx.fillStyle   = '#fff';
        ctx.textAlign   = 'left';
        ctx.fillText(n.name.toUpperCase(), col3X + NODE_W + 8, n.y + n.h / 2 + 4);
        ctx.globalAlpha = 1;
      });
    }

    redrawRef.current = redraw;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = canvas.offsetWidth  * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    function positionTooltip(e) {
      const tW   = tooltip.offsetWidth;
      const left = e.clientX + 14 + tW > window.innerWidth - 8
        ? e.clientX - tW - 14 : e.clientX + 14;
      tooltip.style.left = `${left}px`;
      tooltip.style.top  = `${e.clientY - 10}px`;
    }

    function onMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { leftPaths, rightPaths, countryNodes, typeNodes, periodNodes,
              col1X, col2X, col3X } = stateRef.current;

      const W = canvas.offsetWidth;
      let foundNode = null;

      countryNodes.forEach(n => {
        if (mx >= 0 && mx <= col1X + NODE_W && my >= n.y - 1 && my <= n.y + n.h + 1)
          foundNode = { side: 'country', name: n.name, count: n.count };
      });
      typeNodes.forEach(n => {
        if (mx >= col2X - 20 && mx <= col2X + NODE_W + 110 && my >= n.y - 1 && my <= n.y + n.h + 1)
          foundNode = { side: 'type', name: n.name, count: n.count };
      });
      periodNodes.forEach(n => {
        if (mx >= col3X - 2 && mx <= W && my >= n.y - 1 && my <= n.y + n.h + 1)
          foundNode = { side: 'period', name: n.name, count: n.count };
      });

      let foundLeft = null, foundRight = null;
      if (!foundNode) {
        if (mx >= col1X && mx <= col2X) {
          for (let i = leftPaths.length - 1; i >= 0; i--) {
            if (ctx.isPointInPath(leftPaths[i].path, mx, my)) { foundLeft = leftPaths[i]; break; }
          }
        }
        if (mx >= col2X + NODE_W && mx <= col3X) {
          for (let i = rightPaths.length - 1; i >= 0; i--) {
            if (ctx.isPointInPath(rightPaths[i].path, mx, my)) { foundRight = rightPaths[i]; break; }
          }
        }
      }

      canvas.style.cursor = foundNode ? 'pointer' : 'default';

      const hLeftIdx  = foundLeft  ? foundLeft.origIdx  : -1;
      const hRightIdx = foundRight ? foundRight.origIdx : -1;

      const prev = stateRef.current;
      if (prev.hLeft !== hLeftIdx || prev.hRight !== hRightIdx ||
          prev.hNode?.name !== foundNode?.name || prev.hNode?.side !== foundNode?.side) {
        stateRef.current.hLeft  = hLeftIdx;
        stateRef.current.hRight = hRightIdx;
        stateRef.current.hNode  = foundNode;
        redraw();
      }

      if (foundNode) {
        tooltip.textContent = `${foundNode.name.toUpperCase()} — ${foundNode.count}`;
        tooltip.style.display = 'block';
        positionTooltip(e);
      } else if (foundLeft) {
        tooltip.textContent = `${foundLeft.country.toUpperCase()} → ${foundLeft.type.toUpperCase()} — ${foundLeft.count}`;
        tooltip.style.display = 'block';
        positionTooltip(e);
      } else if (foundRight) {
        tooltip.textContent = `${foundRight.type.toUpperCase()} → ${foundRight.period.toUpperCase()} — ${foundRight.count}`;
        tooltip.style.display = 'block';
        positionTooltip(e);
      } else {
        tooltip.style.display = 'none';
      }
    }

    function onMouseLeave() {
      stateRef.current.hLeft  = -1;
      stateRef.current.hRight = -1;
      stateRef.current.hNode  = null;
      tooltip.style.display = 'none';
      redraw();
    }

    function onClick() {
      const { hNode, pinnedNode } = stateRef.current;
      if (!hNode) {
        if (pinnedNode) {
          stateRef.current.pinnedNode = null;
          canvas.style.cursor = 'default';
          redraw();
        }
        return;
      }
      const alreadyPinned = pinnedNode?.name === hNode.name && pinnedNode?.side === hNode.side;
      stateRef.current.pinnedNode = alreadyPinned ? null : { ...hNode };
      redraw();
    }

    canvas.addEventListener('mousemove',  onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('click',      onClick);

    return () => {
      ro.disconnect();
      canvas.removeEventListener('mousemove',  onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('click',      onClick);
      tooltip.style.display = 'none';
    };
  }, [objects]);

  useEffect(() => {
    if (redrawRef.current) redrawRef.current();
  }, [activeTags, tagColors]);

  return (
    <div id="view-stats">
      <canvas ref={canvasRef} id="stats-canvas" />
      <div ref={tooltipRef} id="stats-tooltip" />
    </div>
  );
}
