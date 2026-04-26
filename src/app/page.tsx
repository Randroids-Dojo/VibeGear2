import styles from "./page.module.css";

export default function TitlePage() {
  return (
    <main className={styles.main}>
      <section className={styles.titleScreen} aria-label="Title screen">
        <h1 className={styles.title} data-testid="game-title">
          VibeGear2
        </h1>
        <p className={styles.tagline}>Spiritual successor to Top Gear 2.</p>
        <nav className={styles.menu} aria-label="Main menu">
          <button type="button" className={styles.menuItem} disabled>
            Start Race
          </button>
          <button type="button" className={styles.menuItem} disabled>
            Garage
          </button>
          <button type="button" className={styles.menuItem} disabled>
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
