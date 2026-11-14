import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// "npm run build"        -> normaler Build in dist/ (für Capacitor / Webserver)
// "npm run build:single" -> alles in EINER html-Datei (zum schnellen Teilen/Testen)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
}));
