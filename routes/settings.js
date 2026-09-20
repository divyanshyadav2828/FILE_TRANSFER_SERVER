const express = require('express');
const router = express.Router();
const databaseService = require('../services/databaseService');

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const settings = await databaseService.getSettings();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  try {
    const updates = {};
    const { defaultConflict, defaultOperation, maxConcurrency, logLevel, theme, confirmMove } = req.body;

    if (defaultConflict && ['replace_if_newer', 'replace', 'skip'].includes(defaultConflict)) {
      updates.defaultConflict = defaultConflict;
    }
    if (defaultOperation && ['copy', 'move'].includes(defaultOperation)) {
      updates.defaultOperation = defaultOperation;
    }
    if (maxConcurrency && !isNaN(Number(maxConcurrency))) {
      updates.maxConcurrency = Math.max(1, Math.min(16, Number(maxConcurrency)));
    }
    if (logLevel && ['info', 'warn', 'error', 'debug'].includes(logLevel)) {
      updates.logLevel = logLevel;
    }
    if (theme && ['dark', 'light'].includes(theme)) {
      updates.theme = theme;
    }
    if (typeof confirmMove === 'boolean') {
      updates.confirmMove = confirmMove;
    }

    const saved = await databaseService.updateSettings(updates);
    res.json({ success: true, settings: saved });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
