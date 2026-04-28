import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import characterCinematicAtlasUrl from "./assets/character-cinematic-atlas.png";
import characterMaterialAtlasUrl from "./assets/character-material-atlas.png";
import characterWaveAtlasUrl from "./assets/character-wave-atlas.png";
import hkCinematicStreetUrl from "./assets/hk-cinematic-street.png";
import hkCloseStreetAtlasUrl from "./assets/hk-close-street-atlas.png";
import hkMaterialAtlasUrl from "./assets/hk-material-atlas.png";
import hkRainStreetUrl from "./assets/hk-rain-street.png";
import soldierModelUrl from "./assets/soldier.glb?url";
import "./style.css";

const canvas = document.querySelector("#game-canvas");
const startButton = document.querySelector("#start-button");
const healthFill = document.querySelector("#health-fill");
const staminaFill = document.querySelector("#stamina-fill");
const waveReadout = document.querySelector("#wave-readout");
const enemyReadout = document.querySelector("#enemy-readout");
const comboReadout = document.querySelector("#combo-readout");
const encounterBanner = document.querySelector("#encounter-banner");
const statusStrip = document.querySelector("#status-strip");
const damageVignette = document.querySelector("#damage-vignette");
const reticle = document.querySelector("#reticle");

const renderSettings = {
  maxPixelRatio: window.innerWidth < 760 ? 0.66 : 0.62,
  realtimeShadows: false,
  maxScenePointLights: window.innerWidth < 760 ? 4 : 7,
  maxRiggedEnemies: window.innerWidth < 760 ? 1 : 3,
};

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(getRenderPixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.34;
renderer.shadowMap.enabled = renderSettings.realtimeShadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x061018);
scene.fog = new THREE.FogExp2(0x071018, 0.018);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  260,
);

const clock = new THREE.Clock();
const rng = makeRng(19051997);

const world = {
  roadHalfWidth: 4.8,
  streetMinZ: -82,
  streetMaxZ: 54,
  sideLimitX: 5.9,
};

const visualMode = {
  generatedScene: false,
  actors3D: true,
  photoDominant: true,
};

const input = {
  forward: false,
  back: false,
  left: false,
  right: false,
  sprint: false,
  dashQueued: false,
  movingTouchId: null,
  touchMove: new THREE.Vector2(),
};

const cameraRig = {
  yaw: 0,
  pitch: 0.06,
  distance: 5.18,
  target: new THREE.Vector3(),
  desired: new THREE.Vector3(),
};

const tmpV3 = new THREE.Vector3();
const tmpV32 = new THREE.Vector3();
const forwardV = new THREE.Vector3();
const rightV = new THREE.Vector3();
const generatedSceneOffset = new THREE.Vector2();
const cinematicSceneOffset = new THREE.Vector2(0, 0);
const textureLoader = new THREE.TextureLoader();
const textureReadyPromises = [];
const gltfLoader = new GLTFLoader();
const soldierModelPromise = gltfLoader.loadAsync(soldierModelUrl);
const generatedAssets = createGeneratedAssetTextures();
scene.background = visualMode.generatedScene ? generatedAssets.street : new THREE.Color(0x061018);

function atlasGridCell(col, row, pad = 0.0075) {
  const size = 0.25;
  return [
    col * size + pad,
    row * size + pad,
    size - pad * 2,
    size - pad * 2,
  ];
}

function waveAtlasCell(col, row, pad = 0.0075) {
  return { atlas: "waveCharacter", rect: atlasGridCell(col, row, pad) };
}

const atlasPanels = {
  wetRoad: [0.0, 0.0, 0.435, 0.36],
  sidewalk: [0.0, 0.36, 0.435, 0.12],
  concreteWall: [0.0, 0.52, 0.435, 0.35],
  neonCluster: [0.435, 0.0, 0.31, 0.38],
  verticalSign: [0.745, 0.0, 0.14, 0.33],
  tubes: [0.78, 0.0, 0.08, 0.33],
  cableWall: [0.745, 0.315, 0.25, 0.09],
  acUnits: [0.745, 0.405, 0.25, 0.13],
  shutters: [0.435, 0.52, 0.22, 0.35],
  shopfront: [0.64, 0.545, 0.22, 0.2],
  busPoster: [0.855, 0.55, 0.125, 0.28],
  wallPosters: [0.855, 0.825, 0.125, 0.16],
  tileWall: [0.0, 0.88, 0.42, 0.12],
};

const closeStreetPanels = {
  shutter: [0.0, 0.0, 0.25, 0.25],
  shopInterior: [0.25, 0.0, 0.25, 0.25],
  tileWall: [0.5, 0.0, 0.25, 0.25],
  concreteWall: [0.75, 0.0, 0.25, 0.25],
  awning: [0.0, 0.25, 0.25, 0.25],
  acPipes: [0.25, 0.25, 0.25, 0.25],
  cableWall: [0.5, 0.25, 0.25, 0.25],
  drainCurb: [0.75, 0.25, 0.25, 0.25],
  wetAsphalt: [0.0, 0.5, 0.25, 0.25],
  railing: [0.25, 0.5, 0.25, 0.25],
  roadSigns: [0.5, 0.5, 0.25, 0.25],
  lightbox: [0.75, 0.5, 0.25, 0.25],
  shelves: [0.0, 0.75, 0.25, 0.25],
  cratesTrash: [0.25, 0.75, 0.25, 0.25],
  balcony: [0.5, 0.75, 0.25, 0.25],
  doorFrame: [0.75, 0.75, 0.25, 0.25],
};

const characterPanels = {
  wetCoat: [0.0, 0.0, 0.42, 0.56],
  tacticalFabric: [0.16, 0.56, 0.2, 0.24],
  carbonFiber: [0.43, 0.0, 0.12, 0.32],
  armorPlate: [0.55, 0.0, 0.15, 0.31],
  gunmetal: [0.47, 0.74, 0.22, 0.24],
  blackRubber: [0.72, 0.54, 0.18, 0.18],
  cyanCircuit: [0.78, 0.25, 0.12, 0.23],
  cyanLong: [0.86, 0.25, 0.14, 0.72],
  magentaVisor: [0.7, 0.0, 0.3, 0.2],
  boots: [0.16, 0.83, 0.18, 0.16],
};

const characterCinematicPanels = {
  wetCoat: atlasGridCell(0, 0),
  carbonArmor: atlasGridCell(1, 0),
  gunmetal: atlasGridCell(2, 0),
  helmet: atlasGridCell(3, 0),
  cyanVisor: atlasGridCell(0, 1),
  magentaVisor: atlasGridCell(1, 1),
  tacticalFabric: atlasGridCell(2, 1),
  rubberGloves: atlasGridCell(3, 1),
  harness: atlasGridCell(0, 2),
  boots: atlasGridCell(1, 2),
  meshSuit: atlasGridCell(2, 2),
  enemyArmor: atlasGridCell(3, 2),
  cyanCircuit: atlasGridCell(0, 3),
  magentaCircuit: atlasGridCell(1, 3),
  bladeMetal: atlasGridCell(2, 3),
  decals: atlasGridCell(3, 3),
};

const characterWavePanels = {
  orangeRaincoat: waveAtlasCell(0, 0),
  orangeArmor: waveAtlasCell(1, 0),
  gunmetal: waveAtlasCell(2, 0),
  blackHelmet: waveAtlasCell(3, 0),
  cyanVisor: waveAtlasCell(0, 1),
  magentaVisor: waveAtlasCell(1, 1),
  tacticalFabric: waveAtlasCell(2, 1),
  rubberGloves: waveAtlasCell(3, 1),
  harness: waveAtlasCell(0, 2),
  boots: waveAtlasCell(1, 2),
  meshSuit: waveAtlasCell(2, 2),
  redArmor: waveAtlasCell(3, 2),
  cyanArmor: waveAtlasCell(0, 3),
  violetArmor: waveAtlasCell(1, 3),
  whiteArmor: waveAtlasCell(2, 3),
  greenArmor: waveAtlasCell(3, 3),
};

const heroVisualPalette = {
  name: "橙黃雨衣",
  gltfPanel: characterWavePanels.orangeRaincoat,
  gltfColor: 0xffffff,
  gltfRoughness: 0.2,
  gltfMetalness: 0.38,
  gltfEnv: 1.46,
  gltfEmissiveBoost: 0.04,
  metalColor: 0xffd08a,
  armorColor: 0xffffff,
  coatColor: 0xffffff,
  deepCoatColor: 0x3d1e11,
  rubberColor: 0x201916,
  harnessColor: 0x352419,
  decalsColor: 0xffeb9b,
  visorColor: 0xcafffb,
  bladeColor: 0xf9fbff,
  metalPanel: characterWavePanels.gunmetal,
  armorPanel: characterWavePanels.orangeArmor,
  coatPanel: characterWavePanels.orangeRaincoat,
  deepCoatPanel: characterWavePanels.orangeRaincoat,
  rubberPanel: characterWavePanels.rubberGloves,
  visorPanel: characterWavePanels.cyanVisor,
  accent: 0x2df4ed,
  secondaryAccent: 0xff2f6d,
  emissive: 0x2a1002,
  decalEmissive: 0x301a04,
};

const enemyWavePalettes = [
  {
    name: "紅甲敵影",
    gltfPanel: characterWavePanels.redArmor,
    gltfColor: 0xffffff,
    metalColor: 0xe08387,
    armorColor: 0xe3343e,
    coatColor: 0x5a141b,
    deepCoatColor: 0x1c0b10,
    rubberColor: 0x171111,
    harnessColor: 0x2b1516,
    decalsColor: 0xff9aaa,
    visorColor: 0xff8fa5,
    bodyColor: 0x7a1c26,
    jacketColor: 0x5a141b,
    pantsColor: 0x171111,
    bootColor: 0x151010,
    skinColor: 0x2a1619,
    armorPanel: characterWavePanels.redArmor,
    coatPanel: characterWavePanels.tacticalFabric,
    deepCoatPanel: characterWavePanels.meshSuit,
    rubberPanel: characterWavePanels.rubberGloves,
    visorPanel: characterWavePanels.magentaVisor,
    accent: 0xff2f6d,
    secondaryAccent: 0x2df4ed,
    emissive: 0x2b0611,
    hitColor: 0xff3b67,
  },
  {
    name: "青藍突擊",
    gltfPanel: characterWavePanels.cyanArmor,
    gltfColor: 0xffffff,
    metalColor: 0x6fe9ff,
    armorColor: 0x1c7f91,
    coatColor: 0x12323a,
    deepCoatColor: 0x071a20,
    rubberColor: 0x0a171a,
    harnessColor: 0x17383f,
    decalsColor: 0x9df7ff,
    visorColor: 0xa9fff8,
    bodyColor: 0x17343a,
    jacketColor: 0x102a31,
    pantsColor: 0x0a1619,
    bootColor: 0x0a1214,
    skinColor: 0x1a3337,
    armorPanel: characterWavePanels.cyanArmor,
    coatPanel: characterWavePanels.tacticalFabric,
    deepCoatPanel: characterWavePanels.meshSuit,
    rubberPanel: characterWavePanels.rubberGloves,
    visorPanel: characterWavePanels.cyanVisor,
    accent: 0x2df4ed,
    secondaryAccent: 0xffb23a,
    emissive: 0x042126,
    hitColor: 0x5ffff5,
  },
  {
    name: "紫霓外骨",
    gltfPanel: characterWavePanels.violetArmor,
    gltfColor: 0xffffff,
    metalColor: 0xc39cff,
    armorColor: 0x6d45b8,
    coatColor: 0x221335,
    deepCoatColor: 0x14091f,
    rubberColor: 0x130e18,
    harnessColor: 0x2e1f42,
    decalsColor: 0xd8b7ff,
    visorColor: 0xffb0f7,
    bodyColor: 0x2a173e,
    jacketColor: 0x20112f,
    pantsColor: 0x120d18,
    bootColor: 0x100b14,
    skinColor: 0x251936,
    armorPanel: characterWavePanels.violetArmor,
    coatPanel: characterWavePanels.tacticalFabric,
    deepCoatPanel: characterWavePanels.meshSuit,
    rubberPanel: characterWavePanels.rubberGloves,
    visorPanel: characterWavePanels.magentaVisor,
    accent: 0xb56bff,
    secondaryAccent: 0xff2f6d,
    emissive: 0x15082a,
    hitColor: 0xd069ff,
  },
  {
    name: "白灰戰術",
    gltfPanel: characterWavePanels.whiteArmor,
    gltfColor: 0xffffff,
    metalColor: 0xd5e2e5,
    armorColor: 0xb9c6ca,
    coatColor: 0x33383b,
    deepCoatColor: 0x171b1d,
    rubberColor: 0x151719,
    harnessColor: 0x3b3d3f,
    decalsColor: 0xffed9c,
    visorColor: 0xfff1a6,
    bodyColor: 0x3c4245,
    jacketColor: 0x282e31,
    pantsColor: 0x181c1e,
    bootColor: 0x121517,
    skinColor: 0x495155,
    armorPanel: characterWavePanels.whiteArmor,
    coatPanel: characterWavePanels.tacticalFabric,
    deepCoatPanel: characterWavePanels.meshSuit,
    rubberPanel: characterWavePanels.rubberGloves,
    visorPanel: characterWavePanels.cyanVisor,
    accent: 0xffdf70,
    secondaryAccent: 0x2df4ed,
    emissive: 0x1d1804,
    hitColor: 0xffe083,
  },
  {
    name: "毒綠裝甲",
    gltfPanel: characterWavePanels.greenArmor,
    gltfColor: 0xffffff,
    metalColor: 0x89ffb4,
    armorColor: 0x2e8b55,
    coatColor: 0x0f2718,
    deepCoatColor: 0x09150d,
    rubberColor: 0x0c120e,
    harnessColor: 0x1e3a27,
    decalsColor: 0xa6ffbf,
    visorColor: 0xadffc1,
    bodyColor: 0x14301d,
    jacketColor: 0x102518,
    pantsColor: 0x0a150e,
    bootColor: 0x07110b,
    skinColor: 0x193422,
    armorPanel: characterWavePanels.greenArmor,
    coatPanel: characterWavePanels.tacticalFabric,
    deepCoatPanel: characterWavePanels.meshSuit,
    rubberPanel: characterWavePanels.rubberGloves,
    visorPanel: characterWavePanels.cyanVisor,
    accent: 0x5cff9d,
    secondaryAccent: 0xff2f6d,
    emissive: 0x061f0f,
    hitColor: 0x7cffaa,
  },
];

function getEnemyWavePalette(level = 1) {
  return enemyWavePalettes[(Math.max(1, level) - 1) % enemyWavePalettes.length];
}

function resolveActorPalette(role, level = 1, palette = null) {
  return palette ?? (role === "player" ? heroVisualPalette : getEnemyWavePalette(level));
}

let gameStarted = false;
let gameOver = false;
let wave = 0;
let nextWaveTimer = 0;
let encounterTimer = 0;
let vignetteTimer = 0;
let statusTimer = 0;
let elapsed = 0;

const enemies = [];
const floatingTexts = [];
const sparks = [];
const afterimages = [];
const animatedActors = [];
const streetLife = {
  neonMaterials: [],
  traffic: [],
};
let scenePointLightCount = 0;
let cinematicBackdrop = null;

const materials = createMaterials();
const player = createPlayer();
const slash = createSlashEffect();
const rain = createRainSystem();

scene.add(player.group);
scene.add(slash.mesh);
scene.add(rain.points);
attachRiggedActor(player, {
  role: "player",
  desiredHeight: 2.12,
  palette: heroVisualPalette,
  tint: heroVisualPalette.gltfColor,
  accent: heroVisualPalette.accent,
  secondaryAccent: heroVisualPalette.secondaryAccent,
});

setupLights();
createHongKongStreet();
bindInput();
resize();
resetGame();
Promise.allSettled(textureReadyPromises).then(() => animate());

function makeRng(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getRenderPixelRatio() {
  return Math.min(window.devicePixelRatio || 1, renderSettings.maxPixelRatio);
}

function damp(current, target, lambda, dt) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

function canvasTexture(width, height, draw) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createPbrMapSet(width, height, options = {}) {
  const {
    base = "#20262b",
    groove = "rgba(255,255,255,0.12)",
    scratch = "rgba(255,255,255,0.2)",
    density = 900,
    tile = 1,
  } = options;

  const albedo = canvasTexture(width, height, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < density; i += 1) {
      const v = 20 + Math.floor(rng() * 75);
      ctx.fillStyle = `rgba(${v},${v + 4},${v + 8},${0.07 + rng() * 0.2})`;
      ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 4, 1 + rng() * 3);
    }
    ctx.strokeStyle = groove;
    ctx.lineWidth = 1 + rng() * 2;
    for (let y = 0; y < h; y += 36 + Math.floor(rng() * 24)) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + (rng() - 0.5) * 18);
      ctx.stroke();
    }
    ctx.strokeStyle = scratch;
    ctx.lineWidth = 1;
    for (let i = 0; i < density * 0.12; i += 1) {
      const x = rng() * w;
      const y = rng() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 10 + rng() * 54, y + (rng() - 0.5) * 5);
      ctx.stroke();
    }
  });

  const normal = canvasTexture(width, height, (ctx, w, h) => {
    ctx.fillStyle = "#8080ff";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "overlay";
    for (let i = 0; i < density * 0.7; i += 1) {
      const v = 92 + Math.floor(rng() * 82);
      ctx.fillStyle = `rgb(${v},${v},255)`;
      ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 6, 1 + rng() * 2);
    }
  });

  const roughness = canvasTexture(width, height, (ctx, w, h) => {
    ctx.fillStyle = "#8f8f8f";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < density * 0.5; i += 1) {
      const v = 92 + Math.floor(rng() * 120);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(rng() * w, rng() * h, 2 + rng() * 14, 1 + rng() * 3);
    }
  });

  for (const texture of [albedo, normal, roughness]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(tile, tile);
  }

  return { albedo, normal, roughness };
}

function createGeneratedAssetTextures() {
  const load = (url) => {
    let resolveReady;
    textureReadyPromises.push(new Promise((resolve) => { resolveReady = resolve; }));
    const texture = textureLoader.load(url, resolveReady, undefined, resolveReady);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  };
  return {
    character: load(characterMaterialAtlasUrl),
    cinematicCharacter: load(characterCinematicAtlasUrl),
    waveCharacter: load(characterWaveAtlasUrl),
    atlas: load(hkMaterialAtlasUrl),
    closeStreet: load(hkCloseStreetAtlasUrl),
    cinematicStreet: (() => {
      const texture = load(hkCinematicStreetUrl);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.repeat.set(1, 1);
      texture.offset.copy(cinematicSceneOffset);
      return texture;
    })(),
    street: (() => {
      const texture = load(hkRainStreetUrl);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.repeat.set(0.86, 0.86);
      texture.offset.set(0.07, 0.07);
      generatedSceneOffset.set(0.07, 0.07);
      return texture;
    })(),
  };
}

