module.exports = {
  apps: [
    {
      name: "map-to-poster-with-ai-backend",
      cwd: __dirname,
      script: "dist/index.js",
      interpreter: "node",
      node_args: "--enable-source-maps --max-old-space-size=768",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      kill_timeout: 15000,
      max_memory_restart: "1200M",
      min_uptime: "10s",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
