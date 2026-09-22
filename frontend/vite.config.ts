import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import basicSsl from "@vitejs/plugin-basic-ssl";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
export default defineConfig(({ mode }) => ({
  base: mode === "electron" ? "./" : "/",

  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),

    ...(mode === "mobile" ? [basicSsl()] : []),
  ],

  build: {
    outDir: "dist/app",
    emptyOutDir: true,

    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("xlsx")) {
            return "xlsx";
          }

          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },

  optimizeDeps: {
    include: ["xlsx"],
  },

  server: {
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
}));