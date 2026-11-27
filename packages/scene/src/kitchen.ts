import {
  AnimatedSprite,
  Application,
  Assets,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Texture,
} from 'pixi.js';
import { animationFor, type CharacterPack } from '@wokflow/companion';
import type { CompanionState } from '@wokflow/core';
import { DECOR_ART } from './decor.js';
import { flameShapes, FIRE } from './flame.js';
import { coverFit } from './layout.js';
import { SCENE_PARAMS, approach, type SceneParams } from './params.js';
import {
  emitCount,
  particleAlpha,
  particleRadius,
  spawn,
  stepParticles,
  type Emitter,
  type Particle,
} from './particles.js';
import { animationSpeed, companionPlacement, frameRects } from './sprites.js';

export interface KitchenAssets {
  back: string;
  front: string;
  lantern: string;
  glow: string;
}

export interface KitchenOptions {
  assets: KitchenAssets;
  pack: CharacterPack;
  /** Turn a file name from pack.json into a loadable URL. */
  resolvePackFile(file: string): string;
  /** Turn a decor art file name (assets/decor/*.svg) into a loadable URL. */
  resolveDecorFile?(file: string): string;
  /** Decor item ids to show initially. */
  decor?: string[];
  initialState?: CompanionState;
  reducedMotion?: boolean;
}

export interface KitchenScene {
  setState(state: CompanionState): void;
  /** Show exactly these decor items (unknown ids are ignored). */
  setDecor(ids: readonly string[]): void;
  setReducedMotion(reduced: boolean): void;
  destroy(): void;
}

const LANTERNS = [
  { x: 250, y: 102, scale: 1, phase: 0 },
  { x: 1000, y: 102, scale: 0.85, phase: 1.7 },
] as const;
const WOK: Emitter = { x: 760, y: 476, spread: 70 };
const STEAMER: Emitter = { x: 1015, y: 520, spread: 36 };
const MAX_PARTICLES = 160;

interface CompanionAnimation {
  textures: Texture[];
  fps: number;
  loop: boolean;
  frameHeight: number;
}

async function loadCompanion(
  pack: CharacterPack,
  resolve: (file: string) => string,
): Promise<Map<string, CompanionAnimation>> {
  if (pack.renderer !== 'sprites') {
    throw new Error(
      `Pack "${pack.id}" uses the ${pack.renderer} renderer, which the scene doesn't support yet.`,
    );
  }
  const animations = new Map<string, CompanionAnimation>();
  const names = new Set(Object.values(pack.states));
  await Promise.all(
    [...names].map(async (name) => {
      const anim = pack.sprites[name];
      if (!anim) return;
      const sheet = await Assets.load<Texture>(resolve(anim.sheet));
      const textures = frameRects(anim, sheet.width, sheet.height).map(
        (r) =>
          new Texture({ source: sheet.source, frame: new Rectangle(r.x, r.y, r.width, r.height) }),
      );
      animations.set(name, {
        textures,
        fps: anim.fps,
        loop: anim.loop ?? true,
        frameHeight: anim.frameHeight ?? sheet.height,
      });
    }),
  );
  return animations;
}

