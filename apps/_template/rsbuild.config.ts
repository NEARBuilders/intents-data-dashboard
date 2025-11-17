import { pluginModuleFederation } from "@module-federation/rsbuild-plugin";
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { pluginNodePolyfill } from "@rsbuild/plugin-node-polyfill";

const isDevelopment = process.env.NODE_ENV === "development";

// Base plugins needed in both dev and prod
const basePlugins = [
  pluginReact(),
  pluginModuleFederation({
    name: "profile",
    filename: "profile/remoteEntry.js",
    exposes: {
      "./App": "./src/App.tsx",
      "./Profile": "./src/components/Profile.tsx",
    },
    remotes: {},
    shared: {
      react: {
        singleton: true,
        eager: true,
        requiredVersion: "^18.3.0"
      },
      "react-dom": {
        singleton: true,
        eager: true,
        requiredVersion: "^18.3.0",
      },
      // Exclude dev tools from federation
      "@tanstack/router-devtools": { import: false },
      "@tanstack/react-query-devtools": { import: false },
      // Exclude NEAR wallet packages from federation (provided by host)
      "@hot-labs/near-connect": { import: false },
      "@hot-labs/wibe3": { import: false },
      "@walletconnect/sign-client": { import: false },
      "near-api-js": { import: false },
    },
  }),
];

// Add node polyfill only in development
if (isDevelopment) {
  basePlugins.push(pluginNodePolyfill());
}

export default defineConfig({
  html: {
    template: "./index.html",
  },
  server: {
    port: 5170,
  },
  output: {
    distPath: {
      root: "dist",
    },
  },
  source: {
    entry: {
      index: "./src/index.tsx",
    },
  },
  plugins: basePlugins,
});
