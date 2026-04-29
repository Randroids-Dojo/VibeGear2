import { expect, test } from "@playwright/test";

const TAB_KEYS = [
  "display",
  "audio",
  "controls",
  "accessibility",
  "difficulty",
  "performance",
  "profile",
] as const;

test.describe("options screen", () => {
  test("renders every tab and opens with Display selected", async ({ page }) => {
    await page.goto("/options");

    await expect(page.getByTestId("options-page")).toBeVisible();

    for (const key of TAB_KEYS) {
      await expect(page.getByTestId(`options-tab-${key}`)).toBeVisible();
    }

    await expect(page.getByTestId("options-tab-display")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId("options-panel-display")).toBeVisible();
    await expect(page.getByTestId("options-panel-display-dot")).toContainText(
      "VibeGear2-implement-visual-polish-7d31d112",
    );
  });

  test("ArrowRight cycles through tabs and wraps", async ({ page }) => {
    await page.goto("/options");

    const display = page.getByTestId("options-tab-display");
    await display.focus();

    // Step through Audio, Controls, Accessibility, Difficulty,
    // Performance, Profile, then wrap back to Display.
    const order = [
      "audio",
      "controls",
      "accessibility",
      "difficulty",
      "performance",
      "profile",
      "display",
    ];
    for (const key of order) {
      await page.keyboard.press("ArrowRight");
      await expect(page.getByTestId(`options-tab-${key}`)).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(page.getByTestId(`options-panel-${key}`)).toBeVisible();
    }
  });

  test("ArrowLeft wraps from first tab to last", async ({ page }) => {
    await page.goto("/options");

    await page.getByTestId("options-tab-display").focus();
    await page.keyboard.press("ArrowLeft");

    await expect(page.getByTestId("options-tab-profile")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("Reset to defaults restores shipped settings and preserves placeholder-owned settings", async ({ page }) => {
    await page.goto("/options");

    const reset = page.getByTestId("options-reset-defaults");
    await expect(reset).toBeVisible();
    await expect(reset).toBeEnabled();

    await page.getByTestId("options-tab-accessibility").click();
    await page.getByTestId("accessibility-toggle-autoAccelerate").check();
    await page.getByTestId("options-tab-difficulty").click();
    await page.getByTestId("difficulty-preset-hard-input").check();

    await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) throw new Error("save missing after option edits");
      const save = JSON.parse(raw);
      save.profileName = "Reset Proof";
      save.settings.displaySpeedUnit = "mph";
      save.settings.transmissionMode = "manual";
      save.settings.audio = { master: 0.2, music: 0.3, sfx: 0.4 };
      save.settings.accessibility = {
        colorBlindMode: "protanopia",
        reducedMotion: true,
        largeUiText: true,
        screenShakeScale: 0.25,
      };
      window.localStorage.setItem(key, JSON.stringify(save));
    }, "vibegear2:save:v3");

    await reset.click();
    await expect(page.getByTestId("options-reset-status")).toContainText(
      "reset to defaults",
    );

    const persisted = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, "vibegear2:save:v3");

    expect(persisted?.settings?.assists?.autoAccelerate).toBe(false);
    expect(persisted?.settings?.difficultyPreset).toBe("normal");
    expect(persisted?.profileName).toBe("Reset Proof");
    expect(persisted?.settings?.displaySpeedUnit).toBe("mph");
    expect(persisted?.settings?.transmissionMode).toBe("manual");
    expect(persisted?.settings?.audio).toEqual({
      master: 1,
      music: 0.8,
      sfx: 0.9,
    });
  });

  test("Audio mix sliders persist master, music, and SFX settings", async ({
    page,
  }) => {
    await page.goto("/options");
    await page.getByTestId("options-tab-audio").click();

    await expect(page.getByTestId("audio-pane")).toBeVisible();
    await expect(page.getByTestId("audio-value-master")).toHaveText("100%");
    await expect(page.getByTestId("audio-value-music")).toHaveText("80%");
    await expect(page.getByTestId("audio-value-sfx")).toHaveText("90%");

    const setSlider = async (testId: string, value: string) => {
      await page.getByTestId(testId).evaluate((node, nextValue) => {
        const input = node as HTMLInputElement;
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        if (!setter) throw new Error("HTMLInputElement value setter missing");
        setter.call(input, nextValue);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }, value);
    };

    await setSlider("audio-slider-master", "0.45");
    await expect(page.getByTestId("audio-value-master")).toHaveText("45%");
    await expect(page.getByTestId("audio-status")).toContainText(
      "Master set to 45%",
    );

    await setSlider("audio-slider-music", "0.65");
    await expect(page.getByTestId("audio-value-music")).toHaveText("65%");

    await setSlider("audio-slider-sfx", "0.25");
    await expect(page.getByTestId("audio-value-sfx")).toHaveText("25%");

    const persisted = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, "vibegear2:save:v3");

    expect(persisted?.settings?.audio).toEqual({
      master: 0.45,
      music: 0.65,
      sfx: 0.25,
    });
  });

  test("Controls remapping persists custom keyboard bindings and rejects conflicts", async ({
    page,
  }) => {
    await page.goto("/options");
    await page.getByTestId("options-tab-controls").click();

    await expect(page.getByTestId("controls-pane")).toBeVisible();
    await expect(page.getByTestId("controls-binding-nitro")).toHaveText("Space");

    await page.getByTestId("controls-remap-nitro").click();
    await expect(page.getByTestId("controls-row-nitro")).toHaveAttribute(
      "data-listening",
      "true",
    );
    await page.keyboard.press("KeyN");

    await expect(page.getByTestId("controls-binding-nitro")).toHaveText("N");
    await expect(page.getByTestId("controls-status")).toContainText("saved");

    const persisted = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, "vibegear2:save:v3");
    expect(persisted?.settings?.keyBindings?.nitro).toEqual(["KeyN"]);

    await page.getByTestId("controls-remap-brake").click();
    await page.keyboard.press("KeyN");
    await expect(page.getByTestId("controls-status")).toContainText(
      "already bound to Nitro",
    );
    await expect(page.getByTestId("controls-binding-brake")).toHaveText("Down");
  });

  test("custom accelerate binding is used when a race starts", async ({
    page,
  }) => {
    await page.goto("/options");
    await page.getByTestId("options-tab-controls").click();
    await page.getByTestId("controls-remap-accelerate").click();
    await page.keyboard.press("KeyI");

    await page.goto("/race?track=test/straight");
    const canvas = page.getByTestId("race-canvas-element");
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    await canvas.focus();
    await page.keyboard.down("KeyI");
    await page.waitForTimeout(1_500);
    await page.keyboard.up("KeyI");

    const speedText = await page.getByTestId("hud-speed").innerText();
    const speed = Number(speedText);
    expect(Number.isFinite(speed)).toBe(true);
    expect(speed).toBeGreaterThan(0);
  });

  test("Back to title link returns to /", async ({ page }) => {
    await page.goto("/options");
    await page.getByTestId("options-back").click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("Escape returns to the title screen", async ({ page }) => {
    // Navigate via the title menu so history.back has a referrer.
    await page.goto("/");
    await page.getByTestId("menu-options").click();
    await expect(page).toHaveURL(/\/options$/);

    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("game-title")).toBeVisible();
  });
});
