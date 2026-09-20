const express = require('express');
const router = express.Router();
const jobService = require('../services/jobService');
const executionService = require('../services/executionService');
const databaseService = require('../services/databaseService');

// GET /api/jobs - List all jobs
router.get('/', async (req, res) => {
  try {
    const jobs = await jobService.getAllJobs();
    res.json({ success: true, jobs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/jobs - Create job
router.post('/', async (req, res) => {
  try {
    const job = await jobService.createJob(req.body);
    res.status(201).json({ success: true, job });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message, validationErrors: err.validationErrors });
  }
});

// GET /api/jobs/:id - Get job by ID
router.get('/:id', async (req, res) => {
  try {
    const job = await jobService.getJobById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/jobs/:id - Update job
router.put('/:id', async (req, res) => {
  try {
    const job = await jobService.updateJob(req.params.id, req.body);
    res.json({ success: true, job });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message, validationErrors: err.validationErrors });
  }
});

// DELETE /api/jobs/:id - Delete job
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await jobService.deleteJob(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    res.json({ success: true, message: 'Job deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/jobs/:id/duplicate - Duplicate job
router.post('/:id/duplicate', async (req, res) => {
  try {
    const newJob = await jobService.duplicateJob(req.params.id);
    res.json({ success: true, job: newJob });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/jobs/:id/run - Start execution
router.post('/:id/run', async (req, res) => {
  try {
    const runData = await executionService.startJobExecution(req.params.id, {
      isDryRun: false,
      conflictResolution: req.body?.conflictResolution
    });
    res.json({ success: true, runId: runData.id, runData });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/jobs/:id/dry-run - Start dry run
router.post('/:id/dry-run', async (req, res) => {
  try {
    const runData = await executionService.startJobExecution(req.params.id, {
      isDryRun: true,
      conflictResolution: req.body?.conflictResolution
    });
    res.json({ success: true, runId: runData.id, runData });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/jobs/:id/history - Get history entries for a specific job
router.get('/:id/history', async (req, res) => {
  try {
    const history = await databaseService.getHistory({ jobId: req.params.id });
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
