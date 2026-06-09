module.exports = {
  apps: [
    {
      name: "educlub-backend",
      cwd: "/var/www/educlub/backend",
      script: "src/server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "4000"
      },
      max_memory_restart: "700M",
      error_file: "/var/log/educlub/backend-error.log",
      out_file: "/var/log/educlub/backend-out.log",
      time: true
    }
  ]
};
