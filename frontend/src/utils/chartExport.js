/** Escape a CSV cell value. */
export function escapeCsvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * @param {string} filename - without extension
 * @param {string[]} headers
 * @param {Record<string, unknown>[]} rows
 * @param {{ key: string; label: string }[]} columns
 */
export function downloadChartCsv(filename, rows, columns) {
  const headerLine = columns.map((c) => escapeCsvCell(c.label)).join(',');
  const body = rows.map((row) =>
    columns.map((c) => escapeCsvCell(row[c.key])).join(','),
  );
  const blob = new Blob([[headerLine, ...body].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const SVG_STYLE_PROPS = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'color',
  'display',
];

/** Recharts chart surface (not stray icon/tooltip svgs). */
function findChartSvg(container) {
  if (!container) return null;
  const surfaces = container.querySelectorAll('svg.recharts-surface');
  if (surfaces.length) return surfaces[surfaces.length - 1];

  const svgs = [...container.querySelectorAll('svg')];
  if (!svgs.length) return null;

  return svgs.reduce((best, el) => {
    const { width, height } = el.getBoundingClientRect();
    const area = width * height;
    return area > best.area ? { el, area } : best;
  }, { el: svgs[0], area: 0 }).el;
}

function parseViewBox(svg) {
  const raw = svg.getAttribute('viewBox');
  if (!raw) return null;
  const parts = raw.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
}

/** Copy computed styles so the serialized SVG matches on-screen rendering. */
function inlineSvgStyles(root) {
  [root, ...root.querySelectorAll('*')].forEach((node) => {
    const computed = window.getComputedStyle(node);
    const existing = node.getAttribute('style') || '';
    const extra = SVG_STYLE_PROPS.map((prop) => {
      const value = computed.getPropertyValue(prop);
      return value ? `${prop}:${value};` : '';
    }).join('');
    if (extra) node.setAttribute('style', `${existing}${extra}`);
  });
}

function prepareSvgClone(svg) {
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  const rect = svg.getBoundingClientRect();
  const vb = parseViewBox(svg);
  const width = vb?.width || rect.width || 1;
  const height = vb?.height || rect.height || 1;

  if (vb) {
    clone.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.width} ${vb.height}`);
  } else {
    clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }

  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.removeAttribute('style');

  inlineSvgStyles(clone);
  return { clone, width, height };
}

/** Export the Recharts surface inside `container` as PNG (2× pixel ratio). */
export function downloadContainerChartPng(container, filename, { background = '#ffffff', pixelRatio = 2 } = {}) {
  const svg = findChartSvg(container);
  if (!svg) return Promise.resolve(false);

  const { clone, width, height } = prepareSvgClone(svg);
  const w = Math.max(1, Math.round(width * pixelRatio));
  const h = Math.max(1, Math.round(height * pixelRatio));

  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));

  const source = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((pngBlob) => {
        if (pngBlob) {
          const pngUrl = URL.createObjectURL(pngBlob);
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = `${filename}.png`;
          a.click();
          URL.revokeObjectURL(pngUrl);
        }
        URL.revokeObjectURL(url);
        resolve(true);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    img.src = url;
  });
}
