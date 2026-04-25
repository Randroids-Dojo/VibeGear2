# 16. Rendering and Visual Design

## Retro-Modern Aesthetic

VibeGear2 should evoke classic 16-bit arcade racing through:

- Pseudo-3D road projection
- Strong horizon line
- Large readable car sprites
- Scaled roadside objects
- Parallax background layers
- Bold color bands
- Limited but expressive palettes
- Modern resolution, accessibility, and UI clarity

It should not imitate a specific commercial game's sprites, palettes, UI, or tracks.

## Pseudo-3D Road Rendering Approach

A JavaScript pseudo-3D implementation can project road segments from world space to screen space using a scale such as `cameraDepth / z`, then draw road polygons and scaled sprites. Jake Gordon's [JavaScript Racer](https://jakesgordon.com/writing/javascript-racer/) and the [Code inComplete racing tutorial](https://codeincomplete.com/articles/javascript-racer-v1-straight/) outline this style of projection, fixed-step update loops, road segment data, draw distance, camera settings, and off-road tuning variables.

## Render Steps

1. Determine player segment from `trackZ`.
2. Compute camera-relative x, y, z for each visible segment.
3. Accumulate curve offset to bend the road.
4. Project near and far segment points to screen.
5. Draw sky and parallax backgrounds.
6. Draw far road segments toward near segments.
7. Draw roadside objects and hazards sorted by depth.
8. Draw AI cars sorted by depth.
9. Draw player car sprite and effects.
10. Draw HUD on separate layer.

## Camera Behavior

| Parameter | Value |
|---|---:|
| Logical resolution | 1280x720 |
| Internal pixel scale | Configurable 1x, 2x, 3x aesthetic |
| Camera height | 1000 world units |
| Draw distance | 220 segments |
| Field of view | 90 degrees |
| Horizon position | 38 percent from top |
| Camera shake | Low, event-based |
| Weather shake | Optional and accessibility-limited |

## Sprite Scaling

| Sprite Type | Scale Rule |
|---|---|
| AI cars | Based on projected segment scale. |
| Roadside objects | Based on projected scale and side offset. |
| Pickups | Pulse animation plus depth scale. |
| Hazards | Depth scale, high contrast outline. |
| Player car | Fixed lower-screen sprite with animation states. |

## Parallax Backgrounds

| Layer | Scroll Input |
|---|---|
| Sky | Static or slow time-of-day shift. |
| Far mountains/city | Small offset from cumulative curve. |
| Mid scenery | Medium offset. |
| Weather layer | Independent wind and speed scroll. |
| Foreground flashes | Event-based, such as tunnel lights. |

## Roadside Objects

Rules:

- Objects must reinforce speed and theme.
- Objects must not obscure the road edge.
- Collision-relevant objects must have clear silhouettes.
- Decorative objects should be non-collidable by default.
- Object density should rise in later regions but not reduce readability.

## Car Sprites

Minimum sprite states:

| State | Required Frames |
|---|---:|
| Player straight | 1 |
| Player steer left/right | 2 each |
| Player heavy steer left/right | 1 each |
| Player boost | 2 |
| Player damaged smoke | Overlay |
| AI car straight | 1 per color/body |
| AI car side angle | Optional |
| Collision flash | Overlay |

## UI Style

- Use original pixel-inspired vector or bitmap font.
- Do not use fonts from commercial games.
- Favor rectangular panels, neon accents, and high contrast.
- Ensure all numbers are readable at 1280x720 and 1920x1080.
- Provide colorblind-safe damage and weather indicators.

## Color Palette Guidance

| Region | Palette Direction |
|---|---|
| Neon Harbor | Deep blues, magenta signs, orange sunset. |
| Redwood Circuit | Greens, fog blues, warm sawmill browns. |
| Mirage Basin | Sand, copper, cyan sky, heat shimmer. |
| Storm Coast | Slate, sea green, white spray, amber lights. |
| Alpine Static | Snow blue, dark pine, signal red. |
| Glass Canyon | Rose rock, prism highlights, dark tunnels. |
| Metro Midnight | Purple-black, cyan, arcade pink, sodium orange. |
| Aurora Highway | Navy, teal, violet aurora, cold white. |

## Animation and Effects

| Effect | Purpose |
|---|---|
| Speed lines | Boost feedback. |
| Road shimmer | Heat and high speed. |
| Tire smoke | Slip and damage. |
| Sparks | Barrier scrape. |
| Pickup pulse | Readability. |
| Countdown pop | Start excitement. |
| Finish flash | Race completion. |
| Damage smoke | Urgency. |

## Performance Targets for Browser Play

| Target | Requirement |
|---|---|
| Desktop normal | 60 FPS at 1280x720 logical resolution. |
| Desktop low | 60 FPS with reduced draw distance and sprites. |
| Mobile future | 30 FPS fallback. |
| Input latency | Under 80 ms perceived. |
| Initial load | Under 10 MB for MVP build. |
| Race restart | Under 1 second. |
| Garbage collection | Avoid per-frame allocations in renderer and physics. |
