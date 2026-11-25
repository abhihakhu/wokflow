#!/usr/bin/env node
/**
 * Generates the default companion pack ("Ember", a little bao spirit) as sprite sheets.
 *
 *   node scripts/build-default-pack.mjs            # writes packs/default/*.png + pack.json
 *   node scripts/build-default-pack.mjs --preview  # also writes docs/images/ember-preview.png
 *
 * Every frame is drawn as SVG from a handful of pose parameters, then rendered with resvg.
 * Tweak the pose functions below and re-run to change the art.
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'packs', 'default');
const W = 256;
const H = 320;
const GROUND = 296;

const C = {
  bun: '#F7ECD6',
  bunShade: '#EAD7B3',
  outline: '#B8935E',
  pleat: '#D2B486',
  ink: '#2B1A12',
  cheek: '#F2A08F',
  lacquer: '#8E2A22',
  gold: '#E3C27A',
  pot: '#8A4A32',
  potDark: '#5C3020',
  steam: '#FFF4E2',
  sweat: '#9DC4E8',
};

const TAU = Math.PI * 2;
const f = (n) => Number(n.toFixed(2));

// ---------- parts ----------

function eyes({ kind = 'open', dx = 0 }) {
  return [-28, 28]
    .map((x) => {
      const cx = x + dx;
      const cy = -50;
      switch (kind) {
        case 'closed':
          return `<path d="M${cx - 10} ${cy} q10 7 20 0" stroke="${C.ink}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
        case 'happy':
          return `<path d="M${cx - 10} ${cy + 3} q10 -14 20 0" stroke="${C.ink}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
        case 'focus':
          return `<ellipse cx="${cx}" cy="${cy + 2}" rx="9" ry="8" fill="${C.ink}"/><circle cx="${cx - 3}" cy="${cy - 1}" r="2.5" fill="#fff"/>`;
        case 'wide':
          return `<ellipse cx="${cx}" cy="${cy}" rx="12" ry="14" fill="#fff" stroke="${C.ink}" stroke-width="3"/><circle cx="${cx - 3}" cy="${cy}" r="5.5" fill="${C.ink}"/>`;
        default:
          return `<ellipse cx="${cx}" cy="${cy}" rx="9" ry="12" fill="${C.ink}"/><circle cx="${cx - 3}" cy="${cy - 4}" r="3" fill="#fff"/>`;
      }
    })
    .join('');
}

function mouth(kind = 'smile') {
  switch (kind) {
    case 'open':
      return `<path d="M-12 -28 q12 18 24 0 z" fill="${C.ink}"/><path d="M-6 -21 q6 5 12 0" fill="${C.cheek}"/>`;
    case 'o':
      return `<ellipse cx="0" cy="-24" rx="6" ry="7" fill="${C.ink}"/>`;
    case 'flat':
      return `<path d="M-7 -26 h14" stroke="${C.ink}" stroke-width="4" stroke-linecap="round"/>`;
    default:
      return `<path d="M-9 -28 q9 9 18 0" stroke="${C.ink}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  }
}

/** An arm hanging from (x, -46), rotated by `angle` degrees (0 = straight down, + = outward). */
function arm(side, angle, extra = '') {
  const x = side * 76;
  const a = side * angle;
  return `<g transform="translate(${x} -46) rotate(${f(-a)})">
    <rect x="-9" y="-4" width="18" height="40" rx="9" fill="${C.bun}" stroke="${C.outline}" stroke-width="3"/>
    ${extra}
  </g>`;
}

const ladle = `<g transform="translate(0 28)">
  <rect x="-3" y="0" width="6" height="26" rx="3" fill="#7A5A3A"/>
  <ellipse cx="0" cy="28" rx="11" ry="7" fill="#9AA3B5" stroke="#6E7788" stroke-width="2"/>
</g>`;

function headband(tailPhase) {
  const w1 = f(Math.sin(tailPhase * TAU) * 6);
  const w2 = f(Math.sin(tailPhase * TAU + 1.2) * 7);
  return `
    <path d="M-80 -86 Q0 -112 80 -86 L78 -70 Q0 -96 -78 -70 Z" fill="${C.lacquer}"/>
    <path d="M-79 -78 Q0 -104 79 -78" stroke="${C.gold}" stroke-width="2" fill="none"/>
    <path d="M74 -80 q22 ${w1} 40 ${8 + w1} q-6 6 -2 12 q-22 -4 -38 -12 z" fill="${C.lacquer}"/>
    <path d="M74 -78 q18 ${12 + w2} 30 ${28 + w2} q-8 2 -10 8 q-14 -14 -22 -30 z" fill="#A8362B"/>
    <circle cx="74" cy="-78" r="8" fill="${C.lacquer}" stroke="${C.gold}" stroke-width="2"/>`;
}

