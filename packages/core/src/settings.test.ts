import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings, shouldReduceMotion, updateSettings } from './settings.js';
import { ValidationError } from './validation.js';

describe('settings', () => {
  it('defaults sensibly', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      companionPack: 'default',
      defaultSimmerMin: 25,
      awayGraceSec: 30,
      motion: 'system',
      dueReminders: true,
      dailyNudge: '',
    });
    expect(Object.isFrozen(DEFAULT_SETTINGS)).toBe(true);
  });

  it('parses stored records leniently, field by field', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
    expect(
      parseSettings({
        id: 'settings',
        companionPack: 'xiangling',
        defaultSimmerMin: 45,
        awayGraceSec: -3,
        motion: 'sideways',
        dailyNudge: '18:30',
        dueReminders: 'maybe',
        legacyField: true,
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      companionPack: 'xiangling',
      defaultSimmerMin: 45,
      dailyNudge: '18:30',
    });
  });

  it('validates updates and names the bad field', () => {
    const s = updateSettings(DEFAULT_SETTINGS, { defaultSimmerMin: 50, motion: 'reduce' });
    expect(s).toMatchObject({ defaultSimmerMin: 50, motion: 'reduce' });
    const cases: Array<[Partial<typeof DEFAULT_SETTINGS>, string]> = [
      [{ companionPack: '../evil' }, 'companionPack'],
      [{ defaultSimmerMin: 0 }, 'defaultSimmerMin'],
      [{ defaultSimmerMin: 30.5 }, 'defaultSimmerMin'],
      [{ awayGraceSec: 601 }, 'awayGraceSec'],
      [{ motion: 'fast' as never }, 'motion'],
      [{ dueReminders: 'yes' as never }, 'dueReminders'],
      [{ dailyNudge: '6pm' }, 'dailyNudge'],
    ];
    for (const [patch, field] of cases) {
      try {
        updateSettings(DEFAULT_SETTINGS, patch);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).field).toBe(field);
      }
    }
  });

  it('combines the motion choice with the OS preference', () => {
    expect(shouldReduceMotion('system', true)).toBe(true);
    expect(shouldReduceMotion('system', false)).toBe(false);
    expect(shouldReduceMotion('reduce', false)).toBe(true);
    expect(shouldReduceMotion('full', true)).toBe(false);
  });
});
