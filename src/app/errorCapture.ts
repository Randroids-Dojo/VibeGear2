import { BUILD_ID, BUILD_VERSION } from "./buildInfo";

export interface CapturedError {
  readonly id: string;
  readonly message: string;
  readonly stackPrefix: string;
  readonly timestamp: number;
  readonly count: number;
  readonly buildId: string;
  readonly buildVersion: string;
  readonly userAgent: string;
}

export interface ErrorSink {
  report: (error: CapturedError) => Promise<void> | void;
}

export interface ErrorCaptureHandle {
  uninstall: () => void;
  getRecent: () => readonly CapturedError[];
  clear: () => void;
  capture: (error: unknown) => CapturedError | null;
}

interface ErrorCaptureOptions {
  readonly sink?: ErrorSink;
  readonly target?: ErrorCaptureTarget | null;
  readonly userAgent?: string;
  readonly buildId?: string;
  readonly buildVersion?: string;
  readonly now?: () => number;
  readonly logger?: Pick<Console, "warn">;
  readonly limit?: number;
}

interface ErrorCaptureTarget {
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
}

const DEFAULT_LIMIT = 32;
const STACK_PREFIX_LINES = 3;
const NO_STACK = "<no-stack>";

let globalCapture: ErrorCaptureHandle | null = null;

export function ensureGlobalErrorCapture(options: ErrorCaptureOptions = {}): ErrorCaptureHandle {
  if (globalCapture) return globalCapture;
  globalCapture = installErrorCapture(options);
  return globalCapture;
}

export function getGlobalErrorCapture(): ErrorCaptureHandle {
  return ensureGlobalErrorCapture();
}

export function resetGlobalErrorCaptureForTests(): void {
  globalCapture?.uninstall();
  globalCapture = null;
}

export function installErrorCapture(options: ErrorCaptureOptions = {}): ErrorCaptureHandle {
  const target = options.target === undefined ? defaultTarget() : options.target;
  const limit = clampLimit(options.limit ?? DEFAULT_LIMIT);
  const now = options.now ?? Date.now;
  const logger = options.logger ?? console;
  const buildId = options.buildId ?? BUILD_ID;
  const buildVersion = options.buildVersion ?? BUILD_VERSION;
  const userAgent = options.userAgent ?? defaultUserAgent();
  const recent: CapturedError[] = [];
  const byKey = new Map<string, number>();

  const capture = (error: unknown): CapturedError | null => {
    const normalized = normalizeError(error);
    const key = `${normalized.message}\n${normalized.stackPrefix}`;
    const existingIndex = byKey.get(key);
    if (existingIndex !== undefined) {
      const existing = recent[existingIndex];
      if (!existing) return null;
      const updated: CapturedError = {
        ...existing,
        timestamp: now(),
        count: existing.count + 1,
      };
      recent[existingIndex] = updated;
      reportToSink(options.sink, updated, logger);
      return updated;
    }

    const captured: CapturedError = {
      id: hashId(`${buildId}\n${key}`),
      message: normalized.message,
      stackPrefix: normalized.stackPrefix,
      timestamp: now(),
      count: 1,
      buildId,
      buildVersion,
      userAgent,
    };
    recent.push(captured);
    byKey.set(key, recent.length - 1);
    while (recent.length > limit) {
      const removed = recent.shift();
      if (removed) {
        byKey.delete(`${removed.message}\n${removed.stackPrefix}`);
      }
    }
    rebuildIndex(byKey, recent);
    reportToSink(options.sink, captured, logger);
    return captured;
  };

  if (!target) {
    return {
      uninstall: () => {},
      getRecent: () => recent.slice(),
      clear: () => {
        recent.length = 0;
        byKey.clear();
      },
      capture,
    };
  }

  const onError: EventListener = (event) => {
    capture(errorFromEvent(event));
  };
  const onUnhandledRejection: EventListener = (event) => {
    capture(reasonFromRejectionEvent(event));
  };

  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onUnhandledRejection);

  return {
    uninstall: () => {
      target.removeEventListener("error", onError);
      target.removeEventListener("unhandledrejection", onUnhandledRejection);
    },
    getRecent: () => recent.slice(),
    clear: () => {
      recent.length = 0;
      byKey.clear();
    },
    capture,
  };
}

export function formatCapturedErrors(errors: readonly CapturedError[]): string {
  return JSON.stringify(errors, null, 2);
}

function defaultTarget(): ErrorCaptureTarget | null {
  if (typeof window === "undefined") return null;
  return window;
}

function defaultUserAgent(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent;
}

function normalizeError(error: unknown): Pick<CapturedError, "message" | "stackPrefix"> {
  if (error instanceof Error) {
    return {
      message: error.message || error.name,
      stackPrefix: stackPrefix(error.stack),
    };
  }
  if (typeof error === "string") {
    return {
      message: error,
      stackPrefix: NO_STACK,
    };
  }
  return {
    message: safeStringify(error),
    stackPrefix: NO_STACK,
  };
}

function errorFromEvent(event: Event): unknown {
  const withError = event as Event & {
    error?: unknown;
    message?: string;
    filename?: string;
    lineno?: number;
    colno?: number;
  };
  if (withError.error !== undefined) return withError.error;
  const message = withError.message ?? "Script error";
  const location = [
    withError.filename,
    typeof withError.lineno === "number" ? withError.lineno : null,
    typeof withError.colno === "number" ? withError.colno : null,
  ].filter((part): part is string | number => part !== null && part !== undefined && part !== "");
  return location.length > 0 ? `${message} (${location.join(":")})` : message;
}

function reasonFromRejectionEvent(event: Event): unknown {
  return (event as Event & { reason?: unknown }).reason ?? "Unhandled promise rejection";
}

function stackPrefix(stack: string | undefined): string {
  if (!stack) return NO_STACK;
  const lines = stack
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(0, STACK_PREFIX_LINES).join("\n") || NO_STACK;
}

function safeStringify(value: unknown): string {
  try {
    const output = JSON.stringify(value);
    return output === undefined ? String(value) : output;
  } catch {
    return String(value);
  }
}

function reportToSink(
  sink: ErrorSink | undefined,
  captured: CapturedError,
  logger: Pick<Console, "warn">,
): void {
  if (!sink) return;
  Promise.resolve()
    .then(() => sink.report(captured))
    .catch((error: unknown) => {
      logger.warn("[error-capture] sink failed", error);
    });
}

function rebuildIndex(index: Map<string, number>, recent: readonly CapturedError[]): void {
  index.clear();
  recent.forEach((entry, i) => {
    index.set(`${entry.message}\n${entry.stackPrefix}`, i);
  });
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.max(1, Math.floor(limit));
}

function hashId(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `err-${(hash >>> 0).toString(36)}`;
}
