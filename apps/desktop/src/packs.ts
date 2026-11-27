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
const manifestFor = (folder: string) =>
  Object.entries(manifests).find(([path]) => folderOf(path) === folder)?.[1];

export interface LoadedPack {
  folder: string;
  pack: CharacterPack;
  resolveFile(file: string): string;
}

/** Load and validate one pack. Undefined if the folder doesn't exist; throws PackError if invalid. */
export function loadPack(folder: string): LoadedPack | undefined {
  const manifest = manifestFor(folder);
  if (manifest === undefined) return undefined;
  const pack = parsePack(manifest);
  return {
    folder,
    pack,
    resolveFile(file) {
      const url = files[`../../../packs/${folder}/${file}`];
      if (!url) throw new PackError(`Pack "${pack.id}" has no file "${file}".`, [file]);
      return url;
    },
  };
}

export interface PackOption {
  folder: string;
  name: string;
  /** First frame of the idle animation, for the picker. */
  preview?: { url: string; frames: number; aspect: number };
  /** Why the pack can't be used, if it is invalid. */
  error?: string;
}

/** Every bundled pack for the settings picker, default first, with previews and problems. */
export function listPacks(): PackOption[] {
  const folders = Object.keys(manifests).map(folderOf);
  const ordered = ['default', ...folders.filter((f) => f !== 'default').sort()];
  return ordered.map((folder) => {
    try {
      const loaded = loadPack(folder)!;
      const { pack } = loaded;
      if (pack.renderer !== 'sprites') return { folder, name: pack.name };
      const idle = pack.sprites[pack.states.idle];
      if (!idle) return { folder, name: pack.name };
      const url = loaded.resolveFile(idle.sheet);
      const aspect = idle.frameWidth && idle.frameHeight ? idle.frameWidth / idle.frameHeight : 0.8;
      return { folder, name: pack.name, preview: { url, frames: idle.frames, aspect } };
    } catch (err) {
      return { folder, name: folder, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

/**
 * The companion to show: the one chosen in settings, else VITE_COMPANION_PACK
 * (handy for development), else the default. Missing or invalid packs fall back to the default.
 */
export function selectPack(
  chosen?: string,
  fromEnv = import.meta.env.VITE_COMPANION_PACK as string | undefined,
): LoadedPack {
  const requested = chosen && chosen !== 'default' ? chosen : fromEnv;
  if (requested && requested !== 'default') {
    try {
      const pack = loadPack(requested);
      if (pack) return pack;
      console.warn(`[wokflow] pack "${requested}" not found; using the default pack.`);
    } catch (err) {
      console.warn(`[wokflow] pack "${requested}" is invalid; using the default pack.`, err);
    }
  }
  const fallback = loadPack('default');
  if (!fallback) throw new Error('The default pack is missing from packs/default.');
  return fallback;
}