/** Mount the animated kitchen into `host`. Resolves once assets are loaded and the first frame is ready. */
export async function mountKitchen(
  host: HTMLElement,
  options: KitchenOptions,
): Promise<KitchenScene> {
  const app = new Application();
  await app.init({
    resizeTo: host,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(globalThis.devicePixelRatio || 1, 2),
  });
  app.canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(app.canvas);

  const svg = (src: string) => Assets.load<Texture>({ src, data: { resolution: 2 } });
  const [backTex, frontTex, lanternTex, glowTex] = await Promise.all([
    svg(options.assets.back),
    svg(options.assets.front),
    svg(options.assets.lantern),
    svg(options.assets.glow),
  ]);

  const world = new Container();
  app.stage.addChild(world);
  world.addChild(new Sprite(backTex));
  const wallDecor = new Container();
  world.addChild(wallDecor);

  const lanterns = LANTERNS.map((spec) => {
    const glow = new Sprite(glowTex);
    glow.anchor.set(0.5);
    glow.tint = 0xffb35c;
    glow.blendMode = 'add';
    glow.scale.set(1.4 * spec.scale);
    glow.position.set(spec.x, spec.y + 134 * spec.scale);
    const lantern = new Sprite(lanternTex);
    lantern.anchor.set(0.5, 0);
    lantern.scale.set(spec.scale);
    lantern.position.set(spec.x, spec.y);
    world.addChild(glow, lantern);
    return { spec, glow, lantern };
  });

  world.addChild(new Sprite(frontTex));
  const counterDecor = new Container();
  world.addChild(counterDecor);

  const fireGlow = new Sprite(glowTex);
  fireGlow.anchor.set(0.5);
  fireGlow.tint = 0xff8a3d;
  fireGlow.blendMode = 'add';
  fireGlow.scale.set(2.2, 1.6);
  fireGlow.position.set(FIRE.x, FIRE.baseY - 20);
  const fire = new Graphics();
  const steam = new Graphics();
  world.addChild(fireGlow, fire, steam);

  // Companion: optional — a broken pack must not take the kitchen down with it.
  let companion: AnimatedSprite | undefined;
  let animations = new Map<string, CompanionAnimation>();
  try {
    animations = await loadCompanion(options.pack, options.resolvePackFile);
    const first = animations.get(options.pack.states.idle) ?? [...animations.values()][0];
    if (first) {
      companion = new AnimatedSprite(first.textures);
      companion.anchor.set(0.5, 1);
      const place = companionPlacement(first.frameHeight);
      companion.position.set(place.x, place.y);
      companion.scale.set(place.scale);
      world.addChild(companion);
    }
  } catch (err) {
    console.warn('[wokflow] companion not shown:', err);
  }

  const layout = () => {
    const fit = coverFit(app.screen.width, app.screen.height);
    world.scale.set(fit.scale);
    world.position.set(fit.x, fit.y);
  };
  layout();
  app.renderer.on('resize', layout);

  let state: CompanionState = options.initialState ?? 'idle';
  let reduced = options.reducedMotion ?? false;
  let params: SceneParams = SCENE_PARAMS[state];
  let particles: Particle[] = [];
  let carry = { wok: 0, steamer: 0 };
  let time = 0;
  let currentAnim = '';

  const playCompanion = () => {
    if (!companion) return;
    const resolved = animationFor(options.pack, state);
    const anim = animations.get(resolved.name);
    if (!anim) return;
    if (resolved.name !== currentAnim) {
      companion.textures = anim.textures;
      companion.animationSpeed = animationSpeed(anim.fps);
      companion.loop = anim.loop;
      currentAnim = resolved.name;
    }
    if (reduced) companion.gotoAndStop(0);
    else companion.gotoAndPlay(0);
  };

  const draw = () => {
    fire.clear();
    for (const shape of flameShapes(time, params.fire))
      fire.poly(shape.points).fill({ color: shape.color });
    fireGlow.alpha = 0.2 + 0.35 * params.fire * (reduced ? 1 : 0.85 + 0.15 * Math.sin(time * 9));
    for (const { spec, glow, lantern } of lanterns) {
      lantern.rotation = reduced
        ? 0
        : (Math.sin(time * 0.8 + spec.phase) * params.sway * Math.PI) / 180;
      glow.alpha =
        params.lanternGlow * 0.5 * (reduced ? 1 : 0.9 + 0.1 * Math.sin(time * 1.3 + spec.phase));
    }
    steam.clear();
    for (const p of particles) {
      steam.circle(p.x, p.y, particleRadius(p)).fill({ color: 0xfff4e2, alpha: particleAlpha(p) });
    }
  };

  app.ticker.add((ticker) => {
    if (reduced) return;
    const dt = Math.min(ticker.deltaMS / 1000, 0.1);
    time += dt;
    params = approach(params, SCENE_PARAMS[state], dt);
    const wok = emitCount(params.wokSteam, dt, carry.wok);
    const steamer = emitCount(params.steamerSteam, dt, carry.steamer);
    carry = { wok: wok.carry, steamer: steamer.carry };
    particles = stepParticles(particles, dt);
    for (let i = 0; i < wok.count; i++) particles.push(spawn(WOK, Math.random));
    for (let i = 0; i < steamer.count; i++) particles.push(spawn(STEAMER, Math.random));
    if (particles.length > MAX_PARTICLES) particles = particles.slice(-MAX_PARTICLES);
    draw();
  });

  const settle = () => {
    // Reduced motion: one calm, static frame at the target state.
    params = SCENE_PARAMS[state];
    particles = [];
    time = 0.35;
    draw();
  };

  playCompanion();
  if (reduced) settle();
  else draw();

  let destroyed = false;
  const decorSprites = new Map<string, Sprite>();
  let wantedDecor = new Set<string>();

  const applyDecor = async (ids: readonly string[]) => {
    wantedDecor = new Set(ids.filter((id) => DECOR_ART[id]));
    for (const [id, sprite] of decorSprites) {
      if (!wantedDecor.has(id)) {
        sprite.destroy();
        decorSprites.delete(id);
      }
    }
    if (!options.resolveDecorFile) return;
    for (const id of wantedDecor) {
      if (decorSprites.has(id)) continue;
      const art = DECOR_ART[id]!;
      try {
        const texture = await svg(options.resolveDecorFile(art.file));
        // The wanted set may have changed while the texture loaded.
        if (destroyed || !wantedDecor.has(id) || decorSprites.has(id)) continue;
        const sprite = new Sprite(texture);
        sprite.anchor.set(art.anchorX, art.anchorY);
        sprite.position.set(art.x, art.y);
        sprite.scale.set(art.scale);
        (art.layer === 'wall' ? wallDecor : counterDecor).addChild(sprite);
        decorSprites.set(id, sprite);
      } catch (err) {
        console.warn(`[wokflow] decor "${id}" not shown:`, err);
      }
    }
  };
  void applyDecor(options.decor ?? []);

  return {
    setDecor(ids) {
      if (!destroyed) void applyDecor(ids);
    },
    setState(next) {
      if (destroyed || next === state) return;
      state = next;
      playCompanion();
      if (reduced) settle();
    },
    setReducedMotion(next) {
      if (destroyed || next === reduced) return;
      reduced = next;
      playCompanion();
      if (reduced) settle();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      app.renderer.off('resize', layout);
      app.destroy({ removeView: true }, { children: true });
    },
  };
}