function atlasTexture(panel, sourceTexture = generatedAssets.atlas) {
  const [x, y, w, h] = panel;
  const texture = sourceTexture.clone();
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(w, h);
  texture.offset.set(x, 1 - y - h);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function characterTexture(panel) {
  return atlasTexture(panel, generatedAssets.character);
}

function cinematicCharacterTexture(panel) {
  return atlasTexture(panel, generatedAssets.cinematicCharacter);
}

function actorCharacterTexture(panel) {
  if (panel?.atlas === "waveCharacter") {
    return atlasTexture(panel.rect, generatedAssets.waveCharacter);
  }
  return cinematicCharacterTexture(panel);
}

function closeStreetTexture(panel) {
  return atlasTexture(panel, generatedAssets.closeStreet);
}

function atlasMaterial(panel, options = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: options.color ?? 0xffffff,
    map: options.map ?? atlasTexture(panel),
    roughness: options.roughness ?? 0.5,
    metalness: options.metalness ?? 0.12,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
  });
  if (options.toneMapped === false) material.toneMapped = false;
  return material;
}

function closeStreetMaterial(panel, options = {}) {
  return atlasMaterial(panel, {
    ...options,
    map: closeStreetTexture(panel),
  });
}

function createMaterials() {
  const wetAsphaltMaps = createPbrMapSet(1024, 1024, {
    base: "#12161a",
    groove: "rgba(123, 155, 156, 0.22)",
    scratch: "rgba(220, 238, 235, 0.18)",
    density: 3600,
    tile: 1,
  });
  wetAsphaltMaps.albedo.repeat.set(2, 10);
  wetAsphaltMaps.normal.repeat.set(2, 10);
  wetAsphaltMaps.roughness.repeat.set(2, 10);

  const concreteMaps = createPbrMapSet(512, 512, {
    base: "#3b4144",
    groove: "rgba(255,255,255,0.1)",
    scratch: "rgba(15,20,22,0.16)",
    density: 1200,
    tile: 1,
  });
  concreteMaps.albedo.repeat.set(1, 15);
  concreteMaps.normal.repeat.set(1, 15);
  concreteMaps.roughness.repeat.set(1, 15);

  return {
    asphalt: new THREE.MeshStandardMaterial({
      color: 0x1f2428,
      map: atlasTexture(atlasPanels.wetRoad),
      normalMap: wetAsphaltMaps.normal,
      roughnessMap: wetAsphaltMaps.roughness,
      transparent: true,
      opacity: visualMode.photoDominant ? 0.44 : (visualMode.generatedScene ? 0.24 : 0.82),
      roughness: 0.18,
      metalness: 0.34,
      envMapIntensity: 1.0,
    }),
    sidewalk: new THREE.MeshStandardMaterial({
      color: 0x5c6366,
      map: atlasTexture(atlasPanels.sidewalk),
      normalMap: concreteMaps.normal,
      roughnessMap: concreteMaps.roughness,
      roughness: 0.62,
      metalness: 0.04,
    }),
    curb: new THREE.MeshStandardMaterial({
      color: 0x30383a,
      roughness: 0.44,
      metalness: 0.18,
    }),
    playerCoat: new THREE.MeshStandardMaterial({
      color: heroVisualPalette.coatColor,
      map: actorCharacterTexture(heroVisualPalette.coatPanel),
      roughness: 0.2,
      metalness: 0.34,
      envMapIntensity: 1.22,
    }),
    playerArmor: new THREE.MeshStandardMaterial({
      color: heroVisualPalette.armorColor,
      map: actorCharacterTexture(heroVisualPalette.armorPanel),
      roughness: 0.2,
      metalness: 0.72,
      envMapIntensity: 1.45,
    }),
    playerAccent: new THREE.MeshStandardMaterial({
      color: heroVisualPalette.accent,
      map: cinematicCharacterTexture(characterCinematicPanels.cyanCircuit),
      emissive: heroVisualPalette.accent,
      emissiveIntensity: 1.05,
      roughness: 0.18,
      metalness: 0.5,
    }),
    blade: new THREE.MeshStandardMaterial({
      color: 0xf2fbff,
      map: cinematicCharacterTexture(characterCinematicPanels.bladeMetal),
      emissive: 0x446a7d,
      emissiveIntensity: 0.34,
      roughness: 0.13,
      metalness: 0.94,
      envMapIntensity: 1.4,
    }),
    enemyBody: new THREE.MeshStandardMaterial({
      color: 0xe1d1d3,
      map: cinematicCharacterTexture(characterCinematicPanels.tacticalFabric),
      roughness: 0.42,
      metalness: 0.2,
      envMapIntensity: 1.0,
    }),
    enemyAccent: new THREE.MeshStandardMaterial({
      color: 0xff95a9,
      map: cinematicCharacterTexture(characterCinematicPanels.magentaCircuit),
      emissive: 0xb60028,
      emissiveIntensity: 0.95,
      roughness: 0.18,
      metalness: 0.44,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x16222f,
      roughness: 0.12,
      metalness: 0.18,
      transparent: true,
      opacity: 0.76,
    }),
    taxi: new THREE.MeshStandardMaterial({
      color: 0x3d2930,
      roughness: 0.28,
      metalness: 0.34,
      envMapIntensity: 1.05,
    }),
    redTaxi: new THREE.MeshStandardMaterial({
      color: 0x55171d,
      roughness: 0.38,
      metalness: 0.18,
    }),
    blackRubber: new THREE.MeshStandardMaterial({
      color: 0x949494,
      map: cinematicCharacterTexture(characterCinematicPanels.rubberGloves),
      roughness: 0.56,
      metalness: 0.12,
      envMapIntensity: 0.8,
    }),
    facadeConcrete: atlasMaterial(atlasPanels.concreteWall, {
      color: 0xb8c4c6,
      roughness: 0.72,
      metalness: 0.06,
    }),
    shutter: atlasMaterial(atlasPanels.shutters, {
      color: 0xb6b0a7,
      roughness: 0.58,
      metalness: 0.24,
    }),
    acPanel: atlasMaterial(atlasPanels.acUnits, {
      color: 0xd0d4d2,
      roughness: 0.56,
      metalness: 0.2,
    }),
    shopfront: atlasMaterial(atlasPanels.shopfront, {
      color: 0xeaf7f4,
      roughness: 0.25,
      metalness: 0.18,
      emissive: 0x1a5a55,
      emissiveIntensity: 0.2,
    }),
    poster: atlasMaterial(atlasPanels.busPoster, {
      color: 0xffd0d6,
      roughness: 0.42,
      metalness: 0.08,
      emissive: 0x401018,
      emissiveIntensity: 0.12,
    }),
    neonTube: atlasMaterial(atlasPanels.tubes, {
      color: 0xffffff,
      roughness: 0.18,
      metalness: 0.12,
      emissive: 0xff365d,
      emissiveIntensity: 0.9,
      toneMapped: false,
    }),
    streetBin: atlasMaterial(atlasPanels.shutters, {
      color: 0x324345,
      roughness: 0.5,
      metalness: 0.28,
    }),
    streetBinLabel: atlasMaterial(atlasPanels.wallPosters, {
      color: 0xd5f4ee,
      roughness: 0.42,
      metalness: 0.08,
      emissive: 0x061d1c,
      emissiveIntensity: 0.1,
    }),
    closeShutter: closeStreetMaterial(closeStreetPanels.shutter, {
      color: 0xf0eee4,
      roughness: 0.44,
      metalness: 0.38,
    }),
    closeShopInterior: closeStreetMaterial(closeStreetPanels.shopInterior, {
      color: 0xfff0d6,
      roughness: 0.2,
      metalness: 0.12,
      emissive: 0x4d2a10,
      emissiveIntensity: 0.34,
    }),
    closeTileWall: closeStreetMaterial(closeStreetPanels.tileWall, {
      color: 0xc5b4a9,
      roughness: 0.76,
      metalness: 0.06,
    }),
    closeConcreteWall: closeStreetMaterial(closeStreetPanels.concreteWall, {
      color: 0xc2c1b7,
      roughness: 0.82,
      metalness: 0.05,
    }),
    closeAwning: closeStreetMaterial(closeStreetPanels.awning, {
      color: 0xffffff,
      roughness: 0.38,
      metalness: 0.1,
    }),
    closeAcPipes: closeStreetMaterial(closeStreetPanels.acPipes, {
      color: 0xd4d0c5,
      roughness: 0.48,
      metalness: 0.34,
    }),
    closeCableWall: closeStreetMaterial(closeStreetPanels.cableWall, {
      color: 0xb8b2a6,
      roughness: 0.6,
      metalness: 0.2,
    }),
    closeDrainCurb: closeStreetMaterial(closeStreetPanels.drainCurb, {
      color: 0xd7f7ef,
      roughness: 0.22,
      metalness: 0.46,
      emissive: 0x062c2a,
      emissiveIntensity: 0.12,
    }),
    closeWetAsphalt: closeStreetMaterial(closeStreetPanels.wetAsphalt, {
      color: 0xe8f7f1,
      roughness: 0.18,
      metalness: 0.42,
      emissive: 0x120718,
      emissiveIntensity: 0.12,
    }),
    closeRailing: closeStreetMaterial(closeStreetPanels.railing, {
      color: 0xd1e7e0,
      roughness: 0.26,
      metalness: 0.64,
    }),
    closeRoadSigns: closeStreetMaterial(closeStreetPanels.roadSigns, {
      color: 0xf7d4aa,
      roughness: 0.36,
      metalness: 0.28,
    }),
    closeLightbox: closeStreetMaterial(closeStreetPanels.lightbox, {
      color: 0xffffff,
      roughness: 0.16,
      metalness: 0.18,
      emissive: 0xffc17a,
      emissiveIntensity: 0.42,
    }),
    closeShelves: closeStreetMaterial(closeStreetPanels.shelves, {
      color: 0xffecd0,
      roughness: 0.32,
      metalness: 0.18,
      emissive: 0x35200b,
      emissiveIntensity: 0.24,
    }),
    closeCratesTrash: closeStreetMaterial(closeStreetPanels.cratesTrash, {
      color: 0xd8c4aa,
      roughness: 0.58,
      metalness: 0.1,
    }),
    closeBalcony: closeStreetMaterial(closeStreetPanels.balcony, {
      color: 0xb8c4c0,
      roughness: 0.56,
      metalness: 0.28,
    }),
    closeDoorFrame: closeStreetMaterial(closeStreetPanels.doorFrame, {
      color: 0xd4d0c5,
      roughness: 0.46,
      metalness: 0.42,
    }),
  };
}

function setupLights() {
  const hemi = new THREE.HemisphereLight(0xcde7ff, 0x281319, 3.25);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(0xc8ddff, 1.55);
  moon.position.set(-17, 38, 20);
  moon.castShadow = renderSettings.realtimeShadows;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -36;
  moon.shadow.camera.right = 36;
  moon.shadow.camera.top = 46;
  moon.shadow.camera.bottom = -46;
  moon.shadow.camera.near = 2;
  moon.shadow.camera.far = 80;
  scene.add(moon);

  addBudgetPointLight(0x3ee7de, 1.8, 38, 1.8, -11, 7, -70);

  const streetFill = new THREE.DirectionalLight(0xbfeeea, 0.72);
  streetFill.position.set(8, 7, 18);
  scene.add(streetFill);

  const cameraFill = new THREE.PointLight(0xeaffff, 3.35, 12, 2.2);
  cameraFill.position.set(0, 0.35, -0.8);
  camera.add(cameraFill);
  scene.add(camera);
}

function createHongKongStreet() {
  createGeneratedBackdrop();

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(world.roadHalfWidth * 2, world.streetMaxZ - world.streetMinZ + 40),
    materials.asphalt,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = (world.streetMaxZ + world.streetMinZ) / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  if (visualMode.generatedScene) {
    createGeneratedSceneLighting();
    return;
  }

  addRoadPaint();

  const sidewalkDepth = 2.9;
  for (const side of [-1, 1]) {
    const sidewalk = new THREE.Mesh(
      new THREE.BoxGeometry(sidewalkDepth, 0.28, world.streetMaxZ - world.streetMinZ + 46),
      materials.sidewalk,
    );
    sidewalk.position.set(
      side * (world.roadHalfWidth + sidewalkDepth / 2),
      0.13,
      (world.streetMaxZ + world.streetMinZ) / 2,
    );
    sidewalk.castShadow = true;
    sidewalk.receiveShadow = true;
    scene.add(sidewalk);

    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.35, world.streetMaxZ - world.streetMinZ + 46),
      materials.curb,
    );
    curb.position.set(side * (world.roadHalfWidth + 0.1), 0.28, (world.streetMaxZ + world.streetMinZ) / 2);
    curb.castShadow = true;
    curb.receiveShadow = true;
    scene.add(curb);
  }

  if (!visualMode.photoDominant) {
    createHeroBattleBlock();
    createBuildings(-1);
    createBuildings(1);
  } else {
    createHeroRoadDetails();
  }
  createWetStreetDetails();
  createBakedLightField();
  if (!visualMode.photoDominant) {
    createOpeningNeon();
    createOverheadSigns();
    createOverheadCables();
  }
  createStreetProps();
  if (!visualMode.photoDominant) {
    createHarbourBackdrop();
  }
}

function createGeneratedSceneLighting() {
  const pools = [
    [-3.8, 34, "#ff2f6d", 2.4, 3.4],
    [3.5, 24, "#2df4ed", 2.7, 3.8],
    [-2.2, 8, "#ffe072", 2.1, 3.2],
    [2.9, -18, "#ff7a36", 2.5, 4.2],
    [-3.4, -40, "#2df4ed", 2.4, 4.5],
  ];
  for (const [x, z, color, width, depth] of pools) {
    addGroundReflection(x, z, color, width, depth, x < 0 ? -1 : 1);
    addBudgetPointLight(color, 0.55, 10, 2, x, 2.5, z);
  }
}

function createHeroBattleBlock() {
  const bays = [
    { z: 30.5, width: 5.4, main: "霓虹茶餐廳", sub: "NIGHT CAFE", color: "#ff365d", panel: atlasPanels.shopfront },
    { z: 38.4, width: 4.7, main: "港島藥房", sub: "PHARMACY", color: "#24d8cf", panel: atlasPanels.shutters },
    { z: 46.2, width: 5.2, main: "手機維修", sub: "REPAIR", color: "#ffdf68", panel: atlasPanels.shopfront },
  ];

  for (const side of [-1, 1]) {
    for (let i = 0; i < bays.length; i += 1) {
      const bay = bays[(i + (side > 0 ? 1 : 0)) % bays.length];
      createHeroShopBay(side, bay.z + (side > 0 ? -1.7 : 0.8), bay.width, i, bay);
    }
    createHeroFacadeStack(side);
  }

  createHeroRoadDetails();
  createHeroCableCanopy();
  createHeroGatewaySign();
}

function createHeroShopBay(side, z, width, index, bay) {
  const facadeX = side * 6.45;
  const faceRotation = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  const signColor = bay.color;
  const warmInterior = index % 2 === 0;
  const group = new THREE.Group();
  group.position.set(facadeX, 0, z);
  scene.add(group);

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 4.9, width + 0.7),
    index % 2 === 0 ? materials.closeConcreteWall : materials.closeTileWall,
  );
  wall.position.set(side * 0.16, 2.45, 0);
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  const recess = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 2.45, width * 0.72),
    new THREE.MeshStandardMaterial({
      color: warmInterior ? 0x14110d : 0x07090b,
      roughness: 0.5,
      metalness: 0.12,
      emissive: warmInterior ? 0x170b03 : 0x000000,
      emissiveIntensity: warmInterior ? 0.28 : 0,
    }),
  );
  recess.position.set(-side * 0.02, 1.36, -0.1);
  recess.castShadow = true;
  recess.receiveShadow = true;
  group.add(recess);

  const shutter = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 2.15, width * 0.44),
    warmInterior ? materials.closeShutter : materials.closeShopInterior,
  );
  shutter.position.set(-side * 0.2, 1.38, -width * 0.13);
  shutter.castShadow = true;
  shutter.receiveShadow = true;
  group.add(shutter);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 1.85, width * 0.28),
    materials.glass,
  );
  glass.position.set(-side * 0.24, 1.46, width * 0.22);
  glass.castShadow = true;
  glass.receiveShadow = true;
  group.add(glass);

  const interiorPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.33, 1.72),
    new THREE.MeshBasicMaterial({
      map: closeStreetTexture(warmInterior ? closeStreetPanels.shopInterior : closeStreetPanels.shelves),
      color: warmInterior ? 0xfff0ce : 0xc9f5f1,
      transparent: true,
      opacity: 0.72,
      toneMapped: false,
      side: THREE.DoubleSide,
    }),
  );
  interiorPanel.rotation.y = faceRotation;
  interiorPanel.position.set(-side * 0.31, 1.48, width * 0.22);
  group.add(interiorPanel);

  const innerGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.32, 1.62),
    new THREE.MeshBasicMaterial({
      color: warmInterior ? 0xffb35a : 0x2df4ed,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    }),
  );
  innerGlow.rotation.y = faceRotation;
  innerGlow.position.set(-side * 0.34, 1.48, width * 0.22);
  group.add(innerGlow);

  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(1.22, 0.14, width + 0.35),
    materials.closeAwning,
  );
  canopy.position.set(-side * 0.62, 2.72, 0);
  canopy.rotation.z = side * 0.06;
  canopy.castShadow = true;
  canopy.receiveShadow = true;
  group.add(canopy);

  for (let rib = 0; rib < 7; rib += 1) {
    const canopyRib = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 0.035, 0.035),
      new THREE.MeshStandardMaterial({ color: 0x0b1113, roughness: 0.3, metalness: 0.6 }),
    );
    canopyRib.position.set(-side * 0.63, 2.64, -width * 0.5 + rib * (width / 6));
    canopyRib.rotation.z = side * 0.06;
    canopyRib.castShadow = true;
    group.add(canopyRib);
  }

  const signBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.92, width * 0.82),
    materials.closeLightbox,
  );
  signBack.position.set(-side * 0.36, 3.33, 0);
  signBack.castShadow = true;
  group.add(signBack);

  const doorFrameMaterial = materials.closeDoorFrame;
  for (const offset of [-width * 0.34, width * 0.05, width * 0.37]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.42, 0.07), doorFrameMaterial);
    frame.position.set(-side * 0.34, 1.46, offset);
    frame.castShadow = true;
    group.add(frame);
  }
  const threshold = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.07, width * 0.78), materials.closeDrainCurb);
  threshold.position.set(-side * 0.36, 0.18, 0);
  threshold.castShadow = true;
  threshold.receiveShadow = true;
  group.add(threshold);

  const signTexture = createSignTexture(bay.main, bay.sub, signColor, "#fff6cf", 640, 210);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.76, 0.76),
    trackNeonMaterial(new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, toneMapped: false, side: THREE.DoubleSide }), 0.92),
  );
  sign.rotation.y = faceRotation;
  sign.position.set(-side * 0.53, 3.34, 0);
  group.add(sign);

  const rollBars = new THREE.Group();
  const barMaterial = new THREE.MeshStandardMaterial({ color: 0x171d20, roughness: 0.32, metalness: 0.72 });
  for (let j = 0; j < 6; j += 1) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.96, 0.035), barMaterial);
    bar.position.set(-side * 0.285, 1.42, -width * 0.28 + j * width * 0.1);
    bar.castShadow = true;
    rollBars.add(bar);
  }
  group.add(rollBars);

  for (let j = 0; j < 3; j += 1) {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 2.4 + j * 0.35, 10),
      j === 0 ? materials.closeAcPipes : new THREE.MeshStandardMaterial({ color: 0x11171a, roughness: 0.4, metalness: 0.5 }),
    );
    pipe.position.set(-side * (0.42 + j * 0.045), 2.2 + j * 0.22, -width * 0.46 + j * 0.24);
    pipe.castShadow = true;
    group.add(pipe);
  }

  const acBox = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.62), materials.closeAcPipes);
  acBox.position.set(-side * 0.5, 3.78, -width * 0.38);
  acBox.castShadow = true;
  acBox.receiveShadow = true;
  group.add(acBox);

  const cablePatch = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.36, 0.86),
    new THREE.MeshStandardMaterial({
      map: closeStreetTexture(closeStreetPanels.cableWall),
      color: 0xcdd0c4,
      roughness: 0.5,
      metalness: 0.18,
      side: THREE.DoubleSide,
    }),
  );
  cablePatch.rotation.y = faceRotation;
  cablePatch.position.set(-side * 0.49, 3.85, width * 0.11);
  group.add(cablePatch);

  const sideSign = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 2.0, 0.76),
    new THREE.MeshStandardMaterial({
      color: 0x08090b,
      roughness: 0.2,
      metalness: 0.5,
      emissive: new THREE.Color(signColor),
      emissiveIntensity: 0.12,
    }),
  );
  sideSign.position.set(-side * 0.72, 3.05, width * 0.46);
  sideSign.castShadow = true;
  group.add(sideSign);

  const sideTexture = createSignTexture(index % 2 === 0 ? "雨夜" : "電器", bay.sub, signColor, "#fff8d4", 256, 512, true);
  const sideFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 1.74),
    trackNeonMaterial(new THREE.MeshBasicMaterial({ map: sideTexture, transparent: true, toneMapped: false, side: THREE.DoubleSide }), 0.86),
  );
  sideFace.position.set(-side * 0.83, 3.05, width * 0.46);
  sideFace.rotation.y = faceRotation;
  group.add(sideFace);

  addGroundReflection(facadeX - side * 1.0, z, signColor, width * 0.86, 2.6, side);
  addBudgetPointLight(signColor, 0.9, 8.5, 2, facadeX - side * 0.9, 3.0, z);

  createHeroStreetClutter(side, facadeX - side * 1.15, z, width, index);
}

