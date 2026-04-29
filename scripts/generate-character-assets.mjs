import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

class NodeFileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }

  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      const base64 = Buffer.from(buffer).toString("base64");
      this.result = `data:${blob.type};base64,${base64}`;
      this.onloadend?.();
    });
  }
}

globalThis.FileReader = NodeFileReader;

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "../src/assets/characters");

const characters = [
  {
    file: "hk-hero-raincoat.glb",
    rootName: "HKHeroRaincoat",
    displayName: "雨衣主角",
    build: "hero",
    weapon: "blade",
    hair: "long",
    colors: {
      skin: 0x8b6148,
      hair: 0x0c0b0a,
      jacket: 0xffa319,
      jacketDark: 0x17110c,
      shirt: 0x101314,
      pants: 0x111316,
      boots: 0x0b0c0d,
      trim: 0xffd76d,
      accent: 0x2df4ed,
      secondary: 0xff365d,
      metal: 0xd7d1bf,
    },
  },
  {
    file: "hk-enemy-red-floral.glb",
    rootName: "HKEnemyRedFloral",
    displayName: "紅花襯衫打手",
    build: "brawler",
    weapon: "baton",
    hair: "quiff",
    pattern: "floral",
    colors: {
      skin: 0x7a553d,
      hair: 0x090807,
      jacket: 0xa41522,
      jacketDark: 0x22100f,
      shirt: 0xe8d6ba,
      pants: 0x101112,
      boots: 0x090909,
      trim: 0xffd8a0,
      accent: 0xff405c,
      secondary: 0xffd76d,
      metal: 0xc8a55a,
    },
  },
  {
    file: "hk-enemy-purple-knife.glb",
    rootName: "HKEnemyPurpleKnife",
    displayName: "紫皮衣刀手",
    build: "knife",
    weapon: "knife",
    hair: "spikes",
    colors: {
      skin: 0x715146,
      hair: 0x4a1a72,
      jacket: 0x542078,
      jacketDark: 0x120915,
      shirt: 0x151018,
      pants: 0x100d13,
      boots: 0x0a090c,
      trim: 0xd2a7ff,
      accent: 0xb56bff,
      secondary: 0xff2f6d,
      metal: 0xb8a8d8,
    },
  },
  {
    file: "hk-enemy-white-boss.glb",
    rootName: "HKEnemyWhiteBoss",
    displayName: "白西裝堂主",
    build: "boss",
    weapon: "cane",
    hair: "slick",
    colors: {
      skin: 0x7d5b43,
      hair: 0x080807,
      jacket: 0xf1eadb,
      jacketDark: 0x0b0b0c,
      shirt: 0x111111,
      pants: 0xf0e6d5,
      boots: 0xe7dece,
      trim: 0xffd76d,
      accent: 0xffd76d,
      secondary: 0xff365d,
      metal: 0xe0bb60,
    },
  },
];

function material(name, color, options = {}) {
  return new THREE.MeshStandardMaterial({
    name,
    color,
    roughness: options.roughness ?? 0.42,
    metalness: options.metalness ?? 0.08,
    envMapIntensity: options.envMapIntensity ?? 1,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
  });
}

function roundedBox(width, height, depth, radius = 0.035, segments = 4) {
  return new RoundedBoxGeometry(width, height, depth, segments, Math.min(radius, width * 0.45, height * 0.45, depth * 0.45));
}

function ellipsoid(width, height, depth, widthSegments = 28, heightSegments = 18) {
  const geometry = new THREE.SphereGeometry(0.5, widthSegments, heightSegments);
  geometry.scale(width, height, depth);
  return geometry;
}

function taperedCylinder(topRadius, bottomRadius, height, radialSegments = 18) {
  return new THREE.CylinderGeometry(topRadius, bottomRadius, height, radialSegments, 2);
}

function addBone(parent, name, position) {
  const bone = new THREE.Bone();
  bone.name = name;
  bone.position.set(position[0], position[1], position[2]);
  parent.add(bone);
  return bone;
}

