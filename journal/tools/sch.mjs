import CFB from "cfb";
import { emptyBox, addPoint, union, isEmpty, textSvg, textBox, arcPath, arcBox, f } from "./geom.mjs";

// Schematic coordinates are in Altium's 10 mil units, Y up.
// Ignored keys are per-save bookkeeping: IDs, record indices, and cached model data-file entries.
const IGNORED_KEYS = new Set(["UNIQUEID", "INDEXINSHEET", "OWNERINDEX", "DATAFILECOUNT"]);
const IGNORED_KEY_PATTERN = /^MODELDATAFILE(ENTITY|KIND)\d+$/;
const LINE_WIDTH = [0.4, 1, 2, 3.5];

function readRecords(buf) {
  const cfb = CFB.read(buf, { type: "buffer" });
  const data = Buffer.from(CFB.find(cfb, "FileHeader").content);
  const records = [];
  for (let o = 0; o < data.length;) {
    const len = data.readUInt32LE(o) & 0xffffff;
    const text = data.toString("latin1", o + 4, o + 4 + len).replace(/\0+$/, "");
    o += 4 + len;
    const props = {};
    for (const part of text.split("|")) {
      const eq = part.indexOf("=");
      if (eq > 0) props[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
    }
    records.push(props);
  }
  return records.slice(1);
}

const num = (p, k, d = 0) => (p[k] === undefined ? d : Number(p[k])) + (p[k + "_FRAC"] ? Number(p[k + "_FRAC"]) / 100000 : 0);
const has = (p, k) => p[k] !== undefined || p[k + "_FRAC"] !== undefined;
const bool = (p, k) => p[k] === "T";
const color = (p, k = "COLOR", d = 0) => {
  const c = p[k] === undefined ? d : Number(p[k]);
  return `rgb(${c & 255},${(c >> 8) & 255},${(c >> 16) & 255})`;
};

// Fonts are compared by definition because Altium renumbers the sheet font table on save.
function signature(p, fonts) {
  return Object.keys(p)
    .filter((k) => !IGNORED_KEYS.has(k) && !IGNORED_KEY_PATTERN.test(k))
    .sort()
    .map((k) => (k.endsWith("FONTID") ? `${k}:FONT=${fonts[Number(p[k])]?.spec ?? p[k]}` : `${k}=${p[k]}`))
    .join("|");
}

function points(p) {
  const n = Number(p.LOCATIONCOUNT || 0), pts = [];
  for (let i = 1; i <= n; i++) pts.push([num(p, `X${i}`), num(p, `Y${i}`)]);
  return pts;
}

function wrap(text, maxChars) {
  const lines = [];
  for (const para of text.split(/~1/)) {
    let line = "";
    for (const word of para.split(" ")) {
      if (line && (line + " " + word).length > maxChars) { lines.push(line); line = word; } else line = line ? `${line} ${word}` : word;
    }
    lines.push(line);
  }
  return lines;
}

function drawRecord(p, fonts, resolve) {
  const rec = Number(p.RECORD);
  const x = num(p, "LOCATION.X"), y = num(p, "LOCATION.Y");
  const lw = LINE_WIDTH[Number(p.LINEWIDTH || 0)] ?? 1;
  const stroke = color(p);
  const font = fonts[Number(p.FONTID || 1)] || fonts[1];
  const deg = Number(p.ORIENTATION || 0) * 90;
  const b = emptyBox();
  const text = (tx, ty, s, d = deg, h = 0, v = 0, c = stroke) => {
    const size = font.size * 0.9;
    const box = textBox(tx, ty, s, size, d, h, v);
    addPoint(b, box[0], box[1]); addPoint(b, box[2], box[3]);
    return textSvg(tx, ty, s, size, d, c, h, v);
  };
  const just = (j) => [Number(j || 0) % 3, Math.floor(Number(j || 0) / 3)];
  switch (rec) {
    case 27: case 6: case 26: case 7: { // wire, polyline, bus, polygon
      const pts = points(p);
      pts.forEach(([px, py]) => addPoint(b, px, py, lw));
      const d = pts.map(([px, py]) => `${f(px)},${f(py)}`).join(" ");
      const width = rec === 26 ? 3 : rec === 27 ? Math.max(lw, 1) : lw;
      if (rec === 7) return { box: b, svg: `<polygon points="${d}" fill="${bool(p, "ISSOLID") ? color(p, "AREACOLOR") : "none"}" stroke="${stroke}" stroke-width="${width}"/>` };
      return { box: b, svg: `<polyline points="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>` };
    }
    case 13: { // line
      const cx = num(p, "CORNER.X"), cy = num(p, "CORNER.Y");
      addPoint(b, x, y, lw); addPoint(b, cx, cy, lw);
      return { box: b, svg: `<line x1="${f(x)}" y1="${f(y)}" x2="${f(cx)}" y2="${f(cy)}" stroke="${stroke}" stroke-width="${lw}"/>` };
    }
    case 14: case 10: case 28: case 209: case 30: { // rectangle, round rect, text frame, note, image
      const cx = num(p, "CORNER.X"), cy = num(p, "CORNER.Y");
      addPoint(b, x, y, lw); addPoint(b, cx, cy, lw);
      const solid = rec !== 30 && (bool(p, "ISSOLID") || rec === 209);
      const r = rec === 10 ? `rx="${f(num(p, "CORNERXRADIUS"))}"` : "";
      let svg = `<rect x="${f(Math.min(x, cx))}" y="${f(Math.min(y, cy))}" width="${f(Math.abs(cx - x))}" height="${f(Math.abs(cy - y))}" ${r} fill="${solid ? color(p, "AREACOLOR") : "none"}" stroke="${stroke}" stroke-width="${lw}"${rec === 30 ? ' stroke-dasharray="4 3"' : ""}/>`;
      if (rec === 28 || rec === 209) {
        const size = font.size * 0.9, body = (p.TEXT || "").replace(/^@\{[^}]*\}\s*/, "");
        const lines = wrap(body, Math.max(4, Math.floor(Math.abs(cx - x) / (0.55 * size)))).slice(0, Math.max(1, Math.floor(Math.abs(cy - y) / (size * 1.15)) - 1));
        lines.forEach((ln, i) => { svg += textSvg(Math.min(x, cx) + 2, Math.max(y, cy) - 2 - (i + 1) * size * 1.15, ln, size, 0, color(p, "TEXTCOLOR")); });
      }
      return { box: b, svg };
    }
    case 12: case 11: { // arc, elliptical arc
      const r = num(p, "RADIUS"), a1 = num(p, "STARTANGLE"), a2 = num(p, "ENDANGLE", 360);
      const box = arcBox(x, y, r, a1, a2, lw);
      return { box, svg: `<g fill="none" stroke="${stroke}" stroke-width="${lw}">${arcPath(x, y, r, a1, a2)}</g>` };
    }
    case 8: { // ellipse
      const rx = num(p, "RADIUS"), ry = has(p, "SECONDARYRADIUS") ? num(p, "SECONDARYRADIUS") : rx;
      addPoint(b, x - rx, y - ry); addPoint(b, x + rx, y + ry);
      return { box: b, svg: `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${bool(p, "ISSOLID") ? color(p, "AREACOLOR") : "none"}" stroke="${stroke}" stroke-width="${lw}"/>` };
    }
    case 29: // junction
      addPoint(b, x, y, 2);
      return { box: b, svg: `<circle cx="${f(x)}" cy="${f(y)}" r="2" fill="${stroke}"/>` };
    case 22: // no ERC
      addPoint(b, x, y, 3);
      return { box: b, svg: `<path d="M${x - 3} ${y - 3}L${x + 3} ${y + 3}M${x - 3} ${y + 3}L${x + 3} ${y - 3}" stroke="${color(p, "COLOR", 255)}" stroke-width="1"/>` };
    case 2: { // pin
      const cong = Number(p.PINCONGLOMERATE || 0);
      if (cong & 0x04) return null;
      const dir = (cong & 3) * 90, len = num(p, "PINLENGTH");
      const dx = Math.round(Math.cos((dir * Math.PI) / 180)), dy = Math.round(Math.sin((dir * Math.PI) / 180));
      addPoint(b, x, y, 1); addPoint(b, x + dx * len, y + dy * len, 1);
      let svg = `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x + dx * len)}" y2="${f(y + dy * len)}" stroke="${stroke}" stroke-width="1"/>`;
      const vertical = dx === 0, tdeg = vertical ? 90 : 0;
      const away = vertical ? (dy > 0 ? 0 : 2) : (dx > 0 ? 0 : 2);
      if (cong & 0x08 && p.NAME) svg += text(x - dx * 3, y - dy * 3, p.NAME.replace(/\\/g, ""), tdeg, 2 - away, 1, "rgb(0,0,0)");
      if (cong & 0x10 && p.DESIGNATOR) svg += text(x + dx * len / 2, y + dy * len / 2 + (vertical ? 0 : 1), p.DESIGNATOR, tdeg, 1, vertical ? 2 : 0, "rgb(0,0,0)");
      return { box: b, svg };
    }
    case 4: case 34: case 41: { // label, designator, parameter
      if (bool(p, "ISHIDDEN") || !p.TEXT) return null;
      const [h, v] = just(p.JUSTIFICATION);
      return { box: b, svg: text(x, y, resolve(p), deg, h, v) };
    }
    case 25: // net label
      return { box: b, svg: text(x, y, p.TEXT || "", deg, 0, 0) };
    case 43: { // parameter set directive, e.g. DIFFPAIR
      addPoint(b, x, y, 2);
      return { box: b, svg: `<circle cx="${f(x)}" cy="${f(y)}" r="1.5" fill="${stroke}"/>` + text(x + 3, y + 2, p.NAME || "directive", 0, 0, 0) };
    }
    case 17: { // power port, drawn as a simplified stem and bar
      const d = deg, ux = Math.round(Math.cos((d * Math.PI) / 180)), uy = Math.round(Math.sin((d * Math.PI) / 180));
      const ex = x + ux * 10, ey = y + uy * 10, px = -uy, py = ux;
      const style = Number(p.STYLE || 0);
      let svg = `<line x1="${f(x)}" y1="${f(y)}" x2="${f(ex)}" y2="${f(ey)}" stroke="${stroke}" stroke-width="1"/>`;
      const bars = style >= 4 && style <= 6 ? [[10, 0], [7, 2.5], [4, 5], [1, 7.5]] : [[10, 0]];
      for (const [w, o] of bars) svg += `<line x1="${f(ex + px * w / 2 + ux * o)}" y1="${f(ey + py * w / 2 + uy * o)}" x2="${f(ex - px * w / 2 + ux * o)}" y2="${f(ey - py * w / 2 + uy * o)}" stroke="${stroke}" stroke-width="1"/>`;
      addPoint(b, x, y, 5); addPoint(b, ex + ux * 8, ey + uy * 8, 5);
      if (bool(p, "SHOWNETNAME")) svg += text(ex + ux * (bars.length > 1 ? 11 : 3), ey + uy * (bars.length > 1 ? 11 : 3), p.TEXT || "", 0, uy === 0 ? (ux > 0 ? 0 : 2) : 1, uy === 0 ? 1 : uy > 0 ? 0 : 2);
      return { box: b, svg };
    }
    case 18: { // port
      const w = num(p, "WIDTH"), h = num(p, "HEIGHT", 10);
      addPoint(b, x, y - h / 2); addPoint(b, x + w, y + h / 2);
      return { box: b, svg: `<rect x="${f(x)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" fill="${color(p, "AREACOLOR", 0xc0ffff)}" stroke="${stroke}" stroke-width="0.6"/>` + text(x + w / 2, y, p.NAME || "", 0, 1, 1, color(p, "TEXTCOLOR")) };
    }
    default:
      return null;
  }
}

