---
title: "research: licence selection for code and assets (Q-002)"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T00:56:02.305193-05:00\\\"\""
closed-at: "2026-04-26T01:22:24.219661-05:00"
close-reason: "Q-002 resolved: MIT (code), CC BY 4.0 (assets), CC BY-SA 4.0 (data); created implement-licence-files-a7c7b931 plus follow-up dots for LEGAL_SAFETY, CONTRIBUTING, MODDING."
---

Resolve Q-002. Compare MIT vs Apache-2.0 vs BSD-2 for code; CC0 vs CC-BY-4.0 vs CC-BY-SA-4.0 for assets. Output: implement: dot to land LICENSE and ASSETS-LICENSE files at repo root.

## Findings

### Inputs reviewed
- GDD §1 (high concept): "16-bit arcade pressure with modern readability and open-source extensibility." Pillar: "retro presentation, original content."
- GDD §26 (open source guidance): code under MIT or Apache-2.0; original art under CC BY 4.0 or CC0; original music/SFX under CC BY 4.0 with stems archived; track/community data under CC BY-SA 4.0 or project-compatible data licence. Mod manifests must include author + licence + originality statement. LEGAL_SAFETY.md is called out as a designated artefact.
- GDD §18 (audio): prefers CC0 / CC BY material with attribution tracking; never include "temporary homage" music.
- GDD §27 (risks): legal/IP drift mitigated via contribution rules + originality checklist + content linting.
- WORKING_AGREEMENT.md §11: changing the licence after it lands is an irreversible action gated on dev confirmation. Publishing assets under a not-yet-approved licence is also gated.
- OPEN_QUESTIONS.md Q-002: standing recommendation is MIT for code, CC-BY-4.0 for assets; LICENSE + ASSETS-LICENSE files at repo root. Blocking before public release, not blocking for early implementation.
- Repo state: package.json has no `license` field; no LICENSE / ASSETS-LICENSE / LEGAL_SAFETY.md / CONTRIBUTING.md / MODDING.md exist yet.

### Decision: code licence = MIT
Rationale (anchored to GDD §1 pillar "open-source extensibility" + §26 short-listing MIT or Apache-2.0):
- Maximises drop-in reuse by mod authors and downstream forks. MIT is the most-permissive of the GDD-allowed pair and the most familiar to JS/TS contributors (Next.js, React, Zod, Vitest, Playwright are MIT-class). No surprises for first-time contributors.
- Apache-2.0 adds an explicit patent grant and a NOTICE-file requirement. Patent risk on a 16-bit-style arcade racer with no novel algorithms is effectively zero, and NOTICE files add ceremony for a small contributor pool. Reject Apache-2.0 on simplicity grounds, not safety grounds.
- BSD-2 was listed in the dot but is not in §26's short list. Reject as out-of-scope for the GDD-sanctioned options. (Also: functionally near-identical to MIT, no upside.)
- One licence covers all of `src/` plus generated build artefacts plus the `docs/gdd/` markdown tree (prose, not assets). Authoritative GDD prose is fine under MIT alongside the code.

### Decision: original art + music/SFX licence = CC BY 4.0 (single asset licence file)
Rationale (anchored to GDD §26 row 2-3 + §18 attribution guidance):
- CC BY 4.0 keeps attribution required (matches §26 + §18 "attribution tracking") while allowing remix and redistribution. Crucial for mod packs that bundle official art + custom art in the same archive.
- CC0 is rejected because it removes the attribution chain that §18 explicitly wants, and because contributors who later disagree have no recourse. CC0 is also not universally recognised in some jurisdictions (e.g. Germany) for relinquishing all rights, which adds risk to a community-contribution pipeline.
- CC-BY-SA 4.0 is rejected for art/music because share-alike forces every downstream mod that mixes official art with the mod's own art into CC-BY-SA, which conflicts with the §26 mod manifest model that lets each mod declare its own licence. Save CC-BY-SA for the data-only case below.
- Single CC BY 4.0 file covers `public/art/`, `public/audio/`, and any future sprite/sound packs in `assets/`. Stems archive lives under the same licence; mention in the file that stems are stored alongside renders.

