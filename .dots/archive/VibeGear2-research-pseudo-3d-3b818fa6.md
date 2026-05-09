---
title: "research: pseudo-3D road renderer math and segment projector"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T00:56:25.973044-05:00\\\"\""
closed-at: "2026-04-26T01:13:31.245201-05:00"
close-reason: Pinned Gordon/Lou recipe with explicit constants, projector signature, curve+grade accumulation, maxY cull, and module layout. Updated implement dot.
blocks:
  - VibeGear2-implement-data-schemas-4dd373bc
---

Determine the math for the pseudo-3D road renderer per §16 and §21. Specify segment projection (far-to-near strips), camera, curve accumulation, hill grade. Output: implement: dots for renderer + segment projector + Canvas2D pipeline.

## Findings

### Reference approach

VibeGear2 will adopt the classic "Outrun-style" segmented pseudo-3D road, the same family used in Jake Gordon's well-known JavaScript Racer tutorial (2012, Code inComplete) and Lou's Pseudo-3D page. That approach is right for this project because (a) the GDD §16 already commits to "segment-based projection" with z-driven scale, centerline offset for fakes curves, and segment y for hills; (b) it runs in pure Canvas2D at 60 fps on integrated GPUs (§16 perf table); (c) it composes cleanly with billboard sprites (§16 sprite scaling) and parallax backgrounds; and (d) the segment list is exactly the data model in §22 `TrackSegmentSchema`.

We do not invent custom math. The decisions below specify which variant of the standard recipe to use and pin numerical constants.

### Coordinate system

Right-handed world space:

- `x` increases to the right of the centerline.
- `y` increases upward (sky positive).
- `z` increases along travel direction (away from camera).
- Units: meters everywhere. The simulation already uses m/s per §10.

Screen space, top-left origin:

- `screenX` increases right.
- `screenY` increases downward.

### Camera model

A fixed virtual camera that the player car never visibly leaves:

| Field | Value | Rationale |
| --- | --- | --- |
| `cameraHeight` | 1000 (mm equivalent in segment units) or 1.0 m if working in meters; we use 1.5 m | Slightly above hood to read the road. Gordon uses 1000; we scale. |
| `cameraDepth` | 1 / tan((fov / 2) * pi / 180) | Standard pinhole; computed from FOV. |
| `fovDegrees` | 100 | Wide enough to feel fast, narrow enough that distortion stays readable. Matches Outrun feel. |
| `drawDistance` | 300 segments | §16 says "Cap draw distance adaptively"; 300 fits MVP perf budget. Configurable. |
| `cameraZ` | playerZ - cameraDepth * roadHeightFactor | Camera sits behind player by a fixed offset. For Phase 1 we lock player to a fixed `cameraZ` and advance the world by adding `dz` per tick (the road moves, the camera does not). |
| `cameraX` | follows player lateral position with low-pass smoothing (alpha = 0.15 per 60 Hz tick) | §16 "chase-camera feel without real camera physics". |
| `cameraYBias` | -0.1 m at full speed (§16 "lowers slightly at high speed") | Linear in `speedNorm`. Phase 1 leaves at 0; ship in §16 polish slice. |

Computed values in the renderer:

```
cameraDepth = 1 / Math.tan((fovDegrees / 2) * Math.PI / 180)  // ≈ 0.84 for 100°
```

### Segment data model

Two layers of segments:

