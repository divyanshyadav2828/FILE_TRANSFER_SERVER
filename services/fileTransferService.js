const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const exclusionService = require('./exclusionService');
const pathUtils = require('../utils/pathUtils');
const fileUtils = require('../utils/fileUtils');
const logger = require('../utils/logger');

class FileTransferService {
  /**
   * Scans the source directory recursively, taking exclusions into account.
   * Returns list of { fullPath, relPath, isDir, size, mtime }
   */
  async scanSource(sourcePath, compiledRules, abortSignal = null) {
    const items = [];
    const normSource = pathUtils.normalizePath(sourcePath);

    const sourceStat = await fileUtils.getFileStats(normSource);
    if (!sourceStat) {
      throw new Error(`Source path does not exist: "${sourcePath}"`);
    }

    if (!sourceStat.isDirectory()) {
      // Single file source
      const fileName = path.basename(normSource);
      const { excluded, rule } = exclusionService.shouldExclude(fileName, false, compiledRules);
      if (!excluded) {
        items.push({
          fullPath: normSource,
          relPath: fileName,
          isDir: false,
          size: sourceStat.size,
          mtime: sourceStat.mtimeMs
        });
      }
      return { isSingleFile: true, items };
    }

    async function walk(currentDir, currentRel) {
      if (abortSignal && abortSignal.aborted) {
        throw new Error('Scan aborted by user');
      }

      let entries;
      try {
        entries = await fsPromises.readdir(currentDir, { withFileTypes: true });
      } catch (err) {
        logger.warn(`Could not read directory ${currentDir}: ${err.message}`);
        return;
      }

      for (const entry of entries) {
        if (abortSignal && abortSignal.aborted) {
          throw new Error('Scan aborted by user');
        }

        const entryRel = currentRel ? path.join(currentRel, entry.name) : entry.name;
        const entryFull = path.join(currentDir, entry.name);
        const isDir = entry.isDirectory();

        const { excluded, rule } = exclusionService.shouldExclude(entryRel, isDir, compiledRules);

        if (excluded) {
          // If directory is excluded, do not recurse into it
          items.push({
            fullPath: entryFull,
            relPath: entryRel,
            isDir,
            excluded: true,
            excludeRule: rule,
            size: 0,
            mtime: 0
          });
          continue;
        }

        if (isDir) {
          items.push({
            fullPath: entryFull,
            relPath: entryRel,
            isDir: true,
            excluded: false,
            size: 0,
            mtime: 0
          });
          await walk(entryFull, entryRel);
        } else {
          let stat;
          try {
            stat = await fsPromises.stat(entryFull);
          } catch {
            stat = { size: 0, mtimeMs: 0 };
          }
          items.push({
            fullPath: entryFull,
            relPath: entryRel,
            isDir: false,
            excluded: false,
            size: stat.size || 0,
            mtime: stat.mtimeMs || 0
          });
        }
      }
    }

    await walk(normSource, '');
    return { isSingleFile: false, items };
  }

  /**
   * Validates a step before execution.
   */
  validateStep(step) {
    const { source, destination, operation } = step;

    if (!source || !source.trim()) {
      return { valid: false, error: 'Source path is required.' };
    }
    if (!destination || !destination.trim()) {
      return { valid: false, error: 'Destination path is required.' };
    }

    const normSource = pathUtils.normalizePath(source);
    const normDest = pathUtils.normalizePath(destination);

    if (normSource.toLowerCase() === normDest.toLowerCase()) {
      return { valid: false, error: 'Source and Destination paths cannot be identical.' };
    }

    if (pathUtils.isSameOrSubPath(normSource, normDest)) {
      return { valid: false, error: 'Destination cannot be inside the Source directory (self-copy protection).' };
    }

    if (operation && !['copy', 'move'].includes(operation.toLowerCase())) {
      return { valid: false, error: `Invalid operation "${operation}". Must be "copy" or "move".` };
    }

    return { valid: true, normSource, normDest };
  }

