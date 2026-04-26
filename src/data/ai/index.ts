/**
 * AI driver registry. Static-import barrel exposing the 20-driver content
 * set per `docs/gdd/24-content-plan.md` "Data" asset list and aligned with
 * the six archetypes from `docs/gdd/15-cpu-opponents-and-ai.md` "CPU
 * archetypes".
 *
 * Each JSON file conforms to `AIDriverSchema` from
 * `docs/gdd/22-data-schemas.md` (validated by
 * `src/data/__tests__/ai-content.test.ts`). The runtime registry keeps the
 * JSONs as the source of truth so balancing slices and the ai-grid
 * spawner can reshape the field by editing files alone (per
 * `docs/gdd/26-open-source-project-guidance.md` modding).
 *
 * Archetype distribution (totals to 20, matches the ai-driver dot's
 * "documented spread"):
 * - 4 nitro_burst (rocket starter, §15)
 * - 4 clean_line
 * - 3 aggressive (bully, §15)
 * - 3 defender (cautious, §15)
 * - 3 wet_specialist (chaotic / weather-volatile, §15)
 * - 3 endurance (enduro, §15)
 *
 * The schema-side enum names (`nitro_burst`, `aggressive`, `defender`,
 * `wet_specialist`, `endurance`) and the §15 prose names (Rocket starter,
 * Bully, Cautious, Chaotic, Enduro) refer to the same archetype slots:
 * the schema fixes the wire format, the GDD prose drives behaviour.
 *
 * Display-name lint: every `displayName` is an original two-token call
 * sign that does not match any active or historical motorsport champion
 * roster (per `docs/gdd/26-open-source-project-guidance.md` legal-safety
 * guidance). The sibling legal-safety dot will codify the lint once it
 * lands.
 */

import type { AIDriver } from "@/data/schemas";

import aiBully01 from "./ai_bully_01.json";
import aiBully02 from "./ai_bully_02.json";
import aiBully03 from "./ai_bully_03.json";
import aiCautious01 from "./ai_cautious_01.json";
import aiCautious02 from "./ai_cautious_02.json";
import aiCautious03 from "./ai_cautious_03.json";
import aiChaotic01 from "./ai_chaotic_01.json";
import aiChaotic02 from "./ai_chaotic_02.json";
import aiChaotic03 from "./ai_chaotic_03.json";
import aiCleanline01 from "./ai_cleanline_01.json";
import aiCleanline02 from "./ai_cleanline_02.json";
import aiCleanline03 from "./ai_cleanline_03.json";
import aiCleanline04 from "./ai_cleanline_04.json";
import aiEnduro01 from "./ai_enduro_01.json";
import aiEnduro02 from "./ai_enduro_02.json";
import aiEnduro03 from "./ai_enduro_03.json";
import aiRocket01 from "./ai_rocket_01.json";
import aiRocket02 from "./ai_rocket_02.json";
import aiRocket03 from "./ai_rocket_03.json";
import aiRocket04 from "./ai_rocket_04.json";

/**
 * Ordered AI driver roster. Grouping mirrors the archetype distribution
 * above so UI lists (driver-pick screens, championship grids) render in
 * a predictable order. The ai-grid slice may shuffle on spawn; this list
 * is the canonical authoring order.
 */
export const AI_DRIVERS: readonly AIDriver[] = [
  aiRocket01 as AIDriver,
  aiRocket02 as AIDriver,
  aiRocket03 as AIDriver,
  aiRocket04 as AIDriver,
  aiCleanline01 as AIDriver,
  aiCleanline02 as AIDriver,
  aiCleanline03 as AIDriver,
  aiCleanline04 as AIDriver,
  aiBully01 as AIDriver,
  aiBully02 as AIDriver,
  aiBully03 as AIDriver,
  aiCautious01 as AIDriver,
  aiCautious02 as AIDriver,
  aiCautious03 as AIDriver,
  aiChaotic01 as AIDriver,
  aiChaotic02 as AIDriver,
  aiChaotic03 as AIDriver,
  aiEnduro01 as AIDriver,
  aiEnduro02 as AIDriver,
  aiEnduro03 as AIDriver,
];

/** Lookup table keyed by `AIDriver.id`. */
export const AI_DRIVERS_BY_ID: ReadonlyMap<string, AIDriver> = new Map(
  AI_DRIVERS.map((d) => [d.id, d]),
);

/**
 * Fetch an AI driver by id. Returns undefined when the id is unknown so
 * callers can decide how to handle missing references (e.g. broken save
 * loads or ai-grid spawn requests for a retired driver). Mirrors the
 * `getCar` shape in `src/data/cars/index.ts`.
 */
export function getAIDriver(id: string): AIDriver | undefined {
  return AI_DRIVERS_BY_ID.get(id);
}
