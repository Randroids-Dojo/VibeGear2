import { CARS, TRACK_IDS, TRACK_RAW } from "@/data";
import { TrackSchema, type CarClass } from "@/data/schemas";
import type { DailyChallengeTrack } from "@/game/modes/dailyChallenge";

import { DailyChallengePanel } from "./DailyChallengePanel";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default function DailyChallengePage() {
  return (
    <main className={styles.main} data-testid="daily-page">
      <DailyChallengePanel
        tracks={bundledDailyTracks()}
        carClasses={bundledCarClasses()}
        initialDateIso={new Date().toISOString()}
      />
    </main>
  );
}

function bundledDailyTracks(): DailyChallengeTrack[] {
  return TRACK_IDS.filter((id) => !id.startsWith("test/")).map((id) => {
    const parsed = TrackSchema.parse(TRACK_RAW[id]);
    return {
      id,
      weatherOptions: parsed.weatherOptions,
    };
  });
}

function bundledCarClasses(): CarClass[] {
  const seen = new Set<CarClass>();
  for (const car of CARS) seen.add(car.class);
  return [...seen];
}
