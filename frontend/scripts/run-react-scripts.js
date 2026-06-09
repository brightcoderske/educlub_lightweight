const { spawn } = require("child_process");

const command = process.argv[2] || "start";
const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["react-scripts", command],
  {
    env: {
      ...process.env,
      DISABLE_ESLINT_PLUGIN: "true",
    },
    shell: process.platform === "win32",
    stdio: "inherit",
  }
);

child.on("exit", (code) => {
  process.exit(code || 0);
});
