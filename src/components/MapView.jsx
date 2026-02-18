import { useEffect, useRef, useMemo } from 'react';
import {
  geoNaturalEarth1,
  geoPath,
  geoGraticule,
  geoBounds,
  geoContains,
  geoCentroid,
  select,
  zoom as d3Zoom,
  zoomIdentity,
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
  const wrapRef    = useRef(null);
  const svgRef     = useRef(null);
  const closeRef   = useRef(null);
  const tooltipRef = useRef(null);
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
    const closeBtn = closeRef.current;
    const tooltip = tooltipRef.current;
    if (!wrap || !svgEl || !closeBtn || !tooltip) return;

    const svg       = select(svgEl);
    const g         = svg.select('g.map-g');
    const gCountries = g.select('g.countries-layer'); // paths (z-order: below)
    const gDots      = g.select('g.dots-layer');      // dots  (z-order: always on top)
    let W = wrap.offsetWidth;
    let H = wrap.offsetHeight;

    const projection = geoNaturalEarth1();
    const pathGen    = geoPath(projection);

    let zoomedCountry = null;
    let zoomedFeature = null;

    const zoomBehavior = d3Zoom()
      .scaleExtent([1, 14])
      .translateExtent([[0, 0], [W, H]])
      .on('zoom', event => g.attr('transform', event.transform));

    svg.call(zoomBehavior);

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
      if (any && !fc) return 'rgba(255,255,255,0.03)';
      return 'rgba(255,255,255,0.07)';
    }

    function getStroke(d) {
      const name  = getCountryName(d);
      const count = name ? countsRef.current.get(name) : 0;
      if (!count) return 'rgba(255,255,255,0.14)';
      const fc  = filterColorsRef.current.get(name);
      const any = filterRef.current.activeTags.size > 0;
      if (any && fc)  return hexToRgba(fc, 0.65);
      if (any && !fc) return 'rgba(255,255,255,0.2)';
      return 'rgba(255,255,255,0.5)';
    }

    function getDotFill(obj) {
      const { activeTags, tagColors } = filterRef.current;
      if (activeTags.size === 0) return 'rgba(255,255,255,0.7)';
      const dept = normalizeTag(obj.department || '', 'department');
      const type = normalizeTag(obj.objectName  || '', 'objectName');
      for (const tag of activeTags) {
        if (dept === tag || type === tag) return tagColors.get(tag) || 'rgba(255,255,255,0.7)';
      }
      return 'rgba(255,255,255,0.12)';
    }

    // ── Dot rendering ──────────────────────────────────────────────
    function renderDots(feat, name) {
      gDots.selectAll('.artwork-dot').remove();
      const works = objectsRef.current.filter(o => getCountry(o) === name);
      if (!works.length) return;

      const mainFeat = getMainFeature(feat);
      const [[lonMin, latMin], [lonMax, latMax]] = geoBounds(mainFeat);

      const points = [];
      let attempts = 0;
      while (points.length < works.length && attempts < works.length * 40) {
        const lon = lonMin + Math.random() * (lonMax - lonMin);
        const lat = latMin + Math.random() * (latMax - latMin);
        if (geoContains(mainFeat, [lon, lat])) {
          const [sx, sy] = projection([lon, lat]);
          const w = works[points.length];
          points.push({ x: sx, y: sy, obj: w, hasImage: !!(w.primaryImageSmall || w.primaryImage) });
        }
        attempts++;
      }
      // Fallback: place remaining around centroid
      if (points.length < works.length) {
        const [cx, cy] = projection(geoCentroid(mainFeat));
        while (points.length < works.length) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * 8;
          const w = works[points.length];
          points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, obj: w, hasImage: !!(w.primaryImageSmall || w.primaryImage) });
        }
      }

      const dots = gDots.selectAll('.artwork-dot')
        .data(points)
        .join('circle')
        .attr('class', 'artwork-dot')
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('r', 1.2)
        .attr('fill', d => d.hasImage ? getDotFill(d.obj) : 'rgba(255,255,255,0.18)')
        .attr('stroke', d => d.hasImage ? 'transparent' : 'none')
        .attr('stroke-width', d => d.hasImage ? 7 : 0)
        .attr('opacity', 0)
        .style('cursor', d => d.hasImage ? 'pointer' : 'default');

      dots.transition().delay(380).duration(280).attr('opacity', 1);

      dots
        .on('mouseenter', function(event, d) {
          if (d.hasImage) {
            select(this).raise().attr('r', 2.5).attr('fill', '#fff').attr('opacity', 1);
          }
          const title = d.obj.title || d.obj.objectName || '–';
          tooltip.textContent = title.length > 60 ? title.slice(0, 59) + '…' : title;
          tooltip.style.display = 'block';
          positionTooltip(event);
        })
        .on('mousemove', positionTooltip)
        .on('mouseleave', function(event, d) {
          if (d.hasImage) {
            select(this).attr('r', 1.2).attr('fill', getDotFill(d.obj)).attr('opacity', 1);
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

    // ── Reset zoom ────────────────────────────────────────────────
    function resetZoom() {
      zoomedCountry = null;
      zoomedFeature = null;
      closeBtn.classList.remove('visible');
      gDots.selectAll('.artwork-dot').remove();
      d3Ref.current.dots = null;
      tooltip.style.display = 'none';
      svg.transition().duration(600).call(zoomBehavior.transform, zoomIdentity);
    }

    // ── Initial draw ──────────────────────────────────────────────
    function draw() {
      projection.fitSize([W, H], countriesGeo);

      gCountries.selectAll('.graticule')
        .data([graticuleGen()])
        .join('path')
        .attr('class', 'graticule')
        .attr('d', pathGen)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255,255,255,0.05)')
        .attr('stroke-width', 0.4);

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
          closeBtn.classList.add('visible');

          const [[x0, y0], [x1, y1]] = getMainBounds(d, pathGen);
          const k  = Math.min(14, 0.82 / Math.max((x1 - x0) / W, (y1 - y0) / H));
          const tx = W / 2 - k * (x0 + x1) / 2;
          const ty = H / 2 - k * (y0 + y1) / 2;

          svg.transition().duration(700)
            .call(zoomBehavior.transform, zoomIdentity.translate(tx, ty).scale(k));

          renderDots(d, name);
        });

      d3Ref.current.paths    = paths;
      d3Ref.current.pathGen  = pathGen;
      d3Ref.current.graticule = gCountries.selectAll('.graticule');
      d3Ref.current.renderDots = renderDots;
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
        d3Ref.current.dots.attr('fill', d => d.hasImage ? getDotFill(d.obj) : 'rgba(255,255,255,0.18)');
      }
      // Re-render dots if a country is zoomed (objects may have changed)
      if (zoomedCountry && zoomedFeature) {
        renderDots(zoomedFeature, zoomedCountry);
      }
    }
    redrawColorsRef.current = redrawColors;

    svg.on('click.bg', resetZoom);
    closeBtn.addEventListener('click', resetZoom);

    draw();

    // ── Resize ────────────────────────────────────────────────────
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      W = width; H = height;
      zoomBehavior.translateExtent([[0, 0], [W, H]]);
      projection.fitSize([W, H], countriesGeo);
      d3Ref.current.graticule?.attr('d', pathGen);
      d3Ref.current.paths?.attr('d', pathGen);
      // Reposition dots on resize
      if (d3Ref.current.dots && zoomedFeature) {
        renderDots(zoomedFeature, zoomedCountry);
      }
    });
    ro.observe(wrap);

    return () => {
      ro.disconnect();
      svg.on('.zoom', null);
      svg.on('click.bg', null);
      closeBtn.removeEventListener('click', resetZoom);
      tooltip.style.display = 'none';
    };
  }, []);

  // ── Re-color on filter / data change ─────────────────────────────
  useEffect(() => {
    if (redrawColorsRef.current) redrawColorsRef.current();
  }, [activeTags, tagColors, countryCounts]);

  return (
    <div id="view-map" ref={wrapRef}>
      <svg ref={svgRef}>
        <g className="map-g">
          <g className="countries-layer" />
          <g className="dots-layer" />
        </g>
      </svg>
      <button ref={closeRef} id="map-close">Close</button>
      <div ref={tooltipRef} id="map-tooltip" />
    </div>
  );
}
