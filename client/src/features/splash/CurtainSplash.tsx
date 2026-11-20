import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import * as THREE from "three";
import { hasSeenSplash, markSplashSeen, prefersReducedMotion } from "./splashSession";

type Phase = "closed" | "opening" | "done";
type Side = "left" | "right";

const HOLD_MS = 650;
const OPEN_MS = 1650;

const GOLD = "#d4af37";
const GOLD_LIGHT = "#f8e496";
const GOLD_DARK = "#8a6712";

// --- 3D Cloth & Stage Constants ----------------------------------------------
const SEG_X = 96; // horizontal cloth resolution per curtain
const SEG_Y = 64; // vertical cloth resolution per curtain
const TIE_Y = 0.62; // normalized distance from top (0 = top rail, 1 = floor hem)
const FOLD_COUNT = 9.5;
const SWAG_COUNT = 5;

const KEYFRAMES =
  "@keyframes shadiSplashTitleIn{from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)}}" +
  "@keyframes shadiSplashFade{0%,82%{opacity:1}100%{opacity:0}}";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeSine = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;

// Width ratio of the gathered curtain at vertical fraction yf (0 = top, 1 = bottom)
function gatheredWidth(yf: number): number {
  if (yf < TIE_Y) return lerp(0.32, 0.095, smooth(yf / TIE_Y));
  return lerp(0.095, 0.24, smooth((yf - TIE_Y) / (1 - TIE_Y)));
}

// --- Procedural PBR Textures (Zero external network assets) -----------------
function createVelvetTextures(): {
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 256;
  const heightField = new Float32Array(size * size);

  // Build organic crushed-velvet + vertical pile micro-height field
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * Math.PI * 2;
      const ny = (y / size) * Math.PI * 2;

      const pile = Math.sin(nx * 48 + Math.sin(ny * 6) * 2.0) * 0.25;
      const crush1 = Math.sin(nx * 3 + Math.cos(ny * 4) * 1.8) * 0.4;
      const crush2 = Math.cos(nx * 7 - ny * 5 + Math.sin(nx * 2 + ny * 3)) * 0.35;
      heightField[y * size + x] = 0.5 + 0.5 * (pile + crush1 + crush2);
    }
  }

  // Convert height field to tangent-space normal map
  const normCanvas = document.createElement("canvas");
  normCanvas.width = size;
  normCanvas.height = size;
  const nCtx = normCanvas.getContext("2d")!;
  const nImg = nCtx.createImageData(size, size);

  // Pair with subtle roughness variation
  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext("2d")!;
  const rImg = rCtx.createImageData(size, size);

  const strength = 2.4;
  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;

      const dX = (heightField[y * size + xp] - heightField[y * size + xm]) * strength;
      const dY = (heightField[yp * size + x] - heightField[ym * size + x]) * strength;
      const invLen = 1 / Math.sqrt(dX * dX + dY * dY + 1);

      const idx = (y * size + x) * 4;
      nImg.data[idx] = Math.round((-dX * invLen * 0.5 + 0.5) * 255);
      nImg.data[idx + 1] = Math.round((-dY * invLen * 0.5 + 0.5) * 255);
      nImg.data[idx + 2] = Math.round((invLen * 0.5 + 0.5) * 255);
      nImg.data[idx + 3] = 255;

      const hVal = heightField[y * size + x];
      const roughByte = Math.round(lerp(195, 242, hVal)); // 0.76 - 0.95 roughness
      rImg.data[idx] = roughByte;
      rImg.data[idx + 1] = roughByte;
      rImg.data[idx + 2] = roughByte;
      rImg.data[idx + 3] = 255;
    }
  }

  nCtx.putImageData(nImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const normalMap = new THREE.CanvasTexture(normCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(6, 10);

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(6, 10);

  return { normalMap, roughnessMap };
}

function createGoldBraidNormalMap(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const weave = Math.sin(u * 12 + v * 12) * 0.5 + Math.cos(u * 12 - v * 12) * 0.5;
      const idx = (y * size + x) * 4;
      img.data[idx] = Math.round(128 + weave * 55);
      img.data[idx + 1] = Math.round(128 - weave * 55);
      img.data[idx + 2] = 235;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 24);
  return tex;
}

