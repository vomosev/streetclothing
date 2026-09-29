module.exports = {
  apps: [
    {
      name: 'streetclothing',
      script: 'server/index.js',
      cwd: '/home/arx-app/backends/streetclothing',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      out_file: '/home/arx-app/backends/streetclothing/logs/api.log',
      error_file: '/home/arx-app/backends/streetclothing/logs/api-error.log',
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 4117,
      },
    },
  ],
};