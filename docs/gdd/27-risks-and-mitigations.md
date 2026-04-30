# 27. Risks and mitigations

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Legal/IP drift | Fan projects often get contaminated by homage shortcuts | Strong contribution rules, originality checklist, content linting |
| Scope creep | Track count and art production can explode | Lock v1.0 at 32 tracks and 6 cars |
| Browser performance | Pseudo-3D plus sprites can still choke weaker devices | Adjustable draw distance, sprite density, pixel ratio caps |
| Physics feel | Arcade racers live or die on feel | Fixed-step sim, tight prototyping, replayable benchmark tracks |
| AI frustration | Rubber banding and collisions can feel unfair | Light rubber banding, visible AI archetypes, deterministic tuning |
| Asset burden | Region variety demands lots of content | Palette-driven reuse, modular prop kits, background layering |
| Community moderation | Open mods can invite unsafe uploads | Manual curation, manifest requirements, report tools |
| Cross-tab save corruption | Two open tabs of the deployed build can each persist the same `SaveGame` and clobber the other | Last-write-wins with a monotonic `writeCounter` advisory plus a `storage` event listener and `focus` revalidate per `docs/gdd/21-technical-design-for-web-implementation.md` "Cross-tab consistency" |
| User-reported client crashes | A browser-specific render or input crash can be hard for the dev to reproduce from a screenshot alone | In-memory opt-in client error capture with a hidden `?errors=1` panel and copyable error report. No telemetry or network sink is enabled by default |
