import { describe, expect, it, vi } from 'vitest';
import { PackError } from '@wokflow/companion';
import { listPacks, loadPack, selectPack } from './packs';

describe('pack loader', () => {
  it('lists the default pack first, with a preview', () => {
    const [first] = listPacks();
    expect(first).toMatchObject({ folder: 'default', name: 'Ember' });
    expect(first?.preview?.url).toMatch(/idle.*\.png/);
    expect(first?.preview?.frames).toBe(12);
    expect(first?.preview?.aspect).toBeCloseTo(256 / 320);
    expect(first?.error).toBeUndefined();
  });

  it('loads the default pack and resolves its sprite sheets', () => {
    const { pack, resolveFile } = selectPack();
    expect(pack.id).toBe('default');
    if (pack.renderer !== 'sprites') throw new Error('expected a sprite pack');
    for (const anim of Object.values(pack.sprites))
      expect(resolveFile(anim.sheet)).toMatch(/\.png/);
    expect(() => resolveFile('missing.png')).toThrow(PackError);
    expect(loadPack('no-such-folder')).toBeUndefined();
  });

  it('prefers the chosen pack, then the env pack, and falls back to default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(selectPack('no-such-pack').pack.id).toBe('default');
    expect(warn).toHaveBeenLastCalledWith(expect.stringContaining('"no-such-pack" not found'));
    expect(selectPack('default', 'from-env').pack.id).toBe('default');
    expect(warn).toHaveBeenLastCalledWith(expect.stringContaining('"from-env" not found'));
    expect(selectPack('chosen', 'from-env').folder).toBe('default');
    expect(warn).toHaveBeenLastCalledWith(expect.stringContaining('"chosen" not found'));
    warn.mockRestore();
  });
});
