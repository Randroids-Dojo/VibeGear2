import { describe, expect, it, vi } from "vitest";

import {
  AudioContextController,
  type AudioContextLike,
  type AudioContextStateLike,
} from "./context";

class FakeAudioContext implements AudioContextLike {
  public state: AudioContextStateLike;
  public readonly resumeSpy = vi.fn(async () => {
    this.state = "running";
  });
  public readonly suspendSpy = vi.fn(async () => {
    this.state = "suspended";
  });

  constructor(state: AudioContextStateLike = "suspended") {
    this.state = state;
  }

  resume(): Promise<void> {
    return this.resumeSpy();
  }

  suspend(): Promise<void> {
    return this.suspendSpy();
  }
}

class FakeDocument {
  public hidden = false;
  public listener: (() => void) | null = null;

  addEventListener(_type: "visibilitychange", listener: () => void): void {
    this.listener = listener;
  }

  removeEventListener(_type: "visibilitychange", listener: () => void): void {
    if (this.listener === listener) {
      this.listener = null;
    }
  }

  dispatchVisibility(hidden: boolean): void {
    this.hidden = hidden;
    this.listener?.();
  }
}

describe("AudioContextController", () => {
  it("does not create a context until ensure or resume is called", () => {
    const create = vi.fn(() => new FakeAudioContext());
    const controller = new AudioContextController(create);

    expect(controller.get()).toBeNull();
    expect(create).not.toHaveBeenCalled();

    expect(controller.ensure()).toBeInstanceOf(FakeAudioContext);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("resumes suspended contexts created by the first gesture call", async () => {
    const context = new FakeAudioContext("suspended");
    const controller = new AudioContextController(() => context);

    await expect(controller.resume()).resolves.toBe(context);
    expect(context.resumeSpy).toHaveBeenCalledTimes(1);
    expect(context.state).toBe("running");
  });

  it("does not recreate or resume a running context", async () => {
    const context = new FakeAudioContext("running");
    const create = vi.fn(() => context);
    const controller = new AudioContextController(create);

    await controller.resume();
    await controller.resume();

    expect(create).toHaveBeenCalledTimes(1);
    expect(context.resumeSpy).not.toHaveBeenCalled();
  });

  it("returns null without throwing when Web Audio is unavailable", async () => {
    const controller = new AudioContextController(() => null);

    expect(controller.ensure()).toBeNull();
    await expect(controller.resume()).resolves.toBeNull();
    await expect(controller.suspend()).resolves.toBeUndefined();
  });

  it("suspends an existing running context on hidden visibility changes", () => {
    const context = new FakeAudioContext("running");
    const controller = new AudioContextController(() => context);
    const documentLike = new FakeDocument();

    controller.ensure();
    const unbind = controller.bindVisibilitySuspension(documentLike);

    documentLike.dispatchVisibility(true);

    expect(context.suspendSpy).toHaveBeenCalledTimes(1);
    expect(context.state).toBe("suspended");

    unbind();
    expect(documentLike.listener).toBeNull();
  });

  it("suspends an existing running context when bound while already hidden", () => {
    const context = new FakeAudioContext("running");
    const controller = new AudioContextController(() => context);
    const documentLike = new FakeDocument();

    controller.ensure();
    documentLike.hidden = true;
    controller.bindVisibilitySuspension(documentLike);

    expect(context.suspendSpy).toHaveBeenCalledTimes(1);
    expect(context.state).toBe("suspended");
  });

  it("does not create a context just because the page becomes hidden", () => {
    const create = vi.fn(() => new FakeAudioContext("running"));
    const controller = new AudioContextController(create);
    const documentLike = new FakeDocument();

    controller.bindVisibilitySuspension(documentLike);
    documentLike.dispatchVisibility(true);

    expect(create).not.toHaveBeenCalled();
    expect(controller.get()).toBeNull();
  });
});
