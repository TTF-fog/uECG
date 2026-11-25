export const emptyBox = () => [Infinity, Infinity, -Infinity, -Infinity];
export const isEmpty = (b) => !(b[0] <= b[2] && b[1] <= b[3]);

export function addPoint(b, x, y, pad = 0) {
  b[0] = Math.min(b[0], x - pad); b[1] = Math.min(b[1], y - pad);
  b[2] = Math.max(b[2], x + pad); b[3] = Math.max(b[3], y + pad);
  return b;
}

export function union(a, b) {
  if (isEmpty(b)) return a;
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

export const grow = (b, d) => [b[0] - d, b[1] - d, b[2] + d, b[3] + d];
export const overlaps = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

export function rotatedRectBox(cx, cy, w, h, deg) {
  const r = (deg * Math.PI) / 180, c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
  const hw = (w * c + h * s) / 2, hh = (w * s + h * c) / 2;
  return [cx - hw, cy - hh, cx + hw, cy + hh];
}

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const f = (n) => (Math.round(n * 100) / 100).toString();

// Text in a y-up drawing: anchor at (x, y), rotated CCW by deg, glyphs kept upright.
// hAlign 0/1/2 = left/centre/right, vAlign 0/1/2 = bottom/middle/top.
export function textSvg(x, y, text, size, deg, color, hAlign = 0, vAlign = 0, mirror = false, cls = "") {
  const anchor = ["start", "middle", "end"][hAlign];
  const dy = [0, 0.35, 0.75][vAlign] * size;
  const sx = mirror ? -1 : 1;
  return `<text${cls ? ` class="${cls}"` : ""} transform="translate(${f(x)} ${f(y)}) rotate(${f(deg)}) scale(${sx} -1)" font-size="${f(size)}" fill="${color}" text-anchor="${anchor}" dy="${f(dy)}">${esc(text)}</text>`;
}

export const classFor = (designator) => `c-${String(designator).replace(/[^A-Za-z0-9]/g, (ch) => `_${ch.charCodeAt(0)}`)}`;

export function textBox(x, y, text, size, deg, hAlign = 0, vAlign = 0) {
  const w = 0.6 * size * Math.max(1, String(text).length), h = size;
  const lx = -[0, 0.5, 1][hAlign] * w, ly = -[0, 0.5, 1][vAlign] * h;
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const b = emptyBox();
  for (const [u, v] of [[lx, ly], [lx + w, ly], [lx, ly + h], [lx + w, ly + h]]) addPoint(b, x + u * c - v * s, y + u * s + v * c);
  return b;
}

export function arcPath(cx, cy, r, a1, a2) {
  const span = (((a2 - a1) % 360) + 360) % 360;
  if (span === 0 || Math.abs(a2 - a1) >= 360) return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/>`;
  const p = (a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x1, y1] = p(a1), [x2, y2] = p(a1 + span);
  return `<path d="M${f(x1)} ${f(y1)}A${f(r)} ${f(r)} 0 ${span > 180 ? 1 : 0} 1 ${f(x2)} ${f(y2)}"/>`;
}

export function arcBox(cx, cy, r, a1, a2, pad) {
  const b = emptyBox();
  let span = (((a2 - a1) % 360) + 360) % 360;
  if (span === 0) span = 360;
  for (let a = a1; a <= a1 + span + 1e-9; a += Math.min(15, span)) addPoint(b, cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180), pad);
  addPoint(b, cx + r * Math.cos(((a1 + span) * Math.PI) / 180), cy + r * Math.sin(((a1 + span) * Math.PI) / 180), pad);
  return b;
}
