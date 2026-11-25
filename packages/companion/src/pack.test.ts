import { describe, expect, it } from 'vitest';
import defaultPack from '../../../packs/default/pack.json';
import { FALLBACK_LINES, PackError, animationFor, parsePack, pickLine } from './pack.js';

const sprites = {
  id: 'test-cook',
  name: 'Test Cook',
  renderer: 'sprites',
  states: { idle: 'idle', focus: 'cooking', away: 'notice', complete: 'cheer' },
  sprites: {
    idle: { sheet: 'idle.png', frames: 12, fps: 10 },
    cooking: { sheet: 'cooking.png', frames: 16, fps: 12 },
    notice: { sheet: 'notice.png', frames: 8, fps: 10 },
    cheer: { sheet: 'cheer.png', frames: 12, fps: 12, loop: false },
  },
  lines: { away: ['The pot’s still on…', 'Back to the wok?'] },
};

describe('parsePack', () => {
  it('accepts the committed default pack', () => {
    expect(() => parsePack(defaultPack)).not.toThrow();
  });

  it('accepts a sprite pack and defaults lines', () => {
    const { lines: _lines, ...noLines } = sprites;
    const pack = parsePack(noLines);
    expect(pack.lines).toEqual({});
  });

  it('accepts a rive pack', () => {
    const pack = parsePack({
      id: 'rive-cook',
      name: 'Rive Cook',
      renderer: 'rive',
      file: 'companion.riv',
      stateMachine: 'Companion',
      states: { idle: 'idle', focus: 'cooking', away: 'notice', complete: 'cheer' },
    });
    expect(animationFor(pack, 'focus')).toEqual({
      renderer: 'rive',
      name: 'cooking',
      file: 'companion.riv',
      stateMachine: 'Companion',
    });
  });

  it('reports a state pointing at a missing animation', () => {
    const { cheer: _cheer, ...rest } = sprites.sprites;
    try {
      parsePack({ ...sprites, sprites: rest });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(PackError);
      expect((err as PackError).issues.join()).toMatch(/complete.*cheer/);
    }
  });

  it('rejects bad ids, missing states and bad frame counts', () => {
    expect(() => parsePack({ ...sprites, id: 'Bad Id' })).toThrow(PackError);
    expect(() => parsePack({ ...sprites, states: { idle: 'idle' } })).toThrow(/states/);
    expect(() =>
      parsePack({
        ...sprites,
        sprites: { ...sprites.sprites, idle: { sheet: 'i.png', frames: 0, fps: 10 } },
      }),
    ).toThrow(/frames/);
    expect(() => parsePack(null)).toThrow(PackError);
  });
});

describe('animationFor', () => {
  it('maps each companion state to its sprite animation', () => {
    const pack = parsePack(sprites);
    const anim = animationFor(pack, 'away');
    expect(anim.renderer).toBe('sprites');
    expect(anim.name).toBe('notice');
    if (anim.renderer === 'sprites') expect(anim.animation.frames).toBe(8);
  });

  it('guards packs built by hand without validation', () => {
    const pack = parsePack(sprites);
    const broken = { ...pack, states: { ...pack.states, idle: 'ghost' } };
    expect(() => animationFor(broken, 'idle')).toThrow(PackError);
  });
});

describe('pickLine', () => {
  const pack = parsePack(sprites);

  it('picks from the pack’s lines deterministically', () => {
    expect(pickLine(pack, 'away', () => 0)).toBe('The pot’s still on…');
    expect(pickLine(pack, 'away', () => 0.99)).toBe('Back to the wok?');
    expect(pickLine(pack, 'away', () => 1)).toBe('Back to the wok?');
  });

  it('falls back when the pack has no lines for a state', () => {
    expect(pickLine(pack, 'idle', () => 0)).toBe(FALLBACK_LINES.prep);
    expect(pickLine(pack, 'complete')).toBe(FALLBACK_LINES.complete);
  });
});
