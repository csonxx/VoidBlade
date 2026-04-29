#!/usr/bin/env node
import { cp, copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const publicCharacterDir = resolve(repoRoot, "public/characters");
const promptFile = resolve(__dirname, "real-character-prompts.json");

const slotAliases = new Map([
  ["hero", "hero"],
  ["player", "hero"],
  ["enemy1", "enemy-01"],
  ["enemy-1", "enemy-01"],
  ["enemy-01", "enemy-01"],
  ["red", "enemy-01"],
  ["enemy2", "enemy-02"],
  ["enemy-2", "enemy-02"],
  ["enemy-02", "enemy-02"],
  ["purple", "enemy-02"],
  ["enemy3", "enemy-03"],
  ["enemy-3", "enemy-03"],
  ["enemy-03", "enemy-03"],
  ["boss", "enemy-03"],
]);

const requiredClips = [
  "Idle",
  "Walk",
  "Run",
  "Jump",
  "Attack_Light",
  "Attack_Heavy",
  "Skill_1",
  "Skill_2",
  "Skill_3",
  "Hit",
  "Death",
];

const command = process.argv[2];
const args = process.argv.slice(3);

if (!command || command === "help" || command === "--help") {
  printUsage();
  process.exit(command ? 0 : 1);
}

await mkdir(publicCharacterDir, { recursive: true });

try {
  if (command === "report") {
    await reportCommand(args);
  } else if (command === "install") {
    await installCommand(args);
  } else if (command === "fetch-url") {
    await fetchUrlCommand(args);
  } else if (command === "fetch-rpm") {
    await fetchReadyPlayerMeCommand(args);
  } else if (command === "sketchfab") {
    await sketchfabCommand(args);
  } else if (command === "meshy") {
    await meshyCommand(args);
  } else if (command === "prompts") {
    await promptsCommand();
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(`\n${error.message}`);
  process.exit(1);
}

function printUsage() {
  console.log(`Real character asset pipeline

Usage:
  node scripts/real-character-assets.mjs report <file.glb|scene.gltf> [...]
  node scripts/real-character-assets.mjs install <slot> <file.glb|gltf-folder>
  node scripts/real-character-assets.mjs fetch-url <slot> <direct-glb-url>
  node scripts/real-character-assets.mjs fetch-rpm <slot> <avatar-id|models.readyplayer.me-url>
  SKETCHFAB_TOKEN=... node scripts/real-character-assets.mjs sketchfab <slot> <model-uid>
  MESHY_API_KEY=... node scripts/real-character-assets.mjs meshy <slot> "<prompt>"
  node scripts/real-character-assets.mjs prompts

Slots:
  hero, enemy-01, enemy-02, enemy-03
`);
}

function normalizeSlot(slot) {
  const normalized = slotAliases.get(`${slot ?? ""}`.toLowerCase());
  if (!normalized) throw new Error(`Invalid slot "${slot}". Use hero, enemy-01, enemy-02, or enemy-03.`);
  return normalized;
}

async function reportCommand(files) {
  if (!files.length) throw new Error("report needs at least one GLB or glTF file.");
  for (const file of files) {
    const report = await inspectAsset(resolve(file));
    console.log(JSON.stringify(report, null, 2));
  }
}

async function installCommand([slotArg, sourceArg]) {
  if (!slotArg || !sourceArg) throw new Error("install needs <slot> <file.glb|gltf-folder>.");
  const slot = normalizeSlot(slotArg);
  const source = resolve(sourceArg);
  const sourceStat = await stat(source);

  if (sourceStat.isDirectory()) {
    const targetDir = join(publicCharacterDir, slot);
    await rm(targetDir, { recursive: true, force: true });
    await cp(source, targetDir, { recursive: true });
    const sceneFile = join(targetDir, "scene.gltf");
    const report = await inspectAsset(sceneFile);
    await writeSourceMetadata(slot, {
      provider: "manual-gltf-folder",
      source,
      runtimeUrl: `/characters/${slot}/scene.gltf`,
      report,
    });
    console.log(`Installed ${slot}: /characters/${slot}/scene.gltf`);
    console.log(formatReportSummary(report));
    return;
  }

  if (extname(source).toLowerCase() !== ".glb") {
    throw new Error("install currently expects a .glb file or a folder containing scene.gltf.");
  }

  const target = join(publicCharacterDir, `${slot}.glb`);
  await copyFile(source, target);
  const report = await inspectAsset(target);
  await writeSourceMetadata(slot, {
    provider: "manual-glb",
    source,
    runtimeUrl: `/characters/${slot}.glb`,
    report,
  });
  console.log(`Installed ${slot}: /characters/${slot}.glb`);
  console.log(formatReportSummary(report));
}

async function fetchUrlCommand([slotArg, url]) {
  if (!slotArg || !url) throw new Error("fetch-url needs <slot> <direct-glb-url>.");
  const slot = normalizeSlot(slotArg);
  const target = join(publicCharacterDir, `${slot}.glb`);
  await downloadToFile(url, target);
  const report = await inspectAsset(target);
  await writeSourceMetadata(slot, {
    provider: "direct-url",
    source: url,
    runtimeUrl: `/characters/${slot}.glb`,
    report,
  });
  console.log(`Fetched ${slot}: /characters/${slot}.glb`);
  console.log(formatReportSummary(report));
}

async function fetchReadyPlayerMeCommand([slotArg, avatar]) {
  if (!slotArg || !avatar) throw new Error("fetch-rpm needs <slot> <avatar-id|models.readyplayer.me-url>.");
  const slot = normalizeSlot(slotArg);
  const url = avatar.startsWith("http")
    ? avatar
    : `https://models.readyplayer.me/${avatar}.glb?quality=high&textureSizeLimit=2048`;
  const target = join(publicCharacterDir, `${slot}.glb`);
  await downloadToFile(url, target);
  const report = await inspectAsset(target);
  await writeSourceMetadata(slot, {
    provider: "ready-player-me",
    source: url,
    runtimeUrl: `/characters/${slot}.glb`,
    note: "RPM avatars usually need separately retargeted Mixamo combat clips for full action coverage.",
    report,
  });
  console.log(`Fetched Ready Player Me ${slot}: /characters/${slot}.glb`);
  console.log(formatReportSummary(report));
}

async function sketchfabCommand([slotArg, modelUid]) {
  if (!slotArg || !modelUid) throw new Error("sketchfab needs <slot> <model-uid>.");
  const token = process.env.SKETCHFAB_TOKEN;
  if (!token) throw new Error("SKETCHFAB_TOKEN is required for Sketchfab downloads.");

  const slot = normalizeSlot(slotArg);
  const response = await fetch(`https://api.sketchfab.com/v3/models/${modelUid}/download`, {
    headers: { Authorization: `Token ${token}` },
  });
  if (!response.ok) throw new Error(`Sketchfab download lookup failed: HTTP ${response.status} ${await response.text()}`);
  const payload = await response.json();
  const gltfUrl = payload.gltf?.url;
  if (!gltfUrl) throw new Error("Sketchfab response did not include a glTF download URL.");

  const tmpZip = resolve(tmpdir(), `voidblade-sketchfab-${slot}-${Date.now()}.zip`);
  const targetDir = join(publicCharacterDir, slot);
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });
  await downloadToFile(gltfUrl, tmpZip);
  await run("unzip", ["-q", tmpZip, "-d", targetDir]);

  const sceneFile = await findFirstFile(targetDir, "scene.gltf") ?? await findFirstFile(targetDir, ".gltf");
  if (!sceneFile) throw new Error("Downloaded Sketchfab archive did not contain a glTF scene file.");
  if (basename(sceneFile) !== "scene.gltf") {
    throw new Error(`Found ${sceneFile}, but runtime expects scene.gltf. Rename/copy the folder manually so references stay valid.`);
  }

  const report = await inspectAsset(sceneFile);
  await writeSourceMetadata(slot, {
    provider: "sketchfab",
    source: `https://sketchfab.com/3d-models/${modelUid}`,
    runtimeUrl: `/characters/${slot}/scene.gltf`,
    licenseReminder: "Verify the model license and attribution before shipping.",
    report,
  });
  console.log(`Installed Sketchfab ${slot}: /characters/${slot}/scene.gltf`);
  console.log(formatReportSummary(report));
}

