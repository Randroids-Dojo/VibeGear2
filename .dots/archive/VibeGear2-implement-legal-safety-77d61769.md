---
title: "implement: LEGAL_SAFETY.md per GDD §26"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"\\\\\\\"2026-04-26T01:22:14.678826-05:00\\\\\\\"\\\"\""
closed-at: "2026-04-26T06:31:54.519389-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-licence-files-a7c7b931
---

## Description

Author `docs/LEGAL_SAFETY.md`: the canonical catalogue of safe and unsafe content patterns for VibeGear2, the enforcement surface (PR checklist + content lint), and the escalation path for ambiguous cases (the `legal-review` label).

## Context

GDD §26 ("Open source project guidance") explicitly names `LEGAL_SAFETY.md` as a designated artefact and lists the high-level rules:

- No "temporary borrowed art".
- No sample packs with unclear provenance.
- No fan rip assets in issues, wiki, or docs.
- No reference screenshots embedded in the repo unless documentation requires them.

The licence research (`.dots/archive/VibeGear2-research-licence-selection-4086fb7d.md` §"LEGAL_SAFETY.md content sketch") provides a binding skeleton:

> Safe pattern examples (original sprite, contributor-recorded stems, paraphrased corner names), unsafe pattern examples (Top Gear 2 ROM rip, soundalike of a copyrighted track, traced car silhouette), enforcement (PR checklist + content lint), escalation (legal-review label).

GDD §27 ("Risks and mitigations") names legal/IP drift as a primary risk; LEGAL_SAFETY.md is the mitigation document.

GDD §1 ("Title and high concept") and §2 ("Spiritual successor boundaries") set the IP perimeter: VibeGear2 is a *spiritual successor* — it must not reuse Top Gear 2 trademarks, asset rips, soundtrack, level layouts, character names, or recognisable car silhouettes. This dot turns that perimeter into a checklist contributors can apply at PR time.

This is the single source of truth for content safety; `CONTRIBUTING.md` (separate dot) cross-links here rather than duplicating. Depends on `implement-licence-files-a7c7b931` so the licence file paths and SPDX names are pinned.

## Affected Files

- `docs/LEGAL_SAFETY.md` (new): the document, sections per the outline below.
- `README.md` (existing): add a one-line link "Legal safety: see docs/LEGAL_SAFETY.md" if not already present from the licence-files slice.

## Document outline (binding)

1. **Purpose and audience.** One-paragraph mission: "Every contributor MUST read this before submitting art, audio, track data, or any non-trivial code that resembles existing copyrighted material. The patterns below are the maintainer's baseline; ambiguous cases get the `legal-review` label and a discussion before merge."
2. **The IP perimeter (binding).** Reproduce the GDD §1 §2 perimeter: VibeGear2 must NOT reuse, paraphrase, or evoke recognisably:
   - Top Gear 2 game data, ROM dumps, sprites, palette, audio rips, FM banks, music tracks, level layouts, splash screens, fonts, or UI.
   - Top Gear / Top Gear Rally / Top Gear (BBC) trademarks, names, slogans, livery.
   - Real-world car manufacturers' trademarks, model names, badges, or distinctive silhouettes (use original car shapes, original names).
   - Real-world racing-circuit names, logos, or trackside-advertiser brands (paraphrase corner geometry only, never names).
3. **Safe content patterns (with examples).**
   - Pixel art drawn from scratch by the contributor, even if "in the style of" 16-bit racers.
   - Audio recorded by the contributor with a release statement.
   - CC0 / CC BY 4.0 / CC BY-SA 4.0 third-party assets, with provenance documented in the asset manifest.
   - Track geometry hand-authored in `/dev/track-editor` or written as JSON, even if the contributor's mental model is a paraphrase of a real circuit's general layout (corner sequence at the abstract level is not protectable).
   - Original car names that do not collide with real manufacturers (e.g. "Apex Coupe", not "Skyline").
   - "Inspired-by" car silhouettes that depart in proportion, hood length, lights, and badge from any real car.