function createHeroStreetClutter(side, x, z, width, index) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  scene.add(group);

  const crateCount = 2 + (index % 2);
  for (let i = 0; i < crateCount; i += 1) {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(0.38 + rng() * 0.12, 0.28 + rng() * 0.16, 0.5 + rng() * 0.18),
      materials.closeCratesTrash,
    );
    crate.position.set(side * (0.08 + rng() * 0.25), 0.24 + i * 0.12, -width * 0.36 + i * 0.5);
    crate.rotation.y = (rng() - 0.5) * 0.22;
    crate.castShadow = true;
    crate.receiveShadow = true;
    group.add(crate);
  }

  const trashBagMaterial = new THREE.MeshStandardMaterial({
    color: 0x050607,
    roughness: 0.2,
    metalness: 0.12,
    envMapIntensity: 1.1,
  });
  for (let i = 0; i < 2; i += 1) {
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.22 + rng() * 0.05, 12, 8), trashBagMaterial);
    bag.scale.set(1.05 + rng() * 0.3, 0.62 + rng() * 0.16, 0.92 + rng() * 0.24);
    bag.position.set(side * (0.1 + rng() * 0.32), 0.22, width * 0.28 + i * 0.32);
    bag.castShadow = true;
    bag.receiveShadow = true;
    group.add(bag);
  }

  const railing = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.78, width * 0.4), materials.closeRailing);
  railing.position.set(-side * 0.55, 0.58, width * 0.02);
  railing.castShadow = true;
  railing.receiveShadow = true;
  group.add(railing);
  for (let i = 0; i < 4; i += 1) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 10), materials.closeRailing);
    post.position.set(-side * 0.55, 0.52, -width * 0.18 + i * width * 0.12);
    post.castShadow = true;
    group.add(post);
  }

  const lightbox = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.54, 0.9), materials.closeLightbox);
  lightbox.position.set(-side * 0.42, 1.85, -width * 0.5);
  lightbox.castShadow = true;
  group.add(lightbox);
}

function createHeroFacadeStack(side) {
  const facadeX = side * 6.9;
  const material = materials.closeBalcony;
  for (let floor = 0; floor < 3; floor += 1) {
    const y = 4.25 + floor * 1.55;
    const z = 28 + floor * 4.8;
    const balcony = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 3.0), material);
    balcony.position.set(facadeX - side * 0.44, y, z);
    balcony.castShadow = true;
    scene.add(balcony);

    for (let i = 0; i < 4; i += 1) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.82, 0.045), material);
      rail.position.set(facadeX - side * 0.7, y - 0.28, z - 1.12 + i * 0.74);
      rail.castShadow = true;
      scene.add(rail);
    }

    const ac = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.72), materials.acPanel);
    ac.position.set(facadeX - side * 0.5, y + 0.38, z + 1.55);
    ac.castShadow = true;
    scene.add(ac);

    const balconyFace = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 1.15),
      new THREE.MeshStandardMaterial({
        map: closeStreetTexture(closeStreetPanels.balcony),
        color: 0xc4d1cf,
        roughness: 0.58,
        metalness: 0.22,
        side: THREE.DoubleSide,
      }),
    );
    balconyFace.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    balconyFace.position.set(facadeX - side * 0.78, y + 0.26, z - 0.06);
    scene.add(balconyFace);
  }
}

function createHeroRoadDetails() {
  const drainMaterial = materials.closeDrainCurb;
  const slitMaterial = new THREE.MeshBasicMaterial({ color: 0x17272a, transparent: true, opacity: 0.72 });
  for (const side of [-1, 1]) {
    for (const z of [25.5, 35.5, 45.5]) {
      const drain = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.035, 3.2), drainMaterial);
      drain.position.set(side * 4.36, 0.055, z);
      drain.receiveShadow = true;
      scene.add(drain);
      for (let i = 0; i < 7; i += 1) {
        const slit = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.035), slitMaterial);
        slit.rotation.x = -Math.PI / 2;
        slit.position.set(side * 4.36, 0.078, z - 1.2 + i * 0.4);
        scene.add(slit);
      }
    }
  }

  for (const [x, z, color] of [[-1.7, 35.5, "#2df4ed"], [2.0, 42.5, "#ff365d"], [0.2, 29.0, "#ffe072"]]) {
    addGroundReflection(x, z, color, 3.2, 4.0, x < 0 ? -1 : 1);
  }

  for (let i = 0; i < 10; i += 1) {
    const grime = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4 + rng() * 2.1, 0.7 + rng() * 1.5),
      new THREE.MeshStandardMaterial({
        map: closeStreetTexture(i % 2 === 0 ? closeStreetPanels.wetAsphalt : closeStreetPanels.roadSigns),
        color: i % 2 === 0 ? 0xd6f7f4 : 0xffc98f,
        roughness: 0.2,
        metalness: 0.32,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    );
    grime.rotation.x = -Math.PI / 2;
    grime.rotation.z = (rng() - 0.5) * 0.5;
    grime.position.set((rng() - 0.5) * world.roadHalfWidth * 1.55, 0.041, 25 + rng() * 25);
    scene.add(grime);
  }
}

function createHeroCableCanopy() {
  const cableMaterial = new THREE.MeshStandardMaterial({ color: 0x030506, roughness: 0.42, metalness: 0.34 });
  for (let i = 0; i < 10; i += 1) {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.014 + (i % 3) * 0.005, 0.014 + (i % 3) * 0.005, 15.2, 8), cableMaterial);
    cable.rotation.z = Math.PI / 2;
    cable.rotation.y = (rng() - 0.5) * 0.16;
    cable.position.set(0, 4.6 + i * 0.22, 27 + i * 2.15);
    cable.castShadow = true;
    scene.add(cable);
  }
}

function createHeroGatewaySign() {
  const signTexture = createSignTexture("廟街雨戰", "TEMPLE ST. RAIN", "#ff365d", "#fff3c6", 896, 256);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(5.65, 1.12),
    trackNeonMaterial(new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, toneMapped: false, side: THREE.DoubleSide }), 0.92),
  );
  sign.position.set(0, 5.25, 25.2);
  scene.add(sign);

  const frame = createNeonFrame(5.95, 1.36, 0.07);
  frame.position.set(0, 5.25, 25.28);
  scene.add(frame);

  const bracketMaterial = new THREE.MeshStandardMaterial({ color: 0x15191d, roughness: 0.3, metalness: 0.72 });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.13, 2.2, 0.13), bracketMaterial);
    post.position.set(side * 4.2, 4.15, 25.28);
    post.castShadow = true;
    scene.add(post);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.1), bracketMaterial);
    arm.position.set(side * 3.75, 5.68, 25.28);
    arm.castShadow = true;
    scene.add(arm);
  }

  addBudgetPointLight("#ff365d", 1.0, 9, 2, 0, 5.1, 25.0);
  addGroundReflection(0, 25.0, "#ff365d", 5.2, 3.0, 1);
}

function createGeneratedBackdrop() {
  const cinematicMaterial = new THREE.MeshBasicMaterial({
    map: generatedAssets.cinematicStreet,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  cinematicMaterial.fog = false;
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(330, 185.6), cinematicMaterial);
  backdrop.position.set(0, 26, -116);
  backdrop.renderOrder = -20;
  cinematicBackdrop = backdrop;
  scene.add(backdrop);

  const legacyMaterial = new THREE.MeshBasicMaterial({
    map: generatedAssets.street,
    transparent: true,
    opacity: 0.04,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  legacyMaterial.fog = false;
  const legacyBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(330, 185.6), legacyMaterial);
  legacyBackdrop.position.set(0, 26, -115.4);
  legacyBackdrop.renderOrder = -19;
  scene.add(legacyBackdrop);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(334, 188),
    new THREE.MeshBasicMaterial({
      color: 0x17252f,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  glow.material.fog = false;
  glow.position.set(0, 26, -115.0);
  glow.renderOrder = -18;
  scene.add(glow);
}

function addRoadPaint() {
  const paintMaterial = new THREE.MeshBasicMaterial({
    color: 0xd7d0b9,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });

  for (let z = -58; z < 46; z += 26) {
    for (let i = -4; i <= 4; i += 1) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3.35), paintMaterial);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(i * 1.0, 0.018, z);
      scene.add(stripe);
    }
  }

  const slowTexture = canvasTexture(512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "900 84px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("慢駛", w / 2, h / 2 - 6);
    ctx.font = "800 42px Arial, sans-serif";
    ctx.fillText("SLOW", w / 2, h / 2 + 72);
  });
  const slowMaterial = new THREE.MeshBasicMaterial({
    map: slowTexture,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
  });
  const slow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), slowMaterial);
  slow.rotation.x = -Math.PI / 2;
  slow.position.set(-2.15, 0.022, 18);
  scene.add(slow);
}

function createWetStreetDetails() {
  const sheenTexture = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "rgba(45,244,237,0.08)");
    grad.addColorStop(0.45, "rgba(255,255,255,0.12)");
    grad.addColorStop(0.68, "rgba(255,47,109,0.08)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 120; i += 1) {
      ctx.fillStyle = `rgba(255,255,255,${0.05 + rng() * 0.12})`;
      ctx.fillRect(rng() * w, rng() * h, 24 + rng() * 90, 1 + rng() * 3);
    }
  });
  sheenTexture.wrapS = THREE.RepeatWrapping;
  sheenTexture.wrapT = THREE.RepeatWrapping;
  sheenTexture.repeat.set(1.6, 18);

  const sheen = new THREE.Mesh(
    new THREE.PlaneGeometry(world.roadHalfWidth * 1.72, world.streetMaxZ - world.streetMinZ + 36),
    new THREE.MeshBasicMaterial({
      map: sheenTexture,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  sheen.rotation.x = -Math.PI / 2;
  sheen.position.set(0, 0.031, (world.streetMaxZ + world.streetMinZ) / 2);
  scene.add(sheen);

  const puddleTexture = canvasTexture(256, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 4, w * 0.5, h * 0.5, w * 0.48);
    grad.addColorStop(0, "rgba(190,255,250,0.24)");
    grad.addColorStop(0.46, "rgba(255,77,130,0.12)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.13)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i += 1) {
      ctx.beginPath();
      ctx.ellipse(w * (0.34 + rng() * 0.32), h * (0.38 + rng() * 0.22), 24 + rng() * 42, 5 + rng() * 12, rng() * Math.PI, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  for (let i = 0; i < 18; i += 1) {
    const puddle = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8 + rng() * 1.9, 0.24 + rng() * 0.7),
      new THREE.MeshBasicMaterial({
        map: puddleTexture,
        color: rng() > 0.5 ? 0x7ffcff : 0xff6a9a,
        transparent: true,
        opacity: 0.26 + rng() * 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    puddle.rotation.x = -Math.PI / 2;
    puddle.rotation.z = (rng() - 0.5) * 0.35;
    puddle.position.set((rng() - 0.5) * world.roadHalfWidth * 1.55, 0.037, world.streetMinZ + 6 + rng() * (world.streetMaxZ - world.streetMinZ - 12));
    scene.add(puddle);
  }
}

function createBakedLightField() {
  const colors = [0x2df4ed, 0xff2f6d, 0xffd36d, 0xb8f7ff];
  const bakeTexture = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w * 0.5);
    grad.addColorStop(0, "rgba(255,255,255,0.52)");
    grad.addColorStop(0.28, "rgba(255,255,255,0.2)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });

  for (let i = 0; i < 18; i += 1) {
    const lightPatch = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4 + rng() * 3.8, 1.1 + rng() * 2.4),
      new THREE.MeshBasicMaterial({
        map: bakeTexture,
        color: colors[i % colors.length],
        transparent: true,
        opacity: 0.18 + rng() * 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    lightPatch.rotation.x = -Math.PI / 2;
    lightPatch.rotation.z = (rng() - 0.5) * 0.55;
    lightPatch.position.set((rng() - 0.5) * world.roadHalfWidth * 1.7, 0.044, world.streetMinZ + 6 + rng() * (world.streetMaxZ - world.streetMinZ - 12));
    scene.add(lightPatch);
  }

  const vignetteTexture = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.12, w / 2, h / 2, w * 0.62);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.55, "rgba(0,0,0,0.02)");
    grad.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  const bakedOcclusion = new THREE.Mesh(
    new THREE.PlaneGeometry(world.roadHalfWidth * 1.9, world.streetMaxZ - world.streetMinZ + 36),
    new THREE.MeshBasicMaterial({
      map: vignetteTexture,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    }),
  );
  bakedOcclusion.rotation.x = -Math.PI / 2;
  bakedOcclusion.position.set(0, 0.047, (world.streetMaxZ + world.streetMinZ) / 2);
  scene.add(bakedOcclusion);
}

function createBuildings(side) {
  const baseX = side * 9.05;
  let z = world.streetMinZ - 6;
  let index = 0;
  while (z < world.streetMaxZ + 10) {
    const width = 9 + rng() * 7;
    const depth = 5 + rng() * 3;
    const height = 13 + rng() * 28;
    const x = baseX + side * depth * 0.45;
    const centerZ = z + width * 0.5;

    const facade = createFacadeMaterial(index, side, height);
    const building = new THREE.Mesh(new THREE.BoxGeometry(depth, height, width), facade);
    building.position.set(x, height / 2, centerZ);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);
    addAtlasFacadeDetails(side, x - side * (depth / 2 + 0.025), centerZ, width, height, index);

    if (rng() > 0.52) {
      addShopfront(side, x - side * (depth / 2 + 0.015), centerZ, width, index);
    }
    if (rng() > 0.52) {
      addVerticalSign(side, x - side * (depth / 2 + 0.05), centerZ + (rng() - 0.5) * width * 0.45, 3.8 + rng() * 6, index);
    }
    if (rng() > 0.7) {
      addBalconies(side, x - side * (depth / 2 + 0.1), centerZ, width, height);
    }
    if (rng() > 0.78) {
      addAirConditioners(side, x - side * (depth / 2 + 0.16), centerZ, width, height);
    }

    z += width + 2.7 + rng() * 3.8;
    index += 1;
  }
}

function createPhotoFacadeCards(side) {
  for (let i = 0; i < 3; i += 1) {
    const texture = atlasTexture(i % 2 === 0 ? atlasPanels.concreteWall : atlasPanels.neonCluster);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      color: side < 0 ? 0xc8fffb : 0xffd2dc,
      transparent: true,
      opacity: 0.2 + rng() * 0.06,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const card = new THREE.Mesh(new THREE.PlaneGeometry(8 + rng() * 4, 7 + rng() * 4), material);
    card.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    card.position.set(side * (7.65 + rng() * 0.45), 7.0 + rng() * 4.4, world.streetMinZ + 16 + i * 39 + rng() * 5);
    card.renderOrder = -1;
    scene.add(card);
  }
}

function addAtlasFacadeDetails(side, x, z, width, height, index) {
  const panelChoices = [
    atlasPanels.neonCluster,
    atlasPanels.cableWall,
    atlasPanels.acUnits,
    atlasPanels.wallPosters,
    atlasPanels.verticalSign,
  ];
  const count = clamp(Math.floor(height / 11), 1, 3);
  for (let i = 0; i < count; i += 1) {
    const panel = panelChoices[(index + i) % panelChoices.length];
    const material = atlasMaterial(panel, {
      color: side < 0 ? 0xd9fffb : 0xffd8e4,
      roughness: 0.42,
      metalness: 0.12,
      emissive: i === 0 ? (side < 0 ? 0x062d2a : 0x300914) : 0x000000,
      emissiveIntensity: i === 0 ? 0.16 : 0,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    });
    const h = 1.2 + rng() * 2.8;
    const w = Math.min(width * 0.54, 1.4 + rng() * 2.4);
    const detail = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    detail.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    detail.position.set(x, 2.2 + rng() * Math.max(2, height - 5), z + (rng() - 0.5) * width * 0.55);
    detail.renderOrder = 2;
    scene.add(detail);
  }
}

function createFacadeMaterial(index, side, height) {
  if (!visualMode.generatedScene) {
    const material = atlasMaterial(index % 3 === 0 ? atlasPanels.concreteWall : atlasPanels.tileWall, {
      color: side < 0 ? 0x9bb8ba : 0xb6a3aa,
      roughness: 0.7,
      metalness: 0.08,
      emissive: side < 0 ? 0x061d20 : 0x240a12,
      emissiveIntensity: 0.22,
    });
    material.normalScale = new THREE.Vector2(0.45, 0.45);
    return material;
  }

  const palettes = [
    ["#24313a", "#475763", "#f6d384"],
    ["#1f272d", "#5a5f63", "#bfe4ff"],
    ["#2d3035", "#62686e", "#ffd7a0"],
    ["#20252a", "#3d4d52", "#a9fff6"],
  ];
  const palette = palettes[index % palettes.length];
  const texture = canvasTexture(512, 1024, (ctx, w, h) => {
    ctx.fillStyle = palette[0];
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.045)";
    for (let y = 0; y < h; y += 64) {
      ctx.fillRect(0, y, w, 2);
    }
    for (let x = 0; x < w; x += 72) {
      ctx.fillRect(x, 0, 2, h);
    }
    const rows = Math.max(6, Math.floor(height * 0.45));
    const cols = 4 + Math.floor(rng() * 3);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const lit = rng() > 0.42;
        const wx = 28 + col * ((w - 56) / cols);
        const wy = 30 + row * ((h - 72) / rows);
        ctx.fillStyle = lit ? palette[2] : palette[1];
        ctx.globalAlpha = lit ? 0.7 + rng() * 0.25 : 0.42;
        ctx.fillRect(wx, wy, 32 + rng() * 12, 24 + rng() * 12);
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = side < 0 ? "rgba(56, 235, 220, 0.06)" : "rgba(255, 44, 92, 0.06)";
    ctx.fillRect(0, 0, w, h);
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, Math.max(1, height / 18));

  return new THREE.MeshStandardMaterial({
    color: 0xd2dae1,
    map: texture,
    roughness: 0.47,
    metalness: 0.12,
    emissive: new THREE.Color(side < 0 ? 0x10292b : 0x2b1015),
    emissiveIntensity: 0.16,
  });
}

function addShopfront(side, x, z, width, index) {
  const signs = [
    ["金記燒味", "ROAST HOUSE", "#e7334d", "#ffd68b"],
    ["港島藥房", "PHARMACY", "#17b8ba", "#f4fbff"],
    ["新都會", "ARCADE", "#ffdf68", "#1a1d21"],
    ["茶餐廳", "CAFE", "#e9f1ef", "#1b2b2f"],
    ["手機維修", "MOBILE", "#54dca5", "#06100e"],
    ["霓虹便利", "MART", "#e84b8a", "#fff2b0"],
  ];
  const signData = signs[index % signs.length];
  const storefront = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.min(5.0, width * 0.78), 2.15),
    closeStreetMaterial(index % 2 === 0 ? closeStreetPanels.shopInterior : closeStreetPanels.shutter, {
      color: index % 2 === 0 ? 0xffedd5 : 0xd8efed,
      roughness: index % 2 === 0 ? 0.26 : 0.42,
      metalness: index % 2 === 0 ? 0.14 : 0.36,
      emissive: index % 2 === 0 ? 0x2d1605 : 0x061f22,
      emissiveIntensity: index % 2 === 0 ? 0.22 : 0.1,
      side: THREE.DoubleSide,
    }),
  );
  storefront.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  storefront.position.set(x - side * 0.015, 1.45, z);
  scene.add(storefront);

  const signTexture = createSignTexture(signData[0], signData[1], signData[2], signData[3], 512, 192);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.min(5.2, width * 0.74), 1.05),
    trackNeonMaterial(new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, toneMapped: false })),
  );
  sign.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  sign.position.set(x, 3.2, z);
  scene.add(sign);

  const shutter = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 2.1, Math.min(4.8, width * 0.68)),
    index % 2 === 0 ? materials.closeDoorFrame : materials.closeShutter,
  );
  shutter.position.set(x + side * 0.05, 1.25, z);
  shutter.castShadow = true;
  shutter.receiveShadow = true;
  scene.add(shutter);

  addBudgetPointLight(signData[2], 0.65, 8, 2, x - side * 0.8, 3.0, z);

  addGroundReflection(x - side * 1.0, z, signData[2], Math.min(5.2, width * 0.7), 2.2, side);
}

