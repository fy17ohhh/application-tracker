import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/output/**",
      "**/.wxt/**",
      "**/node_modules/**",
      "coverage/**",
      "*.config.ts"
    ]
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "react-hooks": reactHooks
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='eval']",
          message: "Remote or dynamic executable JavaScript is forbidden."
        },
        {
          selector: "NewExpression[callee.name='Function']",
          message: "Remote or dynamic executable JavaScript is forbidden."
        }
      ],
      "react-hooks/set-state-in-effect": "off"
    }
  },
  prettier
];
