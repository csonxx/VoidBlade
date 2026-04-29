#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { firefox } from "playwright";

const url = process.env.QA_URL ?? "http://127.0.0.1:5177/";
const outputDir = resolve(process.cwd(), process.env.QA_OUTPUT_DIR ?? "qa-artifacts");
const screenshotPath = resolve(outputDir, "firefox-smoke.png");

await mkdir(outputDir, { recursive: true });

const browser = await firefox.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

const consoleMessages = [];
const pageErrors = [];
page.on("console", (message) => {
  const type = message.type();
  if (type === "error" || type === "warning") {
    consoleMessages.push(`${type}: ${message.text()}`);
  }
});
page.on("pageerror", (error) => pageErrors.push(error.message));

try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector("#game-canvas", { state: "attached", timeout: 15000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#game-canvas");
    return canvas && canvas.width > 0 && canvas.height > 0;
  }, null, { timeout: 15000 });
  await page.waitForTimeout(1400);
  await assertCanvasHasPixels(page, "start-screen");

  await page.click("#start-button", { timeout: 10000 });
  await page.waitForFunction(() => document.querySelector("#enemy-readout")?.textContent?.trim() !== "0", null, {
    timeout: 12000,
  });
  await page.waitForTimeout(1800);
  await assertCanvasHasPixels(page, "encounter");

  await page.screenshot({ path: screenshotPath, fullPage: false });

  const hud = await page.evaluate(() => ({
    wave: document.querySelector("#wave-readout")?.textContent?.trim(),
    enemies: document.querySelector("#enemy-readout")?.textContent?.trim(),
    status: document.querySelector("#status-strip")?.textContent?.trim(),
    button: document.querySelector("#start-button")?.textContent?.trim(),
  }));

  if (pageErrors.length) throw new Error(`Page errors:\n${pageErrors.join("\n")}`);

  console.log(JSON.stringify({
    ok: true,
    browser: "firefox",
    url,
    screenshot: screenshotPath,
    hud,
    warnings: consoleMessages.slice(0, 8),
  }, null, 2));
} finally {
  await browser.close();
}

async function assertCanvasHasPixels(targetPage, label) {
  const result = await targetPage.evaluate(async () => {
    await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
    const canvas = document.querySelector("#game-canvas");
    if (!canvas) return { ok: false, reason: "missing canvas" };
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return { ok: false, reason: "missing webgl context" };

    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    if (width <= 0 || height <= 0) return { ok: false, reason: "empty drawing buffer", width, height };

    const pixels = new Uint8Array(4 * 80);
    let litSamples = 0;
    for (let i = 0; i < 80; i += 1) {
      const x = Math.floor(width * (0.18 + 0.64 * ((i * 37) % 80) / 79));
      const y = Math.floor(height * (0.18 + 0.64 * ((i * 53) % 80) / 79));
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels, i * 4);
      if (pixels[i * 4] + pixels[i * 4 + 1] + pixels[i * 4 + 2] > 12) litSamples += 1;
    }

    return { ok: litSamples > 12, litSamples, width, height };
  });

  if (!result.ok) {
    throw new Error(`Firefox canvas check failed at ${label}: ${JSON.stringify(result)}`);
  }
}
