const { EventEmitter } = require('events');
const databaseService = require('./databaseService');
const fileTransferService = require('./fileTransferService');
const fileUtils = require('../utils/fileUtils');
const logger = require('../utils/logger');

class ExecutionService extends EventEmitter {
  constructor() {
    super();
    this.activeRuns = new Map(); // runId -> { runData, abortController, sseClients, logBuffer }
  }

  getActiveRun(runId) {
    return this.activeRuns.get(runId) || null;
  }

  getAllActiveRuns() {
    return Array.from(this.activeRuns.values()).map(r => r.runData);
  }

  isJobRunning(jobId) {
    for (const { runData } of this.activeRuns.values()) {
      if (runData.jobId === jobId && runData.status === 'running') {
        return true;
      }
    }
    return false;
  }

  /**
   * Starts a transfer job execution (or dry-run).
   */
  async startJobExecution(jobId, options = {}) {
    const job = await databaseService.getJobById(jobId);
    if (!job) {
      throw new Error(`Job with ID "${jobId}" not found.`);
    }

    if (this.isJobRunning(jobId)) {
      throw new Error(`Job "${job.name}" is already running.`);
    }

    const isDryRun = !!options.isDryRun;
    const settings = await databaseService.getSettings();
    const conflictResolution = options.conflictResolution || job.conflictResolution || settings.defaultConflict || 'replace_if_newer';
    const maxConcurrency = options.maxConcurrency || settings.maxConcurrency || 4;

    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const abortController = new AbortController();

    const runData = {
      id: runId,
      jobId: job.id,
      jobName: job.name,
      isDryRun,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      durationMs: 0,
      status: 'running', // 'running', 'success', 'partial', 'failed', 'stopped'
      currentStepIndex: 0,
      totalSteps: job.steps.length,
      currentStep: null,
      conflictResolution,
      stats: {
        processed: 0,
        copied: 0,
        skipped: 0,
        replaced: 0,
        failed: 0,
        bytes: 0
      },
      stepResults: [],
      errors: []
    };

    const activeRunObj = {
      runData,
      abortController,
      sseClients: new Set(),
      logBuffer: []
    };

    this.activeRuns.set(runId, activeRunObj);

    // Initial database status update
    if (!isDryRun) {
      await databaseService.updateJobStatus(job.id, 'running', runData.startedAt);
    }
    await databaseService.addHistoryEntry(runData);

    logger.info(`Starting execution ${runId} for job "${job.name}" (DryRun: ${isDryRun})`);
    await logger.logExecution(runId, `=== Execution Started: ${job.name} (ID: ${job.id}) [DryRun: ${isDryRun}] ===`);

    // Run asynchronously
    this.executeJobProcess(activeRunObj, job, {
      conflictResolution,
      isDryRun,
      maxConcurrency
    }).catch(err => {
      logger.error(`Unhandled error during execution ${runId}:`, err);
    });

    return runData;
  }

  /**
   * Internal runner loop over all steps
   */
  async executeJobProcess(activeRunObj, job, { conflictResolution, isDryRun, maxConcurrency }) {
    const { runData, abortController } = activeRunObj;
    const startTime = Date.now();

    try {
      for (let i = 0; i < job.steps.length; i++) {
        if (abortController.signal.aborted) {
          runData.status = 'stopped';
          break;
        }

        const step = job.steps[i];
        runData.currentStepIndex = i;
        runData.currentStep = {
          stepIndex: i + 1,
          totalSteps: job.steps.length,
          source: step.source,
          destination: step.destination,
          operation: step.operation || 'copy',
          exclude: step.exclude || []
        };

        const stepMsg = `[Step ${i + 1}/${job.steps.length}] Starting ${step.operation.toUpperCase()}: "${step.source}" -> "${step.destination}"`;
        this.emitLog(activeRunObj, 'step_start', stepMsg, { stepIndex: i + 1, source: step.source, destination: step.destination });

        const stepResult = await fileTransferService.executeStep({
          step,
          conflictResolution,
          isDryRun,
          maxConcurrency,
          abortSignal: abortController.signal,
          onProgress: (event) => {
            this.handleStepProgress(activeRunObj, event, i + 1);
          }
        });

        runData.stepResults.push({
          stepIndex: i + 1,
          source: step.source,
          destination: step.destination,
          operation: step.operation,
          stats: stepResult.stats,
          errors: stepResult.errors,
          aborted: stepResult.aborted
        });

        if (stepResult.errors && stepResult.errors.length > 0) {
          runData.errors.push(...stepResult.errors);
        }

        if (stepResult.aborted) {
          runData.status = 'stopped';
          break;
        }
      }

      // Final status determination
      if (runData.status !== 'stopped') {
        if (runData.errors.length > 0) {
          runData.status = 'partial';
        } else {
          runData.status = 'success';
        }
      }

    } catch (err) {
      runData.status = 'failed';
      runData.errors.push({ file: 'Execution Engine', error: err.message });
      this.emitLog(activeRunObj, 'fatal_error', `Fatal error during execution: ${err.message}`);
    } finally {
      runData.finishedAt = new Date().toISOString();
      runData.durationMs = Date.now() - startTime;

      const completionMsg = `=== Execution ${runData.status.toUpperCase()}: ${runData.jobName} in ${fileUtils.formatDuration(runData.durationMs)} ===\n` +
        `Total Processed: ${runData.stats.processed} | Copied: ${runData.stats.copied} | Skipped: ${runData.stats.skipped} | Failed: ${runData.stats.failed} | Data: ${fileUtils.formatBytes(runData.stats.bytes)}`;

      this.emitLog(activeRunObj, 'execution_finish', completionMsg, {
        status: runData.status,
        duration: runData.durationMs,
        stats: runData.stats
      });

      // Update database
      if (!isDryRun) {
        await databaseService.updateJobStatus(job.id, 'idle', runData.startedAt);
      }
      await databaseService.updateHistoryEntry(runData.id, runData);

      logger.info(`Execution completed: ${runData.id} (${runData.status})`);

      // Clean up after small delay to let clients receive final events
      setTimeout(() => {
        for (const client of activeRunObj.sseClients) {
          try {
            client.end();
          } catch {}
        }
        this.activeRuns.delete(runData.id);
      }, 30000);
    }
  }

