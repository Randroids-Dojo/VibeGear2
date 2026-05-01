# Release Media

The v1.0 release needs a small screenshot pack and a short trailer source
clip. These files are generated artifacts and stay out of git.

## Capture

Run a production build locally, then capture media from that build:

```bash
npm run build
npm run start
RELEASE_MEDIA_BASE_URL=http://127.0.0.1:3000 npm run release:media
```

The script writes `artifacts/release-media/manifest.json`, screenshots under
`artifacts/release-media/screenshots/`, and a WebM race-play clip under
`artifacts/release-media/trailer/`.

Set `RELEASE_MEDIA_OUT` only to a child directory under `artifacts/`.
The script rejects other paths before deleting or recreating output.

## Required Screenshots

The screenshot pack must include:

- Title screen.
- World Tour hub.
- Live race canvas.
- Garage.
- Time Trial.
- Options.

Each capture uses a 1280 x 720 viewport so store listings and README embeds
can crop from a consistent source.

## Trailer Source

The trailer source clip is a short practice-race drive recorded from the same
production build. Edit the generated WebM externally for the final public
trailer. The repo should not commit edited exports unless the file size,
licence, and hosting target are approved in the release PR.

## Release Checklist

- Capture from the exact tagged build or production URL being announced.
- Keep the generated `manifest.json` with the release evidence.
- Verify screenshots do not show debug overlays, local paths, or private data.
- Verify the trailer uses original game audio or intentionally muted audio.
- Link the artifact location from the release PR or tag notes.
