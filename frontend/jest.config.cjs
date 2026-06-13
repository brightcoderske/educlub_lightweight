module.exports = {
  rootDir: ".",
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.[jt]sx?$": ["babel-jest", { presets: ["react-app"] }],
  },
  moduleNameMapper: {
    "^lib/(.*)$": "<rootDir>/src/lib/$1",
  },
};
