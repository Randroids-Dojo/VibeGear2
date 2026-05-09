---
title: "implement: speed-coupled FOV widen and brake-coupled camera dip so high speed reads as fast and braking reads as weight transfer"
status: done
priority: 3
issue-type: task
created-at: "2026-05-06T00:12:17.565440-05:00"
blocks:
  - VibeGear2-implement-fix-lateral-b2503f6f
---

CAMERA LANGUAGE. src/road/constants.ts:33-45 ships a fixed FOV_DEGREES=100 and CAMERA_HEIGHT=1.5 with no per-frame modulation. §16 Camera behavior: "Camera lowers slightly at high speed. Crest lines should reveal horizon dramatically." Today the camera is geometrically static; only the impact shake (which is itself dormant per the iter-8 fire-camera slice) ever moves it. Affected files: src/app/race/page.tsx (per-frame compute cameraFovDelta and cameraHeightDelta from session.player.car.speed and lastBrakeRef, low-pass smooth at 6 Hz, override camera.depth and camera.y before drawRoad). Implementation Notes: speedNorm = clamp(speed/topSpeed, 0, 1); fovDelta = lerp(0, 6 deg, speedNorm) so FOV grows from 100 to 106 at top speed (matches the §16 "lowers slightly + reveals horizon" intent without perspective skew that would re-tune segmentProjector goldens); cameraDepth = 1 / tan((FOV+fovDelta)/2 * pi/180); brakeDip = brakeInput * 0.18 m so cameraHeight drops from 1.5 to 1.32 under hard brake; smoothing time constant tauSec = 0.16 (cameraSmoothing.ts new module, pure). Crucially: no change to segmentProjector internals; the projector reads camera.depth and camera.y as live values per call, so the new smoothed values flow through with zero projector-test churn. Verify: Vitest src/app/race/__tests__/cameraSmoothing.test.ts pinning fovDelta(0)=0, fovDelta(0.5) close to 3, fovDelta(1) close to 6, smoothing stable on a step input within 0.5 s; Playwright e2e/camera-feel.spec.ts captures a frame at idle and a frame at top speed in a /dev/road harness and asserts the horizon strip is at least 4 px lower in the high-speed frame (FOV widen pulls horizon down). Out of scope: cameraShake on impact (covered by VibeGear2-implement-fire-camera-36ae8ff4). after: VibeGear2-implement-fix-lateral-b2503f6f because the FOV widen is only worth doing once the lateral-fix lets the player actually hit top speed in a corner without scraping the rumble.

## Implementation Notes (iter-11 perf budget audit append)

Reduced-motion gating amendment. The iter-8 dot text named the smoothing
math but did not explicitly require a `prefers-reduced-motion: reduce`
gate. Iter-11's perf-budget audit caught the gap: a per-frame FOV widen
plus brake-coupled vertical camera dip is exactly the class of motion a
vestibular-sensitive player has the OS-level setting to suppress (per
§19 reduced-motion guidance and the existing `vfx.ts:114-120`
`prefersReducedMotion()` helper that the iter-8 fire-camera and
radial-speed slices both reuse).

When `prefersReducedMotion()` returns true the implementor must:

- Hold `cameraFovDelta = 0` (no widen at speed; FOV stays at the §16
  authored 100 deg).
- Hold `cameraHeightDelta = 0` (no brake dip; height stays at the §16
  authored 1.5 m).
- Skip the 6 Hz low-pass smoothing entirely (zero-input lerp is a
  no-op, but the explicit gate documents intent and avoids a
  no-op smoothing tick eating cache).

Reuse the already-cached `prefersReducedMotion()` helper from
`src/render/vfx.ts:114-120` rather than re-querying matchMedia per
frame. The existing test cache-invalidation hook (`vfx.ts:125`) is
already the way the test suite flips the gate between cases.

Add a Vitest case to the new
`src/app/race/__tests__/cameraSmoothing.test.ts`:

    it("holds FOV and height at authored defaults under reduced-motion", () => {
      // mock prefersReducedMotion -> true via the vfx test hook
      const out = cameraSmoothing({ speed: 60, brake: 1, topSpeed: 61 }, prevState);
      expect(out.fovDelta).toBe(0);
      expect(out.heightDelta).toBe(0);
    });

This brings the iter-8 camera-language slice in line with the iter-8
fire-camera and radial-speed slices, which both already gate on
reduced-motion (vfx.ts:161 `if (prefersReducedMotion()) return state;`
in fireFlash; the radial-speed dot text under "Reduced-motion: gate
emissions to 0 when prefersReducedMotion").
