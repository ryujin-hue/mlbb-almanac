/**
 * Rasterizer kad OG - resvg-wasm.
 *
 * WASM tulen, jadi ia boleh jalan dalam Cloudflare Pages Functions tanpa
 * Node. Modul WASM diimport terus daripada pakej; wrangler mem编译nya
 * sebagai modul berasingan (peripheral `rules` dalam wrangler.jsonc).
 */
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import wasmModule from '@resvg/resvg-wasm/index_bg.wasm';

let initialized = false;

/** Nama keluarga font yang digunakan pada kad. */
export const OG_FONT_FAMILY = 'DejaVu Sans';

async function ensureWasm(): Promise<void> {
  if (initialized) return;
  await initWasm(wasmModule as unknown as WebAssembly.Module);
  initialized = true;
}

/**
 * Rasterize SVG kepada PNG.
 *
 * Font diberi sebagai bytes supaya kad tidak bergantung pada font sistem
 * (Workers tiada font sistem) atau CDN luar.
 */
export async function renderOgPng(
  svg: string,
  fontBytes: Uint8Array
): Promise<Uint8Array> {
  await ensureWasm();

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'original' },
    font: {
      fontBuffers: [fontBytes],
      loadSystemFonts: false,
      defaultFontFamily: OG_FONT_FAMILY,
    },
  });

  return resvg.render().asPng();
}