function body({ eyesKind, eyeDx, mouthKind, armL, armR, holdLadle, tailPhase }) {
  return `
    <ellipse cx="-30" cy="-4" rx="18" ry="10" fill="${C.bunShade}" stroke="${C.outline}" stroke-width="3"/>
    <ellipse cx="30" cy="-4" rx="18" ry="10" fill="${C.bunShade}" stroke="${C.outline}" stroke-width="3"/>
    <path d="M-84 -10 C-94 -66 -70 -140 0 -146 C70 -140 94 -66 84 -10 Q0 10 -84 -10 Z" fill="${C.bun}" stroke="${C.outline}" stroke-width="3.5"/>
    <path d="M-70 -18 Q0 0 70 -18 Q0 -6 -70 -18 Z" fill="${C.bunShade}"/>
    <path d="M0 -142 Q-34 -126 -50 -100 M0 -142 Q-14 -122 -20 -98 M0 -142 Q14 -122 20 -98 M0 -142 Q34 -126 50 -100" stroke="${C.pleat}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="0" cy="-146" r="9" fill="${C.bun}" stroke="${C.outline}" stroke-width="3"/>
    ${headband(tailPhase)}
    <ellipse cx="-50" cy="-30" rx="12" ry="7" fill="${C.cheek}" opacity="0.75"/>
    <ellipse cx="50" cy="-30" rx="12" ry="7" fill="${C.cheek}" opacity="0.75"/>
    ${eyes({ kind: eyesKind, dx: eyeDx })}
    ${mouth(mouthKind)}
    ${arm(-1, armL)}
    ${arm(1, armR, holdLadle ? ladle : '')}`;
}

function steamWisps(phase, x, y, count = 3) {
  return Array.from({ length: count }, (_, i) => {
    const p = (phase + i / count) % 1;
    const yy = y - p * 70;
    const sway = Math.sin((p + i) * TAU) * 6;
    return `<path d="M${f(x + (i - 1) * 22 + sway)} ${f(yy)} c-8 -10 8 -18 0 -28" stroke="${C.steam}" stroke-width="7" fill="none" stroke-linecap="round" opacity="${f(0.75 * (1 - p))}"/>`;
  }).join('');
}

function pot(phase) {
  return `<g>
    ${steamWisps(phase, 196, 270, 2)}
    <path d="M70 290 h116 v8 q0 18 -26 18 h-64 q-26 0 -26 -18 z" fill="${C.pot}" stroke="${C.potDark}" stroke-width="3"/>
    <rect x="64" y="282" width="128" height="12" rx="6" fill="${C.potDark}"/>
    <path d="M86 306 h84" stroke="${C.gold}" stroke-width="2" opacity="0.6"/>
  </g>`;
}

function sparkle(x, y, s) {
  if (s <= 0.05) return '';
  return `<path transform="translate(${f(x)} ${f(y)}) scale(${f(s)})" d="M0 -14 L3 -3 L14 0 L3 3 L0 14 L-3 3 L-14 0 L-3 -3 Z" fill="${C.gold}"/>`;
}

const exclaim = (bounce) =>
  `<g transform="translate(206 ${f(70 - bounce * 8)})"><rect x="-6" y="-34" width="12" height="28" rx="6" fill="${C.lacquer}"/><circle cx="0" cy="6" r="7" fill="${C.lacquer}"/></g>`;

const sweatDrop = (p) =>
  `<path transform="translate(60 ${f(150 + p * 14)})" d="M0 -12 C6 -2 9 3 9 7 a9 9 0 0 1 -18 0 C-9 3 -6 -2 0 -12 Z" fill="${C.sweat}" opacity="${f(1 - p * 0.6)}"/>`;

/** One frame: pose parameters → SVG markup in a W×H box. */
function frame(p) {
  const lift = -(p.dy ?? 0);
  const shadowScale = Math.max(0.55, 1 - lift / 90);
  return `
    <ellipse cx="${W / 2}" cy="${GROUND + 4}" rx="${f(74 * shadowScale)}" ry="${f(10 * shadowScale)}" fill="#000" opacity="0.22"/>
    <g transform="translate(${W / 2} ${f(GROUND + (p.dy ?? 0))}) rotate(${f(p.rot ?? 0)}) scale(${f(p.sx ?? 1)} ${f(p.sy ?? 1)})">
      ${body({
        eyesKind: p.eyes ?? 'open',
        eyeDx: p.eyeDx ?? 0,
        mouthKind: p.mouth ?? 'smile',
        armL: p.armL ?? 18,
        armR: p.armR ?? 18,
        holdLadle: p.ladle ?? false,
        tailPhase: p.tail ?? 0,
      })}
    </g>
    ${p.front ?? ''}
    ${p.over ?? ''}`;
}

