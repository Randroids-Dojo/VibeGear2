# 9. Track design

### Track anatomy

Each VibeGear2 track should be authored as a sequence of road segments with the following high-level ingredients:

- Opening launch straight.
- One signature feature.
- One recovery zone.
- One high-speed gamble.
- One late-race tension section.
- Distinct horizon set pieces.

### Road curvature

Curves should be bucketed for authoring:

| Grade | Description |
| --- | --- |
| Sweep | Long, readable bend |
| Medium | Requires lift or gentle brake |
| Sharp | Strong brake or setup-dependent line |
| Hairpin | Full commitment corner |
| Compound | Links two or more grades |

### Elevation and hills

Hills are important for spectacle but should be used deliberately:

- Mild crest: visibility change only.
- Aggressive crest: temporary horizon loss and landing instability.
- Dip: dramatic speed compression.
- Plateau: scenic reveal.

### Lane width

Default lane model: 3 visual lanes, with enough shoulder space to create “squeeze” traffic moments without hiding the road edge.

### Shortcuts and forks

Shortcuts are allowed later, but they should be risk shortcuts, not mandatory knowledge checks. Forked routes are stretch content for post-v1.0 because they increase AI and ghost complexity substantially.

### Hazards

Allowed hazards:

- Traffic cones and construction markers.
- Signs and breakable clutter.
- Puddles and slick paint.
- Loose gravel bands.
- Snow buildup.
- Tunnel light adaptation.

Avoid gimmick hazards that turn races into memory tests.

### Roadside scenery

Use scenery to reinforce speed and identity:

- Poles and signs near the verge for speed streaking.
- Mid-distance trees/buildings/rock faces for parallax.
- Far horizon silhouettes for region identity.
- Tunnel segments for contrast and audio shifts.

### Track length targets

| Track family | Target time at competitive pace |
| --- | --- |
| Short | 50 to 75 seconds |
| Medium | 75 to 105 seconds |
| Long | 105 to 150 seconds |

### Community-created tracks

Community tracks should follow these rules:

- Fixed segment budget.
- Metadata for weather support and difficulty.
- Validation for start, checkpoints, lap closure, and sprite density.
- No copyrighted location names or derivative landmarks.
- Optional “official-safe” lint mode that rejects risky naming.
