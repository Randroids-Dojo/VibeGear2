# 10. Driving Model and Physics

## Arcade Handling Philosophy

The driving model should be **simple to control, deep to master**.

It does not simulate real tire thermodynamics, suspension geometry, differential behavior, or drivetrain physics. It simulates the feel of a fast arcade racer:

- Speed is king.
- Steering is responsive.
- Weather and tires are noticeable.
- Collisions are dramatic.
- Boost timing matters.
- Damage affects confidence.
- Manual shifting gives expert advantage but is not mandatory.

## Coordinate Model

Use a pseudo-3D racing coordinate system:

| State | Meaning |
|---|---|
| `trackZ` | Player progress along track. |
| `laneX` | Lateral position relative to road center. |
| `speed` | Forward speed in world units per second. |
| `lateralVelocity` | Sideways movement for sliding and collisions. |
| `gear` | Current gear index. |
| `rpm` | Normalized engine rev value. |
| `boostTimer` | Active boost remaining. |
| `damage` | Mechanical and panel damage state. |
| `surfaceContact` | Current road, shoulder, off-road, puddle, snow, etc. |

## Acceleration

Initial formula:

```text
engineForce = engineAccel * throttle * gearEfficiency * damagePower
dragForce = aeroDrag * speed^2
rollingForce = rollingFriction * speed
speed += (engineForce - dragForce - rollingForce) * dt
```

Tunable targets:

| State | Stock Car | Mid Game | Late Game |
|---|---:|---:|---:|
| 0-60 mph | 5.8 sec | 4.5 sec | 3.4 sec |
| Top speed | 178 mph | 210 mph | 238 mph |
| Boost top speed | 205 mph | 245 mph | 285 mph |
| Braking 100-0 mph | 3.2 sec | 3.0 sec | 2.8 sec |

## Braking

| Input | Effect |
|---|---|
| Brake | Strong forward deceleration. |
| Brake plus steer | Builds slip faster. |
| Reverse below 5 mph | Optional reverse for recovery. |
| Handbrake | Stretch or advanced control, mostly for practice and special events. |

Initial tuning:

```text
brakeForce: 42 units/sec/sec
reverseAccel: 10 units/sec/sec
coastDrag: 4 units/sec/sec
emergencyBrakeAssist: enabled below 30 mph
```

## Top Speed

Top speed is influenced by car base stat, engine upgrade, transmission upgrade, weather drag, surface, damage, boost state, and drafting state if enabled.

```text
effectiveTopSpeed =
  carBaseTopSpeed *
  engineTopSpeedMultiplier *
  transmissionMultiplier *
  weatherSpeedMultiplier *
  damageSpeedMultiplier *
  surfaceSpeedMultiplier *
  boostMultiplier
```

## Gear Shifting

### Automatic

Default mode.

- Game shifts near ideal RPM.
- Slight efficiency penalty compared with perfect manual shifting.
- No stall or missed shift.
- Supports casual play.

### Manual

Expert mode.

- Player shifts up/down.
- Better acceleration if shifted correctly.
- Over-rev reduces efficiency.
- Under-rev bogs acceleration.
- Accessibility option: `manual shift reminder`.

Suggested gear ranges:

| Gear | Stock Range mph | Late Range mph |
|---|---:|---:|
| 1 | 0-45 | 0-52 |
| 2 | 35-75 | 45-92 |
| 3 | 65-115 | 80-135 |
| 4 | 100-160 | 120-190 |
| 5 | Upgrade | 165-230 |
| 6 | Upgrade | 210-270 |

## Steering Model

Steering should be speed-sensitive.

```text
steerPower =
  baseSteerRate *
  speedSteerCurve(speed) *
  handlingStat *
  tireGrip *
  surfaceGrip *
  damageHandling
```

Rules:

- Low speed steering is forgiving.
- High speed steering is stable, not twitchy.
- Oversteer appears through slip, not instant spin.
- Road curve pushes the car visually and mechanically.

Initial tuning:

| Parameter | Value |
|---|---:|
| Base steer rate | 2.4 lane units/sec |
| Minimum steering speed | 5 mph |
| Steering peak | 70-120 mph |
| High-speed steering reduction | 0.72 at top speed |
| Countersteer recovery | 1.35 multiplier |

## Traction

Grip is a multiplier from tires, surface, weather, and damage.

```text
grip =
  tireGrip *
  surfaceGrip *
  weatherGrip *
  speedGripCurve *
  damageGrip
```

Initial multipliers:

| Condition | Grip Multiplier |
|---|---:|
| Dry asphalt | 1.00 |
| Wet asphalt with stock tires | 0.78 |
| Wet asphalt with upgraded wet tires | 0.92 |
| Snow edge | 0.58 |
| Gravel shoulder | 0.64 |
| Off-road | 0.42 |
| Oil sheen | 0.35 for 0.6 sec |

## Drifting and Sliding

VibeGear2 should use controlled arcade sliding, not deep drift scoring.

Slip builds when:

- Steering sharply at high speed.
- Hitting puddles, oil, snow, or gravel.
- Colliding with cars or barriers.
- Entering curves too fast.
- Boosting while already near grip limit.

Slip effects:

