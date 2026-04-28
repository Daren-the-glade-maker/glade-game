import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

// ---------- Types ----------
type TunicId = "green" | "red" | "blue" | "white" | "shadow";
interface TunicDef {
  id: TunicId;
  name: string;
  body: number;
  accent: number;
  trim: number;
  perk: string;
  speed: number;
  damageMul: number;
  damageTaken: number;
}

const TUNICS: Record<TunicId, TunicDef> = {
  green:  { id: "green",  name: "Forest Tunic", body: 0x6fbf73, accent: 0xc0392b, trim: 0x2f6b28, perk: "Balanced",            speed: 6,  damageMul: 1,   damageTaken: 1 },
  red:    { id: "red",    name: "Ember Tunic",  body: 0xd45a3a, accent: 0xf3c969, trim: 0x6e1f12, perk: "+50% sword damage",   speed: 6,  damageMul: 1.5, damageTaken: 1 },
  blue:   { id: "blue",   name: "Tide Tunic",   body: 0x4a8fb8, accent: 0xb8d8e8, trim: 0x1f3a52, perk: "Halves damage taken", speed: 6,  damageMul: 1,   damageTaken: 0.5 },
  white:  { id: "white",  name: "Wind Cloak",   body: 0xeae6dc, accent: 0xa9aab2, trim: 0x6c6e76, perk: "Faster on foot",      speed: 9,  damageMul: 1,   damageTaken: 1 },
  shadow: { id: "shadow", name: "Shadow Veil",  body: 0x2a2336, accent: 0x8a4ec2, trim: 0x14101c, perk: "Power + speed",       speed: 7.5,damageMul: 1.5, damageTaken: 1 },
};

type MonsterType = "slime" | "bat" | "skeleton" | "knight" | "mage" | "boss";
interface MonsterDef {
  type: MonsterType;
  name: string;
  hp: number;
  speed: number;
  damage: number;        // half-hearts
  contactRange: number;  // attack distance
  color: number;
  rupees: number;
}

const MONSTERS: Record<MonsterType, MonsterDef> = {
  slime:    { type: "slime",    name: "Bog Slime",     hp: 2, speed: 1.6, damage: 1, contactRange: 1.4, color: 0x6fcf73, rupees: 1 },
  bat:      { type: "bat",      name: "Cave Bat",      hp: 2, speed: 3.2, damage: 1, contactRange: 1.4, color: 0x9b6dff, rupees: 2 },
  skeleton: { type: "skeleton", name: "Bone Sentry",   hp: 3, speed: 2.2, damage: 2, contactRange: 1.6, color: 0xeae6dc, rupees: 3 },
  knight:   { type: "knight",   name: "Iron Knight",   hp: 5, speed: 1.8, damage: 2, contactRange: 1.8, color: 0x6b6b78, rupees: 5 },
  mage:     { type: "mage",     name: "Hollow Mage",   hp: 3, speed: 1.4, damage: 2, contactRange: 8.0, color: 0x4a8fb8, rupees: 5 },
  boss:     { type: "boss",     name: "Lake Guardian", hp: 14,speed: 2.0, damage: 3, contactRange: 2.6, color: 0xc0392b, rupees: 25 },
};

interface Monster {
  def: MonsterDef;
  group: THREE.Group;
  hp: number;
  alive: boolean;
  hitFlash: number;
  attackCd: number;
  // For bats: bobbing
  bobPhase: number;
  // For mages: projectile cooldown handled via attackCd
}

interface Projectile {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  damage: number;
  fromEnemy: boolean;
}

interface Pickup {
  mesh: THREE.Group;
  tunic: TunicId;
  bobPhase: number;
}

interface HeartDrop {
  mesh: THREE.Mesh;
  bobPhase: number;
}

interface Obstacle {
  pos: THREE.Vector3;
  radius: number;
}