// --- 3D Scalloped Theatre Valance Builder ------------------------------------
function buildValanceGroup(
  worldW: number,
  worldH: number,
  velvetMat: THREE.MeshPhysicalMaterial,
  goldMat: THREE.MeshStandardMaterial,
): THREE.Group {
  const group = new THREE.Group();
  const topY = worldH / 2;
  const valanceH = Math.min(worldH * 0.21, 1.55);
  const fullW = worldW * 1.03;

  // 1. Top molded gold cornice beam
  const corniceGeo = new THREE.BoxGeometry(fullW, valanceH * 0.11, 0.28);
  const cornice = new THREE.Mesh(corniceGeo, goldMat);
  cornice.position.set(0, topY - valanceH * 0.04, 0.36);
  cornice.castShadow = true;
  group.add(cornice);

  // Helper to build a 3D pleated scalloped festoon strip across SWAG_COUNT arches
  const createScallopMesh = (
    dropDepth: number,
    zOffset: number,
    pleatAmp: number,
    mat: THREE.Material,
  ) => {
    const nx = 160;
    const ny = 24;
    const geo = new THREE.PlaneGeometry(fullW, dropDepth, nx, ny);
    const pos = geo.attributes.position as THREE.BufferAttribute;

    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const u = (px + fullW / 2) / fullW; // 0..1 across screen
      const v = 1 - (py + dropDepth / 2) / dropDepth; // 0 at top rail, 1 at bottom scallop

      const swagPhase = (u * SWAG_COUNT) % 1;
      const arch = Math.sin(Math.PI * swagPhase); // 0 at swag pinch, 1 at swag center

      // Catenary scallop silhouette
      const bottomY = dropDepth * (0.42 + 0.58 * Math.pow(arch, 0.85));
      const worldY = topY - v * bottomY;

      // Radial draped folds curving along each swag
      const drapeAngle = (swagPhase - 0.5) * Math.PI;
      const radialFold = Math.sin(drapeAngle * 11) * Math.sin(v * Math.PI) * pleatAmp;
      const bellyOut = Math.sin(v * Math.PI * 0.85) * arch * 0.16;

      pos.setXYZ(i, px, worldY, zOffset + radialFold + bellyOut);
    }

    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  // 2. Deep crimson velvet primary swags (back layer of valance)
  group.add(createScallopMesh(valanceH * 1.12, 0.24, 0.065, velvetMat));

  // 3. Luxurious gold scalloped overlay swags (front layer of valance)
  group.add(createScallopMesh(valanceH * 0.78, 0.31, 0.045, goldMat));

  // 4. Pleated side tails (jabots) & hanging gold tassels at each swag junction
  for (let s = 0; s <= SWAG_COUNT; s++) {
    const u = s / SWAG_COUNT;
    const xPos = (u - 0.5) * fullW;
    const isEdge = s === 0 || s === SWAG_COUNT;

    if (isEdge) {
      const jabotH = valanceH * 1.65;
      const jabotW = fullW * 0.065;
      const jGeo = new THREE.PlaneGeometry(jabotW, jabotH, 18, 20);
      const jPos = jGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < jPos.count; i++) {
        const jx = jPos.getX(i);
        const jy = jPos.getY(i);
        const ju = (jx + jabotW / 2) / jabotW;
        const jv = 1 - (jy + jabotH / 2) / jabotH;
        const taper = 1 - jv * 0.28;
        const foldZ = Math.sin(ju * Math.PI * 7) * 0.055 * (1 - jv * 0.3);
        jPos.setXYZ(i, xPos + jx * taper, topY - jv * jabotH, 0.32 + foldZ);
      }
      jGeo.computeVertexNormals();
      const jabot = new THREE.Mesh(jGeo, velvetMat);
      jabot.castShadow = true;
      group.add(jabot);
    }

    // Gold ornament + mini tassel at each swag pinch point
    const pinY = topY - valanceH * 0.44;
    const ornament = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), goldMat);
    ornament.scale.set(1, 1, 0.55);
    ornament.position.set(xPos, pinY, 0.38);
    group.add(ornament);

    const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.24, 14), goldMat);
    tassel.position.set(xPos, pinY - 0.16, 0.37);
    group.add(tassel);
  }

  return group;
}

