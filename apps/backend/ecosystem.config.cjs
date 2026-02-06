module.exports = {
  apps: [
    {
      name: "map-to-poster-with-ai-backend",
      cwd: __dirname,
      script: "dist/index.js",
      interpreter: "node",
      node_args: "--enable-source-maps",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      kill_timeout: 15000,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