async function meshyCommand([slotArg, ...promptParts]) {
  if (!slotArg || !promptParts.length) throw new Error("meshy needs <slot> \"<prompt>\".");
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) throw new Error("MESHY_API_KEY is required for Meshy generation.");

  const slot = normalizeSlot(slotArg);
  const prompt = promptParts.join(" ");
  const negativePrompt = "low poly, blocky toy, chibi, cartoon, robot, faceless, bad anatomy, extra limbs, text, watermark, celebrity likeness";
  const createResponse = await fetch("https://api.meshy.ai/openapi/v2/text-to-3d", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "preview",
      prompt,
      negative_prompt: negativePrompt,
      art_style: "realistic",
      topology: "quad",
      target_polycount: 30000,
      should_remesh: true,
      symmetry_mode: "auto",
    }),
  });
  if (!createResponse.ok) throw new Error(`Meshy task creation failed: HTTP ${createResponse.status} ${await createResponse.text()}`);
  const createPayload = await createResponse.json();
  const taskId = createPayload.result || createPayload.id;
  if (!taskId) throw new Error(`Meshy response did not include a task id: ${JSON.stringify(createPayload)}`);

  console.log(`Meshy task created: ${taskId}`);
  const task = await pollMeshyTask(apiKey, taskId);
  const modelUrl = task.model_urls?.glb || task.model_url || task.model_urls?.obj;
  if (!modelUrl || !`${modelUrl}`.toLowerCase().includes(".glb")) {
    throw new Error(`Meshy task finished but did not expose a GLB URL: ${JSON.stringify(task.model_urls ?? task)}`);
  }

  const target = join(publicCharacterDir, `${slot}.glb`);
  await downloadToFile(modelUrl, target);
  const report = await inspectAsset(target);
  await writeSourceMetadata(slot, {
    provider: "meshy",
    source: taskId,
    prompt,
    runtimeUrl: `/characters/${slot}.glb`,
    note: "Run report and retarget Mixamo clips if Meshy returns no embedded combat animations.",
    report,
  });
  console.log(`Installed Meshy ${slot}: /characters/${slot}.glb`);
  console.log(formatReportSummary(report));
}

