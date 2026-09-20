const express = require('express');
const router = express.Router();
const databaseService = require('../services/databaseService');
const jobService = require('../services/jobService');
const locationService = require('../services/locationService');
const executionService = require('../services/executionService');
const fileUtils = require('../utils/fileUtils');

// Helper to provide global template helpers
const getTemplateData = async (req, extra = {}) => {
  const settings = await databaseService.getSettings();
  const activeRuns = executionService.getAllActiveRuns();
  return {
    appName: 'FileFlow',
    version: '1.0.0',
    currentPath: req.path,
    settings,
    hasActiveRuns: activeRuns.length > 0,
    activeRunsCount: activeRuns.length,
    fileUtils,
    ...extra
  };
};

// GET / - Dashboard
router.get('/', async (req, res) => {
  try {
    const jobs = await jobService.getAllJobs();
    const locations = await locationService.getAllLocations();
    const history = await databaseService.getHistory();
    const activeRuns = executionService.getAllActiveRuns();

    // Stats calculations
    const stats = {
      totalJobs: jobs.length,
      runningJobs: activeRuns.length,
      successfulRuns: history.filter(h => h.status === 'success').length,
      failedRuns: history.filter(h => h.status === 'failed' || h.status === 'partial').length,
      totalBytesTransferred: history.reduce((acc, h) => acc + (h.stats?.bytes || 0), 0),
      totalFilesProcessed: history.reduce((acc, h) => acc + (h.stats?.processed || 0), 0)
    };

    const recentJobs = jobs.slice(0, 5);
    const recentActivity = history.slice(0, 7);

    const data = await getTemplateData(req, {
      title: 'Dashboard',
      stats,
      recentJobs,
      recentActivity,
      locations,
      activeRuns
    });

    res.render('dashboard', data);
  } catch (err) {
    res.status(500).render('error', { error: err.message, appName: 'FileFlow', currentPath: req.path, settings: {} });
  }
});

// GET /jobs - Jobs list
router.get('/jobs', async (req, res) => {
  try {
    const jobs = await jobService.getAllJobs();
    const locations = await locationService.getAllLocations();

    const data = await getTemplateData(req, {
      title: 'Transfer Jobs',
      jobs,
      locations
    });

    res.render('jobs/index', data);
  } catch (err) {
    res.status(500).render('error', { error: err.message, appName: 'FileFlow', currentPath: req.path, settings: {} });
  }
});

// GET /jobs/create - Create Job
router.get('/jobs/create', async (req, res) => {
  try {
    const locations = await locationService.getAllLocations();

    const data = await getTemplateData(req, {
      title: 'Create Transfer Job',
      locations,
      job: null,
      isEdit: false
    });

    res.render('jobs/create', data);
  } catch (err) {
    res.status(500).render('error', { error: err.message, appName: 'FileFlow', currentPath: req.path, settings: {} });
  }
});

// GET /jobs/:id/edit - Edit Job
router.get('/jobs/:id/edit', async (req, res) => {
  try {
    const job = await jobService.getJobById(req.params.id);
    if (!job) {
      return res.status(404).redirect('/jobs');
    }
    const locations = await locationService.getAllLocations();

    const data = await getTemplateData(req, {
      title: `Edit Job: ${job.name}`,
      locations,
      job,
      isEdit: true
    });

    res.render('jobs/edit', data);
  } catch (err) {
    res.status(500).render('error', { error: err.message, appName: 'FileFlow', currentPath: req.path, settings: {} });
  }
});

// GET /jobs/:id - Job Details
router.get('/jobs/:id', async (req, res) => {
  try {
    const job = await jobService.getJobById(req.params.id);
    if (!job) {
      return res.status(404).redirect('/jobs');
    }
    const history = await databaseService.getHistory({ jobId: job.id });
    const isRunning = executionService.isJobRunning(job.id);

    const data = await getTemplateData(req, {
      title: job.name,
      job,
      history,
      isRunning
    });

    res.render('jobs/details', data);
  } catch (err) {
    res.status(500).render('error', { error: err.message, appName: 'FileFlow', currentPath: req.path, settings: {} });
  }
});

// GET /execution/:runId - Live Execution View
router.get('/execution/:runId', async (req, res) => {
  try {
    const runId = req.params.runId;
    const active = executionService.getActiveRun(runId);
    let runData = active ? active.runData : await databaseService.getHistoryById(runId);

    if (!runData) {
      return res.status(404).redirect('/history');
    }

    const data = await getTemplateData(req, {
      title: `Execution: ${runData.jobName}`,
      runData,
      isActive: !!active
    });

    res.render('execution', data);
  } catch (err) {
    res.status(500).render('error', { error: err.message, appName: 'FileFlow', currentPath: req.path, settings: {} });
  }
});

// GET /locations - Saved Locations
router.get('/locations', async (req, res) => {
  try {
    const locations = await locationService.getAllLocations();

    const data = await getTemplateData(req, {
      title: 'Saved Locations',
      locations
    });

    res.render('locations', data);
  } catch (err) {
    res.status(500).render('error', { error: err.message, appName: 'FileFlow', currentPath: req.path, settings: {} });
  }
});

// GET /history - Execution History
router.get('/history', async (req, res) => {
  try {
    const { jobId, status } = req.query;
    const history = await databaseService.getHistory({ jobId, status });
    const jobs = await jobService.getAllJobs();

    const data = await getTemplateData(req, {
      title: 'Execution History',
      history,
      jobs,
      selectedJobId: jobId || '',
      selectedStatus: status || ''
    });

    res.render('history', data);
  } catch (err) {
    res.status(500).render('error', { error: err.message, appName: 'FileFlow', currentPath: req.path, settings: {} });
  }
});

// GET /history/:runId - History Detail View
router.get('/history/:runId', async (req, res) => {
  try {
    const runData = await databaseService.getHistoryById(req.params.runId);
    if (!runData) {
      return res.status(404).redirect('/history');
    }

    const data = await getTemplateData(req, {
      title: `Run Details: ${runData.jobName}`,
      runData
    });

    res.render('history-detail', data);
  } catch (err) {
    res.status(500).render('error', { error: err.message, appName: 'FileFlow', currentPath: req.path, settings: {} });
  }
});

// GET /settings - Settings Page
router.get('/settings', async (req, res) => {
  try {
    const settings = await databaseService.getSettings();

    const data = await getTemplateData(req, {
      title: 'Settings',
      settings
    });

    res.render('settings', data);
  } catch (err) {
    res.status(500).render('error', { error: err.message, appName: 'FileFlow', currentPath: req.path, settings: {} });
  }
});

module.exports = router;