// ---------- animations ----------

const ANIMATIONS = {
  idle: {
    frames: 12,
    fps: 8,
    pose: (t, i) => ({
      dy: -Math.sin(t * TAU) * 4,
      sy: 1 + 0.025 * Math.sin(t * TAU),
      sx: 1 - 0.015 * Math.sin(t * TAU),
      eyes: i === 9 ? 'closed' : 'open',
      armL: 16 + 3 * Math.sin(t * TAU),
      armR: 16 + 3 * Math.sin(t * TAU),
      tail: t,
    }),
  },
  cooking: {
    frames: 12,
    fps: 12,
    pose: (t) => ({
      dy: -Math.abs(Math.sin(t * TAU)) * 3,
      eyes: 'focus',
      eyeDx: 4,
      mouth: 'smile',
      armL: 22,
      armR: -45 + 15 * Math.sin(t * TAU),
      ladle: true,
      tail: t * 2,
      front: pot(t),
    }),
  },
  notice: {
    frames: 8,
    fps: 8,
    pose: (t) => ({
      rot: -6 + 2.5 * Math.sin(t * TAU),
      eyes: 'wide',
      eyeDx: -8,
      mouth: 'o',
      armL: 150 + 8 * Math.sin(t * TAU),
      armR: 24,
      tail: t,
      over: exclaim(Math.abs(Math.sin(t * TAU))) + sweatDrop(t),
    }),
  },
  cheer: {
    frames: 10,
    fps: 12,
    pose: (t) => {
      const air = Math.abs(Math.sin(t * Math.PI));
      return {
        dy: -air * 34,
        sy: 1 - 0.07 * (1 - air),
        sx: 1 + 0.05 * (1 - air),
        eyes: 'happy',
        mouth: 'open',
        armL: 140 + 15 * air,
        armR: 140 + 15 * air,
        tail: t * 2,
        over:
          sparkle(40, 80, air) +
          sparkle(214, 60, 1 - air) +
          sparkle(226, 150, air * 0.8) +
          sparkle(28, 170, (1 - air) * 0.8),
      };
    },
  },
};

// ---------- render ----------

function strip(frames) {
  const body = frames.map((fr, i) => `<g transform="translate(${i * W} 0)">${fr}</g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${frames.length * W}" height="${H}" viewBox="0 0 ${frames.length * W} ${H}">${body}</svg>`;
}

function renderPng(svg) {
  return new Resvg(svg, { background: 'rgba(0,0,0,0)' }).render().asPng();
}

const packPath = join(OUT, 'pack.json');
const pack = JSON.parse(readFileSync(packPath, 'utf8'));
const sprites = {};
const previewRows = [];

for (const [name, anim] of Object.entries(ANIMATIONS)) {
  const frames = Array.from({ length: anim.frames }, (_, i) =>
    frame(anim.pose(i / anim.frames, i)),
  );
  const svg = strip(frames);
  writeFileSync(join(OUT, `${name}.png`), renderPng(svg));
  sprites[name] = {
    sheet: `${name}.png`,
    frames: anim.frames,
    fps: anim.fps,
    frameWidth: W,
    frameHeight: H,
  };
  previewRows.push(frames);
  console.log(`  ${name}.png  ${anim.frames} frames @ ${anim.fps} fps`);
}

pack.sprites = sprites;
writeFileSync(packPath, `${JSON.stringify(pack, null, 2)}\n`);

if (process.argv.includes('--preview')) {
  const cols = Math.max(...previewRows.map((r) => r.length));
  const cells = previewRows
    .flatMap((row, r) =>
      row.map(
        (fr, c) =>
          `<g transform="translate(${c * W} ${r * H})"><rect width="${W}" height="${H}" fill="${(r + c) % 2 ? '#3A1F16' : '#4A271B'}"/>${fr}</g>`,
      ),
    )
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * W}" height="${previewRows.length * H}">${cells}</svg>`;
  writeFileSync(join(ROOT, 'docs', 'images', 'ember-preview.png'), renderPng(svg));
  console.log('  docs/images/ember-preview.png');
}
