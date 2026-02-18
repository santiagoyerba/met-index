import { useEffect, useRef, useMemo } from 'react';
import {
  geoOrthographic,
  geoPath,
  geoGraticule,
  geoBounds,
  geoContains,
  geoCentroid,
  select,
  drag as d3Drag,
} from 'd3';
import { feature } from 'topojson-client';
import worldData from 'world-atlas/countries-110m.json';
import { normalizeTag, hexToRgba } from '../utils/met';

// ── Country helpers ───────────────────────────────────────────────────
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

const COUNTRY_TO_ISO = {
  'Italy': 380, 'Netherlands': 528, 'France': 250, 'Germany': 276,
  'Spain': 724, 'United Kingdom': 826, 'United States': 840, 'Greece': 300,
  'Belgium': 56, 'China': 156, 'Japan': 392, 'Korea': 410,
  'India': 356, 'Iran': 364, 'Turkey': 792, 'Mexico': 484,
  'Austria': 40, 'Portugal': 620, 'Switzerland': 756, 'Czech Republic': 203,
  'Hungary': 348, 'Poland': 616, 'Russia': 643, 'Sweden': 752,
  'Ethiopia': 231, 'Egypt': 818, 'Peru': 604, 'Congo': 180, 'Angola': 24,
};

const ISO_TO_COUNTRY = new Map(
  Object.entries(COUNTRY_TO_ISO).map(([name, iso]) => [iso, name])
);

function getCountryName(d) {
  return ISO_TO_COUNTRY.get(+d.id) || null;
}

// For MultiPolygon countries (France, Portugal, Spain…) use only the
// largest polygon for zoom bounds — avoids including overseas territories
function getMainBounds(d, pathGen) {
  if (d.geometry?.type === 'MultiPolygon') {
    let maxArea = 0;
    let mainBounds = null;
    d.geometry.coordinates.forEach(rings => {
      const poly = { type: 'Feature', geometry: { type: 'Polygon', coordinates: rings } };
      const b = pathGen.bounds(poly);
      const area = (b[1][0] - b[0][0]) * (b[1][1] - b[0][1]);
      if (area > maxArea) { maxArea = area; mainBounds = b; }
    });
    return mainBounds || pathGen.bounds(d);
  }
  return pathGen.bounds(d);
}

// For geoContains: use main polygon of MultiPolygon countries
function getMainFeature(d) {
  if (d.geometry?.type === 'MultiPolygon') {
    let maxArea = 0;
    let mainRings = null;
    d.geometry.coordinates.forEach(rings => {
      const poly = { type: 'Feature', geometry: { type: 'Polygon', coordinates: rings } };
      const b = geoBounds(poly);
      const area = (b[1][0] - b[0][0]) * (b[1][1] - b[0][1]);
      if (area > maxArea) { maxArea = area; mainRings = rings; }
    });
    if (mainRings) return { ...d, geometry: { type: 'Polygon', coordinates: mainRings } };
  }
  return d;
}

// Pre-parse at module level
const countriesGeo = feature(worldData, worldData.objects.countries);
const graticuleGen  = geoGraticule();

