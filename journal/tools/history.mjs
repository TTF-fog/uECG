import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";

export const projectDir = path.resolve(import.meta.dirname, "..", "..");
const historyDir = path.join(projectDir, "History");

const NAME = /^(Sheet1|uECG)\.~\((\d+)\)\.(SchDoc|PcbDoc)\.Zip$/;
const ROLLBACK_TOLERANCE_MS = 5000;
const CURRENT = { SchDoc: "Sheet1.SchDoc", PcbDoc: "uECG.PcbDoc" };

// The Windows clock ran exactly 5 h 30 min slow after some boots until w32time corrected
// it (System log, Kernel-General IDs 1/12/13). These archive numbers were saved in those
// windows; Infinity is the working file.
const CLOCK_SLOW_MS = 19800 * 1000;
const SLOW_SAVES = { SchDoc: [[100, 130], [334, 345], [465, 465], [Infinity, Infinity]], PcbDoc: [[15, 23]] };
const isSlow = (kind, n) => SLOW_SAVES[kind].some(([a, b]) => n >= a && n <= b);

function zipEntryTime(buf) {
  // Local file header: DOS time at offset 10, date at 12.
  const t = buf.readUInt16LE(10), d = buf.readUInt16LE(12);
  return new Date(1980 + (d >> 9), ((d >> 5) & 15) - 1, d & 31, t >> 11, (t >> 5) & 63, (t & 31) * 2);
}

// Altium zips the previous file on save, so archive N holds the state written by
// save N-1 and the zip entry time is that save's time. The working file is the newest state.
export function listVersions(kind) {
  const archived = fs.readdirSync(historyDir)
    .map((f) => [f, NAME.exec(f)])
    .filter(([, m]) => m && m[3] === kind)
    .map(([f, m]) => {
      const file = path.join(historyDir, f);
      const head = Buffer.alloc(30);
      const fd = fs.openSync(file, "r");
      fs.readSync(fd, head, 0, 30, 0);
      fs.closeSync(fd);
      return { n: Number(m[2]), label: `v${m[2]}`, file, saved: zipEntryTime(head) };
    })
    .sort((a, b) => a.n - b.n);
  const current = path.join(projectDir, CURRENT[kind]);
  archived.push({ n: Infinity, label: "working file", file: current, saved: fs.statSync(current).mtime });
  const corrected = archived.map((v) => {
    const timeCorrected = isSlow(kind, v.n);
    return { ...v, shown: v.saved, saved: timeCorrected ? new Date(v.saved.getTime() + CLOCK_SLOW_MS) : v.saved, timeCorrected };
  });
  return corrected.map((v, i, all) => ({ ...v, clockRollback: i > 0 && v.saved - all[i - 1].saved < -ROLLBACK_TOLERANCE_MS }));
}

export function readVersion(v) {
  if (!v.file.endsWith(".Zip")) return fs.readFileSync(v.file);
  const files = unzipSync(new Uint8Array(fs.readFileSync(v.file)));
  return Buffer.from(Object.values(files)[0]);
}

// Archive numbers give save order. A work period ends at an idle gap. Within a period,
// blocks split at clock rollbacks and are capped at MAX_BLOCK_MINUTES of saved-time span.
// Every block of a period that contains a rollback is flagged: its times are not
// comparable with the clock used elsewhere.
const IDLE_MINUTES = 45, MAX_BLOCK_MINUTES = 60;
export function workBlocks(versions) {
  const periods = [];
  for (const v of versions) {
    const prev = periods.at(-1)?.at(-1);
    if (!prev || (!v.clockRollback && (v.saved - prev.saved) / 60000 > IDLE_MINUTES)) periods.push([]);
    periods.at(-1).push(v);
  }
  const blocks = [];
  periods.forEach((period, periodIndex) => {
    const timeUncertain = period.some((v) => v.clockRollback);
    let cur = null;
    for (const v of period) {
      if (!cur || v.clockRollback || (v.saved - cur[0].saved) / 60000 > MAX_BLOCK_MINUTES) blocks.push((cur = Object.assign([], { periodIndex, timeUncertain })));
      cur.push(v);
    }
  });
  return blocks;
}