  handleStepProgress(activeRunObj, event, stepNumber) {
    const { runData } = activeRunObj;

    // Recalculate accumulated stats
    if (event.stats) {
      // Re-sum stats from step progress
      const prevStepsProcessed = runData.stepResults.reduce((acc, s) => acc + (s.stats.processed || 0), 0);
      const prevStepsCopied = runData.stepResults.reduce((acc, s) => acc + (s.stats.copied || 0), 0);
      const prevStepsSkipped = runData.stepResults.reduce((acc, s) => acc + (s.stats.skipped || 0), 0);
      const prevStepsFailed = runData.stepResults.reduce((acc, s) => acc + (s.stats.failed || 0), 0);
      const prevStepsBytes = runData.stepResults.reduce((acc, s) => acc + (s.stats.bytesTransferred || 0), 0);

      runData.stats.processed = prevStepsProcessed + (event.stats.processed || 0);
      runData.stats.copied = prevStepsCopied + (event.stats.copied || 0);
      runData.stats.skipped = prevStepsSkipped + (event.stats.skipped || 0);
      runData.stats.failed = prevStepsFailed + (event.stats.failed || 0);
      runData.stats.bytes = prevStepsBytes + (event.stats.bytesTransferred || 0);
    }

    let logMessage = '';
    let logType = 'info';

    switch (event.type) {
      case 'scan_start':
        logMessage = `🔍 ${event.message}`;
        logType = 'info';
        break;
      case 'file_success':
        logMessage = `✓ [${event.action.toUpperCase()}] ${event.file} (${fileUtils.formatBytes(event.size)})`;
        logType = 'success';
        break;
      case 'file_skipped':
        logMessage = `⊘ [SKIPPED] ${event.file} ${event.reason ? `(${event.reason})` : ''}`;
        logType = 'skip';
        break;
      case 'dry_run_file':
        const icon = event.action === 'skip' ? '⊘' : (event.action === 'replace' ? '⟳' : '✓');
        logMessage = `${icon} [WOULD ${event.action.toUpperCase()}] ${event.file} (${fileUtils.formatBytes(event.size)})`;
        logType = event.action === 'skip' ? 'skip' : 'success';
        break;
      case 'file_error':
        logMessage = `✗ [ERROR] ${event.file}: ${event.error}`;
        logType = 'error';
        break;
      case 'move_cleanup_start':
      case 'move_cleanup_finish':
        logMessage = `🧹 ${event.message}`;
        logType = 'info';
        break;
      default:
        if (event.message) logMessage = event.message;
    }

    if (logMessage) {
      this.emitLog(activeRunObj, logType, logMessage, {
        step: stepNumber,
        file: event.file,
        stats: runData.stats
      });
    }
  }

  emitLog(activeRunObj, type, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logItem = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp,
      type, // 'info', 'success', 'skip', 'error', 'step_start', 'execution_finish'
      message,
      meta
    };

    activeRunObj.logBuffer.push(logItem);
    if (activeRunObj.logBuffer.length > 1000) {
      activeRunObj.logBuffer.shift();
    }

    // Persist to execution log file
    logger.logExecution(activeRunObj.runData.id, `[${type.toUpperCase()}] ${message}`);

    // Broadcast SSE to connected clients
    const payload = JSON.stringify({
      type: 'log',
      log: logItem,
      runData: activeRunObj.runData
    });

    for (const client of activeRunObj.sseClients) {
      try {
        client.write(`data: ${payload}\n\n`);
      } catch (err) {
        activeRunObj.sseClients.delete(client);
      }
    }
  }

  stopExecution(runId) {
    const active = this.activeRuns.get(runId);
    if (!active) return false;
    active.abortController.abort();
    active.runData.status = 'stopped';
    this.emitLog(active, 'warn', '⚠️ Stop signal received from user. Stopping transfers...');
    return true;
  }

  /**
   * Registers a client response stream for SSE
   */
  registerSSEClient(runId, res) {
    const active = this.activeRuns.get(runId);
    if (!active) {
      // If run already ended, return false
      return false;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    res.write(`data: ${JSON.stringify({ type: 'init', runData: active.runData, logs: active.logBuffer })}\n\n`);
    active.sseClients.add(res);

    res.on('close', () => {
      active.sseClients.delete(res);
    });

    return true;
  }
}

module.exports = new ExecutionService();