function addMesh(parent, name, geometry, mat, position, rotation = null, scale = null) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function buildRig(rootName) {
  const root = new THREE.Group();
  root.name = rootName;
  const rigRoot = addBone(root, "RigRoot", [0, 0, 0]);
  const hips = addBone(rigRoot, "Hips", [0, 0.94, 0]);
  const spine = addBone(hips, "Spine", [0, 0.3, 0]);
  const chest = addBone(spine, "Chest", [0, 0.42, 0]);
  const neck = addBone(chest, "Neck", [0, 0.31, 0]);
  const head = addBone(neck, "Head", [0, 0.2, 0.02]);

  const leftArm = addBone(chest, "LeftArm", [-0.46, 0.19, 0.02]);
  const leftForeArm = addBone(leftArm, "LeftForeArm", [0, -0.43, 0.04]);
  const leftHand = addBone(leftForeArm, "LeftHand", [0, -0.36, 0.04]);
  const rightArm = addBone(chest, "RightArm", [0.46, 0.19, 0.02]);
  const rightForeArm = addBone(rightArm, "RightForeArm", [0, -0.43, 0.04]);
  const rightHand = addBone(rightForeArm, "RightHand", [0, -0.36, 0.04]);

  const leftUpLeg = addBone(hips, "LeftUpLeg", [-0.19, -0.08, 0.02]);
  const leftLeg = addBone(leftUpLeg, "LeftLeg", [0, -0.46, 0.02]);
  const leftFoot = addBone(leftLeg, "LeftFoot", [0, -0.43, 0.08]);
  const rightUpLeg = addBone(hips, "RightUpLeg", [0.19, -0.08, 0.02]);
  const rightLeg = addBone(rightUpLeg, "RightLeg", [0, -0.46, 0.02]);
  const rightFoot = addBone(rightLeg, "RightFoot", [0, -0.43, 0.08]);

  return {
    root,
    bones: {
      rigRoot,
      hips,
      spine,
      chest,
      neck,
      head,
      leftArm,
      leftForeArm,
      leftHand,
      rightArm,
      rightForeArm,
      rightHand,
      leftUpLeg,
      leftLeg,
      leftFoot,
      rightUpLeg,
      rightLeg,
      rightFoot,
    },
  };
}

