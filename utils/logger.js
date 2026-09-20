const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const config = require('../config/config');

class Logger {
  constructor() {
    this.appLogPath = path.join(config.LOGS_DIR, 'application.log');
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    try {
      await fsPromises.mkdir(config.LOGS_DIR, { recursive: true });
      await fsPromises.mkdir(config.EXECUTION_LOGS_DIR, { recursive: true });
      this.initialized = true;
    } catch (err) {
      console.error('Failed to initialize logs directory:', err);
    }
  }

  formatMessage(level, message, metadata = null) {
    const timestamp = new Date().toISOString();
    let metaStr = '';
    if (metadata && typeof metadata === 'object') {
      try {
        metaStr = ' ' + JSON.stringify(metadata);
      } catch {
        metaStr = ' [Unserializable Metadata]';
      }
    } else if (metadata) {
      metaStr = ` ${metadata}`;
    }
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;
  }

  async log(level, message, metadata = null) {
    await this.init();
    const formatted = this.formatMessage(level, message, metadata);
    if (level === 'ERROR') {
      console.error(formatted.trim());
    } else if (level === 'WARN') {
      console.warn(formatted.trim());
    } else {
      console.log(formatted.trim());
    }

    try {
      await fsPromises.appendFile(this.appLogPath, formatted, 'utf8');
    } catch (err) {
      console.error('Failed writing to application log file:', err);
    }
  }

  info(message, metadata = null) {
    return this.log('INFO', message, metadata);
  }

  warn(message, metadata = null) {
    return this.log('WARN', message, metadata);
  }

  error(message, metadata = null) {
    return this.log('ERROR', message, metadata);
  }

  debug(message, metadata = null) {
    return this.log('DEBUG', message, metadata);
  }

  // Write dedicated execution run log
  async logExecution(runId, line) {
    await this.init();
    const runLogPath = path.join(config.EXECUTION_LOGS_DIR, `run_${runId}.log`);
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] ${line}\n`;
    try {
      await fsPromises.appendFile(runLogPath, formatted, 'utf8');
    } catch (err) {
      console.error(`Failed writing to execution log ${runId}:`, err);
    }
  }

  async getExecutionLog(runId) {
    const runLogPath = path.join(config.EXECUTION_LOGS_DIR, `run_${runId}.log`);
    try {
      return await fsPromises.readFile(runLogPath, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return 'No log file found for this execution.';
      throw err;
    }
  }
}

module.exports = new Logger();
