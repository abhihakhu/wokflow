import { PackError, parsePack, type CharacterPack } from '@wokflow/companion';

/**
 * Every pack folder under packs/ is bundled at build time. Only packs/default is in git;
 * a personal pack (e.g. packs/xiangling) is picked up automatically on your machine.
 */
const manifests = import.meta.glob<unknown>('../../../packs/*/pack.json', {
  eager: true,
  import: 'default',
});
const files = import.meta.glob<string>('../../../packs/*/*.{png,webp,riv}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const folderOf = (path: string) => path.split('/').at(-2) ?? '';

export interface LoadedPack {
  pack: CharacterPack;
  resolveFile(file: string): string;
}

function load(folder: string): LoadedPack | undefined {
  const entry = Object.entries(manifests).find(([path]) => folderOf(path) === folder);
  if (!entry) return undefined;
  const pack = parsePack(entry[1]);
  return {
    pack,
    resolveFile(file) {
      const url = files[`../../../packs/${folder}/${file}`];
      if (!url) throw new PackError(`Pack "${pack.id}" has no file "${file}".`, [file]);
      return url;
    },
  };
}

/** Folders of every bundled pack, default first. */
export function availablePacks(): string[] {
  const folders = Object.keys(manifests).map(folderOf);
  return ['default', ...folders.filter((f) => f !== 'default').sort()];
}

/**
 * The pack named by VITE_COMPANION_PACK (e.g. `VITE_COMPANION_PACK=xiangling pnpm tauri dev`),
 * falling back to the default pack if it is missing or invalid.
 */
export function selectPack(
  requested = import.meta.env.VITE_COMPANION_PACK as string | undefined,
): LoadedPack {
  if (requested && requested !== 'default') {
    try {
      const chosen = load(requested);
      if (chosen) return chosen;
      console.warn(`[wokflow] pack "${requested}" not found; using the default pack.`);
    } catch (err) {
      console.warn(`[wokflow] pack "${requested}" is invalid; using the default pack.`, err);
    }
  }
  const fallback = load('default');
  if (!fallback) throw new Error('The default pack is missing from packs/default.');
  return fallback;
}
