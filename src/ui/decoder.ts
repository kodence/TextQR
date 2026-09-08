// Points zxing-wasm at the wasm binary bundled by Vite instead of its default CDN.
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import { configureDecoder } from '../core'

configureDecoder({
  locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
})
