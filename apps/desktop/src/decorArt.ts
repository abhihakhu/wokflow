/** URLs of the scene's decor SVGs, keyed by file name (e.g. "bonsai.svg"). */
const urls = import.meta.glob<string>('../../../packages/scene/assets/decor/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

const byFile = new Map(Object.entries(urls).map(([path, url]) => [path.split('/').at(-1)!, url]));

export function decorFileUrl(file: string): string {
  const url = byFile.get(file);
  if (!url) throw new Error(`No decor art named "${file}".`);
  return url;
}
