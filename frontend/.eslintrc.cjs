module.exports = {
  env: { browser: true, es2022: true, jest: true },
  parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
  plugins: ["react", "react-hooks", "jsx-a11y"],
  extends: ["eslint:recommended", "plugin:react/recommended", "plugin:react-hooks/recommended", "plugin:jsx-a11y/recommended"],
  settings: { react: { version: "detect" } },
  globals: { __dirname: "readonly", global: "readonly" },
  rules: {
    "prettier/prettier": "off",
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "react/display-name": "off",
    "no-useless-catch": "warn",
    "no-useless-escape": "warn",
    "no-control-regex": "off",
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^React$" }],
  },
};
