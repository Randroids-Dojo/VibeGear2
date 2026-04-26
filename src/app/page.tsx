import Link from "next/link";

import styles from "./page.module.css";

/**
 * Title screen.
 *
 * Renders the three top-level main menu items per GDD §5 and §20.
 * "Start Race" and "Garage" navigate to the routes that are already
 * shipped (`/race`, `/garage/cars`). "Options" stays disabled until the
 * `/options` route lands; the disabled control carries
 * `data-testid="menu-options-pending"` so the e2e smoke spec can flip
 * to an enabled assertion in the slice that ships that page.
 *
 * Keyboard order is Start Race -> Garage -> Options (DOM order).
 */

interface MenuItem {
  readonly label: string;
  readonly href: string;
  readonly testId: string;
}

const ENABLED_MENU: ReadonlyArray<MenuItem> = [
  { label: "Start Race", href: "/race", testId: "menu-start-race" },
  { label: "Garage", href: "/garage/cars", testId: "menu-garage" },
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
          {ENABLED_MENU.map((item) => (
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
          <button
            type="button"
            className={styles.menuItem}
            data-testid="menu-options-pending"
            disabled
            aria-disabled="true"
            title="Options menu lands in a later slice."
          >
            Options
          </button>
        </nav>
        <footer className={styles.footer}>
          <span data-testid="build-status">Pre-alpha. Phase 0 scaffold.</span>
        </footer>
      </section>
    </main>
  );
}