### Decision: track + community data licence = CC BY-SA 4.0
Rationale (anchored to §26 row 4):
- Track JSON, AI profile JSON, and tour JSON encode community-curated balance + line-of-sight that we want to keep open. CC-BY-SA forces forks of community data to remain re-usable upstream, which is the pattern §26 calls "project-compatible data licence."
- Keeping data SA-licensed while art/audio is BY-only is intentional. Data is high-leverage (one balance pass benefits everyone); art is low-leverage per-asset (one sprite redraw is local). The asymmetry is deliberate, not an oversight.
- Implementation will live in a third file (`DATA-LICENSE`) at repo root, scoped to `src/data/**` and `public/mods/**`. This is consistent with the user's note that `data-schemas` is in flight (don't touch `src/data/`); the licence file does not require touching schemas.

### Decision: file layout + package.json
- Create three files at repo root, all plain markdown, plain text where the licence body is verbatim:
  - `LICENSE` (verbatim MIT text, with copyright line "Copyright (c) 2026 VibeGear2 contributors").
  - `ASSETS-LICENSE` (verbatim CC BY 4.0 deed + summary scope: "Applies to original art, music, and SFX under `public/art/`, `public/audio/`, and `assets/`. Third-party assets keep their upstream licence and are tracked in the asset manifest.").
  - `DATA-LICENSE` (verbatim CC BY-SA 4.0 deed + summary scope: "Applies to track, AI profile, tour, and balance JSON under `src/data/**` and `public/mods/**`.").
- Add `"license": "MIT"` to `package.json`. SPDX expression `MIT` is correct because npm's `license` field is for the code, not bundled assets.
- README.md gets a short "Licensing" section linking the three files. No new licence in commit messages or PR bodies; the LICENSE file is authoritative.

### Decision: LEGAL_SAFETY.md content sketch (separate slice)
- §26 calls out a designated `LEGAL_SAFETY.md`. This is distinct from the licence files. Defer to a follow-up implement dot to keep the licence slice scoped to one PR per RULE 4.
- Skeleton: safe pattern examples (original sprite, contributor-recorded stems, paraphrased corner names), unsafe pattern examples (Top Gear 2 ROM rip, soundalike of a copyrighted track, traced car silhouette), enforcement (PR checklist + content lint), escalation (legal-review label).

### Decision: contribution paperwork
- No CLA. The MIT inbound = outbound contribution model (per-commit DCO-style sign-off via `Signed-off-by:` footer is optional, not required) is consistent with §26's lightweight contribution rules. Re-licensing requires unanimous contributor consent, which is acceptable risk at this scale and matches WORKING_AGREEMENT.md §11's "irreversible without dev confirmation" treatment of licence changes.
- CONTRIBUTING.md (not in scope of this dot) will reference the three licence files and the originality checklist from §26.

### Risks accepted
- Licence change requires contributor consent. Mitigated by landing the licence files before the first external contribution.
- CC BY 4.0 attribution must be preserved when assets are bundled into mods. Mitigated by mod manifest schema (separate slice) requiring an `attribution` field.
- CC-BY-SA on data may surprise mod authors who expect everything to be MIT/BY. Mitigated by README.md "Licensing" section and MODDING.md (separate slice) calling out the asymmetry up front.

### Resolves Q-002
Status flips to `answered` in `docs/OPEN_QUESTIONS.md` when the implement dot lands the licence files. The implement dot writes the OPEN_QUESTIONS update in the same PR.

### Implement dot to create
`implement: licence files (LICENSE, ASSETS-LICENSE, DATA-LICENSE) + package.json licence field + README licensing section + Q-002 resolution`. Created below.
