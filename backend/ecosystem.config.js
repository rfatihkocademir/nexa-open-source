module.exports = {
  apps: [
    {
      name: 'nexa-api',
      script: './dist/server.js',
      instances: 'max',       // Tüm CPU çekirdeklerini kullan (16 core)
      exec_mode: 'cluster',   // Cluster mode — çoklu process
      watch: false,
      
      // Bellek & restart yönetimi
      max_memory_restart: '512M',
      kill_timeout: 5000,
      listen_timeout: 8000,
      
      // Graceful restart
      wait_ready: true,
      shutdown_with_message: false,

      // Otomatik restart sınırları (crash döngülerini önle)
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,

      // Log yönetimi  
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Environment
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
