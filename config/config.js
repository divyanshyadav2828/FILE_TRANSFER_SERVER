const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const LOGS_DIR = path.join(ROOT_DIR, 'logs');
const EXECUTION_LOGS_DIR = path.join(LOGS_DIR, 'executions');

module.exports = {
  APP_NAME: 'FileFlow',
  APP_VERSION: '1.0.0',
  PORT: process.env.PORT || 3000,
  HOST: process.env.HOST || '127.0.0.1',
  ROOT_DIR,
  DATA_DIR,
  DATABASE_PATH: path.join(DATA_DIR, 'database.json'),
  LOGS_DIR,
  EXECUTION_LOGS_DIR,
  PUBLIC_DIR: path.join(ROOT_DIR, 'public'),
  VIEWS_DIR: path.join(ROOT_DIR, 'views'),
  DEFAULTS: {
    conflictResolution: 'replace_if_newer', // 'replace_if_newer', 'replace', 'skip'
    operation: 'copy', // 'copy', 'move'
    maxConcurrency: 4,
    logLevel: 'info',
    theme: 'dark',
    confirmMove: true
  }
};
