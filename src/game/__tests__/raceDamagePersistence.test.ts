import { describe, expect, it } from "vitest";

import { defaultSave } from "@/persistence/save";

import { createDamageState, PRISTINE_DAMAGE_STATE } from "../damage";
import {
  applyRaceDamageToGarage,
  damageDeltaFromState,
  pendingDamageForActiveCar,
} from "../raceDamagePersistence";

describe("race damage garage persistence", () => {
  it("reads active-car pending damage from the save", () => {
    const seed = createDamageState({ engine: 0.25, tires: 0.1, body: 0.4 });
    const save = {
      ...defaultSave(),
      garage: {
        ...defaultSave().garage,
        pendingDamage: {
          "sparrow-gt": {
            ...seed,
            total: 0.99,
            offRoadAccumSeconds: 3.5,
          },
        },
      },
    };

    const damage = pendingDamageForActiveCar(save);

    expect(damage.zones).toEqual(seed.zones);
    expect(damage.total).toBe(seed.total);
    expect(damage.offRoadAccumSeconds).toBe(3.5);
  });

  it("stores final active-car damage and the credited race payout", () => {
    const save = defaultSave();
    const damage = {
      ...createDamageState({ engine: 0.2, tires: 0.15, body: 0.3 }),
      offRoadAccumSeconds: 4.25,
    };

    const next = applyRaceDamageToGarage({
      save,
      carId: "sparrow-gt",
      damage,
      lastRaceCashEarned: 1775.9,
    });

    expect(next).not.toBe(save);
    expect(next.garage.pendingDamage?.["sparrow-gt"]).toEqual(damage);
    expect(next.garage.lastRaceCashEarned).toBe(1775);
  });

  it("returns the frozen pristine state when no active-car damage is queued", () => {
    expect(pendingDamageForActiveCar(defaultSave())).toBe(PRISTINE_DAMAGE_STATE);
  });

  it("does not create repair queue entries for unowned cars", () => {
    const save = defaultSave();

    const next = applyRaceDamageToGarage({
      save,
      carId: "bastion-lm",
      damage: createDamageState({ body: 0.7 }),
      lastRaceCashEarned: 500,
    });

    expect(next).toBe(save);
  });

  it("projects damage state zones into results-builder damage scalars", () => {
    const damage = createDamageState({ engine: 0.2, tires: 0.4, body: 0.6 });

    expect(damageDeltaFromState(damage)).toEqual({
      engine: 0.2,
      tires: 0.4,
      body: 0.6,
    });
  });
});
