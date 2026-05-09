---
title: "implement: calibrate roadside prop scale function (heightRoadFactor + maxHeight clamp) so trees and poles match physical-meters intent"
status: open
priority: 2
issue-type: task
created-at: "2026-05-05T23:44:56.421092-05:00"
---

src/render/pseudoRoadCanvas.ts ROADSIDE_SPRITE_STYLES + ROADSIDE_MAX_HEIGHT_FRACTION; tune heightRoadFactor per kind to physicalHeightMeters/4.5 (pine 2.22, light_pole 2.00, sign 0.67, fence 0.16, boulder 0.33, palm 1.78, rock_spire 1.33, water_wall 0.22), drop ROADSIDE_MAX_HEIGHT_FRACTION 0.22 -> 0.18 so close-in props never exceed the player car silhouette. Add assertPropScaleAt(z) unit test pinning per-kind px height at z=10/50/200 m; add Playwright golden frame at /dev/road for one velvet-coast scene.

## Implementation Notes (iter-7 pre-flight)

### Projection math

`segmentProjector.project` builds `screenW = scale * ROAD_WIDTH * halfW`
where `scale = CAMERA_DEPTH / z`, `CAMERA_DEPTH = 1 / tan((100/2) *
pi/180) ≈ 0.83910`, `ROAD_WIDTH = 4.5` (the half-width per
`src/road/constants.ts:14`), and `halfW = canvas_width / 2`. So
`screenW(z) = CAMERA_DEPTH * ROAD_WIDTH * halfW / z = 3.776 * halfW / z`.

For a 1280x720 canvas (halfW = 640):
- screenW(10) = 241.54 px
- screenW(50) = 48.31 px
- screenW(200) = 12.08 px

For an 800x480 canvas (halfW = 400, the existing test viewport):
- screenW(10) = 150.96 px
- screenW(50) = 30.19 px
- screenW(200) = 7.55 px

### Per-kind px height table (post-fix, 1280x720 canvas)

`SPRITE_BASE_SCALE = 1.0` (`src/road/constants.ts:67`).
`maxHeight = viewport.height * ROADSIDE_MAX_HEIGHT_FRACTION = 720 * 0.18
= 129.6` px.
`raw = screenW * heightRoadFactor * SPRITE_BASE_SCALE`.
`final = max(minHeight, min(maxHeight, raw))`.

Player car silhouette = 720 * `PLAYER_CAR_HEIGHT_FRACTION` (0.18) =
129.6 px. The `0.18` clamp matches the player-car fraction so the
tallest tree at z=10 caps at exactly the player-car height, never
taller.

| id           | factor (= H/4.5) | minH | px@z=10 | px@z=50 | px@z=200 |
| --           | --               | --   | --      | --      | --       |
| tree_pine    | 2.22 (10 m)      | 12   | 129.60* | 107.25  | 26.81    |
| palms_sparse | 1.78 (8 m)       | 12   | 129.60* | 86.0    | 21.50    |
| light_pole   | 2.00 (9 m)       | 14   | 129.60* | 96.61   | 24.15    |
| sign_marker  | 0.67 (3 m)       | 8    | 129.60* | 32.37   | 8.10     |
| marina_signs | 0.78 (3.5 m)     | 8    | 129.60* | 37.68   | 9.42     |
| heat_sign    | 0.67 (3 m)       | 8    | 129.60* | 32.37   | 8.10     |
| fence_post   | 0.16 (0.7 m)     | 5    |  38.65  |  7.73   | 5.00#    |
| guardrail    | 0.16 (0.7 m)     | 5    |  38.65  |  7.73   | 5.00#    |
| rock_boulder | 0.33 (1.5 m)     | 5    |  79.71  | 15.94   | 5.00#    |
| water_wall   | 0.22 (1.0 m)     | 5    |  53.14  | 10.63   | 5.00#    |
| rock_spire   | 1.33 (6 m)       | 9    | 129.60* | 64.25   | 16.06    |

\* = clamped to `viewport.height * 0.18`.
\# = clamped to `style.minHeight`.

