import path from "node:path";
import fs from "node:fs";
import { defineConfig, loadEnv, transformWithOxc } from "vite";
import react from "@vitejs/plugin-react";

const source = path.resolve(process.cwd(), "src");
const aliases = ["App", "routes", "assets", "components", "context", "examples", "layouts", "lib"];
const packageNames = new Set(
  Object.keys(
    JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf8")).dependencies
  )
);

// Lazy routes hide imports from the initial HTML scan. Prebundle their package
// imports together so visiting a new dashboard does not rebuild dependencies
// and reload every open tab (or mix two React/Emotion instances).
function dashboardDependencies(directory) {
  const dependencies = new Set(["react", "react-dom", "react-dom/client", "react/jsx-runtime"]);
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name !== "__tests__") {
      for (const dependency of dashboardDependencies(file)) dependencies.add(dependency);
    } else if (entry.isFile() && /\.[jt]sx?$/.test(entry.name) && !entry.name.includes(".test.")) {
      const code = fs.readFileSync(file, "utf8");
      for (const match of code.matchAll(/(?:from\s+|import\s*\(?\s*)["']([^"']+)["']/g)) {
        const dependency = match[1];
        const packageName = dependency.startsWith("@")
          ? dependency.split("/").slice(0, 2).join("/")
          : dependency.split("/")[0];
        if (packageNames.has(packageName) && !/\.(css|scss)$/.test(dependency))
          dependencies.add(dependency);
      }
    }
  }
  return dependencies;
}

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
      dedupe: ["react", "react-dom", "@emotion/react", "@emotion/styled"],
    },
    optimizeDeps: { include: [...dashboardDependencies(source)], noDiscovery: true },
    // The backend only allows CORS_ORIGINS (http://localhost:3000 by default), so
    // fail loudly instead of silently sliding to another port the API will reject.
    server: {
      port: 3000,
      strictPort: true,
    },
    define: {
      "globalThis.__EDUCLUB_API_URL__": JSON.stringify(
        environment.VITE_API_URL || environment.REACT_APP_API_URL || "http://localhost:4000"
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