1. **Authored segments** (the §22 `TrackSegmentSchema`): variable length in meters, with `curve` (-1..1), `grade` (-0.3..0.3), `len` (>0), roadside refs, hazards. These are the human-authored unit.
2. **Compiled segments** (renderer-internal): fixed length blocks of `SEGMENT_LENGTH = 200` (in unit-mm-style; we use 6 m to keep the math close to Gordon's 200 yd-equivalent while remaining metric-friendly). Rationale: a fixed segment length lets the projector iterate by index without per-segment length math, which is what makes the far-to-near maxY clipping cheap.

The compiler `trackCompiler.ts` expands the authored list:

```
for each authored segment a:
  count = ceil(a.len / SEGMENT_LENGTH)
  for i in 0..count-1:
    push compiled segment with:
      index, curve = a.curve, grade = a.grade
      worldZ = (cumulativeIndex * SEGMENT_LENGTH)
      authoredRef = a (for roadside, hazards, deco at draw time)
```

Track total length is rounded up to a whole number of compiled segments. Lap closure: the compiled list is treated as a ring buffer; `worldZ` is taken mod `trackLength` when projecting.

`SEGMENT_LENGTH = 6` meters chosen because (a) at 60 m/s a player advances 1 segment per frame, which gives smooth motion; (b) curve discretization at 6 m granularity is invisible at typical viewing scales; (c) draw distance of 300 segments = 1800 m of visible road, comfortable for a 100° FOV.

### Projection equations

For each compiled segment at world position `(worldX, worldY, worldZ)`, project to screen:

```
// translate into camera space
sx = worldX - cameraX
sy = worldY - cameraY
sz = worldZ - cameraZ

// guard
if (sz < cameraDepth) return null   // strip is behind / inside the near plane

// pinhole projection
scale = cameraDepth / sz
screenX = (viewportWidth  / 2) + (scale * sx * viewportWidth  / 2)
screenY = (viewportHeight / 2) - (scale * sy * viewportHeight / 2)
screenW = scale * roadWidth * viewportWidth / 2
```

Notes:

- `roadWidth` is the half-width of the drivable road in meters; pin to 4.5 m (3 lanes at 3.0 m, with shoulder; matches §9 "3 visual lanes").
- `screenW` is the half-width of the road strip in pixels at this depth.
- The above is the canonical recipe; identical to Gordon's `Util.project`.

### Curve accumulation

Curves are faked by offsetting each compiled segment's `worldX` by the running curve sum, evaluated relative to the camera's current segment index. This is the classic trick that makes a list of straight strips look bent.

For each frame, before projecting, compute per-segment offsets in a single forward pass starting from the camera's segment:

```
let dx = 0
let x  = 0
let baseSegmentIndex = floor(cameraZ / SEGMENT_LENGTH) % totalSegments

for n in 0..drawDistance:
  segment = compiled[(baseSegmentIndex + n) % totalSegments]
  segment.projectedWorldX = x - cameraX
  // curve accumulates per-strip; constant across the strip
  x  += dx
  dx += segment.curve
```

Two important properties:

- Curves never modify the underlying segment positions; only the per-frame projection.
- `dx` is a velocity (units per segment), `x` is a position. The double accumulation is what produces a smooth banked-curve appearance even though the underlying data is piecewise constant.

Curve units: `segment.curve` in compiled space is the authored `-1..1` `curve` field divided by a tunable `CURVATURE_SCALE`. Set `CURVATURE_SCALE = 100` so a `curve = 1.0` segment shifts roughly one road-width per 100 segments. Tuned later against actual track playtests.

### Hill / grade rendering

Hills emerge from the same pattern, applied to `y`:

```
let dy = 0
let y  = 0

for n in 0..drawDistance:
  segment = compiled[(baseSegmentIndex + n) % totalSegments]
  segment.projectedWorldY = y - cameraY
  y  += dy
  dy += segment.grade
```

`segment.grade` from §22 is in `-0.3..0.3` (rise per length). In compiled units we use `grade * SEGMENT_LENGTH` so that one segment of `grade = 0.1` rises 0.6 m. The hill effect is a horizon shift identical to a vertical curve; this gives §16 "mild crest", "aggressive crest", "dip", "plateau" naturally.

Player vertical: for Phase 1 the player car is rendered as a non-rotating overlay sprite at a fixed screen Y; later slices can sample the local grade at the player's compiled segment to add gentle vertical bob.

### Far-to-near rendering with maxY clip

The render pass walks segments in **back-to-front** order so that nearer strips painted later cover farther ones, but uses an adaptive **maxY clip** to avoid overdrawing the same screen rows behind a hill. This is exactly the Lou's Pseudo-3D and Gordon recipe.

```
// 1. Pre-pass: compute per-segment screen positions (curve, hill, project).
for n in 0..drawDistance: project segment[baseIndex + n]

// 2. Cull: drop segments where projected screenY is above current maxY.
let maxY = viewportHeight
for n in (drawDistance - 1) .. 0:           // far to near
  s1 = projected[n]
  s2 = projected[n - 1]                     // the next-nearer strip
  if s1 == null || s2 == null: continue
  if s1.screenY >= maxY: continue           // hidden by a closer hill crest
  drawStrip(s2, s1)                         // a quad from near edge to far edge
  maxY = s1.screenY
```

This yields the §16 "exaggerated horizons" and the "crest lines should reveal horizon dramatically" feel for free, because hills literally lift the visible road above a previous segment's top.

### Strip drawing

For each consecutive pair `(near, far)`:

```
drawStrip(near, far):
  // grass (full-width band)
  ctx.fillStyle = grassColor(n)
  ctx.fillRect(0, far.screenY, viewportWidth, near.screenY - far.screenY)

  // rumble strips
  drawTrapezoid(rumbleColor(n),
    near.screenX, near.screenY, near.screenW * 1.15,
    far.screenX,  far.screenY,  far.screenW  * 1.15)

  // road
  drawTrapezoid(roadColor(n),
    near.screenX, near.screenY, near.screenW,
    far.screenX,  far.screenY,  far.screenW)

  // lane markings (dashed): use even/odd modulo on segment index
  if (n % 2) == 0:
    drawTrapezoid(laneColor, ... narrow strip at center ...)
```

Color alternation by `(segmentIndex / segmentsPerStripe) & 1` produces the classic alternating dark/light grass and rumble bands that read as motion at speed. `segmentsPerStripe = 3` for grass, `segmentsPerStripe = 5` for rumbles. Tweakable.

`drawTrapezoid` is `ctx.beginPath / moveTo / lineTo x4 / fill`. No textures in Phase 1.

### Background and parallax

Parallax sky/horizon is drawn first, before any strip. Three layers per §16:

- Sky: solid fill or vertical gradient (region-defined).
- Horizon silhouettes: image scrolled by `cameraX * 0.0005` and `accumulatedCurveDx * 0.0008`, aligned vertically to the horizon line `viewportHeight / 2 - cameraYBias`.
- Near terrain: scrolled by `cameraX * 0.002` and `accumulatedCurveDx * 0.003`.

The horizon line moves with `cameraY` (and at apex of a hill, with the projected y of the camera segment), so a crest pulls the horizon up dramatically.

### Sprite billboards

For each authored sprite (roadside object, hazard, AI car), at draw time:

```
worldZ = sprite.segmentZ + sprite.offsetZ
project as a road point at (worldX = roadCenterX(segment) + sprite.offsetX, worldY, worldZ)
spriteScale = scale * SPRITE_BASE_SCALE
screenX = projectedScreenX
screenY = projectedScreenY - sprite.height * spriteScale
clip vertically against current strip's maxY
```

Sprites draw inside the same back-to-front loop, after their owning strip pair, so that they correctly hide behind hills. AI cars per §15 use the same path with a per-car interpolated `worldZ`.

`SPRITE_BASE_SCALE` chosen so a player-class car at `worldZ = playerZ + 8 m` (just ahead) occupies 16-22% of viewport height, matching §16 "Player car should occupy 16 to 22% of screen height".

### Edge cases (binding for the implement dot)

- `sz < cameraDepth`: skip the segment (return null projection).
- `viewportWidth == 0` or `viewportHeight == 0`: bail before the pre-pass.
- Empty segment list: render only the sky/horizon, no road.
- `cameraZ` past the last segment: wrap via mod (the compiled list is a ring).
- `drawDistance > totalSegments`: cap to `totalSegments - 1` to avoid double-projecting the start of a tiny test track.
- NaN or Infinity in any segment field: treat as a zero curve / zero grade and log once at compile time.

### Determinism and testing

The projector is a pure function `project(compiledSegments, camera, viewport) -> Strip[]`. Pure means easy to unit-test without a canvas:

- For a flat straight track of N identical compiled segments, expect strict monotonic decrease in `screenY` (closer strips lower on screen) and strict monotonic increase in `screenW`.
- For a constant-curve track, expect `screenX` to drift in the curve direction more strongly the farther the segment.
- For a constant grade track with a single crest segment, expect at least one strip in the post-crest region to be culled by the maxY clip.
- Float comparisons use `expect(...).toBeCloseTo(value, 4)` per §RULE 8 (deterministic tests with float tolerances).

### Tunable constants summary

```
ROAD_WIDTH        = 4.5    // m, half-width of drivable road
SEGMENT_LENGTH    = 6      // m, per compiled segment
DRAW_DISTANCE     = 300    // compiled segments visible
FOV_DEGREES       = 100
CAMERA_HEIGHT     = 1.5    // m
CAMERA_DEPTH      = 1 / Math.tan((FOV_DEGREES / 2) * Math.PI / 180)  // ≈ 0.839
CURVATURE_SCALE   = 100    // authored curve / scale = compiled dx-per-segment
GRASS_STRIPE_LEN  = 3      // segments per grass color flip
RUMBLE_STRIPE_LEN = 5
LANE_STRIPE_LEN   = 8
SPRITE_BASE_SCALE = 1.0
```

All constants live in `src/road/constants.ts` so balancing slices can tune without re-reading the projector.

### Decisions

1. Adopt the Gordon / Lou's Pseudo-3D recipe verbatim. No novel math.
2. Pure-function projector returns a `Strip[]` value. Renderer consumes that value and draws to Canvas2D. Separation enables unit tests without jsdom canvas mocking.
3. Compiled segment length is fixed at 6 m. Authored variable-length segments compile down at load time.
4. `cameraDepth` derived from a 100° FOV constant.
5. Curve and grade accumulation done per-frame, not stored on segments. Keeps compiled segments immutable across the session.
6. Back-to-front loop with `maxY` clip; no z-buffer, no depth sort beyond list order.
7. Sprites drawn inside the same per-strip loop, after their owning strip pair.
8. Roadside, parallax, weather VFX, and HUD live in separate modules and are invoked by the renderer; the projector knows nothing about them.

### Module layout (binding)

```
src/road/
  constants.ts            // ROAD_WIDTH, SEGMENT_LENGTH, etc.
  types.ts                // Camera, Viewport, CompiledSegment, Strip
  trackCompiler.ts        // authored Track -> CompiledSegment[]
  segmentProjector.ts     // pure project(segs, camera, viewport) -> Strip[]
  __tests__/
    segmentProjector.test.ts
    trackCompiler.test.ts

src/render/
  pseudoRoadCanvas.ts     // strip drawing
  background.ts           // sky + parallax (later slice)
  spriteAtlas.ts          // (later slice)

src/app/dev/road/page.tsx // dev verification page
```

### Followups produced

- Implement dot `implement-pseudo-3d-d4c30840` already exists and is updated per Findings (Affected Files now matches; constants split to `constants.ts`; track compiler explicit).
- New implement dot `implement: track compiler (authored to compiled segments)` should exist; created here.
- `src/road/types.ts` is a tiny shared-types file; keep it inside the same implement dot rather than spawning a separate one.

### References

1. Jake Gordon, "JavaScript Racer", Code inComplete, 2012. Pseudo-3D segment projector and curve accumulation.
2. Lou's Pseudo-3D Page (Lou Boudreau / Lou's Pseudo-3D Tutorial). Far-to-near rendering with maxY clip.
3. GDD §9, §10, §16, §21, §22 (this repo).