function addVerticalSign(side, x, z, y, index) {
  const signs = [
    ["旺角", "MONG KOK", "#fd3456", "#ffe8a1"],
    ["雨夜", "NIGHT RAIN", "#18d8d2", "#f0ffff"],
    ["電器", "ELECTRIC", "#ffdc5f", "#151413"],
    ["港式", "HK STYLE", "#ef62a7", "#fff4c7"],
    ["灣仔", "WAN CHAI", "#32d48d", "#071713"],
  ];
  const signData = signs[(index + 2) % signs.length];
  const texture = createSignTexture(signData[0], signData[1], signData[2], signData[3], 256, 640, true);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.08, 3.8),
    trackNeonMaterial(new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, side: THREE.DoubleSide })),
  );
  sign.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  sign.position.set(x - side * 0.22, y, z);
  scene.add(sign);

  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x262b30, roughness: 0.42, metalness: 0.5 }),
  );
  arm.rotation.y = Math.PI / 2;
  arm.position.set(x + side * 0.45, y + 1.6, z);
  arm.castShadow = true;
  scene.add(arm);

  addBudgetPointLight(signData[2], 0.75, 9, 2, x - side * 0.8, y, z);
  addGroundReflection(x - side * 1.1, z, signData[2], 2.4, 1.8, side);
}

function addBalconies(side, x, z, width, height) {
  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0x6d737a,
    roughness: 0.3,
    metalness: 0.55,
  });
  const floors = Math.min(8, Math.floor(height / 3));
  for (let i = 2; i < floors; i += 2) {
    const balcony = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, Math.min(width * 0.55, 4)), railMaterial);
    balcony.position.set(x - side * 0.22, i * 2.65, z + (rng() - 0.5) * width * 0.22);
    balcony.castShadow = true;
    scene.add(balcony);
  }
}

function addAirConditioners(side, x, z, width, height) {
  const acMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9dde1,
    roughness: 0.5,
    metalness: 0.18,
  });
  const count = 2 + Math.floor(rng() * 5);
  for (let i = 0; i < count; i += 1) {
    const ac = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.58), acMaterial);
    ac.position.set(x - side * 0.15, 4 + rng() * Math.max(3, height - 7), z + (rng() - 0.5) * width * 0.7);
    ac.castShadow = true;
    scene.add(ac);
  }
}

function createOverheadSigns() {
  const data = [
    [40, "港式霓虹街", "HONG KONG NIGHT", "#18d8d2"],
    [-31, "彌敦道", "NATHAN ROAD", "#ffdb68"],
    [-7, "港鐵", "MTR ISLAND LINE", "#ff344c"],
    [26, "中環碼頭", "CENTRAL FERRY", "#18d8d2"],
  ];
  for (const [z, main, sub, color] of data) {
    const texture = createSignTexture(main, sub, color, "#fff4cf", 768, 256);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.9, 1.25),
      trackNeonMaterial(new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, side: THREE.DoubleSide })),
    );
    sign.position.set(0, 5.2, z);
    scene.add(sign);

    const frame = createNeonFrame(5.15, 1.44, 0.08);
    frame.position.set(0, 5.2, z + 0.07);
    scene.add(frame);

    addBudgetPointLight(color, 1.1, 11, 2, 0, 4.7, z - 0.8);
    addGroundReflection(0, z - 0.9, color, 5.6, 4.2, 1);
  }
}

function createOverheadCables() {
  const cableMaterial = new THREE.MeshStandardMaterial({
    color: 0x07090b,
    roughness: 0.44,
    metalness: 0.28,
  });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0x2df4ed,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  for (let z = world.streetMinZ + 12; z < world.streetMaxZ - 3; z += 18) {
    const y = 4.5 + rng() * 3.2;
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 14 + rng() * 3, 8), cableMaterial);
    cable.rotation.z = Math.PI / 2;
    cable.rotation.y = (rng() - 0.5) * 0.22;
    cable.position.set(0, y, z);
    cable.castShadow = true;
    scene.add(cable);

    if (rng() > 0.5) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.2 + rng(), 8), glowMaterial);
      tube.rotation.z = Math.PI / 2;
      tube.position.set((rng() - 0.5) * 5.5, y - 0.18, z + (rng() - 0.5) * 0.6);
      scene.add(tube);
    }
  }
}

function createOpeningNeon() {
  const nearSigns = [
    [-5.95, 38, -1, "霓虹茶餐廳", "LATE CAFE", "#ff365d"],
    [5.95, 35, 1, "港島藥房", "24H PHARMACY", "#24d8cf"],
    [-5.95, 29, -1, "手機維修", "REPAIR", "#ffdf68"],
    [5.95, 45, 1, "夜雨便利", "MART", "#54dca5"],
  ];
  for (const [x, z, side, main, sub, color] of nearSigns) {
    const texture = createSignTexture(main, sub, color, "#fff7d6", 640, 210);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.45, 1.05),
      trackNeonMaterial(new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, side: THREE.DoubleSide })),
    );
    sign.position.set(x, 3.4, z);
    sign.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    scene.add(sign);

    addBudgetPointLight(color, 0.9, 8, 2, x - side * 0.9, 3.2, z);
    addGroundReflection(x - side * 1.2, z, color, 3.9, 2.8, side);
  }
}

function createNeonFrame(width, height, depth) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0x15191d,
    roughness: 0.28,
    metalness: 0.72,
  });
  const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, depth), material);
  top.position.y = height / 2;
  const bottom = top.clone();
  bottom.position.y = -height / 2;
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.08, height, depth), material);
  left.position.x = -width / 2;
  const right = left.clone();
  right.position.x = width / 2;
  for (const part of [top, bottom, left, right]) {
    part.castShadow = true;
    group.add(part);
  }
  return group;
}

function createStreetProps() {
  const parkedTaxiA = createTaxi(-4.25, 29, -0.12);
  parkedTaxiA.scale.setScalar(0.48);
  const parkedTaxiB = createTaxi(4.1, -45, Math.PI + 0.05);
  parkedTaxiB.scale.setScalar(0.48);
  createMovingTraffic();
  createMtrEntrance(6.75, -18, -1);
  createBusStop(-6.75, 7, 1);

  for (let z = -66; z < 44; z += 26) {
    addStreetLamp(-5.55, z + rng() * 4, 1);
    addStreetLamp(5.55, z + 7 + rng() * 4, -1);
  }

  for (let i = 0; i < 8; i += 1) {
    const side = rng() > 0.5 ? 1 : -1;
    createStreetBin(side * (5.9 + rng() * 1.1), -72 + rng() * 112, side);
  }
}

function createStreetBin(x, z, side) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = side > 0 ? -0.08 : 0.08;

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.78, 0.5), materials.streetBin);
  body.position.y = 0.48;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.08, 0.58),
    new THREE.MeshStandardMaterial({ color: 0x151a1c, roughness: 0.38, metalness: 0.42 }),
  );
  lid.position.y = 0.9;
  lid.castShadow = true;
  group.add(lid);

  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), materials.streetBinLabel);
  label.position.set(0, 0.58, side > 0 ? -0.256 : 0.256);
  label.rotation.y = side > 0 ? Math.PI : 0;
  group.add(label);

  scene.add(group);
}

function createMovingTraffic() {
  const lanes = [
    { x: -3.18, z: -74, rotation: 0, speed: 4.4 },
    { x: 3.08, z: 3, rotation: Math.PI, speed: -3.8 },
    { x: -2.82, z: -38, rotation: 0.02, speed: 2.8 },
  ];
  for (const lane of lanes) {
    const car = createTaxi(lane.x, lane.z, lane.rotation);
    car.scale.setScalar(0.42);
    addLensGlow(car, 0xffe2a9, [-0.42, 0.72, -1.82], 0.1, 0.72);
    addLensGlow(car, 0xffe2a9, [0.42, 0.72, -1.82], 0.1, 0.72);
    addLensGlow(car, 0xff2f6d, [-0.42, 0.72, 1.68], 0.08, 0.62);
    addLensGlow(car, 0xff2f6d, [0.42, 0.72, 1.68], 0.08, 0.62);
    streetLife.traffic.push({ group: car, speed: lane.speed, minZ: world.streetMinZ - 20, maxZ: world.streetMaxZ + 18 });
  }
}

function createTaxi(x, z, rotation) {
  const car = new THREE.Group();
  car.position.set(x, 0.04, z);
  car.rotation.y = rotation;

  const base = new THREE.Mesh(roundedBox(1.75, 0.55, 3.35, 0.18, 4), materials.redTaxi);
  base.position.y = 0.55;
  base.castShadow = true;
  base.receiveShadow = true;
  car.add(base);

  const cabin = new THREE.Mesh(roundedBox(1.48, 0.68, 1.55, 0.16, 4), materials.taxi);
  cabin.position.set(0, 1.03, -0.16);
  cabin.castShadow = true;
  cabin.receiveShadow = true;
  car.add(cabin);

  const windscreen = new THREE.Mesh(roundedBox(1.34, 0.5, 0.08, 0.035, 3), materials.glass);
  windscreen.position.set(0, 1.06, -0.98);
  car.add(windscreen);

  const taxiSignTexture = createSignTexture("的士", "TAXI", "#ffe36d", "#141411", 256, 128);
  const taxiSign = new THREE.Mesh(
    roundedBox(0.68, 0.12, 0.32, 0.035, 3),
    trackNeonMaterial(new THREE.MeshBasicMaterial({ map: taxiSignTexture, toneMapped: false }), 0.92),
  );
  taxiSign.position.set(0, 1.42, -0.16);
  if (!visualMode.photoDominant) car.add(taxiSign);

  for (const sx of [-0.78, 0.78]) {
    for (const sz of [-1.12, 1.12]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.22, 18), materials.blackRubber);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx, 0.35, sz);
      wheel.castShadow = true;
      car.add(wheel);
    }
  }

  const headlightMaterial = new THREE.MeshBasicMaterial({ color: 0xfff4c2, toneMapped: false });
  for (const sx of [-0.48, 0.48]) {
    const light = new THREE.Mesh(roundedBox(0.28, 0.12, 0.05, 0.025), headlightMaterial);
    light.position.set(sx, 0.58, -1.7);
    car.add(light);
  }

  scene.add(car);
  return car;
}

function createMtrEntrance(x, z, side) {
  const group = new THREE.Group();
  group.position.set(x, 0.04, z);
  group.rotation.y = side > 0 ? Math.PI : 0;

  const stair = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.18, 2.8),
    new THREE.MeshStandardMaterial({ color: 0x1f262a, roughness: 0.34, metalness: 0.2 }),
  );
  stair.position.y = 0.16;
  stair.castShadow = true;
  group.add(stair);

  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(2.7, 0.18, 1.15),
    new THREE.MeshStandardMaterial({ color: 0xdfe5e9, roughness: 0.22, metalness: 0.32 }),
  );
  canopy.position.set(0, 2.15, -0.55);
  canopy.castShadow = true;
  group.add(canopy);

  const posts = [-1.04, 1.04];
  for (const px of posts) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 2.05, 12),
      new THREE.MeshStandardMaterial({ color: 0xdfe5e9, roughness: 0.3, metalness: 0.5 }),
    );
    post.position.set(px, 1.1, -0.55);
    post.castShadow = true;
    group.add(post);
  }

  const signTexture = createSignTexture("港鐵", "MTR", "#e33340", "#ffffff", 384, 160);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 0.72),
    trackNeonMaterial(new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, toneMapped: false, side: THREE.DoubleSide })),
  );
  sign.position.set(0, 1.65, -1.17);
  group.add(sign);

  addBudgetPointLight(0xe33340, 0.7, 7, 2, x - side * 0.8, 2.0, z - 0.4);
  scene.add(group);
}

function createBusStop(x, z, side) {
  const group = new THREE.Group();
  group.position.set(x, 0.08, z);
  group.rotation.y = side > 0 ? Math.PI : 0;

  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.45, 0.08), materials.glass);
  glass.position.set(0, 1.05, 0);
  group.add(glass);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.16, 1.05),
    new THREE.MeshStandardMaterial({ color: 0x20282d, roughness: 0.34, metalness: 0.4 }),
  );
  roof.position.set(0, 1.9, -0.2);
  roof.castShadow = true;
  group.add(roof);

  const adTexture = createSignTexture("夜航", "HARBOUR", "#18d8d2", "#f7ffff", 256, 512, true);
  const ad = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 1.25),
    trackNeonMaterial(new THREE.MeshBasicMaterial({ map: adTexture, transparent: true, toneMapped: false }), 0.88),
  );
  ad.position.set(-1.05, 1.05, -0.08);
  group.add(ad);

  scene.add(group);
}

function addStreetLamp(x, z, side) {
  const group = new THREE.Group();
  group.position.set(x, 0.05, z);
  const postMaterial = new THREE.MeshStandardMaterial({ color: 0x2c3236, roughness: 0.28, metalness: 0.55 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 4.6, 12), postMaterial);
  post.position.y = 2.3;
  post.castShadow = true;
  group.add(post);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.08, 0.08), postMaterial);
  arm.position.set(-side * 0.48, 4.45, 0);
  arm.castShadow = true;
  group.add(arm);

  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe8bc, toneMapped: false }),
  );
  lamp.position.set(-side * 1.02, 4.36, 0);
  group.add(lamp);

  addBudgetPointLight(0xffd6a0, 0.48, 8, 2.2, x - side * 1.02, 4.28, z);
  scene.add(group);
}

