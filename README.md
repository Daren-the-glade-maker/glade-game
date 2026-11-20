# Glade

A Zelda-inspired third-person adventure. Explore the glade and its other regions, collect tunics and upgrades, and defeat the Lake Guardian. [Play online](https://glade-game.lovable.app/).

## Getting started

Requires Node.js 22 and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite in a WebGL-capable browser. `npm run build` creates a production build; `npm run preview` previews it. Run `npm run check` for lint, TypeScript and tests, or run `npm test` separately. `.npmrc` enables npm's legacy peer resolution because the current TanStack Start and Vite peer ranges conflict; the committed npm lockfile pins the tested dependency tree.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | WASD (camera-relative) or arrow keys (world-relative) | Direction buttons |
| Sword | Space, J or Z | Attack |
| Fire arrow | B | Bow |
| Dragon fire | F, while wearing the dragon tunic | Fire |
| Flap | Shift, while wearing the dragon tunic | Flap |
| Upgrade sword | U (costs three shards per level) | U |
| Change tunic | 1–6, or use the wardrobe | Wardrobe or previous/next |
| Orbit camera | Drag the viewport | Drag the viewport |

Collect tunics to unlock their perks. Repeatedly flap as a dragon to reach the sky. The HQ/LQ button switches graphics quality; LQ disables shadows. Losing all health returns you to the glade.

## Structure and deployment

- `src/components/ZeldaGame3D.tsx`: Three.js scene, input and game loop.
- `src/components/GameHud.tsx`: HUD, wardrobe and touch controls.
- `src/game/logic.ts`: game definitions and pure mechanics.
- `src/__tests__/`: mechanics and simulated renderer/lifecycle tests. The latter mock WebGL; they do not replace testing real GPU rendering and touch devices.
- `.github/workflows/ci.yml`: install, lint, type-check, tests and build.
- `.github/workflows/deploy-pages.yml`: builds and deploys a static GitHub Pages artifact. Enable GitHub Pages with its source set to GitHub Actions. Generated `build/` output is not committed.

The repository does not currently specify a license. Contact the copyright holder before reusing or redistributing the code or assets.
