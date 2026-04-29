# Modding

VibeGear2 v1.0 supports data-only mods. Mods can add or replace structured
content such as tracks, cars, upgrades, AI drivers, and championships. Mods
cannot run code, inject scripts, ship WebAssembly, or bypass the project data
schemas.

## Folder Layout

Official mod loading expects this shape:

```text
public/mods/<mod-id>/
  manifest.json
  tracks/*.json
  cars/*.json
  upgrades/*.json
  ai/*.json
  championships/*.json
```

The `<mod-id>` folder name must match `manifest.json` `id`.

The repository includes a tiny starter pack at
`public/mods/starter-sample/`. Use it as the reference for file layout,
manifest fields, and schema-valid track JSON.

## Manifest

Each mod must include `manifest.json`:

```json
{
  "id": "community-pack",
  "name": "Community Pack",
  "version": 1,
  "author": "A. Contributor",
  "license": "CC-BY-SA-4.0",
  "originality": "Original data authored from scratch for this project.",
  "data": {
    "tracks": ["tracks/harbor-day.json"]
  }
}
```

Allowed manifest licenses are `CC-BY-SA-4.0`, `CC-BY-4.0`, `CC0-1.0`, and
`public-domain`. Track, championship, balancing, and other community data
should use `CC-BY-SA-4.0` unless a maintainer approves another compatible
license.

## Validation

The loader and content lint enforce these rules:

- Manifest paths are relative to the mod folder.
- Paths cannot use URL schemes, absolute paths, backslashes, or `..`.
- Paths cannot reference executable file types such as JavaScript,
  TypeScript, HTML, or WebAssembly.
- Every referenced data file must exist.
- Track, car, upgrade, AI driver, and championship JSON must validate
  against `src/data/schemas.ts`.
- Data must pass the legal denylist checks in `scripts/content-lint.ts`.

## Legal Safety

Do not include copied game assets, real car badges, real track branding,
ripped audio, ROM data, unclear sample packs, or trademark-risk names. Public
mod-browser submissions must pass legal review before inclusion.

See [`docs/gdd/26-open-source-project-guidance.md`](gdd/26-open-source-project-guidance.md)
and [`LEGAL_SAFETY.md`](LEGAL_SAFETY.md) for the current source of truth.
