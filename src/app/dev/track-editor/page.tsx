import { notFound } from "next/navigation";

import { TrackEditor } from "@/components/track-editor/TrackEditor";

export const dynamic = "force-static";

export function isTrackEditorEnabled(
  env: { readonly NEXT_PUBLIC_VG_FEATURE_TRACK_EDITOR?: string },
  nodeEnv: string | undefined,
): boolean {
  return nodeEnv !== "production" && env.NEXT_PUBLIC_VG_FEATURE_TRACK_EDITOR === "1";
}

export default function TrackEditorPage() {
  if (
    !isTrackEditorEnabled(
      {
        NEXT_PUBLIC_VG_FEATURE_TRACK_EDITOR:
          process.env.NEXT_PUBLIC_VG_FEATURE_TRACK_EDITOR,
      },
      process.env.NODE_ENV,
    )
  ) {
    notFound();
  }
  return <TrackEditor />;
}
