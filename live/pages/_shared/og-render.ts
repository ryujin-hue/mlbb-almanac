/**
 * Rasterizer kad OG - resvg-wasm.
 *
 * WASM tulen, jadi ia boleh jalan dalam Cloudflare Pages Functions tanpa
 * Node.
 *
 * Cara memuat WASM: runtime Cloudflare **melarang** kodegen WASM dinamik.
 * `WebAssembly.compile()` atau `WebAssembly.instantiate()` dengan bait mentah
 * akan gagal dengan "Wasm code generation disallowed by embedder". Modul WAJA
 * yang dibenarkan ialah modul yang sudah dikompil ahead-of-time dan di-import
 * sebagai modul ES.
 *
 * Bundle Pages menyusun import `.wasm` kepada modul berasingan secara
 * automatik (fail `.wasm` keluar bersama `index.js`), jadi tiada config
 * `rules` diperlukan - Pages tidak menyokong `rules` langsung.
 *
 * Font pula dimuat sebagai aset statik pada runtime dan dihantar kepada
 * resvg sebagai bait TTF, sebab runtime tiada font sistem.
 */
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import wasmModule from '@resvg/resvg-wasm/index_bg.wasm';

/** Nama keluarga font yang digunakan pada kad. */
export const OG_FONT_FAMILY = 'DejaVu Sans';

let initialized = false;

/**
 * Inisialisasi WASM - sekali sahaja per isolate.
 *
 * Modul WAJA sudah dikompil oleh runtime, jadi ini hanya instantiate.
 */
export async function ensureWasm(): Promise<void> {
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
