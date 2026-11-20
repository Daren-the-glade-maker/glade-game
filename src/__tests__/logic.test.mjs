import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TUNICS,
  MONSTERS,
  SWORD_UPGRADE_COST,
  SWORD_MAX_LEVEL,
  calcSwordDamage,
  calcFireBreathDamage,
  calcContactDamage,
  swordReach,
  swordHitRadius,
  swordKnockback,
  zoneFromPosition,
  rng,
  hexToCss,
} from "../game/logic.ts";

test("tunic and monster definitions cover every playable type", () => {
  assert.deepEqual(Object.keys(TUNICS), ["green", "red", "blue", "white", "shadow", "dragon"]);
  assert.deepEqual(Object.keys(MONSTERS), ["slime", "bat", "skeleton", "knight", "mage", "boss"]);
  for (const [id, tunic] of Object.entries(TUNICS)) assert.equal(tunic.id, id);
  for (const [type, monster] of Object.entries(MONSTERS)) assert.equal(monster.type, type);
});

test("combat, upgrades and defensive rounding preserve balance", () => {
  assert.equal(SWORD_UPGRADE_COST, 3);
  assert.equal(SWORD_MAX_LEVEL, 5);
  assert.equal(calcSwordDamage(1, TUNICS.green.damageMul), 3);
  assert.equal(calcSwordDamage(5, TUNICS.red.damageMul), 10.5);
  assert.equal(calcFireBreathDamage(TUNICS.dragon.damageMul), 4);
  assert.equal(calcContactDamage(3, TUNICS.blue.damageTaken), 2);
  assert.equal(calcContactDamage(1, TUNICS.blue.damageTaken), 1);
  assert.ok(swordReach(5) > swordReach(1));
  assert.ok(swordHitRadius(5) > swordHitRadius(1));
  assert.ok(swordKnockback(5) > swordKnockback(1));
});

test("zone inference preserves boundaries and priority", () => {
  assert.equal(zoneFromPosition(0, 0), "overworld");
  assert.equal(zoneFromPosition(0, -120), "dungeon");
  assert.equal(zoneFromPosition(300, 0), "desert");
  assert.equal(zoneFromPosition(-300, 0), "sky");
  assert.equal(zoneFromPosition(-150, -100), "overworld");
  assert.equal(zoneFromPosition(151, -120), "desert");
});

test("world random sequence matches original seeded generator", () => {
  const random = rng(1);
  assert.equal(random(), 58598 / 233280);
  const first = rng(123),
    second = rng(123);
  for (let i = 0; i < 100; i++) assert.equal(first(), second());
  assert.equal(hexToCss(15), "#00000f");
});
