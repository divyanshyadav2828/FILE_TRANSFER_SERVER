/**
 * FileFlow - Dashboard Interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  // Run Job Triggers on Dashboard
  document.querySelectorAll('.btn-run-job').forEach(btn => {
    btn.addEventListener('click', async () => {
      const jobId = btn.dataset.jobId;

      try {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-sm"></span> <span>Starting...</span>`;

        const res = await fetch(`/api/jobs/${jobId}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();

        if (data.success && data.runId) {
          window.location.href = `/execution/${data.runId}`;
        } else {
          window.showToast(data.error || 'Failed to start job', 'error');
          btn.disabled = false;
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><polygon points="5 3 19 12 5 21 5 3"/></svg> <span>Run</span>`;
        }
      } catch (err) {
        window.showToast(err.message, 'error');
        btn.disabled = false;
      }
    });
  });

  // Dry Run Triggers on Dashboard
  document.querySelectorAll('.btn-dry-run-job').forEach(btn => {
    btn.addEventListener('click', async () => {
      const jobId = btn.dataset.jobId;

      try {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-sm"></span> <span>Simulating...</span>`;

        const res = await fetch(`/api/jobs/${jobId}/dry-run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();

        if (data.success && data.runId) {
          window.location.href = `/execution/${data.runId}`;
        } else {
          window.showToast(data.error || 'Dry run simulation failed', 'error');
          btn.disabled = false;
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg> <span>Dry Run</span>`;
        }
      } catch (err) {
        window.showToast(err.message, 'error');
        btn.disabled = false;
      }
    });
  });
});