async function promptsCommand() {
  console.log(await readFile(promptFile, "utf8"));
}

async function pollMeshyTask(apiKey, taskId) {
  const terminalSuccess = new Set(["SUCCEEDED", "SUCCESS", "COMPLETED"]);
  const terminalFailure = new Set(["FAILED", "ERROR", "CANCELED", "CANCELLED"]);

  for (let attempt = 0; attempt < 90; attempt += 1) {
    await sleep(attempt < 6 ? 5000 : 10000);
    const response = await fetch(`https://api.meshy.ai/openapi/v2/text-to-3d/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) throw new Error(`Meshy task polling failed: HTTP ${response.status} ${await response.text()}`);
    const payload = await response.json();
    const status = `${payload.status ?? ""}`.toUpperCase();
    console.log(`Meshy status: ${status || "UNKNOWN"} ${payload.progress ? `${payload.progress}%` : ""}`);
    if (terminalSuccess.has(status)) return payload;
    if (terminalFailure.has(status)) throw new Error(`Meshy task failed: ${JSON.stringify(payload)}`);
  }
  throw new Error("Meshy task timed out.");
}

async function downloadToFile(url, target) {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Download failed: HTTP ${response.status} ${url}`);
  await mkdir(dirname(target), { recursive: true });
  await pipeline(response.body, createWriteStream(target));
}

async function writeSourceMetadata(slot, metadata) {
  await writeFile(join(publicCharacterDir, `${slot}.source.json`), JSON.stringify({
    slot,
    installedAt: new Date().toISOString(),
    ...metadata,
  }, null, 2));
}

async function inspectAsset(file) {
  if (extname(file).toLowerCase() === ".glb") return inspectGlb(file);
  if (extname(file).toLowerCase() === ".gltf") return inspectGltf(file);
  throw new Error(`Unsupported asset type: ${file}`);
}

async function inspectGltf(file) {
  const json = JSON.parse(await readFile(file, "utf8"));
  return summarizeGltf(file, json);
}

async function inspectGlb(file) {
  const buffer = await readFile(file);
  if (buffer.toString("utf8", 0, 4) !== "glTF") throw new Error(`${file} is not a GLB file.`);
  const totalLength = buffer.readUInt32LE(8);
  let offset = 12;
  while (offset < totalLength) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.toString("utf8", offset + 4, offset + 8);
    const chunk = buffer.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === "JSON") return summarizeGltf(file, JSON.parse(chunk.toString("utf8").trim()));
    offset += 8 + chunkLength;
  }
  throw new Error(`${file} does not contain a JSON GLB chunk.`);
}

