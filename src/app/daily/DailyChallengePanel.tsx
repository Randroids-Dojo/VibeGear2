"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { CarClass } from "@/data/schemas";
import {
  dailyChallengeRaceHref,
  formatDailyChallengeShareText,
  selectDailyChallenge,
  type DailyChallengeTrack,
} from "@/game/modes/dailyChallenge";
import { weatherLabel } from "@/game/preRaceCard";

import { DailyShareButton } from "./DailyShareButton";
import styles from "./page.module.css";

interface DailyChallengePanelProps {
  readonly tracks: readonly DailyChallengeTrack[];
  readonly carClasses: readonly CarClass[];
  readonly initialDateIso: string;
}

export function DailyChallengePanel({
  tracks,
  carClasses,
  initialDateIso,
}: DailyChallengePanelProps) {
  const [selectionDate, setSelectionDate] = useState(
    () => new Date(initialDateIso),
  );

  useEffect(() => {
    setSelectionDate(new Date());
  }, []);

  const challenge = useMemo(
    () => selectDailyChallenge(selectionDate, tracks, carClasses),
    [carClasses, selectionDate, tracks],
  );
  const shareText = formatDailyChallengeShareText(challenge);
  const raceHref = dailyChallengeRaceHref(challenge);

  return (
    <section className={styles.shell} aria-labelledby="daily-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Daily Challenge</p>
        <h1 className={styles.title} id="daily-title">
          {challenge.dateKey}
        </h1>
        <p className={styles.summary}>
          Fixed track and weather for one UTC day, with a daily car class
          recommendation.
        </p>
      </header>

      <article className={styles.panel}>
        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>Track</dt>
            <dd data-testid="daily-track">{challenge.trackId}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Weather</dt>
            <dd data-testid="daily-weather">
              {weatherLabel(challenge.weather)}
            </dd>
          </div>
          <div className={styles.stat}>
            <dt>Recommended class</dt>
            <dd data-testid="daily-car-class">
              {formatCarClass(challenge.carClass)}
            </dd>
          </div>
          <div className={styles.stat}>
            <dt>Seed</dt>
            <dd data-testid="daily-seed">{challenge.seed}</dd>
          </div>
        </dl>

        <div className={styles.actions}>
          <Link
            className={styles.button}
            href={raceHref}
            data-testid="daily-start"
          >
            Start run
          </Link>
          <Link className={styles.secondary} href="/" data-testid="daily-back">
            Back to title
          </Link>
        </div>

        <div className={styles.share}>
          <DailyShareButton text={shareText} />
        </div>
      </article>
    </section>
  );
}

function formatCarClass(carClass: CarClass): string {
  return carClass
    .split("-")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}
