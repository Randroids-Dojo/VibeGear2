# 7. Race rules and structure

## Starting grid

- Default field size: 12 racers in championship and quick race.
- Grid rule: first race of a tour seeds the player mid-pack, such as 7th.
- Later races seed by current aggregate standings, with tie-breaks on best finish then fastest lap.

This is intentionally smaller than the likely opponent density remembered from the SNES game, because browser readability and solo-dev AI scope matter more than strict mimicry.

## Number of laps

| Track archetype | Lap target |
| --- | --- |
| Short sprint | 4 to 5 laps |
| Standard circuit | 3 laps |
| Long scenic | 2 laps |
| Final-tour endurance | 2 to 3 long laps |

## Qualification and advancement

- Top 8 finishers score points.
- After four races, the top 4 drivers in tour standings advance.
- Difficulty can tune this to top 5 on easy, top 4 on normal, top 3 on hard.

## Fail states

A player fails or must retry a tour only if one of the following happens:

- Does not place high enough overall after all four races.
- Car damage reaches catastrophic state and the player chooses to retire.
- Optional hard mode: three DNFs in one tour.

## Retry flow

- Standard mode: retry current race without resetting tour economy once per race.
- Easy mode: unlimited race retries.
- Hard mode: no retry, only restart tour.

## Finish rewards

Rewards are based on finishing place, difficulty, and track grade.

## Tie handling

Standings tie-breaks:

- Best single-race finish.
- Fastest lap in tour.
- Lowest total repair spend.
- Earliest unlock order as deterministic fallback.

### Build log

- 2026-05-06: Bumped `laps` from 1 to the section 7 archetype target across all 32 production track JSONs. short-sprint -> 4 (4 tracks), standard -> 3 (18 tracks), long-scenic -> 2 (6 tracks), endurance -> 2 (4 tracks). Test and benchmark fixtures stay at laps=1. Closes the pain-point-1 collapse where every race ran a single 30-50 second lap. Files: `src/data/tracks/*.json`, `src/data/__tests__/tracks-content.test.ts`, `src/game/__tests__/preRaceCard.test.ts`.
