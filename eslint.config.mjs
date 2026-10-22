import nextPlugin from "@next/eslint-plugin-next";
import tsParser from "@typescript-eslint/parser";

// Next.js is checked with its supported plugin directly; this avoids
// the legacy rushstack ESLint module-resolution patch.
export default [
  { ignores: [
    ".next/**", "node_modules/**", "out/**", "build/**",
    "next-env.d.ts", "supabase/functions/**",
  ] },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { "@next/next": nextPlugin },
    rules: { ...nextPlugin.configs.recommended.rules },
  },
];
