/**
 * FileFlow - History Page Script
 */

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('historySearchInput');
  const jobFilter = document.getElementById('historyJobFilter');
  const statusFilter = document.getElementById('historyStatusFilter');
  const rows = document.querySelectorAll('.history-row');

  function filterHistory() {
    const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const jobId = jobFilter ? jobFilter.value : '';
    const status = statusFilter ? statusFilter.value : '';

    rows.forEach(row => {
      const rowJobId = row.dataset.jobId || '';
      const rowStatus = row.dataset.status || '';
      const rowJobName = row.dataset.jobName || '';

      const matchSearch = !search || rowJobName.includes(search) || row.textContent.toLowerCase().includes(search);
      const matchJob = !jobId || rowJobId === jobId;
      const matchStatus = !status || rowStatus === status;

      if (matchSearch && matchJob && matchStatus) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  }

  searchInput?.addEventListener('input', filterHistory);
  jobFilter?.addEventListener('change', filterHistory);
  statusFilter?.addEventListener('change', filterHistory);

  // Delete Individual History Item
  document.querySelectorAll('.btn-delete-history').forEach(btn => {
    btn.addEventListener('click', () => {
      const runId = btn.dataset.runId;
      window.showConfirmModal(
        'Delete History Entry',
        'Are you sure you want to remove this execution record from history?',
        async () => {
          try {
            const res = await fetch(`/api/execution/history/${runId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
              window.showToast('Record deleted.', 'success');
              setTimeout(() => window.location.reload(), 500);
            } else {
              window.showToast(data.error || 'Failed to delete', 'error');
            }
          } catch (err) {
            window.showToast(err.message, 'error');
          }
        }
      );
    });
  });

  // Clear All History
  document.getElementById('clearAllHistoryBtn')?.addEventListener('click', () => {
    window.showConfirmModal(
      'Clear All History',
      'Are you sure you want to delete ALL execution history? This cannot be undone.',
      async () => {
        try {
          const res = await fetch('/api/execution/history', { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            window.showToast('All execution history cleared.', 'success');
            setTimeout(() => window.location.reload(), 500);
          } else {
            window.showToast(data.error || 'Failed to clear history', 'error');
          }
        } catch (err) {
          window.showToast(err.message, 'error');
        }
      }
    );
  });
});
