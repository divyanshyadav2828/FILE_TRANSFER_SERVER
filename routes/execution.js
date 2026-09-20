const express = require('express');
const router = express.Router();
const executionService = require('../services/executionService');
const databaseService = require('../services/databaseService');
const logger = require('../utils/logger');

// GET /api/execution/active - List all currently active runs
router.get('/active', (req, res) => {
  const activeRuns = executionService.getAllActiveRuns();
  res.json({ success: true, activeRuns });
});

// GET /api/execution/:runId/status - Get status of a run
router.get('/:runId/status', async (req, res) => {
  try {
    const active = executionService.getActiveRun(req.params.runId);
    if (active) {
      return res.json({ success: true, active: true, runData: active.runData });
    }

    const historyItem = await databaseService.getHistoryById(req.params.runId);
    if (historyItem) {
      return res.json({ success: true, active: false, runData: historyItem });
    }

    res.status(404).json({ success: false, error: 'Execution run not found.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/execution/:runId/events - Server-Sent Events (SSE) Stream
router.get('/:runId/events', async (req, res) => {
  const runId = req.params.runId;
  const registered = executionService.registerSSEClient(runId, res);

  if (!registered) {
    // If not active in memory, check if already finished in history
    const historyItem = await databaseService.getHistoryById(runId);
    if (historyItem) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write(`data: ${JSON.stringify({ type: 'completed', runData: historyItem })}\n\n`);
      return res.end();
    }
    return res.status(404).send('Execution not found');
  }
});

// POST /api/execution/:runId/stop - Stop a running execution
router.post('/:runId/stop', (req, res) => {
  const stopped = executionService.stopExecution(req.params.runId);
  if (!stopped) {
    return res.status(404).json({ success: false, error: 'Active execution not found or already finished.' });
  }
  res.json({ success: true, message: 'Stop signal sent successfully.' });
});

// GET /api/history - Get all history entries
router.get('/history/all', async (req, res) => {
  try {
    const { jobId, status } = req.query;
    const history = await databaseService.getHistory({ jobId, status });
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/history/:runId/raw-log - View/Download raw text log file
router.get('/history/:runId/raw-log', async (req, res) => {
  try {
    const rawLog = await logger.getExecutionLog(req.params.runId);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(rawLog);
  } catch (err) {
    res.status(500).send(`Failed to read log: ${err.message}`);
  }
});

// DELETE /api/history/:runId - Delete history entry
router.delete('/history/:runId', async (req, res) => {
  try {
    const deleted = await databaseService.deleteHistoryEntry(req.params.runId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'History entry not found' });
    }
    res.json({ success: true, message: 'History entry deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/history - Clear all history
router.delete('/history', async (req, res) => {
  try {
    await databaseService.clearHistory();
    res.json({ success: true, message: 'All execution history cleared' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
