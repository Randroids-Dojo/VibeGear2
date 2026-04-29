import type { Track } from "@/data/schemas";
import { TrackSchema } from "@/data/schemas";
import { compileTrack, TrackCompileError } from "@/road/trackCompiler";
import type { CompiledTrack } from "@/road/types";

export interface TrackEditorOk {
  readonly ok: true;
  readonly track: Track;
  readonly compiled: CompiledTrack;
}

export interface TrackEditorError {
  readonly ok: false;
  readonly message: string;
}

export type TrackEditorValidation = TrackEditorOk | TrackEditorError;

export function validateAndCompile(raw: unknown): TrackEditorValidation {
  const parsed = TrackSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((issue) => issue.message).join("; ") };
  }
  try {
    return {
      ok: true,
      track: parsed.data,
      compiled: compileTrack(parsed.data),
    };
  } catch (error) {
    if (error instanceof TrackCompileError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: error instanceof Error ? error.message : "Unknown compile error" };
  }
}

export function exportTrack(track: Track): Blob {
  return new Blob([`${JSON.stringify(track, null, 2)}\n`], {
    type: "application/json",
  });
}

export async function importTrack(file: Pick<File, "text">): Promise<TrackEditorValidation> {
  const raw = await file.text();
  try {
    return validateAndCompile(JSON.parse(raw));
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}
