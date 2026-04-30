/**
 * Pure helper that formats a captured render error into a single-string
 * report suitable for the error-boundary's "Copy error" button.
 *
 * Kept separate from the React class component so the formatting is
 * testable without a DOM. The output shape is intentionally plain text
 * (no Markdown, no JSON) so it pastes cleanly into a chat message or
 * GitHub issue.
 *
 * Privacy posture per `docs/gdd/21-technical-design-for-web-implementation.md`:
 * include only the error message, name, stack, and React component stack.
 * Do not include URL, user agent, or save data; those are handled by the
 * (optional, future) telemetry layer rather than the error boundary.
 */

export interface ErrorReportInput {
  /** The thrown value passed to `componentDidCatch`. */
  error: unknown;
  /** React's component stack ("\n    in Foo (at ...)\n    in Bar"). */
  componentStack?: string | null;
  /** Optional in-memory capture buffer snapshot. */
  recentClientErrors?: string | null;
}

export function formatErrorReport(input: ErrorReportInput): string {
  const { error, componentStack, recentClientErrors } = input;
  const lines: string[] = ["VibeGear2 error report"];

  if (error instanceof Error) {
    lines.push(`Name: ${error.name}`);
    lines.push(`Message: ${error.message}`);
    if (error.stack) {
      lines.push("");
      lines.push("Stack:");
      lines.push(error.stack);
    }
  } else {
    lines.push(`Thrown value: ${safeStringify(error)}`);
  }

  if (componentStack && componentStack.trim().length > 0) {
    lines.push("");
    lines.push("Component stack:");
    lines.push(componentStack.trim());
  }

  if (recentClientErrors && recentClientErrors.trim().length > 0) {
    lines.push("");
    lines.push("Recent client errors:");
    lines.push(recentClientErrors.trim());
  }

  return lines.join("\n");
}

function safeStringify(value: unknown): string {
  try {
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