// ---------- Component ----------
export default function ZeldaGame3D() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({
    tunic: "green" as TunicId,
    inventory: new Set<TunicId>(["green"]),
    hp: 6,
    maxHp: 6,
    rupees: 0,
    iframes: 0,
    attackTimer: 0,
    attackCd: 0,
    bossDefeated: false,
    zone: "overworld" as "overworld" | "dungeon",
    portalCooldown: 0,
    swordLevel: 1,
    swordShards: 0,
    weapon: "sword" as "sword" | "bow",
    arrows: 20,
    bowCd: 0,
  });

  const [hud, setHud] = useState({
    hp: 6, maxHp: 6, rupees: 0,
    tunic: "green" as TunicId,
    inventory: ["green"] as TunicId[],
    toast: "",
    won: false,
    near: "",
    zone: "overworld" as "overworld" | "dungeon",
    swordLevel: 1,
    swordShards: 0,
    weapon: "sword" as "sword" | "bow",
    arrows: 20,
  });

  const equipFnRef = useRef<(id: TunicId) => void>(() => {});
  const heroBodyMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const heroAccentMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const heroTrimMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setHud((h) => ({ ...h, toast: msg }));
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(
      () => setHud((h) => ({ ...h, toast: "" })),
      2400
    );
  }, []);

  const equipTunic = useCallback((id: TunicId) => {
    const st = stateRef.current;
    if (!st.inventory.has(id)) return;
    st.tunic = id;
    const t = TUNICS[id];
    heroBodyMatRef.current?.color.setHex(t.body);
    heroAccentMatRef.current?.color.setHex(t.accent);
    heroTrimMatRef.current?.color.setHex(t.trim);
    setHud((h) => ({ ...h, tunic: id }));
    showToast(`Equipped ${t.name}`);
  }, [showToast]);

  useEffect(() => {
    equipFnRef.current = equipTunic;
  }, [equipTunic]);

  useEffect(() => {
    const mount = mountRef.current!;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x1b1f1a, 1);
    mount.appendChild(renderer.domElement);

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x1b1f1a, 30, 90);

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 200);
    camera.position.set(0, 8, 10);

    // Lights
    const hemi = new THREE.HemisphereLight(0xddeeff, 0x1b2a1b, 0.55);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff3d6, 1.0);
    sun.position.set(20, 30, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    scene.add(sun);

    // ---- Ground ----
    const WORLD = 80;
    const groundGeo = new THREE.PlaneGeometry(WORLD, WORLD, 1, 1);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 0.95 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // checker overlay (subtle)
    const tileSize = 4;
    const tiles = WORLD / tileSize;
    const checkerGeo = new THREE.PlaneGeometry(tileSize, tileSize);
    for (let i = 0; i < tiles; i++) {
      for (let j = 0; j < tiles; j++) {
        if ((i + j) % 2 === 0) continue;
        const m = new THREE.Mesh(
          checkerGeo,
          new THREE.MeshStandardMaterial({ color: 0x3f6c33, roughness: 1 })
        );
        m.rotation.x = -Math.PI / 2;
        m.position.set(-WORLD / 2 + tileSize / 2 + i * tileSize, 0.01, -WORLD / 2 + tileSize / 2 + j * tileSize);
        m.receiveShadow = true;
        scene.add(m);
      }
    }

    // ---- Obstacles list (declared early so terrain features can push) ----
    const obstacles: Obstacle[] = [];

    // ---- Lake (center pond) ----
    const lakeGeo = new THREE.CircleGeometry(7, 48);
    const lakeMat = new THREE.MeshStandardMaterial({ color: 0x3a7fb0, roughness: 0.4, metalness: 0.1 });
    const lake = new THREE.Mesh(lakeGeo, lakeMat);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(0, 0.02, -25);
    scene.add(lake);

    // ---- Sand path: spawn (z=25) up to portal (z=-10) ----
    const pathMat = new THREE.MeshStandardMaterial({ color: 0xd9c48a, roughness: 1 });
    const pathSegments: { x: number; z: number; w: number; l: number }[] = [
      { x: 0, z: 18, w: 3, l: 14 },
      { x: 0, z: 6, w: 3, l: 10 },
      { x: 4, z: -2, w: 3, l: 12 }, // path bends east around lake area
      { x: 4, z: -10, w: 3, l: 6 },
    ];
    for (const s of pathSegments) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.l), pathMat);
      p.rotation.x = -Math.PI / 2;
      p.position.set(s.x, 0.015, s.z);
      p.receiveShadow = true;
      scene.add(p);
    }

    // ---- Rolling hills (decorative bumps) ----
    function addHill(x: number, z: number, r: number, h: number) {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x5a8e44, roughness: 1 })
      );
      dome.scale.set(1, h / r, 1);
      dome.position.set(x, 0, z);
      dome.receiveShadow = true;
      dome.castShadow = true;
      scene.add(dome);
    }
    addHill(-22, 18, 6, 2.2);
    addHill(24, 22, 5, 1.8);
    addHill(-26, -10, 7, 2.6);

    // ---- Creek + bridge (across path between z=10 and z=4) ----
    const creek = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 4),
      new THREE.MeshStandardMaterial({ color: 0x4a90c5, roughness: 0.4, metalness: 0.1 })
    );
    creek.rotation.x = -Math.PI / 2;
    creek.position.set(-6, 0.03, 7);
    scene.add(creek);
    // bridge planks
    const bridgeWoodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a30, roughness: 0.9 });
    for (let i = 0; i < 5; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 0.7), bridgeWoodMat);
      plank.position.set(0, 0.18, 9 - i * 0.9);
      plank.castShadow = true; plank.receiveShadow = true;
      scene.add(plank);
    }
    // bridge rails
    for (const sx of [-1.5, 1.5]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 4.5), bridgeWoodMat);
      rail.position.set(sx, 0.5, 7);
      rail.castShadow = true;
      scene.add(rail);
    }
    // creek blocks crossing OUTSIDE the bridge area
    obstacles.push({ pos: new THREE.Vector3(-12, 0, 7), radius: 3 });
    obstacles.push({ pos: new THREE.Vector3(-18, 0, 7), radius: 3 });
    obstacles.push({ pos: new THREE.Vector3(8, 0, 7), radius: 3 });
    obstacles.push({ pos: new THREE.Vector3(14, 0, 7), radius: 3 });
    // (gap from -3 to 3 stays open for bridge)

    // ---- Decoration helpers ----

    function addTree(x: number, z: number) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, 1.6, 6),
        new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 1 })
      );
      trunk.position.set(x, 0.8, z);
      trunk.castShadow = true;
      scene.add(trunk);
      const top = new THREE.Mesh(
        new THREE.ConeGeometry(1.4, 2.6, 7),
        new THREE.MeshStandardMaterial({ color: 0x2f6b28, roughness: 1 })
      );
      top.position.set(x, 2.6, z);
      top.castShadow = true;
      scene.add(top);
      obstacles.push({ pos: new THREE.Vector3(x, 0, z), radius: 0.9 });
    }

    function addRock(x: number, z: number, s = 1) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.8 * s, 0),
        new THREE.MeshStandardMaterial({ color: 0x6b6b78, roughness: 1 })
      );
      rock.position.set(x, 0.5 * s, z);
      rock.castShadow = true;
      rock.receiveShadow = true;
      scene.add(rock);
      obstacles.push({ pos: new THREE.Vector3(x, 0, z), radius: 0.9 * s });
    }

    // Border trees ring
    const ringR = WORLD / 2 - 2;
    for (let a = 0; a < Math.PI * 2; a += 0.18) {
      const x = Math.cos(a) * ringR + (Math.random() - 0.5) * 1.5;
      const z = Math.sin(a) * ringR + (Math.random() - 0.5) * 1.5;
      addTree(x, z);
    }

    // scattered trees (avoid lake area)
    const rng = (seed: number) => {
      let s = seed;
      return () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
      };
    };
    const r = rng(7);
    // helper: keep path corridor clear (path runs along x≈0 from z=25 down to z=-4, then x≈4 from z=-4 to z=-13, plus portal area)
    const onPath = (x: number, z: number) => {
      if (z >= -4 && z <= 25 && Math.abs(x) < 2.5) return true;
      if (z >= -13 && z <= -4 && Math.abs(x - 4) < 2.5) return true;
      // portal clearing
      if (Math.hypot(x - 4, z - (-10)) < 3.5) return true;
      // bridge corridor across creek
      if (z >= 5 && z <= 9 && Math.abs(x) < 2.5) return true;
      return false;
    };
    for (let i = 0; i < 50; i++) {
      const x = (r() - 0.5) * (WORLD - 8);
      const z = (r() - 0.5) * (WORLD - 8);
      if (Math.hypot(x, z + 25) < 11) continue;       // avoid lake
      if (Math.hypot(x, z - 25) < 6) continue;        // avoid spawn
      if (onPath(x, z)) continue;
      addTree(x, z);
    }
    for (let i = 0; i < 25; i++) {
      const x = (r() - 0.5) * (WORLD - 10);
      const z = (r() - 0.5) * (WORLD - 10);
      if (Math.hypot(x, z + 25) < 10) continue;
      if (Math.hypot(x, z - 25) < 5) continue;
      if (onPath(x, z)) continue;
      addRock(x, z, 0.7 + r() * 0.8);
    }

    // Stone circle around lake
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      addRock(Math.cos(a) * 9 + 0, Math.sin(a) * 9 - 25, 0.9);
    }

    // ---- Hero ----
    const heroGroup = new THREE.Group();
    heroGroup.position.set(0, 0, 25); // spawn south
    scene.add(heroGroup);

    const tunic0 = TUNICS["green"];
    const bodyMat = new THREE.MeshStandardMaterial({ color: tunic0.body, roughness: 0.7 });
    const accentMat = new THREE.MeshStandardMaterial({ color: tunic0.accent, roughness: 0.7 });
    const trimMat = new THREE.MeshStandardMaterial({ color: tunic0.trim, roughness: 0.7 });
    heroBodyMatRef.current = bodyMat;
    heroAccentMatRef.current = accentMat;
    heroTrimMatRef.current = trimMat;

    // body (tunic)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.55), bodyMat);
    body.position.y = 1.0;
    body.castShadow = true;
    heroGroup.add(body);
    // belt
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.12, 0.57), accentMat);
    belt.position.y = 0.7;
    belt.castShadow = true;
    heroGroup.add(belt);
    // legs
    const legGeo = new THREE.BoxGeometry(0.32, 0.55, 0.32);
    const legMat = new THREE.MeshStandardMaterial({ color: 0xeae0c8, roughness: 0.9 });
    const legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.2, 0.3, 0); legL.castShadow = true; heroGroup.add(legL);
    const legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0.2, 0.3, 0); legR.castShadow = true; heroGroup.add(legR);
    // head
    const skin = new THREE.MeshStandardMaterial({ color: 0xf2c89e, roughness: 0.9 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.65), skin);
    head.position.y = 1.85;
    head.castShadow = true;
    heroGroup.add(head);
    // hat (cone) using trim color
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 6), trimMat);
    hat.position.y = 2.55;
    hat.castShadow = true;
    heroGroup.add(hat);
    // arms
    const armGeo = new THREE.BoxGeometry(0.25, 0.85, 0.3);
    const armL = new THREE.Mesh(armGeo, bodyMat);
    armL.position.set(-0.55, 1.1, 0); armL.castShadow = true; heroGroup.add(armL);
    const armR = new THREE.Mesh(armGeo, bodyMat);
    armR.position.set(0.55, 1.1, 0); armR.castShadow = true; heroGroup.add(armR);

    // ---- Sheath on back (with sheathed sword visible when not attacking) ----
    const sheathGroup = new THREE.Group();
    // mounted on the back, tilted diagonally over the shoulder
    sheathGroup.position.set(-0.18, 1.45, -0.28);
    sheathGroup.rotation.set(-0.25, 0, 0.55); // lean across the back
    heroGroup.add(sheathGroup);
    // strap across chest/back
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x3a1f12, roughness: 0.9 });
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.06), strapMat);
    strap.position.set(0, 0.1, 0);
    strap.castShadow = true;
    sheathGroup.add(strap);
    // scabbard body (dark leather with red trim to match neon sword)
    const scabMat = new THREE.MeshStandardMaterial({ color: 0x2a1418, roughness: 0.85 });
    const scabbard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.1, 0.18), scabMat);
    scabbard.position.set(0, -0.1, 0);
    scabbard.castShadow = true;
    sheathGroup.add(scabbard);
    // metal trim bands
    const trimBandMat = new THREE.MeshStandardMaterial({ color: 0xff2a3a, emissive: 0xff0022, emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.25 });
    const bandTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.22), trimBandMat);
    bandTop.position.set(0, 0.85, 0);
    sheathGroup.add(bandTop);
    const bandBottom = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.22), trimBandMat);
    bandBottom.position.set(0, -1.05, 0);
    sheathGroup.add(bandBottom);
    // pointed scabbard tip
    const scabTip = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.3, 4), trimBandMat);
    scabTip.position.set(0, -1.3, 0);
    scabTip.rotation.y = Math.PI / 4;
    sheathGroup.add(scabTip);

    // sheathed sword (hilt sticking out the top, visible when not attacking)
    const sheathedSword = new THREE.Group();
    sheathedSword.position.set(0, 0.95, 0);
    sheathGroup.add(sheathedSword);
    // crossguard
    const sgGuard = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.1, 0.16),
      new THREE.MeshStandardMaterial({ color: 0xff2a3a, emissive: 0xff0022, emissiveIntensity: 1.0, metalness: 0.6, roughness: 0.2 })
    );
    sgGuard.position.y = 0.0;
    sheathedSword.add(sgGuard);
    // grip
    const sgGrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.36, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x1a0608, roughness: 0.85 })
    );
    sgGrip.position.y = 0.22;
    sheathedSword.add(sgGrip);
    // pommel
    const sgPommel = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffe14a, emissive: 0xffaa00, emissiveIntensity: 0.9, metalness: 0.4 })
    );
    sgPommel.position.y = 0.46;
    sheathedSword.add(sgPommel);

    // ---- Bow (slung on back when sword equipped, held forward when bow equipped) ----
    const bowGroup = new THREE.Group();
    heroGroup.add(bowGroup);
    const bowWoodMat = new THREE.MeshStandardMaterial({ color: 0x6b3a14, roughness: 0.85 });
    const bowAccentMat = new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0xaa7700, emissiveIntensity: 0.4, metalness: 0.7, roughness: 0.3 });
    // arc — torus segment
    const bowArc = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.05, 8, 20, Math.PI * 1.1),
      bowWoodMat
    );
    bowArc.rotation.z = Math.PI / 2 - Math.PI * 0.55;
    bowGroup.add(bowArc);
    // grip wrap
    const bowGrip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.1), bowAccentMat);
    bowGroup.add(bowGrip);
    // bowstring
    const stringMat = new THREE.LineBasicMaterial({ color: 0xeeeeee });
    const stringGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.55, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -0.55, 0),
    ]);
    const bowString = new THREE.Line(stringGeo, stringMat);
    bowGroup.add(bowString);

    // Stowed-on-back position (opposite shoulder from sword sheath)
    const bowStowedPos = new THREE.Vector3(0.22, 1.45, -0.32);
    const bowStowedRot = new THREE.Euler(0.2, 0, -0.55);
    // Held forward in left hand
    const bowHeldPos = new THREE.Vector3(-0.55, 1.15, 0.55);
    const bowHeldRot = new THREE.Euler(0, Math.PI / 2, 0);
    const setBowPose = (held: boolean) => {
      if (held) {
        bowGroup.position.copy(bowHeldPos);
        bowGroup.rotation.copy(bowHeldRot);
        bowGroup.scale.setScalar(1.0);
      } else {
        bowGroup.position.copy(bowStowedPos);
        bowGroup.rotation.copy(bowStowedRot);
        bowGroup.scale.setScalar(0.85);
      }
    };
    setBowPose(false);

    // sword — bright neon red blade (hidden when not attacking, upgradable)
    const swordPivot = new THREE.Group();
    swordPivot.position.set(0.6, 1.1, 0);
    heroGroup.add(swordPivot);
    const neonMat = new THREE.MeshStandardMaterial({
      color: 0xff1a2b,
      emissive: 0xff0022,
      emissiveIntensity: 1.6,
      metalness: 0.6,
      roughness: 0.15,
    });
    const swordBlade = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 2.0),
      neonMat
    );
    swordBlade.position.set(0, 0, 1.1);
    swordBlade.castShadow = true;
    swordPivot.add(swordBlade);
    // tip
    const swordTip = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.45, 4),
      neonMat
    );
    swordTip.rotation.x = Math.PI / 2;
    swordTip.position.set(0, 0, 2.25);
    swordPivot.add(swordTip);
    // crossguard
    const swordGuard = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.12, 0.18),
      neonMat
    );
    swordGuard.position.set(0, 0, 0.15);
    swordPivot.add(swordGuard);
    // hilt grip
    const swordHilt = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x1a0608, roughness: 0.8 })
    );
    swordHilt.position.set(0, 0, -0.05);
    swordPivot.add(swordHilt);
    // pommel jewel
    const swordPommel = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffe14a, emissive: 0xffaa00, emissiveIntensity: 0.9, metalness: 0.4 })
    );
    swordPommel.position.set(0, 0, -0.24);
    swordPivot.add(swordPommel);
    // glow halo
    const swordGlow = new THREE.PointLight(0xff2244, 2.2, 5);
    swordGlow.position.set(0, 0, 1.0);
    swordPivot.add(swordGlow);
    swordPivot.visible = false;

    // ---- Sword upgrade tuning ----
    // Damage / reach / glow scale with swordLevel (1..5)
    const SWORD_UPGRADE_COST = 3; // shards per level
    const SWORD_MAX_LEVEL = 5;
    const applySwordVisuals = () => {
      const lvl = stateRef.current.swordLevel;
      const s = 1 + (lvl - 1) * 0.18;        // size grows
      swordBlade.scale.set(s, s, 1 + (lvl - 1) * 0.15);
      swordTip.scale.set(s, s, 1 + (lvl - 1) * 0.15);
      swordTip.position.z = 2.25 + (lvl - 1) * 0.16;
      swordGuard.scale.set(s, 1, 1);
      neonMat.emissiveIntensity = 1.4 + lvl * 0.35;
      swordGlow.intensity = 1.8 + lvl * 0.6;
      swordGlow.distance = 4 + lvl * 0.8;
    };
    applySwordVisuals();

    // hero shadow disc fallback (in case shadows perform poorly)
    // (skip — using real shadows)

    // ---- Pickups ----
    const pickups: Pickup[] = [];

    function makeTunicPickup(tunicId: TunicId, x: number, z: number) {
      const t = TUNICS[tunicId];
      const g = new THREE.Group();
      g.position.set(x, 0.5, z);
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.6, 0.4),
        new THREE.MeshStandardMaterial({ color: t.body, roughness: 0.6, emissive: t.body, emissiveIntensity: 0.15 })
      );
      base.castShadow = true;
      g.add(base);
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.12, 0.42),
        new THREE.MeshStandardMaterial({ color: t.accent })
      );
      stripe.position.y = -0.05;
      g.add(stripe);
      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(0.3, 0.4, 6),
        new THREE.MeshStandardMaterial({ color: t.trim })
      );
      cap.position.y = 0.55;
      g.add(cap);
      // glow
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 16, 12),
        new THREE.MeshBasicMaterial({ color: t.body, transparent: true, opacity: 0.08 })
      );
      g.add(glow);
      scene.add(g);
      pickups.push({ mesh: g, tunic: tunicId, bobPhase: Math.random() * Math.PI * 2 });
    }

    // Place tunics around the world
    makeTunicPickup("red", -18, 10);
    makeTunicPickup("white", 20, 8);
    makeTunicPickup("blue", -12, -10);
    makeTunicPickup("shadow", 14, -18);

    // ---- Hearts ----
    const hearts: HeartDrop[] = [];
    function dropHeart(x: number, z: number) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 12, 8),
        new THREE.MeshStandardMaterial({ color: 0xe74c3c, emissive: 0xff5b4d, emissiveIntensity: 0.3 })
      );
      m.position.set(x, 0.7, z);
      m.castShadow = true;
      scene.add(m);
      hearts.push({ mesh: m, bobPhase: Math.random() * Math.PI * 2 });
    }

    // ---- Monsters ----
    const monsters: Monster[] = [];

    function makeSlime(): THREE.Group {
      const g = new THREE.Group();
      const def = MONSTERS.slime;
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 16, 12),
        new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.5, transparent: true, opacity: 0.85, emissive: def.color, emissiveIntensity: 0.1 })
      );
      body.scale.y = 0.7;
      body.position.y = 0.5;
      body.castShadow = true;
      g.add(body);
      // eyes
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
      const eyeGeo = new THREE.SphereGeometry(0.08, 8, 6);
      const e1 = new THREE.Mesh(eyeGeo, eyeMat); e1.position.set(-0.2, 0.6, 0.55); g.add(e1);
      const e2 = new THREE.Mesh(eyeGeo, eyeMat); e2.position.set(0.2, 0.6, 0.55); g.add(e2);
      return g;
    }

    function makeBat(): THREE.Group {
      const g = new THREE.Group();
      const def = MONSTERS.bat;
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 12, 10),
        new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.6 })
      );
      body.castShadow = true;
      g.add(body);
      const wingMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7, side: THREE.DoubleSide });
      const wingGeo = new THREE.PlaneGeometry(0.8, 0.4);
      const wL = new THREE.Mesh(wingGeo, wingMat);
      wL.position.set(-0.5, 0, 0);
      wL.name = "wingL";
      g.add(wL);
      const wR = new THREE.Mesh(wingGeo, wingMat);
      wR.position.set(0.5, 0, 0);
      wR.name = "wingR";
      g.add(wR);
      // eyes glow
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xff3344 })
      );
      glow.position.set(0, 0.1, 0.3);
      g.add(glow);
      return g;
    }

    function makeSkeleton(): THREE.Group {
      const g = new THREE.Group();
      const def = MONSTERS.skeleton;
      const boneMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.9 });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.3), boneMat);
      torso.position.y = 1.0; torso.castShadow = true; g.add(torso);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), boneMat);
      head.position.y = 1.65; head.castShadow = true; g.add(head);
      // ribs accent
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.32), new THREE.MeshStandardMaterial({ color: 0x999999 }));
      rib.position.y = 1.0; g.add(rib);
      // legs
      const legGeo = new THREE.BoxGeometry(0.18, 0.7, 0.2);
      const legL = new THREE.Mesh(legGeo, boneMat); legL.position.set(-0.15, 0.35, 0); legL.castShadow = true; g.add(legL);
      const legR = new THREE.Mesh(legGeo, boneMat); legR.position.set(0.15, 0.35, 0); legR.castShadow = true; g.add(legR);
      // sword (right hand)
      const sword = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.7), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.4 }));
      sword.position.set(0.45, 1.0, 0.3);
      g.add(sword);
      // eye sockets
      const sock = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const sg = new THREE.PlaneGeometry(0.1, 0.1);
      const s1 = new THREE.Mesh(sg, sock); s1.position.set(-0.12, 1.7, 0.26); g.add(s1);
      const s2 = new THREE.Mesh(sg, sock); s2.position.set(0.12, 1.7, 0.26); g.add(s2);
      return g;
    }

    function makeKnight(): THREE.Group {
      const g = new THREE.Group();
      const def = MONSTERS.knight;
      const armorMat = new THREE.MeshStandardMaterial({ color: def.color, metalness: 0.5, roughness: 0.4 });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.6), armorMat);
      torso.position.y = 1.1; torso.castShadow = true; g.add(torso);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), armorMat);
      head.position.y = 1.95; head.castShadow = true; g.add(head);
      // visor slit
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.05), new THREE.MeshBasicMaterial({ color: 0xff3322 }));
      visor.position.set(0, 1.95, 0.32); g.add(visor);
      // plume
      const plume = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x8a1c1c }));
      plume.position.y = 2.45; g.add(plume);
      // legs
      const legGeo = new THREE.BoxGeometry(0.32, 0.65, 0.34);
      const legL = new THREE.Mesh(legGeo, armorMat); legL.position.set(-0.22, 0.32, 0); legL.castShadow = true; g.add(legL);
      const legR = new THREE.Mesh(legGeo, armorMat); legR.position.set(0.22, 0.32, 0); legR.castShadow = true; g.add(legR);
      // shield
      const shield = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.08), new THREE.MeshStandardMaterial({ color: 0x6b6b78, metalness: 0.5 }));
      shield.position.set(-0.6, 1.1, 0.25);
      g.add(shield);
      // sword
      const sword = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.0), new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.6 }));
      sword.position.set(0.6, 1.1, 0.45);
      g.add(sword);
      return g;
    }

    function makeMage(): THREE.Group {
      const g = new THREE.Group();
      const def = MONSTERS.mage;
      const robe = new THREE.Mesh(
        new THREE.ConeGeometry(0.7, 1.7, 8),
        new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.8 })
      );
      robe.position.y = 0.85;
      robe.castShadow = true;
      g.add(robe);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0x1a1a22 })
      );
      head.position.y = 1.85; head.castShadow = true; g.add(head);
      const hat = new THREE.Mesh(
        new THREE.ConeGeometry(0.45, 0.9, 8),
        new THREE.MeshStandardMaterial({ color: 0x1f3a52 })
      );
      hat.position.y = 2.4; g.add(hat);
      // staff
      const staff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6),
        new THREE.MeshStandardMaterial({ color: 0x4a3320 })
      );
      staff.position.set(0.5, 1.2, 0); g.add(staff);
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0x66ddff, emissive: 0x66ddff, emissiveIntensity: 0.7 })
      );
      orb.position.set(0.5, 2.05, 0); g.add(orb);
      // glowing eyes
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x66ddff })
      );
      eye.position.set(-0.1, 1.85, 0.25); g.add(eye);
      const eye2 = eye.clone(); eye2.position.set(0.1, 1.85, 0.25); g.add(eye2);
      return g;
    }

    function makeBoss(): THREE.Group {
      const g = new THREE.Group();
      const def = MONSTERS.boss;
      // big sphere body
      const body = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.8, 0),
        new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.5, metalness: 0.2, emissive: 0x4a0808, emissiveIntensity: 0.3 })
      );
      body.position.y = 2.0;
      body.castShadow = true;
      g.add(body);
      // crown spikes
      for (let i = 0; i < 6; i++) {
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.25, 0.9, 4),
          new THREE.MeshStandardMaterial({ color: 0x2a1010 })
        );
        const a = (i / 6) * Math.PI * 2;
        spike.position.set(Math.cos(a) * 1.6, 3.0, Math.sin(a) * 1.6);
        spike.rotation.z = -Math.cos(a) * 0.3;
        spike.rotation.x = Math.sin(a) * 0.3;
        g.add(spike);
      }
      // eye
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0xfff7d6, emissive: 0xffaa33, emissiveIntensity: 0.8 })
      );
      eye.position.set(0, 2.0, 1.6);
      g.add(eye);
      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0x111111 })
      );
      pupil.position.set(0, 2.0, 1.95);
      g.add(pupil);
      return g;
    }

    function spawnMonster(type: MonsterType, x: number, z: number) {
      const def = MONSTERS[type];
      let group: THREE.Group;
      switch (type) {
        case "slime": group = makeSlime(); break;
        case "bat": group = makeBat(); break;
        case "skeleton": group = makeSkeleton(); break;
        case "knight": group = makeKnight(); break;
        case "mage": group = makeMage(); break;
        case "boss": group = makeBoss(); break;
      }
      group.position.set(x, type === "bat" ? 1.6 : 0, z);
      scene.add(group);
      monsters.push({
        def,
        group,
        hp: def.hp,
        alive: true,
        hitFlash: 0,
        attackCd: 0,
        bobPhase: Math.random() * Math.PI * 2,
      });
    }

    // Spawn enemies around the map (not at spawn area south of z=20)
    spawnMonster("slime", -8, 5);
    spawnMonster("slime", 7, 0);
    spawnMonster("slime", -15, -5);
    spawnMonster("slime", 12, 12);
    spawnMonster("bat", -20, 12);
    spawnMonster("bat", 18, -5);
    spawnMonster("bat", 0, 5);
    spawnMonster("skeleton", -10, -15);
    spawnMonster("skeleton", 10, -12);
    spawnMonster("skeleton", -22, 0);
    spawnMonster("knight", 22, 0);
    spawnMonster("knight", -18, -20);
    spawnMonster("mage", 16, -22);
    spawnMonster("mage", -8, -28);
    spawnMonster("boss", 0, -32);

    // ============================================================
    // ---- COLLECTIBLES (rupees + heart container) ----
    // ============================================================
    interface Rupee { mesh: THREE.Mesh; phase: number; value: number; }
    const rupees: Rupee[] = [];

    function makeRupee(x: number, z: number, value = 1, color = 0x4ade80) {
      const m = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32, 0),
        new THREE.MeshStandardMaterial({
          color, emissive: color, emissiveIntensity: 0.5,
          metalness: 0.3, roughness: 0.2,
        })
      );
      m.position.set(x, 0.7, z);
      m.castShadow = true;
      scene.add(m);
      rupees.push({ mesh: m, phase: Math.random() * Math.PI * 2, value });
    }
    // green rupees along the path
    makeRupee(0, 22, 1);
    makeRupee(-1.2, 14, 1);
    makeRupee(1.2, 14, 1);
    makeRupee(0, 4, 1);
    makeRupee(4, -2, 1);
    // blue rupees off the path (worth 5)
    makeRupee(-22, 18, 5, 0x4a90ff);
    makeRupee(24, 22, 5, 0x4a90ff);
    makeRupee(-26, -10, 5, 0x4a90ff);
    // hidden red rupee near boss area (worth 20)
    makeRupee(-12, -30, 20, 0xff4a4a);

    // Heart container (boosts max HP permanently)
    interface HeartContainer { mesh: THREE.Group; phase: number; collected: boolean; }
    const heartContainers: HeartContainer[] = [];
    function makeHeartContainer(x: number, z: number) {
      const g = new THREE.Group();
      g.position.set(x, 1.2, z);
      const sphere = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.55, 1),
        new THREE.MeshStandardMaterial({
          color: 0xff5577, emissive: 0xff2244, emissiveIntensity: 0.6,
          metalness: 0.2, roughness: 0.3,
        })
      );
      sphere.castShadow = true;
      g.add(sphere);
      // glow halo
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.7, 1.0, 24),
        new THREE.MeshBasicMaterial({ color: 0xff7799, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = -1.0;
      g.add(halo);
      scene.add(g);
      heartContainers.push({ mesh: g, phase: 0, collected: false });
    }
    makeHeartContainer(-22, 0); // tucked in the western field

    // ============================================================
    // ---- PORTAL to dungeon ----
    // ============================================================
    const portalGroup = new THREE.Group();
    portalGroup.position.set(4, 0, -10);
    scene.add(portalGroup);
    // base stone slabs
    for (let i = 0; i < 4; i++) {
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.4, 1.0),
        new THREE.MeshStandardMaterial({ color: 0x4a4a55, roughness: 1 })
      );
      const a = (i / 4) * Math.PI * 2;
      slab.position.set(Math.cos(a) * 1.6, 0.2, Math.sin(a) * 1.6);
      slab.castShadow = true; slab.receiveShadow = true;
      portalGroup.add(slab);
    }
    // ring frame
    const ringFrame = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.18, 12, 32),
      new THREE.MeshStandardMaterial({ color: 0x9b6dff, emissive: 0x6a3fb8, emissiveIntensity: 0.7, metalness: 0.5, roughness: 0.3 })
    );
    ringFrame.rotation.x = Math.PI / 2;
    ringFrame.position.y = 1.8;
    ringFrame.castShadow = true;
    portalGroup.add(ringFrame);
    // swirling disc
    const portalDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.25, 32),
      new THREE.MeshBasicMaterial({ color: 0xb98aff, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    portalDisc.rotation.x = Math.PI / 2;
    portalDisc.position.y = 1.8;
    portalGroup.add(portalDisc);
    // light
    const portalLight = new THREE.PointLight(0xb98aff, 1.4, 8);
    portalLight.position.y = 1.8;
    portalGroup.add(portalLight);
    obstacles.push({ pos: new THREE.Vector3(4, 0, -10), radius: 0.6 }); // base only blocks center

    // ============================================================
    // ---- DUNGEON ZONE: multiple connected rooms ----
    // ============================================================
    const dungeonOrigin = new THREE.Vector3(0, 0, -120);
    const dungeonGroup = new THREE.Group();
    scene.add(dungeonGroup);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a2330, roughness: 1 });
    const wallH = 4;
    const dFloorMat = new THREE.MeshStandardMaterial({ color: 0x3a3340, roughness: 1 });
    const dTileMat = new THREE.MeshStandardMaterial({ color: 0x4a4250, roughness: 1 });
    const dTileGeo = new THREE.PlaneGeometry(2, 2);

    // raw wall segment (no door logic)
    const addWallSeg = (cx: number, cz: number, w: number, d: number) => {
      if (w <= 0.01 || d <= 0.01) return;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
      wall.position.set(cx, wallH / 2, cz);
      wall.castShadow = true; wall.receiveShadow = true;
      dungeonGroup.add(wall);
      const steps = Math.ceil(Math.max(w, d) / 1.5);
      for (let k = 0; k <= steps; k++) {
        const t = steps === 0 ? 0.5 : k / steps;
        const ox = cx + (w > d ? (t - 0.5) * w : 0);
        const oz = cz + (d > w ? (t - 0.5) * d : 0);
        obstacles.push({ pos: new THREE.Vector3(ox, 0, oz), radius: 0.8 });
      }
    };

    // Build a rectangular room with optional doors.
    // doors: array of {side: 'N'|'S'|'E'|'W', offset: number, width: number}
    type Door = { side: "N" | "S" | "E" | "W"; offset: number; width: number };
    const buildRoom = (cx: number, cz: number, w: number, d: number, doors: Door[]) => {
      // floor
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), dFloorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(cx, 0, cz);
      floor.receiveShadow = true;
      dungeonGroup.add(floor);
      // checker tiles
      const tilesX = Math.floor(w / 2);
      const tilesZ = Math.floor(d / 2);
      for (let i = 0; i < tilesX; i++) {
        for (let j = 0; j < tilesZ; j++) {
          if ((i + j) % 2 === 0) continue;
          const t = new THREE.Mesh(dTileGeo, dTileMat);
          t.rotation.x = -Math.PI / 2;
          t.position.set(cx - w / 2 + 1 + i * 2, 0.011, cz - d / 2 + 1 + j * 2);
          t.receiveShadow = true;
          dungeonGroup.add(t);
        }
      }
      // walls with door cutouts
      const buildSide = (side: "N" | "S" | "E" | "W") => {
        const horizontal = side === "N" || side === "S";
        const length = horizontal ? w : d;
        const fixedAxis = horizontal
          ? cz + (side === "N" ? -d / 2 : d / 2)
          : cx + (side === "W" ? -w / 2 : w / 2);
        const sideDoors = doors
          .filter((dr) => dr.side === side)
          .sort((a, b) => a.offset - b.offset);
        // segments along the wall length, splitting at each door
        let cursor = -length / 2;
        for (const dr of sideDoors) {
          const dStart = dr.offset - dr.width / 2;
          const dEnd = dr.offset + dr.width / 2;
          if (dStart > cursor) {
            const segLen = dStart - cursor;
            const segCenter = cursor + segLen / 2;
            if (horizontal) addWallSeg(cx + segCenter, fixedAxis, segLen, 1);
            else addWallSeg(fixedAxis, cz + segCenter, 1, segLen);
          }
          cursor = dEnd;
        }
        if (cursor < length / 2) {
          const segLen = length / 2 - cursor;
          const segCenter = cursor + segLen / 2;
          if (horizontal) addWallSeg(cx + segCenter, fixedAxis, segLen, 1);
          else addWallSeg(fixedAxis, cz + segCenter, 1, segLen);
        }
      };
      buildSide("N"); buildSide("S"); buildSide("E"); buildSide("W");
      // corner torches
      const torchSpots: [number, number][] = [
        [cx - w / 2 + 2, cz - d / 2 + 2],
        [cx + w / 2 - 2, cz - d / 2 + 2],
        [cx - w / 2 + 2, cz + d / 2 - 2],
        [cx + w / 2 - 2, cz + d / 2 - 2],
      ];
      for (const [px, pz] of torchSpots) {
        const torch = new THREE.PointLight(0xffaa44, 1.0, 11);
        torch.position.set(px, 3, pz);
        dungeonGroup.add(torch);
        const flame = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0xffaa44 })
        );
        flame.position.copy(torch.position);
        dungeonGroup.add(flame);
      }
    };

    const addPillar = (px: number, pz: number) => {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 4, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x5a4a60, roughness: 1 })
      );
      pillar.position.set(px, 2, pz);
      pillar.castShadow = true; pillar.receiveShadow = true;
      dungeonGroup.add(pillar);
      obstacles.push({ pos: new THREE.Vector3(px, 0, pz), radius: 0.8 });
    };

    const dox = dungeonOrigin.x;
    const doz = dungeonOrigin.z;

    // Room A — Entry Hall (south). 30x24, doors: S (entry portal), N (to boss room), W (to treasure room)
    buildRoom(dox, doz, 30, 24, [
      { side: "S", offset: 0, width: 4 },     // entry from overworld
      { side: "N", offset: 0, width: 4 },     // to boss room
      { side: "W", offset: 0, width: 4 },     // to treasure room
    ]);
    addPillar(dox - 8, doz - 6);
    addPillar(dox + 8, doz - 6);
    addPillar(dox - 8, doz + 6);
    addPillar(dox + 8, doz + 6);

    // Room B — Boss Room (north of A). 28x24, doors: S (back to A), E (to mage room)
    const bx = dox, bz = doz - 24;
    buildRoom(bx, bz, 28, 24, [
      { side: "S", offset: 0, width: 4 },
      { side: "E", offset: 0, width: 4 },
    ]);
    addPillar(bx - 10, bz - 8);
    addPillar(bx + 10, bz - 8);

    // Room C — Treasure Vault (west of A). 20x18, door: E (back to A)
    const cx = dox - 25, cz = doz;
    buildRoom(cx, cz, 20, 18, [
      { side: "E", offset: 0, width: 4 },
    ]);

    // Room D — Mage Sanctum (east of B). 22x20, door: W (back to B)
    const dx = bx + 25, dz = bz;
    buildRoom(dx, dz, 22, 20, [
      { side: "W", offset: 0, width: 4 },
    ]);
    addPillar(dx, dz);

    // dungeon exit portal (back to overworld) — just south of Room A
    const exitPortal = new THREE.Group();
    exitPortal.position.set(dox, 0, doz + 14);
    dungeonGroup.add(exitPortal);
    const exitRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.18, 12, 32),
      new THREE.MeshStandardMaterial({ color: 0x6fbf73, emissive: 0x4a8c3a, emissiveIntensity: 0.7, metalness: 0.5 })
    );
    exitRing.rotation.x = Math.PI / 2;
    exitRing.position.y = 1.8;
    exitPortal.add(exitRing);
    const exitDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.25, 32),
      new THREE.MeshBasicMaterial({ color: 0x8af09a, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    exitDisc.rotation.x = Math.PI / 2;
    exitDisc.position.y = 1.8;
    exitPortal.add(exitDisc);
    const exitLight = new THREE.PointLight(0x8af09a, 1.2, 8);
    exitLight.position.y = 1.8;
    exitPortal.add(exitLight);

    // Enemies & rewards per room
    // Room A — entry skirmish
    spawnMonster("skeleton", dox - 6, doz - 4);
    spawnMonster("skeleton", dox + 6, doz - 4);
    spawnMonster("bat",      dox,     doz + 4);
    // Room B — boss room
    spawnMonster("knight", bx,     bz - 6);
    spawnMonster("skeleton", bx - 6, bz);
    spawnMonster("skeleton", bx + 6, bz);
    makeRupee(bx, bz - 10, 20, 0xff4a4a);
    // Room C — treasure vault
    spawnMonster("bat", cx, cz);
    makeRupee(cx - 4, cz - 4, 5, 0x4a8fff);
    makeRupee(cx + 4, cz - 4, 5, 0x4a8fff);
    makeRupee(cx - 4, cz + 4, 5, 0x4a8fff);
    makeRupee(cx + 4, cz + 4, 5, 0x4a8fff);
    makeRupee(cx,     cz,     20, 0xff4a4a);
    // Room D — mage sanctum
    spawnMonster("mage", dx - 6, dz - 4);
    spawnMonster("mage", dx + 6, dz + 4);
    spawnMonster("slime", dx, dz + 6);

    // ---- Projectiles ----
    const projectiles: Projectile[] = [];

    function fireProjectile(from: THREE.Vector3, target: THREE.Vector3, fromEnemy: boolean, dmg: number) {
      let m: THREE.Mesh;
      if (fromEnemy) {
        m = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 10, 8),
          new THREE.MeshStandardMaterial({ color: 0x66ddff, emissive: 0x66ddff, emissiveIntensity: 0.8 })
        );
      } else {
        // Arrow — thin cylinder with cone tip
        const arrowGroup = new THREE.Group();
        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6),
          new THREE.MeshStandardMaterial({ color: 0x6b3a14, roughness: 0.85 })
        );
        shaft.rotation.z = Math.PI / 2;
        arrowGroup.add(shaft);
        const tip = new THREE.Mesh(
          new THREE.ConeGeometry(0.07, 0.18, 6),
          new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.7, roughness: 0.3 })
        );
        tip.rotation.z = -Math.PI / 2;
        tip.position.x = 0.42;
        arrowGroup.add(tip);
        const fletch = new THREE.Mesh(
          new THREE.ConeGeometry(0.1, 0.18, 4),
          new THREE.MeshStandardMaterial({ color: 0xff2a3a, emissive: 0xaa0011, emissiveIntensity: 0.4 })
        );
        fletch.rotation.z = Math.PI / 2;
        fletch.position.x = -0.38;
        arrowGroup.add(fletch);
        // wrap into a single mesh-like proxy: use a small invisible mesh as anchor and add arrowGroup as child
        const anchor = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 4, 4),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        anchor.add(arrowGroup);
        const dir = target.clone().sub(from).setY(0).normalize();
        const yaw = Math.atan2(dir.x, dir.z);
        anchor.rotation.y = yaw - Math.PI / 2; // align arrow's +X (its forward) with movement direction
        m = anchor;
      }
      m.position.copy(from);
      const dir = target.clone().sub(from).setY(0).normalize();
      scene.add(m);
      projectiles.push({ mesh: m, vel: dir.multiplyScalar(fromEnemy ? 12 : 18), life: fromEnemy ? 2.0 : 1.6, damage: dmg, fromEnemy });
    }

    // ---- Input ----
    const keys = new Set<string>();
    let attackPressed = false;
    let bowFirePressed = false;
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const slotMap: Record<string, TunicId> = {
        "1": "green", "2": "red", "3": "blue", "4": "white", "5": "shadow",
      };
      if (down && slotMap[e.key]) {
        e.preventDefault();
        equipFnRef.current(slotMap[e.key]);
        return;
      }
      const k = e.key.toLowerCase();
      if (["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"," ","j","z","u","b","shift"].includes(k)) {
        e.preventDefault();
      }
      if (down) {
        keys.add(k);
        if (k === " " || k === "j" || k === "z") attackPressed = true;
        if (k === "b") {
          const s = stateRef.current;
          s.weapon = s.weapon === "sword" ? "bow" : "sword";
          // sync visuals: hide sheathed sword if bow is held in hand? keep sheath visible (sword stays in sheath)
          setBowPose(s.weapon === "bow");
          setHud((h) => ({ ...h, weapon: s.weapon }));
          showToast(s.weapon === "bow" ? "Equipped Bow" : "Equipped Sword");
        }
        if (k === "u") {
          const s = stateRef.current;
          if (s.swordLevel >= SWORD_MAX_LEVEL) {
            showToast("Sword already at max level");
          } else if (s.swordShards < SWORD_UPGRADE_COST) {
            showToast(`Need ${SWORD_UPGRADE_COST} shards (have ${s.swordShards})`);
          } else {
            s.swordShards -= SWORD_UPGRADE_COST;
            s.swordLevel += 1;
            applySwordVisuals();
            setHud((h) => ({ ...h, swordLevel: s.swordLevel, swordShards: s.swordShards }));
            showToast(`Sword upgraded → Lv ${s.swordLevel}`);
          }
        }
      } else {
        keys.delete(k);
      }
    };
    const onDown = (e: KeyboardEvent) => onKey(e, true);
    const onUp = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);

    // Mouse for camera rotation (drag)
    let camYaw = Math.PI; // facing -z by default; we'll set behind hero
    let camPitch = 0.55;
    let dragging = false;
    let lastX = 0, lastY = 0;
    const onMD = (e: MouseEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; };
    const onMU = () => { dragging = false; };
    const onMM = (e: MouseEvent) => {
      if (!dragging) return;
      camYaw -= (e.clientX - lastX) * 0.005;
      camPitch = Math.max(0.2, Math.min(1.2, camPitch + (e.clientY - lastY) * 0.003));
      lastX = e.clientX; lastY = e.clientY;
    };
    renderer.domElement.addEventListener("mousedown", onMD);
    window.addEventListener("mouseup", onMU);
    window.addEventListener("mousemove", onMM);

    // ---- Helpers ----
    function collidesObstacle(x: number, z: number, radius: number) {
      for (const o of obstacles) {
        const d = Math.hypot(x - o.pos.x, z - o.pos.z);
        if (d < o.radius + radius) return true;
      }
      // lake
      const dl = Math.hypot(x - 0, z - (-25));
      if (dl < 7 + radius) return true;
      // world bounds
      if (Math.abs(x) > WORLD / 2 - 1 || Math.abs(z) > WORLD / 2 - 1) return true;
      return false;
    }

    // ---- Main loop ----
    const clock = new THREE.Clock();
    let raf = 0;
    let walkPhase = 0;
    let lastNear = "";

    function frame() {
      const dt = Math.min(0.05, clock.getDelta());
      const st = stateRef.current;
      const tunic = TUNICS[st.tunic];

      // --- Hero movement ---
      // WASD = camera-relative; Arrow keys = world-absolute (Up=north, etc.)
      let camX = 0, camZ = 0;       // camera-relative input (WASD)
      let worldX = 0, worldZ = 0;   // world-absolute input (arrows)
      if (keys.has("w")) camZ -= 1;
      if (keys.has("s")) camZ += 1;
      if (keys.has("a")) camX -= 1;
      if (keys.has("d")) camX += 1;
      if (keys.has("arrowup"))    worldZ -= 1;
      if (keys.has("arrowdown"))  worldZ += 1;
      if (keys.has("arrowleft"))  worldX -= 1;
      if (keys.has("arrowright")) worldX += 1;

      let wx = 0, wz = 0;
      const camLen = Math.hypot(camX, camZ);
      if (camLen > 0) {
        camX /= camLen; camZ /= camLen;
        const cosY = Math.cos(camYaw);
        const sinY = Math.sin(camYaw);
        wx += camX * cosY - camZ * sinY;
        wz += camX * sinY + camZ * cosY;
      }
      wx += worldX;
      wz += worldZ;
      const wLen = Math.hypot(wx, wz);
      let moving = false;
      if (wLen > 0) {
        moving = true;
        wx /= wLen; wz /= wLen;
        const speed = tunic.speed;
        const nx = heroGroup.position.x + wx * speed * dt;
        const nz = heroGroup.position.z + wz * speed * dt;
        if (!collidesObstacle(nx, heroGroup.position.z, 0.4)) heroGroup.position.x = nx;
        if (!collidesObstacle(heroGroup.position.x, nz, 0.4)) heroGroup.position.z = nz;
        // face movement
        const targetYaw = Math.atan2(wx, wz);
        let dY = targetYaw - heroGroup.rotation.y;
        while (dY > Math.PI) dY -= Math.PI * 2;
        while (dY < -Math.PI) dY += Math.PI * 2;
        heroGroup.rotation.y += dY * Math.min(1, dt * 12);
        walkPhase += dt * 10;
      } else {
        walkPhase *= 0.9;
      }

      // walk bob
      const bob = moving ? Math.sin(walkPhase) * 0.06 : 0;
      heroGroup.position.y = bob;
      legL.rotation.x = moving ? Math.sin(walkPhase) * 0.6 : 0;
      legR.rotation.x = moving ? -Math.sin(walkPhase) * 0.6 : 0;
      armL.rotation.x = moving ? -Math.sin(walkPhase) * 0.5 : 0;
      armR.rotation.x = moving ? Math.sin(walkPhase) * 0.5 : 0;

      // --- Attack / Fire ---
      st.attackCd = Math.max(0, st.attackCd - dt);
      st.bowCd = Math.max(0, st.bowCd - dt);
      if (attackPressed && st.weapon === "sword" && st.attackCd <= 0) {
        st.attackTimer = 0.3;
        st.attackCd = 0.4;
        swordPivot.visible = true;
        sheathedSword.visible = false; // drawn from sheath
      } else if (attackPressed && st.weapon === "bow" && st.bowCd <= 0) {
        if (st.arrows > 0) {
          st.arrows -= 1;
          st.bowCd = 0.45;
          // fire from bow position, in hero facing direction
          const fwd = new THREE.Vector3(Math.sin(heroGroup.rotation.y), 0, Math.cos(heroGroup.rotation.y));
          const origin = heroGroup.position.clone().add(new THREE.Vector3(0, 1.15, 0)).add(fwd.clone().multiplyScalar(0.6));
          const target = origin.clone().add(fwd.clone().multiplyScalar(10));
          fireProjectile(origin, target, false, 2);
          // string twang animation
          bowString.scale.x = 0.4;
          setHud((h) => ({ ...h, arrows: st.arrows }));
        } else {
          showToast("Out of arrows");
          st.bowCd = 0.3;
        }
      }
      // restore string
      if (bowString.scale.x < 1) bowString.scale.x = Math.min(1, bowString.scale.x + dt * 6);
      attackPressed = false;
      if (st.attackTimer > 0) {
        st.attackTimer -= dt;
        // swing arc 0..1
        const t = 1 - st.attackTimer / 0.3;
        swordPivot.rotation.y = -1.2 + t * 2.4;
        if (st.attackTimer <= 0) {
          swordPivot.visible = false;
          sheathedSword.visible = true; // sheathed again
        }
      }

      // --- iframes ---
      if (st.iframes > 0) {
        st.iframes = Math.max(0, st.iframes - dt);
        const blink = Math.floor(st.iframes * 20) % 2 === 0;
        body.visible = blink;
        head.visible = blink;
        hat.visible = blink;
        armL.visible = blink; armR.visible = blink;
        legL.visible = blink; legR.visible = blink;
      } else {
        body.visible = true; head.visible = true; hat.visible = true;
        armL.visible = true; armR.visible = true; legL.visible = true; legR.visible = true;
      }

      // --- Pickup tunics ---
      for (let i = pickups.length - 1; i >= 0; i--) {
        const p = pickups[i];
        p.bobPhase += dt * 2;
        p.mesh.position.y = 0.6 + Math.sin(p.bobPhase) * 0.15;
        p.mesh.rotation.y += dt * 0.8;
        const d = Math.hypot(heroGroup.position.x - p.mesh.position.x, heroGroup.position.z - p.mesh.position.z);
        if (d < 1.0) {
          if (!st.inventory.has(p.tunic)) {
            st.inventory.add(p.tunic);
            setHud((h) => ({ ...h, inventory: Array.from(st.inventory) }));
            equipFnRef.current(p.tunic);
            showToast(`Found ${TUNICS[p.tunic].name} — ${TUNICS[p.tunic].perk}`);
          }
          scene.remove(p.mesh);
          pickups.splice(i, 1);
        }
      }

      // --- Hearts ---
      for (let i = hearts.length - 1; i >= 0; i--) {
        const h = hearts[i];
        h.bobPhase += dt * 3;
        h.mesh.position.y = 0.7 + Math.sin(h.bobPhase) * 0.1;
        const d = Math.hypot(heroGroup.position.x - h.mesh.position.x, heroGroup.position.z - h.mesh.position.z);
        if (d < 0.9) {
          st.hp = Math.min(st.maxHp, st.hp + 2);
          setHud((hh) => ({ ...hh, hp: st.hp }));
          scene.remove(h.mesh);
          hearts.splice(i, 1);
        }
      }

      // --- Rupees ---
      for (let i = rupees.length - 1; i >= 0; i--) {
        const r = rupees[i];
        r.phase += dt * 2;
        r.mesh.position.y = 0.7 + Math.sin(r.phase) * 0.15;
        r.mesh.rotation.y += dt * 2;
        const d = Math.hypot(heroGroup.position.x - r.mesh.position.x, heroGroup.position.z - r.mesh.position.z);
        if (d < 0.9) {
          st.rupees += r.value;
          setHud((h) => ({ ...h, rupees: st.rupees }));
          showToast(r.value >= 20 ? `+${r.value} rupees!` : r.value >= 5 ? `+${r.value} rupees` : `+${r.value} rupee`);
          scene.remove(r.mesh);
          rupees.splice(i, 1);
        }
      }

      // --- Heart containers ---
      for (let i = heartContainers.length - 1; i >= 0; i--) {
        const hc = heartContainers[i];
        if (hc.collected) continue;
        hc.phase += dt * 1.5;
        hc.mesh.position.y = 1.2 + Math.sin(hc.phase) * 0.2;
        hc.mesh.rotation.y += dt * 1.0;
        const d = Math.hypot(heroGroup.position.x - hc.mesh.position.x, heroGroup.position.z - hc.mesh.position.z);
        if (d < 1.0) {
          hc.collected = true;
          st.maxHp += 2;
          st.hp = st.maxHp;
          setHud((h) => ({ ...h, hp: st.hp, maxHp: st.maxHp }));
          showToast("Heart Container — max HP +1");
          scene.remove(hc.mesh);
          heartContainers.splice(i, 1);
        }
      }

      // --- Portal animations + transitions ---
      portalDisc.rotation.z += dt * 1.5;
      ringFrame.rotation.z += dt * 0.4;
      exitDisc.rotation.z -= dt * 1.5;
      exitRing.rotation.z -= dt * 0.4;
      st.portalCooldown = Math.max(0, st.portalCooldown - dt);

      if (st.portalCooldown <= 0) {
        if (st.zone === "overworld") {
          const dToPortal = Math.hypot(heroGroup.position.x - 4, heroGroup.position.z - (-10));
          if (dToPortal < 1.5) {
            // teleport into the dungeon
            heroGroup.position.set(dungeonOrigin.x, 0, dungeonOrigin.z + 10);
            st.zone = "dungeon";
            st.portalCooldown = 1.2;
            st.iframes = 0.8;
            setHud((h) => ({ ...h, zone: "dungeon" }));
            showToast("Entered the Hollow Keep");
          }
        } else {
          const dExit = Math.hypot(heroGroup.position.x - dungeonOrigin.x, heroGroup.position.z - (dungeonOrigin.z + 14));
          if (dExit < 1.5) {
            heroGroup.position.set(4, 0, -7);
            st.zone = "overworld";
            st.portalCooldown = 1.2;
            st.iframes = 0.8;
            setHud((h) => ({ ...h, zone: "overworld" }));
            showToast("Returned to the Glade");
          }
        }
      }

      // --- Monsters ---
      // sword reach + hit radius scale with upgrade level
      const swordReach = 2.2 + st.swordLevel * 0.25;
      const swordHitRadius = 1.9 + st.swordLevel * 0.18;
      let swordHit: THREE.Vector3 | null = null;
      if (st.attackTimer > 0.05) {
        const fwd = new THREE.Vector3(Math.sin(heroGroup.rotation.y), 0, Math.cos(heroGroup.rotation.y));
        swordHit = heroGroup.position.clone().add(fwd.multiplyScalar(swordReach));
      }

      let nearestNear = "";
      let nearestNearDist = 5;

      for (const m of monsters) {
        if (!m.alive) continue;
        const dx = heroGroup.position.x - m.group.position.x;
        const dz = heroGroup.position.z - m.group.position.z;
        const dist = Math.hypot(dx, dz);

        if (dist < nearestNearDist) {
          nearestNearDist = dist;
          nearestNear = m.def.name;
        }

        // Movement / behavior
        if (m.def.type === "bat") {
          // hover and chase
          m.bobPhase += dt * 4;
          m.group.position.y = 1.6 + Math.sin(m.bobPhase) * 0.3;
          const wL = m.group.getObjectByName("wingL") as THREE.Mesh | undefined;
          const wR = m.group.getObjectByName("wingR") as THREE.Mesh | undefined;
          if (wL) wL.rotation.z = Math.sin(m.bobPhase * 4) * 0.8;
          if (wR) wR.rotation.z = -Math.sin(m.bobPhase * 4) * 0.8;
          if (dist < 18 && dist > 0.01) {
            m.group.position.x += (dx / dist) * m.def.speed * dt;
            m.group.position.z += (dz / dist) * m.def.speed * dt;
          }
        } else if (m.def.type === "mage") {
          // keep distance, fire projectiles
          m.attackCd -= dt;
          if (dist < 14 && dist > 7) {
            // strafe slightly
            m.group.position.x += Math.cos(m.bobPhase) * dt * 0.6;
            m.group.position.z += Math.sin(m.bobPhase) * dt * 0.6;
            m.bobPhase += dt;
          } else if (dist <= 7 && dist > 0.01) {
            // back away
            m.group.position.x -= (dx / dist) * m.def.speed * dt;
            m.group.position.z -= (dz / dist) * m.def.speed * dt;
          } else if (dist > 14 && dist > 0.01) {
            m.group.position.x += (dx / dist) * m.def.speed * dt;
            m.group.position.z += (dz / dist) * m.def.speed * dt;
          }
          // face hero
          m.group.rotation.y = Math.atan2(dx, dz);
          if (dist < 18 && m.attackCd <= 0) {
            m.attackCd = 1.8;
            const orig = new THREE.Vector3(m.group.position.x, 1.8, m.group.position.z);
            fireProjectile(orig, heroGroup.position.clone().setY(1.2), true, m.def.damage);
          }
        } else if (m.def.type === "boss") {
          // chase, slam-attack at range
          m.attackCd -= dt;
          if (dist > 0.01 && dist < 30) {
            m.group.position.x += (dx / dist) * m.def.speed * dt;
            m.group.position.z += (dz / dist) * m.def.speed * dt;
          }
          m.group.rotation.y = Math.atan2(dx, dz);
          // periodic projectile burst
          if (m.attackCd <= 0 && dist < 18) {
            m.attackCd = 2.5;
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
              const orig = new THREE.Vector3(m.group.position.x, 2.0, m.group.position.z);
              const tgt = orig.clone().add(new THREE.Vector3(Math.sin(a), 0, Math.cos(a)).multiplyScalar(5));
              fireProjectile(orig, tgt, true, m.def.damage);
            }
          }
        } else {
          // slime/skeleton/knight: chase
          if (dist > 0.01 && dist < 20) {
            m.group.position.x += (dx / dist) * m.def.speed * dt;
            m.group.position.z += (dz / dist) * m.def.speed * dt;
            m.group.rotation.y = Math.atan2(dx, dz);
          }
          if (m.def.type === "slime") {
            m.bobPhase += dt * 4;
            m.group.position.y = Math.abs(Math.sin(m.bobPhase)) * 0.25;
          }
        }

        // Hit flash
        if (m.hitFlash > 0) {
          m.hitFlash -= dt;
          m.group.scale.setScalar(1 + m.hitFlash * 0.4);
        } else {
          m.group.scale.setScalar(1);
        }

        // Sword hit — neon red sword: damage and knockback scale with upgrade level
        if (swordHit) {
          const sd = Math.hypot(swordHit.x - m.group.position.x, swordHit.z - m.group.position.z);
          if (sd < swordHitRadius && m.hitFlash <= 0) {
            const swordDmg = (2 + st.swordLevel) * tunic.damageMul; // Lv1=3, Lv5=7
            m.hp -= swordDmg;
            m.hitFlash = 0.18;
            const k = 2.0 + st.swordLevel * 0.4;
            if (dist > 0.01) {
              m.group.position.x -= (dx / dist) * k;
              m.group.position.z -= (dz / dist) * k;
            }
            if (m.hp <= 0) {
              m.alive = false;
              scene.remove(m.group);
              st.rupees += m.def.rupees;
              // shard drop: bigger enemies = more shards, boss guaranteed big drop
              const shardChance = m.def.type === "boss" ? 1 : m.def.type === "knight" || m.def.type === "mage" ? 0.7 : 0.35;
              if (Math.random() < shardChance) {
                const amt = m.def.type === "boss" ? 5 : 1;
                st.swordShards += amt;
                setHud((h) => ({ ...h, swordShards: st.swordShards }));
                showToast(`+${amt} sword shard${amt > 1 ? "s" : ""}`);
              }
              setHud((h) => ({ ...h, rupees: st.rupees }));
              if (Math.random() < 0.45) dropHeart(m.group.position.x, m.group.position.z);
              if (m.def.type === "boss") {
                st.bossDefeated = true;
                setHud((h) => ({ ...h, won: true }));
              }
            }
          }
        }

        // Contact damage
        if (m.alive && st.iframes <= 0 && dist < m.def.contactRange && m.def.type !== "mage" && m.def.type !== "boss") {
          const dmg = Math.max(1, Math.round(m.def.damage * tunic.damageTaken));
          st.hp = Math.max(0, st.hp - dmg);
          st.iframes = 1.0;
          setHud((h) => ({ ...h, hp: st.hp }));
        }
        // boss melee
        if (m.alive && m.def.type === "boss" && st.iframes <= 0 && dist < m.def.contactRange) {
          const dmg = Math.max(1, Math.round(m.def.damage * tunic.damageTaken));
          st.hp = Math.max(0, st.hp - dmg);
          st.iframes = 1.0;
          setHud((h) => ({ ...h, hp: st.hp }));
        }
      }

      if (nearestNear !== lastNear) {
        lastNear = nearestNear;
        setHud((h) => ({ ...h, near: nearestNear }));
      }

      // --- Projectiles ---
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.mesh.position.x += p.vel.x * dt;
        p.mesh.position.z += p.vel.z * dt;
        p.life -= dt;
        if (p.fromEnemy && st.iframes <= 0) {
          const d = Math.hypot(p.mesh.position.x - heroGroup.position.x, p.mesh.position.z - heroGroup.position.z);
          if (d < 0.7) {
            const dmg = Math.max(1, Math.round(p.damage * tunic.damageTaken));
            st.hp = Math.max(0, st.hp - dmg);
            st.iframes = 1.0;
            setHud((h) => ({ ...h, hp: st.hp }));
            scene.remove(p.mesh);
            projectiles.splice(i, 1);
            continue;
          }
        } else if (!p.fromEnemy) {
          // Player arrows damage monsters
          let hitMonster = false;
          for (const m of monsters) {
            if (!m.alive) continue;
            const d = Math.hypot(p.mesh.position.x - m.group.position.x, p.mesh.position.z - m.group.position.z);
            if (d < 0.8 && m.hitFlash <= 0) {
              m.hp -= p.damage;
              m.hitFlash = 0.18;
              hitMonster = true;
              if (m.hp <= 0) {
                m.alive = false;
                scene.remove(m.group);
                st.rupees += m.def.rupees;
                const shardChance = m.def.type === "boss" ? 1 : m.def.type === "knight" || m.def.type === "mage" ? 0.7 : 0.35;
                if (Math.random() < shardChance) {
                  const amt = m.def.type === "boss" ? 5 : 1;
                  st.swordShards += amt;
                  setHud((h) => ({ ...h, swordShards: st.swordShards }));
                }
                if (Math.random() < 0.45) dropHeart(m.group.position.x, m.group.position.z);
                if (m.def.type === "boss") {
                  st.bossDefeated = true;
                  setHud((h) => ({ ...h, won: true }));
                }
                setHud((h) => ({ ...h, rupees: st.rupees }));
              }
              break;
            }
          }
          if (hitMonster) {
            scene.remove(p.mesh);
            projectiles.splice(i, 1);
            continue;
          }
        }
        if (p.life <= 0 || collidesObstacle(p.mesh.position.x, p.mesh.position.z, 0.1)) {
          scene.remove(p.mesh);
          projectiles.splice(i, 1);
        }
      }

      // --- Respawn on death ---
      if (st.hp <= 0) {
        st.hp = st.maxHp;
        st.iframes = 1.5;
        heroGroup.position.set(0, 0, 25);
        setHud((h) => ({ ...h, hp: st.hp }));
        showToast("You faded back to the glade...");
      }

      // --- Camera follow ---
      const camDist = 7;
      const camHeight = camDist * Math.sin(camPitch);
      const camRadius = camDist * Math.cos(camPitch);
      const cx = heroGroup.position.x - Math.sin(camYaw) * camRadius;
      const cz = heroGroup.position.z - Math.cos(camYaw) * camRadius;
      camera.position.lerp(new THREE.Vector3(cx, 1.5 + camHeight, cz), Math.min(1, dt * 8));
      camera.lookAt(heroGroup.position.x, 1.2, heroGroup.position.z);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);

    // Resize
    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("mouseup", onMU);
      window.removeEventListener("mousemove", onMM);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("mousedown", onMD);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [showToast]);

  // touch buttons (movement handled via simulated keys)
  const press = (k: string) => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: k }));
  };
  const release = (k: string) => {
    window.dispatchEvent(new KeyboardEvent("keyup", { key: k }));
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* HUD bar */}
      <div className="flex items-center justify-between w-full max-w-[960px] px-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {hud.near || "The Glade"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5">
            {Array.from({ length: hud.maxHp / 2 }).map((_, i) => {
              const filled = hud.hp >= (i + 1) * 2;
              const half = !filled && hud.hp >= i * 2 + 1;
              return (
                <div key={i} className="relative h-4 w-4">
                  <div
                    className="absolute inset-0"
                    style={{
                      background: filled
                        ? "var(--heart)"
                        : half
                        ? "linear-gradient(90deg, var(--heart) 50%, var(--stone-dark) 50%)"
                        : "var(--stone-dark)",
                      clipPath:
                        "polygon(50% 100%, 0 35%, 0 15%, 20% 0, 50% 20%, 80% 0, 100% 15%, 100% 35%)",
                    }}
                  />
                </div>
              );
            })}
          </div>
          <span className="font-mono text-xs text-foreground">◆ {hud.rupees}</span>
          <span className="font-mono text-xs" style={{ color: "#ff4a5c", textShadow: "0 0 8px #ff1a2b" }}>
            ⚔ Lv {hud.swordLevel} · ✦ {hud.swordShards}
          </span>
          <span className="font-mono text-xs" style={{ color: hud.weapon === "bow" ? "#ffd24a" : "#aaaaaa" }}>
            {hud.weapon === "bow" ? "🏹 Bow" : "⚔ Sword"} · ➳ {hud.arrows}
          </span>
        </div>
      </div>

      {/* 3D viewport */}
      <div
        ref={mountRef}
        className="relative w-full max-w-[960px] aspect-[16/9] rounded-md overflow-hidden"
        style={{ boxShadow: "0 0 0 4px var(--stone-dark), 0 30px 80px -20px rgba(0,0,0,0.7)" }}
      >
        {hud.won && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
            <div className="text-center">
              <p className="font-mono text-xs uppercase tracking-[0.4em] text-muted-foreground">
                The Guardian falls
              </p>
              <h2 className="mt-2 text-3xl font-light tracking-wide text-foreground">
                The lake is yours
              </h2>
            </div>
          </div>
        )}
      </div>

      {hud.toast && (
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-foreground bg-card/80 px-3 py-1.5 rounded border border-border animate-fade-in">
          {hud.toast}
        </div>
      )}

      {/* Wardrobe */}
      <div className="w-full max-w-[960px]">
        <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-2 text-center">
          Wardrobe
        </div>
        <div className="grid grid-cols-5 gap-2">
          {(Object.keys(TUNICS) as TunicId[]).map((id, i) => {
            const t = TUNICS[id];
            const owned = hud.inventory.includes(id);
            const equipped = hud.tunic === id;
            const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");
            return (
              <button
                key={id}
                onClick={() => owned && equipFnRef.current(id)}
                disabled={!owned}
                className={[
                  "group relative flex flex-col items-center gap-1 rounded p-2 border transition-all",
                  equipped
                    ? "border-foreground bg-card"
                    : owned
                    ? "border-border bg-card/60 hover:border-foreground/60 hover:bg-card cursor-pointer"
                    : "border-border/40 bg-card/30 opacity-50 cursor-not-allowed",
                ].join(" ")}
                title={owned ? `${t.name} — ${t.perk}` : "Not yet found"}
              >
                <div className="relative h-10 w-8">
                  <div className="absolute inset-x-1 top-1 h-2 rounded-sm" style={{ background: owned ? hex(t.trim) : "var(--stone-dark)" }} />
                  <div className="absolute inset-x-0 top-3 bottom-0 rounded-sm" style={{ background: owned ? hex(t.body) : "var(--stone-dark)" }} />
                  <div className="absolute left-1/2 -translate-x-1/2 top-6 h-1.5 w-4 rounded-sm" style={{ background: owned ? hex(t.accent) : "transparent" }} />
                </div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-foreground/80 truncate w-full">
                  {owned ? t.name.split(" ")[0] : "???"}
                </span>
                <span className="absolute top-1 right-1 font-mono text-[8px] text-muted-foreground">{i + 1}</span>
                {equipped && <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-foreground" />}
              </button>
            );
          })}
        </div>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground text-center">
          {TUNICS[hud.tunic].name} · {TUNICS[hud.tunic].perk}
        </p>
      </div>

      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground text-center">
        WASD / Arrows move · Space swing/shoot · B toggle bow · U upgrade sword · 1–5 tunic · Drag to orbit
      </div>

      {/* Mobile controls */}
      <div className="md:hidden grid grid-cols-3 gap-2 mt-2 select-none w-48">
        <div />
        <button className="aspect-square rounded bg-card text-foreground/80 active:bg-accent" onTouchStart={() => press("w")} onTouchEnd={() => release("w")}>▲</button>
        <button className="aspect-square rounded bg-[var(--hero-accent)] text-foreground row-span-2" onTouchStart={() => press(" ")} onTouchEnd={() => release(" ")}>⚔</button>
        <button className="aspect-square rounded bg-card text-foreground/80 active:bg-accent" onTouchStart={() => press("a")} onTouchEnd={() => release("a")}>◀</button>
        <button className="aspect-square rounded bg-card text-foreground/80 active:bg-accent" onTouchStart={() => press("s")} onTouchEnd={() => release("s")}>▼</button>
        <button className="aspect-square rounded bg-card text-foreground/80 active:bg-accent col-start-1 row-start-3" onTouchStart={() => press("d")} onTouchEnd={() => release("d")}>▶</button>
      </div>
    </div>
  );
}
