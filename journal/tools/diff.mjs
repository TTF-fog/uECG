import { union, grow, overlaps } from "./geom.mjs";

// Multiset difference of primitive signatures. Primitives without drawn geometry
// (hidden parameters, implementation links, PCB component records) are placed at
// their owning component's box and reported as property changes.
export function diffPrims(before, after) {
  const count = new Map();
  for (const p of after) if (!p.fromPour) count.set(p.sig, (count.get(p.sig) || 0) + 1);
  const removed = [];
  for (const p of before) {
    if (p.fromPour) continue;
    const c = count.get(p.sig) || 0;
    if (c > 0) count.set(p.sig, c - 1); else removed.push(p);
  }
  const added = [];
  for (let i = after.length - 1; i >= 0; i--) {
    const p = after[i];
    if (p.fromPour) continue;
    const c = count.get(p.sig) || 0;
    if (c > 0) { added.push(p); count.set(p.sig, c - 1); }
  }
  const item = (p, side) => {
    const box = p.box || p.attributedBox;
    return box ? { side, property: !p.box, box, component: p.component || "", label: p.label + (p.component && !p.label.includes(p.component) ? ` ${p.component}` : "") } : null;
  };
  const items = [...removed.map((p) => item(p, "before")), ...added.reverse().map((p) => item(p, "after"))];
  const unplaced = items.filter((x) => !x).length;
  return { items: items.filter(Boolean), removed: removed.length, added: added.length, unplaced };
}

export function cluster(items, margin, maxClusters) {
  let clusters = items.map((it) => ({ box: it.box, items: [it] }));
  for (let m = margin; ; m *= 2) {
    clusters = mergeOverlapping(clusters, m);
    if (clusters.length <= maxClusters) break;
  }
  return clusters.sort((a, b) => b.items.length - a.items.length);
}

function mergeOverlapping(clusters, m) {
  for (;;) {
    const parent = clusters.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const grown = clusters.map((c) => grow(c.box, m / 2));
    const order = clusters.map((_, i) => i).sort((a, b) => grown[a][0] - grown[b][0]);
    for (let oi = 0; oi < order.length; oi++)
      for (let oj = oi + 1; oj < order.length && grown[order[oj]][0] <= grown[order[oi]][2]; oj++)
        if (overlaps(grown[order[oi]], grown[order[oj]])) parent[find(order[oi])] = find(order[oj]);
    const groups = new Map();
    clusters.forEach((c, i) => {
      const r = find(i), g = groups.get(r);
      groups.set(r, g ? { box: union(g.box, c.box), items: g.items.concat(c.items) } : { box: c.box, items: c.items });
    });
    if (groups.size === clusters.length) return clusters;
    clusters = [...groups.values()];
  }
}

// One mark per (side, component, kind of change); loose primitives keep their own box.
export function marksFor(items) {
  const marks = new Map();
  items.forEach((it, i) => {
    const key = it.component ? `${it.side}|${it.property}|${it.component}` : `#${i}`;
    const m = marks.get(key);
    marks.set(key, m ? { ...m, box: union(m.box, it.box) } : { side: it.side, property: it.property, box: it.box });
  });
  return [...marks.values()];
}

export function summarize(items) {
  const tally = new Map();
  for (const it of items) {
    const key = `${it.property ? "~" : it.side === "after" ? "+" : "-"}${it.label}`;
    tally.set(key, (tally.get(key) || 0) + 1);
  }
  const visibleFirst = (k) => (k[0] === "~" ? 1 : 0);
  return [...tally].sort((a, b) => visibleFirst(a[0]) - visibleFirst(b[0]) || b[1] - a[1]).map(([k, n]) => `${k[0]}${n} ${k.slice(1)}`);
}