  /**
   * Executes a transfer step (or runs dry-run if isDryRun is true).
   */
  async executeStep({
    step,
    conflictResolution = 'replace_if_newer',
    isDryRun = false,
    maxConcurrency = 4,
    abortSignal = null,
    onProgress = () => {}
  }) {
    const validation = this.validateStep(step);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const { normSource, normDest } = validation;
    const operation = (step.operation || 'copy').toLowerCase();
    const exclusions = step.exclude || [];
    const compiledRules = exclusionService.compileRules(exclusions);

    // Initial stats
    const stats = {
      totalFound: 0,
      processed: 0,
      copied: 0,
      skipped: 0,
      replaced: 0,
      failed: 0,
      bytesTransferred: 0,
      totalBytes: 0
    };

    const errors = [];
    const sourceStat = await fileUtils.getFileStats(normSource);
    if (!sourceStat) {
      throw new Error(`Source path not found or inaccessible: "${normSource}"`);
    }

    // 1. Scan source
    onProgress({
      type: 'scan_start',
      source: normSource,
      destination: normDest,
      message: `Scanning source directory: ${normSource}...`
    });

    let scanResult;
    try {
      scanResult = await this.scanSource(normSource, compiledRules, abortSignal);
    } catch (err) {
      if (abortSignal && abortSignal.aborted) {
        onProgress({
          type: 'aborted',
          message: 'Step execution was aborted by user.',
          stats
        });
        return { stats, errors, aborted: true };
      }
      throw err;
    }

    const { isSingleFile, items } = scanResult;

    const nonExcludedFiles = items.filter(i => !i.isDir && !i.excluded);
    const excludedItems = items.filter(i => i.excluded);
    const directories = items.filter(i => i.isDir && !i.excluded);

    stats.totalFound = items.length;
    stats.totalBytes = nonExcludedFiles.reduce((acc, f) => acc + f.size, 0);

    // Record skipped excluded items
    for (const item of excludedItems) {
      stats.skipped++;
      stats.processed++;
      onProgress({
        type: 'file_skipped',
        file: item.relPath,
        reason: `Excluded by rule: ${item.excludeRule}`,
        isDir: item.isDir,
        stats
      });
    }

    if (isDryRun) {
      // Perform dry-run checks
      for (const file of nonExcludedFiles) {
        if (abortSignal && abortSignal.aborted) break;

        const destFile = isSingleFile
          ? (await fileUtils.isDirectory(normDest) ? path.join(normDest, path.basename(normSource)) : normDest)
          : path.join(normDest, file.relPath);

        const destStat = await fileUtils.getFileStats(destFile);
        let action = 'copy';

        if (destStat) {
          const willReplace = fileUtils.shouldReplaceFile(
            { size: file.size, mtimeMs: file.mtime },
            destStat,
            conflictResolution
          );
          if (willReplace) {
            action = 'replace';
            stats.replaced++;
          } else {
            action = 'skip';
            stats.skipped++;
          }
        } else {
          action = 'copy';
          stats.copied++;
        }

        stats.processed++;
        stats.bytesTransferred += file.size;

        onProgress({
          type: 'dry_run_file',
          file: file.relPath,
          action, // 'copy', 'replace', 'skip'
          operation,
          size: file.size,
          destPath: destFile,
          stats
        });
      }

      return { stats, errors, isDryRun: true };
    }

    // 2. Real Execution

    // Create destination root folder if not existing
    if (!isSingleFile) {
      await fileUtils.ensureDir(normDest);
      // Pre-create subdirectories
      for (const dir of directories) {
        const destDirPath = path.join(normDest, dir.relPath);
        await fileUtils.ensureDir(destDirPath);
      }
    } else {
      const destParent = (await fileUtils.isDirectory(normDest)) ? normDest : path.dirname(normDest);
      await fileUtils.ensureDir(destParent);
    }

    // Worker pool for controlled concurrency file copying
    const successfullyTransferredFiles = [];
    let fileIndex = 0;

    const runWorker = async () => {
      while (fileIndex < nonExcludedFiles.length) {
        if (abortSignal && abortSignal.aborted) {
          break;
        }

        const currentIndex = fileIndex++;
        const file = nonExcludedFiles[currentIndex];
        const destFile = isSingleFile
          ? (await fileUtils.isDirectory(normDest) ? path.join(normDest, path.basename(normSource)) : normDest)
          : path.join(normDest, file.relPath);

        try {
          const destStat = await fileUtils.getFileStats(destFile);
          let isReplacement = false;

          if (destStat) {
            const willReplace = fileUtils.shouldReplaceFile(
              { size: file.size, mtimeMs: file.mtime },
              destStat,
              conflictResolution
            );

            if (!willReplace) {
              stats.skipped++;
              stats.processed++;
              onProgress({
                type: 'file_skipped',
                file: file.relPath,
                reason: 'Destination file already exists and is up to date (conflict policy: skip)',
                stats
              });
              continue;
            }
            isReplacement = true;
          }

          onProgress({
            type: 'file_start',
            file: file.relPath,
            size: file.size,
            destPath: destFile,
            operation,
            stats
          });

          // Stream copy with abort support
          await fileUtils.copyFileStream(file.fullPath, destFile, abortSignal);

          // Verify destination file
          const verifyStat = await fileUtils.getFileStats(destFile);
          if (!verifyStat || verifyStat.size !== file.size) {
            throw new Error(`Integrity verification failed for "${destFile}" (expected ${file.size} bytes, got ${verifyStat?.size || 0} bytes)`);
          }

          if (isReplacement) {
            stats.replaced++;
          } else {
            stats.copied++;
          }
          stats.bytesTransferred += file.size;
          stats.processed++;

          successfullyTransferredFiles.push({
            src: file.fullPath,
            dest: destFile,
            relPath: file.relPath
          });

          onProgress({
            type: 'file_success',
            file: file.relPath,
            size: file.size,
            destPath: destFile,
            action: isReplacement ? 'replaced' : 'copied',
            operation,
            stats
          });

        } catch (err) {
          stats.failed++;
          stats.processed++;
          const errorMsg = `Failed transferring "${file.relPath}": ${err.message}`;
          errors.push({ file: file.relPath, error: err.message });

          onProgress({
            type: 'file_error',
            file: file.relPath,
            error: err.message,
            stats
          });
        }
      }
    };

    const workerCount = Math.max(1, Math.min(maxConcurrency, nonExcludedFiles.length || 1));
    const workers = Array.from({ length: workerCount }, () => runWorker());
    await Promise.all(workers);

    if (abortSignal && abortSignal.aborted) {
      onProgress({
        type: 'aborted',
        message: 'Step execution was aborted by user.',
        stats
      });
      return { stats, errors, aborted: true };
    }

    // 3. Move cleanup (Only delete successfully transferred files from source!)
    if (operation === 'move' && successfullyTransferredFiles.length > 0) {
      onProgress({
        type: 'move_cleanup_start',
        message: `Cleaning up ${successfullyTransferredFiles.length} successfully moved source files...`
      });

      for (const item of successfullyTransferredFiles) {
        try {
          await fsPromises.unlink(item.src);
        } catch (err) {
          logger.warn(`Could not remove source file after move: ${item.src} (${err.message})`);
        }
      }

      // If entire folder transfer, clean empty source subdirectories
      if (!isSingleFile) {
        // Sort directories deepest first
        const sortedDirs = [...directories].sort((a, b) => b.relPath.length - a.relPath.length);
        for (const dir of sortedDirs) {
          try {
            await fileUtils.cleanEmptyDirs(dir.fullPath, normSource);
          } catch {}
        }
        // Try cleaning root source dir if empty
        try {
          await fileUtils.cleanEmptyDirs(normSource, path.dirname(normSource));
        } catch {}
      }

      onProgress({
        type: 'move_cleanup_finish',
        message: 'Source cleanup completed.'
      });
    }

    return { stats, errors, aborted: false };
  }
}

module.exports = new FileTransferService();
