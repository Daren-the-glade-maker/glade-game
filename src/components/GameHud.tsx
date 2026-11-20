import type { Dispatch, RefObject, SetStateAction } from "react";
import { TUNICS, hexToCss, type TunicId, type Zone } from "@/game/logic";

export interface GameHudState {
  hp: number;
  maxHp: number;
  rupees: number;
  tunic: TunicId;
  inventory: TunicId[];
  toast: string;
  won: boolean;
  near: string;
  zone: Zone;
  swordLevel: number;
  swordShards: number;
  weapon: "sword" | "bow";
  arrows: number;
}

interface GameHudProps {
  hud: GameHudState;
  mountRef: RefObject<HTMLDivElement | null>;
  equipFnRef: RefObject<(id: TunicId) => void>;
  webglError: string | null;
  ready: boolean;
  quality: "high" | "low";
  setQuality: Dispatch<SetStateAction<"high" | "low">>;
}

export default function GameHud({
  hud,
  mountRef,
  equipFnRef,
  webglError,
  ready,
  quality,
  setQuality,
}: GameHudProps) {
  // touch buttons (movement handled via simulated keys)
  const press = (k: string) => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: k }));
  };
  const release = (k: string) => {
    window.dispatchEvent(new KeyboardEvent("keyup", { key: k }));
  };
  // Pointer-based hold handlers (cover touch + mouse, with cancel safety)
  const holdProps = (k: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      press(k);
    },
    onPointerUp: () => release(k),
    onPointerCancel: () => release(k),
    onLostPointerCapture: () => release(k),
    onKeyDown: (e: React.KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) {
        e.preventDefault();
        e.stopPropagation();
        press(k);
      }
    },
    onKeyUp: (e: React.KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        release(k);
      }
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  if (webglError) {
    return (
      <div
        className="flex flex-col items-center gap-4 w-full max-w-[960px] rounded-md border border-border bg-card/60 p-8 text-center"
        role="alert"
      >
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Glade needs WebGL
        </p>
        <p className="text-sm text-foreground">{webglError}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* HUD bar */}
      <div className="flex items-center justify-between w-full max-w-[960px] px-2">
        <div className="flex items-center gap-3">
          <span
            className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground"
            aria-live="polite"
          >
            {hud.near || "The Glade"}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {hud.zone}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex gap-0.5"
            role="img"
            aria-label={`Health ${hud.hp} of ${hud.maxHp} half-hearts`}
          >
            {Array.from({ length: Math.ceil(hud.maxHp / 2) }).map((_, i) => {
              const filled = hud.hp >= (i + 1) * 2;
              const half = !filled && hud.hp >= i * 2 + 1;
              return (
                <div key={i} className="relative h-4 w-4" aria-hidden="true">
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
          <span className="font-mono text-xs text-foreground" aria-label={`${hud.rupees} rupees`}>
            ◆ {hud.rupees}
          </span>
          <span
            className="font-mono text-xs"
            style={{ color: "#ff4a5c", textShadow: "0 0 8px #ff1a2b" }}
            aria-label={`Sword level ${hud.swordLevel}, ${hud.swordShards} shards`}
          >
            ⚔ Lv {hud.swordLevel} · ✦ {hud.swordShards}
          </span>
          <span
            className="font-mono text-xs"
            style={{ color: hud.weapon === "bow" ? "#ffd24a" : "#aaaaaa" }}
            aria-label={`${hud.weapon}, ${hud.arrows} arrows`}
          >
            {hud.weapon === "bow" ? "🏹 Bow" : "⚔ Sword"} · ➳ {hud.arrows}
          </span>
          <button
            onClick={() => setQuality((q) => (q === "high" ? "low" : "high"))}
            className="rounded border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            aria-pressed={quality === "low"}
            title="Toggle graphics quality (low disables shadows for performance)"
          >
            {quality === "high" ? "HQ" : "LQ"}
          </button>
        </div>
      </div>

      {/* 3D viewport */}
      <div
        ref={mountRef}
        tabIndex={0}
        role="application"
        aria-label="Glade 3D game viewport. Use WASD or arrow keys to move, Space to attack, B for bow, F for dragon fire, Shift to flap, U to upgrade, 1 to 6 to change tunic. Drag to orbit the camera."
        className="relative w-full max-w-[960px] aspect-[16/9] rounded-md overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary"
        style={{
          boxShadow: "0 0 0 4px var(--stone-dark), 0 30px 80px -20px rgba(0,0,0,0.7)",
          touchAction: "none",
        }}
      >
        {!ready && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-background/80"
            role="status"
            aria-label="Loading game"
          >
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Loading Glade…
            </p>
          </div>
        )}
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

      <div aria-live="polite" aria-atomic="true">
        {hud.toast && (
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-foreground bg-card/80 px-3 py-1.5 rounded border border-border animate-fade-in">
            {hud.toast}
          </div>
        )}
      </div>

      {/* Wardrobe */}
      <div className="w-full max-w-[960px]">
        <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-2 text-center">
          Wardrobe
        </div>
        <div className="grid grid-cols-6 gap-2" role="group" aria-label="Tunic wardrobe">
          {(Object.keys(TUNICS) as TunicId[]).map((id, i) => {
            const t = TUNICS[id];
            const owned = hud.inventory.includes(id);
            const equipped = hud.tunic === id;
            return (
              <button
                key={id}
                onClick={() => owned && equipFnRef.current(id)}
                disabled={!owned}
                aria-pressed={equipped}
                aria-label={
                  owned ? `${t.name} — ${t.perk}${equipped ? " (equipped)" : ""}` : "Not yet found"
                }
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
                <div className="relative h-10 w-8" aria-hidden="true">
                  <div
                    className="absolute inset-x-1 top-1 h-2 rounded-sm"
                    style={{ background: owned ? hexToCss(t.trim) : "var(--stone-dark)" }}
                  />
                  <div
                    className="absolute inset-x-0 top-3 bottom-0 rounded-sm"
                    style={{ background: owned ? hexToCss(t.body) : "var(--stone-dark)" }}
                  />
                  <div
                    className="absolute left-1/2 -translate-x-1/2 top-6 h-1.5 w-4 rounded-sm"
                    style={{ background: owned ? hexToCss(t.accent) : "transparent" }}
                  />
                </div>
                <span
                  className="font-mono text-[9px] uppercase tracking-wider text-foreground/80 truncate w-full"
                  aria-hidden="true"
                >
                  {owned ? t.name.split(" ")[0] : "???"}
                </span>
                <span
                  className="absolute top-1 right-1 font-mono text-[8px] text-muted-foreground"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                {equipped && (
                  <span
                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-foreground"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground text-center">
          {TUNICS[hud.tunic].name} · {TUNICS[hud.tunic].perk}
        </p>
      </div>

      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground text-center">
        WASD/Arrows move · Space sword · B arrow · F dragon fire · Shift flap (×6 → Sky) · U upgrade
        · 1–6 tunic · Drag orbit
      </div>

      {/* Mobile controls — full action set, Pointer Events with cancel safety */}
      <div
        className="md:hidden grid grid-cols-4 gap-2 mt-2 select-none w-full max-w-[360px]"
        role="group"
        aria-label="Touch controls"
      >
        <button
          aria-label="Move up"
          className="aspect-square rounded bg-card text-foreground/80 active:bg-accent"
          {...holdProps("w")}
        >
          ▲
        </button>
        <button
          aria-label="Move left"
          className="aspect-square rounded bg-card text-foreground/80 active:bg-accent"
          {...holdProps("a")}
        >
          ◀
        </button>
        <button
          aria-label="Move down"
          className="aspect-square rounded bg-card text-foreground/80 active:bg-accent"
          {...holdProps("s")}
        >
          ▼
        </button>
        <button
          aria-label="Move right"
          className="aspect-square rounded bg-card text-foreground/80 active:bg-accent"
          {...holdProps("d")}
        >
          ▶
        </button>
        <button
          aria-label="Attack"
          className="aspect-square rounded bg-[var(--hero-accent)] text-foreground"
          {...holdProps(" ")}
        >
          ⚔
        </button>
        <button
          aria-label="Fire bow"
          className="aspect-square rounded bg-card text-foreground/80 active:bg-accent"
          {...holdProps("b")}
        >
          🏹
        </button>
        <button
          aria-label="Dragon fire"
          className="aspect-square rounded bg-card text-foreground/80 active:bg-accent"
          {...holdProps("f")}
        >
          🔥
        </button>
        <button
          aria-label="Flap"
          className="aspect-square rounded bg-card text-foreground/80 active:bg-accent"
          {...holdProps("shift")}
        >
          🪽
        </button>
        <button
          aria-label="Upgrade sword"
          className="aspect-square rounded bg-card text-foreground/80 active:bg-accent"
          {...holdProps("u")}
        >
          U
        </button>
        <button
          aria-label="Previous tunic"
          className="aspect-square rounded bg-card text-foreground/80 active:bg-accent"
          onClick={() => {
            const ids = (Object.keys(TUNICS) as TunicId[]).filter((id) =>
              hud.inventory.includes(id),
            );
            const idx = ids.indexOf(hud.tunic);
            const prev = ids[(idx - 1 + ids.length) % ids.length];
            if (hud.inventory.includes(prev)) equipFnRef.current(prev);
          }}
        >
          ‹
        </button>
        <button
          aria-label="Next tunic"
          className="aspect-square rounded bg-card text-foreground/80 active:bg-accent"
          onClick={() => {
            const ids = (Object.keys(TUNICS) as TunicId[]).filter((id) =>
              hud.inventory.includes(id),
            );
            const idx = ids.indexOf(hud.tunic);
            const next = ids[(idx + 1) % ids.length];
            if (hud.inventory.includes(next)) equipFnRef.current(next);
          }}
        >
          ›
        </button>
      </div>
    </div>
  );
}