function addCharacterMeshes(def, bones) {
  const c = def.colors;
  const mats = {
    skin: material("mat_skin", c.skin, { roughness: 0.58 }),
    hair: material("mat_hair", c.hair, { roughness: 0.36, metalness: 0.04 }),
    jacket: material("mat_jacket", c.jacket, { roughness: def.build === "hero" ? 0.18 : 0.34, metalness: def.build === "hero" ? 0.18 : 0.08, envMapIntensity: 1.25 }),
    jacketDark: material("mat_jacket_dark", c.jacketDark, { roughness: 0.44, metalness: 0.06 }),
    shirt: material("mat_shirt", c.shirt, { roughness: 0.62, metalness: 0.03 }),
    pants: material("mat_pants", c.pants, { roughness: 0.5, metalness: 0.08 }),
    boots: material("mat_boots", c.boots, { roughness: 0.28, metalness: 0.18, envMapIntensity: 1.2 }),
    trim: material("mat_trim", c.trim, { roughness: 0.2, metalness: 0.62, envMapIntensity: 1.4, emissive: c.trim, emissiveIntensity: 0.03 }),
    accent: material("mat_accent", c.accent, { roughness: 0.12, metalness: 0.34, envMapIntensity: 1.5, emissive: c.accent, emissiveIntensity: 0.45 }),
    secondary: material("mat_secondary", c.secondary, { roughness: 0.18, metalness: 0.3, envMapIntensity: 1.3, emissive: c.secondary, emissiveIntensity: 0.28 }),
    metal: material("mat_metal", c.metal, { roughness: 0.16, metalness: 0.82, envMapIntensity: 1.55 }),
    blackGlass: material("mat_sunglasses", 0x050607, { roughness: 0.08, metalness: 0.42, envMapIntensity: 1.4, emissive: c.accent, emissiveIntensity: 0.08 }),
  };

  addMesh(bones.hips, "Pelvis", ellipsoid(0.58, 0.27, 0.38, 26, 14), mats.pants, [0, -0.06, 0.05]);
  addMesh(bones.spine, "TorsoShirt", ellipsoid(def.build === "boss" ? 0.67 : 0.6, 0.68, 0.33, 32, 18), mats.shirt, [0, 0.18, 0.08], [-0.03, 0, 0]);
  addMesh(bones.chest, "JacketChest", ellipsoid(def.build === "boss" ? 0.86 : 0.76, 0.58, 0.22, 32, 18), mats.jacket, [0, -0.1, 0.19], [-0.08, 0, 0]);
  addMesh(bones.chest, "JacketUpperBack", ellipsoid(def.build === "boss" ? 0.82 : 0.74, 0.58, 0.18, 32, 18), mats.jacket, [0, -0.1, -0.15], [0.08, 0, 0]);
  addMesh(bones.chest, "LeftLapel", roundedBox(0.13, 0.5, 0.045, 0.022), def.build === "boss" ? mats.jacketDark : mats.trim, [-0.14, -0.08, 0.33], [-0.14, 0.04, -0.28]);
  addMesh(bones.chest, "RightLapel", roundedBox(0.13, 0.5, 0.045, 0.022), def.build === "boss" ? mats.jacketDark : mats.trim, [0.14, -0.08, 0.33], [-0.14, -0.04, 0.28]);
  addMesh(bones.hips, "Belt", roundedBox(0.68, 0.075, 0.36, 0.026), mats.jacketDark, [0, 0.02, 0.13]);

  const coatLength = def.build === "hero" ? 0.84 : 0.66;
  addMesh(bones.hips, "CoatBack", roundedBox(0.66, coatLength, 0.07, 0.035), mats.jacket, [0, -0.28, -0.2], [0.14, 0, 0]);
  addMesh(bones.hips, "LeftCoatPanel", roundedBox(0.24, coatLength * 0.92, 0.06, 0.03), mats.jacket, [-0.19, -0.28, 0.25], [-0.1, 0.08, 0.08]);
  addMesh(bones.hips, "RightCoatPanel", roundedBox(0.24, coatLength * 0.92, 0.06, 0.03), mats.jacket, [0.19, -0.28, 0.25], [-0.1, -0.08, -0.08]);

  if (def.pattern === "floral") {
    for (let i = 0; i < 18; i += 1) {
      const x = -0.28 + (i % 6) * 0.11;
      const y = -0.32 + Math.floor(i / 6) * 0.19;
      const flowerMat = i % 2 ? mats.trim : mats.secondary;
      addMesh(bones.chest, `FloralPatch_${i}`, new THREE.CircleGeometry(0.032 + (i % 3) * 0.006, 9), flowerMat, [x, y, 0.285], [0, 0, 0]);
    }
  }

  if (def.build === "hero") {
    addMesh(bones.chest, "RaincoatFoldedHood", ellipsoid(0.44, 0.24, 0.2, 24, 12), mats.jacket, [0, 0.31, -0.24], [0.06, 0, 0]);
    addMesh(bones.chest, "RaincoatBackStripe", roundedBox(0.48, 0.045, 0.035, 0.014), mats.trim, [0, 0.12, -0.23], [0.08, 0, 0]);
    addMesh(bones.chest, "RaincoatBackGlow", roundedBox(0.045, 0.44, 0.03, 0.012), mats.accent, [0, -0.12, -0.235], [0.08, 0, 0]);
    addMesh(bones.chest, "NeonChestStripe", roundedBox(0.075, 0.5, 0.035, 0.014), mats.accent, [0.18, -0.09, 0.33], [-0.1, 0, 0.04]);
    addMesh(bones.chest, "RedChestStripe", roundedBox(0.055, 0.42, 0.03, 0.012), mats.secondary, [-0.18, -0.11, 0.33], [-0.1, 0, -0.04]);
    addMesh(bones.chest, "OpenRaincoatCollarLeft", roundedBox(0.11, 0.24, 0.05, 0.02), mats.jacketDark, [-0.2, 0.14, 0.31], [-0.24, 0, -0.38]);
    addMesh(bones.chest, "OpenRaincoatCollarRight", roundedBox(0.11, 0.24, 0.05, 0.02), mats.jacketDark, [0.2, 0.14, 0.31], [-0.24, 0, 0.38]);
  }

  if (def.build === "boss") {
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.014, 8, 48, Math.PI * 1.24), mats.trim);
    chain.name = "GoldNeckChain";
    chain.position.set(0, 0.04, 0.31);
    chain.rotation.set(0.14, 0, Math.PI * 0.88);
    bones.chest.add(chain);
  }

  addMesh(bones.neck, "NeckMesh", taperedCylinder(0.11, 0.135, 0.16, 18), mats.skin, [0, 0.04, 0.03]);
  addMesh(bones.head, "HeadMesh", ellipsoid(0.42, 0.52, 0.38, 32, 20), mats.skin, [0, 0.05, 0.04], [0.02, 0, 0]);
  addMesh(bones.head, "CheekLeft", ellipsoid(0.1, 0.08, 0.035, 16, 8), mats.skin, [-0.1, -0.01, 0.23]);
  addMesh(bones.head, "CheekRight", ellipsoid(0.1, 0.08, 0.035, 16, 8), mats.skin, [0.1, -0.01, 0.23]);
  addMesh(bones.head, "Nose", ellipsoid(0.052, 0.08, 0.085, 14, 8), mats.skin, [0, 0.035, 0.245], [0.08, 0, 0]);
  addMesh(bones.head, "MouthShadow", roundedBox(0.12, 0.018, 0.012, 0.006), mats.jacketDark, [0, -0.085, 0.245]);
  addHair(def, bones.head, mats);
  addMesh(bones.head, "SunglassesBridge", roundedBox(0.12, 0.018, 0.025, 0.008), mats.blackGlass, [0, 0.085, 0.255]);
  addMesh(bones.head, "LeftSunglassLens", roundedBox(0.13, 0.055, 0.028, 0.014), mats.blackGlass, [-0.09, 0.075, 0.262]);
  addMesh(bones.head, "RightSunglassLens", roundedBox(0.13, 0.055, 0.028, 0.014), mats.blackGlass, [0.09, 0.075, 0.262]);

  addLimbMeshes(def, bones, mats);
  addWeapon(def, bones.rightHand, mats);
}

