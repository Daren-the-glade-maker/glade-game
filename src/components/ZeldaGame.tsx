import { useEffect, useRef, useState, useCallback } from "react";

const TILE = 32;
const COLS = 20;
const ROWS = 14;
const W = COLS * TILE;
const H = ROWS * TILE;

type TileType = "grass" | "tree" | "stone" | "water" | "sand" | "door";
type Dir = "up" | "down" | "left" | "right";

interface Enemy {
  x: number;
  y: number;
  hp: number;
  dir: Dir;
  cooldown: number;
  alive: boolean;
}

interface Heart {
  x: number;
  y: number;
}

type TunicId = "green" | "red" | "blue" | "white" | "shadow";

interface TunicDef {
  id: TunicId;
  name: string;
  body: string;
  accent: string;
  trim: string;
  perk: string;
  speed: number;
  damageMul: number;
  damageTaken: number;
}

interface Pickup {
  x: number;
  y: number;
  tunic: TunicId;
}

interface Room {
  tiles: TileType[][];
  enemies: Enemy[];
  hearts: Heart[];
  pickups: Pickup[];
  exits: Partial<Record<Dir, { room: string; x: number; y: number }>>;
  name: string;
}

const TUNICS: Record<TunicId, TunicDef> = {
  green:  { id: "green",  name: "Forest Tunic", body: "oklch(0.72 0.18 145)",  accent: "oklch(0.55 0.20 30)",  trim: "oklch(0.42 0.12 145)", perk: "Balanced",            speed: 2,   damageMul: 1,   damageTaken: 1 },
  red:    { id: "red",    name: "Ember Tunic",  body: "oklch(0.62 0.20 30)",   accent: "oklch(0.88 0.15 75)",  trim: "oklch(0.40 0.18 25)",  perk: "+50% sword damage",   speed: 2,   damageMul: 1.5, damageTaken: 1 },
  blue:   { id: "blue",   name: "Tide Tunic",   body: "oklch(0.55 0.15 230)",  accent: "oklch(0.85 0.10 230)", trim: "oklch(0.30 0.12 240)", perk: "Halves damage taken", speed: 2,   damageMul: 1,   damageTaken: 0.5 },
  white:  { id: "white",  name: "Wind Cloak",   body: "oklch(0.94 0.02 240)",  accent: "oklch(0.70 0.05 240)", trim: "oklch(0.55 0.05 240)", perk: "Faster on foot",      speed: 3,   damageMul: 1,   damageTaken: 1 },
  shadow: { id: "shadow", name: "Shadow Veil",  body: "oklch(0.28 0.04 280)",  accent: "oklch(0.55 0.18 300)", trim: "oklch(0.12 0.02 280)", perk: "Power + speed",       speed: 2.5, damageMul: 1.5, damageTaken: 1 },
};

// ---- Room builders ----
function blankRoom(fill: TileType = "grass"): TileType[][] {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => fill));
}

function border(t: TileType[][], type: TileType = "tree") {
  for (let x = 0; x < COLS; x++) {
    t[0][x] = type;
    t[ROWS - 1][x] = type;
  }
  for (let y = 0; y < ROWS; y++) {
    t[y][0] = type;
    t[y][COLS - 1] = type;
  }
}

