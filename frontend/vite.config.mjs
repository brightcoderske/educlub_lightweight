import path from "node:path";
import { defineConfig, loadEnv, transformWithOxc } from "vite";
import react from "@vitejs/plugin-react";

const source = path.resolve(process.cwd(), "src");
const aliases = ["App", "routes", "assets", "components", "context", "examples", "layouts", "lib"];

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      {
        name: "educlub-jsx-in-js",
        enforce: "pre",
        async transform(code, id) {
          if (!id.includes("/src/") || !id.endsWith(".js")) return null;
          return transformWithOxc(code, id, { lang: "jsx" });
        },
      },
      react({ include: /\.[jt]sx?$/ }),
    ],
    resolve: {
      alias: Object.fromEntries(aliases.map((name) => [name, path.join(source, name)])),
    },
    // The backend only allows CORS_ORIGINS (http://localhost:3000 by default), so
    // fail loudly instead of silently sliding to another port the API will reject.
    server: {
      port: 3000,
      strictPort: true,
    },
    define: {
      "globalThis.__EDUCLUB_API_URL__": JSON.stringify(
        environment.VITE_API_URL || environment.REACT_APP_API_URL || "http://localhost:4000",
      ),
    },
    build: {
      outDir: "build",
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 750,
    },
  };
});
