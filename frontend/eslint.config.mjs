import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([globalIgnores([
    "node_modules",
    "**/.vscode/",
    "**/.idea/",
    "**/*.swp",
    "**/*.swo",
    "**/*~",
    "**/.DS_Store",
    "**/Thumbs.db",
    "**/*.log",
    "**/npm-debug.log*",
    "coverage",
    "dist",
    "build",
]), {
    extends: compat.extends("eslint:recommended"),

    languageOptions: {
        globals: {
            ...globals.browser,
            DB: "readonly",
            API_BASE: "readonly",
            AuthAPI: "readonly",
            PeopleAPI: "readonly",
            SchedulesAPI: "readonly",
            HandoversAPI: "readonly",
            SettingsAPI: "readonly",
            FilesAPI: "readonly",
        },

        ecmaVersion: "latest",
        sourceType: "module",
    },

    rules: {
        "no-unused-vars": ["warn", {
            argsIgnorePattern: "^_",
        }],

        "no-console": ["warn", {
            allow: ["warn", "error"],
        }],

        "no-undef": "error",
        "no-implicit-globals": "error",
        "prefer-const": "warn",
        "no-var": "error",
        eqeqeq: ["error", "always"],
        curly: ["error", "all"],
        "no-eval": "error",
        "no-implied-eval": "error",
    },
}]);