function buildRooms(): Record<string, Room> {
  // Room A: starting clearing
  const a = blankRoom("grass");
  border(a, "tree");
  // path of sand
  for (let x = 6; x < 14; x++) a[7][x] = "sand";
  a[6][9] = "stone";
  a[8][10] = "stone";
  // east exit
  a[7][COLS - 1] = "door";

  // Room B: stone clearing with enemies
  const b = blankRoom("grass");
  border(b, "tree");
  // stone ruins
  for (let x = 4; x < 8; x++) b[4][x] = "stone";
  for (let y = 4; y < 8; y++) b[y][4] = "stone";
  b[10][14] = "stone";
  b[10][15] = "stone";
  b[11][14] = "stone";
  // west and east exits
  b[7][0] = "door";
  b[7][COLS - 1] = "door";

  // Room C: lake room (boss-ish)
  const c = blankRoom("grass");
  border(c, "tree");
  // water lake center
  for (let y = 4; y < 10; y++) {
    for (let x = 7; x < 13; x++) {
      c[y][x] = "water";
    }
  }
  // sand around lake
  for (let y = 3; y < 11; y++) {
    for (let x = 6; x < 14; x++) {
      if (c[y][x] === "grass") c[y][x] = "sand";
    }
  }
  c[7][0] = "door";

  return {
    A: {
      name: "Whispering Glade",
      tiles: a,
      enemies: [
        { x: 5 * TILE, y: 4 * TILE, hp: 1, dir: "down", cooldown: 0, alive: true },
      ],
      hearts: [],
      pickups: [{ x: 16 * TILE, y: 4 * TILE, tunic: "red" }],
      exits: { right: { room: "B", x: TILE, y: 7 * TILE } },
    },
    B: {
      name: "Ruined Court",
      tiles: b,
      enemies: [
        { x: 10 * TILE, y: 6 * TILE, hp: 2, dir: "left", cooldown: 0, alive: true },
        { x: 13 * TILE, y: 9 * TILE, hp: 2, dir: "up", cooldown: 0, alive: true },
        { x: 6 * TILE, y: 10 * TILE, hp: 1, dir: "right", cooldown: 0, alive: true },
      ],
      hearts: [{ x: 10 * TILE, y: 3 * TILE }],
      pickups: [{ x: 2 * TILE, y: 11 * TILE, tunic: "white" }],
      exits: {
        left: { room: "A", x: (COLS - 2) * TILE, y: 7 * TILE },
        right: { room: "C", x: TILE, y: 7 * TILE },
      },
    },
    C: {
      name: "Mirror Lake",
      tiles: c,
      enemies: [
        { x: 3 * TILE, y: 3 * TILE, hp: 3, dir: "down", cooldown: 0, alive: true },
        { x: 16 * TILE, y: 3 * TILE, hp: 3, dir: "down", cooldown: 0, alive: true },
        { x: 3 * TILE, y: 10 * TILE, hp: 3, dir: "up", cooldown: 0, alive: true },
        { x: 16 * TILE, y: 10 * TILE, hp: 3, dir: "up", cooldown: 0, alive: true },
      ],
      hearts: [{ x: 10 * TILE, y: 12 * TILE }],
      pickups: [
        { x: 10 * TILE, y: 2 * TILE, tunic: "blue" },
        { x: 10 * TILE, y: 11 * TILE, tunic: "shadow" },
      ],
      exits: { left: { room: "B", x: (COLS - 2) * TILE, y: 7 * TILE } },
    },
  };
}

