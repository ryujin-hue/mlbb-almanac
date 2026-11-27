/**
 * Modul WASM yang dikompil oleh wrangler (rule `CompiledWasm`).
 *
 * Default export ialah `WebAssembly.Module` - bukan ArrayBuffer.
 */
declare module '*.wasm' {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}
