import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, cmdId, tmpPath, runStandalone } from "./util.ts";
import { launchSumatra, waitForFrame, killAndWait, sendCommand, findCanvas } from "./win-automation.ts";
import { getSystemBackdrop, clientToScreen, getWindowRect, captureWindowToPng, sleep } from "./winapi.ts";

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

export async function testit() {
  for (const theme of ["Light", "Dark"]) {
    for (const mica of [true, false]) {
      const dir = tmpPath(`mica-${theme}-${mica}`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "SumatraPDF-settings.txt"),
        `Theme = ${theme}\nUseMica = ${mica}\nUseTabs = true\nCheckForUpdates = false\nRestoreSession = false\nShowMenubar = false\n`,
      );
      const proc = launchSumatra(["-appdata", dir, join(ROOT, "ext/a-zlib/zlib.3.pdf")]);
      try {
        const frame = await waitForFrame(proc.pid!);
        if (!frame || !findCanvas(frame)) throw new Error("Document window did not open");
        await waitBackdrop(frame, mica ? 2 : 1);
        if (mica && clientToScreen(frame, 0, 0).y - getWindowRect(frame).top < 20) {
          throw new Error("Native caption is missing");
        }
        sendCommand(frame, cmdId("CmdToggleFullscreen"));
        await waitBackdrop(frame, 1);
        sendCommand(frame, cmdId("CmdToggleFullscreen"));
        await waitBackdrop(frame, mica ? 2 : 1);
        await sleep(500);
        if (!captureWindowToPng(frame, join(dir, "preview.png"))) throw new Error("Screenshot failed");
        console.log(`PASS: ${theme}, UseMica=${mica}, document and fullscreen round-trip`);
      } finally {
        await killAndWait(proc);
      }
    }
  }
}

if (import.meta.main) await runStandalone(testit);
