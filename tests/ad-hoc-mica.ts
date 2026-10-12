import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assemblePdf, cmdId, tmpPath, runStandalone } from "./util.ts";
import { launchSumatra, waitForFrame, killAndWait, sendCommandSync, findCanvas } from "./win-automation.ts";
import {
  getSystemBackdrop,
  clientToScreen,
  getWindowRect,
  getClientRect,
  captureWindowToPng,
  captureWindowDCRegionPixels,
  sleep,
} from "./winapi.ts";

async function waitBackdrop(hwnd: number, expected: number) {
  const deadline = Date.now() + 5000;
  do {
    const value = getSystemBackdrop(hwnd);
    if (value === null) {
      console.log("System backdrop API unavailable; checking solid-background fallback.");
      return;
    }
    if (value === expected) return;
    await sleep(100);
  } while (Date.now() < deadline);
  throw new Error(`Expected backdrop ${expected}, got ${getSystemBackdrop(hwnd)}`);
}

function pagePixels(canvas: number): Uint8Array {
  const r = getClientRect(canvas);
  const height = Math.floor(r.bottom * 0.8);
  const p = captureWindowDCRegionPixels(canvas, Math.floor(r.right / 2) - 8, Math.floor(r.bottom * 0.1), 16, height);
  if (!p) throw new Error("Could not capture document pixels");
  const rgb = new Uint8Array((p.length / 4) * 3);
  for (let i = 0, j = 0; i < p.length; i += 4) {
    rgb[j++] = p[i]!;
    rgb[j++] = p[i + 1]!;
    rgb[j++] = p[i + 2]!;
  }
  return rgb;
}

async function settledPage(canvas: number) {
  let previous = pagePixels(canvas);
  const until = Date.now() + 15000;
  do {
    await sleep(200);
    const next = pagePixels(canvas);
    if (new Set(next).size >= 5 && Buffer.from(previous).equals(Buffer.from(next))) return next;
    previous = next;
  } while (Date.now() < until);
  throw new Error("Test PDF did not finish rendering");
}

export async function testit() {
  // Deliberately use the UI background colors INSIDE the PDF as well.
  const shades = [255, 243, 250, 238, 32, 39, 50, 245];
  const stream = shades.map((c, i) => `${c / 255} ${c / 255} ${c / 255} rg 0 ${i * 100} 600 100 re f`).join("\n");
  const pdf = tmpPath("mica-page-colors.pdf");
  writeFileSync(
    pdf,
    assemblePdf([
      "<< /Type /Catalog /Pages 2 0 R /Outlines 5 0 R /PageMode /UseOutlines >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << >> /Contents 4 0 R >>",
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      "<< /Type /Outlines /First 6 0 R /Last 6 0 R /Count 1 >>",
      "<< /Title (Page colors must remain opaque) /Parent 5 0 R /Dest [3 0 R /Fit] >>",
    ]),
  );
  for (const theme of ["Light", "Dark"]) {
    let baseline: Uint8Array | undefined;
    for (const mica of [false, true]) {
      const dir = tmpPath(`mica-${theme}-${mica}`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "SumatraPDF-settings.txt"),
        `Theme = ${theme}\nUseMica = ${mica}\nUseTabs = true\nCheckForUpdates = false\nRestoreSession = false\nShowMenubar = false\nShowToc = true\nDefaultZoom = fit page\nDocumentColorsFollowTheme = false\n`,
      );
      const proc = launchSumatra(["-appdata", dir, "-window-pos", "1100x800@50x50", pdf]);
      try {
        const frame = await waitForFrame(proc.pid!);
        const canvas = frame && findCanvas(frame);
        if (!canvas) throw new Error("Document window did not open");
        await waitBackdrop(frame, mica ? 2 : 1);
        if (clientToScreen(frame, 0, 0).y - getWindowRect(frame).top >= 20) {
          throw new Error("Unexpected extra native title bar");
        }
        const sample = await settledPage(canvas);
        if (baseline && !Buffer.from(baseline).equals(Buffer.from(sample))) {
          throw new Error("Mica changed the PDF page pixels");
        }
        baseline = sample;
        sendCommandSync(frame, cmdId("CmdToggleFullscreen"));
        await waitBackdrop(frame, 1);
        sendCommandSync(frame, cmdId("CmdToggleFullscreen"));
        await waitBackdrop(frame, mica ? 2 : 1);
        const restored = await settledPage(canvas);
        if (!Buffer.from(sample).equals(Buffer.from(restored))) throw new Error("Page changed after fullscreen");
        if (!captureWindowToPng(frame, join(dir, "preview.png"))) throw new Error("Screenshot failed");
        console.log(`PASS: ${theme}, Mica=${mica}, original caption layout, opaque page colors, fullscreen`);
      } finally {
        await killAndWait(proc);
      }
    }
  }
}

if (import.meta.main) await runStandalone(testit);
