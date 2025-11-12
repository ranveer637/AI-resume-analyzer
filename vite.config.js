// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Vite config for a React + Express single-repo app.
// - Enables the official React plugin so JSX/fast refresh work
// - Proxies /api requests to the backend in dev
// - Adds an alias for `@` -> src to make imports cleaner
export default defineConfig(({ mode }) => {
  return {
    plugins: [react()],

    resolve: {
      alias: {
        // use import Something from '@/components/Whatever'
        "@": path.resolve(__dirname, "src"),
      },
      // prefer ESM entry points
      extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"],
    },

    server: {
      // Useful during development: forward API calls to your local Express server
      proxy: {
        // any request starting with /api will be proxied to the backend
        "/api": {
          target: "http://localhost:4000",
          changeOrigin: true,
          secure: false,
        },
      },
      // optional: change the port if you want
      port: 5173,
      strictPort: false,
    },

    build: {
      // Vite outputs to dist/ by default which your server expects
      outDir: "dist",
      // You can tune chunk size / sourcemap for production if needed
      sourcemap: false,
    },

    // OptimizeDeps can help with parse issues for some packages; usually not required
    optimizeDeps: {
      include: ["react", "react-dom"],
    },
  };
});
