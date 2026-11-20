/**
 * Pure game logic extracted from ZeldaGame3D for testability.
 * No THREE / React imports — safe to unit-test in Node.
 */

export type TunicId = "green" | "red" | "blue" | "white" | "shadow" | "dragon";
export type MonsterType = "slime" | "bat" | "skeleton" | "knight" | "mage" | "boss";
export type Zone = "overworld" | "dungeon" | "desert" | "sky";

export interface TunicDef {
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

export const TUNICS: Record<TunicId, TunicDef> = {
  green: {
    id: "green",
    name: "Forest Tunic",
    body: 0x6fbf73,
    accent: 0xc0392b,
    trim: 0x2f6b28,
    perk: "Balanced",
    speed: 6,
    damageMul: 1,
    damageTaken: 1,
  },
  red: {
    id: "red",
    name: "Ember Tunic",
    body: 0xd45a3a,
    accent: 0xf3c969,
    trim: 0x6e1f12,
    perk: "+50% sword damage",
    speed: 6,
    damageMul: 1.5,
    damageTaken: 1,
  },
  blue: {
    id: "blue",
    name: "Tide Tunic",
    body: 0x4a8fb8,
    accent: 0xb8d8e8,
    trim: 0x1f3a52,
    perk: "Halves damage taken",
    speed: 6,
    damageMul: 1,
    damageTaken: 0.5,
  },
  white: {
    id: "white",
    name: "Wind Cloak",
    body: 0xeae6dc,
    accent: 0xa9aab2,
    trim: 0x6c6e76,
    perk: "Faster on foot",
    speed: 9,
    damageMul: 1,
    damageTaken: 1,
  },
  shadow: {
    id: "shadow",
    name: "Shadow Veil",
    body: 0x2a2336,
    accent: 0x8a4ec2,
    trim: 0x14101c,
    perk: "Power + speed",
    speed: 7.5,
    damageMul: 1.5,
    damageTaken: 1,
  },
  dragon: {
    id: "dragon",
    name: "Dragon Scale",
    body: 0x2a6f3a,
    accent: 0xffb01a,
    trim: 0x6b1a0a,
    perk: "DRAGON FORM — bipedal beast",
    speed: 8,
    damageMul: 2.0,
    damageTaken: 0.5,
  },
};

export interface MonsterDef {
  type: MonsterType;
  name: string;
  hp: number;
  speed: number;
  damage: number; // half-hearts
  contactRange: number; // attack distance
  color: number;
  rupees: number;
}

export const MONSTERS: Record<MonsterType, MonsterDef> = {
  slime: {
    type: "slime",
    name: "Bog Slime",
    hp: 2,
    speed: 1.6,
    damage: 1,
    contactRange: 1.4,
    color: 0x6fcf73,
    rupees: 1,
  },
  bat: {
    type: "bat",
    name: "Cave Bat",
    hp: 2,
    speed: 3.2,
    damage: 1,
    contactRange: 1.4,
    color: 0x9b6dff,
    rupees: 2,
  },
  skeleton: {
    type: "skeleton",
    name: "Bone Sentry",
    hp: 3,
    speed: 2.2,
    damage: 2,
    contactRange: 1.6,
    color: 0xeae6dc,
    rupees: 3,
  },
  knight: {
    type: "knight",
    name: "Iron Knight",
    hp: 5,
    speed: 1.8,
    damage: 2,
    contactRange: 1.8,
    color: 0x6b6b78,
    rupees: 5,
  },
  mage: {
    type: "mage",
    name: "Hollow Mage",
    hp: 3,
    speed: 1.4,
    damage: 2,
    contactRange: 8.0,
    color: 0x4a8fb8,
    rupees: 5,
  },
  boss: {
    type: "boss",
    name: "Lake Guardian",
    hp: 14,
    speed: 2.0,
    damage: 3,
    contactRange: 2.6,
    color: 0xc0392b,
    rupees: 25,
  },
};

export const SWORD_UPGRADE_COST = 3;
export const SWORD_MAX_LEVEL = 5;
export const WORLD = 80;

/** Sword damage scales with upgrade level and tunic multiplier. Lv1=3, Lv5=7 (before tunic). */
export function calcSwordDamage(swordLevel: number, damageMul: number): number {
  return (2 + swordLevel) * damageMul;
}

export function calcFireBreathDamage(damageMul: number): number {
  return 2 * damageMul;
}

export function calcContactDamage(baseDamage: number, damageTaken: number): number {
  return Math.max(1, Math.round(baseDamage * damageTaken));
}

export function swordReach(swordLevel: number): number {
  return 2.2 + swordLevel * 0.25;
}

export function swordHitRadius(swordLevel: number): number {
  return 1.9 + swordLevel * 0.18;
}

export function swordKnockback(swordLevel: number): number {
  return 2.0 + swordLevel * 0.4;
}

/** Derive zone from spawn coordinates (matches spawnMonster inference). */
export function zoneFromPosition(x: number, z: number): Zone {
  if (x < -150) return "sky";
  if (x > 150) return "desert";
  if (z < -100) return "dungeon";
  return "overworld";
}

/** Deterministic RNG for world generation (reproducible layouts). */
export function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function hexToCss(n: number): string {
  return "#" + n.toString(16).padStart(6, "0");
}