function summarizeGltf(file, json) {
  const animations = (json.animations ?? []).map((item) => item.name ?? "(unnamed)");
  const normalizedAnimations = new Set(animations.map((name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "")));
  const missingLikely = requiredClips.filter((clip) => !hasCompatibleClip(clip, normalizedAnimations));
  return {
    file,
    nodes: json.nodes?.length ?? 0,
    meshes: json.meshes?.length ?? 0,
    skins: json.skins?.length ?? 0,
    materials: (json.materials ?? []).map((item) => item.name ?? "(unnamed)").slice(0, 24),
    animations,
    missingLikely,
  };
}

function hasCompatibleClip(clip, normalizedAnimations) {
  const direct = clip.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (normalizedAnimations.has(direct)) return true;
  for (const name of normalizedAnimations) {
    if (clip === "Idle" && /idle|stand|breath|tpose|apose/.test(name)) return true;
    if (clip === "Walk" && /walk/.test(name)) return true;
    if (clip === "Run" && /run|sprint|jog/.test(name)) return true;
    if (clip === "Jump" && /jump|vault|fall/.test(name)) return true;
    if (clip === "Attack_Light" && /attack|punch|kick|jab|hook|slash|sword|katana|blade|knife|melee|strike/.test(name)) return true;
    if (clip === "Attack_Heavy" && /heavy|power|haymaker|smash|finisher|combo/.test(name)) return true;
    if (clip === "Skill_1" && /skill1|dash|lunge|charge/.test(name)) return true;
    if (clip === "Skill_2" && /skill2|spin|whirl|roundhouse|cyclone|turn/.test(name)) return true;
    if (clip === "Skill_3" && /skill3|upper|launcher|slam|leap|air/.test(name)) return true;
    if (clip === "Hit" && /hit|hurt|damage|impact|reaction/.test(name)) return true;
    if (clip === "Death" && /death|die|dying|knockdown|collapse/.test(name)) return true;
  }
  return false;
}

function formatReportSummary(report) {
  const missing = report.missingLikely.length ? report.missingLikely.join(", ") : "none";
  return `meshes=${report.meshes} skins=${report.skins} animations=${report.animations.length} missing-likely=${missing}`;
}

async function findFirstFile(root, suffix) {
  const entries = await import("node:fs/promises").then((fs) => fs.readdir(root, { withFileTypes: true }));
  for (const entry of entries) {
    const file = join(root, entry.name);
    if (entry.isDirectory()) {
      const found = await findFirstFile(file, suffix);
      if (found) return found;
    } else if (suffix.startsWith(".") ? file.toLowerCase().endsWith(suffix) : entry.name === suffix) {
      return file;
    }
  }
  return null;
}

async function run(cmd, cmdArgs) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(cmd, cmdArgs, { stdio: "inherit" });
    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`${cmd} exited with ${code}`));
    });
  });
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}