4. **Unsafe content patterns (with examples).**
   - ROM-extracted sprites, palettes, or audio from any Top Gear release.
   - Music tracks that recreate the melody, harmony, instrumentation, or distinctive synth voicing of a copyrighted song. "Soundalikes" are unsafe even if not bit-for-bit copies.
   - Traced or auto-vectorised silhouettes of real cars or in-game cars from another title.
   - Sample packs without explicit licence URLs, with "free for use" claims and no provenance, or with ambiguous "personal use only" terms.
   - Reference screenshots from other games embedded in repo files, issues, wiki, or docs (use a hand-drawn diagram or text description instead).
   - Sound effects extracted from Top Gear 2 (engine, brake, crash) or any other commercial title.
   - Fonts under non-permissive licences (e.g. Google's Roboto is OK; bitmap fonts ripped from a SNES game are not).
   - Track names that match real circuits ("Nürburgring", "Spa", "Suzuka" — paraphrase: "North Loop", "Hill Forest", "Twin Bridges").
5. **The grey zone (escalate).** Patterns that are case-by-case:
   - "Looks like" art where the contributor swears it is original. Maintainer requests proof of authorship (PSD layers, AI-generation log with prompt, photo of the sketch).
   - Procedural music that has only a passing resemblance to a copyrighted theme. Maintainer asks for a stems archive and the generation seed/log.
   - Track JSON imported from another open-source racer under a permissive licence. Verify the source licence, document in asset manifest, attribute in the file.
   - Real-world product placement ("billboard with a 'real' brand"). Always reject; replace with a fictional brand.
6. **Provenance and asset manifest.** Every binary contribution (image, audio, font) requires an asset manifest entry: source URL or "original by <contributor>", licence (SPDX), originality statement (1-2 sentences), date. The licence-files slice ships the asset manifest format; this section cross-links there.
7. **Originality statement guidance.** What an acceptable originality statement looks like ("All sprites in `public/art/cars/coupe/` drawn by me in Aseprite from scratch, 2026-04-25; reference: my own photographs of toy cars."). Unacceptable patterns (silent-borrowed assets, hedge phrases like "I think this is original", missing dates, missing source).
8. **Enforcement: PR checklist.** Reproduce the box-tickers from `CONTRIBUTING.md` (which itself reads from this dot) so this file remains self-contained. Maintainers gate merges on the checklist.
9. **Enforcement: content lint.** Reference `scripts/content-lint.ts` (out of scope for this dot; to be authored alongside the asset manifest in a follow-up). Behaviour expected: fail the build if (a) any binary in `public/` is missing a manifest entry, (b) any track JSON references a real-circuit name from a small denylist (`nurburgring`, `spa`, `suzuka`, `monza`, `silverstone`, `imola`, `estoril`, etc.), (c) any car name matches a manufacturer denylist, (d) any text content matches a "Top Gear" denylist. Add a follow-up dot for the content lint when this dot lands; this section is the contract.
10. **Enforcement: visual / audio review.** For visible art changes the maintainer runs the dev server and inspects the asset alongside any reference shipped in the manifest. For audio, the maintainer plays back stems alongside any cited reference. The bar is "would a reasonable person mistake this for the cited reference"; if yes, reject.
11. **Escalation: the `legal-review` label.** Any maintainer or contributor may apply `legal-review` to a PR or issue. While that label is on, the PR is blocked from merge regardless of CI status. Resolution: maintainer either resolves with a written explanation in the PR thread, or asks the contributor to revise.
12. **Escalation: take-down requests.** If a third party claims infringement, the maintainer team's protocol: (a) acknowledge within 72 hours, (b) revert the contested asset on `main` immediately, (c) open a `legal-review` issue, (d) restore only after written justification. Document the date and outcome in `FOLLOWUPS.md` for the audit trail.
13. **Issues, wiki, and docs.** No fan-rip assets in issues, wiki, screenshots, or PR descriptions. Reference screenshots from other games are forbidden; describe in text or hand-draw a diagram.
14. **Updating this document.** Changes to LEGAL_SAFETY.md require maintainer review and a `PROGRESS_LOG.md` entry citing the rule change. The `legal-review` label gates merges of PRs that touch this file.

## Edge Cases

- The doc must NOT include any em-dashes or en-dashes (`grep -P "[–—]" docs/LEGAL_SAFETY.md` returns nothing).
- The doc must NOT itself include reference screenshots from other games (per its own §13).
- Denylist examples in §9 must be illustrative, not exhaustive; the actual lint denylist lives in code and may grow.
- If `docs/CONTRIBUTING.md` is not yet authored when this dot lands, the cross-references in §8 are forward links; that is acceptable.
- Do not name any specific real driver, current Formula 1 team, or current racing organisation in the document, even as a "do not use" example. Use generic placeholders like "any real-world racing-circuit name".

## Verify

- [ ] `docs/LEGAL_SAFETY.md` exists with all 14 sections from the outline.
- [ ] Cross-links to `LICENSE`, `ASSETS-LICENSE`, `DATA-LICENSE`, `CONTRIBUTING.md`, `MODDING.md`, `GDD.md` resolve at write-time (forward links to as-yet-unwritten siblings are acceptable).
- [ ] No em-dashes or en-dashes anywhere in the file.
- [ ] `README.md` legal-safety one-liner present.
- [ ] No reference screenshots or images embedded in the file.
- [ ] `npm run verify` is green (no behavioural change).
- [ ] PROGRESS_LOG.md entry added per WORKING_AGREEMENT §6.
- [ ] `FOLLOWUPS.md` gets a new `nice-to-have` entry for the future content-lint script (`scripts/content-lint.ts`).

## References

- `.dots/archive/VibeGear2-research-licence-selection-4086fb7d.md` §"LEGAL_SAFETY.md content sketch".
- `docs/gdd/26-open-source-project-guidance.md` §"Avoiding IP contamination", §"Suggested issue labels".
- `docs/gdd/01-title-and-high-concept.md`, `docs/gdd/02-spiritual-successor-boundaries.md` (the IP perimeter).
- `docs/gdd/27-risks-and-mitigations.md` (legal/IP drift as a primary risk).