function addHair(def, head, mats) {
  const cap = addMesh(head, "HairCap", new THREE.SphereGeometry(0.255, 26, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mats.hair, [0, 0.18, -0.015], [0.02, 0, 0], [1.02, 0.58, 0.92]);
  if (def.hair === "long") {
    addMesh(head, "LeftWetHair", ellipsoid(0.11, 0.58, 0.07, 14, 16), mats.hair, [-0.21, -0.12, -0.08], [0.12, 0, 0.16]);
    addMesh(head, "RightWetHair", ellipsoid(0.11, 0.58, 0.07, 14, 16), mats.hair, [0.21, -0.12, -0.08], [0.12, 0, -0.16]);
    addMesh(head, "BackWetHair", ellipsoid(0.26, 0.6, 0.08, 18, 16), mats.hair, [0, -0.15, -0.18], [0.12, 0, 0]);
  } else if (def.hair === "spikes") {
    for (let i = -2; i <= 2; i += 1) {
      addMesh(head, `HairSpike_${i + 2}`, new THREE.ConeGeometry(0.045, 0.22, 7), mats.hair, [i * 0.056, 0.34 + Math.abs(i) * 0.015, 0.035], [0.42 - Math.abs(i) * 0.05, 0, -i * 0.16]);
    }
  } else if (def.hair === "quiff") {
    addMesh(head, "QuiffFront", ellipsoid(0.22, 0.12, 0.16, 16, 10), mats.hair, [0, 0.23, 0.11], [-0.28, 0, 0]);
    addMesh(head, "SideburnLeft", ellipsoid(0.075, 0.22, 0.04, 12, 10), mats.hair, [-0.19, 0.02, 0.03], [0, 0, 0.1]);
    addMesh(head, "SideburnRight", ellipsoid(0.075, 0.22, 0.04, 12, 10), mats.hair, [0.19, 0.02, 0.03], [0, 0, -0.1]);
  } else if (def.hair === "slick") {
    cap.scale.set(1.05, 0.42, 0.9);
    addMesh(head, "SlickPart", roundedBox(0.02, 0.23, 0.035, 0.008), mats.skin, [-0.07, 0.19, 0.08], [-0.15, 0, -0.12]);
  }
}

function addLimbMeshes(def, bones, mats) {
  const shoulderMat = def.build === "hero" ? mats.jacket : mats.jacket;
  addMesh(bones.leftArm, "LeftShoulderPad", ellipsoid(0.24, 0.13, 0.3, 18, 10), shoulderMat, [-0.01, -0.04, 0.02], [0, 0, -0.08]);
  addMesh(bones.rightArm, "RightShoulderPad", ellipsoid(0.24, 0.13, 0.3, 18, 10), shoulderMat, [0.01, -0.04, 0.02], [0, 0, 0.08]);
  addMesh(bones.leftArm, "LeftUpperArmMesh", new THREE.CapsuleGeometry(0.072, 0.36, 8, 18), mats.jacket, [0, -0.2, 0.04], [0.08, 0, -0.06]);
  addMesh(bones.rightArm, "RightUpperArmMesh", new THREE.CapsuleGeometry(0.072, 0.36, 8, 18), mats.jacket, [0, -0.2, 0.04], [0.08, 0, 0.06]);
  addMesh(bones.leftForeArm, "LeftForeArmMesh", new THREE.CapsuleGeometry(0.066, 0.34, 8, 18), mats.jacketDark, [0, -0.16, 0.04], [0.02, 0, -0.04]);
  addMesh(bones.rightForeArm, "RightForeArmMesh", new THREE.CapsuleGeometry(0.066, 0.34, 8, 18), mats.jacketDark, [0, -0.16, 0.04], [0.02, 0, 0.04]);
  addMesh(bones.leftHand, "LeftHandMesh", ellipsoid(0.14, 0.12, 0.17, 16, 10), mats.skin, [0, -0.04, 0.05]);
  addMesh(bones.rightHand, "RightHandMesh", ellipsoid(0.14, 0.12, 0.17, 16, 10), mats.skin, [0, -0.04, 0.05]);

  addMesh(bones.leftUpLeg, "LeftThighMesh", new THREE.CapsuleGeometry(0.1, 0.42, 8, 18), mats.pants, [0, -0.23, 0.04], [0.02, 0, 0.03]);
  addMesh(bones.rightUpLeg, "RightThighMesh", new THREE.CapsuleGeometry(0.1, 0.42, 8, 18), mats.pants, [0, -0.23, 0.04], [0.02, 0, -0.03]);
  addMesh(bones.leftLeg, "LeftShinMesh", new THREE.CapsuleGeometry(0.088, 0.38, 8, 18), mats.pants, [0, -0.2, 0.04], [0.02, 0, 0.02]);
  addMesh(bones.rightLeg, "RightShinMesh", new THREE.CapsuleGeometry(0.088, 0.38, 8, 18), mats.pants, [0, -0.2, 0.04], [0.02, 0, -0.02]);
  addMesh(bones.leftFoot, "LeftBootMesh", ellipsoid(0.22, 0.12, 0.36, 18, 10), mats.boots, [0, -0.04, 0.12]);
  addMesh(bones.rightFoot, "RightBootMesh", ellipsoid(0.22, 0.12, 0.36, 18, 10), mats.boots, [0, -0.04, 0.12]);
}

function addWeapon(def, hand, mats) {
  const weapon = new THREE.Group();
  weapon.name = `Weapon_${def.weapon}`;
  weapon.position.set(0.02, -0.1, 0.12);
  weapon.rotation.set(-0.32, -0.2, -0.18);
  hand.add(weapon);

  if (def.weapon === "blade") {
    addMesh(weapon, "WeaponGrip", new THREE.CylinderGeometry(0.032, 0.035, 0.36, 12), mats.jacketDark, [0, 0, 0], [Math.PI / 2, 0, 0]);
    addMesh(weapon, "WeaponBlade", roundedBox(0.052, 0.035, 1.28, 0.014), mats.metal, [0, 0, 0.72]);
    addMesh(weapon, "WeaponBladeGlow", roundedBox(0.014, 0.042, 1.18, 0.006), mats.accent, [0.035, 0, 0.76]);
  } else if (def.weapon === "knife") {
    addMesh(weapon, "WeaponKnifeGrip", new THREE.CylinderGeometry(0.03, 0.032, 0.26, 10), mats.jacketDark, [0, 0, 0], [Math.PI / 2, 0, 0]);
    addMesh(weapon, "WeaponKnifeBlade", roundedBox(0.04, 0.028, 0.54, 0.012), mats.metal, [0, 0, 0.34]);
  } else if (def.weapon === "cane") {
    addMesh(weapon, "WeaponCane", new THREE.CylinderGeometry(0.026, 0.03, 1.12, 12), mats.metal, [0, 0, 0.46], [Math.PI / 2, 0, 0]);
    addMesh(weapon, "WeaponCaneKnob", new THREE.SphereGeometry(0.065, 14, 10), mats.trim, [0, 0, 1.04]);
  } else {
    addMesh(weapon, "WeaponBaton", new THREE.CylinderGeometry(0.036, 0.04, 0.92, 12), mats.metal, [0, 0, 0.36], [Math.PI / 2, 0, 0]);
    addMesh(weapon, "WeaponBatonGrip", roundedBox(0.11, 0.07, 0.11, 0.025), mats.jacketDark, [0, 0, -0.08]);
  }
}

function quatValues(eulers) {
  const quat = new THREE.Quaternion();
  return eulers.flatMap(([x, y, z]) => quat.setFromEuler(new THREE.Euler(x, y, z)).toArray());
}

function qTrack(name, times, eulers) {
  return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, quatValues(eulers));
}

