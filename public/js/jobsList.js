/**
 * FileFlow - Jobs List Management & Filtering
 */

document.addEventListener('DOMContentLoaded', () => {
  // Search filtering
  const searchInput = document.getElementById('jobsSearchInput');
  const statusFilter = document.getElementById('jobsStatusFilter');
  const jobRows = document.querySelectorAll('.job-row');

  function filterJobs() {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const status = statusFilter ? statusFilter.value : 'all';

    jobRows.forEach(row => {
      const name = row.dataset.jobName || '';
      const hasRuns = row.dataset.hasRuns === 'true';

      let matchSearch = !query || name.includes(query) || row.textContent.toLowerCase().includes(query);
      let matchStatus = true;

      if (status === 'has_runs') matchStatus = hasRuns;
      if (status === 'never_run') matchStatus = !hasRuns;

      if (matchSearch && matchStatus) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  }

  searchInput?.addEventListener('input', filterJobs);
  statusFilter?.addEventListener('change', filterJobs);

  // Run Job Triggers
  document.querySelectorAll('.btn-run-job').forEach(btn => {
    btn.addEventListener('click', async () => {
      const jobId = btn.dataset.jobId;
      const jobName = btn.dataset.jobName;

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

  // Dry Run Triggers
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

  // Duplicate Job
  document.querySelectorAll('.btn-duplicate-job').forEach(btn => {
    btn.addEventListener('click', async () => {
      const jobId = btn.dataset.jobId;
      try {
        const res = await fetch(`/api/jobs/${jobId}/duplicate`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          window.showToast('Job duplicated successfully!', 'success');
          setTimeout(() => window.location.reload(), 600);
        } else {
          window.showToast(data.error || 'Failed to duplicate job', 'error');
        }
      } catch (err) {
        window.showToast(err.message, 'error');
      }
    });
  });

  // Delete Job
  document.querySelectorAll('.btn-delete-job').forEach(btn => {
    btn.addEventListener('click', () => {
      const jobId = btn.dataset.jobId;
      const jobName = btn.dataset.jobName;

      window.showConfirmModal(
        'Delete Transfer Job',
        `Are you sure you want to delete <strong>${jobName}</strong>? This action cannot be undone.`,
        async () => {
          try {
            const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
              window.showToast('Job deleted successfully.', 'success');
              setTimeout(() => window.location.reload(), 600);
            } else {
              window.showToast(data.error || 'Failed to delete job', 'error');
            }
          } catch (err) {
            window.showToast(err.message, 'error');
          }
        }
      );
    });
  });
});