// --- 3D Tie-Back Assembly (Twisted Gold Rope, Rosette & Multi-Strand Tassel) ---
interface TieBackRig {
  group: THREE.Group;
  ropeMesh: THREE.Mesh;
  rosetteGroup: THREE.Group;
  tasselGroup: THREE.Group;
}

function buildTieBackRig(goldMat: THREE.MeshStandardMaterial): TieBackRig {
  const group = new THREE.Group();
  group.visible = false;

  // Placeholder rope geometry (updated dynamically when opening)
  const ropeMesh = new THREE.Mesh(new THREE.BufferGeometry(), goldMat);
  ropeMesh.castShadow = true;
  group.add(ropeMesh);

  // Sculpted 3D rosette clasp
  const rosetteGroup = new THREE.Group();
  const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.024, 14, 28), goldMat);
  const centerDome = new THREE.Mesh(new THREE.SphereGeometry(0.062, 20, 16), goldMat);
  centerDome.scale.set(1, 1, 0.5);
  rosetteGroup.add(outerRing, centerDome);

  for (let p = 0; p < 12; p++) {
    const angle = (p / 12) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 10), goldMat);
    petal.scale.set(1.4, 0.75, 0.5);
    petal.rotation.z = angle;
    petal.position.set(Math.cos(angle) * 0.072, Math.sin(angle) * 0.072, 0.01);
    rosetteGroup.add(petal);
  }
  group.add(rosetteGroup);

  // Multi-strand hanging gold tassel
  const tasselGroup = new THREE.Group();
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.048, 0.08, 16), goldMat);
  cap.position.y = -0.09;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.012, 10, 20), goldMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = -0.13;
  tasselGroup.add(cap, collar);

  const strandCount = 22;
  const strandGeo = new THREE.CylinderGeometry(0.0055, 0.007, 0.42, 6);
  for (let s = 0; s < strandCount; s++) {
    const a = (s / strandCount) * Math.PI * 2;
    const ring = s % 2 === 0 ? 0.032 : 0.018;
    const strand = new THREE.Mesh(strandGeo, goldMat);
    strand.position.set(Math.cos(a) * ring, -0.34, Math.sin(a) * ring);
    strand.rotation.z = Math.cos(a) * -0.05;
    strand.rotation.x = Math.sin(a) * 0.05;
    tasselGroup.add(strand);
  }
  group.add(tasselGroup);

  return { group, ropeMesh, rosetteGroup, tasselGroup };
}

// --- Styles ------------------------------------------------------------------
const styles = {
  mount: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    display: "block",
    pointerEvents: "none",
  } satisfies CSSProperties,
  skip: {
    position: "absolute",
    right: 20,
    bottom: 28,
    zIndex: 3,
    padding: "9px 18px",
    fontSize: 14,
    fontWeight: 500,
    letterSpacing: "0.04em",
    fontFamily: "system-ui, sans-serif",
    color: GOLD_LIGHT,
    background: "rgba(18, 3, 6, 0.65)",
    backdropFilter: "blur(6px)",
    border: `1px solid ${GOLD}`,
    borderRadius: 6,
    cursor: "pointer",
  } satisfies CSSProperties,
};

function rootStyle(phase: Phase): CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    overflow: "hidden",
    pointerEvents: "auto",
    cursor: "pointer",
    animation: phase === "opening" ? `shadiSplashFade ${OPEN_MS}ms linear forwards` : "none",
  };
}

function titleStyle(phase: Phase): CSSProperties {
  const opening = phase === "opening";
  return {
    position: "absolute",
    inset: 0,
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    margin: 0,
    padding: "0 16px",
    textAlign: "center",
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: "clamp(34px, 7vw, 76px)",
    fontWeight: 700,
    letterSpacing: "0.06em",
    color: GOLD_LIGHT,
    textShadow: `0 2px 14px rgba(0,0,0,0.85), 0 0 28px rgba(212,175,55,0.45)`,
    opacity: opening ? 0 : 1,
    animation: opening ? "none" : "shadiSplashTitleIn 520ms ease-out",
    transition: opening ? `opacity ${Math.round(HOLD_MS * 0.85)}ms ease-in` : "none",
  };
}

