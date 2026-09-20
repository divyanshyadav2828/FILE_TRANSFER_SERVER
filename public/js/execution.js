/**
 * FileFlow - Real-time Live Execution Monitor Script (SSE)
 */

document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.execution-page-container');
  if (!container) return;

  const runId = container.dataset.runId;
  const initialIsActive = container.dataset.isActive === 'true';

  // Elements
  const statusBadge = document.getElementById('executionStatusBadge');
  const progressFill = document.getElementById('progressFill');
  const progressPercentageLabel = document.getElementById('progressPercentageLabel');
  const currentFileName = document.getElementById('currentFileName');
  const currentStepNum = document.getElementById('currentStepNum');
  const totalStepsNum = document.getElementById('totalStepsNum');
  const stepPathFlow = document.getElementById('stepPathFlow');

  const statProcessed = document.getElementById('statProcessed');
  const statCopied = document.getElementById('statCopied');
  const statSkipped = document.getElementById('statSkipped');
  const statFailed = document.getElementById('statFailed');
  const statBytes = document.getElementById('statBytes');
  const statDuration = document.getElementById('statDuration');

  const terminalLog = document.getElementById('terminalLogContainer');
  const terminalPlaceholder = document.getElementById('terminalPlaceholder');
  const autoScrollCheckbox = document.getElementById('autoScrollCheckbox');
  const stopExecutionBtn = document.getElementById('stopExecutionBtn');
  const completionBanner = document.getElementById('completionBanner');
  const completionTitle = document.getElementById('completionTitle');
  const completionMessage = document.getElementById('completionMessage');
  const completionIconWrapper = document.getElementById('completionIconWrapper');

  let currentFilter = 'all';
  let startTime = window.CURRENT_RUN_DATA?.startedAt ? new Date(window.CURRENT_RUN_DATA.startedAt).getTime() : Date.now();
  let durationInterval = null;

  // Format Helpers
  function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const idx = Math.min(i, sizes.length - 1);
    return `${parseFloat((bytes / Math.pow(k, idx)).toFixed(dm))} ${sizes[idx]}`;
  }

  function formatDuration(ms) {
    if (!ms || ms < 0) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  function formatTimeOnly(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour12: false });
  }

  function updateDuration() {
    if (statusBadge.textContent.trim().toLowerCase() === 'running') {
      const elapsed = Date.now() - startTime;
      statDuration.textContent = formatDuration(elapsed);
    }
  }

  durationInterval = setInterval(updateDuration, 1000);

  function appendLog(logItem) {
    if (terminalPlaceholder) {
      terminalPlaceholder.style.display = 'none';
    }

    const line = document.createElement('div');
    line.className = `log-line log-${logItem.type || 'info'}`;
    line.dataset.logType = logItem.type;

    // Filter check
    if (currentFilter !== 'all' && logItem.type !== currentFilter) {
      line.style.display = 'none';
    }

    line.innerHTML = `
      <span class="log-time">[${formatTimeOnly(logItem.timestamp)}]</span>
      <span class="log-text">${escapeHtml(logItem.message)}</span>
    `;

    terminalLog.appendChild(line);

    if (autoScrollCheckbox.checked) {
      terminalLog.scrollTop = terminalLog.scrollHeight;
    }
  }

  function updateStatus(status) {
    const s = status.toLowerCase();
    statusBadge.textContent = status.toUpperCase();
    statusBadge.className = 'badge';

    if (s === 'running') {
      statusBadge.classList.add('badge-warning', 'pulse');
      if (stopExecutionBtn) stopExecutionBtn.style.display = 'inline-flex';
    } else if (s === 'success') {
      statusBadge.classList.add('badge-success');
      if (stopExecutionBtn) stopExecutionBtn.style.display = 'none';
      showCompletion(true, 'Transfer Completed Successfully!', 'All configured transfer steps finished with 0 errors.');
    } else if (s === 'partial') {
      statusBadge.classList.add('badge-warning');
      if (stopExecutionBtn) stopExecutionBtn.style.display = 'none';
      showCompletion(false, 'Job Completed with Warnings / Errors', 'Some files could not be transferred. Check the error list for details.');
    } else if (s === 'failed') {
      statusBadge.classList.add('badge-danger');
      if (stopExecutionBtn) stopExecutionBtn.style.display = 'none';
      showCompletion(false, 'Transfer Failed', 'An error halted the transfer pipeline.');
    } else if (s === 'stopped') {
      statusBadge.classList.add('badge-subtle');
      if (stopExecutionBtn) stopExecutionBtn.style.display = 'none';
      showCompletion(false, 'Execution Stopped by User', 'Transfer operation was cancelled before completion.');
    }
  }

  function updateStats(runData) {
    if (!runData) return;

    if (runData.stats) {
      const stats = runData.stats;
      statProcessed.textContent = stats.processed || 0;
      statCopied.textContent = (stats.copied || 0) + (stats.replaced || 0);
      statSkipped.textContent = stats.skipped || 0;
      statFailed.textContent = stats.failed || 0;
      statBytes.textContent = formatBytes(stats.bytes || 0);

      // Percentage calculation
      let pct = 0;
      if (stats.processed > 0 && stats.totalFound > 0) {
        pct = Math.min(100, Math.round((stats.processed / stats.totalFound) * 100));
      } else if (runData.status === 'success') {
        pct = 100;
      } else if (stats.processed > 0) {
        pct = 50; // In progress
      }

      progressFill.style.width = `${pct}%`;
      progressPercentageLabel.textContent = `${pct}%`;
    }

    if (runData.currentStep) {
      currentStepNum.textContent = runData.currentStep.stepIndex || 1;
      totalStepsNum.textContent = runData.totalSteps || 1;
      stepPathFlow.innerHTML = `
        <span class="source-tag">${escapeHtml(runData.currentStep.source)}</span>
        <span class="arrow-tag">→</span>
        <span class="dest-tag">${escapeHtml(runData.currentStep.destination)}</span>
        <span class="badge badge-subtle badge-xs">${(runData.currentStep.operation || 'COPY').toUpperCase()}</span>
      `;
    }

    if (runData.durationMs) {
      statDuration.textContent = formatDuration(runData.durationMs);
    }
  }

  function showCompletion(isSuccess, title, message) {
    clearInterval(durationInterval);
    if (!completionBanner) return;

    completionBanner.style.display = 'block';
    completionBanner.style.borderLeftColor = isSuccess ? 'var(--success)' : 'var(--warning)';
    completionTitle.textContent = title;
    completionMessage.textContent = message;

    completionIconWrapper.innerHTML = isSuccess
      ? `<div class="stat-icon stat-success"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg></div>`
      : `<div class="stat-icon stat-warning"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>`;
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Connect to SSE Stream
  function connectSSE() {
    const eventSource = new EventSource(`/api/execution/${runId}/events`);

    eventSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);

        if (payload.type === 'init') {
          updateStatus(payload.runData.status);
          updateStats(payload.runData);
          if (payload.logs && Array.isArray(payload.logs)) {
            terminalLog.innerHTML = '';
            payload.logs.forEach(appendLog);
          }
        } else if (payload.type === 'log') {
          if (payload.log) appendLog(payload.log);
          if (payload.runData) {
            updateStatus(payload.runData.status);
            updateStats(payload.runData);
            if (payload.log?.meta?.file) {
              currentFileName.textContent = payload.log.meta.file;
            }
          }
        } else if (payload.type === 'completed') {
          updateStatus(payload.runData.status);
          updateStats(payload.runData);
          eventSource.close();
        }
      } catch (err) {
        console.error('Error handling SSE payload:', err);
      }
    };

    eventSource.onerror = () => {
      // SSE connection closed or finished
      eventSource.close();
      // Check status one final time via REST
      fetch(`/api/execution/${runId}/status`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.runData) {
            updateStatus(data.runData.status);
            updateStats(data.runData);
          }
        })
        .catch(() => {});
    };
  }

  connectSSE();

  // Stop Execution
  stopExecutionBtn?.addEventListener('click', () => {
    window.showConfirmModal(
      'Stop Execution',
      'Are you sure you want to stop this transfer job? In-flight files will finish cleanly and remaining files will be cancelled.',
      async () => {
        try {
          const res = await fetch(`/api/execution/${runId}/stop`, { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            window.showToast('Stop signal sent to transfer engine.', 'info');
          } else {
            window.showToast(data.error || 'Could not stop execution', 'error');
          }
        } catch (err) {
          window.showToast(err.message, 'error');
        }
      }
    );
  });

  // Log Filtering
  document.querySelectorAll('.log-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.log-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;

      document.querySelectorAll('.log-line').forEach(line => {
        if (currentFilter === 'all') {
          line.style.display = 'flex';
        } else {
          line.style.display = line.dataset.logType === currentFilter ? 'flex' : 'none';
        }
      });
    });
  });

  // Clear log window
  document.getElementById('clearLogViewBtn')?.addEventListener('click', () => {
    terminalLog.innerHTML = `
      <div class="terminal-log-placeholder">
        <span>Log window cleared by user.</span>
      </div>
    `;
  });
});
