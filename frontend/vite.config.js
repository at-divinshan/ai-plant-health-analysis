import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/ai-plant-health-analysis/",
  plugins: [react()],
  server: { port: 5173 },
});