Player-car arithmetic: tallest near-field prop (`tree_pine` at z=10)
draws at exactly 129.6 px, equal to the player car at 0.18 viewport.
Confirms the iter-5 design intent that close-in props never exceed
the player silhouette. Without the clamp drop, raw `tree_pine` at
z=10 would be 536.22 px (74.5% viewport height), 4.1x the player
car. The clamp at 0.18 + the per-kind tune both contribute; either
alone is insufficient (clamp alone would still leave fence_post at
2x its physical target, per-kind alone would still let mid-far trees
drown the silhouette in dense forest segments).

### Vitest block (paste into pseudoRoadCanvas.test.ts)

The existing test file already imports the renderer; the new test
should live next to the existing `dh ~= VIEWPORT.height * 0.22` pin
(line 980) so the audit trail is contiguous. The existing pin is
updated in the same diff to `0.18`.

    // iter-5 calibration pin: per-kind prop px-height at known depths.
    // ROAD_WIDTH = 4.5 (half-width). screenW(z) = (CAMERA_DEPTH *
    // ROAD_WIDTH * halfW) / z. For VIEWPORT 1280x720: screenW(10) =
    // 241.54, screenW(50) = 48.31, screenW(200) = 12.08. maxHeight =
    // 720 * 0.18 = 129.6.
    const PROP_PX_TABLE_1280x720: Array<{ id: string; z: number; px: number }> = [
      { id: "tree_pine",    z:  10, px: 129.60 }, // clamped
      { id: "tree_pine",    z:  50, px: 107.25 },
      { id: "tree_pine",    z: 200, px:  26.81 },
      { id: "light_pole",   z:  10, px: 129.60 }, // clamped
      { id: "light_pole",   z:  50, px:  96.61 },
      { id: "light_pole",   z: 200, px:  24.15 },
      { id: "sign_marker",  z:  10, px: 129.60 }, // clamped
      { id: "sign_marker",  z:  50, px:  32.37 },
      { id: "sign_marker",  z: 200, px:   8.10 },
      { id: "fence_post",   z:  10, px:  38.65 },
      { id: "fence_post",   z:  50, px:   7.73 },
      { id: "fence_post",   z: 200, px:   5.00 }, // min clamp
      { id: "guardrail",    z:  10, px:  38.65 },
      { id: "guardrail",    z:  50, px:   7.73 },
      { id: "guardrail",    z: 200, px:   5.00 },
      { id: "rock_boulder", z:  10, px:  79.71 },
      { id: "rock_boulder", z:  50, px:  15.94 },
      { id: "rock_boulder", z: 200, px:   5.00 },
      { id: "palms_sparse", z:  10, px: 129.60 },
      { id: "palms_sparse", z:  50, px:  86.00 },
      { id: "palms_sparse", z: 200, px:  21.50 },
      { id: "rock_spire",   z:  10, px: 129.60 },
      { id: "rock_spire",   z:  50, px:  64.25 },
      { id: "rock_spire",   z: 200, px:  16.06 },
      { id: "water_wall",   z:  10, px:  53.14 },
      { id: "water_wall",   z:  50, px:  10.63 },
      { id: "water_wall",   z: 200, px:   5.00 },
      { id: "marina_signs", z:  10, px: 129.60 },
      { id: "marina_signs", z:  50, px:  37.68 },
      { id: "marina_signs", z: 200, px:   9.42 },
      { id: "heat_sign",    z:  10, px: 129.60 },
      { id: "heat_sign",    z:  50, px:  32.37 },
      { id: "heat_sign",    z: 200, px:   8.10 },
    ];

    describe("ROADSIDE_SPRITE_STYLES px-height calibration (iter-5 pin)", () => {
      const VIEWPORT = { width: 1280, height: 720 } as const;

      it.each(PROP_PX_TABLE_1280x720)(
        "$id at z=$z m draws at ~$px px on a 1280x720 canvas",
        ({ id, z, px }) => {
          // assertPropScaleAt(id, z, viewport) is a small helper that
          // builds a one-strip drawRoad call with the given prop id
          // on the right side, runs the renderer with a canvas spy,
          // and returns the dh of the only drawImage / fill call.
          // Tolerance 1.0 px allows for SPRITE_BASE_SCALE drift and
          // floating-point round-off; the pin protects per-kind
          // OUTLIERS, not sub-pixel exactness.
          const dh = assertPropScaleAt(id, z, VIEWPORT);
          expect(dh).toBeCloseTo(px, 0);
        },
      );

      it("tallest near-field prop matches player-car silhouette height", () => {
        // tree_pine at z=10 hits the maxHeight clamp at exactly
        // viewport.height * PLAYER_CAR_HEIGHT_FRACTION (0.18). This
        // is the iter-5 design intent: no near-field roadside prop
        // can be taller than the player car silhouette.
        const dh = assertPropScaleAt("tree_pine", 10, { width: 1280, height: 720 });
        expect(dh).toBeCloseTo(720 * 0.18, 0);
      });

      it("update existing dh ~= VIEWPORT.height * 0.18 pin (was 0.22)", () => {
        // The existing test at line 980 of pseudoRoadCanvas.test.ts
        // pins `draws[0]!.dh` to `VIEWPORT.height * 0.22`. Update to
        // 0.18 in this slice. Search-and-replace pattern:
        //   VIEWPORT.height * 0.22  ->  VIEWPORT.height * 0.18
      });
    });

