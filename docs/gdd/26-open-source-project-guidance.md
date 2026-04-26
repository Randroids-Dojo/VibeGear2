# 26. Open source project guidance

## Suggested licenses

| Asset type | Recommended license |
| --- | --- |
| Code | MIT or Apache-2.0 |
| Original art | CC BY 4.0 or CC0 |
| Original music/SFX | CC BY 4.0 with stems archived |
| Track/community data | CC BY-SA 4.0 or project-compatible data license |

## Contribution guidelines

Every pull request should confirm:

- Original work or correctly licensed work.
- No copied Top Gear 2 assets, names, or soundalikes.
- Any third-party source is documented in the asset manifest.
- New content passes schema and lint checks.

## Modding and community rules

- Data mods only in official loader for v1.0.
- No executable plugins initially.
- All mod manifests require author, license, and originality statement.
- Public mod browser should reject trademark-risk content.

## Avoiding IP contamination

- No “temporary borrowed art.”
- No sample packs with unclear provenance.
- No fan rip assets in issues, wiki, or docs.
- No reference screenshots embedded in the repo if they are not necessary for documentation.
- Maintain a designated LEGAL_SAFETY.md with examples of safe and unsafe contribution patterns.

## Suggested issue labels

- physics
- renderer
- ai
- ui-ux
- audio
- modding
- content
- legal-review
- good-first-issue
- help-wanted
- performance
- bug
- design

## Suggested project structure

```
/docs
  GDD.md
  LEGAL_SAFETY.md
  CONTRIBUTING.md
  MODDING.md

/src
  app/
  game/
  road/
  render/
  audio/
  data/

public/
  art/
  audio/
  mods/
```
