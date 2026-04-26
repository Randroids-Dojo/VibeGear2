# 16. Rendering and visual design

## Retro-modern aesthetic

VibeGear2 should look like a memory of a 16-bit racer, not a museum replica.

Visual priorities:

- Bold color blocking
- Strong foreground speed cues
- Readable road edges
- Exaggerated horizons
- Crisp UI typography
- Controlled post effects only

## Pseudo-3D road rendering approach

VibeRacer currently renders a real 3D scene using Three.js with a GLTF car, flat track meshes built from piece geometry, a PerspectiveCamera, and a requestAnimationFrame loop managed by RaceCanvas. That architecture is useful context, but VibeGear2 should replace the mesh-based top-down circuit presentation with a pseudo-3D road renderer built around authored road segments, while keeping the surrounding app shell, input, persistence, and flow concepts. [18]

Recommended renderer

- Canvas 2D for road strips, roadside sprites, and HUD.
- Optional lightweight WebGL layer for post effects later.
- Segment-based projection:
- world z drives scale
- centerline offset fakes curves
- segment y drives hills
- clip against previous segment to avoid overdrawing
- Billboard sprites for cars and trackside objects.
- Parallax backgrounds drawn by region layer.

## Camera behavior

- Chase-camera feel without real camera physics.
- Camera lowers slightly at high speed.
- Crest lines should reveal horizon dramatically.
- Collision shake and off-road rumble should be subtle and short.

## Sprite scaling

- Cars and objects scale from projected depth.
- Opponent cars should stay readable earlier than strict realism would dictate.
- Player car should occupy 16 to 22% of screen height in standard camera mode.

## Parallax backgrounds

Three layers minimum:

- Sky / weather color band
- Mid horizon silhouettes
- Near terrain or city layer

## Roadside objects

Use packable sprite categories:

- Utility signs
- Trees/palms/conifers
- Fences/barriers
- Buildings
- Rock props
- Light poles
- Tunnel mouths

## Car sprites

The player and AI cars should be built from an original sprite grammar:

- 12 to 16 directional frames
- 3 damage variants
- Brake light frame
- Nitro glow frame
- Wet spray and snow trail variants

## UI style

- Thick, high-contrast edge boxes
- Monospace timer readout
- Bold iconography
- No faux-SNES menu cloning
- Fast transitions, not elaborate scene changes

## Color palette guidance

Use rich saturated palettes per region, but reserve the following for systemic readability:

- Road edge warnings: amber
- Severe damage: red
- Wet grip UI: cyan
- Nitro full: magenta or electric blue
- Clean PB / record celebration: green and gold

## Animation and effects

Recommended VFX set:

- Nitro bloom trail
- Wet spray
- Snow mist
- Dust roost
- Screen-edge pulse on PB
- Light camera shake on impact
- HUD flash on lap complete

## Performance targets

| Device class | Target |
| --- | --- |
| Mid-range desktop at 1080p | 60 FPS |
| Integrated laptop GPU | 60 FPS with reduced draw distance |
| Lower-end desktop | 30 to 60 FPS with reduced sprite density |
| Mobile future target | 30 FPS |
