/**
 * FileFlow - Global Application Script
 */

// Theme Management
window.setTheme = function(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('fileflow_theme', theme);
};

(function initTheme() {
  const saved = localStorage.getItem('fileflow_theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
  }
})();

document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  window.setTheme(next);
});

// Toast Notifications
window.showToast = function(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'success' ? '✓' : (type === 'error' ? '✗' : (type === 'warning' ? '⚠' : 'ℹ'));
  toast.innerHTML = `
    <span style="font-weight: bold;">${icon}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

// Confirmation Modal
let confirmCallback = null;
window.showConfirmModal = function(title, message, onConfirm) {
  const modal = document.getElementById('confirmModal');
  const titleEl = document.getElementById('confirmModalTitle');
  const msgEl = document.getElementById('confirmModalMessage');
  const confirmBtn = document.getElementById('confirmModalActionBtn');

  if (!modal || !titleEl || !msgEl || !confirmBtn) return;

  titleEl.textContent = title;
  msgEl.innerHTML = message;
  confirmCallback = onConfirm;

  modal.style.display = 'flex';
};

window.closeConfirmModal = function() {
  const modal = document.getElementById('confirmModal');
  if (modal) modal.style.display = 'none';
  confirmCallback = null;
};

document.getElementById('confirmModalActionBtn')?.addEventListener('click', () => {
  if (confirmCallback) {
    confirmCallback();
  }
  window.closeConfirmModal();
});

// Dry Run Result Modal
window.showDryRunModal = function(jobName, resultData, onProceed) {
  const modal = document.getElementById('dryRunModal');
  const titleEl = document.getElementById('dryRunModalJobTitle');
  const bodyEl = document.getElementById('dryRunModalBody');
  const proceedBtn = document.getElementById('dryRunProceedRealBtn');

  if (!modal || !titleEl || !bodyEl) return;

  titleEl.textContent = `Simulation: ${jobName}`;
  const stats = resultData.stats || {};

  bodyEl.innerHTML = `
    <div class="stats-grid mb-3">
      <div class="stat-card p-3">
        <div class="stat-content">
          <div class="stat-value text-success">${stats.copied || 0}</div>
          <div class="stat-label">Would Copy</div>
        </div>
      </div>
      <div class="stat-card p-3">
        <div class="stat-content">
          <div class="stat-value text-info">${stats.skipped || 0}</div>
          <div class="stat-label">Would Skip</div>
        </div>
      </div>
      <div class="stat-card p-3">
        <div class="stat-content">
          <div class="stat-value text-warning">${stats.replaced || 0}</div>
          <div class="stat-label">Would Replace</div>
        </div>
      </div>
      <div class="stat-card p-3">
        <div class="stat-content">
          <div class="stat-value ${stats.failed > 0 ? 'text-danger' : 'text-muted'}">${stats.failed || 0}</div>
          <div class="stat-label">Potential Errors</div>
        </div>
      </div>
    </div>
    <div class="alert alert-info text-sm p-3 bg-card-subtle border rounded">
      ℹ <strong>No files were touched or modified.</strong> This simulation verified file existence, exclusion rules, and conflict handling.
    </div>
  `;

  if (proceedBtn) {
    proceedBtn.onclick = () => {
      window.closeDryRunModal();
      if (onProceed) onProceed();
    };
  }

  modal.style.display = 'flex';
};

window.closeDryRunModal = function() {
  const modal = document.getElementById('dryRunModal');
  if (modal) modal.style.display = 'none';
};

// Global Dropdown Handlers
document.addEventListener('click', (e) => {
  const toggle = e.target.closest('.dropdown-toggle');
  const allDropdowns = document.querySelectorAll('.dropdown-menu');

  if (toggle) {
    e.stopPropagation();
    const dropdown = toggle.closest('.dropdown');
    const menu = dropdown.querySelector('.dropdown-menu');
    const isOpen = menu.classList.contains('show');

    allDropdowns.forEach(m => m.classList.remove('show'));
    if (!isOpen) {
      menu.classList.add('show');
    }
  } else if (!e.target.closest('.dropdown-menu')) {
    allDropdowns.forEach(m => m.classList.remove('show'));
  }
});

// Running Jobs Global Poller (updates topbar badge)
async function checkGlobalActiveRuns() {
  try {
    const res = await fetch('/api/execution/active');
    const data = await res.json();
    const indicator = document.getElementById('globalRunningIndicator');
    const countEl = document.getElementById('globalRunningCount');

    if (data.success && data.activeRuns && data.activeRuns.length > 0) {
      if (indicator) indicator.style.display = 'inline-block';
      if (countEl) countEl.textContent = `${data.activeRuns.length} Running`;
    } else {
      if (indicator) indicator.style.display = 'none';
    }
  } catch {}
}

setInterval(checkGlobalActiveRuns, 4000);