export function parseSch(buf) {
  const records = readRecords(buf);
  const sheet = records.find((r) => r.RECORD === "31") || {};
  const fonts = {};
  for (let i = 1; i <= Number(sheet.FONTIDCOUNT || 0); i++) {
    const spec = ["SIZE", "FONTNAME", "ROTATION", "BOLD", "ITALIC", "UNDERLINE", "STRIKEOUT"].map((k) => sheet[`${k}${i}`] ?? "").join(",");
    fonts[i] = { size: Number(sheet[`SIZE${i}`] || 10), spec };
  }
  if (!fonts[1]) fonts[1] = { size: 10 };

  const paramsByOwner = new Map();
  for (const r of records) if (r.RECORD === "41" && r.OWNERINDEX !== undefined) {
    if (!paramsByOwner.has(r.OWNERINDEX)) paramsByOwner.set(r.OWNERINDEX, new Map());
    paramsByOwner.get(r.OWNERINDEX).set((r.NAME || "").toUpperCase(), r.TEXT);
  }
  const resolve = (p) => (p.TEXT.startsWith("=") ? paramsByOwner.get(p.OWNERINDEX)?.get(p.TEXT.slice(1).toUpperCase()) ?? p.TEXT : p.TEXT);

  const ancestorComponent = (i) => {
    for (let seen = 0, j = i; j !== undefined && seen < 10; seen++) {
      const r = records[j];
      if (!r) return undefined;
      if (r.RECORD === "1" && j !== i) return j;
      j = r.OWNERINDEX === undefined ? undefined : Number(r.OWNERINDEX);
    }
    return undefined;
  };

  const prims = records.map((p, i) => {
    const comp = ancestorComponent(i);
    const c = comp !== undefined ? records[comp] : null;
    let shown = true;
    if (c) {
      const part = Number(p.OWNERPARTID ?? -1);
      shown = (part === -1 || part === Number(c.CURRENTPARTID || 1)) && Number(p.OWNERPARTDISPLAYMODE || 0) === Number(c.DISPLAYMODE || 0);
    }
    const drawn = shown ? drawRecord(p, fonts, resolve) : null;
    return {
      sig: p.RECORD === "31" ? `SHEET|${signature(Object.fromEntries(Object.entries(p).filter(([k]) => !/^(FONTIDCOUNT|SIZE|FONTNAME|ROTATION|BOLD|ITALIC|UNDERLINE|STRIKEOUT)\d*$/.test(k))), fonts)}` : signature(p, fonts),
      owner: comp ?? (p.RECORD === "1" ? i : undefined),
      box: drawn && !isEmpty(drawn.box) ? drawn.box : null,
      svg: drawn?.svg ?? "",
      label: describe(p),
    };
  });

  const ownerBox = new Map();
  prims.forEach((pr) => { if (pr.owner !== undefined && pr.box) ownerBox.set(pr.owner, union(ownerBox.get(pr.owner) || emptyBox(), pr.box)); });
  for (const pr of prims) if (!pr.box && pr.owner !== undefined) pr.attributedBox = ownerBox.get(pr.owner) || null;

  const designatorOf = (i) => records.find((r) => r.RECORD === "34" && Number(r.OWNERINDEX) === i)?.TEXT;
  for (const pr of prims) if (pr.owner !== undefined) pr.component = designatorOf(pr.owner);

  return { prims, background: "#ffffff" };
}

const RECORD_NAMES = { 1: "component", 2: "pin", 4: "label", 6: "polyline", 7: "polygon", 8: "ellipse", 10: "round rect", 11: "elliptical arc", 12: "arc", 13: "line", 14: "rectangle", 17: "power port", 18: "port", 22: "no-ERC", 25: "net label", 26: "bus", 27: "wire", 28: "text frame", 29: "junction", 30: "image", 31: "sheet", 34: "designator", 41: "parameter", 44: "implementation list", 45: "implementation", 46: "map definer list", 47: "map definer", 48: "impl. parameters", 209: "note" };
function describe(p) {
  const name = RECORD_NAMES[p.RECORD] || `record ${p.RECORD}`;
  return p.RECORD === "41" && p.NAME ? `${name} ${p.NAME}` : name;
}
