/**
 * FileFlow - Multi-Step Job Builder Form Logic
 */

let stepsData = [];
const PRESET_EXCLUSIONS = ['node_modules', '.git', '*.log', '*.tmp', '.env', 'temp', 'Thumbs.db', 'build'];

function initJobForm() {
  const initialJob = window.INITIAL_JOB_DATA;
  if (initialJob && initialJob.steps && initialJob.steps.length > 0) {
    stepsData = initialJob.steps.map(s => ({
      id: s.id,
      source: s.source || '',
      destination: s.destination || '',
      operation: s.operation || 'copy',
      exclude: Array.isArray(s.exclude) ? [...s.exclude] : []
    }));
  } else {
    // Add default initial step
    stepsData = [
      {
        id: `step_1_${Date.now()}`,
        source: '',
        destination: '',
        operation: 'copy',
        exclude: ['node_modules', '.git', '*.log']
      }
    ];
  }

  renderSteps();
}

function renderSteps() {
  const container = document.getElementById('stepsContainer');
  if (!container) return;

  const locations = window.INITIAL_SAVED_LOCATIONS || [];

  container.innerHTML = stepsData.map((step, index) => {
    const isOnlyStep = stepsData.length === 1;
    const isMove = step.operation === 'move';

    return `
      <div class="step-card" data-step-index="${index}" id="stepCard_${index}">
        <div class="step-card-header">
          <div class="step-card-title">
            <span class="step-badge">STEP ${index + 1}</span>
            <span class="font-semibold text-sm">Sequential Transfer Step</span>
          </div>
          ${!isOnlyStep ? `
            <button type="button" class="btn btn-ghost btn-xs text-danger btn-remove-step" data-step-index="${index}" title="Remove this transfer step">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              <span>Remove Step</span>
            </button>
          ` : ''}
        </div>

        <div class="step-card-body">
          <div class="step-path-row">
            <!-- Source Input -->
            <div class="form-group mb-0">
              <div class="d-flex justify-between align-center mb-1">
                <label class="form-label required mb-0">Source Directory / File</label>
                ${locations.length > 0 ? `
                  <select class="form-control form-control-sm select-saved-loc" data-target-type="source" data-step-index="${index}" style="width: auto; padding: 2px 6px; font-size: 0.75rem;">
                    <option value="">Quick Fill Saved Location...</option>
                    ${locations.map(l => `<option value="${l.path}">${l.name}</option>`).join('')}
                  </select>
                ` : ''}
              </div>
              <div class="input-with-action">
                <input type="text" class="form-control mono-font step-source-input" data-step-index="${index}" placeholder="C:\\Projects\\MyApp" value="${escapeHtml(step.source)}" required />
                <button type="button" class="btn btn-secondary btn-browse-source" data-step-index="${index}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                  <span>Browse</span>
                </button>
              </div>
            </div>

            <!-- Destination Input -->
            <div class="form-group mb-0">
              <div class="d-flex justify-between align-center mb-1">
                <label class="form-label required mb-0">Destination Directory</label>
                ${locations.length > 0 ? `
                  <select class="form-control form-control-sm select-saved-loc" data-target-type="dest" data-step-index="${index}" style="width: auto; padding: 2px 6px; font-size: 0.75rem;">
                    <option value="">Quick Fill Saved Location...</option>
                    ${locations.map(l => `<option value="${l.path}">${l.name}</option>`).join('')}
                  </select>
                ` : ''}
              </div>
              <div class="input-with-action">
                <input type="text" class="form-control mono-font step-dest-input" data-step-index="${index}" placeholder="D:\\Backup\\MyApp" value="${escapeHtml(step.destination)}" required />
                <button type="button" class="btn btn-secondary btn-browse-dest" data-step-index="${index}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                  <span>Browse</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Operation Selector -->
          <div class="form-group mt-3">
            <label class="form-label font-semibold mb-1">Operation</label>
            <div class="operation-toggle-group">
              <label class="operation-radio">
                <input type="radio" name="operation_${index}" value="copy" data-step-index="${index}" ${!isMove ? 'checked' : ''} />
                <span><strong>Copy</strong> (Keep original files in source)</span>
              </label>
              <label class="operation-radio">
                <input type="radio" name="operation_${index}" value="move" data-step-index="${index}" ${isMove ? 'checked' : ''} />
                <span><strong class="text-warning">Move / Cut</strong> (Delete from source only after verified destination transfer)</span>
              </label>
            </div>
          </div>

          <!-- Exclusions Manager -->
          <div class="exclusion-manager">
            <div class="d-flex justify-between align-center mb-1">
              <label class="form-label text-sm mb-0">Excluded Files & Directories</label>
              <span class="text-xs text-muted">Exact names, relative paths, or wildcards (*.log, *.tmp)</span>
            </div>

            <div class="exclusion-presets">
              <span class="text-xs text-muted" style="align-self: center; margin-right: 4px;">Presets:</span>
              ${PRESET_EXCLUSIONS.map(p => `
                <button type="button" class="preset-chip" data-step-index="${index}" data-preset="${p}">+ ${p}</button>
              `).join('')}
            </div>

            <div class="exclusion-tags-container" id="exclusionTags_${index}" data-step-index="${index}">
              ${step.exclude.map((ex, exIdx) => `
                <span class="exclusion-tag">
                  <span>${escapeHtml(ex)}</span>
                  <span class="exclusion-tag-remove" data-step-index="${index}" data-exclude-index="${exIdx}">×</span>
                </span>
              `).join('')}
              <input type="text" class="exclusion-tag-input" data-step-index="${index}" placeholder="Type exclusion and press Enter or comma..." />
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  attachStepEventListeners();
}

function attachStepEventListeners() {
  // Remove step
  document.querySelectorAll('.btn-remove-step').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.stepIndex, 10);
      stepsData.splice(idx, 1);
      renderSteps();
    });
  });

  // Source & Destination Input sync
  document.querySelectorAll('.step-source-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.stepIndex, 10);
      stepsData[idx].source = e.target.value;
    });
  });

  document.querySelectorAll('.step-dest-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.stepIndex, 10);
      stepsData[idx].destination = e.target.value;
    });
  });

  // Saved location selector
  document.querySelectorAll('.select-saved-loc').forEach(select => {
    select.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.stepIndex, 10);
      const targetType = e.target.dataset.targetType;
      const pathVal = e.target.value;
      if (!pathVal) return;

      if (targetType === 'source') {
        stepsData[idx].source = pathVal;
      } else {
        stepsData[idx].destination = pathVal;
      }
      renderSteps();
    });
  });

  // Browse Folder Buttons
  document.querySelectorAll('.btn-browse-source').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.stepIndex, 10);
      window.openFolderExplorer(stepsData[idx].source, (selectedPath) => {
        stepsData[idx].source = selectedPath;
        renderSteps();
      });
    });
  });

  document.querySelectorAll('.btn-browse-dest').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.stepIndex, 10);
      window.openFolderExplorer(stepsData[idx].destination, (selectedPath) => {
        stepsData[idx].destination = selectedPath;
        renderSteps();
      });
    });
  });

  // Operation radio change
  document.querySelectorAll('.operation-radio input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.stepIndex, 10);
      stepsData[idx].operation = e.target.value;
    });
  });

  // Preset chips
  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const idx = parseInt(chip.dataset.stepIndex, 10);
      const preset = chip.dataset.preset;
      if (!stepsData[idx].exclude.includes(preset)) {
        stepsData[idx].exclude.push(preset);
        renderSteps();
      }
    });
  });

  // Exclusion Tag Removal
  document.querySelectorAll('.exclusion-tag-remove').forEach(removeBtn => {
    removeBtn.addEventListener('click', () => {
      const stepIdx = parseInt(removeBtn.dataset.stepIndex, 10);
      const exIdx = parseInt(removeBtn.dataset.excludeIndex, 10);
      stepsData[stepIdx].exclude.splice(exIdx, 1);
      renderSteps();
    });
  });

  // Exclusion Tag Input (Enter / Comma)
  document.querySelectorAll('.exclusion-tag-input').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = input.value.trim().replace(/^,+|,+$/g, '');
        const stepIdx = parseInt(input.dataset.stepIndex, 10);
        if (val && !stepsData[stepIdx].exclude.includes(val)) {
          stepsData[stepIdx].exclude.push(val);
          renderSteps();
        }
      } else if (e.key === 'Backspace' && input.value === '') {
        const stepIdx = parseInt(input.dataset.stepIndex, 10);
        if (stepsData[stepIdx].exclude.length > 0) {
          stepsData[stepIdx].exclude.pop();
          renderSteps();
        }
      }
    });
  });
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Add Step
document.getElementById('addStepBtn')?.addEventListener('click', () => {
  stepsData.push({
    id: `step_${stepsData.length + 1}_${Date.now()}`,
    source: '',
    destination: '',
    operation: 'copy',
    exclude: ['node_modules', '.git', '*.log']
  });
  renderSteps();
});

// Form Submission
document.getElementById('jobForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = document.getElementById('jobForm');
  const isEdit = form.dataset.isEdit === 'true';
  const jobId = form.dataset.jobId;

  const name = document.getElementById('jobName').value.trim();
  const description = document.getElementById('jobDescription').value.trim();
  const conflictResolution = document.getElementById('conflictResolution').value;

  if (!name) {
    window.showToast('Please enter a job name.', 'warning');
    return;
  }

  // Validate steps
  for (let i = 0; i < stepsData.length; i++) {
    const step = stepsData[i];
    if (!step.source || !step.source.trim()) {
      window.showToast(`Step ${i + 1}: Source path cannot be empty.`, 'warning');
      return;
    }
    if (!step.destination || !step.destination.trim()) {
      window.showToast(`Step ${i + 1}: Destination path cannot be empty.`, 'warning');
      return;
    }
  }

  const payload = {
    name,
    description,
    conflictResolution,
    steps: stepsData
  };

  const url = isEdit ? `/api/jobs/${jobId}` : '/api/jobs';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      window.showToast(`Job "${name}" saved successfully!`, 'success');
      setTimeout(() => {
        window.location.href = `/jobs/${data.job.id}`;
      }, 600);
    } else {
      window.showToast(data.error || 'Failed saving job', 'error');
    }
  } catch (err) {
    window.showToast(err.message, 'error');
  }
});

// Dry Run from Form
document.getElementById('formDryRunBtn')?.addEventListener('click', async () => {
  const name = document.getElementById('jobName').value.trim() || 'Unsaved Job';
  const form = document.getElementById('jobForm');
  const jobId = form.dataset.jobId;

  // If existing saved job, trigger dry-run API
  if (jobId) {
    try {
      const res = await fetch(`/api/jobs/${jobId}/dry-run`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        window.location.href = `/execution/${data.runId}`;
      } else {
        window.showToast(data.error || 'Dry run failed', 'error');
      }
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  } else {
    // Save job first then dry-run
    window.showToast('Please save the job first before executing a simulation.', 'info');
  }
});

// Init on page load
document.addEventListener('DOMContentLoaded', initJobForm);
