interface WarningsPanelProps {
  readonly warnings: readonly string[];
  readonly error: string | null;
}

export function WarningsPanel({ warnings, error }: WarningsPanelProps) {
  return (
    <section aria-labelledby="track-editor-warnings-title" data-testid="track-editor-warnings">
      <h2 id="track-editor-warnings-title">Validation</h2>
      {error ? (
        <p data-testid="track-editor-error" style={{ color: "#ff7a7a" }}>{error}</p>
      ) : (
        <p data-testid="track-editor-valid" style={{ color: "#8ef0a2" }}>Track compiles.</p>
      )}
      {warnings.length > 0 ? (
        <ul>
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : (
        <p>No compiler warnings.</p>
      )}
    </section>
  );
}
