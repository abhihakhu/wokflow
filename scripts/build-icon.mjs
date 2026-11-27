#!/usr/bin/env node
/**
 * Draws the WokFlow app icon (1024×1024) to apps/desktop/src-tauri/app-icon.png.
 * Then generate every platform size with:  pnpm --filter @wokflow/desktop tauri icon src-tauri/app-icon.png
 */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'apps', 'desktop', 'src-tauri', 'app-icon.png');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="fire" cx="0.5" cy="0.85" r="0.6">
      <stop offset="0" stop-color="#FFB35C" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#FFB35C" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="32" y="32" width="960" height="960" rx="220" fill="#8E2A22"/>
  <rect x="72" y="72" width="880" height="880" rx="184" fill="none" stroke="#E3C27A" stroke-width="14"/>
  <rect x="32" y="32" width="960" height="960" rx="220" fill="url(#fire)"/>
  <!-- steam -->
  <g stroke="#EFE3C8" stroke-width="40" stroke-linecap="round" fill="none">
    <path d="M392 470 c-50 -70 50 -110 0 -190"/>
    <path d="M512 450 c-54 -76 54 -120 0 -206"/>
    <path d="M632 470 c-50 -70 50 -110 0 -190"/>
  </g>
  <!-- wok -->
  <path d="M212 540 q300 260 600 0 z" fill="#2A160F"/>
  <path d="M196 532 h632" stroke="#2A160F" stroke-width="44" stroke-linecap="round"/>
  <path d="M828 528 q66 -12 90 -78" stroke="#2A160F" stroke-width="40" fill="none" stroke-linecap="round"/>
  <path d="M290 590 q222 120 444 0" stroke="#E3C27A" stroke-width="10" fill="none" opacity="0.6"/>
  <!-- flame -->
  <path d="M420 830 q30 -70 70 -54 q8 -60 46 -14 q24 -36 66 68 z" fill="#FF8A3D"/>
  <path d="M462 830 q16 -36 40 -28 q10 -30 28 0 q14 -12 26 28 z" fill="#FFD27A"/>
</svg>`;

writeFileSync(OUT, new Resvg(svg).render().asPng());
console.log(`  ${OUT.replace(ROOT + '/', '')}`);
