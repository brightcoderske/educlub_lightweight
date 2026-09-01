module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parserOptions: { ecmaVersion: "latest", sourceType: "script" },
  ignorePatterns: ["node_modules/", "uploads/"],
  rules: {
    "no-undef": "error",
    "no-unreachable": "error",
    "no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", ignoreRestSiblings: true },
    ],
  },
};
