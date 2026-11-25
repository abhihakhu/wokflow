import { describe, expect, it, vi } from 'vitest';
import { PackError } from '@wokflow/companion';
import { availablePacks, selectPack } from './packs';

describe('pack loader', () => {
  it('bundles the default pack first', () => {
    expect(availablePacks()[0]).toBe('default');
  });

  it('loads the default pack and resolves its sprite sheets', () => {
    const { pack, resolveFile } = selectPack();
    expect(pack.id).toBe('default');
    expect(pack.name).toBe('Ember');
    if (pack.renderer !== 'sprites') throw new Error('expected a sprite pack');
    for (const anim of Object.values(pack.sprites)) {
      expect(resolveFile(anim.sheet)).toMatch(/\.png/);
    }
    expect(() => resolveFile('missing.png')).toThrow(PackError);
  });

  it('falls back to the default pack when the requested one is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(selectPack('no-such-pack').pack.id).toBe('default');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('not found'));
    warn.mockRestore();
  });
});
