const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const { pipeline } = require('stream/promises');

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0 || !bytes) return '0 B';
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

function formatDate(isoOrTimestamp) {
  if (!isoOrTimestamp) return 'Never';
  const d = new Date(isoOrTimestamp);
  if (isNaN(d.getTime())) return 'Invalid Date';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

async function fileExists(filePath) {
  try {
    await fsPromises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(dirPath) {
  try {
    const stat = await fsPromises.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function getFileStats(filePath) {
  try {
    return await fsPromises.stat(filePath);
  } catch {
    return null;
  }
}

async function ensureDir(dirPath) {
  try {
    await fsPromises.mkdir(dirPath, { recursive: true });
    return true;
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    return true;
  }
}

/**
 * Copies a single file using stream pipeline to handle backpressure and large files efficiently.
 */
async function copyFileStream(srcPath, destPath, abortSignal = null) {
  await ensureDir(path.dirname(destPath));

  if (abortSignal && abortSignal.aborted) {
    throw new Error('Transfer aborted by user');
  }

  const readStream = fs.createReadStream(srcPath);
  const writeStream = fs.createWriteStream(destPath);

  if (abortSignal) {
    abortSignal.addEventListener('abort', () => {
      readStream.destroy();
      writeStream.destroy();
    }, { once: true });
  }

  await pipeline(readStream, writeStream);

  // Preserve timestamps if possible
  try {
    const srcStat = await fsPromises.stat(srcPath);
    await fsPromises.utimes(destPath, srcStat.atime, srcStat.mtime);
  } catch {
    // Non-fatal if setting timestamp fails
  }
}

/**
 * Safely removes a file or empty directory
 */
async function safeDelete(targetPath) {
  try {
    const stat = await getFileStats(targetPath);
    if (!stat) return true;
    if (stat.isDirectory()) {
      await fsPromises.rmdir(targetPath);
    } else {
      await fsPromises.unlink(targetPath);
    }
    return true;
  } catch (err) {
    // If directory not empty, or in use, return false
    return false;
  }
}

/**
 * Recursively cleans empty directories up to the root path
 */
async function cleanEmptyDirs(dirPath, stopAtRoot) {
  try {
    if (dirPath === stopAtRoot || !dirPath.startsWith(stopAtRoot)) return;
    const entries = await fsPromises.readdir(dirPath);
    if (entries.length === 0) {
      await fsPromises.rmdir(dirPath);
      await cleanEmptyDirs(path.dirname(dirPath), stopAtRoot);
    }
  } catch {
    // Directory might not be empty or cannot be accessed
  }
}

/**
 * Determines whether destination file should be overwritten based on conflict mode.
 * Modes: 'replace_if_newer', 'replace', 'skip'
 */
function shouldReplaceFile(srcStat, destStat, mode = 'replace_if_newer') {
  if (!destStat) return true; // Destination does not exist -> copy
  
  if (mode === 'replace') return true;
  if (mode === 'skip') return false;
  
  if (mode === 'replace_if_newer') {
    // Source is newer if modified time is greater (allowing 1000ms jitter for filesystem mtime differences)
    // or if sizes differ
    const isNewer = (srcStat.mtimeMs - destStat.mtimeMs) > 1000;
    const sizeDiff = srcStat.size !== destStat.size;
    return isNewer || sizeDiff;
  }

  return true;
}

module.exports = {
  formatBytes,
  formatDuration,
  formatDate,
  fileExists,
  isDirectory,
  getFileStats,
  ensureDir,
  copyFileStream,
  safeDelete,
  cleanEmptyDirs,
  shouldReplaceFile
};
