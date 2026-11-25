import { Resvg } from "@resvg/resvg-js";
import { esc, f, grow, classFor } from "./geom.mjs";
import { marksFor } from "./diff.mjs";

const PANEL = 1000, HEADER = 146, FOOTER = 34, GAP = 16;
const MARK_STROKE_PX = 2.5;
const HUE = { before: "#ff2d2d", after: "#19c819", property: "#ff9b00" };
export const RECONSTRUCTION_NOTE = "Simplified reconstruction drawn from Altium History archive data by journal/tools. Not an Altium screenshot or export.";

export function contextView(box, minSize) {
  const w = box[2] - box[0], h = box[3] - box[1];
  const v = grow(box, Math.max(w, h) * 0.35 + minSize * 0.1);
  const cx = (v[0] + v[2]) / 2, cy = (v[1] + v[3]) / 2;
  const vw = Math.max(v[2] - v[0], minSize), vh = Math.max(v[3] - v[1], minSize * 0.75);
  return [cx - vw / 2, cy - vh / 2, cx + vw / 2, cy + vh / 2];
}

function panel(doc, view, scale, ox, oy, pw, ph, items, title, clusterBox, unitStroke) {
  const [x0, , , y1] = view;
  const tx = ox - x0 * scale, ty = oy + y1 * scale;
  const markSvg = marksFor(items).map((m) => {
    const b = grow(m.box, unitStroke * 1.5), c = m.property ? HUE.property : HUE[m.side];
    const fill = m.property ? 'fill="none"' : `fill="${c}" fill-opacity="0.18"`;
    const dash = m.property ? ` stroke-dasharray="${f(unitStroke * 3)} ${f(unitStroke * 2)}"` : "";
    return `<rect x="${f(b[0])}" y="${f(b[1])}" width="${f(b[2] - b[0])}" height="${f(b[3] - b[1])}" ${fill} stroke="${c}" stroke-width="${f(unitStroke)}"${dash}/>`;
  }).join("");
  const cb = grow(clusterBox, unitStroke * 6);
  return `<svg x="${ox}" y="${oy}" width="${pw}" height="${ph}" overflow="hidden"><rect width="${pw}" height="${ph}" fill="${doc.background}"/></svg>
<g clip-path="url(#clip${ox})"><g transform="matrix(${f(scale)} 0 0 ${f(-scale)} ${f(tx)} ${f(ty)})" font-family="Arial">
${doc.prims.map((p) => p.svg).join("")}${markSvg}
<rect x="${f(cb[0])}" y="${f(cb[1])}" width="${f(cb[2] - cb[0])}" height="${f(cb[3] - cb[1])}" fill="none" stroke="#00b4ff" stroke-width="${f(unitStroke * 1.6)}" stroke-dasharray="${f(unitStroke * 6)} ${f(unitStroke * 4)}"/>
</g></g>
<clipPath id="clip${ox}"><rect x="${ox}" y="${oy}" width="${pw}" height="${ph}"/></clipPath>
<rect x="${ox}" y="${oy}" width="${pw}" height="${ph}" fill="none" stroke="#666" stroke-width="1"/>
<text x="${ox + 8}" y="${oy + ph + 24}" font-size="18" font-family="Arial" fill="#222">${esc(title)}</text>`;
}

// Side-by-side crop: block start (baseline) on the left, block end on the right.
export function renderComparison({ before, after, view, cluster, headerLines, beforeTitle, afterTitle, scaleNote }) {
  const vw = view[2] - view[0], vh = view[3] - view[1];
  const scale = Math.min(PANEL / vw, (PANEL * 0.8) / vh);
  const pw = Math.round(vw * scale), ph = Math.round(vh * scale);
  const W = pw * 2 + GAP * 3, H = HEADER + ph + FOOTER + GAP;
  const strokeUnits = MARK_STROKE_PX / scale;
  const left = panel(before || { prims: [], background: after.background }, view, scale, GAP, HEADER, pw, ph, cluster.items.filter((i) => i.side === "before"), beforeTitle, cluster.box, strokeUnits);
  const right = panel(after, view, scale, GAP * 2 + pw, HEADER, pw, ph, cluster.items.filter((i) => i.side === "after"), afterTitle, cluster.box, strokeUnits);
  const header = headerLines.map((t, i) => `<text x="${GAP}" y="${30 + i * 26}" font-size="${i ? 17 : 22}" font-family="Arial" fill="#111" ${i ? "" : 'font-weight="bold"'}>${esc(t)}</text>`).join("")
    + `<text x="${GAP}" y="${30 + headerLines.length * 26}" font-size="15" font-style="italic" font-family="Arial" fill="#a01010">${esc(RECONSTRUCTION_NOTE)}</text>`;
  const legend = `<g font-family="Arial" font-size="15" fill="#222" transform="translate(${W - 560} ${HEADER - 14})">
<rect width="14" height="14" y="-12" fill="${HUE.before}"/><text x="20">removed / old</text>
<rect x="140" width="14" height="14" y="-12" fill="${HUE.after}"/><text x="160">added / new</text>
<rect x="270" width="14" height="14" y="-12" fill="${HUE.property}"/><text x="290">property only</text>
<rect x="400" width="14" height="14" y="-12" fill="none" stroke="#00b4ff" stroke-width="2"/><text x="420">changed region</text></g>`;
  const note = `<text x="${W - GAP}" y="${H - 10}" text-anchor="end" font-size="14" font-family="Arial" fill="#555">${esc(scaleNote(vw))}</text>`;
  // PCB silkscreen text is dimmed except for components changed in this region.
  const changed = [...new Set(cluster.items.map((i) => i.component).filter(Boolean))];
  const style = `<style>.silk{fill-opacity:0.28}${changed.map((c) => `.${classFor(c)}`).join(",")}${changed.length ? "{fill-opacity:1}" : ""}</style>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${style}<rect width="${W}" height="${H}" fill="#f4f4f4"/>${header}${legend}${left}${right}${note}</svg>`;
  return new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: "Arial" } }).render().asPng();
}