function pTrack(name, times, values) {
  return new THREE.VectorKeyframeTrack(`${name}.position`, times, values.flat());
}

function makeClips() {
  const clips = [];
  clips.push(new THREE.AnimationClip("Idle", 1.5, [
    pTrack("Hips", [0, 0.75, 1.5], [[0, 0.94, 0], [0, 0.965, 0], [0, 0.94, 0]]),
    qTrack("Spine", [0, 0.75, 1.5], [[0.02, 0.02, 0], [-0.015, -0.02, 0], [0.02, 0.02, 0]]),
    qTrack("LeftArm", [0, 0.75, 1.5], [[0.08, 0, 0.08], [0.12, 0, 0.05], [0.08, 0, 0.08]]),
    qTrack("RightArm", [0, 0.75, 1.5], [[0.08, 0, -0.08], [0.12, 0, -0.05], [0.08, 0, -0.08]]),
  ]));

  clips.push(new THREE.AnimationClip("Walk", 0.82, [
    pTrack("Hips", [0, 0.205, 0.41, 0.615, 0.82], [[0, 0.94, 0], [0, 0.975, 0.02], [0, 0.94, 0], [0, 0.975, -0.02], [0, 0.94, 0]]),
    qTrack("LeftUpLeg", [0, 0.205, 0.41, 0.615, 0.82], [[0.36, 0, 0.03], [0.05, 0, 0.02], [-0.34, 0, -0.02], [0.02, 0, 0.01], [0.36, 0, 0.03]]),
    qTrack("RightUpLeg", [0, 0.205, 0.41, 0.615, 0.82], [[-0.34, 0, -0.02], [0.02, 0, 0.01], [0.36, 0, 0.03], [0.05, 0, 0.02], [-0.34, 0, -0.02]]),
    qTrack("LeftArm", [0, 0.41, 0.82], [[-0.18, 0, 0.08], [0.25, 0, 0.04], [-0.18, 0, 0.08]]),
    qTrack("RightArm", [0, 0.41, 0.82], [[0.25, 0, -0.04], [-0.18, 0, -0.08], [0.25, 0, -0.04]]),
    qTrack("Spine", [0, 0.41, 0.82], [[0.02, 0.05, 0.02], [0.02, -0.05, -0.02], [0.02, 0.05, 0.02]]),
  ]));

  clips.push(new THREE.AnimationClip("Run", 0.56, [
    pTrack("Hips", [0, 0.14, 0.28, 0.42, 0.56], [[0, 0.94, 0], [0, 1.0, 0.03], [0, 0.94, 0], [0, 1.0, -0.03], [0, 0.94, 0]]),
    qTrack("LeftUpLeg", [0, 0.14, 0.28, 0.42, 0.56], [[0.62, 0, 0.04], [0.12, 0, 0.02], [-0.58, 0, -0.03], [0.04, 0, 0.01], [0.62, 0, 0.04]]),
    qTrack("RightUpLeg", [0, 0.14, 0.28, 0.42, 0.56], [[-0.58, 0, -0.03], [0.04, 0, 0.01], [0.62, 0, 0.04], [0.12, 0, 0.02], [-0.58, 0, -0.03]]),
    qTrack("LeftArm", [0, 0.28, 0.56], [[-0.35, 0, 0.1], [0.42, 0, 0.02], [-0.35, 0, 0.1]]),
    qTrack("RightArm", [0, 0.28, 0.56], [[0.42, 0, -0.02], [-0.35, 0, -0.1], [0.42, 0, -0.02]]),
    qTrack("Spine", [0, 0.28, 0.56], [[-0.08, 0.08, 0.03], [-0.08, -0.08, -0.03], [-0.08, 0.08, 0.03]]),
  ]));

  clips.push(new THREE.AnimationClip("Jump", 0.72, [
    pTrack("Hips", [0, 0.18, 0.4, 0.72], [[0, 0.94, 0], [0, 1.08, 0.08], [0, 1.18, 0.02], [0, 0.94, 0]]),
    qTrack("LeftUpLeg", [0, 0.28, 0.72], [[-0.1, 0, 0], [0.65, 0, 0.02], [0.02, 0, 0]]),
    qTrack("RightUpLeg", [0, 0.28, 0.72], [[-0.1, 0, 0], [0.46, 0, -0.02], [0.02, 0, 0]]),
    qTrack("LeftArm", [0, 0.28, 0.72], [[0.12, 0, 0.08], [-0.55, 0, 0.18], [0.08, 0, 0.08]]),
    qTrack("RightArm", [0, 0.28, 0.72], [[0.12, 0, -0.08], [-0.4, 0, -0.2], [0.08, 0, -0.08]]),
    qTrack("Spine", [0, 0.28, 0.72], [[0, 0, 0], [-0.24, 0, 0], [0.02, 0, 0]]),
  ]));

  clips.push(new THREE.AnimationClip("Attack_Light", 0.48, [
    pTrack("Hips", [0, 0.16, 0.32, 0.48], [[0, 0.94, 0], [0, 0.94, 0.08], [0, 0.94, 0.18], [0, 0.94, 0]]),
    qTrack("Spine", [0, 0.14, 0.3, 0.48], [[0, -0.22, 0], [-0.12, -0.5, -0.08], [-0.22, 0.44, 0.1], [0.02, 0, 0]]),
    qTrack("RightArm", [0, 0.14, 0.3, 0.48], [[-0.12, 0.2, -0.2], [-0.72, -0.34, -0.58], [-0.1, 0.54, 0.46], [0.08, 0, -0.08]]),
    qTrack("RightForeArm", [0, 0.14, 0.3, 0.48], [[-0.1, 0, 0.16], [-0.34, 0, -0.28], [0.1, 0, 0.5], [0, 0, 0]]),
    qTrack("LeftArm", [0, 0.25, 0.48], [[0.18, 0, 0.18], [0.35, 0, 0.28], [0.08, 0, 0.08]]),
  ]));

  clips.push(new THREE.AnimationClip("Attack_Heavy", 0.78, [
    pTrack("Hips", [0, 0.22, 0.52, 0.78], [[0, 0.94, 0], [0, 0.9, -0.06], [0, 0.96, 0.3], [0, 0.94, 0]]),
    qTrack("Spine", [0, 0.22, 0.52, 0.78], [[0.05, -0.5, -0.05], [-0.34, -0.82, -0.22], [-0.3, 0.72, 0.28], [0.02, 0, 0]]),
    qTrack("RightArm", [0, 0.22, 0.52, 0.78], [[-0.54, -0.3, -0.72], [-1.05, -0.62, -0.9], [-0.12, 0.8, 0.82], [0.08, 0, -0.08]]),
    qTrack("RightForeArm", [0, 0.22, 0.52, 0.78], [[-0.34, 0, -0.3], [-0.48, 0, -0.52], [0.16, 0, 0.8], [0, 0, 0]]),
    qTrack("LeftArm", [0, 0.52, 0.78], [[0.32, 0, 0.28], [0.62, 0, 0.4], [0.08, 0, 0.08]]),
  ]));

  clips.push(new THREE.AnimationClip("Skill_1", 0.52, [
    pTrack("Hips", [0, 0.16, 0.36, 0.52], [[0, 0.94, 0], [0, 0.9, 0.14], [0, 0.92, 0.46], [0, 0.94, 0]]),
    qTrack("Spine", [0, 0.16, 0.36, 0.52], [[-0.26, -0.2, 0], [-0.58, -0.24, -0.08], [-0.34, 0.4, 0.16], [0.02, 0, 0]]),
    qTrack("RightArm", [0, 0.16, 0.36, 0.52], [[-0.8, -0.4, -0.78], [-1.12, -0.58, -0.92], [-0.08, 0.72, 0.76], [0.08, 0, -0.08]]),
  ]));

  clips.push(new THREE.AnimationClip("Skill_2", 0.72, [
    qTrack("RigRoot", [0, 0.18, 0.36, 0.54, 0.72], [[0, 0, 0], [0, Math.PI * 0.5, 0], [0, Math.PI, 0], [0, -Math.PI * 0.5, 0], [0, 0, 0]]),
    qTrack("Spine", [0, 0.36, 0.72], [[-0.06, 0.24, 0.12], [-0.16, -0.36, -0.18], [0.02, 0, 0]]),
    qTrack("RightArm", [0, 0.36, 0.72], [[-0.42, -0.38, -0.62], [-0.18, 0.8, 0.82], [0.08, 0, -0.08]]),
    qTrack("LeftArm", [0, 0.36, 0.72], [[-0.12, 0, 0.42], [-0.18, 0, -0.2], [0.08, 0, 0.08]]),
  ]));

  clips.push(new THREE.AnimationClip("Skill_3", 0.92, [
    pTrack("Hips", [0, 0.28, 0.54, 0.72, 0.92], [[0, 0.94, 0], [0, 1.16, 0], [0, 0.8, 0.08], [0, 0.98, 0.02], [0, 0.94, 0]]),
    qTrack("Spine", [0, 0.28, 0.54, 0.92], [[0.05, 0, 0], [-0.28, 0, 0], [0.32, 0, 0], [0.02, 0, 0]]),
    qTrack("LeftUpLeg", [0, 0.54, 0.92], [[0.08, 0, 0], [0.54, 0, 0.08], [0.02, 0, 0]]),
    qTrack("RightUpLeg", [0, 0.54, 0.92], [[0.08, 0, 0], [0.38, 0, -0.08], [0.02, 0, 0]]),
    qTrack("RightArm", [0, 0.54, 0.92], [[-0.18, 0, -0.1], [-0.62, -0.2, -0.48], [0.08, 0, -0.08]]),
  ]));

  clips.push(new THREE.AnimationClip("Hit", 0.34, [
    pTrack("Hips", [0, 0.14, 0.34], [[0, 0.94, 0], [0, 0.94, -0.12], [0, 0.94, 0]]),
    qTrack("Spine", [0, 0.14, 0.34], [[0, 0, 0], [0.22, -0.18, 0.12], [0.02, 0, 0]]),
    qTrack("Head", [0, 0.14, 0.34], [[0, 0, 0], [0.16, 0.22, 0], [0, 0, 0]]),
  ]));

  clips.push(new THREE.AnimationClip("Death", 0.86, [
    pTrack("Hips", [0, 0.3, 0.86], [[0, 0.94, 0], [0, 0.72, -0.18], [0, 0.34, -0.48]]),
    qTrack("RigRoot", [0, 0.3, 0.86], [[0, 0, 0], [0.45, 0.2, -0.22], [1.3, 0.24, -0.58]]),
    qTrack("LeftArm", [0, 0.86], [[0.08, 0, 0.08], [0.7, 0, 0.54]]),
    qTrack("RightArm", [0, 0.86], [[0.08, 0, -0.08], [0.6, 0, -0.48]]),
  ]));

  for (const clip of clips) clip.optimize();
  return clips;
}

