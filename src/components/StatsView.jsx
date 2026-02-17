import { useEffect, useRef } from 'react';

function groupByCentury(objects) {
  const counts = {};
  objects.forEach(obj => {
    let year = obj.objectBeginDate;
    if (!year) {
      const m = (obj.objectDate || '').match(/\b(\d{4})\b/);
      if (m) year = parseInt(m[1]);
    }
    if (!year) return;
    const century = Math.floor(year / 100) * 100;
    counts[century] = (counts[century] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([c, n]) => ({ century: parseInt(c), count: n }))
    .sort((a, b) => a.century - b.century);
}

export default function StatsView({ objects }) {
  const canvasRef = useRef(null);
  const tooltipRef = useRef(null);
  const rafRef = useRef(null);
  const barsRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const tooltip = tooltipRef.current;
    if (!canvas || !tooltip) return;

    const ctx = canvas.getContext('2d');
    const data = groupByCentury(objects);
    if (!data.length) return;

    const PAD_L = 60;
    const PAD_R = 60;
    const PAD_B = 80;
    const PAD_T = 40;

    function resize() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    const ro = new ResizeObserver(() => { resize(); });
    ro.observe(canvas);
    resize();

    const maxCount = Math.max(...data.map(d => d.count));

    let scale = 3.0;
    let hoveredIndex = -1;
    const TOTAL_FRAMES = 60;
    let frame = 0;

    function easeOut(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function computeBars() {
      const W = canvas.width;
      const H = canvas.height;
      const chartW = W - PAD_L - PAD_R;
      const chartH = H - PAD_T - PAD_B;
      const barW = chartW / data.length;
      const maxBarH = chartH * 0.75;

      return data.map((d, i) => ({
        x: PAD_L + i * barW,
        barW,
        h: (d.count / maxCount) * maxBarH,
        count: d.count,
        century: d.century,
        chartH,
        H,
      }));
    }

    function drawFrame() {
      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const cy = H / 2;

      // Trail: semi-transparent fill instead of clear
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(0, 0, W, H);

      const bars = computeBars();
      barsRef.current = bars;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);

      bars.forEach((b, i) => {
        const y = b.H - PAD_B - b.h;
        const isHovered = i === hoveredIndex;
        ctx.globalAlpha = hoveredIndex === -1 ? 1 : (isHovered ? 1 : 0.35);
        ctx.fillStyle = '#fff';
        ctx.fillRect(b.x + 2, y, b.barW - 4, b.h);

        // Count label above bar
        ctx.globalAlpha = hoveredIndex === -1 ? 0.7 : (isHovered ? 1 : 0.2);
        ctx.fillStyle = '#fff';
        ctx.font = '11px Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        const labelX = b.x + b.barW / 2;
        ctx.fillText(b.count, labelX, y - 6);

        // Century label below bar
        ctx.globalAlpha = hoveredIndex === -1 ? 0.45 : (isHovered ? 0.8 : 0.15);
        ctx.fillStyle = '#fff';
        ctx.font = '11px Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        const label = b.century < 0
          ? `${Math.abs(b.century)}s BC`
          : `${b.century}s`;
        ctx.fillText(label, labelX, b.H - PAD_B + 18);
      });

      ctx.restore();
    }

    function animate() {
      if (frame < TOTAL_FRAMES) {
        const t = easeOut(frame / TOTAL_FRAMES);
        scale = 3.0 - (3.0 - 1.0) * t;
        frame++;
      } else {
        scale = 1.0;
      }
      drawFrame();
      if (frame <= TOTAL_FRAMES) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        // Final clean frame
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        scale = 1.0;
        drawFrame();
      }
    }

    rafRef.current = requestAnimationFrame(animate);

    // Mouse hover
    function onMouseMove(e) {
      if (scale > 1.01) return; // ignore during animation
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const bars = barsRef.current;

      let found = -1;
      bars.forEach((b, i) => {
        const y = b.H - PAD_B - b.h;
        if (mx >= b.x && mx <= b.x + b.barW && my >= y && my <= b.H - PAD_B) {
          found = i;
        }
      });

      if (found !== hoveredIndex) {
        hoveredIndex = found;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawFrame();
      }

      if (found !== -1) {
        const b = bars[found];
        const label = b.century < 0
          ? `${Math.abs(b.century)}s BC`
          : `${b.century}s`;
        tooltip.textContent = `${label} — ${b.count} work${b.count !== 1 ? 's' : ''}`;
        tooltip.style.display = 'block';
        tooltip.style.left = `${e.clientX + 14}px`;
        tooltip.style.top = `${e.clientY - 10}px`;
      } else {
        tooltip.style.display = 'none';
      }
    }

    function onMouseLeave() {
      hoveredIndex = -1;
      tooltip.style.display = 'none';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawFrame();
    }

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [objects]);

  return (
    <div id="view-stats">
      <canvas ref={canvasRef} id="stats-canvas" />
      <div ref={tooltipRef} id="stats-tooltip" />
    </div>
  );
}
