import type { Championship, SaveGame } from "@/data/schemas";

export function unlockedChampionshipTrackIds(
  save: SaveGame,
  championship: Championship,
): readonly string[] {
  const firstTourId = championship.tours[0]?.id;
  const unlocked = new Set(save.progress.unlockedTours);
  if (firstTourId) unlocked.add(firstTourId);
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const tour of championship.tours) {
    if (!unlocked.has(tour.id)) continue;
    for (const trackId of tour.tracks) {
      if (seen.has(trackId)) continue;
      seen.add(trackId);
      ids.push(trackId);
    }
  }
  return ids;
}
