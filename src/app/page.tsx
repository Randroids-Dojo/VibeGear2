import Link from "next/link";

import { TitleGlance } from "@/components/title/TitleGlance";

import { formatBuildBadge } from "./buildInfo";
import styles from "./page.module.css";

/**
 * Title screen.
 *
 * Per Q-015 (2026-05-06) "gut any feature not related to the world tour
 * mode", v1.0 ships only the World Tour championship surface. The menu
 * exposes Start Race -> `/race`, World Tour -> `/world`, Garage ->
 * `/garage`, Options -> `/options`. Time Trial / Quick Race / Practice
 * / Daily Challenge entries were removed from this menu in the
 * world-tour-only scope cut; the underlying routes and game modules
 * remain importable for now and will be deleted under F-090.
 *
 * Keyboard order is Start Race -> World Tour -> Garage -> Options.
 *
 * The footer carries two pieces of metadata. The pre-existing
 * `build-status` line tracks the design phase (kept verbatim so the
 * existing e2e and unit suites stay green). A new
 * `build-version` line stamps the compiled package version and the
 * git short SHA per GDD §21 ("Asset pipeline -> Build-time checksum
 * versioning") so a manual smoke can confirm the deployed build
 * matches the expected commit. Source: `buildInfo.ts`.
 */

interface MenuItem {
  readonly label: string;
  readonly href: string;
  readonly testId: string;
}

const MENU: ReadonlyArray<MenuItem> = [
  { label: "Start Race", href: "/race", testId: "menu-start-race" },
  { label: "World Tour", href: "/world", testId: "menu-world" },
  { label: "Garage", href: "/garage", testId: "menu-garage" },
  { label: "Options", href: "/options", testId: "menu-options" },
];

export default function TitlePage() {
  return (
    <main className={styles.main}>
      <section className={styles.titleScreen} aria-label="Title screen">
        <h1 className={styles.title} data-testid="game-title">
          VibeGear2
        </h1>
        <p className={styles.tagline}>Spiritual successor to Top Gear 2.</p>
        <TitleGlance />
        <nav className={styles.menu} aria-label="Main menu">
          {MENU.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={styles.menuItem}
              data-testid={item.testId}
              tabIndex={0}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <footer className={styles.footer}>
          <span data-testid="build-status">Pre-alpha. Phase 0 scaffold.</span>
          <span className={styles.buildVersion} data-testid="build-version">
            {formatBuildBadge()}
          </span>
        </footer>
      </section>
    </main>
  );
}
