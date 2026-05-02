import { expect, test, type Page } from "@playwright/test";

async function csvText(page: Page, testId: string): Promise<Set<string>> {
  const text = await page.getByTestId(testId).textContent();
  return new Set(
    (text ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && value !== "none"),
  );
}

test.describe("race AI archetype readability", () => {
  test("surfaces archetype and behavior cues from the live race window", async ({
    page,
  }) => {
    test.setTimeout(45_000);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(
      "/race?track=moss-frontier/mistbarrow&mode=quickRace&weather=fog&tour=velvet-coast&raceIndex=0",
    );
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    await expect
      .poll(
        async () => Array.from(await csvText(page, "race-ai-archetype-roster")),
        { timeout: 10_000 },
      )
      .toEqual(
        expect.arrayContaining([
          "aggressive",
          "clean_line",
          "defender",
          "endurance",
          "nitro_burst",
          "wet_specialist",
        ]),
      );

    const observed = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      for (const cue of await csvText(page, "race-ai-observed-cues")) {
        observed.add(cue);
      }
      if (
        observed.has("rocket-launch") &&
        observed.has("bully-pressure") &&
        observed.has("cautious-low-visibility") &&
        observed.has("enduro-consistent")
      ) {
        break;
      }
      await page.waitForTimeout(250);
    }

    expect(Array.from(observed)).toEqual(
      expect.arrayContaining([
        "rocket-launch",
        "bully-pressure",
        "cautious-low-visibility",
        "enduro-consistent",
      ]),
    );
  });
});