function createHarbourBackdrop() {
  const skylineMaterial = new THREE.MeshStandardMaterial({
    color: 0x101820,
    roughness: 0.52,
    metalness: 0.08,
    emissive: 0x07131a,
    emissiveIntensity: 0.3,
  });
  for (let i = 0; i < 16; i += 1) {
    const height = 11 + rng() * 28;
    const width = 3.5 + rng() * 6;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(width, height, 3 + rng() * 5), skylineMaterial);
    tower.position.set(-45 + i * 6.0 + rng() * 2, height / 2 - 1, -102 - rng() * 28);
    scene.add(tower);
  }

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(110, 38),
    new THREE.MeshStandardMaterial({
      color: 0x091923,
      roughness: 0.16,
      metalness: 0.36,
      transparent: true,
      opacity: 0.72,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(-6, -0.08, -102);
  scene.add(water);
}

function createSignTexture(main, sub, bg, fg, width, height, vertical = false) {
  return canvasTexture(width, height, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, shade(bg, 0.25));
    gradient.addColorStop(0.55, bg);
    gradient.addColorStop(1, shade(bg, -0.35));
    ctx.fillStyle = gradient;
    roundedRect(ctx, 8, 8, w - 16, h - 16, 18);
    ctx.fill();
    ctx.save();
    roundedRect(ctx, 8, 8, w - 16, h - 16, 18);
    ctx.clip();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1;
    for (let y = 18; y < h - 14; y += 9) {
      ctx.beginPath();
      ctx.moveTo(14, y + rng() * 2);
      ctx.lineTo(w - 14, y + rng() * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.24)";
    for (let i = 0; i < 7; i += 1) {
      const startX = 24 + rng() * (w - 48);
      const startY = 18 + rng() * (h - 36);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      let x = startX;
      let y = startY;
      for (let j = 0; j < 4; j += 1) {
        x += (rng() - 0.5) * w * 0.16;
        y += (rng() - 0.5) * h * 0.18;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    for (let i = 0; i < 240; i += 1) {
      ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 2, 1);
    }
    ctx.restore();
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(255,255,255,0.68)";
    ctx.stroke();

    ctx.shadowBlur = 18;
    ctx.shadowColor = fg;
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (vertical) {
      ctx.font = `900 ${Math.floor(w * 0.31)}px Arial, sans-serif`;
      const chars = main.split("");
      chars.forEach((char, i) => {
        ctx.fillText(char, w / 2, h * 0.18 + i * h * 0.16);
      });
      ctx.font = `800 ${Math.floor(w * 0.11)}px Arial, sans-serif`;
      ctx.fillText(sub, w / 2, h * 0.86);
    } else {
      ctx.font = `900 ${Math.floor(h * 0.34)}px Arial, sans-serif`;
      ctx.fillText(main, w / 2, h * 0.42);
      ctx.font = `800 ${Math.floor(h * 0.16)}px Arial, sans-serif`;
      ctx.fillText(sub, w / 2, h * 0.72);
    }
    ctx.shadowBlur = 0;
  });
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shade(hex, amount) {
  const c = new THREE.Color(hex);
  if (amount > 0) c.lerp(new THREE.Color(0xffffff), amount);
  else c.lerp(new THREE.Color(0x000000), Math.abs(amount));
  return `#${c.getHexString()}`;
}

function trackNeonMaterial(material, baseOpacity = 1) {
  material.transparent = true;
  streetLife.neonMaterials.push({
    material,
    baseOpacity,
    phase: rng() * Math.PI * 2,
    tempo: 1.4 + rng() * 2.2,
  });
  return material;
}

function addBudgetPointLight(color, intensity, distance, decay, x, y, z, parent = scene) {
  if (scenePointLightCount >= renderSettings.maxScenePointLights) return null;
  scenePointLightCount += 1;
  const light = new THREE.PointLight(color, intensity, distance, decay);
  light.position.set(x, y, z);
  parent.add(light);
  return light;
}

function addLensGlow(parent, color, position, scale = 0.18, opacity = 0.75) {
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(scale, 12, 8),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  glow.position.set(position[0], position[1], position[2]);
  parent.add(glow);
  return glow;
}

function addGroundReflection(x, z, color, width, depth, side) {
  const texture = canvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.48);
    grad.addColorStop(0, "rgba(255,255,255,0.52)");
    grad.addColorStop(0.38, "rgba(255,255,255,0.18)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  const reflection = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({
      map: texture,
      color,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  reflection.rotation.x = -Math.PI / 2;
  reflection.rotation.z = side * (0.04 + rng() * 0.16);
  reflection.position.set(x, 0.026, z);
  scene.add(reflection);
}

function createContactShadow(width, depth, opacity) {
  const texture = canvasTexture(256, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.46);
    grad.addColorStop(0, `rgba(0, 0, 0, ${opacity})`);
    grad.addColorStop(0.55, `rgba(0, 0, 0, ${opacity * 0.32})`);
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.038;
  return shadow;
}

function makePart(parent, geometry, material, position, rotation = null) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function roundedBox(width, height, depth, radius = 0.035, segments = 3) {
  return new RoundedBoxGeometry(width, height, depth, segments, Math.min(radius, width * 0.45, height * 0.45, depth * 0.45));
}

async function attachRiggedActor(actor, options) {
  try {
    const gltf = await soldierModelPromise;
    if (actor.removed || (!actor.group.parent && actor !== player)) return;

    const root = SkeletonUtils.clone(gltf.scene);
    const palette = resolveActorPalette(options.role, options.level, options.palette);
    const accent = new THREE.Color(options.accent ?? palette.accent);
    const rigMaterials = [];

    root.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = false;
      node.material = Array.isArray(node.material)
        ? node.material.map((material) => material.clone())
        : node.material.clone();

      const materialsToTune = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materialsToTune) {
        if (material.color) material.color.setHex(palette.gltfColor);
        if ("map" in material) {
          material.map = actorCharacterTexture(palette.gltfPanel);
          material.needsUpdate = true;
        }
        if ("roughness" in material) material.roughness = palette.gltfRoughness ?? (options.role === "player" ? 0.22 : 0.32);
        if ("metalness" in material) material.metalness = palette.gltfMetalness ?? (options.role === "player" ? 0.44 : 0.48);
        if ("envMapIntensity" in material) material.envMapIntensity = palette.gltfEnv ?? (options.role === "player" ? 1.34 : 1.12);
        if (material.emissive) material.emissive.copy(accent).multiplyScalar(palette.gltfEmissiveBoost ?? 0.07);
        rigMaterials.push(material);
      }
    });

    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const height = Math.max(0.01, box.max.y - box.min.y);
    root.scale.setScalar(options.desiredHeight / height);
    root.updateMatrixWorld(true);
    box.setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    root.position.set(-center.x, -box.min.y, -center.z);
    root.rotation.y = Math.PI;

    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    for (const clip of gltf.animations) {
      actions[clip.name] = mixer.clipAction(clip);
    }

    const kit = createRiggedCyberKit(options.role, options.accent ?? palette.accent, options.secondaryAccent ?? palette.secondaryAccent, palette);
    actor.group.add(root);
    actor.group.add(kit);
    actor.gltfRoot = root;
    actor.mixer = mixer;
    actor.actions = actions;
    actor.currentAction = null;
    actor.currentActionName = "";
    actor.rigKit = kit;
    actor.rigWeapon = kit.userData.weapon;
    actor.rigMaterials = rigMaterials;
    actor.gltfBasePosition = root.position.clone();
    actor.model.visible = false;
    actor.billboard.group.visible = false;
    setActorAction(actor, "Idle", 0);
    animatedActors.push(actor);
  } catch (error) {
    console.warn("Rigged actor model failed to load", error);
  }
}

function createRiggedCyberKit(role, accentHex, secondaryAccentHex, visualPalette = null) {
  const kit = new THREE.Group();
  const palette = resolveActorPalette(role, 1, visualPalette);
  const neon = new THREE.MeshBasicMaterial({
    color: accentHex ?? palette.accent,
    transparent: true,
    opacity: 0.74,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const neonSecondary = new THREE.MeshBasicMaterial({
    color: secondaryAccentHex ?? palette.secondaryAccent,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: palette.metalColor,
    map: actorCharacterTexture(palette.metalPanel ?? characterCinematicPanels.gunmetal),
    roughness: 0.18,
    metalness: 0.82,
    envMapIntensity: 1.32,
    emissive: palette.emissive,
    emissiveIntensity: 0.12,
  });
  const armor = new THREE.MeshStandardMaterial({
    color: palette.armorColor,
    map: actorCharacterTexture(palette.armorPanel ?? characterCinematicPanels.enemyArmor),
    roughness: role === "player" ? 0.19 : 0.24,
    metalness: role === "player" ? 0.72 : 0.6,
    envMapIntensity: role === "player" ? 1.4 : 1.18,
    emissive: palette.emissive,
    emissiveIntensity: 0.16,
  });
  const coat = new THREE.MeshStandardMaterial({
    color: palette.coatColor,
    map: actorCharacterTexture(palette.coatPanel ?? characterCinematicPanels.tacticalFabric),
    roughness: role === "player" ? 0.22 : 0.46,
    metalness: role === "player" ? 0.3 : 0.16,
    envMapIntensity: 1.05,
    emissive: palette.emissive,
    emissiveIntensity: 0.12,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  });
  const deepCoat = new THREE.MeshStandardMaterial({
    color: palette.deepCoatColor,
    map: actorCharacterTexture(palette.deepCoatPanel ?? characterCinematicPanels.meshSuit),
    roughness: role === "player" ? 0.24 : 0.52,
    metalness: role === "player" ? 0.28 : 0.12,
    envMapIntensity: 0.94,
    emissive: palette.emissive,
    emissiveIntensity: 0.1,
  });
  const visorMaterial = new THREE.MeshStandardMaterial({
    color: palette.visorColor,
    map: actorCharacterTexture(palette.visorPanel ?? (role === "player" ? characterCinematicPanels.cyanVisor : characterCinematicPanels.magentaVisor)),
    roughness: 0.08,
    metalness: 0.58,
    envMapIntensity: 1.5,
    emissive: palette.accent,
    emissiveIntensity: role === "player" ? 0.95 : 0.9,
  });
  const rubber = new THREE.MeshStandardMaterial({
    color: palette.rubberColor,
    map: actorCharacterTexture(palette.rubberPanel ?? characterCinematicPanels.rubberGloves),
    roughness: 0.5,
    metalness: 0.12,
    envMapIntensity: 0.8,
  });
  const harness = new THREE.MeshStandardMaterial({
    color: palette.harnessColor,
    map: cinematicCharacterTexture(characterCinematicPanels.harness),
    roughness: 0.4,
    metalness: 0.24,
    envMapIntensity: 1.0,
  });
  const decals = new THREE.MeshStandardMaterial({
    color: palette.decalsColor,
    map: cinematicCharacterTexture(characterCinematicPanels.decals),
    roughness: 0.36,
    metalness: 0.22,
    envMapIntensity: 1.1,
    emissive: palette.decalEmissive ?? palette.emissive,
    emissiveIntensity: 0.045,
  });
  const bladeKit = new THREE.MeshStandardMaterial({
    color: palette.bladeColor ?? 0xf3fbff,
    map: cinematicCharacterTexture(characterCinematicPanels.bladeMetal),
    roughness: 0.12,
    metalness: 0.94,
    envMapIntensity: 1.5,
    emissive: role === "player" ? palette.accent : palette.secondaryAccent,
    emissiveIntensity: 0.24,
  });
  const swayParts = [];

  const add = (geometry, material, position, rotation = null, options = {}) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.baseRotation = mesh.rotation.clone();
    if (options.sway) swayParts.push(mesh);
    kit.add(mesh);
    return mesh;
  };

  const addMirrored = (geometry, material, x, y, z, rotation, mirrorRotation = true, options = {}) => {
    add(geometry, material, [-x, y, z], rotation ? [rotation[0], rotation[1], mirrorRotation ? -rotation[2] : rotation[2]] : null, options);
    add(geometry, material, [x, y, z], rotation ?? null, options);
  };

  add(new THREE.SphereGeometry(0.24, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.78), armor, [0, 1.93, 0.02], [0.06, 0, 0]);
  add(roundedBox(0.44, 0.17, 0.18, 0.055), rubber, [0, 1.83, 0.05]);
  add(roundedBox(0.38, 0.07, 0.055, 0.028), visorMaterial, [0, 1.91, 0.238]);
  add(roundedBox(0.24, 0.13, 0.08, 0.03), metal, [0, 1.78, 0.24]);
  addMirrored(new THREE.CylinderGeometry(0.052, 0.052, 0.05, 16), metal, 0.24, 1.9, 0.06, [0, 0, Math.PI / 2], false);

  add(roundedBox(0.6, 0.64, 0.12, 0.08), armor, [0, 1.3, 0.42], [-0.08, 0, 0]);
  add(roundedBox(0.2, 0.52, 0.08, 0.04), metal, [-0.23, 1.27, 0.47], [-0.05, 0, 0.08]);
  add(roundedBox(0.2, 0.52, 0.08, 0.04), metal, [0.23, 1.27, 0.47], [-0.05, 0, -0.08]);
  add(roundedBox(0.44, 0.54, 0.065, 0.045), deepCoat, [0, 1.22, -0.34], [0.08, 0, 0]);
  add(roundedBox(0.08, 0.64, 0.06, 0.024), harness, [0, 1.26, -0.43]);
  add(roundedBox(0.68, 0.075, 0.08, 0.025), harness, [0, 1.04, 0.43], [-0.04, 0, 0]);
  add(roundedBox(0.5, 0.065, 0.06, 0.02), harness, [0, 1.55, 0.43], [-0.08, 0, 0]);
  add(roundedBox(0.18, 0.075, 0.035, 0.014), decals, [-0.16, 1.61, 0.49], [-0.08, 0, -0.04]);
  add(roundedBox(0.16, 0.07, 0.035, 0.014), decals, [0.17, 1.02, 0.49], [-0.04, 0, 0.05]);

  addMirrored(roundedBox(0.4, 0.18, 0.6, 0.07), armor, 0.5, 1.52, 0.01, [0, 0, 0.18]);
  addMirrored(new THREE.CapsuleGeometry(0.075, 0.48, 5, 12), metal, 0.62, 1.11, 0.13, [0.16, 0, 0.18]);
  addMirrored(roundedBox(0.18, 0.26, 0.18, 0.055), rubber, 0.66, 0.82, 0.18, [0.08, 0, 0.08]);
  addMirrored(new THREE.CapsuleGeometry(0.085, 0.45, 5, 12), armor, 0.2, 0.48, 0.12, [0.04, 0, 0.04]);
  addMirrored(roundedBox(0.24, 0.17, 0.44, 0.06), rubber, 0.19, 0.14, 0.18, [0, 0, 0.02]);

  add(roundedBox(0.2, 0.86, 0.055, 0.03), deepCoat, [-0.24, 0.66, 0.32], [-0.1, 0.06, 0.1], { sway: true });
  add(roundedBox(0.2, 0.86, 0.055, 0.03), deepCoat, [0.24, 0.66, 0.32], [-0.1, -0.06, -0.1], { sway: true });
  add(roundedBox(0.3, 0.94, 0.07, 0.035), coat, [0, 0.68, -0.36], [0.12, 0, 0], { sway: true });
  add(roundedBox(0.18, 0.08, 0.035, 0.016), decals, [0.0, 0.94, -0.42], [0.12, 0, 0]);
  add(roundedBox(0.085, 0.68, 0.035, 0.018), neon, [0, 1.34, 0.49]);
  add(roundedBox(0.46, 0.055, 0.035, 0.018), role === "player" ? neon : neonSecondary, [0, 1.76, 0.31]);
  add(roundedBox(0.03, 0.76, 0.03, 0.013), neonSecondary, [-0.31, 1.22, 0.43], [0, 0, -0.1]);
  add(roundedBox(0.03, 0.76, 0.03, 0.013), neon, [0.31, 1.22, 0.43], [0, 0, 0.1]);

  add(roundedBox(0.36, 0.46, 0.05, 0.04), armor, [0, 1.32, 0.51], [-0.08, 0, 0]);
  add(roundedBox(0.19, 0.38, 0.055, 0.028), coat, [-0.18, 0.66, 0.39], [-0.08, 0.04, 0.08], { sway: true });
  add(roundedBox(0.19, 0.38, 0.055, 0.028), coat, [0.18, 0.66, 0.39], [-0.08, -0.04, -0.08], { sway: true });
  add(roundedBox(0.085, 0.68, 0.035, 0.018), neon, [0, 1.34, 0.43]);
  add(roundedBox(0.42, 0.055, 0.035, 0.018), role === "player" ? neon : neonSecondary, [0, 1.78, 0.27]);
  add(roundedBox(0.03, 0.76, 0.03, 0.013), neonSecondary, [-0.26, 1.22, 0.37], [0, 0, -0.1]);
  add(roundedBox(0.03, 0.76, 0.03, 0.013), neon, [0.26, 1.22, 0.37], [0, 0, 0.1]);

  const weapon = new THREE.Group();
  if (role === "player") {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 10), metal);
    handle.rotation.x = Math.PI / 2;
    weapon.add(handle);
    const blade = new THREE.Mesh(roundedBox(0.05, 0.065, 1.42, 0.018), bladeKit);
    blade.position.z = 0.75;
    blade.castShadow = true;
    weapon.add(blade);
    const edge = new THREE.Mesh(roundedBox(0.014, 0.078, 1.34, 0.006), neon);
    edge.position.set(0.034, 0, 0.78);
    weapon.add(edge);
    weapon.position.set(0.55, 0.98, 0.18);
    weapon.rotation.set(-0.56, -0.64, -0.18);
  } else {
    const baton = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.92, 12), metal);
    baton.rotation.x = Math.PI / 2;
    weapon.add(baton);
    const tip = new THREE.Mesh(roundedBox(0.12, 0.12, 0.08, 0.035), neonSecondary);
    tip.position.z = 0.48;
    weapon.add(tip);
    weapon.position.set(-0.5, 0.96, 0.2);
    weapon.rotation.set(-0.12, 0.2, -0.18);
  }
  weapon.userData.basePosition = weapon.position.clone();
  weapon.userData.baseRotation = weapon.rotation.clone();
  kit.add(weapon);
  kit.userData.weapon = weapon;
  kit.userData.glowMaterials = [neon, neonSecondary];
  kit.userData.swayParts = swayParts;
  kit.scale.set(role === "player" ? 0.62 : 0.5, role === "player" ? 0.86 : 0.72, role === "player" ? 0.66 : 0.52);
  kit.position.y = role === "player" ? 0.15 : 0.04;
  return kit;
}

function setActorAction(actor, actionName, fade = 0.18) {
  if (!actor.actions) return;
  const next = actor.actions[actionName] || actor.actions.Idle || Object.values(actor.actions)[0];
  if (!next || actor.currentAction === next) return;

  next.enabled = true;
  next.timeScale = actionName === "Run" ? 1.18 : actionName === "Walk" ? 1.1 : 1;
  next.reset().fadeIn(fade).play();
  if (actor.currentAction) actor.currentAction.fadeOut(fade);
  actor.currentAction = next;
  actor.currentActionName = actionName;
}

function resetRiggedWeapon(actor, dt) {
  const weapon = actor.rigWeapon;
  if (!weapon) return;
  const basePosition = weapon.userData.basePosition;
  const baseRotation = weapon.userData.baseRotation;
  weapon.position.lerp(basePosition, 1 - Math.exp(-14 * dt));
  weapon.rotation.x = damp(weapon.rotation.x, baseRotation.x, 14, dt);
  weapon.rotation.y = damp(weapon.rotation.y, baseRotation.y, 14, dt);
  weapon.rotation.z = damp(weapon.rotation.z, baseRotation.z, 14, dt);
}

function resetRiggedPose(actor, dt) {
  if (actor.gltfRoot) {
    actor.gltfRoot.position.x = damp(actor.gltfRoot.position.x, actor.gltfBasePosition?.x ?? 0, 12, dt);
    actor.gltfRoot.position.z = damp(actor.gltfRoot.position.z, actor.gltfBasePosition?.z ?? 0, 12, dt);
    actor.gltfRoot.rotation.x = damp(actor.gltfRoot.rotation.x, 0, 12, dt);
    actor.gltfRoot.rotation.z = damp(actor.gltfRoot.rotation.z, 0, 12, dt);
  }
  if (actor.rigKit) {
    actor.rigKit.rotation.x = damp(actor.rigKit.rotation.x, 0, 12, dt);
    actor.rigKit.rotation.z = damp(actor.rigKit.rotation.z, 0, 12, dt);
  }
}

