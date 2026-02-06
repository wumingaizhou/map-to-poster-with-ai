import { defineConfig } from "eslint/config";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettier from "eslint-plugin-prettier";
import eslintPluginVue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import globals from "globals";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default defineConfig(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "/.*",
      "scripts/**",
      "**/*.d.ts",
      "**/mastra-memory/**",
      "**/.mastra/**"
    ]
  },
  {
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended, eslintConfigPrettier],
    plugins: {
      prettier: eslintPluginPrettier
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tseslint.parser
    },
    rules: {
      "no-var": "error",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off"
    }
  },
  {
    files: ["apps/frontend/**/*.{ts,js,tsx,jsx,vue}", "packages/components/**/*.{ts,js,tsx,jsx,vue}"],
    extends: [...eslintPluginVue.configs["flat/recommended"], eslintConfigPrettier],
    languageOptions: {
      globals: {
        ...globals.browser
      },
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: "latest",
        sourceType: "module"
      }
    },
    rules: {
      "vue/multi-word-component-names": "off",
      "vue/attributes-order": "off"
    }
  },
  {
    files: ["apps/backend/**/*.{ts,js}"],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      globals: {
        ...globals.node
      },
      sourceType: "commonjs"
    }
  }
);
