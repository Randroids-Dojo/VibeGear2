export type AudioContextStateLike = "closed" | "interrupted" | "running" | "suspended";

export interface AudioContextLike {
  readonly state: AudioContextStateLike;
  resume(): Promise<void>;
  suspend(): Promise<void>;
}

export interface AudioDocumentLike {
  readonly hidden: boolean;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

export type AudioContextFactory = () => AudioContextLike | null;

export class AudioContextController {
  private context: AudioContextLike | null = null;

  constructor(private readonly createContext: AudioContextFactory = browserAudioContextFactory) {}

  get(): AudioContextLike | null {
    return this.context;
  }

  ensure(): AudioContextLike | null {
    if (this.context?.state === "closed") {
      this.context = null;
    }
    if (this.context === null) {
      this.context = this.createContext();
    }
    return this.context;
  }

  async resume(): Promise<AudioContextLike | null> {
    const context = this.ensure();
    if (context === null) return null;
    if (context.state === "suspended" || context.state === "interrupted") {
      await context.resume();
    }
    return context;
  }

  async suspend(): Promise<void> {
    const context = this.context;
    if (context === null || context.state !== "running") return;
    await context.suspend();
  }

  bindVisibilitySuspension(documentLike: AudioDocumentLike): () => void {
    const onVisibilityChange = () => {
      if (documentLike.hidden) {
        void this.suspend();
      }
    };
    documentLike.addEventListener("visibilitychange", onVisibilityChange);
    onVisibilityChange();
    return () => documentLike.removeEventListener("visibilitychange", onVisibilityChange);
  }
}

const defaultController = new AudioContextController();

export function getAudioContext(): AudioContextLike | null {
  return defaultController.get();
}

export function ensureAudioContext(): AudioContextLike | null {
  return defaultController.ensure();
}

export function resumeAudioContext(): Promise<AudioContextLike | null> {
  return defaultController.resume();
}

export function suspendAudioContext(): Promise<void> {
  return defaultController.suspend();
}

export function bindAudioVisibilitySuspension(
  documentLike: AudioDocumentLike | undefined = globalThis.document,
): () => void {
  if (documentLike === undefined) return () => {};
  return defaultController.bindVisibilitySuspension(documentLike);
}

function browserAudioContextFactory(): AudioContextLike | null {
  if (typeof window === "undefined") return null;

  const AudioContextCtor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  return AudioContextCtor === undefined ? null : new AudioContextCtor();
}
