import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import basicSsl from "@vitejs/plugin-basic-ssl";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    // `npm run dev:mobile` -> HTTPS agar getUserMedia kamera aktif di HP
    ...(mode === "mobile" ? [basicSsl()] : []),
  ],
  build: {
    outDir: "dist/app",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
}));
