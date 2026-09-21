import { defineConfig } from "vite";

export default defineConfig({
  base: "/shadowprompt/",
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks: {
          arena: ["three", "three/addons/controls/OrbitControls.js"],
        },
      },
    },
  },
});
