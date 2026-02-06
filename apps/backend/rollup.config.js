import path from "node:path";
import { builtinModules, createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const pkg = require("./package.json");

const externalPackages = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {})];

const nodeBuiltins = new Set([...builtinModules, ...builtinModules.map(m => `node:${m}`)]);

function isExternal(id) {
  if (nodeBuiltins.has(id)) return true;
  return externalPackages.some(pkgName => id === pkgName || id.startsWith(`${pkgName}/`));
}

const sharedPlugins = [
  nodeResolve({ preferBuiltins: true }),
  commonjs(),
  typescript({
    tsconfig: path.resolve(__dirname, "tsconfig.build.json"),
    useTsconfigDeclarationDir: true,
    tsconfigOverride: {
      compilerOptions: {
        sourceMap: true
      }
    }
  })
];

export default [
  {
    input: path.resolve(__dirname, "src/index.ts"),
    output: {
      file: path.resolve(__dirname, "dist/index.js"),
      format: "esm",
      sourcemap: true
    },
    external: isExternal,
    plugins: sharedPlugins
  },
  {
    input: path.resolve(__dirname, "src/services/infra/posters/poster-worker.ts"),
    output: {
      file: path.resolve(__dirname, "dist/poster-worker.js"),
      format: "esm",
      sourcemap: true
    },
    external: isExternal,
    plugins: sharedPlugins
  }
];
