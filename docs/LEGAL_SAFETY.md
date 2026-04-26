# Legal Safety

Canonical content-safety catalogue for VibeGear2. This document is the single
source of truth for what kinds of art, audio, names, and track data are safe
to ship from this repository, what kinds are not, and how to escalate the
ambiguous cases. Other contributor docs (`CONTRIBUTING.md`, `MODDING.md`)
cross-link here rather than duplicate the rules below.

## 1. Purpose and audience

Every contributor MUST read this file before submitting art, audio, track
data, or any non-trivial code that resembles existing copyrighted material.
The patterns below are the maintainer's baseline. Ambiguous cases get the
`legal-review` label and a discussion before merge. If you are uncertain
whether something belongs in the safe column or the unsafe column, default to
unsafe and ask in the PR.

This document complements the licence files:

- [`LICENSE`](../LICENSE) (MIT) for source code.
- [`ASSETS-LICENSE`](../ASSETS-LICENSE) (CC BY 4.0 default) for original art,
  sprites, sound effects, and music.
- `DATA-LICENSE` (CC BY-SA 4.0 default) for track and community data when
  that file lands in the licence-files slice; until then, track JSON contributed
  to this repository is licensed CC BY-SA 4.0 by convention per GDD section 26.

## 2. The IP perimeter (binding)

VibeGear2 is a spiritual successor per GDD sections 1 and 2. It must not
reuse, paraphrase, or evoke recognisably:

- Top Gear 2 game data, ROM dumps, sprites, palette, audio rips, FM banks,
  music tracks, level layouts, splash screens, fonts, or UI.
- Top Gear, Top Gear Rally, or Top Gear (BBC) trademarks, names, slogans, or
  livery.
- Real-world car manufacturers' trademarks, model names, badges, or
  distinctive silhouettes. Use original car shapes and original names.
- Real-world racing-circuit names, logos, or trackside-advertiser brands.
  Paraphrase corner geometry only at the abstract level; never reuse names.

The perimeter is binding. A PR that crosses it will not merge regardless of
how compelling the rest of the slice is. The narrow path from "inspired by"
to "infringing" is short, and the maintainer will prefer to revert and ask
for a redraw rather than ship a borderline asset.

## 3. Safe content patterns

The following patterns are safe to ship without escalation, provided the
asset manifest entry is filled in correctly per section 6.

- Pixel art drawn from scratch by the contributor, even if the style is a
  homage to 16-bit racers.
- Audio recorded by the contributor, with a release statement in the
  originality field.
- CC0, CC BY 4.0, or CC BY-SA 4.0 third-party assets, with provenance
  documented in the asset manifest (source URL, attribution string, licence).
- Track geometry hand-authored in the dev track editor or written as JSON,
  even if the contributor's mental model is a paraphrase of a real circuit's
  general layout. Corner sequence at the abstract level is not protectable.
- Original car names that do not collide with real manufacturers. Examples:
  "Apex Coupe", "Sparrow GT", "Ironwheel Hauler". Counter-examples to avoid:
  "Skyline", "Mustang", "Civic".
- "Inspired-by" car silhouettes that depart in proportion, hood length,
  light arrangement, and badge from any real car. Reskinning a recognisable
  silhouette is unsafe even if the colours change.
- Synth music written from scratch by the contributor in any DAW, with the
  project file or stems retained as proof of authorship if challenged.

## 4. Unsafe content patterns

The following patterns will be rejected at PR review and reverted on `main`
if they slip through.

- ROM-extracted sprites, palettes, or audio from any Top Gear release, or
  any other commercial title.
- Music tracks that recreate the melody, harmony, instrumentation, or
  distinctive synth voicing of a copyrighted song. Soundalikes are unsafe
  even when not bit-for-bit copies; the test is whether a reasonable listener
  would mistake the contribution for the source.
- Traced or auto-vectorised silhouettes of real cars or in-game cars from
  another title. Photo references are fine; a tool that converts the
  reference into a sprite is not.
- Sample packs without explicit licence URLs, with vague "free for use"
  claims and no provenance, or with "personal use only" terms (which exclude
  redistribution under MIT or CC BY 4.0).
- Reference screenshots from other games embedded in repo files, issues,
  wiki, or documentation. Use a hand-drawn diagram or a text description
  instead. This rule applies to PR descriptions and chat threads as well.
- Sound effects extracted from Top Gear 2 (engine, brake, crash, menu blip,
  countdown beep) or any other commercial title.