async function exportCharacter(def) {
  const { root, bones } = buildRig(def.rootName);
  addCharacterMeshes(def, bones);
  root.userData = {
    displayName: def.displayName,
    source: "Generated procedural GLB for VoidBlade MVP",
    coreClips: ["Idle", "Walk", "Run", "Jump", "Attack_Light", "Attack_Heavy", "Skill_1", "Death"],
  };
  const animations = makeClips();
  const exporter = new GLTFExporter();
  const arrayBuffer = await new Promise((resolvePromise, rejectPromise) => {
    exporter.parse(root, resolvePromise, rejectPromise, {
      animations,
      binary: true,
      trs: true,
      onlyVisible: true,
      includeCustomExtensions: false,
    });
  });
  const outputPath = resolve(outDir, def.file);
  await writeFile(outputPath, Buffer.from(arrayBuffer));
  return { outputPath, clips: animations.map((clip) => clip.name) };
}

await mkdir(outDir, { recursive: true });
const results = [];
for (const def of characters) results.push(await exportCharacter(def));
await writeFile(resolve(outDir, "LICENSES.md"), `# Character Asset Licenses

These GLB files are generated in-repository by \`scripts/generate-character-assets.mjs\`.
No third-party character meshes, actor likenesses, or commercial scans are embedded.

Generated files:
${results.map((item) => `- ${item.outputPath.split("/").pop()} (${item.clips.join(", ")})`).join("\n")}
`);

for (const result of results) {
  console.log(`${result.outputPath} :: ${result.clips.length} clips`);
}
