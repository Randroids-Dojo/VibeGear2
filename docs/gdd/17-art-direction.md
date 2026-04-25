# 17. Art Direction

## Overall Visual Identity

VibeGear2 should look like a game players remember from the 16-bit era but could not have actually played then:

- Chunky, bold, readable shapes
- Modern lighting accents
- Smooth browser performance
- Stylized original world
- No direct period-accurate limitations unless they improve style
- Strong region identity

## Region Art Themes

| Region | Key Assets |
|---|---|
| Neon Harbor | Cranes, shipping lights, reflective asphalt, waterline skyline. |
| Redwood Circuit | Tree walls, fog posts, log bridges, forest signs. |
| Mirage Basin | Heat shimmer, desert roadside shops, solar towers. |
| Storm Coast | Sea wall, rain spray, lighthouse beams, warning buoys. |
| Alpine Static | Snowbanks, radio towers, icy signs, pine silhouettes. |
| Glass Canyon | Crystal cliffs, tunnel mouths, reflective rock markers. |
| Metro Midnight | Overpasses, arcade signs, tunnel lamps, traffic silhouettes. |
| Aurora Highway | Observatory domes, aurora sky, snow markers, frozen lakes. |

## Car Design Language

| Rule | Description |
|---|---|
| Fictional silhouettes | Use invented proportions. |
| Readable front/back | Player must recognize traffic direction instantly. |
| Strong roof color | Helps identify AI cars at distance. |
| Damage overlays | Smoke, sparks, cracks, not realistic deformation. |
| No real logos | Use original abstract decals only. |
| No trademark lookalikes | Avoid recognizable manufacturer cues. |

## UI/HUD Design

Visual keywords:

- Modular
- Bright
- High contrast
- Slightly chunky
- Not cluttered
- Readable at speed

HUD color rules:

| State | Color Direction |
|---|---|
| Normal | White and cyan. |
| Boost ready | Electric blue or violet. |
| Warning | Amber. |
| Critical | Red plus icon shape, not color only. |
| Money | Green or gold. |
| Weather | Icon plus label. |

## Menus

| Screen | Visual Focus |
|---|---|
| Title | Animated road horizon and music pulse. |
| Tour Map | Original region panels, not a copied world map. |
| Pre-Race | Track briefing card and car readiness. |
| Garage | Car side view, upgrade modules. |
| Results | Placement, money, damage, points. |
| Settings | Clean modern panel. |
| Track Editor | Data-driven list and validation status. |

## Iconography

Required icons:

- Speed
- Gear
- RPM
- Position
- Lap
- Damage
- Boost
- Credits
- Weather
- Grip
- Repair
- Upgrade
- Manual/auto transmission
- Gamepad
- Keyboard
- Track difficulty
- Mod content warning

## Accessibility and Readability

| Requirement | Implementation |
|---|---|
| Colorblind support | Icons and patterns in addition to color. |
| Motion reduction | Lower camera shake, speed lines, weather opacity. |
| Readable text | Minimum 18 px equivalent for critical info. |
| Font fallback | Use web-safe fallback if custom font fails. |
| Contrast | HUD text over dark backing plates. |
| Input clarity | Show current bindings on pause and garage screens. |

## Asset Resolution and Export Guidelines

| Asset Type | Suggested Native Size |
|---|---:|
| Player car sprite sheet | 512x512 or 1024x1024 sheet |
| AI car sprites | 128x128 each or atlas |
| Roadside sprites | 64x64 to 512x512 |
| Background layer | 2048x512 |
| Weather particles | 16x16 to 64x64 |
| UI icons | SVG preferred or 64x64 PNG |
| HUD font | Open-license bitmap or vector font |
| Music | OGG and MP3 fallback |
| SFX | WAV source, OGG runtime |

Rules:

- Use nearest-neighbor scaling for pixel assets.
- Use texture atlases to reduce draw calls.
- Include license metadata beside assets.
- Keep source art files in a separate repository folder if large.