export default function CurtainSplash() {
  const [phase, setPhase] = useState<Phase>(() =>
    !hasSeenSplash() && !prefersReducedMotion() ? "closed" : "done",
  );
  const markedRef = useRef(false);
  const skipRef = useRef<HTMLButtonElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>(phase);
  const openStartRef = useRef<number | null>(null);

  phaseRef.current = phase;

  const markOnce = () => {
    if (markedRef.current) return;
    markedRef.current = true;
    markSplashSeen();
  };

  const skip = () => {
    markOnce();
    setPhase("done");
  };

  // closed -> opening
  useEffect(() => {
    if (phase !== "closed") return;
    const id = setTimeout(() => setPhase("opening"), HOLD_MS);
    return () => clearTimeout(id);
  }, [phase]);

  // opening -> done; mark seen when the opening starts
  useEffect(() => {
    if (phase !== "opening") return;
    markOnce();
    const id = setTimeout(() => setPhase("done"), OPEN_MS);
    return () => clearTimeout(id);
  }, [phase]);

  // keyboard skip while visible
  useEffect(() => {
    if (phase === "done") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        skip();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase]);

  // move focus into the dialog while it is visible
  useEffect(() => {
    if (phase === "closed") skipRef.current?.focus();
  }, [phase]);

  // WebGL 3D Theatre Scene
  useEffect(() => {
    if (phase === "done") return;
    const container = mountRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // Camera sized so Z=0 plane maps cleanly to viewport dimensions
    const fov = 40;
    const camZ = 10;
    const camera = new THREE.PerspectiveCamera(
      fov,
      Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1),
      0.1,
      50,
    );
    camera.position.set(0, 0, camZ);

    const getWorldSize = () => {
      const worldH = 2 * camZ * Math.tan((fov * Math.PI) / 360);
      const worldW = worldH * camera.aspect;
      return { worldW, worldH };
    };

    let { worldW, worldH } = getWorldSize();

    // --- Theatrical Stage Lighting -----------------------------------------
    const ambient = new THREE.AmbientLight(0x3a0710, 1.35);
    scene.add(ambient);

    // Warm overhead front-center stage spotlight (casts valance shadows onto curtains)
    const mainSpot = new THREE.SpotLight(0xfff0d4, 95, 32, Math.PI * 0.36, 0.55, 1.3);
    mainSpot.position.set(0, worldH * 0.72, 7.5);
    mainSpot.castShadow = true;
    mainSpot.shadow.mapSize.set(1024, 1024);
    mainSpot.shadow.bias = -0.0005;
    scene.add(mainSpot);

    // Side raking lights to accentuate 3D velvet fold ridges & metallic gold highlights
    const leftRake = new THREE.PointLight(0xffd79a, 26, 22, 1.4);
    leftRake.position.set(-worldW * 0.42, worldH * 0.15, 4.2);
    scene.add(leftRake);

    const rightRake = new THREE.PointLight(0xffd79a, 26, 22, 1.4);
    rightRake.position.set(worldW * 0.42, worldH * 0.15, 4.2);
    scene.add(rightRake);

    // Subtle warm floor bounce
    const footLight = new THREE.DirectionalLight(0xffb86c, 0.55);
    footLight.position.set(0, -5, 3);
    scene.add(footLight);

    // --- Physically-Based Velvet & Gold Materials --------------------------
    const { normalMap, roughnessMap } = createVelvetTextures();
    const goldNormalMap = createGoldBraidNormalMap();

    const velvetMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#690611"),
      roughness: 0.88,
      metalness: 0.02,
      normalMap,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughnessMap,
      sheen: 1.0,
      sheenRoughness: 0.4,
      sheenColor: new THREE.Color("#ff4c5e"),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1,
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(GOLD),
      emissive: new THREE.Color(GOLD_DARK),
      emissiveIntensity: 0.14,
      metalness: 0.86,
      roughness: 0.24,
      normalMap: goldNormalMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1,
    });

    // --- Curtain Meshes + Dynamic Gold Edge & Hem Trim Ribbons -------------
    const buildCurtainSide = () => {
      const geo = new THREE.PlaneGeometry(1, 1, SEG_X, SEG_Y);
      const mesh = new THREE.Mesh(geo, velvetMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      // Leading-edge vertical gold braid ribbon (2 vertices wide x SEG_Y+1 tall)
      const edgeGeo = new THREE.PlaneGeometry(1, 1, 1, SEG_Y);
      const edgeMesh = new THREE.Mesh(edgeGeo, goldMat);
      scene.add(edgeMesh);

      // Bottom hem gold border + fringe ribbon (SEG_X+1 wide x 2 vertices tall)
      const hemGeo = new THREE.PlaneGeometry(1, 1, SEG_X, 1);
      const hemMesh = new THREE.Mesh(hemGeo, goldMat);
      scene.add(hemMesh);

      const tieBack = buildTieBackRig(goldMat);
      scene.add(tieBack.group);

      return { geo, mesh, edgeGeo, edgeMesh, hemGeo, hemMesh, tieBack };
    };

    const leftCurtain = buildCurtainSide();
    const rightCurtain = buildCurtainSide();

    // --- Fixed Top 3D Theatre Valance --------------------------------------
    let valanceGroup = buildValanceGroup(worldW, worldH, velvetMat, goldMat);
    scene.add(valanceGroup);

    const onResize = () => {
      if (!container) return;
      const w = Math.max(container.clientWidth, 1);
      const h = Math.max(container.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      ({ worldW, worldH } = getWorldSize());

      scene.remove(valanceGroup);
      valanceGroup = buildValanceGroup(worldW, worldH, velvetMat, goldMat);
      scene.add(valanceGroup);
    };
    window.addEventListener("resize", onResize);

    // Deform one curtain side + sync its 3D gold trims & tie-back rig
    const updateSide = (
      side: Side,
      rig: ReturnType<typeof buildCurtainSide>,
      r: number,
      t: number,
    ) => {
      const halfW = worldW * 0.506; // slight center overlap when closed
      const topY = worldH * 0.505;
      const fullH = worldH * 1.015;
      const dir = side === "left" ? 1 : -1;
      const originX = side === "left" ? -halfW : halfW;
      const phaseOffset = side === "left" ? 0 : 1.35;

      const pos = rig.geo.attributes.position as THREE.BufferAttribute;
      const edgePos = rig.edgeGeo.attributes.position as THREE.BufferAttribute;
      const hemPos = rig.hemGeo.attributes.position as THREE.BufferAttribute;

      const qMid = easeSine(clamp01(r * 1.28 - 0.14));
      const foldDepth = lerp(0.11, 0.24, qMid); // pleats deepen in 3D as fabric bunches
      const swayAmp = 0.015 + 0.065 * Math.sin(Math.PI * r);

      let tieAnchorX = originX;
      let tieAnchorY = topY - fullH * TIE_Y;
      let tieAnchorZ = 0.12;
      const tieRow = Math.round(TIE_Y * SEG_Y);

      for (let iy = 0; iy <= SEG_Y; iy++) {
        const yf = iy / SEG_Y; // 0 at top rail, 1 at floor hem
        const q = easeSine(clamp01(r * 1.28 - 0.28 * yf));
        const wf = lerp(1, gatheredWidth(yf), q);
        const yBottom = fullH * (1 - q * 0.065);

        for (let ix = 0; ix <= SEG_X; ix++) {
          const u = ix / SEG_X; // 0 at outer wall, 1 at center leading edge
          const bunch = Math.pow(u, 1 + 0.34 * q);

          let x = bunch * halfW * wf;
          x +=
            (1 - u * (1 - q)) *
            yf *
            swayAmp *
            Math.sin(t * 0.0014 + yf * 3.2 + u * 5.0 + phaseOffset);

          // Natural multi-harmonic vertical pleats with subtle organic irregularity
          const freq = u * Math.PI * 2 * FOLD_COUNT + phaseOffset + Math.sin(yf * 2.4 + u * 4) * 0.18;
          const wave = 0.72 * Math.cos(freq) + 0.28 * Math.cos(freq * 2.15 + 1.05);
          const verticalEnvelope = 0.35 + 0.65 * Math.sin(Math.min(1, yf * 1.6) * (Math.PI / 2));
          const z = wave * foldDepth * verticalEnvelope;

          const lift = q * 0.055 * fullH * u * u;
          const vx = originX + dir * x;
          const vy = topY - yf * (yBottom - lift);

          const vIdx = iy * (SEG_X + 1) + ix;
          pos.setXYZ(vIdx, vx, vy, z);

          // Sync leading-edge gold braid ribbon (ix === SEG_X)
          if (ix === SEG_X) {
            const braidW = 0.042;
            edgePos.setXYZ(iy * 2, vx - dir * braidW, vy, z + 0.018);
            edgePos.setXYZ(iy * 2 + 1, vx + dir * 0.006, vy, z + 0.022);

            if (iy === tieRow) {
              tieAnchorX = vx;
              tieAnchorY = vy;
              tieAnchorZ = Math.max(z, 0.08);
            }
          }

          // Sync bottom hem gold border + fringe (iy === SEG_Y)
          if (iy === SEG_Y) {
            const fringeH = 0.085;
            hemPos.setXYZ(ix, vx, vy + 0.028, z + 0.016);
            hemPos.setXYZ(SEG_X + 1 + ix, vx, vy - fringeH, z + 0.012);
          }
        }
      }

      pos.needsUpdate = true;
      rig.geo.computeVertexNormals();
      edgePos.needsUpdate = true;
      rig.edgeGeo.computeVertexNormals();
      hemPos.needsUpdate = true;
      rig.hemGeo.computeVertexNormals();

      // Update 3D gold rope tie-back, rosette & swaying tassel
      const tieAlpha = clamp01((r - 0.42) / 0.35);
      if (tieAlpha > 0.01) {
        rig.tieBack.group.visible = true;
        const wallX = side === "left" ? -halfW * 1.04 : halfW * 1.04;
        const wrapX = tieAnchorX - dir * 0.04;

        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(wallX, tieAnchorY + 0.05, -0.05),
          new THREE.Vector3(lerp(wallX, wrapX, 0.5), tieAnchorY - 0.11, tieAnchorZ + 0.22),
          new THREE.Vector3(wrapX, tieAnchorY, tieAnchorZ + 0.16),
        ]);

        rig.tieBack.ropeMesh.geometry.dispose();
        rig.tieBack.ropeMesh.geometry = new THREE.TubeGeometry(curve, 24, 0.032, 10, false);

        rig.tieBack.rosetteGroup.position.set(wrapX, tieAnchorY, tieAnchorZ + 0.18);
        rig.tieBack.tasselGroup.position.set(wrapX, tieAnchorY, tieAnchorZ + 0.16);
        rig.tieBack.tasselGroup.rotation.z =
          Math.sin(t * 0.0022 + phaseOffset) * 0.045 * (1 - r * 0.5);
      } else {
        rig.tieBack.group.visible = false;
      }
    };

    let raf = 0;
    const frame = (now: number) => {
      let r = 0;
      if (phaseRef.current === "opening") {
        if (openStartRef.current === null) openStartRef.current = now;
        r = clamp01((now - openStartRef.current) / OPEN_MS);
      }

      // Smoothly dissolve materials at the very end of the opening sweep
      const fadeOut = 1 - clamp01((r - 0.82) / 0.18);
      velvetMat.opacity = fadeOut;
      goldMat.opacity = fadeOut;

      updateSide("left", leftCurtain, r, now);
      updateSide("right", rightCurtain, r, now);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      normalMap.dispose();
      roughnessMap.dispose();
      goldNormalMap.dispose();
      velvetMat.dispose();
      goldMat.dispose();
      leftCurtain.geo.dispose();
      leftCurtain.edgeGeo.dispose();
      leftCurtain.hemGeo.dispose();
      leftCurtain.tieBack.ropeMesh.geometry.dispose();
      rightCurtain.geo.dispose();
      rightCurtain.edgeGeo.dispose();
      rightCurtain.hemGeo.dispose();
      rightCurtain.tieBack.ropeMesh.geometry.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Welcome" style={rootStyle(phase)} onClick={skip}>
      <style>{KEYFRAMES}</style>
      <div ref={mountRef} style={styles.mount} aria-hidden="true" />
      <h1 style={titleStyle(phase)}>Shadi Maxing</h1>
      <button
        ref={skipRef}
        type="button"
        aria-label="Skip intro"
        style={styles.skip}
        onClick={(e) => {
          e.stopPropagation();
          skip();
        }}
      >
        Skip
      </button>
    </div>
  );
}