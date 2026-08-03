module.exports = {
  rootDir: ".",
  testEnvironment: "jsdom",
  setupFiles: ["<rootDir>/src/testSetup.js"],
  transform: {
    "^.+\\.[jt]sx?$": [
      "babel-jest",
      { presets: [["@babel/preset-env", { targets: { node: "current" } }], ["@babel/preset-react", { runtime: "automatic" }]] },
    ],
  },
  moduleNameMapper: {
    "^lib/(.*)$": "<rootDir>/src/lib/$1",
  },
};
