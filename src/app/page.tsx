import Link from "next/link";

import { formatBuildBadge } from "./buildInfo";
import styles from "./page.module.css";

/**
 * Title screen.
 *
 * Renders the three top-level main menu items per GDD §5 and §20:
 * Start Race -> `/race`, Garage -> `/garage/cars`, Options ->
 * `/options`. The Options entry was a disabled placeholder
 * (`menu-options-pending`) until the `/options` scaffold landed in
 * `VibeGear2-implement-options-screen-a9379c4a`. Its replacement keeps
 * the original `menu-options` test id that the e2e suite asserts on.
 *
 * Keyboard order is Start Race -> Garage -> Options (DOM order).
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
  { label: "Garage", href: "/garage/cars", testId: "menu-garage" },
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
        <nav className={styles.menu} aria-label="Main menu">
          {MENU.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={styles.menuItem}
              data-testid={item.testId}
              role="button"
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