- Fonts under non-permissive licences. Roboto and Inter from Google Fonts
  are fine. Bitmap fonts ripped from a SNES game are not.
- Track names that match real circuits. Replace any of the following with a
  paraphrase: Nurburgring, Spa, Suzuka, Monza, Silverstone, Imola, Estoril,
  Le Mans, Monaco, Daytona, Indianapolis. Acceptable paraphrases follow the
  geographic flavour without naming the venue: "North Loop", "Hill Forest",
  "Twin Bridges", "Coast Road".

## 5. The grey zone (escalate)

The following patterns are case-by-case. Apply the `legal-review` label and
discuss in the PR before merging.

- "Looks like" art where the contributor swears it is original. Maintainer
  may request proof of authorship: the source PSD with layers, the
  AI-generation log with prompt, a photo of the sketch, or the timestamps in
  the contributor's local Aseprite history.
- Procedural music that has only a passing resemblance to a copyrighted
  theme. Maintainer may ask for the stems archive and the generation seed or
  log so the resemblance can be traced.
- Track JSON imported from another open-source racer under a permissive
  licence. Verify the source licence is compatible (CC BY 4.0 or CC BY-SA
  4.0 inbound is fine; non-commercial-only is not). Document the source in
  the asset manifest and attribute in the file header.
- Real-world product placement, including trackside billboards with a real
  brand. Always reject. Replace with a fictional brand authored by the
  contributor.
- Composer-style names ("track inspired by composer X"). The name is unsafe
  even if the music is original; rename without referencing the composer.

## 6. Provenance and asset manifest

Every binary contribution (image, audio, font) requires an entry in the
asset manifest. The manifest format and validation is owned by the
licence-files slice and the asset preload system; cross-reference
[`ASSETS-LICENSE`](../ASSETS-LICENSE) for the SPDX values the manifest
accepts and `src/asset/preload.ts` for the runtime enforcement.

Required fields per entry:

- `id` (kebab-case slug).
- `path` (relative to `public/`).
- `kind` (image, audio, font).
- `license` (one of `CC-BY-4.0`, `CC-BY-SA-4.0`, `CC0-1.0`, `public-domain`,
  or another SPDX value documented in `ASSETS-LICENSE`).
- `source` (URL, citation, or "original by <contributor handle>").
- `originality` (one to two sentences; see section 7).
- `date` (ISO date the asset was added or last revised).

The asset preload loader rejects any manifest entry that omits a required
field. The content lint script (section 9) cross-checks the manifest against
the files in `public/` so an orphan asset cannot ship.

## 7. Originality statement guidance

An acceptable originality statement is specific, dated, and falsifiable.
Examples:

- "All sprites in `public/art/cars/coupe/` drawn by me in Aseprite from
  scratch on 2026-04-25; reference: my own photographs of toy cars."
- "Engine loop in `public/audio/sfx/engine-loop.ogg` recorded by me on a
  Yamaha synthesizer on 2026-04-12; project file retained."
- "Track JSON `tracks/coast-road.json` hand-authored in the dev editor on
  2026-04-20; corner sequence inspired by a generic coastal highway, no real
  circuit referenced."

Unacceptable patterns:

- Silent borrowing (no statement at all).
- Hedge phrases like "I think this is original" or "probably fine".
- Missing date or missing source.
- Statements that simply repeat the licence ("CC BY 4.0") without naming the
  author or origin.

When in doubt, write more, not less. The originality statement is the
contributor's signature on the safety claim; vague statements are reverted.

## 8. Enforcement: PR checklist

The PR checklist below is reproduced verbatim from
[`docs/CONTRIBUTING.md`](CONTRIBUTING.md) so this file is self-contained.
Maintainers gate merges on these box-tickers.

- [ ] Original work, or work with a compatible licence noted in the asset
      manifest.
- [ ] No Top Gear 2 assets, names, or soundalikes per the unsafe-pattern
      catalogue in section 4.
- [ ] Any third-party source documented in the asset manifest with the
      fields from section 6.
- [ ] All new content (data, schemas) passes `npm run verify`.
- [ ] No em-dashes or en-dashes in new files (project house style,
      `AGENTS.md` RULE 1).
- [ ] `PROGRESS_LOG.md` entry added if the slice is structural.

## 9. Enforcement: content lint

A future `scripts/content-lint.ts` script will run as part of `npm run
verify` and fail the build on any of the following:

