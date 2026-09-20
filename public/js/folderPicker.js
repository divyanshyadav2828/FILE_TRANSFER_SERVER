/**
 * FileFlow - Windows Folder Explorer Modal Logic
 */

let folderPickerCallback = null;
let currentExplorerPath = '';

window.openFolderExplorer = async function(initialPath = '', onSelect) {
  folderPickerCallback = onSelect;
  const modal = document.getElementById('folderExplorerModal');
  if (!modal) return;

  modal.style.display = 'flex';
  await loadExplorerDrives();
  await browseFolder(initialPath);
};

window.closeFolderExplorer = function() {
  const modal = document.getElementById('folderExplorerModal');
  if (modal) modal.style.display = 'none';
  folderPickerCallback = null;
};

async function loadExplorerDrives() {
  const drivesBar = document.getElementById('explorerDrivesBar');
  if (!drivesBar) return;

  try {
    const res = await fetch('/api/explorer/drives');
    const data = await res.json();
    if (data.success) {
      let html = '';

      // Render Shortcuts
      if (data.shortcuts && data.shortcuts.length > 0) {
        html += '<div class="explorer-shortcuts-group">';
        html += data.shortcuts.map(s => {
          let iconSvg = '';
          if (s.name === 'Desktop') {
            iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
          } else if (s.name === 'Downloads') {
            iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
          } else if (s.name === 'Documents') {
            iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
          } else {
            iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
          }
          return `
            <button type="button" class="drive-btn shortcut-btn" data-path="${s.path}" title="${s.path}">
              ${iconSvg}
              <span>${s.name}</span>
            </button>
          `;
        }).join('');
        html += '</div>';
      }

      // Render Drive Letters
      if (data.drives && data.drives.length > 0) {
        html += '<div class="explorer-drives-group">';
        html += data.drives.map(d => `
          <button type="button" class="drive-btn" data-path="${d.path}" title="${d.label}">
            ${d.drive}
          </button>
        `).join('');
        html += '</div>';
      }

      drivesBar.innerHTML = html;

      drivesBar.querySelectorAll('.drive-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          browseFolder(btn.dataset.path);
        });
      });
    }
  } catch (err) {
    console.error('Error loading drives and shortcuts:', err);
  }
}

async function browseFolder(targetPath) {
  const itemsContainer = document.getElementById('explorerItemsList');
  const currentPathInput = document.getElementById('explorerCurrentPathInput');
  const selectedDisplay = document.getElementById('explorerSelectedDisplay');
  const upBtn = document.getElementById('explorerUpBtn');

  itemsContainer.innerHTML = `
    <div class="explorer-loading text-center p-4">
      <span class="spinner"></span>
      <p class="text-muted text-xs mt-2">Loading directory...</p>
    </div>
  `;

  try {
    const url = targetPath ? `/api/explorer/browse?path=${encodeURIComponent(targetPath)}` : '/api/explorer/browse';
    const res = await fetch(url);
    const data = await res.json();

    if (!data.success) {
      itemsContainer.innerHTML = `
        <div class="p-4 text-center text-danger">
          <p>${data.error || 'Failed to open directory.'}</p>
        </div>
      `;
      return;
    }

    currentExplorerPath = data.currentPath;
    currentPathInput.value = data.currentPath;
    selectedDisplay.textContent = data.currentPath;

    // Up button state
    if (data.parentPath) {
      upBtn.disabled = false;
      upBtn.onclick = () => browseFolder(data.parentPath);
    } else {
      upBtn.disabled = true;
    }

    // Highlight active drive
    document.querySelectorAll('.drive-btn').forEach(btn => {
      const drivePath = btn.dataset.drivePath;
      if (currentExplorerPath.toLowerCase().startsWith(drivePath.toLowerCase())) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (data.items.length === 0) {
      itemsContainer.innerHTML = `
        <div class="p-4 text-center text-muted">
          <p>Empty folder or no subfolders found.</p>
        </div>
      `;
      return;
    }

    itemsContainer.innerHTML = data.items.map(item => `
      <div class="explorer-item ${item.isDir ? 'is-dir' : 'is-file'}" data-path="${item.path}" data-is-dir="${item.isDir}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${item.isDir
            ? '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>'
            : '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'}
        </svg>
        <span class="text-truncate">${item.name}</span>
      </div>
    `).join('');

    itemsContainer.querySelectorAll('.explorer-item').forEach(el => {
      // Single click: select
      el.addEventListener('click', () => {
        itemsContainer.querySelectorAll('.explorer-item').forEach(i => i.classList.remove('selected'));
        el.classList.add('selected');
        currentExplorerPath = el.dataset.path;
        selectedDisplay.textContent = el.dataset.path;
      });

      // Double click: open folder
      el.addEventListener('dblclick', () => {
        if (el.dataset.isDir === 'true') {
          browseFolder(el.dataset.path);
        }
      });
    });

  } catch (err) {
    itemsContainer.innerHTML = `
      <div class="p-4 text-center text-danger">
        <p>Error: ${err.message}</p>
      </div>
    `;
  }
}

// Controls
document.getElementById('explorerGoBtn')?.addEventListener('click', () => {
  const pathVal = document.getElementById('explorerCurrentPathInput').value.trim();
  if (pathVal) browseFolder(pathVal);
});

document.getElementById('explorerCurrentPathInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const pathVal = e.target.value.trim();
    if (pathVal) browseFolder(pathVal);
  }
});

// Create New Folder inside explorer
document.getElementById('explorerNewFolderBtn')?.addEventListener('click', async () => {
  const folderName = prompt('Enter name for the new folder:');
  if (!folderName || !folderName.trim()) return;

  const newPath = currentExplorerPath + (currentExplorerPath.endsWith('\\') || currentExplorerPath.endsWith('/') ? '' : '\\') + folderName.trim();

  try {
    const res = await fetch('/api/explorer/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: newPath })
    });
    const data = await res.json();
    if (data.success) {
      browseFolder(newPath);
      window.showToast('New folder created.', 'success');
    } else {
      window.showToast(data.error || 'Could not create folder', 'error');
    }
  } catch (err) {
    window.showToast(err.message, 'error');
  }
});

// Confirm Selection
document.getElementById('explorerSelectConfirmBtn')?.addEventListener('click', () => {
  if (folderPickerCallback && currentExplorerPath) {
    folderPickerCallback(currentExplorerPath);
  }
  window.closeFolderExplorer();
});
