/**
 * Modul WASM yang dikompil ahead-of-time oleh bundle Pages.
 *
 * Runtime Cloudflare melarang kodegen WASM dinamik (`WebAssembly.compile` /
 * `initWasm` dengan bait mentah), jadi modul WAJA yang dibenarkan ialah
 * modul yang sudah dikompil dan di-import sebagai modul ES. Bundle Pages
 * mengeluarkan fail `.wasm` ini sebagai modul berasingan.
 *
 * Default export ialah `WebAssembly.Module` - bukan ArrayBuffer.
 */
declare module '*.wasm' {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}
