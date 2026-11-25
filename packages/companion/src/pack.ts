import { z } from 'zod';
import type { CompanionState } from '@wokflow/core';

export const COMPANION_STATES = [
  'idle',
  'focus',
  'away',
  'complete',
] as const satisfies readonly CompanionState[];

/** Which set of lines the companion speaks from in each state. */
export const LINE_KINDS = ['prep', 'focus', 'away', 'complete'] as const;
export type LineKind = (typeof LINE_KINDS)[number];

const lineKindFor: Record<CompanionState, LineKind> = {
  idle: 'prep',
  focus: 'focus',
  away: 'away',
  complete: 'complete',
};

const nonEmpty = z.string().trim().min(1);

const spriteSchema = z.object({
  /** Path to the sprite sheet, relative to the pack folder. */
  sheet: nonEmpty,
  frames: z.number().int().positive(),
  fps: z.number().positive().max(60),
  /** Optional frame size in px; defaults to sheet width / frames × sheet height. */
  frameWidth: z.number().int().positive().optional(),
  frameHeight: z.number().int().positive().optional(),
  loop: z.boolean().optional(),
});

const statesSchema = z.object({
  idle: nonEmpty,
  focus: nonEmpty,
  away: nonEmpty,
  complete: nonEmpty,
});

const linesSchema = z
  .object({
    prep: z.array(nonEmpty).min(1),
    focus: z.array(nonEmpty).min(1),
    away: z.array(nonEmpty).min(1),
    complete: z.array(nonEmpty).min(1),
  })
  .partial();

const base = {
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'use lowercase letters, digits and dashes'),
  name: nonEmpty,
  /** Maps each companion state to an animation name (a sprites key or a Rive state). */
  states: statesSchema,
  lines: linesSchema.default({}),
};

const spritePackSchema = z
  .object({
    ...base,
    renderer: z.literal('sprites'),
    sprites: z.record(z.string(), spriteSchema),
  })
  .superRefine((pack, ctx) => {
    for (const state of COMPANION_STATES) {
      const anim = pack.states[state];
      if (!(anim in pack.sprites)) {
        ctx.addIssue({
          code: 'custom',
          path: ['sprites', anim],
          message: `state "${state}" points to animation "${anim}", which is not in sprites`,
        });
      }
    }
  });

const rivePackSchema = z.object({
  ...base,
  renderer: z.literal('rive'),
  /** Path to the .riv file, relative to the pack folder. */
  file: nonEmpty,
  stateMachine: nonEmpty,
});

export const packSchema = z.discriminatedUnion('renderer', [spritePackSchema, rivePackSchema]);

export type CharacterPack = z.infer<typeof packSchema>;
export type SpriteAnimation = z.infer<typeof spriteSchema>;

export class PackError extends Error {
  constructor(
    message: string,
    readonly issues: string[],
  ) {
    super(message);
    this.name = 'PackError';
  }
}

/** Validate a parsed pack.json. Throws a PackError listing every problem. */
export function parsePack(json: unknown): CharacterPack {
  const result = packSchema.safeParse(json);
  if (result.success) return result.data;
  const issues = result.error.issues.map(
    (issue) => `${issue.path.length ? issue.path.join('.') : '(root)'}: ${issue.message}`,
  );
  throw new PackError(`Invalid character pack:\n  ${issues.join('\n  ')}`, issues);
}

export type ResolvedAnimation =
  | { renderer: 'sprites'; name: string; animation: SpriteAnimation }
  | { renderer: 'rive'; name: string; file: string; stateMachine: string };

/** What to play for a given companion state. */
export function animationFor(pack: CharacterPack, state: CompanionState): ResolvedAnimation {
  const name = pack.states[state];
  if (pack.renderer === 'rive') {
    return { renderer: 'rive', name, file: pack.file, stateMachine: pack.stateMachine };
  }
  const animation = pack.sprites[name];
  // parsePack guarantees this; guard for packs built by hand in code.
  if (!animation) throw new PackError(`Missing sprite animation "${name}"`, [name]);
  return { renderer: 'sprites', name, animation };
}

export const FALLBACK_LINES: Record<LineKind, string> = {
  prep: 'What are we cooking up today?',
  focus: 'Wok’s hot. One step at a time.',
  away: 'Hey, the pot’s still on…',
  complete: 'Order up!',
};

/** Pick a line for the state. `random` is injectable for deterministic tests. */
export function pickLine(
  pack: CharacterPack,
  state: CompanionState,
  random: () => number = Math.random,
): string {
  const kind = lineKindFor[state];
  const options = pack.lines[kind];
  if (!options || options.length === 0) return FALLBACK_LINES[kind];
  const index = Math.min(options.length - 1, Math.floor(random() * options.length));
  return options[index] ?? FALLBACK_LINES[kind];
}