| Slip Level | Effect |
|---|---|
| 0-20 | No visible effect. |
| 21-40 | Tire squeal, small lateral delay. |
| 41-70 | Rear wiggle, speed loss, wider turning. |
| 71-90 | Major slide, strong countersteer needed. |
| 91-100 | Spinout or heavy correction, depending assist setting. |

Accessibility:

- `Reduced spinouts` turns full spin into heavy speed loss and lane wobble.
- `Visible grip meter` shows when slip is rising.

## Collision Handling

Collision classes:

| Collision | Result |
|---|---|
| AI side rub | Lateral push, small speed loss, side damage. |
| AI rear impact | Speed transfer, front damage, possible bump draft. |
| AI front cut-off | Strong brake event, front damage. |
| Soft roadside | Speed loss, visual debris, low damage. |
| Hard barrier | Strong bounce, high damage, possible spin. |
| Hazard object | Depends on object mass and speed. |

Formula target:

```text
impactSeverity =
  relativeSpeed *
  impactAngleFactor *
  objectHardness *
  armorDamageMultiplier
```

## Road Edge Behavior

| Position | Behavior |
|---|---|
| Within lane | Full grip. |
| On shoulder | Reduced grip and speed cap. |
| Fully off-road | Strong slowdown, debris effect, damage risk. |
| Beyond safety bounds | Invisible recovery push or reset after 2 seconds. |

## Off-Road Slowdown

| Surface | Top Speed Cap | Grip | Damage Risk |
|---|---:|---:|---:|
| Painted shoulder | 90 percent | 0.85 | Low |
| Gravel shoulder | 65 percent | 0.64 | Low |
| Grass/sand | 45 percent | 0.42 | Medium |
| Snowbank | 38 percent | 0.35 | Medium |
| Barrier zone | 15 percent | 0.20 | High |

## Air and Hill Behavior

Optional but useful for spectacle.

Rules:

- Small crests reduce traction briefly.
- Air time under 0.4 seconds should be visual only.
- Landing while steering builds slip.
- Boosting over crests increases risk.
- AI should also slow or wobble on severe crests.

## Drafting / Slipstream

v1.0 optional, v1.1 recommended.

| Condition | Requirement |
|---|---|
| Distance | Behind AI within 25-80 world units. |
| Lane alignment | Within 0.35 lane width. |
| Time | 1.0 second buildup. |
| Bonus | Up to 3 percent speed and 5 percent acceleration. |
| Break condition | Move out of lane, brake, collide, or pass. |

Design rule: Drafting should help skilled passing but never replace upgrades.

## Nitro / Turbo System

Use original terminology: **Pulse Boost**.

| Upgrade Level | Charges | Duration | Power | Notes |
|---|---:|---:|---:|---|
| 0 | 2 | 1.0 sec | 1.12x | Starter boost. |
| 1 | 3 | 1.1 sec | 1.16x | Affordable. |
| 2 | 3 | 1.3 sec | 1.20x | Better passing. |
| 3 | 4 | 1.5 sec | 1.24x | Mid-game core. |
| 4 | 5 | 1.8 sec | 1.28x | Late-game. |

Rules:

- Boost increases speed cap and acceleration.
- Boost increases slip risk in curves and wet weather.
- Boost can be canceled by severe collision.
- Boost pickups refill one charge, not more than max.
- Boost activation has a 0.35 second minimum lockout.
- AI drivers use boost visibly.

## Weather Effects on Handling

| Weather | Speed | Grip | Visibility | Notes |
|---|---:|---:|---:|---|
| Clear | 1.00 | 1.00 | 1.00 | Baseline. |
| Light rain | 0.98 | 0.86 | 0.95 | Wet tire value. |
| Heavy rain | 0.94 | 0.76 | 0.82 | Puddles more common. |
| Fog | 0.98 | 0.96 | 0.62 | Draw distance reduced. |
| Snow | 0.90 | 0.68 | 0.78 | Snow edge hazards. |
| Dust | 0.96 | 0.82 | 0.72 | Desert visibility waves. |
| Night | 1.00 | 1.00 | 0.88 | Headlight cones and signage matter. |

## Damage Effects on Performance

| Damage | Effect |
|---|---|
| 0-25 percent | Cosmetic only. |
| 26-50 percent | Minor top speed and handling penalty. |
| 51-75 percent | Noticeable acceleration, steering, and boost penalty. |
| 76-99 percent | Severe performance loss, warning audio, unstable steering. |
| 100 percent | Critical failure risk. |
| 120 percent emergency threshold | DNF unless accessibility option converts it to limp mode. |

## Suggested Tunable Constants

| Constant | Initial Value |
|---|---:|
| Fixed simulation step | 1/60 sec |
| Segment length | 200 world units |
| Draw distance | 220 segments |
| Camera height | 1,000 world units |
| Field of view | 90 degrees |
| Road width | 2,200 world units |
| Player collision width | 180 world units |
| AI collision width | 180-240 world units |
| Off-road decel | 28 units/sec/sec |
| Base acceleration | 18 units/sec/sec |
| Base brake | 42 units/sec/sec |
| Base drag | 0.00032 |
| Boost cooldown | 0.35 sec |
| Slip recovery | 22 points/sec |
| Damage repair cost | 45 credits per damage point |