### `assertPropScaleAt` helper sketch

The implementor builds a small helper next to the existing `strip()`
fixture in `pseudoRoadCanvas.test.ts`:

    function assertPropScaleAt(
      id: string,
      z: number,
      viewport: { width: number; height: number },
    ): number {
      // Build screenW from the projection formula directly.
      // halfW = viewport.width / 2; CAMERA_DEPTH from constants.
      const halfW = viewport.width / 2;
      const screenW = (CAMERA_DEPTH * ROAD_WIDTH * halfW) / z;
      // Construct a strip with the given screenW and a roadside id on
      // the right side. drawRoad is called with the strip alone; the
      // canvas spy captures the single fill call's height.
      const spy = makeCanvasSpy();
      const strips = [strip({ screenW, screenY: viewport.height * 0.7,
        segment: { ...strip({}).segment, roadsideRightId: id } })];
      drawRoad(spy.ctx, strips, viewport, {});
      const fills = spy.calls.filter((c) => c.type === "fill" || c.type === "rect");
      // Procedural fallbacks emit fills; the prop's bounding height
      // is the bbox of the prop's draw calls. Implementor extracts
      // it via the existing inspectShapeBoundingHeight() helper that
      // ships in the same test file area, OR computes the height
      // expression directly from the formula and asserts on that.
      // The simplest pin is to extract from the renderer's own
      // formula by reading the rect call sequence; both work.
      return inspectShapeBoundingHeight(fills);
    }

The implementor may instead extract `dh` by adding a debug-only
`onPropDrawn` callback in the renderer; either approach is fine. The
PIN VALUE is what matters. The numeric table above is the contract.

### Playwright golden frame

`tests-e2e/dev-road-prop-scale.spec.ts` (NEW) navigates to `/dev/road`
with a fixed seed/Velvet Coast pose, waits for canvas paint, and
captures a screenshot for `expect(page).toHaveScreenshot()`. The
existing `e2e/projection-readability.spec.ts` is a working template
for the canvas-paint wait pattern. The golden lives alongside other
goldens under `tests-e2e/__screenshots__/` (or wherever the project's
Playwright config writes them; check `playwright.config.ts`).

NOTE on path: the existing repo uses `e2e/` (not `tests-e2e/`) per the
working tree audit. The dot file uses both names interchangeably; the
correct path for the new spec is `e2e/dev-road-prop-scale.spec.ts`.

### Q-NNN sweep (iter-7 confirmation)

Q-017 recommended defaults stand verbatim post-iter-6 cross-check.
The drop from 0.22 to 0.18 matches `PLAYER_CAR_HEIGHT_FRACTION` exactly,
which is the right ceiling. The per-kind heightRoadFactor values
(pine 2.22, palm 1.78, pole 2.00, sign 0.67, fence 0.16, etc.) are
the post-fix derivation from `physicalHeightMeters / 4.5` per Q-017.
No tightening needed.
