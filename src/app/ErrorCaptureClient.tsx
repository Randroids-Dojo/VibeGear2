"use client";

import { useEffect, type ReactElement } from "react";

import { DevErrorPanel } from "./DevErrorPanel";
import { ensureGlobalErrorCapture } from "./errorCapture";

export function ErrorCaptureClient(): ReactElement {
  useEffect(() => {
    ensureGlobalErrorCapture();
  }, []);

  return <DevErrorPanel />;
}
