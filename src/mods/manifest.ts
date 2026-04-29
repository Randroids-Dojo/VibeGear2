import {
  AIDriverSchema,
  CarSchema,
  ChampionshipSchema,
  ModManifestSchema,
  TrackSchema,
  UpgradeSchema,
  type AIDriver,
  type Car,
  type Championship,
  type ModManifest,
  type Track,
  type Upgrade,
} from "@/data/schemas";

type FetchLike = (
  input: string,
  init?: { cache?: RequestCache },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export const MODS_BASE_PATH = "/mods";
export const MOD_MANIFEST_FILE = "manifest.json";

export interface LoadedModContent {
  manifest: ModManifest;
  tracks: Track[];
  cars: Car[];
  upgrades: Upgrade[];
  aiDrivers: AIDriver[];
  championships: Championship[];
}

export interface LoadModOptions {
  modId: string;
  basePath?: string;
  fetcher?: FetchLike;
}

const EXECUTABLE_EXT_RE = /\.(?:js|mjs|cjs|ts|tsx|jsx|wasm|html?)$/iu;
const ModIdSchema = ModManifestSchema.shape.id;

export function isSafeModId(modId: string): boolean {
  return ModIdSchema.safeParse(modId).success;
}

export function isSafeModPath(path: string): boolean {
  if (!path || path.startsWith("/") || path.includes("\\")) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(path)) return false;
  if (EXECUTABLE_EXT_RE.test(path)) return false;
  return path.split("/").every((part) => part.length > 0 && part !== ".." && part !== ".");
}

export function modFileUrl(basePath: string, modId: string, path: string): string {
  if (!isSafeModId(modId)) {
    throw new Error(`modFileUrl: unsafe mod id "${modId}"`);
  }
  if (!isSafeModPath(path)) {
    throw new Error(`modFileUrl: unsafe mod path "${path}"`);
  }
  const cleanBase = basePath.replace(/\/+$/u, "");
  const encodedId = encodeURIComponent(modId);
  return `${cleanBase}/${encodedId}/${path}`;
}

async function fetchJson(fetcher: FetchLike, url: string): Promise<unknown> {
  const response = await fetcher(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`mod loader: ${url} returned HTTP ${response.status}`);
  }
  return response.json();
}

export async function loadModManifest(options: LoadModOptions): Promise<ModManifest> {
  const fetcher = options.fetcher ?? fetch;
  const basePath = options.basePath ?? MODS_BASE_PATH;
  const url = modFileUrl(basePath, options.modId, MOD_MANIFEST_FILE);
  const parsed = ModManifestSchema.safeParse(await fetchJson(fetcher, url));
  if (!parsed.success) {
    throw new Error(`mod loader: ${url} failed manifest validation: ${parsed.error.message}`);
  }
  if (parsed.data.id !== options.modId) {
    throw new Error(
      `mod loader: manifest id "${parsed.data.id}" does not match requested mod "${options.modId}"`,
    );
  }
  return parsed.data;
}

async function loadList<T>(
  fetcher: FetchLike,
  basePath: string,
  modId: string,
  paths: readonly string[] | undefined,
  label: string,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: Error } },
): Promise<T[]> {
  const output: T[] = [];
  for (const path of paths ?? []) {
    const url = modFileUrl(basePath, modId, path);
    const parsed = schema.safeParse(await fetchJson(fetcher, url));
    if (!parsed.success) {
      throw new Error(`mod loader: ${label} file ${url} failed schema validation: ${parsed.error.message}`);
    }
    output.push(parsed.data);
  }
  return output;
}

export async function loadModContent(options: LoadModOptions): Promise<LoadedModContent> {
  const fetcher = options.fetcher ?? fetch;
  const basePath = options.basePath ?? MODS_BASE_PATH;
  const manifest = await loadModManifest({ ...options, basePath, fetcher });

  const [tracks, cars, upgrades, aiDrivers, championships] = await Promise.all([
    loadList(fetcher, basePath, options.modId, manifest.data.tracks, "track", TrackSchema),
    loadList(fetcher, basePath, options.modId, manifest.data.cars, "car", CarSchema),
    loadList(fetcher, basePath, options.modId, manifest.data.upgrades, "upgrade", UpgradeSchema),
    loadList(fetcher, basePath, options.modId, manifest.data.aiDrivers, "AI driver", AIDriverSchema),
    loadList(
      fetcher,
      basePath,
      options.modId,
      manifest.data.championships,
      "championship",
      ChampionshipSchema,
    ),
  ]);

  return { manifest, tracks, cars, upgrades, aiDrivers, championships };
}
