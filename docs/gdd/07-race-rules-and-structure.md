# 7. Race rules and structure

### Starting grid

- Default field size: 12 racers in championship and quick race.
- Grid rule: first race of a tour seeds the player mid-pack, such as 7th.
- Later races seed by current aggregate standings, with tie-breaks on best finish then fastest lap.

This is intentionally smaller than the likely opponent density remembered from the SNES game, because browser readability and solo-dev AI scope matter more than strict mimicry.

### Number of laps

| Track archetype | Lap target |
| --- | --- |
| Short sprint | 4 to 5 laps |
| Standard circuit | 3 laps |
| Long scenic | 2 laps |
| Final-tour endurance | 2 to 3 long laps |

### Qualification and advancement

- Top 8 finishers score points.
- After four races, the top 4 drivers in tour standings advance.
- Difficulty can tune this to top 5 on easy, top 4 on normal, top 3 on hard.

### Fail states

A player fails or must retry a tour only if one of the following happens:

- Does not place high enough overall after all four races.
- Car damage reaches catastrophic state and the player chooses to retire.
- Optional hard mode: three DNFs in one tour.

### Retry flow

- Standard mode: retry current race without resetting tour economy once per race.
- Easy mode: unlimited race retries.
- Hard mode: no retry, only restart tour.

### Finish rewards

Rewards are based on finishing place, difficulty, and track grade.

### Tie handling

Standings tie-breaks:

- Best single-race finish.
- Fastest lap in tour.
- Lowest total repair spend.
- Earliest unlock order as deterministic fallback.
