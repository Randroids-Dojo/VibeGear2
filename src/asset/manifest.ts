/**
 * Per-track asset manifest builder.
 *
 * Source of truth: `docs/gdd/21-technical-design-for-web-implementation.md`
 * (Asset pipeline + Audio pipeline). Each track declares the segments,
 * roadside sets, and weather options it uses; the manifest builder maps
 * those to concrete `AssetEntry` records that `preloadAll` can resolve.
 *
 * Critical vs non-critical:
 * - The track JSON is critical: without it the renderer has no segments to
 *   project. The player car sprite is critical: without it the player has
 *   nothing to draw at the bottom of the screen.
 * - Roadside sprite atlases and ambient audio are non-critical: missing a
 *   single environment atlas downgrades a roadside element to a placeholder
 *   colour but the race can still start.
 *
 * The mapping is intentionally deterministic so that two builds against the
 * same track JSON produce the same manifest in the same order. Phase 6's
 * golden-master tests will pin the manifest output for the canonical track
 * set so a change to the builder needs an explicit log entry.
 */

import type { Track, WeatherOption } from "@/data/schemas";

import type { AssetEntry, AssetManifest } from "./preload";

/**
 * Resolver hook. Production wires this to the bundler-emitted asset URLs
 * (`/assets/cars/sparrow-gt.png`); tests inject a deterministic resolver
 * so they do not depend on bundler output.
 */
export interface AssetUrlResolver {
  carSprite(carId: string): string;
  trackJson(trackId: string): string;
  roadsideAtlas(roadsideId: string): string;
  weatherAudio(weather: WeatherOption): string;
}

/**
 * Default resolver mirrors the layout in `public/assets/` once that ships.
 * Until the asset pipeline lands, the URLs are stable strings the loader
 * can attempt against; missing files surface as non-critical failures and
 * the race still mounts (per the manifest's critical / non-critical split).
 */
export const defaultAssetUrlResolver: AssetUrlResolver = {
  carSprite: (carId) => `/assets/cars/${carId}.png`,
  trackJson: (trackId) => `/assets/tracks/${trackId}.json`,
  roadsideAtlas: (roadsideId) => `/assets/roadside/${roadsideId}.png`,
  weatherAudio: (weather) => `/assets/audio/weather/${weather}.ogg`,
};

export interface ManifestForTrackInput {
  track: Track;
  /** Currently selected weather variant. Picks the matching audio track. */
  weather: WeatherOption;
  /** id of the player's active car. Sprite is critical. */
  playerCarId: string;
  /** ids of any AI cars on the grid. Their sprites are non-critical. */
  aiCarIds?: readonly string[];
  resolver?: AssetUrlResolver;
}

/**
 * Build the manifest for a single race. Order is stable: track JSON, player
 * car sprite, AI car sprites, unique roadside atlases (in segment order),
 * weather audio for the selected variant.
 */
export function manifestForTrack(input: ManifestForTrackInput): AssetManifest {
  const resolver = input.resolver ?? defaultAssetUrlResolver;
  const entries: AssetEntry[] = [];

  entries.push({
    id: `track:${input.track.id}`,
    kind: "json",
    src: resolver.trackJson(input.track.id),
    critical: true,
  });

  entries.push({
    id: `car:${input.playerCarId}`,
    kind: "image",
    src: resolver.carSprite(input.playerCarId),
    critical: true,
  });

  const aiIds = input.aiCarIds ?? [];
  for (const aiId of aiIds) {
    if (aiId === input.playerCarId) continue;
    entries.push({
      id: `car:${aiId}`,
      kind: "image",
      src: resolver.carSprite(aiId),
      critical: false,
    });
  }

  // Unique roadside atlases in segment order. Using a Set would lose the
  // deterministic order; a manual seen-set keeps order stable.
  const seenRoadside = new Set<string>();
  for (const segment of input.track.segments) {
    for (const roadsideId of [segment.roadsideLeft, segment.roadsideRight]) {
      if (seenRoadside.has(roadsideId)) continue;
      seenRoadside.add(roadsideId);
      entries.push({
        id: `roadside:${roadsideId}`,
        kind: "image",
        src: resolver.roadsideAtlas(roadsideId),
        critical: false,
      });
    }
  }

  entries.push({
    id: `audio:weather:${input.weather}`,
    kind: "audio",
    src: resolver.weatherAudio(input.weather),
    critical: false,
  });

  return {
    id: `track:${input.track.id}:${input.weather}`,
    entries,
  };
}
