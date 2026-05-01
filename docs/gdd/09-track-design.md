# 9. Track design

## Track anatomy

Each VibeGear2 track should be authored as a sequence of road segments with the following high-level ingredients:

- Opening launch straight.
- One signature feature.
- One recovery zone.
- One high-speed gamble.
- One late-race tension section.
- Distinct horizon set pieces.

## Road curvature

Curves should be bucketed for authoring:

| Grade | Description |
| --- | --- |
| Sweep | Long, readable bend |
| Medium | Requires lift or gentle brake |
| Sharp | Strong brake or setup-dependent line |
| Hairpin | Full commitment corner |
| Compound | Links two or more grades |

## Elevation and hills

Hills are important for spectacle but should be used deliberately:

- Mild crest: visibility change only.
- Aggressive crest: temporary horizon loss and landing instability.
- Dip: dramatic speed compression.
- Plateau: scenic reveal.

## Lane width

Default lane model: 3 visual lanes, with enough shoulder space to create “squeeze” traffic moments without hiding the road edge.

## Shortcuts and forks

Shortcuts are allowed later, but they should be risk shortcuts, not mandatory knowledge checks. Forked routes are stretch content for post-v1.0 because they increase AI and ghost complexity substantially.

## Hazards

Allowed hazards:

- Traffic cones and construction markers.
- Signs and breakable clutter.
- Puddles and slick paint.
- Loose gravel bands.
- Snow buildup.
- Tunnel light adaptation.

Avoid gimmick hazards that turn races into memory tests.

## Pickups

Pickups are authored track objects that reward a chosen line instead of
punishing a mistake. They are the inverse of hazards: visible, deterministic,
and placed by track authors rather than spawned randomly.

Allowed pickup kinds:

- Cash: small credit bundles that make an optional racing line feel valuable.
- Nitro: a reserve top-up for players who spend boost early or take a risky
  line before a long straight.

Placement rules:

- Pickups live on track segments, not in a global random pool.
- Pickups respawn each lap so lap structure stays consistent.
- A pickup id must be unique within a track.
- Cash pickups should contribute roughly 5 to 15 percent of expected race cash
  on a normal clear run, so finish rewards and sponsor goals remain dominant.
- Nitro pickups restore 25 percent of the starting nitro reserve, clamped at
  the car's current maximum.
- AI ignores pickups in v1. This is a documented limitation so AI racing lines
  remain stable while the player-facing mechanic lands.

## Roadside scenery

Use scenery to reinforce speed and identity:

- Poles and signs near the verge for speed streaking.
- Mid-distance trees/buildings/rock faces for parallax.
- Far horizon silhouettes for region identity.
- Tunnel segments for contrast and audio shifts.

## Track length targets

| Track family | Target time at competitive pace |
| --- | --- |
| Short | 50 to 75 seconds |
| Medium | 75 to 105 seconds |
| Long | 105 to 150 seconds |

## Community-created tracks

Community tracks should follow these rules:

- Fixed segment budget.
- Metadata for weather support and difficulty.
- Validation for start, checkpoints, lap closure, and sprite density.
- No copyrighted location names or derivative landmarks.
- Optional “official-safe” lint mode that rejects risky naming.