function applyPlayerAttackPose(actor, progress, swing, type, dt) {
  if (!actor.gltfRoot) return;
  const heavy = type === "heavy";
  const lean = heavy ? 0.2 : 0.13;
  const recoil = Math.sin(progress * Math.PI * 2) * (heavy ? 0.16 : 0.1);
  actor.gltfRoot.rotation.x = damp(actor.gltfRoot.rotation.x, -lean * swing, 18, dt);
  actor.gltfRoot.rotation.z = damp(actor.gltfRoot.rotation.z, recoil, 18, dt);
  actor.gltfRoot.position.z = damp(actor.gltfRoot.position.z, (actor.gltfBasePosition?.z ?? 0) + swing * (heavy ? 0.24 : 0.14), 18, dt);
  if (actor.rigKit) {
    actor.rigKit.rotation.x = damp(actor.rigKit.rotation.x, -lean * swing * 0.8, 18, dt);
    actor.rigKit.rotation.z = damp(actor.rigKit.rotation.z, recoil * 0.75, 18, dt);
  }
}

function setRiggedActorFlash(actor, amount, color) {
  if (!actor.rigMaterials) return;
  for (const material of actor.rigMaterials) {
    if (!material.emissive) continue;
    material.emissive.setHex(color);
    material.emissiveIntensity = amount;
  }
}

function updateAnimatedActors(dt) {
  for (const actor of animatedActors) {
    actor.mixer?.update(dt);
    if (!actor.rigKit) continue;
    const pulse = 0.82 + Math.sin(elapsed * 9 + actor.group.id) * 0.12;
    for (const material of actor.rigKit.userData.glowMaterials || []) {
      material.opacity = actor === player ? pulse : pulse * 0.78;
    }
    const speed = actor.velocity?.length?.() ?? 0;
    const sway = Math.sin(elapsed * (actor === player ? 8.4 : 6.6) + actor.group.id) * Math.min(speed * 0.08, 0.18);
    for (const part of actor.rigKit.userData.swayParts || []) {
      const base = part.userData.baseRotation;
      part.rotation.x = (base?.x ?? 0) + sway;
      part.rotation.z = (base?.z ?? 0) + sway * (part.position.x < 0 ? -0.55 : 0.55);
    }
  }
}

function detachAnimatedActor(actor) {
  actor.removed = true;
  const index = animatedActors.indexOf(actor);
  if (index >= 0) animatedActors.splice(index, 1);
  actor.mixer?.stopAllAction();
}

function makeActorImpostor(texture, width, height, position, options = {}) {
  const group = new THREE.Group();
  group.position.set(position[0], position[1], position[2]);

  const createLayer = ({ color = 0xffffff, opacity = 1, offset = [0, 0, 0], scale = 1, blending = THREE.NormalBlending }) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        color,
        transparent: true,
        opacity,
        alphaTest: 0.04,
        depthWrite: false,
        depthTest: true,
        blending,
        toneMapped: false,
      }),
    );
    sprite.position.set(offset[0], offset[1], offset[2]);
    sprite.scale.set(width * scale, height * scale, 1);
    group.add(sprite);
    return sprite;
  };

  const shadow = createLayer({
    color: 0x040506,
    opacity: options.shadowOpacity ?? 0.34,
    offset: [0.055, -0.035, -0.09],
    scale: 1.035,
  });
  const cyanRim = createLayer({
    color: options.cyan ?? 0x31fff4,
    opacity: options.rimOpacity ?? 0.24,
    offset: [-0.045, 0.01, -0.055],
    scale: 1.015,
    blending: THREE.AdditiveBlending,
  });
  const magentaRim = createLayer({
    color: options.magenta ?? 0xff2f6d,
    opacity: options.rimOpacity ?? 0.22,
    offset: [0.045, 0.0, -0.05],
    scale: 1.012,
    blending: THREE.AdditiveBlending,
  });
  const main = createLayer({ opacity: 1, offset: [0, 0, 0], scale: 1 });

  group.renderOrder = options.renderOrder ?? 10;
  return {
    group,
    main,
    shadow,
    cyanRim,
    magentaRim,
    layers: [shadow, cyanRim, magentaRim, main],
    baseWidth: width,
    baseHeight: height,
    texture,
    basePosition: new THREE.Vector3(position[0], position[1], position[2]),
    lean: 0,
    pulse: 0,
  };
}

function poseActorImpostor(rig, { y = rig.basePosition.y, x = rig.basePosition.x, lean = 0, squash = 0, pulse = 0, opacity = 1, dt = 0.016 } = {}) {
  rig.group.position.set(x, y, rig.basePosition.z);
  rig.group.scale.set(1 + squash * 0.08, 1 - squash * 0.045, 1);
  rig.lean = damp(rig.lean, lean, 14, dt);
  rig.pulse = Math.max(rig.pulse * 0.86, pulse);

  const rimBoost = rig.pulse;
  for (const layer of rig.layers) {
    layer.material.rotation = rig.lean;
  }
  rig.main.material.opacity = opacity;
  rig.shadow.material.opacity = 0.3 + rimBoost * 0.12;
  rig.cyanRim.material.opacity = 0.2 + rimBoost * 0.42;
  rig.magentaRim.material.opacity = 0.18 + rimBoost * 0.38;
  rig.cyanRim.position.x = -0.045 - rimBoost * 0.025;
  rig.magentaRim.position.x = 0.045 + rimBoost * 0.025;
}

function createPlayer() {
  const group = new THREE.Group();
  group.position.set(0, 0, 40);
  group.rotation.y = Math.PI;

  const model = new THREE.Group();
  group.add(model);

  const skin = new THREE.MeshStandardMaterial({
    color: heroVisualPalette.armorColor,
    map: actorCharacterTexture(heroVisualPalette.gltfPanel),
    roughness: 0.24,
    metalness: 0.56,
    emissive: 0x02080a,
    emissiveIntensity: 0.08,
  });
  const hair = new THREE.MeshStandardMaterial({
    color: heroVisualPalette.rubberColor,
    map: actorCharacterTexture(heroVisualPalette.rubberPanel),
    roughness: 0.48,
    metalness: 0.16,
  });
  const boot = new THREE.MeshStandardMaterial({
    color: heroVisualPalette.rubberColor,
    map: cinematicCharacterTexture(characterCinematicPanels.boots),
    roughness: 0.5,
    metalness: 0.16,
  });
  const cloth = materials.playerCoat;
  const trim = materials.playerAccent;
  const shoulderMaterial = materials.playerArmor;

  const torso = makePart(
    model,
    new THREE.CylinderGeometry(0.36, 0.48, 0.92, 6),
    cloth,
    [0, 1.18, 0],
  );
  torso.scale.z = 0.78;

  const chestPlate = makePart(model, roundedBox(0.52, 0.58, 0.08, 0.06), shoulderMaterial, [0, 1.28, 0.34]);
  chestPlate.rotation.x = -0.08;

  const chestLight = makePart(model, roundedBox(0.12, 0.42, 0.055, 0.025), trim, [0, 1.33, 0.39]);
  const belt = makePart(model, roundedBox(0.86, 0.12, 0.52, 0.045), shoulderMaterial, [0, 0.78, 0.02]);
  belt.scale.x = 1.05;

  const coatBack = makePart(model, roundedBox(0.68, 0.74, 0.08, 0.045), cloth, [0, 0.68, -0.31], [0.15, 0, 0]);
  const leftCoat = makePart(model, roundedBox(0.28, 0.7, 0.055, 0.035), cloth, [-0.2, 0.58, 0.25], [-0.08, 0.06, 0.08]);
  const rightCoat = makePart(model, roundedBox(0.28, 0.7, 0.055, 0.035), cloth, [0.2, 0.58, 0.25], [-0.08, -0.06, -0.08]);
  leftCoat.receiveShadow = false;
  rightCoat.receiveShadow = false;

  const neck = makePart(model, new THREE.CylinderGeometry(0.13, 0.15, 0.18, 10), skin, [0, 1.72, 0]);
  neck.castShadow = false;
  const head = makePart(model, new THREE.SphereGeometry(0.27, 18, 14), skin, [0, 1.98, 0.04]);
  head.scale.set(0.92, 1.04, 0.88);
  const hairCap = makePart(model, new THREE.SphereGeometry(0.285, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, [0, 2.08, 0.03]);
  hairCap.scale.set(0.96, 0.64, 0.94);
  const visor = makePart(model, roundedBox(0.37, 0.065, 0.055, 0.025), trim, [0, 2.0, 0.255]);

  const leftShoulder = makePart(model, roundedBox(0.34, 0.17, 0.46, 0.06), shoulderMaterial, [-0.46, 1.52, 0.02], [0, 0, -0.16]);
  const rightShoulder = makePart(model, roundedBox(0.34, 0.17, 0.46, 0.06), shoulderMaterial, [0.46, 1.52, 0.02], [0, 0, 0.16]);

  const leftArm = makePart(model, new THREE.CapsuleGeometry(0.085, 0.44, 5, 9), cloth, [-0.6, 1.16, 0.05], [0.24, 0.04, -0.18]);
  const rightArm = makePart(model, new THREE.CapsuleGeometry(0.085, 0.44, 5, 9), cloth, [0.6, 1.17, 0.08], [-0.16, -0.06, 0.22]);
  const leftGlove = makePart(model, roundedBox(0.16, 0.16, 0.18, 0.045), boot, [-0.66, 0.88, 0.16]);
  const rightGlove = makePart(model, roundedBox(0.16, 0.16, 0.18, 0.045), boot, [0.68, 0.9, 0.18]);

  const leftLeg = makePart(model, new THREE.CapsuleGeometry(0.11, 0.56, 5, 9), cloth, [-0.18, 0.42, 0.02], [0.02, 0.02, 0.03]);
  const rightLeg = makePart(model, new THREE.CapsuleGeometry(0.11, 0.56, 5, 9), cloth, [0.18, 0.42, 0.02], [-0.02, -0.02, -0.03]);
  const leftBoot = makePart(model, roundedBox(0.22, 0.16, 0.38, 0.06), boot, [-0.18, 0.13, 0.11]);
  const rightBoot = makePart(model, roundedBox(0.22, 0.16, 0.38, 0.06), boot, [0.18, 0.13, 0.11]);

  const sideTubeL = makePart(model, roundedBox(0.035, 0.58, 0.035, 0.014), trim, [-0.37, 1.18, 0.38]);
  const sideTubeR = makePart(model, roundedBox(0.035, 0.58, 0.035, 0.014), trim, [0.37, 1.18, 0.38]);
  sideTubeL.castShadow = false;
  sideTubeR.castShadow = false;

  const sword = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.48, 12),
    new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.28, metalness: 0.72 }),
  );
  handle.rotation.x = Math.PI / 2;
  sword.add(handle);

  const guard = new THREE.Mesh(roundedBox(0.34, 0.05, 0.08, 0.02), trim);
  guard.position.z = 0.32;
  guard.castShadow = true;
  sword.add(guard);

  const blade = new THREE.Mesh(roundedBox(0.05, 0.075, 1.52, 0.018), materials.blade);
  blade.position.z = 0.82;
  blade.castShadow = true;
  sword.add(blade);
  const bladeEdge = new THREE.Mesh(
    roundedBox(0.012, 0.09, 1.44, 0.005),
    new THREE.MeshBasicMaterial({ color: 0xbffeff, toneMapped: false }),
  );
  bladeEdge.position.set(0.034, 0, 0.86);
  sword.add(bladeEdge);
  sword.position.set(0.58, 1.03, 0.2);
  sword.rotation.set(-0.48, -0.45, -0.08);
  model.add(sword);

  const keyLight = new THREE.PointLight(0xfff3df, 1.58, 5.2, 2.1);
  keyLight.position.set(-0.7, 1.6, 1.25);
  group.add(keyLight);
  const rimLight = new THREE.PointLight(0xff4a7d, 0.92, 4.0, 2.0);
  rimLight.position.set(0.9, 1.25, -0.55);
  group.add(rimLight);

  const heroGlowTexture = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createRadialGradient(w / 2, h / 2, 5, w / 2, h / 2, w * 0.5);
    grad.addColorStop(0, "rgba(130,255,246,0.42)");
    grad.addColorStop(0.38, "rgba(255,72,128,0.18)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  const heroGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 1.25),
    new THREE.MeshBasicMaterial({
      map: heroGlowTexture,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  heroGlow.rotation.x = -Math.PI / 2;
  heroGlow.position.set(0, 0.052, 0.05);
  group.add(heroGlow);

  const billboard = { group: new THREE.Group(), main: null };
  group.add(billboard.group);
  billboard.group.visible = !visualMode.actors3D;
  model.visible = visualMode.actors3D;
  const contactShadow = createContactShadow(0.92, 0.44, 0.2);
  group.add(contactShadow);

  return {
    group,
    model,
    contactShadow,
    sprite: billboard.main,
    billboard,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    coatBack,
    sword,
    health: 100,
    maxHealth: 100,
    stamina: 100,
    maxStamina: 100,
    yaw: Math.PI,
    moveDir: new THREE.Vector3(0, 0, -1),
    velocity: new THREE.Vector3(),
    dashDir: new THREE.Vector3(0, 0, -1),
    dashTimer: 0,
    dashCooldown: 0,
    invulnerable: 0,
    attack: null,
    combo: 0,
    comboTimer: 0,
    hitPulse: 0,
    afterimageTimer: 0,
  };
}

function createSlashEffect() {
  const texture = canvasTexture(768, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,255,0.88)";
    ctx.shadowColor = "#7ffcff";
    ctx.shadowBlur = 22;
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.55, w * 0.39, h * 0.22, -0.08, Math.PI * 1.07, Math.PI * 1.88);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 235, 154, 0.72)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.ellipse(w * 0.53, h * 0.53, w * 0.32, h * 0.16, -0.08, Math.PI * 1.08, Math.PI * 1.86);
    ctx.stroke();
  });
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.25, 1.12), material);
  mesh.visible = false;
  return { mesh, material };
}

function createRainSystem() {
  const count = window.innerWidth < 760 ? 520 : 680;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = -34 + rng() * 68;
    positions[i * 3 + 1] = 1 + rng() * 44;
    positions[i * 3 + 2] = world.streetMinZ + rng() * (world.streetMaxZ - world.streetMinZ);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xb8d8ff,
    size: 0.035,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
  });
  return {
    points: new THREE.Points(geometry, material),
    positions,
    count,
  };
}

function bindInput() {
  canvas.tabIndex = 0;
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (event) => {
    setKey(event.code, true);
    if (event.code === "Space") {
      input.dashQueued = true;
      event.preventDefault();
    }
  });
  window.addEventListener("keyup", (event) => setKey(event.code, false));
  window.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement !== canvas || !gameStarted) return;
    cameraRig.yaw -= event.movementX * 0.0026;
    cameraRig.pitch = clamp(cameraRig.pitch - event.movementY * 0.0022, -0.08, 0.72);
  });
  window.addEventListener("mousedown", (event) => {
    if (!gameStarted || gameOver) return;
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
    if (event.button === 0) triggerAttack("light");
    if (event.button === 2) triggerAttack("heavy");
  });
  window.addEventListener("contextmenu", (event) => event.preventDefault());
  startButton.addEventListener("click", () => {
    if (gameOver) resetGame();
    beginGame();
  });

  window.addEventListener("touchstart", (event) => {
    if (!gameStarted) beginGame();
    for (const touch of event.changedTouches) {
      if (touch.clientX < window.innerWidth * 0.48 && input.movingTouchId === null) {
        input.movingTouchId = touch.identifier;
        input.touchMove.set(0, -1);
      } else if (!gameOver) {
        triggerAttack("light");
      }
    }
  }, { passive: true });
  window.addEventListener("touchmove", (event) => {
    for (const touch of event.changedTouches) {
      if (touch.identifier === input.movingTouchId) {
        const x = (touch.clientX / window.innerWidth - 0.24) / 0.24;
        const y = (touch.clientY / window.innerHeight - 0.68) / 0.32;
        input.touchMove.set(clamp(x, -1, 1), clamp(y, -1, 1));
      }
    }
  }, { passive: true });
  window.addEventListener("touchend", (event) => {
    for (const touch of event.changedTouches) {
      if (touch.identifier === input.movingTouchId) {
        input.movingTouchId = null;
        input.touchMove.set(0, 0);
      }
    }
  }, { passive: true });
}

function setKey(code, pressed) {
  if (code === "KeyW" || code === "ArrowUp") input.forward = pressed;
  if (code === "KeyS" || code === "ArrowDown") input.back = pressed;
  if (code === "KeyA" || code === "ArrowLeft") input.left = pressed;
  if (code === "KeyD" || code === "ArrowRight") input.right = pressed;
  if (code === "ShiftLeft" || code === "ShiftRight") input.sprint = pressed;
}

function beginGame() {
  gameStarted = true;
  gameOver = false;
  startButton.classList.add("hidden");
  canvas.focus();
  canvas.requestPointerLock?.();
  if (wave === 0) {
    spawnWave();
  }
}

function resetGame() {
  for (const enemy of enemies.splice(0)) {
    detachAnimatedActor(enemy);
    scene.remove(enemy.group);
  }
  for (const text of floatingTexts.splice(0)) scene.remove(text.sprite);
  for (const spark of sparks.splice(0)) scene.remove(spark.mesh);
  for (const image of afterimages.splice(0)) scene.remove(image.sprite);
  player.group.position.set(0, 0, 40);
  player.group.rotation.y = Math.PI;
  player.health = player.maxHealth;
  player.stamina = player.maxStamina;
  player.yaw = Math.PI;
  player.velocity.set(0, 0, 0);
  player.attack = null;
  player.combo = 0;
  player.comboTimer = 0;
  player.dashTimer = 0;
  player.dashCooldown = 0;
  player.invulnerable = 0;
  wave = 0;
  nextWaveTimer = 0;
  encounterTimer = 0;
  gameOver = false;
  statusStrip.textContent = "彌敦道 雨夜巡邏";
  statusStrip.classList.remove("hot");
  startButton.querySelector("span").textContent = "START RUN";
  updateHud();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  if (gameStarted && !gameOver) {
    updatePlayer(dt);
    updateEnemies(dt);
    updateCombat(dt);
    updateWaveFlow(dt);
  }
  updateCamera(dt);
  updateGeneratedSceneMotion(dt);
  updateAnimatedActors(dt);
  updateStreetLife(dt);
  updateRain(dt);
  updateFloatingText(dt);
  updateSparks(dt);
  updateAfterimages(dt);
  updateSceneMotion(dt);
  updateHud();

  renderer.render(scene, camera);
}

