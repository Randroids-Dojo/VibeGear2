# 13. Damage, Repairs, and Risk

## Damage Design Goal

Damage should make the player care about crashes while preserving hope.

Bad damage design:

- One early mistake ruins a 4-minute race.
- Repair bills force repetitive grinding.
- Damage effects are invisible or confusing.
- AI appears immune.

Good damage design:

- The player sees what broke.
- The car feels worse in understandable ways.
- Repairs create an economy decision.
- The player can still limp to qualification.
- Armor upgrades visibly pay off.

## Damage Sources

| Source | Damage Type |
|---|---|
| Front collision with AI | Front body, powertrain. |
| Rear collision | Rear body, stability. |
| Side scrape | Side body, steering. |
| Barrier impact | Body and suspension. |
| Hard hazard | Body, tires, powertrain depending object. |
| Off-road at high speed | Tire wear and suspension. |
| Landing badly | Suspension. |
| Driving while critical | Powertrain decay. |

## Damage Visualization

| Damage Level | Visual |
|---|---|
| 0-25 | Clean car, slight scuffs only after impacts. |
| 26-50 | Scratches, flickering panel icon. |
| 51-75 | Smoke puffs, cracked HUD silhouette, warning beep. |
| 76-99 | Heavy smoke, unstable engine audio, red warning. |
| 100+ | Critical state, limp mode or DNF depending settings. |

## Mechanical Effects

| Damage Area | Effect |
|---|---|
| Front | Reduced acceleration and boost efficiency. |
| Rear | Reduced stability and higher spin chance. |
| Left side | Steering asymmetry to left. |
| Right side | Steering asymmetry to right. |
| Suspension | Slip recovery penalty and hill instability. |
| Tires | Lower grip, worse weather performance. |
| Powertrain | Top speed and acceleration penalty. |

## Repair Decisions

After each race, the repair screen shows:

| UI Element | Meaning |
|---|---|
| Current damage | Car silhouette and numeric severity. |
| Recommended repair | Minimum recommended for next track. |
| Full repair cost | Cost to return to 0 damage. |
| Partial repair slider | Player chooses spend amount. |
| Next race warning | Example: `Heavy rain ahead. Tire damage will matter.` |
| Upgrade comparison | Example: `Repair 60 percent or buy Wet Tires L2.` |

## Race-Ending Damage Threshold

Default normal mode:

| Damage | Result |
|---|---|
| 0-99 | Race continues. |
| 100-119 | Critical warnings, major penalties. |
| 120+ | DNF if powertrain damage is severe. |
| 120+ with accessibility assist | Limp mode, max 80 mph, no DNF. |

Hard mode:

- DNF at 100 percent critical powertrain damage.
- Repair costs +15 percent.
- No assist loans.

## Balancing Damage

Rules:

1. Early region barriers should mostly slow the player, not destroy them.
2. AI side rubs should be annoying but survivable.
3. Hard collisions should be avoidable or player-caused.
4. Damage effects should ramp gradually.
5. Armor should reduce damage and repair costs, but not make impacts irrelevant.
6. The player should be able to finish a normal race with 60 percent damage.
7. Critical damage should feel tense, not arbitrary.