// ─────────────────────────────────────────────────────────────────────
export default function MapView({ objects, activeTags, tagColors, onNodeClick }) {
  const wrapRef          = useRef(null);
  const svgRef           = useRef(null);
  const particleCanvasRef = useRef(null);
  const tooltipRef       = useRef(null);
  const d3Ref      = useRef({});
  const filterRef  = useRef({ activeTags, tagColors });
  filterRef.current = { activeTags, tagColors };
  const objectsRef  = useRef(objects);
  objectsRef.current = objects;
  const onClickRef  = useRef(onNodeClick);
  onClickRef.current = onNodeClick;
  const redrawColorsRef = useRef(null);

  // ── Country totals ─────────────────────────────────────────────────
  const countryCounts = useMemo(() => {
    const m = new Map();
    objects.forEach(obj => {
      const c = getCountry(obj);
      if (c) m.set(c, (m.get(c) || 0) + 1);
    });
    return m;
  }, [objects]);

  const countryFilterColors = useMemo(() => {
    const m = new Map();
    if (activeTags.size === 0) return m;
    objects.forEach(obj => {
      const c = getCountry(obj);
      if (!c || m.has(c)) return;
      for (const tag of activeTags) {
        const dept = normalizeTag(obj.department || '', 'department');
        const type = normalizeTag(obj.objectName  || '', 'objectName');
        if (dept === tag || type === tag) { m.set(c, tagColors.get(tag)); break; }
      }
    });
    return m;
  }, [objects, activeTags, tagColors]);

  const countsRef       = useRef(countryCounts);
  countsRef.current     = countryCounts;
  const filterColorsRef = useRef(countryFilterColors);
  filterColorsRef.current = countryFilterColors;

  // ── D3 setup (runs once on mount) ─────────────────────────────────
  useEffect(() => {
    const wrap    = wrapRef.current;
    const svgEl   = svgRef.current;
    const tooltip = tooltipRef.current;
    if (!wrap || !svgEl || !tooltip) return;

    const svg       = select(svgEl);
    const g         = svg.select('g.map-g');
    const gCountries = g.select('g.countries-layer'); // paths (z-order: below)
    const gDots      = g.select('g.dots-layer');      // dots  (z-order: always on top)
    let W = wrap.offsetWidth;
    let H = wrap.offsetHeight;

    const DEFAULT_ROTATION = [-10, -35, 0];
    let defaultScale = 1;
    let defaultTranslate = [0, 0];

    const projection = geoOrthographic()
      .clipAngle(90)
      .precision(0.3)
      .rotate(DEFAULT_ROTATION);
    const pathGen = geoPath(projection);

    let zoomedCountry = null;
    let zoomedFeature = null;
    let isZoomed = false;

    // ── Fit projection to viewport (horizon effect) ────────────────
    function fitProjection() {
      const R = Math.max(W / 2, H * 0.85);
      defaultScale = R;
      defaultTranslate = [W / 2, H * 0.08 + R];
      projection.scale(R).translate(defaultTranslate);
    }

    // ── Visibility check: is [lon,lat] on the front hemisphere? ───
    // geoOrthographic's clipAngle(90) only clips paths via streaming;
    // direct projection() calls don't apply it — we check manually.
    function isVisible(lon, lat) {
      const r = projection.rotate();
      const cLon = -r[0] * Math.PI / 180;
      const cLat = -r[1] * Math.PI / 180;
      const pLon = lon * Math.PI / 180;
      const pLat = lat * Math.PI / 180;
      return Math.sin(pLat) * Math.sin(cLat) +
             Math.cos(pLat) * Math.cos(cLat) * Math.cos(pLon - cLon) > 0;
    }

    // ── Redraw all paths + reproject dots ─────────────────────────
    function redrawPaths() {
      d3Ref.current.sphere?.attr('d', pathGen({ type: 'Sphere' }));
      d3Ref.current.graticule?.attr('d', pathGen);
      d3Ref.current.paths?.attr('d', pathGen);
      if (d3Ref.current.dots) {
        d3Ref.current.dots
          .attr('cx', d => { const p = projection([d.lon, d.lat]); return p ? p[0] : -9999; })
          .attr('cy', d => { const p = projection([d.lon, d.lat]); return p ? p[1] : -9999; })
          .attr('opacity', d => isVisible(d.lon, d.lat) ? 1 : 0);
      }
    }

    // ── Animated transition of rotation + scale + translate ───────
    function animateToState(targetRot, targetScale, targetTranslate, onDone) {
      if (typeof targetTranslate === 'function') { onDone = targetTranslate; targetTranslate = null; }
      const startRot       = projection.rotate();
      const startScale     = projection.scale();
      const startTranslate = projection.translate();
      let t = 0;
      const interval = setInterval(() => {
        t = Math.min(1, t + 1 / 45);
        const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        projection
          .rotate([
            startRot[0] + (targetRot[0] - startRot[0]) * e,
            startRot[1] + (targetRot[1] - startRot[1]) * e,
            0,
          ])
          .scale(startScale + (targetScale - startScale) * e);
        if (targetTranslate) {
          projection.translate([
            startTranslate[0] + (targetTranslate[0] - startTranslate[0]) * e,
            startTranslate[1] + (targetTranslate[1] - startTranslate[1]) * e,
          ]);
        }
        redrawPaths();
        if (t >= 1) { clearInterval(interval); onDone?.(); }
      }, 16);
    }

    // ── Drag to rotate ────────────────────────────────────────────
    const drag = d3Drag()
      .on('drag', event => {
        const sens = 80 / projection.scale();
        const [l, p] = projection.rotate();
        projection.rotate([
          l + event.dx * sens,
          Math.max(-90, Math.min(90, p - event.dy * sens)),
          0,
        ]);
        redrawPaths();
      })
      .on('end', () => {});

    svg.call(drag);

    // ── Tooltip helper ─────────────────────────────────────────────
    function positionTooltip(event) {
      const tW   = tooltip.offsetWidth;
      const left = event.clientX + 14 + tW > window.innerWidth - 8
        ? event.clientX - tW - 14 : event.clientX + 14;
      tooltip.style.left = `${left}px`;
      tooltip.style.top  = `${event.clientY - 10}px`;
    }

    // ── Color helpers ──────────────────────────────────────────────
    function getFill(d) {
      const name  = getCountryName(d);
      if (!name) return 'transparent';
      const count = countsRef.current.get(name);
      if (!count) return 'transparent';
      const fc  = filterColorsRef.current.get(name);
      const any = filterRef.current.activeTags.size > 0;
      if (any && fc)  return hexToRgba(fc, 0.18);
      if (any && !fc) return 'rgba(255,255,255,0.06)';
      return 'rgba(255,255,255,0.14)';
    }

    function getStroke(d) {
      const name  = getCountryName(d);
      const count = name ? countsRef.current.get(name) : 0;
      if (!count) return 'rgba(255,255,255,0.22)';
      const fc  = filterColorsRef.current.get(name);
      const any = filterRef.current.activeTags.size > 0;
      if (any && fc)  return hexToRgba(fc, 0.8);
      if (any && !fc) return 'rgba(255,255,255,0.3)';
      return 'rgba(255,255,255,0.65)';
    }

    function getDotFill(obj) {
      const { activeTags, tagColors } = filterRef.current;
      if (activeTags.size === 0) return 'rgba(255,255,255,0.85)';
      const dept = normalizeTag(obj.department || '', 'department');
      const type = normalizeTag(obj.objectName  || '', 'objectName');
      for (const tag of activeTags) {
        if (dept === tag || type === tag) return tagColors.get(tag) || 'rgba(255,255,255,0.85)';
      }
      return 'rgba(255,255,255,0.2)';
    }

    // ── Dot rendering (all countries) ─────────────────────────────
    function renderAllDots() {
      gDots.selectAll('.artwork-dot').remove();
      const allPoints = [];

      countriesGeo.features.forEach(feat => {
        const name = getCountryName(feat);
        if (!name) return;
        const works = objectsRef.current.filter(o => getCountry(o) === name);
        if (!works.length) return;

        const mainFeat = getMainFeature(feat);
        const [[lonMin, latMin], [lonMax, latMax]] = geoBounds(mainFeat);
        const [clon, clat] = geoCentroid(mainFeat);

        const points = [];
        let attempts = 0;
        while (points.length < works.length && attempts < works.length * 40) {
          const lon = lonMin + Math.random() * (lonMax - lonMin);
          const lat = latMin + Math.random() * (latMax - latMin);
          if (geoContains(mainFeat, [lon, lat])) {
            const proj = projection([lon, lat]);
            if (!proj) { attempts++; continue; }
            const w = works[points.length];
            points.push({ lon, lat, country: name, obj: w, hasImage: !!(w.primaryImageSmall || w.primaryImage) });
          }
          attempts++;
        }
        // Fallback near centroid
        while (points.length < works.length) {
          const jlon = clon + (Math.random() - 0.5) * 2;
          const jlat = clat + (Math.random() - 0.5) * 2;
          const w = works[points.length];
          points.push({ lon: jlon, lat: jlat, country: name, obj: w, hasImage: !!(w.primaryImageSmall || w.primaryImage) });
        }

        allPoints.push(...points);
      });

      const dots = gDots.selectAll('.artwork-dot')
        .data(allPoints)
        .join('circle')
        .attr('class', 'artwork-dot')
        .attr('cx', d => { const p = projection([d.lon, d.lat]); return p ? p[0] : -9999; })
        .attr('cy', d => { const p = projection([d.lon, d.lat]); return p ? p[1] : -9999; })
        .attr('r', 1.8)
        .attr('fill', d => d.hasImage ? getDotFill(d.obj) : 'rgba(255,255,255,0.3)')
        .attr('opacity', d => isVisible(d.lon, d.lat) ? 1 : 0)
        .style('cursor', d => d.hasImage ? 'pointer' : 'default');

      dots
        .on('mouseenter', function(event, d) {
          if (d.hasImage) {
            select(this).raise().attr('r', 3).attr('fill', '#fff');
          }
          const title = d.obj.title || d.obj.objectName || '–';
          tooltip.textContent = title.length > 60 ? title.slice(0, 59) + '…' : title;
          tooltip.style.display = 'block';
          positionTooltip(event);
        })
        .on('mousemove', positionTooltip)
        .on('mouseleave', function(event, d) {
          if (d.hasImage) {
            select(this).attr('r', d.country === zoomedCountry ? 2.8 : 1.8).attr('fill', getDotFill(d.obj));
          }
          tooltip.style.display = 'none';
        })
        .on('click', (event, d) => {
          if (!d.hasImage) return;
          event.stopPropagation();
          if (onClickRef.current) onClickRef.current(d.obj);
        });

      d3Ref.current.dots = dots;
    }

    function highlightCountryDots(name) {
      if (!d3Ref.current.dots) return;
      d3Ref.current.dots
        .attr('r', d => d.country === name ? 2.8 : 1.8)
        .attr('opacity', d => {
          if (!isVisible(d.lon, d.lat)) return 0;
          return d.country === name ? 1 : 0.25;
        });
    }

    function resetDotHighlight() {
      if (!d3Ref.current.dots) return;
      d3Ref.current.dots
        .attr('r', 1.8)
        .attr('opacity', d => isVisible(d.lon, d.lat) ? 1 : 0);
    }

    // ── Reset zoom ────────────────────────────────────────────────
    function resetZoom() {
      isZoomed = false;
      zoomedCountry = null;
      zoomedFeature = null;
      tooltip.style.display = 'none';
      resetDotHighlight();
      animateToState(DEFAULT_ROTATION, defaultScale, defaultTranslate);
    }

    // ── Initial draw ──────────────────────────────────────────────
    function draw() {
      fitProjection();

      // Globe sphere outline
      const sphere = gCountries.selectAll('.globe-sphere')
        .data([null])
        .join('path')
        .attr('class', 'globe-sphere')
        .attr('d', pathGen({ type: 'Sphere' }))
        .attr('fill', 'rgba(255,255,255,0.03)')
        .attr('stroke', 'rgba(255,255,255,0.18)')
        .attr('stroke-width', 0.5);
      d3Ref.current.sphere = sphere;

      gCountries.selectAll('.graticule')
        .data([graticuleGen()])
        .join('path')
        .attr('class', 'graticule')
        .attr('d', pathGen)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255,255,255,0.07)')
        .attr('stroke-width', 0.3);

      const paths = gCountries.selectAll('.country')
        .data(countriesGeo.features)
        .join('path')
        .attr('class', 'country')
        .attr('d', pathGen)
        .attr('fill',   d => getFill(d))
        .attr('stroke', d => getStroke(d))
        .attr('stroke-width', 0.5)
        .style('cursor', d => {
          const n = getCountryName(d);
          return (n && countsRef.current.has(n)) ? 'pointer' : 'default';
        });

      paths
        .on('mouseenter', function(event, d) {
          const name  = getCountryName(d);
          const count = name ? countsRef.current.get(name) : null;
          if (!count) return;
          const fc = filterColorsRef.current.get(name);
          select(this).raise()
            .attr('fill',   fc ? hexToRgba(fc, 0.35) : 'rgba(255,255,255,0.22)')
            .attr('stroke', fc ? hexToRgba(fc, 1)    : 'rgba(255,255,255,0.9)');
          tooltip.textContent = `${name.toUpperCase()} — ${count}`;
          tooltip.style.display = 'block';
          positionTooltip(event);
        })
        .on('mousemove', positionTooltip)
        .on('mouseleave', function(event, d) {
          select(this).attr('fill', getFill(d)).attr('stroke', getStroke(d));
          tooltip.style.display = 'none';
        })
        .on('click', function(event, d) {
          event.stopPropagation();
          const name = getCountryName(d);
          if (!name || !countsRef.current.has(name)) return;

          if (zoomedCountry === name) { resetZoom(); return; }

          zoomedCountry = name;
          zoomedFeature = d;
          isZoomed = true;

          const mainFeat = getMainFeature(d);
          const centroid = geoCentroid(mainFeat);
          const targetRot = [-centroid[0], -centroid[1], 0];
          const [[lonMin, latMin], [lonMax, latMax]] = geoBounds(mainFeat);
          const centerLat = (latMin + latMax) / 2 * Math.PI / 180;
          const latSpan = Math.max(latMax - latMin, 5) * Math.PI / 180;
          const lonSpan = Math.max(lonMax - lonMin, 5) * Math.cos(centerLat) * Math.PI / 180;
          const targetScale = Math.min(H * 0.65 / latSpan, W * 0.65 / lonSpan, defaultScale * 8);
          animateToState(targetRot, targetScale, [W / 2, H / 2], () => highlightCountryDots(name));
        });

      d3Ref.current.paths     = paths;
      d3Ref.current.pathGen   = pathGen;
      d3Ref.current.graticule = gCountries.selectAll('.graticule');

      renderAllDots();
    }

    // ── Recolor (no re-layout) ────────────────────────────────────
    function redrawColors() {
      if (!d3Ref.current.paths) return;
      d3Ref.current.paths
        .attr('fill',   d => getFill(d))
        .attr('stroke', d => getStroke(d))
        .style('cursor', d => {
          const n = getCountryName(d);
          return (n && countsRef.current.has(n)) ? 'pointer' : 'default';
        });
      // Re-color existing dots
      if (d3Ref.current.dots) {
        d3Ref.current.dots.attr('fill', d => d.hasImage ? getDotFill(d.obj) : 'rgba(255,255,255,0.3)');
      }
    }
    redrawColorsRef.current = redrawColors;

    svg.on('click.bg', resetZoom);

    // ── Background particles ───────────────────────────────────
    const pEl  = particleCanvasRef.current;
    const pCtx = pEl ? pEl.getContext('2d') : null;
    let particles = [];
    let particleRaf = null;
    let lastParticleTs = 0;
    const PARTICLE_COUNT = 220;

    function makeParticle() {
      const pw = pEl.offsetWidth, ph = pEl.offsetHeight;
      return {
        x: Math.random() * pw,
        y: Math.random() * ph,
        vx: (Math.random() * 0.28 + 0.04) * (Math.random() < 0.5 ? 1 : -1),
        vy: (Math.random() - 0.5) * 0.12,
        r: 0.8 + Math.random() * 1.4,
        alpha: 0.15 + Math.random() * 0.3,
      };
    }

    function initParticles() {
      particles = Array.from({ length: PARTICLE_COUNT }, makeParticle);
    }

    function resizeParticleCanvas() {
      if (!pEl || !pCtx) return;
      const dpr = window.devicePixelRatio || 1;
      pEl.width  = pEl.offsetWidth  * dpr;
      pEl.height = pEl.offsetHeight * dpr;
      pCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles();
    }

    function tickAndDrawParticles() {
      if (!pEl || !pCtx) return;
      const pw = pEl.offsetWidth, ph = pEl.offsetHeight;
      pCtx.clearRect(0, 0, pw, ph);

      // Clip to the area outside the globe sphere
      const [tx, ty] = projection.translate();
      const sr = projection.scale();
      pCtx.save();
      pCtx.beginPath();
      pCtx.rect(0, 0, pw, ph);
      pCtx.arc(tx, ty, sr, 0, Math.PI * 2, true); // anticlockwise = hole
      pCtx.clip();

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = pw;
        if (p.x > pw) p.x = 0;
        if (p.y < 0) p.y = ph;
        if (p.y > ph) p.y = 0;
        pCtx.beginPath();
        pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        pCtx.fillStyle = `rgba(255,255,255,${p.alpha.toFixed(2)})`;
        pCtx.fill();
      });

      pCtx.restore();
    }

    function particleLoop(ts) {
      if (ts - lastParticleTs > 42) {
        lastParticleTs = ts;
        tickAndDrawParticles();
      }
      particleRaf = requestAnimationFrame(particleLoop);
    }

    if (pEl && pCtx) {
      resizeParticleCanvas();
      particleRaf = requestAnimationFrame(particleLoop);
    }

    draw();

    // ── Resize ────────────────────────────────────────────────────
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      W = width; H = height;
      fitProjection();
      redrawPaths();
      resizeParticleCanvas();
    });
    ro.observe(wrap);

    return () => {
      ro.disconnect();
      if (particleRaf) cancelAnimationFrame(particleRaf);
      svg.on('.drag', null);
      svg.on('click.bg', null);
      tooltip.style.display = 'none';
    };
  }, []);

  // ── Re-color on filter / data change ─────────────────────────────
  useEffect(() => {
    if (redrawColorsRef.current) redrawColorsRef.current();
  }, [activeTags, tagColors, countryCounts]);

  return (
    <div id="view-map" ref={wrapRef}>
      <canvas ref={particleCanvasRef} id="map-particles" />
      <svg ref={svgRef}>
        <g className="map-g">
          <g className="countries-layer" />
          <g className="dots-layer" />
        </g>
      </svg>
      <div ref={tooltipRef} id="map-tooltip" />
    </div>
  );
}
