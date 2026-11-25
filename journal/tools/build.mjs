import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { listVersions, readVersion, workBlocks, projectDir } from "./history.mjs";
import { parseSch } from "./sch.mjs";
import { parsePcb } from "./pcb.mjs";
import { diffPrims, cluster, summarize } from "./diff.mjs";
import { renderComparison, contextView, RECONSTRUCTION_NOTE } from "./render.mjs";

const outDir = path.join(projectDir, "journal", "images");
fs.mkdirSync(outDir, { recursive: true });
for (const old of fs.readdirSync(outDir)) if (/^(sch|pcb)-b\d+-.*\.png$/.test(old)) fs.rmSync(path.join(outDir, old));

const DOCS = [
  { kind: "SchDoc", name: "Sheet1.SchDoc", prefix: "sch", parse: parseSch, unit: "Altium schematic units (10 mil)", margin: 25, minSize: 220, scaleNote: (w) => `view width ${(w / 100).toFixed(1)} in` },
  { kind: "PcbDoc", name: "uECG.PcbDoc", prefix: "pcb", parse: parsePcb, unit: "mil", margin: 60, minSize: 400, scaleNote: (w) => `view width ${(w * 0.0254).toFixed(1)} mm` },
];
const MAX_REGIONS = 6;

const iso = (d) => {
  const off = -d.getTimezoneOffset(), sign = off >= 0 ? "+" : "-", a = Math.abs(off);
  const local = new Date(d.getTime() + off * 60000).toISOString().slice(0, 19);
  return `${local}${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
};
const short = (d) => d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const tag = (v) => (v.n === Infinity ? "wf" : `v${v.n}`);
const source = (v) => (v ? { label: v.label, file: path.relative(projectDir, v.file).replace(/\\/g, "/"), saved: iso(v.saved), savedAsRecorded: iso(v.shown), timeCorrected: v.timeCorrected } : null);

const manifest = {
  generated: iso(new Date()),
  generator: "journal/tools/build.mjs (read-only parsing of History/*.Zip and the working files; no Altium GUI)",
  imageNature: RECONSTRUCTION_NOTE,
  ordering: "Archive numbers give save order per file. Altium zips the previous file on save, so archive N holds the state written by save N-1; 'savedAsRecorded' is that zip entry's timestamp (file mtime for the working file). 'working file' is the current file on disk, newer than every archive.",
  timeCorrection: {
    rule: "saved = savedAsRecorded + 5 h 30 min for saves made while the Windows clock ran slow after boot (corrected later by w32time, Windows System event log). Elsewhere saved = savedAsRecorded.",
    correctedSaves: { "Sheet1.SchDoc": "v100-v130, v334-v345, v465, working file", "uECG.PcbDoc": "v15-v23" },
    evidence: "Windows System log Kernel-General events 1, 12 and 13 indicate the affected boot and clock-correction intervals. With the correction both archive sequences are chronological.",
  },
  blockRules: "Work periods end at corrected saved-time gaps over 45 min. Blocks within a period span at most 60 min of saved time and would also split at any remaining clock rollback. Each block is compared against the end state of the previous block (its baseline).",
  limitations: [
    "Images are simplified reconstructions, not Altium screenshots or exports: fonts, power-port symbols, pin decorations (dot/clock), pad corner shapes and PCB stroke text are approximated, and the sheet border/title block is not drawn.",
    "Corrected times depend on the event-log analysis. Order within each file always follows archive numbers.",
    "Changes are geometric/property differences between the block's baseline and end states. Edits made and undone inside a block are invisible.",
    "Poured polygon copper (primitives owned by a polygon) is drawn but excluded from the diff, so a repour alone is not reported. Polygon outline edits are reported.",
    "Non-graphical changes (hidden parameters, model links, PCB component properties) are placed on their owning component's box and marked 'property only'. Sheet-level settings changes with no owner are counted in unplacedChanges without a region.",
    "PCB component comment strings are not drawn or compared, to keep labels readable. Comment changes appear only if the component record itself changed.",
    "PCB solder mask, paste, and other non-copper/non-overlay layers are compared but not drawn, so a highlighted box on those layers may show no visible geometry.",
    "Net identity uses net names, so a net rename marks every primitive on that net as changed.",
    "Regions are capped at 6 per block; when changes are spread out, nearby regions are merged and the crop widens.",
    "The first block of each document has no baseline; all its content is shown as added.",
  ],
  documents: [],
};

for (const doc of DOCS) {
  const versions = listVersions(doc.kind);
  const blocks = workBlocks(versions);
  const docEntry = { document: doc.name, units: doc.unit, versions: versions.length, clockRollbacks: versions.filter((v) => v.clockRollback).map((v) => ({ at: v.label, saved: iso(v.saved) })), blocks: [] };
  manifest.documents.push(docEntry);

  let baseline = null, baselineState = null;
  blocks.forEach((block, bi) => {
    const first = block[0], last = block.at(-1);
    const id = `${doc.prefix}-b${String(bi + 1).padStart(2, "0")}-${tag(first)}-${tag(last)}`;
    const buf = readVersion(last);
    const end = { hash: crypto.createHash("sha1").update(buf).digest("hex"), doc: doc.parse(buf) };
    const entry = {
      id, block: bi + 1, workPeriod: block.periodIndex + 1,
      versions: { first: first.label, last: last.label, count: block.length, archiveNumbers: block.filter((v) => v.n !== Infinity).map((v) => v.n) },
      baseline: source(baseline), end: source(last),
      savedStart: iso(first.saved), savedEnd: iso(last.saved),
      savedStartAsRecorded: iso(first.shown), savedEndAsRecorded: iso(last.shown),
      timeCorrected: block.some((v) => v.timeCorrected),
      timeUncertain: block.timeUncertain,
      regions: [],
    };
    if (baselineState && baselineState.hash === end.hash) {
      entry.status = "unchanged";
      entry.note = "End state is byte-identical to the baseline.";
    } else {
      const d = diffPrims(baselineState?.doc.prims || [], end.doc.prims);
      Object.assign(entry, { status: d.items.length ? "changed" : "no-geometric-change", added: d.added, removed: d.removed, unplacedChanges: d.unplaced });
      if (!d.items.length) entry.note = "File bytes differ but no compared primitive changed (e.g. view state, pour refill, or sheet-level settings).";
      const clusters = cluster(d.items, doc.margin, MAX_REGIONS);
      const timeText = `${short(first.saved)} - ${short(last.saved)}${entry.timeCorrected ? " (corrected +5:30 for slow system clock)" : ""}${block.timeUncertain ? " (clock rollback: times uncertain)" : ""}`;
      clusters.forEach((c, ri) => {
        const file = `${id}-r${ri + 1}.png`;
        const summary = summarize(c.items);
        const view = contextView(c.box, doc.minSize);
        const png = renderComparison({
          before: baselineState?.doc, after: end.doc, view, cluster: c, scaleNote: doc.scaleNote,
          headerLines: [
            `${doc.name}  block ${bi + 1}/${blocks.length}  region ${ri + 1}/${clusters.length}  ${first.label} .. ${last.label} (${block.length} saves)`,
            `Baseline: ${baseline ? baseline.label : "none (first block)"}   End: ${last.label}   Saved: ${timeText}`,
            `Changes here: ${summary.slice(0, 6).join(", ")}${summary.length > 6 ? `, +${summary.length - 6} more kinds` : ""}`,
          ],
          beforeTitle: baseline ? `Before: ${baseline.label} (${short(baseline.saved)})` : "Before: nothing (first block)",
          afterTitle: `After: ${last.label} (${short(last.saved)})`,
        });
        fs.writeFileSync(path.join(outDir, file), png);
        entry.regions.push({ image: `journal/images/${file}`, box: c.box.map((n) => Math.round(n * 10) / 10), view: view.map((n) => Math.round(n * 10) / 10), changedItems: c.items.length, summary });
      });
    }
    console.log(`${id}: ${entry.status} ${entry.regions.length} region(s)`);
    docEntry.blocks.push(entry);
    baseline = last;
    baselineState = end;
  });
}

fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
