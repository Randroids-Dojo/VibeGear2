# 10. Driving model and physics

The target feel is slippery enough to be exciting, stable enough to be learnable, and expressive enough to reward upgrades.

## Arcade handling philosophy

- Steering should be immediate.
- High speed should reduce twitch rather than remove authority.
- Traction loss should be readable and recoverable.
- Nitro should feel dangerous if used badly.
- Off-road should sting immediately but not end the race.
- Collisions should create chaos, not simulation-grade crumple complexity.

## Acceleration and top speed

Internal simulation uses meters per second; UI can show km/h or mph. The game should use a display-speed style that feels exciting rather than literally realistic.

Initial target top-speed bands

| Class | Target UI speed |
| --- | --- |
| Starter balanced | 215 to 230 km/h |
| Starter grip | 205 to 220 km/h |
| Mid-tier | 240 to 275 km/h |
| Late-tier | 290 to 335 km/h |

## Gear shifting

Top Gear 2’s upgrade structure explicitly staged extra gears through gearbox upgrades. That is too core to ignore, but VibeGear2 should simplify the UX. The original guide states that gearbox upgrades add fifth, sixth, and seventh gears. [17]

VibeGear2 design

- Automatic transmission is default.
- Manual shifting is optional.
- Gearbox upgrades increase effective top-speed ceiling and torque smoothness.
- Manual transmission gains a small, not dominant, expert advantage.

## Steering model

Use speed-aware steering:

```
steerRate = lerp(steerRateLow, steerRateHigh, speedNorm)
yawDelta = steerInput * steerRate * dt * tractionScalar
```

Desired behavior:

- Low speed: tight, confident rotation.
- Mid speed: stable but expressive.
- High speed: enough authority to place the car, not enough to zig-zag unrealistically.

## Traction and drifting

VibeGear2 should support micro-drift rather than a dedicated drift mode.

- Mild lateral slip appears at high steer + high speed.
- Wet or damaged conditions increase slip angle.
- Handbrake triggers sharper rotation at severe speed loss.
- Drift is useful for survival and line correction, not for score-chaining.

## Collision handling

There are three collision classes:

| Collision type | Effect |
| --- | --- |
| Car rub | Moderate speed bleed, minor side damage |
| Car hit | Strong speed bleed, direction wobble, medium damage |
| Hard object / wall | Major speed loss, likely spin, heavy damage |

## Road edge and off-road slowdown

Off-road should do the following immediately:

- Reduce traction.
- Apply strong drag.
- Cap top speed.
- Increase rumble and dust/spray/snow VFX.
- Increase damage slightly if the player persists off-road at high speed.

## Air and hill behavior

Use conservative airtime:

- Tiny crests cause light unloading.
- Large jumps are rare and track-specific.
- During air state, steering authority drops heavily.
- Landing in a turn briefly destabilizes the vehicle.

## Drafting

Slipstream is optional but recommended:

- Activate only above a speed threshold.
- Small but noticeable acceleration bonus after 0.6 s in wake.
- Break instantly on side movement or brake.

## Nitro system

The successor should preserve the spirit of upgradeable nitro without copying the original’s exact implementation.

Design

- 3 charges per race by default.
- Each charge can be tapped or held.
- Base duration: 1.1 s per charge.
- Upgrades improve thrust and total duration.
- Nitro expands instability under poor traction.
- Nitro use in severe corners is usually a mistake.

## Weather effects on handling

| Weather | Grip | Visibility | Nitro risk | Recommended setup |
| --- | --- | --- | --- | --- |
| Clear | Baseline | High | Low | Dry tires |
| Light rain | -10% | Medium-high | Medium | Dry or all-weather |
| Heavy rain | -20% | Medium | High | Wet tires |
| Fog | Baseline grip | Low | Medium | Stability and memory |
| Snow | -25% | Medium | High | Wet/snow tires |
| Dusk/night | Baseline grip | Medium | Low | Lighting readability |

## Damage effects on performance

Damage should affect performance in stages:

| Damage band | Effect |
| --- | --- |
| 0 to 24% | Cosmetic sparks and panel vibration only |
| 25 to 49% | Slight stability decay, mild nitro inefficiency |
| 50 to 74% | More severe wobble, reduced grip, reduced top speed |
| 75 to 99% | Frequent instability, heavy power loss, high spin risk |
| 100% | Catastrophic state, either limp mode or retire |

## Suggested tunable constants

These are initial targets for prototype feel, not final ship values.

| Parameter | Starter target | Mid target | Late target |
| --- | --- | --- | --- |
| Max speed | 61 m/s | 73 m/s | 87 m/s |
| Accel | 16 m/s² | 19 m/s² | 22 m/s² |
| Brake | 28 m/s² | 31 m/s² | 34 m/s² |
| Coasting drag | 4.5 m/s² | 4.0 m/s² | 3.5 m/s² |
| Steer rate low | 2.3 rad/s | 2.1 rad/s | 1.9 rad/s |
| Steer rate high | 1.25 rad/s | 1.15 rad/s | 1.05 rad/s |
| Off-road cap | 24 m/s | 26 m/s | 28 m/s |
| Off-road drag | 18 m/s² | 20 m/s² | 22 m/s² |
