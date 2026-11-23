import tailwindcss from "@tailwindcss/vite";
import react, { type BabelOptions } from "@vitejs/plugin-react";
import { createFilter, defineConfig, loadEnv } from "vite";

const isAppSource = createFilter("src/**", "**/tests/**");
const compilerEnabled =
  loadEnv("benchmark", ".", "DESKTOP_REACT_COMPILER").DESKTOP_REACT_COMPILER ===
  "1";

function appBabelOptions(id: string): BabelOptions {
  if (!isAppSource(id)) return {};

  return {
    plugins: [
      [
        "babel-plugin-react-compiler",
        { target: "19", compilationMode: "infer" },
      ],
    ],
  };
}

export default defineConfig({
  base: "./",
  optimizeDeps: compilerEnabled
    ? { include: ["react/compiler-runtime"] }
    : undefined,
  plugins: [
    {
      name: "plain-react-legacy-route",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = new URL(req.originalUrl ?? "/", "http://localhost");
          if (!["/only-react", "/only-react/"].includes(url.pathname))
            return next();

          res.writeHead(302, { Location: `/src/plain-react/${url.search}` });
          res.end();
        });
      },
    },
    react({ babel: compilerEnabled ? appBabelOptions : undefined }),
    tailwindcss(),
  ],
  build: {
    manifest: true,
    rollupOptions: {
      input: {
        home: "index.html",
        sdk: "src/ui-sdk/index.html",
        react: "src/plain-react/index.html",
      },
    },
  },
});