function isBlocked(t: TileType) {
  return t === "tree" || t === "stone" || t === "water";
}

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export default function ZeldaGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({
    rooms: buildRooms(),
    currentRoom: "A",
    hero: { x: 3 * TILE, y: 7 * TILE, dir: "right" as Dir, hp: 6, maxHp: 6, iframes: 0 },
    keys: new Set<string>(),
    attack: { active: false, timer: 0 },
    rupees: 0,
    tunic: "green" as TunicId,
    inventory: new Set<TunicId>(["green"]),
  });
  const [, force] = useState(0);
  const [hud, setHud] = useState({
    hp: 6, maxHp: 6, room: "Whispering Glade", rupees: 0, won: false,
    tunic: "green" as TunicId,
    inventory: ["green"] as TunicId[],
    toast: "" as string,
  });
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setHud((h) => ({ ...h, toast: msg }));
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setHud((h) => ({ ...h, toast: "" }));
    }, 2200);
  }, []);

  const refreshHud = useCallback(() => {
    const s = stateRef.current;
    setHud((h) => ({
      ...h,
      hp: s.hero.hp,
      maxHp: s.hero.maxHp,
      room: s.rooms[s.currentRoom].name,
      rupees: s.rupees,
      won: s.rooms[s.currentRoom].enemies.every((e) => !e.alive) && s.currentRoom === "C",
      tunic: s.tunic,
      inventory: Array.from(s.inventory),
    }));
  }, []);

  const equipTunic = useCallback((id: TunicId) => {
    const st = stateRef.current;
    if (!st.inventory.has(id)) return;
    st.tunic = id;
    showToast(`Equipped ${TUNICS[id].name}`);
    refreshHud();
  }, [refreshHud, showToast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const map: Record<string, string> = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
        w: "up", s: "down", a: "left", d: "right",
        W: "up", S: "down", A: "left", D: "right",
        " ": "attack", j: "attack", J: "attack", z: "attack", Z: "attack",
      };
      const slotMap: Record<string, TunicId> = {
        "1": "green", "2": "red", "3": "blue", "4": "white", "5": "shadow",
      };
      if (down && slotMap[e.key]) {
        e.preventDefault();
        equipTunic(slotMap[e.key]);
        return;
      }
      const k = map[e.key];
      if (!k) return;
      e.preventDefault();
      const st = stateRef.current;
      if (down) {
        st.keys.add(k);
        if (k === "attack" && !st.attack.active) {
          st.attack.active = true;
          st.attack.timer = 12;
        }
      } else {
        st.keys.delete(k);
      }
    };
    const dn = (e: KeyboardEvent) => onKey(e, true);
    const up = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
    };
  }, [equipTunic]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;

    const colors = {
      grass: cssVar("--grass") || "#4a8c3a",
      grassDark: cssVar("--grass-dark") || "#2f6b28",
      sand: cssVar("--sand") || "#e6cf9a",
      stone: cssVar("--stone") || "#6b6b78",
      stoneDark: cssVar("--stone-dark") || "#3e3e48",
      water: cssVar("--water") || "#3a7fb0",
      hero: cssVar("--hero") || "#7fc97a",
      heroAccent: cssVar("--hero-accent") || "#c0392b",
      enemy: cssVar("--enemy") || "#c0392b",
      heart: cssVar("--heart") || "#e74c3c",
      sword: cssVar("--sword") || "#eaeaea",
      bg: cssVar("--background") || "#1f2a1f",
      fg: cssVar("--foreground") || "#f0e6c8",
    };

    function drawTile(x: number, y: number, t: TileType) {
      const px = x * TILE;
      const py = y * TILE;
      // grass base everywhere except water/sand
      if (t === "water") {
        ctx.fillStyle = colors.water;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(px + 4, py + 6, 8, 2);
        ctx.fillRect(px + 18, py + 18, 8, 2);
        return;
      }
      if (t === "sand") {
        ctx.fillStyle = colors.sand;
        ctx.fillRect(px, py, TILE, TILE);
        return;
      }
      // base grass
      ctx.fillStyle = colors.grass;
      ctx.fillRect(px, py, TILE, TILE);
      // subtle checker
      if ((x + y) % 2 === 0) {
        ctx.fillStyle = "rgba(0,0,0,0.06)";
        ctx.fillRect(px, py, TILE, TILE);
      }
      if (t === "tree") {
        ctx.fillStyle = colors.grassDark;
        ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = colors.grass;
        ctx.fillRect(px + 10, py + 10, TILE - 20, TILE - 20);
      } else if (t === "stone") {
        ctx.fillStyle = colors.stoneDark;
        ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = colors.stone;
        ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
      } else if (t === "door") {
        ctx.fillStyle = colors.sand;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = colors.stoneDark;
        ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
      }
    }

    function drawHero(x: number, y: number, dir: Dir, iframes: number) {
      const blink = iframes > 0 && Math.floor(iframes / 3) % 2 === 0;
      if (blink) return;
      const tunic = TUNICS[stateRef.current.tunic];
      // body
      ctx.fillStyle = tunic.body;
      ctx.fillRect(x + 4, y + 6, TILE - 8, TILE - 10);
      // shoulder/cap trim
      ctx.fillStyle = tunic.trim;
      ctx.fillRect(x + 6, y + 4, TILE - 12, 4);
      // tunic accent stripe
      ctx.fillStyle = tunic.accent;
      ctx.fillRect(x + 10, y + 14, TILE - 20, 6);
      // eyes/face dot indicating direction
      ctx.fillStyle = "#1b1b1b";
      const cx = x + TILE / 2;
      const cy = y + TILE / 2;
      if (dir === "down") ctx.fillRect(cx - 4, cy + 2, 8, 3);
      if (dir === "up") ctx.fillRect(cx - 4, cy - 6, 8, 3);
      if (dir === "left") ctx.fillRect(cx - 8, cy - 2, 4, 4);
      if (dir === "right") ctx.fillRect(cx + 4, cy - 2, 4, 4);
    }

    function drawPickup(p: Pickup, t: number) {
      const tunic = TUNICS[p.tunic];
      const bob = Math.sin(t / 240 + p.x) * 2;
      const px = p.x;
      const py = p.y + bob;
      // glow
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(px - 2, py - 2, TILE + 4, TILE + 4);
      // folded tunic shape
      ctx.fillStyle = tunic.body;
      ctx.fillRect(px + 6, py + 8, TILE - 12, TILE - 14);
      ctx.fillStyle = tunic.accent;
      ctx.fillRect(px + 10, py + 14, TILE - 20, 4);
      ctx.fillStyle = tunic.trim;
      ctx.fillRect(px + 8, py + 6, TILE - 16, 4);
      // sparkle
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      const sp = (Math.floor(t / 200) % 4);
      if (sp === 0) ctx.fillRect(px + 4, py + 4, 2, 2);
      if (sp === 1) ctx.fillRect(px + TILE - 6, py + 6, 2, 2);
      if (sp === 2) ctx.fillRect(px + TILE - 4, py + TILE - 6, 2, 2);
      if (sp === 3) ctx.fillRect(px + 6, py + TILE - 4, 2, 2);
    }

    function attackRect() {
      const h = stateRef.current.hero;
      const len = 22;
      const w = 14;
      switch (h.dir) {
        case "up": return { x: h.x + (TILE - w) / 2, y: h.y - len, w, h: len };
        case "down": return { x: h.x + (TILE - w) / 2, y: h.y + TILE, w, h: len };
        case "left": return { x: h.x - len, y: h.y + (TILE - w) / 2, w: len, h: w };
        case "right": return { x: h.x + TILE, y: h.y + (TILE - w) / 2, w: len, h: w };
      }
    }

    function drawSword() {
      const r = attackRect();
      ctx.fillStyle = colors.sword;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = colors.heroAccent;
      // hilt cap on hero side
      const h = stateRef.current.hero;
      if (h.dir === "right") ctx.fillRect(r.x, r.y - 2, 4, r.h + 4);
      if (h.dir === "left") ctx.fillRect(r.x + r.w - 4, r.y - 2, 4, r.h + 4);
      if (h.dir === "down") ctx.fillRect(r.x - 2, r.y, r.w + 4, 4);
      if (h.dir === "up") ctx.fillRect(r.x - 2, r.y + r.h - 4, r.w + 4, 4);
    }

    function drawEnemy(e: Enemy) {
      ctx.fillStyle = colors.enemy;
      ctx.fillRect(e.x + 4, e.y + 4, TILE - 8, TILE - 8);
      ctx.fillStyle = "#1b1b1b";
      ctx.fillRect(e.x + 10, e.y + 12, 4, 4);
      ctx.fillRect(e.x + TILE - 14, e.y + 12, 4, 4);
    }

    function drawHeart(h: Heart) {
      ctx.fillStyle = colors.heart;
      ctx.fillRect(h.x + 8, h.y + 10, 16, 12);
      ctx.fillRect(h.x + 6, h.y + 8, 8, 8);
      ctx.fillRect(h.x + 18, h.y + 8, 8, 8);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fillRect(h.x + 10, h.y + 11, 3, 3);
    }

    function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function tryMove(nx: number, ny: number, room: Room) {
      // check 4 corners
      const pts = [
        [nx + 4, ny + 6],
        [nx + TILE - 4, ny + 6],
        [nx + 4, ny + TILE - 4],
        [nx + TILE - 4, ny + TILE - 4],
      ];
      for (const [px, py] of pts) {
        const tx = Math.floor(px / TILE);
        const ty = Math.floor(py / TILE);
        if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
        const t = room.tiles[ty][tx];
        if (isBlocked(t)) return false;
      }
      return true;
    }

    function step() {
      const st = stateRef.current;
      const room = st.rooms[st.currentRoom];
      const h = st.hero;
      const tunic = TUNICS[st.tunic];
      const speed = tunic.speed;

      let dx = 0, dy = 0;
      if (st.keys.has("up")) { dy -= speed; h.dir = "up"; }
      if (st.keys.has("down")) { dy += speed; h.dir = "down"; }
      if (st.keys.has("left")) { dx -= speed; h.dir = "left"; }
      if (st.keys.has("right")) { dx += speed; h.dir = "right"; }

      if (dx !== 0 && tryMove(h.x + dx, h.y, room)) h.x += dx;
      if (dy !== 0 && tryMove(h.x, h.y + dy, room)) h.y += dy;

      // Room transitions via doors / edges
      const cx = h.x + TILE / 2;
      const cy = h.y + TILE / 2;
      const exits = room.exits;
      if (cx < 4 && exits.left) {
        st.currentRoom = exits.left.room;
        h.x = exits.left.x; h.y = exits.left.y;
        refreshHud();
        return;
      }
      if (cx > W - 4 && exits.right) {
        st.currentRoom = exits.right.room;
        h.x = exits.right.x; h.y = exits.right.y;
        refreshHud();
        return;
      }
      if (cy < 4 && exits.up) {
        st.currentRoom = exits.up.room;
        h.x = exits.up.x; h.y = exits.up.y;
        refreshHud();
        return;
      }
      if (cy > H - 4 && exits.down) {
        st.currentRoom = exits.down.room;
        h.x = exits.down.x; h.y = exits.down.y;
        refreshHud();
        return;
      }

      // Attack timer
      if (st.attack.active) {
        st.attack.timer--;
        if (st.attack.timer <= 0) st.attack.active = false;
      }

      // iframes
      if (h.iframes > 0) h.iframes--;

      // Enemy logic
      const heroRect = { x: h.x + 4, y: h.y + 6, w: TILE - 8, h: TILE - 10 };
      const aRect = st.attack.active ? attackRect() : null;

      for (const e of room.enemies) {
        if (!e.alive) continue;
        e.cooldown--;
        if (e.cooldown <= 0) {
          const dirs: Dir[] = ["up", "down", "left", "right"];
          e.dir = dirs[Math.floor(Math.random() * 4)];
          e.cooldown = 30 + Math.floor(Math.random() * 60);
        }
        const espd = 1;
        let ex = e.x, ey = e.y;
        if (e.dir === "up") ey -= espd;
        if (e.dir === "down") ey += espd;
        if (e.dir === "left") ex -= espd;
        if (e.dir === "right") ex += espd;
        if (tryMove(ex, ey, room)) { e.x = ex; e.y = ey; }
        else { e.cooldown = 0; }

        const eRect = { x: e.x + 4, y: e.y + 4, w: TILE - 8, h: TILE - 8 };

        // sword damages enemy
        if (aRect && rectsOverlap(aRect, eRect)) {
          e.hp -= tunic.damageMul;
          // knockback
          if (h.dir === "right") e.x = Math.min(e.x + 16, (COLS - 2) * TILE);
          if (h.dir === "left") e.x = Math.max(e.x - 16, TILE);
          if (h.dir === "down") e.y = Math.min(e.y + 16, (ROWS - 2) * TILE);
          if (h.dir === "up") e.y = Math.max(e.y - 16, TILE);
          if (e.hp <= 0) {
            e.alive = false;
            st.rupees += 1;
            // chance to drop a heart
            if (Math.random() < 0.4) room.hearts.push({ x: e.x, y: e.y });
            refreshHud();
          }
        }

        // enemy hits hero
        if (h.iframes <= 0 && rectsOverlap(heroRect, eRect)) {
          // base damage 2 (one full heart). Scaled by tunic; min 1 (half-heart).
          const dmg = Math.max(1, Math.round(2 * tunic.damageTaken));
          h.hp = Math.max(0, h.hp - dmg);
          h.iframes = 60;
          // knockback hero away
          const kx = h.x - e.x;
          const ky = h.y - e.y;
          if (Math.abs(kx) > Math.abs(ky)) {
            const nx = h.x + Math.sign(kx) * 20;
            if (tryMove(nx, h.y, room)) h.x = nx;
          } else {
            const ny = h.y + Math.sign(ky) * 20;
            if (tryMove(h.x, ny, room)) h.y = ny;
          }
          refreshHud();
        }
      }

      // pickup hearts
      room.hearts = room.hearts.filter((hh) => {
        const r = { x: hh.x + 6, y: hh.y + 6, w: 20, h: 20 };
        if (rectsOverlap(heroRect, r)) {
          h.hp = Math.min(h.maxHp, h.hp + 2);
          refreshHud();
          return false;
        }
        return true;
      });

      // pickup tunics
      room.pickups = room.pickups.filter((p) => {
        const r = { x: p.x + 4, y: p.y + 4, w: TILE - 8, h: TILE - 8 };
        if (rectsOverlap(heroRect, r)) {
          if (!st.inventory.has(p.tunic)) {
            st.inventory.add(p.tunic);
            st.tunic = p.tunic;
            showToast(`Found ${TUNICS[p.tunic].name} — ${TUNICS[p.tunic].perk}`);
            refreshHud();
          }
          return false;
        }
        return true;
      });

      // respawn if dead
      if (h.hp <= 0) {
        h.hp = h.maxHp;
        st.currentRoom = "A";
        h.x = 3 * TILE; h.y = 7 * TILE;
        h.iframes = 90;
        refreshHud();
      }
    }

    let frame = 0;
    function render() {
      const st = stateRef.current;
      const room = st.rooms[st.currentRoom];
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, W, H);
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          drawTile(x, y, room.tiles[y][x]);
        }
      }
      for (const heart of room.hearts) drawHeart(heart);
      for (const p of room.pickups) drawPickup(p, frame);
      for (const e of room.enemies) if (e.alive) drawEnemy(e);
      drawHero(st.hero.x, st.hero.y, st.hero.dir, st.hero.iframes);
      if (st.attack.active) drawSword();
    }

    function loop() {
      frame += 16;
      step();
      render();
      raf = requestAnimationFrame(loop);
    }
    loop();
    refreshHud();
    return () => cancelAnimationFrame(raf);
  }, [refreshHud]);

  // Touch controls
  const press = (k: string) => stateRef.current.keys.add(k);
  const release = (k: string) => stateRef.current.keys.delete(k);
  const tap = (k: string) => {
    const st = stateRef.current;
    if (k === "attack" && !st.attack.active) {
      st.attack.active = true;
      st.attack.timer = 12;
    }
  };

  void force;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* HUD */}
      <div className="flex items-center justify-between w-full max-w-[640px] px-1">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {hud.room}
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
        </div>
      </div>

      <div
        className="relative rounded-md overflow-hidden"
        style={{
          boxShadow:
            "0 0 0 4px var(--stone-dark), 0 20px 60px -20px rgba(0,0,0,0.6)",
        }}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block"
          style={{ imageRendering: "pixelated", maxWidth: "92vw", height: "auto" }}
        />
        {hud.won && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="text-center">
              <p className="font-mono text-xs uppercase tracking-[0.4em] text-muted-foreground">
                The lake stills
              </p>
              <h2 className="mt-2 text-3xl font-light tracking-wide text-foreground">
                You have found peace
              </h2>
            </div>
          </div>
        )}
      </div>

      {/* Controls help */}
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground text-center">
        Arrows / WASD to move · Space / J / Z to swing
      </div>

      {/* Mobile pad */}
      <div className="md:hidden grid grid-cols-3 gap-2 mt-2 select-none">
        <div />
        <button
          className="aspect-square rounded bg-card text-foreground/80 active:bg-accent"
          onTouchStart={() => press("up")} onTouchEnd={() => release("up")}
          onMouseDown={() => press("up")} onMouseUp={() => release("up")}
        >▲</button>
        <button
          className="aspect-square rounded bg-[var(--hero-accent)] text-foreground row-span-2"
          onTouchStart={() => tap("attack")} onMouseDown={() => tap("attack")}
        >⚔</button>
        <button
          className="aspect-square rounded bg-card text-foreground/80 active:bg-accent"
          onTouchStart={() => press("left")} onTouchEnd={() => release("left")}
          onMouseDown={() => press("left")} onMouseUp={() => release("left")}
        >◀</button>
        <button
          className="aspect-square rounded bg-card text-foreground/80 active:bg-accent"
          onTouchStart={() => press("down")} onTouchEnd={() => release("down")}
          onMouseDown={() => press("down")} onMouseUp={() => release("down")}
        >▼</button>
        <button
          className="aspect-square rounded bg-card text-foreground/80 active:bg-accent col-start-1 row-start-3"
          onTouchStart={() => press("right")} onTouchEnd={() => release("right")}
          onMouseDown={() => press("right")} onMouseUp={() => release("right")}
        >▶</button>
      </div>
    </div>
  );
}
