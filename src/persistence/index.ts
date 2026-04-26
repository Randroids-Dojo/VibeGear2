/**
 * Persistence layer. Local saves now; optional cloud sync later per
 * docs/gdd/21-technical-design-for-web-implementation.md "Save system".
 */
export * from "./save";
export { CURRENT_SAVE_VERSION, migrations, migrate } from "./migrations";