function updatePlayer(dt) {
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.hitPulse = Math.max(0, player.hitPulse - dt);

  if (player.comboTimer > 0) {
    player.comboTimer -= dt;
  } else {
    player.combo = 0;
  }

  const cameraForwardYaw = cameraRig.yaw + Math.PI;
  forwardV.set(Math.sin(cameraForwardYaw), 0, Math.cos(cameraForwardYaw)).normalize();
  rightV.set(Math.sin(cameraForwardYaw - Math.PI / 2), 0, Math.cos(cameraForwardYaw - Math.PI / 2)).normalize();

  const desired = tmpV3.set(0, 0, 0);
  if (input.forward) desired.add(forwardV);
  if (input.back) desired.sub(forwardV);
  if (input.right) desired.add(rightV);
  if (input.left) desired.sub(rightV);
  if (input.movingTouchId !== null) {
    desired.addScaledVector(rightV, input.touchMove.x);
    desired.addScaledVector(forwardV, -input.touchMove.y);
  }
  if (desired.lengthSq() > 0.01) desired.normalize();

  if (input.dashQueued && player.dashCooldown <= 0 && player.stamina >= 24) {
    player.dashDir.copy(desired.lengthSq() > 0 ? desired : getPlayerForward());
    player.dashTimer = 0.18;
    player.dashCooldown = 0.62;
    player.invulnerable = 0.24;
    player.stamina -= 24;
    addSparkBurst(player.group.position, 0x8afcff, 12, 1.7);
  }
  input.dashQueued = false;

  const moving = desired.lengthSq() > 0.01;
  if (moving && !player.attack) {
    player.moveDir.copy(desired);
    const targetYaw = Math.atan2(desired.x, desired.z);
    player.yaw = shortestAngleDamp(player.yaw, targetYaw, 12, dt);
  }
  player.group.rotation.y = player.yaw;

  let speed = input.sprint && player.stamina > 6 ? 7.4 : 5.15;
  if (player.attack) speed *= player.attack.type === "heavy" ? 0.22 : 0.42;
  if (input.sprint && moving && !player.attack && player.stamina > 0) {
    player.stamina = Math.max(0, player.stamina - dt * 9);
  } else if (!player.attack) {
    player.stamina = Math.min(player.maxStamina, player.stamina + dt * 18);
  }

  const displacement = tmpV32.set(0, 0, 0);
  if (player.dashTimer > 0) {
    displacement.addScaledVector(player.dashDir, 17.5 * dt);
    player.dashTimer -= dt;
  } else if (moving) {
    displacement.addScaledVector(desired, speed * dt);
  }

  player.group.position.add(displacement);
  player.group.position.x = clamp(player.group.position.x, -world.sideLimitX, world.sideLimitX);
  player.group.position.z = clamp(player.group.position.z, world.streetMinZ, world.streetMaxZ);

  const strideSpeed = input.sprint ? 14 : 10;
  const stride = moving ? Math.sin(elapsed * strideSpeed) : 0;
  const bob = moving ? Math.abs(stride) * 0.035 : Math.sin(elapsed * 2) * 0.01;
  player.model.position.y = bob;
  if (visualMode.actors3D) {
    const actionName = player.dashTimer > 0 ? "Run" : moving ? (input.sprint ? "Run" : "Walk") : "Idle";
    setActorAction(player, player.attack ? (moving ? "Run" : "Idle") : actionName);
    setRiggedActorFlash(player, player.hitPulse > 0 ? 1.15 : 0, player.hitPulse > 0 ? 0xff2f6d : 0x2df4ed);
    if (player.rigKit) player.rigKit.position.y = bob * 0.35;
  }
  if (!visualMode.actors3D) {
    const attackPulse = player.attack ? 0.7 : 0;
    const dashPulse = player.dashTimer > 0 ? 0.85 : 0;
    poseActorImpostor(player.billboard, {
      y: 1.22 + bob * 0.72,
      x: 0.06 + stride * 0.035,
      lean: player.attack ? Math.sin(elapsed * 18) * 0.045 : stride * 0.035,
      squash: moving ? Math.abs(stride) * 0.32 : 0,
      pulse: Math.max(attackPulse, dashPulse, player.hitPulse * 2.2),
      opacity: player.invulnerable > 0 ? 0.72 + Math.sin(elapsed * 38) * 0.18 : 1,
      dt,
    });
    player.afterimageTimer = Math.max(0, player.afterimageTimer - dt);
    if ((player.dashTimer > 0 || player.attack) && player.afterimageTimer <= 0) {
      spawnActorAfterimage(player.billboard, player.group.position, 0x50fff3, player.attack ? 0.32 : 0.42);
      player.afterimageTimer = player.attack ? 0.075 : 0.045;
    }
  }
  player.torso.rotation.z = moving ? stride * 0.035 : Math.sin(elapsed * 1.6) * 0.012;
  player.leftLeg.rotation.x = stride * 0.42;
  player.rightLeg.rotation.x = -stride * 0.42;
  player.leftArm.rotation.x = -stride * 0.24 + 0.24;
  player.rightArm.rotation.x = stride * 0.22 - 0.16;
  player.coatBack.rotation.x = 0.15 - Math.abs(stride) * 0.08;
}

function shortestAngleDamp(current, target, lambda, dt) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-lambda * dt));
}

function getPlayerForward() {
  return forwardV.set(Math.sin(player.yaw), 0, Math.cos(player.yaw)).normalize();
}

function triggerAttack(type) {
  if (player.attack) return;
  const heavy = type === "heavy";
  const cost = heavy ? 28 : 13;
  if (player.stamina < cost) return;

  const moveIntent = input.forward || input.back || input.left || input.right || input.movingTouchId !== null;
  const snapped = faceNearestThreat(heavy ? 4.8 : 4.1);
  if (!snapped && !moveIntent) {
    player.yaw = cameraRig.yaw + Math.PI;
    player.group.rotation.y = player.yaw;
  }

  player.stamina -= cost;
  player.attack = {
    type,
    t: 0,
    duration: heavy ? 0.72 : 0.42,
    hitStart: heavy ? 0.2 : 0.11,
    hitEnd: heavy ? 0.46 : 0.27,
    damage: heavy ? 54 : 27,
    range: heavy ? 3.85 : 3.15,
    angle: heavy ? 2.65 : 2.24,
    knockback: heavy ? 7.3 : 4.2,
    targets: new Set(),
  };
  reticle.classList.add("active");
}

function faceNearestThreat(maxDistance) {
  let nearest = null;
  let nearestDistance = maxDistance;
  for (const enemy of enemies) {
    if (enemy.dead) continue;
    const distance = enemy.group.position.distanceTo(player.group.position);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = enemy;
    }
  }
  if (!nearest) return false;
  const dir = tmpV3.copy(nearest.group.position).sub(player.group.position);
  dir.y = 0;
  if (dir.lengthSq() < 0.001) return false;
  dir.normalize();
  player.yaw = Math.atan2(dir.x, dir.z);
  player.group.rotation.y = player.yaw;
  return true;
}

function updateCombat(dt) {
  if (!player.attack) {
    slash.material.opacity = damp(slash.material.opacity, 0, 18, dt);
    if (slash.material.opacity < 0.02) slash.mesh.visible = false;
    player.sword.rotation.set(-0.48, -0.45, -0.08);
    resetRiggedWeapon(player, dt);
    resetRiggedPose(player, dt);
    reticle.classList.remove("active");
    return;
  }

  const attack = player.attack;
  attack.t += dt;
  const progress = clamp(attack.t / attack.duration, 0, 1);
  const swing = Math.sin(progress * Math.PI);

  player.sword.rotation.set(-0.75 + swing * 1.35, -0.85 + progress * 1.6, -0.5 + swing * 0.95);
  applyPlayerAttackPose(player, progress, swing, attack.type, dt);
  if (player.rigWeapon) {
    player.rigWeapon.position.set(0.55 + swing * 0.14, 0.98 + swing * 0.12, 0.18 + swing * 0.36);
    player.rigWeapon.rotation.set(-0.92 + swing * 1.34, -0.98 + progress * 1.75, -0.72 + swing * 1.06);
  }
  player.rightArm.rotation.x = -0.65 + swing * 1.15;
  player.rightArm.rotation.z = 0.22 + swing * 0.45;
  player.leftArm.rotation.x = 0.24 - swing * 0.32;
  player.torso.rotation.y = Math.sin(progress * Math.PI * 2) * 0.08;
  if (!visualMode.actors3D) {
    poseActorImpostor(player.billboard, {
      y: player.billboard.group.position.y,
      x: 0.06 + Math.sin(progress * Math.PI * 2) * 0.055,
      lean: -0.16 + swing * 0.32,
      squash: swing * 0.6,
      pulse: 0.8 + swing * 0.3,
      opacity: player.sprite.material.opacity,
      dt,
    });
  }

  const forward = getPlayerForward();
  slash.mesh.visible = true;
  slash.mesh.position.copy(player.group.position).addScaledVector(forward, attack.type === "heavy" ? 1.55 : 1.28);
  slash.mesh.position.y = 1.36;
  slash.mesh.rotation.set(0, player.yaw, 0);
  slash.mesh.scale.setScalar(attack.type === "heavy" ? 1.22 : 1.0);
  slash.material.opacity = attack.t >= attack.hitStart && attack.t <= attack.hitEnd ? 0.78 : 0.28 * swing;

  if (attack.t >= attack.hitStart && attack.t <= attack.hitEnd) {
    checkPlayerHits(attack, forward);
  }

  if (attack.t >= attack.duration) {
    player.attack = null;
  }
}

function checkPlayerHits(attack, forward) {
  for (const enemy of enemies) {
    if (enemy.dead || attack.targets.has(enemy.id)) continue;
    const toEnemy = tmpV32.copy(enemy.group.position).sub(player.group.position);
    toEnemy.y = 0;
    const distance = toEnemy.length();
    if (distance > attack.range || distance < 0.05) continue;
    toEnemy.normalize();
    const dot = clamp(forward.dot(toEnemy), -1, 1);
    if (Math.acos(dot) > attack.angle * 0.5) continue;

    attack.targets.add(enemy.id);
    damageEnemy(enemy, attack.damage, toEnemy, attack.knockback);
  }
}

let enemyId = 0;

function spawnWave() {
  wave += 1;
  const wavePalette = getEnemyWavePalette(wave);
  const count = Math.min(window.innerWidth < 760 ? 3 : 4, 1 + wave + Math.floor(wave / 2));
  const baseZ = clamp(player.group.position.z - 13 - wave * 2, world.streetMinZ + 8, world.streetMaxZ - 10);
  const spread = 8 + Math.min(wave * 1.8, 12);

  for (let i = 0; i < count; i += 1) {
    let z = clamp(baseZ - rng() * spread + (i % 2) * 4, world.streetMinZ + 4, world.streetMaxZ - 7);
    let x = (rng() > 0.5 ? 1 : -1) * (1.4 + rng() * 3.6);
    if (i === 0) {
      z = clamp(player.group.position.z - 8.8, world.streetMinZ + 4, world.streetMaxZ - 7);
      x = wave % 2 === 0 ? -0.42 : 0.42;
    }
    enemies.push(createEnemy(x, z, wave));
  }

  showEncounter(`CONTACT  WAVE ${wave}`);
  const locations = ["彌敦道 雨夜交火", "佐敦後巷 接敵", "灣仔天橋 封鎖", "中環碼頭 追擊", "霓虹街市 壓制"];
  setStatus(`${locations[(wave - 1) % locations.length]} / ${wavePalette.name}`, true, 2.3);
}

function createEnemy(x, z, level) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const shouldRig = enemies.filter((enemy) => enemy.useRig && !enemy.dead).length < renderSettings.maxRiggedEnemies;
  const palette = getEnemyWavePalette(level);

  const model = new THREE.Group();
  group.add(model);

  const bodyMaterial = materials.enemyBody.clone();
  bodyMaterial.color.setHex(palette.bodyColor);
  bodyMaterial.map = actorCharacterTexture(palette.coatPanel ?? characterCinematicPanels.tacticalFabric);
  bodyMaterial.emissive = new THREE.Color(palette.emissive);
  bodyMaterial.emissiveIntensity = 0.06;
  const jacketMaterial = new THREE.MeshStandardMaterial({
    color: palette.jacketColor,
    map: actorCharacterTexture(palette.coatPanel ?? characterCinematicPanels.tacticalFabric),
    roughness: 0.48,
    metalness: 0.18,
    envMapIntensity: 0.86,
  });
  const pantsMaterial = new THREE.MeshStandardMaterial({
    color: palette.pantsColor,
    map: actorCharacterTexture(palette.deepCoatPanel ?? characterCinematicPanels.meshSuit),
    roughness: 0.56,
    metalness: 0.12,
  });
  const bootMaterial = new THREE.MeshStandardMaterial({
    color: palette.bootColor,
    map: actorCharacterTexture(palette.rubberPanel ?? characterCinematicPanels.boots),
    roughness: 0.62,
    metalness: 0.12,
  });
  const armorMaterial = new THREE.MeshStandardMaterial({
    color: palette.armorColor,
    map: actorCharacterTexture(palette.armorPanel ?? characterCinematicPanels.enemyArmor),
    roughness: 0.25,
    metalness: 0.58,
    envMapIntensity: 1.18,
    emissive: palette.emissive,
    emissiveIntensity: 0.12,
  });
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: palette.skinColor,
    map: cinematicCharacterTexture(characterCinematicPanels.helmet),
    roughness: 0.28,
    metalness: 0.42,
  });
  const enemyAccent = materials.enemyAccent.clone();
  enemyAccent.color.setHex(palette.accent);
  enemyAccent.emissive.setHex(palette.accent);

  const body = makePart(
    model,
    new THREE.CylinderGeometry(0.38, 0.47, 0.82, 6),
    bodyMaterial,
    [0, 1.15, 0],
  );
  body.scale.z = 0.76;

  const jacket = makePart(model, roundedBox(0.82, 0.52, 0.12, 0.055), jacketMaterial, [0, 1.22, 0.32]);
  jacket.rotation.x = -0.08;
  const chestArmor = makePart(model, roundedBox(0.54, 0.48, 0.085, 0.055), armorMaterial, [0, 1.27, 0.41], [-0.08, 0, 0]);
  const gangStripe = makePart(model, roundedBox(0.08, 0.46, 0.04, 0.018), enemyAccent, [-0.18, 1.23, 0.4]);
  gangStripe.castShadow = false;
  const belt = makePart(model, roundedBox(0.78, 0.12, 0.48, 0.045), bootMaterial, [0, 0.78, 0]);

  const shoulderL = makePart(model, roundedBox(0.36, 0.18, 0.46, 0.065), armorMaterial, [-0.48, 1.49, 0.02], [0, 0, -0.16]);
  const shoulderR = makePart(model, roundedBox(0.36, 0.18, 0.46, 0.065), armorMaterial, [0.48, 1.49, 0.02], [0, 0, 0.16]);
  shoulderL.material = armorMaterial;
  shoulderR.material = armorMaterial;

  const head = makePart(model, new THREE.SphereGeometry(0.235, 14, 11), skinMaterial, [0, 1.86, 0.04]);
  head.scale.set(0.92, 1.02, 0.9);
  const mask = makePart(model, roundedBox(0.42, 0.17, 0.08, 0.045), bootMaterial, [0, 1.82, 0.23]);
  const visor = makePart(model, roundedBox(0.34, 0.07, 0.052, 0.025), enemyAccent, [0, 1.91, 0.28]);
  visor.castShadow = false;

  const armL = makePart(model, new THREE.CapsuleGeometry(0.085, 0.44, 5, 9), jacketMaterial, [-0.58, 1.12, 0.06], [0.14, 0.02, -0.18]);
  const armR = makePart(model, new THREE.CapsuleGeometry(0.085, 0.44, 5, 9), jacketMaterial, [0.58, 1.12, 0.1], [-0.1, -0.02, 0.18]);
  makePart(model, roundedBox(0.15, 0.42, 0.12, 0.04), armorMaterial, [-0.65, 1.08, 0.16], [0.14, 0.02, -0.12]);
  makePart(model, roundedBox(0.15, 0.42, 0.12, 0.04), armorMaterial, [0.65, 1.08, 0.16], [-0.1, -0.02, 0.12]);
  const gloveL = makePart(model, roundedBox(0.15, 0.15, 0.18, 0.045), bootMaterial, [-0.63, 0.86, 0.16]);
  const gloveR = makePart(model, roundedBox(0.15, 0.15, 0.18, 0.045), bootMaterial, [0.64, 0.88, 0.18]);

  const legL = makePart(model, new THREE.CapsuleGeometry(0.105, 0.54, 5, 9), pantsMaterial, [-0.17, 0.42, 0.02], [0.03, 0.02, 0.03]);
  const legR = makePart(model, new THREE.CapsuleGeometry(0.105, 0.54, 5, 9), pantsMaterial, [0.17, 0.42, 0.02], [-0.03, -0.02, -0.03]);
  makePart(model, roundedBox(0.18, 0.42, 0.12, 0.045), armorMaterial, [-0.18, 0.45, 0.16], [0.04, 0, 0.03]);
  makePart(model, roundedBox(0.18, 0.42, 0.12, 0.045), armorMaterial, [0.18, 0.45, 0.16], [-0.04, 0, -0.03]);
  makePart(model, roundedBox(0.62, 0.62, 0.06, 0.04), jacketMaterial, [0, 0.72, -0.28], [0.14, 0, 0]);
  makePart(model, roundedBox(0.22, 0.16, 0.36, 0.06), bootMaterial, [-0.17, 0.13, 0.1]);
  makePart(model, roundedBox(0.22, 0.16, 0.36, 0.06), bootMaterial, [0.17, 0.13, 0.1]);

  const baton = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.038, 1.05, 10),
    new THREE.MeshStandardMaterial({ color: palette.metalColor, roughness: 0.22, metalness: 0.76 }),
  );
  baton.rotation.x = Math.PI / 2;
  baton.position.set(-0.48, 1.08, 0.2);
  baton.castShadow = true;
  model.add(baton);

  const healthBar = createEnemyHealthBar();
  healthBar.fill.material.color.setHex(palette.accent);
  group.add(healthBar.group);

  const billboard = { group: new THREE.Group(), main: null };
  group.add(billboard.group);
  billboard.group.visible = !visualMode.actors3D;
  model.visible = visualMode.actors3D;
  const contactShadow = createContactShadow(0.78, 0.38, 0.18);
  group.add(contactShadow);

  scene.add(group);
  const enemy = {
    id: enemyId += 1,
    group,
    model,
    contactShadow,
    sprite: billboard.main,
    billboard,
    body,
    armL,
    armR,
    legL,
    legR,
    visor,
    baton,
    healthBar,
    maxHealth: 72 + level * 12,
    health: 72 + level * 12,
    speed: 2.1 + Math.min(level * 0.1, 0.8) + rng() * 0.35,
    velocity: new THREE.Vector3(),
    attackCooldown: 0.5 + rng() * 1.2,
    attackWindup: 0,
    attackCommitted: false,
    hitFlash: 0,
    stun: 0,
    dead: false,
    deathTimer: 0,
    removed: false,
    useRig: shouldRig,
    palette,
  };
  if (shouldRig) {
    attachRiggedActor(enemy, {
      role: "enemy",
      desiredHeight: 1.98,
      level,
      palette,
      tint: palette.gltfColor,
      accent: palette.accent,
      secondaryAccent: palette.secondaryAccent,
    });
  }
  return enemy;
}

