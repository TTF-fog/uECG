import CFB from "cfb";
import { emptyBox, addPoint, union, isEmpty, rotatedRectBox, textSvg, textBox, arcPath, arcBox, f, classFor } from "./geom.mjs";

// PCB coordinates are converted to mil, Y up. Raw units are 1/10000 mil.
const U = 1 / 10000;
const NONE16 = 0xffff;

const NAMES = { 1: "Top", 32: "Bottom", 33: "TopOverlay", 34: "BottomOverlay", 35: "TopPaste", 36: "BottomPaste", 37: "TopSolder", 38: "BottomSolder", 56: "KeepOut", 74: "MultiLayer" };
const LAYER = Object.fromEntries(Object.entries(NAMES).map(([l, name]) => [name.toUpperCase(), Number(l)]));
const isMid = (l) => l >= 2 && l <= 31, isPlane = (l) => l >= 39 && l <= 54, isMech = (l) => l >= 57 && l <= 72;
const layerName = (l) => NAMES[l] || (isMid(l) ? `Mid${l - 1}` : isPlane(l) ? `Plane${l - 38}` : isMech(l) ? `Mech${l - 56}` : `L${l}`);
const layerFromName = (s = "") => {
  const u = s.toUpperCase();
  if (LAYER[u]) return LAYER[u];
  let m = /^MID(\d+)$/.exec(u); if (m) return 1 + Number(m[1]);
  m = /^PLANE(\d+)$/.exec(u); if (m) return 38 + Number(m[1]);
  m = /^MECHANICAL(\d+)$/.exec(u); if (m) return 56 + Number(m[1]);
  return 0;
};
const COLORS = { 1: "#e03030", 32: "#3060ff", 33: "#e8d020", 34: "#a08a20", 56: "#d040d0", 74: "#b8b8b8", mid: "#30b060", plane: "#40a0a0", mech: "#c060ff" };
const colorOf = (l) => COLORS[l] || (isMid(l) ? COLORS.mid : isPlane(l) ? COLORS.plane : isMech(l) ? COLORS.mech : null);
const ORDER = (l) => (l === 0 ? 0 : l === 32 ? 1 : l === 34 ? 2 : isPlane(l) ? 3 : isMid(l) ? 4 : l === 1 ? 5 : l === 74 ? 6 : l === 33 ? 7 : 8);

function stream(cfb, name) {
  const e = CFB.find(cfb, `/${name}/Data`);
  return e?.content ? Buffer.from(e.content) : Buffer.alloc(0);
}

function propRecords(buf) {
  const out = [];
  for (let o = 0; o + 4 <= buf.length;) {
    const len = buf.readUInt32LE(o);
    out.push(parseProps(buf.toString("latin1", o + 4, o + 4 + len)));
    o += 4 + len;
  }
  return out;
}

