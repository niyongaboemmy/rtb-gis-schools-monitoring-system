// PM2 process definitions for the single-EC2 deployment.
//   pm2 start deploy/ecosystem.config.js
//   pm2 reload rtb-api --update-env
//
// Env is loaded from files under /var/lib/rtb/env/ (not committed). PM2's
// `env_file` (pm2 >= 5.3) reads them; each process also runs from its own cwd.
const REPO = __dirname + '/..';

module.exports = {
  apps: [
    {
      name: 'rtb-api',
      cwd: REPO + '/server',
      script: 'dist/main.js',
      env_file: '/var/lib/rtb/env/server.env',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1200M',
      autorestart: true,
      time: true,
    },
    {
      name: 'rtb-file-server',
      cwd: REPO + '/file-server',
      script: 'server.js',
      env_file: '/var/lib/rtb/env/file-server.env',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '500M',
      autorestart: true,
      time: true,
    },
  ],
};
