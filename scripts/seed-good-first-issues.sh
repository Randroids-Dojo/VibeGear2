#!/usr/bin/env bash
set -euo pipefail

require_gh() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "gh CLI is required" >&2
    exit 1
  fi
}

require_gh

repo="${GITHUB_REPOSITORY:-}"
if [ -z "$repo" ]; then
  repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || true)"
fi
if [ -z "$repo" ]; then
  echo "Could not determine GitHub repo. Set GITHUB_REPOSITORY=owner/name." >&2
  exit 1
fi

ensure_label() {
  local name="$1"
  local color="$2"
  local description="$3"
  local exists

  exists="$(gh label list --repo "$repo" --limit 200 --json name --jq '.[].name' | grep -Fx "$name" || true)"
  if [ -n "$exists" ]; then
    gh label edit "$name" --repo "$repo" --color "$color" --description "$description" >/dev/null
  else
    gh label create "$name" --repo "$repo" --color "$color" --description "$description" >/dev/null
  fi
}

sync_labels_from_yaml() {
  node - .github/labels.yml <<'NODE'
const fs = require("fs");

const yamlPath = process.argv[2];
const input = fs.readFileSync(yamlPath, "utf8");
const labels = [];
let current = null;

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

for (const line of input.split(/\r?\n/)) {
  let match = line.match(/^- name: (.+)$/);
  if (match) {
    if (current) labels.push(current);
    current = { name: unquote(match[1]) };
    continue;
  }
  match = line.match(/^  color: (.+)$/);
  if (match && current) {
    current.color = unquote(match[1]);
    continue;
  }
  match = line.match(/^  description: (.+)$/);
  if (match && current) {
    current.description = unquote(match[1]);
  }
}
if (current) labels.push(current);

for (const label of labels) {
  if (!label.name || !label.color || !label.description) {
    throw new Error(`Incomplete label entry in ${yamlPath}`);
  }
  console.log(`${label.name}\t${label.color}\t${label.description}`);
}
NODE
}

issue_exists() {
  local title="$1"
  local matches

  matches="$(gh issue list --repo "$repo" --state all --limit 200 --search "\"$title\" in:title" --json title --jq '.[].title')"
  if printf '%s\n' "$matches" | grep -Fxq "$title"; then
    echo 1
  else
    echo 0
  fi
}

create_issue_if_missing() {
  local title="$1"
  local labels="$2"
  local body="$3"

  if [ "$(issue_exists "$title")" != "0" ]; then
    echo "skip existing: $title"
    return 0
  fi

  gh issue create --repo "$repo" --title "$title" --label "$labels" --body "$body"
}

while IFS=$'\t' read -r name color description; do
  ensure_label "$name" "$color" "$description"
done < <(sync_labels_from_yaml)

create_issue_if_missing \
  "Add a schema-valid starter track variation" \
  "good-first-issue,help-wanted,content,modding" \
  "## GDD reference

- docs/gdd/22-data-schemas.md
- docs/gdd/26-open-source-project-guidance.md

## Task

Add a small original track JSON variation under the starter mod sample and make sure content lint accepts it.

## Suggested files

- public/mods/starter-sample/tracks/
- public/mods/starter-sample/manifest.json
- public/mods/starter-sample/README.md

## Acceptance criteria

- The new track validates against the track schema.
- The starter mod manifest references the new file.
- The README briefly describes the new sample track.
- npm run content-lint passes.
"

create_issue_if_missing \
  "Document one safe original roadside prop pattern" \
  "good-first-issue,help-wanted,legal-review,content" \
  "## GDD reference

- docs/gdd/17-art-direction.md
- docs/gdd/26-open-source-project-guidance.md
- docs/LEGAL_SAFETY.md

## Task

Add one concise safe-pattern example for an original roadside prop, including what to avoid.

## Suggested files

- docs/LEGAL_SAFETY.md
- docs/gdd/17-art-direction.md

## Acceptance criteria

- The example is original and does not reference copied commercial assets.
- The guidance names one safe source pattern and one unsafe source pattern.
- No em-dashes or en-dashes are introduced.
"

create_issue_if_missing \
  "Add a small renderer regression for HUD text placement" \
  "good-first-issue,help-wanted,renderer,ui-ux" \
  "## GDD reference

- docs/gdd/16-rendering-and-visual-design.md
- docs/gdd/20-hud-and-ui-ux.md

## Task

Add a focused renderer test that pins one HUD text placement or sizing rule.

## Suggested files

- src/render/__tests__/
- src/render/pseudoRoadCanvas.ts

## Acceptance criteria

- The test uses the existing mock canvas helpers.
- The assertion covers a visible HUD placement rule.
- npm run test passes.
"

create_issue_if_missing \
  "Add contributor docs for choosing issue labels" \
  "good-first-issue,help-wanted,documentation,design" \
  "## GDD reference

- docs/gdd/26-open-source-project-guidance.md

## Task

Expand the contributing guide with one sentence per project-specific issue label, focused on when contributors should choose it.

## Suggested files

- docs/CONTRIBUTING.md

## Acceptance criteria

- Every §26 label is mentioned.
- The guidance stays concise and does not duplicate the issue template text.
- No em-dashes or en-dashes are introduced.
"

create_issue_if_missing \
  "Add a mod manifest negative-case fixture" \
  "good-first-issue,help-wanted,modding,content" \
  "## GDD reference

- docs/gdd/22-data-schemas.md
- docs/gdd/26-open-source-project-guidance.md

## Task

Add one small test fixture or unit test that proves the mod loader rejects an unsafe manifest path.

## Suggested files

- src/mods/__tests__/manifest.test.ts
- src/mods/manifest.ts

## Acceptance criteria

- The test fails before the unsafe path is rejected.
- The test passes with the existing loader rules or a narrow fix.
- npm run test passes.
"

create_issue_if_missing \
  "Add a basic audio manifest provenance example" \
  "good-first-issue,help-wanted,audio,legal-review" \
  "## GDD reference

- docs/gdd/18-sound-and-music-design.md
- docs/gdd/26-open-source-project-guidance.md

## Task

Add a short docs example showing how an original SFX or music contribution should document provenance.

## Suggested files

- docs/CONTRIBUTING.md
- docs/LEGAL_SAFETY.md

## Acceptance criteria

- The example explains source, license, originality, and date fields.
- The example does not point contributors at unclear sample packs.
- No em-dashes or en-dashes are introduced.
"
