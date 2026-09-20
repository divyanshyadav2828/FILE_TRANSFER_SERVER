const express = require('express');
const router = express.Router();
const fsPromises = require('fs/promises');
const path = require('path');
const pathUtils = require('../utils/pathUtils');
const fileUtils = require('../utils/fileUtils');

// GET /api/explorer/drives
router.get('/drives', (req, res) => {
  try {
    const drives = pathUtils.getAvailableDrives();
    const shortcuts = pathUtils.getSystemShortcuts();
    res.json({ success: true, drives, shortcuts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/explorer/browse?path=C:\...
router.get('/browse', async (req, res) => {
  try {
    let targetPath = req.query.path;
    const drives = pathUtils.getAvailableDrives();

    if (!targetPath || !targetPath.trim()) {
      targetPath = process.env.USERPROFILE || (drives[0] ? drives[0].path : 'C:\\');
    }

    const normPath = pathUtils.normalizePath(targetPath);
    const exists = await fileUtils.fileExists(normPath);

    if (!exists) {
      return res.status(404).json({
        success: false,
        error: `Path does not exist: "${normPath}"`,
        drives,
        currentPath: normPath
      });
    }

    const isDir = await fileUtils.isDirectory(normPath);
    if (!isDir) {
      return res.json({
        success: true,
        currentPath: normPath,
        parentPath: path.dirname(normPath),
        drives,
        isFile: true,
        items: []
      });
    }

    const entries = await fsPromises.readdir(normPath, { withFileTypes: true });
    const items = [];

    for (const entry of entries) {
      // Hide system/hidden files like $RECYCLE.BIN, System Volume Information, etc. on Windows root
      if (entry.name.startsWith('$') || entry.name === 'System Volume Information') {
        continue;
      }

      const itemFullPath = path.join(normPath, entry.name);
      const isDirItem = entry.isDirectory();

      items.push({
        name: entry.name,
        path: itemFullPath,
        isDir: isDirItem
      });
    }

    // Sort folders first, alphabetically
    items.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    const parsedPath = path.parse(normPath);
    const isRoot = parsedPath.root.toLowerCase() === normPath.toLowerCase() ||
                   (parsedPath.root + '\\').toLowerCase() === normPath.toLowerCase() ||
                   normPath === '/';

    const parentPath = isRoot ? null : path.dirname(normPath);

    res.json({
      success: true,
      currentPath: normPath,
      parentPath,
      isRoot,
      drives,
      items
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/explorer/validate
router.post('/validate', async (req, res) => {
  try {
    const { path: rawPath } = req.body;
    if (!rawPath || typeof rawPath !== 'string' || !rawPath.trim()) {
      return res.json({ valid: false, error: 'Path is required.' });
    }

    const normPath = pathUtils.normalizePath(rawPath);
    const exists = await fileUtils.fileExists(normPath);
    let isDir = false;
    let fileCount = null;

    if (exists) {
      isDir = await fileUtils.isDirectory(normPath);
    }

    res.json({
      valid: true,
      exists,
      isDir,
      normalized: normPath
    });
  } catch (err) {
    res.json({ valid: false, error: err.message });
  }
});

// POST /api/explorer/mkdir
router.post('/mkdir', async (req, res) => {
  try {
    const { path: rawPath } = req.body;
    if (!rawPath) {
      return res.status(400).json({ success: false, error: 'Directory path is required.' });
    }
    const normPath = pathUtils.normalizePath(rawPath);
    await fileUtils.ensureDir(normPath);
    res.json({ success: true, path: normPath });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