function createEnemyHealthBar() {
  const group = new THREE.Group();
  group.position.y = 2.42;

  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(0.82, 0.075),
    new THREE.MeshBasicMaterial({ color: 0x050506, transparent: true, opacity: 0.78, depthWrite: false }),
  );
  group.add(back);

  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(0.76, 0.043),
    new THREE.MeshBasicMaterial({ color: 0xff365d, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }),
  );
  fill.position.z = 0.003;
  group.add(fill);

  return { group, fill };
}

function updateEnemies(dt) {
  for (const enemy of enemies) {
    if (enemy.dead) {
      setActorAction(enemy, "Idle", 0.12);
      setRiggedActorFlash(enemy, 0.22, enemy.palette?.hitColor ?? 0xff2f6d);
      enemy.deathTimer -= dt;
      enemy.group.position.y = damp(enemy.group.position.y, -0.45, 6, dt);
      enemy.group.rotation.z = damp(enemy.group.rotation.z, 1.24, 7, dt);
      continue;
    }

    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    enemy.stun = Math.max(0, enemy.stun - dt);
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    const palette = enemy.palette ?? enemyWavePalettes[0];
    setRiggedActorFlash(enemy, enemy.hitFlash > 0 ? 1.35 : 0, enemy.hitFlash > 0 ? palette.hitColor : palette.accent);
    enemy.body.material.emissive = enemy.body.material.emissive || new THREE.Color(0x000000);
    enemy.body.material.emissive.setHex(enemy.hitFlash > 0 ? palette.hitColor : palette.emissive);
    enemy.body.material.emissiveIntensity = enemy.hitFlash > 0 ? 1.2 : 0.06;
    if (!visualMode.actors3D) {
      enemy.sprite.material.color.setHex(enemy.hitFlash > 0 ? palette.hitColor : palette.gltfColor);
    }

    const toPlayer = tmpV3.copy(player.group.position).sub(enemy.group.position);
    toPlayer.y = 0;
    const dist = Math.max(0.001, toPlayer.length());
    const dir = toPlayer.normalize();
    const targetYaw = Math.atan2(dir.x, dir.z);
    enemy.group.rotation.y = shortestAngleDamp(enemy.group.rotation.y, targetYaw, 10, dt);

    if (enemy.stun <= 0 && enemy.attackWindup <= 0) {
      if (dist > 1.58) {
        const flank = Math.sin(elapsed * 1.1 + enemy.id) * 0.34;
        const side = tmpV32.set(dir.z, 0, -dir.x).multiplyScalar(flank);
        const steer = dir.clone().add(side).normalize();
        enemy.velocity.addScaledVector(steer, enemy.speed * dt * 5.2);
      } else if (enemy.attackCooldown <= 0) {
        enemy.attackWindup = 0.42;
        enemy.attackCommitted = false;
        enemy.attackCooldown = 1.25 + rng() * 0.58;
      }
    }

    if (enemy.attackWindup > 0) {
      const previous = enemy.attackWindup;
      enemy.attackWindup -= dt;
      enemy.baton.material.emissive = enemy.baton.material.emissive || new THREE.Color(0x000000);
      enemy.baton.material.emissive.setHex(0xff335a);
      enemy.baton.material.emissiveIntensity = 1.8;
      enemy.baton.rotation.z = Math.sin((1 - enemy.attackWindup / 0.42) * Math.PI) * 1.3;
      if (enemy.rigWeapon) {
        const windupProgress = 1 - enemy.attackWindup / 0.42;
        enemy.rigWeapon.rotation.z = -0.18 + Math.sin(windupProgress * Math.PI) * 1.2;
        enemy.rigWeapon.position.x = -0.5 + Math.sin(windupProgress * Math.PI) * 0.2;
      }
      if (previous > 0.16 && enemy.attackWindup <= 0.16 && !enemy.attackCommitted) {
        enemy.attackCommitted = true;
        enemyStrike(enemy);
      }
      if (enemy.attackWindup <= 0) {
        enemy.baton.material.emissiveIntensity = 0;
        enemy.baton.rotation.z = 0;
        resetRiggedWeapon(enemy, dt);
      }
    } else {
      resetRiggedWeapon(enemy, dt);
    }

    applyEnemySeparation(enemy, dt);
    enemy.velocity.multiplyScalar(Math.pow(0.1, dt));
    enemy.group.position.addScaledVector(enemy.velocity, dt);
    enemy.group.position.x = clamp(enemy.group.position.x, -world.sideLimitX, world.sideLimitX);
    enemy.group.position.z = clamp(enemy.group.position.z, world.streetMinZ, world.streetMaxZ);

    const pace = enemy.velocity.lengthSq() > 0.02 ? Math.sin(elapsed * 8.5 + enemy.id) : 0;
    enemy.model.position.y = Math.abs(pace) * 0.022;
    if (visualMode.actors3D) {
      setActorAction(enemy, enemy.stun > 0 || enemy.attackWindup > 0 ? "Idle" : pace !== 0 ? "Run" : "Idle");
      if (enemy.rigKit) enemy.rigKit.position.y = Math.abs(pace) * 0.01;
    }
    if (!visualMode.actors3D) {
      poseActorImpostor(enemy.billboard, {
        y: 1.15 + Math.abs(pace) * 0.028,
        x: 0.02 + pace * 0.025,
        lean: enemy.attackWindup > 0 ? Math.sin((1 - enemy.attackWindup / 0.42) * Math.PI) * 0.12 : pace * 0.026,
        squash: Math.abs(pace) * 0.22,
        pulse: enemy.hitFlash > 0 ? 1 : enemy.attackWindup > 0 ? 0.55 : 0,
        opacity: enemy.hitFlash > 0 ? 0.9 : 1,
        dt,
      });
    }
    enemy.legL.rotation.x = pace * 0.28;
    enemy.legR.rotation.x = -pace * 0.28;
    enemy.armL.rotation.x = -pace * 0.18 + 0.14;
    enemy.armR.rotation.x = pace * 0.16 - 0.1;

    const ratio = clamp(enemy.health / enemy.maxHealth, 0, 1);
    enemy.healthBar.fill.scale.x = ratio;
    enemy.healthBar.fill.position.x = -(1 - ratio) * 0.38;
    enemy.healthBar.group.lookAt(camera.position);
  }

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    if (enemies[i].dead && enemies[i].deathTimer <= 0) {
      detachAnimatedActor(enemies[i]);
      scene.remove(enemies[i].group);
      enemies.splice(i, 1);
    }
  }
}

function applyEnemySeparation(enemy, dt) {
  for (const other of enemies) {
    if (enemy === other || other.dead) continue;
    const away = tmpV32.copy(enemy.group.position).sub(other.group.position);
    away.y = 0;
    const d = away.length();
    if (d > 0.001 && d < 0.92) {
      enemy.velocity.addScaledVector(away.normalize(), (0.92 - d) * dt * 10);
    }
  }
}

function enemyStrike(enemy) {
  if (player.invulnerable > 0 || gameOver) return;
  const toPlayer = tmpV3.copy(player.group.position).sub(enemy.group.position);
  toPlayer.y = 0;
  const dist = toPlayer.length();
  if (dist > 1.95) return;
  const dir = toPlayer.normalize();
  const enemyForward = new THREE.Vector3(Math.sin(enemy.group.rotation.y), 0, Math.cos(enemy.group.rotation.y));
  if (enemyForward.dot(dir) < 0.35) return;
  damagePlayer(11 + wave * 2, dir);
}

function damageEnemy(enemy, amount, dir, knockback) {
  enemy.health -= amount;
  enemy.stun = amount > 40 ? 0.34 : 0.22;
  enemy.hitFlash = 0.14;
  enemy.velocity.addScaledVector(dir, knockback);
  player.combo += 1;
  player.comboTimer = 2.1;
  player.stamina = Math.min(player.maxStamina, player.stamina + 6);

  createFloatingText(`-${Math.round(amount)}`, enemy.group.position, amount > 40 ? "#ffeb9a" : "#f9fafa");
  addSparkBurst(enemy.group.position.clone().add(new THREE.Vector3(0, 1.25, 0)), amount > 40 ? 0xffdd7c : 0x8afcff, amount > 40 ? 18 : 10, 2.2);

  if (enemy.health <= 0) {
    enemy.dead = true;
    enemy.deathTimer = 0.72;
    createFloatingText("K.O.", enemy.group.position, "#ffeb9a");
    addSparkBurst(enemy.group.position.clone().add(new THREE.Vector3(0, 1.1, 0)), 0xff365d, 24, 3.0);
  }
}

function damagePlayer(amount, dir) {
  player.health = Math.max(0, player.health - amount);
  player.invulnerable = 0.46;
  player.hitPulse = 0.28;
  player.group.position.addScaledVector(dir, 0.38);
  vignetteTimer = 0.32;
  setStatus("裝甲受損", true, 0.9);
  addSparkBurst(player.group.position.clone().add(new THREE.Vector3(0, 1.15, 0)), 0xff365d, 14, 2.2);
  if (player.health <= 0) endGame();
}

function endGame() {
  gameOver = true;
  setStatus("訊號中斷", true, 4);
  startButton.querySelector("span").textContent = "RESTART RUN";
  startButton.classList.remove("hidden");
  document.exitPointerLock?.();
}

function updateWaveFlow(dt) {
  const living = enemies.filter((enemy) => !enemy.dead).length;
  if (living === 0 && wave > 0) {
    nextWaveTimer += dt;
    if (nextWaveTimer > 1.7) {
      nextWaveTimer = 0;
      spawnWave();
    }
  } else {
    nextWaveTimer = 0;
  }
}

function showEncounter(text) {
  encounterBanner.textContent = text;
  encounterBanner.classList.add("show");
  encounterTimer = 1.25;
}

function setStatus(text, hot = false, duration = 1.4) {
  statusStrip.textContent = text;
  statusStrip.classList.toggle("hot", hot);
  statusTimer = duration;
}

function updateCamera(dt) {
  const target = cameraRig.target.copy(player.group.position);
  target.y += 1.12;
  const distance = window.innerWidth < 760 ? 5.9 : cameraRig.distance;
  const cp = Math.cos(cameraRig.pitch);
  const offset = tmpV3.set(
    Math.sin(cameraRig.yaw) * distance * cp,
    0.82 + Math.sin(cameraRig.pitch) * distance,
    Math.cos(cameraRig.yaw) * distance * cp,
  );
  cameraRig.desired.copy(target).add(offset);
  camera.position.lerp(cameraRig.desired, 1 - Math.exp(-8 * dt));
  camera.lookAt(target);
}

function updateGeneratedSceneMotion(dt) {
  if (!visualMode.generatedScene) {
    const targetX = clamp(0.07 + camera.position.x * -0.0025, 0.035, 0.105);
    const targetY = clamp(0.07 + (camera.position.z - 40) * -0.00045, 0.035, 0.105);
    generatedSceneOffset.x = damp(generatedSceneOffset.x, targetX, 2.4, dt);
    generatedSceneOffset.y = damp(generatedSceneOffset.y, targetY, 2.4, dt);
    generatedAssets.street.offset.copy(generatedSceneOffset);
    const cinematicTargetX = clamp(camera.position.x * -0.00055, -0.018, 0.018);
    const cinematicTargetY = clamp((camera.position.z - 40) * -0.00008, -0.015, 0.015);
    cinematicSceneOffset.x = damp(cinematicSceneOffset.x, cinematicTargetX, 2.0, dt);
    cinematicSceneOffset.y = damp(cinematicSceneOffset.y, cinematicTargetY, 2.0, dt);
    generatedAssets.cinematicStreet.offset.copy(cinematicSceneOffset);
    if (cinematicBackdrop) {
      cinematicBackdrop.position.x = damp(cinematicBackdrop.position.x, camera.position.x * 0.16, 3.0, dt);
      cinematicBackdrop.position.y = damp(cinematicBackdrop.position.y, 26 + cameraRig.pitch * 3.5, 3.0, dt);
    }
    return;
  }
  const targetX = clamp(0.07 + player.group.position.x * -0.010, 0.01, 0.13);
  const targetY = clamp(0.07 + (40 - player.group.position.z) * 0.002, 0.01, 0.13);
  generatedSceneOffset.x = damp(generatedSceneOffset.x, targetX, 4, dt);
  generatedSceneOffset.y = damp(generatedSceneOffset.y, targetY, 4, dt);
  generatedAssets.street.offset.copy(generatedSceneOffset);
  generatedAssets.cinematicStreet.offset.copy(generatedSceneOffset);
}

function updateStreetLife(dt) {
  for (const neon of streetLife.neonMaterials) {
    const pulse = 0.9 + Math.sin(elapsed * neon.tempo + neon.phase) * 0.06;
    const twitch = Math.sin(elapsed * 19.0 + neon.phase * 3.1) > 0.965 ? 0.58 : 1;
    neon.material.opacity = neon.baseOpacity * pulse * twitch;
  }

  for (const vehicle of streetLife.traffic) {
    vehicle.group.position.z += vehicle.speed * dt;
    if (vehicle.speed > 0 && vehicle.group.position.z > vehicle.maxZ) {
      vehicle.group.position.z = vehicle.minZ;
    } else if (vehicle.speed < 0 && vehicle.group.position.z < vehicle.minZ) {
      vehicle.group.position.z = vehicle.maxZ;
    }
  }
}

function updateRain(dt) {
  const positions = rain.positions;
  const followZ = player.group.position.z;
  for (let i = 0; i < rain.count; i += 1) {
    const yIndex = i * 3 + 1;
    const zIndex = i * 3 + 2;
    positions[yIndex] -= dt * (18 + (i % 7));
    positions[i * 3] += dt * -1.1;
    if (positions[yIndex] < 0.15) {
      positions[yIndex] = 22 + rng() * 28;
      positions[i * 3] = player.group.position.x - 34 + rng() * 68;
      positions[zIndex] = followZ - 54 + rng() * 108;
    }
  }
  rain.points.geometry.attributes.position.needsUpdate = true;
}

function updateFloatingText(dt) {
  for (let i = floatingTexts.length - 1; i >= 0; i -= 1) {
    const item = floatingTexts[i];
    item.life -= dt;
    item.sprite.position.y += dt * 1.15;
    item.sprite.position.addScaledVector(item.velocity, dt);
    item.sprite.material.opacity = clamp(item.life / item.maxLife, 0, 1);
    item.sprite.scale.multiplyScalar(1 + dt * 0.18);
    if (item.life <= 0) {
      scene.remove(item.sprite);
      floatingTexts.splice(i, 1);
    }
  }
}

function updateSparks(dt) {
  for (let i = sparks.length - 1; i >= 0; i -= 1) {
    const spark = sparks[i];
    spark.life -= dt;
    spark.mesh.position.addScaledVector(spark.velocity, dt);
    spark.velocity.y -= dt * 3.8;
    spark.mesh.material.opacity = clamp(spark.life / spark.maxLife, 0, 1);
    if (spark.life <= 0) {
      scene.remove(spark.mesh);
      sparks.splice(i, 1);
    }
  }
}

function spawnActorAfterimage(rig, worldPosition, color, opacity) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: rig.texture,
      color,
      transparent: true,
      opacity,
      alphaTest: 0.04,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  rig.group.getWorldPosition(sprite.position);
  sprite.position.z -= 0.12;
  sprite.scale.set(rig.baseWidth * rig.group.scale.x, rig.baseHeight * rig.group.scale.y, 1);
  sprite.material.rotation = rig.lean;
  scene.add(sprite);
  afterimages.push({
    sprite,
    velocity: new THREE.Vector3((rng() - 0.5) * 0.12, 0.12 + rng() * 0.08, (rng() - 0.5) * 0.12),
    life: 0.26,
    maxLife: 0.26,
  });
}

function updateAfterimages(dt) {
  for (let i = afterimages.length - 1; i >= 0; i -= 1) {
    const image = afterimages[i];
    image.life -= dt;
    image.sprite.position.addScaledVector(image.velocity, dt);
    image.sprite.material.opacity = clamp((image.life / image.maxLife) * 0.38, 0, 0.38);
    image.sprite.scale.x *= 1 + dt * 0.7;
    image.sprite.scale.y *= 1 + dt * 0.25;
    if (image.life <= 0) {
      scene.remove(image.sprite);
      afterimages.splice(i, 1);
    }
  }
}

function updateSceneMotion(dt) {
  if (encounterTimer > 0) {
    encounterTimer -= dt;
    if (encounterTimer <= 0) encounterBanner.classList.remove("show");
  }
  if (vignetteTimer > 0) {
    vignetteTimer -= dt;
    damageVignette.classList.add("show");
  } else {
    damageVignette.classList.remove("show");
  }
  if (statusTimer > 0) {
    statusTimer -= dt;
    if (statusTimer <= 0 && !gameOver) {
      statusStrip.textContent = enemies.some((enemy) => !enemy.dead) ? "敵影追蹤" : "街區暫時清空";
      statusStrip.classList.toggle("hot", enemies.some((enemy) => !enemy.dead));
    }
  }
}

function updateHud() {
  healthFill.style.transform = `scaleX(${clamp(player.health / player.maxHealth, 0, 1)})`;
  staminaFill.style.transform = `scaleX(${clamp(player.stamina / player.maxStamina, 0, 1)})`;
  waveReadout.textContent = `${Math.max(1, wave || 1)}`;
  enemyReadout.textContent = `${enemies.filter((enemy) => !enemy.dead).length}`;
  comboReadout.textContent = `${player.combo}`;
}

function createFloatingText(text, position, color) {
  const texture = canvasTexture(256, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = text.length > 4 ? "800 46px Arial, sans-serif" : "900 62px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(0,0,0,0.72)";
    ctx.strokeText(text, w / 2, h / 2);
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, h / 2);
  });
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  sprite.position.copy(position);
  sprite.position.y += 1.35;
  sprite.scale.set(1.4, 0.7, 1);
  scene.add(sprite);
  floatingTexts.push({
    sprite,
    velocity: new THREE.Vector3((rng() - 0.5) * 0.9, 0, (rng() - 0.5) * 0.9),
    life: 0.82,
    maxLife: 0.82,
  });
}

function addSparkBurst(position, color, count, speed) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  for (let i = 0; i < count; i += 1) {
    const spark = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.2), material.clone());
    spark.position.copy(position);
    spark.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    const velocity = new THREE.Vector3(rng() - 0.5, rng() * 0.9, rng() - 0.5).normalize().multiplyScalar(speed * (0.5 + rng()));
    scene.add(spark);
    sparks.push({
      mesh: spark,
      velocity,
      life: 0.32 + rng() * 0.28,
      maxLife: 0.6,
    });
  }
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(getRenderPixelRatio());
  renderer.setSize(width, height);
}
