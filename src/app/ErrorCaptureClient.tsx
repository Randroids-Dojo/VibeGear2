"use client";

import { type ReactElement } from "react";

import { DevErrorPanel } from "./DevErrorPanel";
import { ensureGlobalErrorCapture } from "./errorCapture";

if (typeof window !== "undefined") {
  ensureGlobalErrorCapture();
}

export function ErrorCaptureClient(): ReactElement {
  return <DevErrorPanel />;
}