- Any binary in `public/` that is missing an asset manifest entry.
- Any track JSON that references a real-circuit name from a denylist
  (Nurburgring, Spa, Suzuka, Monza, Silverstone, Imola, Estoril, Le Mans,
  Monaco, Daytona, Indianapolis; this list will grow).
- Any car name that matches a manufacturer denylist (Skyline, Mustang,
  Civic, Camaro, Supra, Lancer; this list will also grow).
- Any text content that matches a Top Gear denylist (`Top Gear`,
  `topgear`, `Kemco`, `Snowblind`, plus any future trademarks the
  maintainer adds).

The denylist examples here are illustrative. The authoritative list lives
in the lint script when it lands; this section sets the contract that the
script enforces. The follow-up to author the script is tracked in
[`FOLLOWUPS.md`](FOLLOWUPS.md) under a `nice-to-have` priority.

## 10. Enforcement: visual and audio review

For visible art changes, the maintainer runs the dev server and inspects
the asset alongside any reference cited in the manifest. For audio, the
maintainer plays the stems back alongside any cited reference. The bar is:
"would a reasonable person mistake this for the cited reference?" If yes,
reject and ask for a revision.

The reviewer does NOT need to be a copyright lawyer to apply this test.
The standard is plain-language similarity, not legal analysis. A close call
gets the `legal-review` label and a discussion thread.

## 11. Escalation: the `legal-review` label

Any maintainer or contributor may apply the `legal-review` label to a PR
or issue. While the label is on, the PR is blocked from merge regardless of
CI status.

Resolution paths:

- Maintainer resolves with a written explanation in the PR thread (citing
  the safe-pattern bucket the contribution falls into) and removes the
  label.
- Maintainer asks the contributor to revise; once the revision lands and
  the maintainer is satisfied, the label is removed.
- Maintainer rejects the contribution; the PR is closed and the rejection
  reason is recorded in the PR thread.

Removing the label without a written rationale is not allowed. The label
exists to slow down merges that need a second look; bypassing it defeats
the purpose.

## 12. Escalation: take-down requests

If a third party claims infringement against an asset shipped from this
repository, the maintainer team's protocol:

1. Acknowledge the claim within 72 hours through the contact channel where
   it arrived.
2. Revert the contested asset on `main` immediately. Do not wait for
   discussion.
3. Open a `legal-review` issue capturing the claim, the asset id, the PR
   that introduced the asset, and the contributor.
4. Restore only after a written justification is recorded in the issue and
   the maintainer is satisfied.
5. Document the date and outcome in [`FOLLOWUPS.md`](FOLLOWUPS.md) for the
   audit trail. Mark the entry `done` once resolved; never delete.

Speed of revert matters more than getting the legal analysis right on the
first pass. A reverted asset can always be restored; an unresolved claim
cannot be undone.

## 13. Issues, wiki, and documentation

The unsafe-pattern catalogue applies everywhere in this repository, not
just to merged PRs. Specifically:

- No fan-rip assets in issue attachments, wiki pages, or PR descriptions.
- No reference screenshots from other games. Describe the reference in
  text or hand-draw a diagram.
- No music or audio attachments from copyrighted sources, even as "for
  reference" links. Cite the title and timestamp in text instead.

Maintainers will edit issues and PR descriptions to remove offending
attachments and leave a comment explaining the edit. Repeat offences may
result in contributor moderation under the project's code of conduct (when
that document lands).

## 14. Updating this document

Changes to LEGAL_SAFETY.md require maintainer review. The `legal-review`
label automatically gates merges of PRs that touch this file. Every change
to this document also requires a `PROGRESS_LOG.md` entry citing the rule
change so the audit trail is preserved.

## References

- [`docs/gdd/26-open-source-project-guidance.md`](gdd/26-open-source-project-guidance.md)
  for the canonical project-guidance rules.
- [`docs/gdd/27-risks-and-mitigations.md`](gdd/27-risks-and-mitigations.md)
  for the legal and IP drift risk this document mitigates.
- [`docs/gdd/01-title-and-high-concept.md`](gdd/01-title-and-high-concept.md)
  and
  [`docs/gdd/02-spiritual-successor-boundaries.md`](gdd/02-spiritual-successor-boundaries.md)
  for the IP perimeter.
- [`docs/CONTRIBUTING.md`](CONTRIBUTING.md) for the full contributor
  workflow that this checklist is part of.
- `docs/MODDING.md` for the modder-facing version of these rules; that
  file lands in the modding-md slice.
