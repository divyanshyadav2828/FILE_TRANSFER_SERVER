const express = require('express');
const path = require('path');
const config = require('./config/config');
const databaseService = require('./services/databaseService');
const logger = require('./utils/logger');

// Import routes
const webRoutes = require('./routes/web');
const jobRoutes = require('./routes/jobs');
const locationRoutes = require('./routes/locations');
const executionRoutes = require('./routes/execution');
const explorerRoutes = require('./routes/explorer');
const settingsRoutes = require('./routes/settings');

const app = express();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', config.VIEWS_DIR);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(config.PUBLIC_DIR));

// Logging middleware
app.use((req, res, next) => {
  if (!req.path.startsWith('/css') && !req.path.startsWith('/js') && !req.path.startsWith('/assets') && !req.path.includes('/events')) {
    logger.debug(`${req.method} ${req.path}`);
  }
  next();
});

// Mount routes
app.use('/api/jobs', jobRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/execution', executionRoutes);
app.use('/api/explorer', explorerRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/', webRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled Application Error:', err);
  if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  } else {
    res.status(500).render('error', {
      title: 'Error',
      appName: config.APP_NAME,
      currentPath: req.path,
      error: err.message,
      settings: {}
    });
  }
});

// Start server
async function start() {
  try {
    await logger.init();
    await databaseService.init();

    const server = app.listen(config.PORT, config.HOST, () => {
      console.log('====================================================');
      console.log(`  ${config.APP_NAME} v${config.APP_VERSION}`);
      console.log(`  Professional Local File/Folder Transfer Automation`);
      console.log('====================================================');
      console.log(`  Server running locally at:`);
      console.log(`  http://${config.HOST}:${config.PORT}`);
      console.log(`  http://localhost:${config.PORT}`);
      console.log('====================================================');
      logger.info(`Server initialized and listening on http://${config.HOST}:${config.PORT}`);
    });

    // Graceful shutdown
    const shutdown = () => {
      console.log('\nShutting down gracefully...');
      server.close(() => {
        console.log('Server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = app;