function parseProps(text) {
  const props = {};
  for (const part of text.replace(/\0+$/, "").split("|")) {
    const eq = part.indexOf("=");
    if (eq > 0) props[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return props;
}

const mil = (v) => (v === undefined ? 0 : parseFloat(String(v).replace(/mil$/i, "")));

function binaryRecords(buf, type, subrecords = 1) {
  const out = [];
  for (let o = 0; o < buf.length;) {
    if (buf[o] !== type) throw new Error(`unexpected record type ${buf[o]} (wanted ${type}) at ${o}`);
    o += 1;
    const subs = [];
    for (let i = 0; i < subrecords; i++) {
      const len = buf.readUInt32LE(o);
      subs.push(buf.subarray(o + 4, o + 4 + len));
      o += 4 + len;
    }
    out.push(subs);
  }
  return out;
}

const xy = (b, o) => [b.readInt32LE(o) * U, b.readInt32LE(o + 4) * U];
const header = (b) => ({ layer: b[0], net: b.readUInt16LE(3), polygon: b.readUInt16LE(5), component: b.readUInt16LE(7) });

function polygonOutline(props) {
  const pts = [];
  for (let i = 0; props[`VX${i}`] !== undefined; i++) {
    pts.push({ round: Number(props[`KIND${i}`] || 0) !== 0, x: mil(props[`VX${i}`]), y: mil(props[`VY${i}`]), cx: mil(props[`CX${i}`]), cy: mil(props[`CY${i}`]), r: mil(props[`R${i}`]), sa: Number(props[`SA${i}`] || 0), ea: Number(props[`EA${i}`] || 0) });
  }
  return pts;
}

function outlinePath(pts) {
  if (!pts.length) return "";
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 1; i <= pts.length; i++) {
    const prev = pts[i - 1], p = pts[i % pts.length];
    if (prev.round && prev.r > 0) {
      const span = (((prev.ea - prev.sa) % 360) + 360) % 360;
      const pt = (a) => [prev.cx + prev.r * Math.cos((a * Math.PI) / 180), prev.cy + prev.r * Math.sin((a * Math.PI) / 180)];
      const [sx, sy] = pt(prev.sa), [ex, ey] = pt(prev.ea);
      const forward = Math.hypot(sx - prev.x, sy - prev.y) <= Math.hypot(ex - prev.x, ey - prev.y);
      const [ax, ay] = forward ? [sx, sy] : [ex, ey], [bx, by] = forward ? [ex, ey] : [sx, sy];
      d += `L${f(ax)} ${f(ay)}A${f(prev.r)} ${f(prev.r)} 0 ${span > 180 ? 1 : 0} ${forward ? 1 : 0} ${f(bx)} ${f(by)}`;
    }
    if (i < pts.length) d += `L${f(p.x)} ${f(p.y)}`;
  }
  return d + "Z";
}

export function parsePcb(buf) {
  const cfb = CFB.read(buf, { type: "buffer" });
  const prims = [];
  const nets = propRecords(stream(cfb, "Nets6")).map((p) => p.NAME || "");
  const components = propRecords(stream(cfb, "Components6"));
  const designator = (c) => (c === NONE16 ? "" : components[c]?.SOURCEDESIGNATOR || `#${c}`);
  const netName = (n) => (n === NONE16 ? "" : nets[n] ?? `#${n}`);
  const push = (pr) => { if (pr.box && !isEmpty(pr.box)) prims.push(pr); };
  const common = (h, kind) => ({ layer: h.layer, kind, component: designator(h.component), fromPour: h.polygon !== NONE16 });

  for (const [s] of binaryRecords(stream(cfb, "Tracks6"), 4)) {
    const h = header(s), [x1, y1] = xy(s, 13), [x2, y2] = xy(s, 21), w = s.readInt32LE(29) * U;
    const c = colorOf(h.layer);
    push({ ...common(h, "track"), sig: `T|${h.layer}|${netName(h.net)}|${[x1, y1, x2, y2, w].map(f)}`, box: addPoint(addPoint(emptyBox(), x1, y1, w / 2), x2, y2, w / 2), svg: c ? `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${c}" stroke-width="${f(w)}" stroke-linecap="round"/>` : "" });
  }
  for (const [s] of binaryRecords(stream(cfb, "Arcs6"), 1)) {
    const h = header(s), [cx, cy] = xy(s, 13), r = s.readInt32LE(21) * U, a1 = s.readDoubleLE(25), a2 = s.readDoubleLE(33), w = s.readInt32LE(41) * U;
    const c = colorOf(h.layer);
    push({ ...common(h, "arc"), sig: `A|${h.layer}|${netName(h.net)}|${[cx, cy, r, a1, a2, w].map(f)}`, box: arcBox(cx, cy, r, a1, a2, w / 2), svg: c ? `<g fill="none" stroke="${c}" stroke-width="${f(w)}" stroke-linecap="round">${arcPath(cx, cy, r, a1, a2)}</g>` : "" });
  }
  for (const subs of binaryRecords(stream(cfb, "Pads6"), 2, 6)) {
    const name = subs[0].toString("latin1", 1, 1 + subs[0][0]);
    const s = subs[4], h = header(s);
    const [x, y] = xy(s, 13), [w, ht] = xy(s, 21), hole = s.readInt32LE(45) * U, shape = s[49], rot = s.readDoubleLE(52);
    const c = colorOf(h.layer);
    const rx = shape === 1 ? Math.min(w, ht) / 2 : shape === 3 ? Math.min(w, ht) / 4 : 0;
    const shapeSvg = `<rect x="${f(-w / 2)}" y="${f(-ht / 2)}" width="${f(w)}" height="${f(ht)}" rx="${f(rx)}"/>`;
    const holeSvg = hole > 0 ? `<circle r="${f(hole / 2)}" fill="#202020"/>` : "";
    push({ ...common(h, "pad"), sig: `P|${h.layer}|${netName(h.net)}|${designator(h.component)}|${name}|${[x, y, w, ht, hole, rot].map(f)}|${shape}`, box: rotatedRectBox(x, y, w, ht, rot), svg: c ? `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})" fill="${c}">${shapeSvg}${holeSvg}</g>` : "" });
  }
  for (const [s] of binaryRecords(stream(cfb, "Vias6"), 3)) {
    const net = s.readUInt16LE(3), [x, y] = xy(s, 13), d = s.readInt32LE(21) * U, hole = s.readInt32LE(25) * U;
    push({ layer: 74, kind: "via", component: "", fromPour: false, sig: `V|${netName(net)}|${[x, y, d, hole].map(f)}`, box: addPoint(emptyBox(), x, y, d / 2), svg: `<circle cx="${f(x)}" cy="${f(y)}" r="${f(d / 2)}" fill="#c8a040"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(hole / 2)}" fill="#202020"/>` });
  }
  for (const [s] of binaryRecords(stream(cfb, "Fills6"), 6)) {
    const h = header(s), [x1, y1] = xy(s, 13), [x2, y2] = xy(s, 21), rot = s.readDoubleLE(29);
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, w = Math.abs(x2 - x1), ht = Math.abs(y2 - y1), c = colorOf(h.layer);
    push({ ...common(h, "fill"), sig: `F|${h.layer}|${netName(h.net)}|${[x1, y1, x2, y2, rot].map(f)}`, box: rotatedRectBox(cx, cy, w, ht, rot), svg: c ? `<rect transform="translate(${f(cx)} ${f(cy)}) rotate(${f(rot)})" x="${f(-w / 2)}" y="${f(-ht / 2)}" width="${f(w)}" height="${f(ht)}" fill="${c}"/>` : "" });
  }
  for (const [name, extended] of [["Regions6", false], ["ShapeBasedRegions6", true]]) {
    for (const [s] of binaryRecords(stream(cfb, name), 11)) {
      const h = header(s), holes = s.readUInt16LE(14);
      const plen = s.readUInt32LE(18), props = parseProps(s.toString("latin1", 22, 22 + plen));
      let o = 22 + plen;
      const n = s.readUInt32LE(o) + (extended ? 1 : 0); o += 4;
      const pts = [];
      for (let i = 0; i < n; i++) {
        if (extended) { pts.push(xy(s, o + 1)); o += 37; } else { pts.push([s.readDoubleLE(o) * U, s.readDoubleLE(o + 8) * U]); o += 16; }
      }
      const holePts = [];
      for (let k = 0; k < holes; k++) {
        const m = s.readUInt32LE(o); o += 4;
        const hp = [];
        for (let i = 0; i < m; i++) { hp.push([s.readDoubleLE(o) * U, s.readDoubleLE(o + 8) * U]); o += 16; }
        holePts.push(hp);
      }
      const layer = props.V7_LAYER ? layerFromName(props.V7_LAYER) || h.layer : h.layer;
      const kind = Number(props.KIND || 0), cutout = props.ISBOARDCUTOUT === "TRUE";
      const c = cutout ? "#000000" : kind === 0 ? colorOf(layer) : null;
      const box = emptyBox(); pts.forEach(([x, y]) => addPoint(box, x, y));
      const d = [pts, ...holePts].map((ring) => "M" + ring.map(([x, y]) => `${f(x)} ${f(y)}`).join("L") + "Z").join("");
      push({ ...common({ ...h, layer }, "region"), sig: `R|${layer}|${kind}|${netName(h.net)}|${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(";")}|${holes}`, box, svg: c ? `<path d="${d}" fill="${c}" fill-rule="evenodd"/>` : "" });
    }
  }
  const wide = new Map();
  for (const p of propRecords(stream(cfb, "WideStrings6")))
    for (const [k, v] of Object.entries(p)) { const m = /^ENCODEDTEXT(\d+)$/.exec(k); if (m) wide.set(Number(m[1]), String.fromCharCode(...v.split(",").map(Number))); }
  for (const [s, t] of binaryRecords(stream(cfb, "Texts6"), 5, 2)) {
    const layer = s[0], comp = s.readUInt16LE(7), [x, y] = xy(s, 13), height = s.readInt32LE(21) * U, rot = s.readDoubleLE(27), mirror = s[35] !== 0;
    const owner = comp === NONE16 ? null : components[comp];
    // Component comment strings are left out: on this board they pile up into unreadable overlap.
    const nameOn = owner?.NAMEON === undefined || /^T/i.test(owner.NAMEON);
    if (owner && s.length > 41 && (s[40] || (s[41] && !nameOn))) continue;
    if (isMech(layer)) continue;
    const truetype = s.length >= 123 && s[43] === 1, wideIndex = s.length >= 123 ? s.readUInt32LE(115) : -1;
    let text = t.length ? t.toString("latin1", 1, 1 + t[0]) : "";
    if (truetype && wide.has(wideIndex)) text = wide.get(wideIndex);
    if (/^\.designator$/i.test(text)) text = designator(comp);
    const c = colorOf(layer);
    const cls = `silk ${classFor(designator(comp) || "none")}`;
    push({ layer, kind: "text", component: designator(comp), fromPour: false, sig: `X|${layer}|${text}|${[x, y, height, rot].map(f)}|${mirror}`, box: textBox(x, y, text, height * 1.3, rot), svg: c ? textSvg(x, y, text, height * 1.3, rot, c, 0, 0, mirror, cls) : "" });
  }
  for (const p of propRecords(stream(cfb, "Polygons6"))) {
    const pts = polygonOutline(p), layer = layerFromName(p.LAYER);
    if (!pts.length) continue;
    const box = emptyBox(); pts.forEach((v) => addPoint(box, v.x, v.y));
    push({ layer: 200, kind: "polygon outline", component: "", fromPour: false, sig: `G|${p.LAYER}|${p.NET ?? ""}|${pts.map((v) => `${f(v.x)},${f(v.y)}`).join(";")}`, box, svg: `<path d="${outlinePath(pts)}" fill="none" stroke="${colorOf(layer) || "#888"}" stroke-width="2" stroke-dasharray="12 8"/>` });
  }
  components.forEach((p, i) => {
    const des = p.SOURCEDESIGNATOR || `#${i}`, x = mil(p.X), y = mil(p.Y);
    const box = prims.filter((pr) => pr.component === des && pr.kind === "pad").reduce((b, pr) => union(b, pr.box), addPoint(emptyBox(), x, y, 5));
    prims.push({ layer: 201, kind: "component", component: des, fromPour: false, sig: `C|${des}|${p.LAYER}|${f(x)},${f(y)}|${p.ROTATION}|${p.PATTERN}|${p.SOURCELIBREFERENCE}`, box: null, attributedBox: box, svg: "" });
  });
  const board = propRecords(stream(cfb, "Board6"))[0] || {};
  const outline = polygonOutline(board);
  if (outline.length) {
    const box = emptyBox(); outline.forEach((v) => addPoint(box, v.x, v.y));
    prims.push({ layer: 0, kind: "board outline", component: "", fromPour: false, sig: `B|${outline.map((v) => `${f(v.x)},${f(v.y)}`).join(";")}`, box, svg: `<path d="${outlinePath(outline)}" fill="#1c1c1c" stroke="#f0f0f0" stroke-width="5"/>` });
  }
  prims.sort((a, b) => ORDER(a.layer) - ORDER(b.layer));
  for (const pr of prims) pr.label = pr.kind + (pr.component ? ` ${pr.component}` : "") + (pr.layer > 0 && pr.layer < 100 && pr.kind !== "via" ? ` (${layerName(pr.layer)})` : "");
  return { prims, background: "#000000" };
}
