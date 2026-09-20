const path = require('path');
const fs = require('fs');

/**
 * Normalizes a path for consistent Windows comparison.
 * Converts to absolute, normalizes separators, trims trailing slashes (except root drives).
 */
function normalizePath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') return '';
  const trimmed = inputPath.trim();
  if (!trimmed) return '';

  let resolved = path.resolve(trimmed);
  // On Windows, ensure consistent drive letter casing
  if (process.platform === 'win32' && /^[a-zA-Z]:/.test(resolved)) {
    resolved = resolved.charAt(0).toUpperCase() + resolved.slice(1);
  }
  return resolved;
}

/**
 * Checks if targetPath is identical to, or a subfolder of, basePath.
 * Crucial for preventing infinite self-copy loops.
 * e.g., copying "C:\Project" into "C:\Project\backup" or "C:\Project"
 */
function isSameOrSubPath(basePath, targetPath) {
  const normBase = normalizePath(basePath).toLowerCase();
  const normTarget = normalizePath(targetPath).toLowerCase();

  if (!normBase || !normTarget) return false;
  if (normBase === normTarget) return true;

  // Ensure trailing separator on base for exact folder boundary match
  const baseWithSep = normBase.endsWith(path.sep) ? normBase : normBase + path.sep;
  return normTarget.startsWith(baseWithSep);
}

/**
 * Checks if two paths are on different Windows drives (e.g., C: vs D:)
 */
function isCrossDrive(path1, path2) {
  const norm1 = normalizePath(path1);
  const norm2 = normalizePath(path2);
  
  const drive1 = getDriveLetter(norm1);
  const drive2 = getDriveLetter(norm2);

  if (drive1 && drive2) {
    return drive1.toUpperCase() !== drive2.toUpperCase();
  }
  return false;
}

/**
 * Extracts the drive letter (e.g., "C:") from a Windows path.
 */
function getDriveLetter(inputPath) {
  if (!inputPath) return null;
  const match = inputPath.match(/^([a-zA-Z]):/);
  return match ? match[1].toUpperCase() + ':' : null;
}

/**
 * Validates whether a string is a potentially valid Windows path.
 */
function isValidPathFormat(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') return false;
  const trimmed = inputPath.trim();
  if (trimmed.length === 0) return false;
  // Check for illegal Windows filename/path characters in path segments (excluding : after drive)
  const withoutDrive = trimmed.replace(/^[a-zA-Z]:/, '');
  const illegalChars = /[<>"|?*]/;
  return !illegalChars.test(withoutDrive);
}

/**
 * Discovers accessible drive roots on Windows.
 */
function getAvailableDrives() {
  const drives = [];
  if (process.platform === 'win32') {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const letter of letters) {
      const driveRoot = `${letter}:\\`;
      try {
        fs.accessSync(driveRoot, fs.constants.R_OK);
        drives.push({
          drive: `${letter}:`,
          path: driveRoot,
          label: `Local Disk (${letter}:)`
        });
      } catch {
        // Drive not available or no permissions
      }
    }
  } else {
    // Non-Windows fallback for development/testing
    drives.push({ drive: '/', path: '/', label: 'Root (/)' });
  }
  return drives;
}

/**
 * Returns standard Windows user shortcuts (Desktop, Downloads, Documents, Home)
 */
function getSystemShortcuts() {
  const userProfile = process.env.USERPROFILE || (process.platform === 'win32' ? 'C:\\Users\\Default' : process.env.HOME || '/');
  const shortcuts = [
    { name: 'Desktop', path: path.join(userProfile, 'Desktop'), icon: 'desktop' },
    { name: 'Downloads', path: path.join(userProfile, 'Downloads'), icon: 'download' },
    { name: 'Documents', path: path.join(userProfile, 'Documents'), icon: 'document' },
    { name: 'User Home', path: userProfile, icon: 'user' }
  ];

  return shortcuts.filter(s => {
    try {
      fs.accessSync(s.path, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  });
}

module.exports = {
  normalizePath,
  isSameOrSubPath,
  isCrossDrive,
  getDriveLetter,
  isValidPathFormat,
  getAvailableDrives,
  getSystemShortcuts
};
