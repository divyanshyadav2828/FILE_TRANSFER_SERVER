const assert = require('assert');
const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const fileTransferService = require('../services/fileTransferService');
const exclusionService = require('../services/exclusionService');
const databaseService = require('../services/databaseService');
const pathUtils = require('../utils/pathUtils');
const fileUtils = require('../utils/fileUtils');

const TEST_BASE = path.join(__dirname, 'temp_test_env');
const TEST_SRC = path.join(TEST_BASE, 'TestSource');
const TEST_DEST = path.join(TEST_BASE, 'TestDest');

async function setupTestDir() {
  await fsPromises.rm(TEST_BASE, { recursive: true, force: true });
  await fsPromises.mkdir(TEST_SRC, { recursive: true });
  await fsPromises.mkdir(path.join(TEST_SRC, 'node_modules'), { recursive: true });
  await fsPromises.mkdir(path.join(TEST_SRC, 'logs'), { recursive: true });
  await fsPromises.mkdir(path.join(TEST_SRC, 'folder'), { recursive: true });
  await fsPromises.mkdir(path.join(TEST_SRC, 'src', 'test'), { recursive: true });

  await fsPromises.writeFile(path.join(TEST_SRC, 'file1.txt'), 'Content 1');
  await fsPromises.writeFile(path.join(TEST_SRC, 'file2.txt'), 'Content 2');
  await fsPromises.writeFile(path.join(TEST_SRC, 'node_modules', 'test.txt'), 'Module file');
  await fsPromises.writeFile(path.join(TEST_SRC, 'logs', 'app.log'), 'Log content');
  await fsPromises.writeFile(path.join(TEST_SRC, 'debug.log'), 'Debug log content');
  await fsPromises.writeFile(path.join(TEST_SRC, 'folder', 'data.txt'), 'Data content');
  await fsPromises.writeFile(path.join(TEST_SRC, 'src', 'test', 'test.js'), 'Test file');
}

async function cleanupTestDir() {
  await fsPromises.rm(TEST_BASE, { recursive: true, force: true });
}

async function runAllTests() {
  console.log('====================================================');
  console.log('  RUNNING FILEFLOW AUTOMATED TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    process.stdout.write(`• ${name}... `);
    try {
      await fn();
      console.log('✓ PASSED');
      passed++;
    } catch (err) {
      console.log('✗ FAILED');
      console.error(err);
      failed++;
    }
  }

  // 1. Exclusion Service Tests
  await test('Exclusion Engine: exact names, wildcards, relative paths', async () => {
    const rules = ['node_modules', '.git', '*.log', 'src/test', '.env'];
    const compiled = exclusionService.compileRules(rules);

    assert.strictEqual(exclusionService.shouldExclude('node_modules', true, compiled).excluded, true);
    assert.strictEqual(exclusionService.shouldExclude('node_modules/express/index.js', false, compiled).excluded, true);
    assert.strictEqual(exclusionService.shouldExclude('app.log', false, compiled).excluded, true);
    assert.strictEqual(exclusionService.shouldExclude('logs/app.log', false, compiled).excluded, true);
    assert.strictEqual(exclusionService.shouldExclude('src/test/unit.js', false, compiled).excluded, true);
    assert.strictEqual(exclusionService.shouldExclude('src/app.js', false, compiled).excluded, false);
    assert.strictEqual(exclusionService.shouldExclude('package.json', false, compiled).excluded, false);
  });

  // 2. Path Validation & Self-Copy Protection
  await test('Path Utils: Self-copy & Subdirectory loop protection', async () => {
    assert.strictEqual(pathUtils.isSameOrSubPath('C:\\Project', 'C:\\Project'), true);
    assert.strictEqual(pathUtils.isSameOrSubPath('C:\\Project', 'C:\\Project\\Backup'), true);
    assert.strictEqual(pathUtils.isSameOrSubPath('C:\\Project', 'C:\\OtherProject'), false);

    const stepValid = fileTransferService.validateStep({
      source: 'C:\\Project',
      destination: 'C:\\Project\\sub',
      operation: 'copy'
    });
    assert.strictEqual(stepValid.valid, false);
    assert.match(stepValid.error, /Destination cannot be inside the Source directory/i);
  });

  // 3. Section 31 Acceptance Test: Recursive Copy with Exclusions
  await test('Section 31 Acceptance Test: Recursive COPY with Exclusions', async () => {
    await setupTestDir();

    const copyStep = {
      source: TEST_SRC,
      destination: TEST_DEST,
      operation: 'copy',
      exclude: ['node_modules', 'logs', '*.log', 'src/test']
    };

    const result = await fileTransferService.executeStep({
      step: copyStep,
      conflictResolution: 'replace_if_newer',
      isDryRun: false
    });

    assert.strictEqual(result.errors.length, 0, 'No errors should occur');
    assert.strictEqual(await fileUtils.fileExists(path.join(TEST_DEST, 'file1.txt')), true);
    assert.strictEqual(await fileUtils.fileExists(path.join(TEST_DEST, 'file2.txt')), true);
    assert.strictEqual(await fileUtils.fileExists(path.join(TEST_DEST, 'folder', 'data.txt')), true);

    // Excluded files must NOT exist in destination
    assert.strictEqual(await fileUtils.fileExists(path.join(TEST_DEST, 'node_modules')), false);
    assert.strictEqual(await fileUtils.fileExists(path.join(TEST_DEST, 'logs')), false);
    assert.strictEqual(await fileUtils.fileExists(path.join(TEST_DEST, 'debug.log')), false);
    assert.strictEqual(await fileUtils.fileExists(path.join(TEST_DEST, 'src', 'test')), false);

    // Source files must still exist after COPY
    assert.strictEqual(await fileUtils.fileExists(path.join(TEST_SRC, 'file1.txt')), true);
  });

  // 4. Safe MOVE Operation Test
  await test('Safe MOVE Operation: transfers files and cleans source (excludes untouched)', async () => {
    await setupTestDir();
    const moveDest = path.join(TEST_BASE, 'TestMoveDest');

    const moveStep = {
      source: TEST_SRC,
      destination: moveDest,
      operation: 'move',
      exclude: ['node_modules', '*.log']
    };

    const result = await fileTransferService.executeStep({
      step: moveStep,
      conflictResolution: 'replace_if_newer',
      isDryRun: false
    });

    assert.strictEqual(result.errors.length, 0);
    // Dest has files
    assert.strictEqual(await fileUtils.fileExists(path.join(moveDest, 'file1.txt')), true);
    assert.strictEqual(await fileUtils.fileExists(path.join(moveDest, 'folder', 'data.txt')), true);

    // Transferred source files removed
    assert.strictEqual(await fileUtils.fileExists(path.join(TEST_SRC, 'file1.txt')), false);
    assert.strictEqual(await fileUtils.fileExists(path.join(TEST_SRC, 'file2.txt')), false);

    // Excluded source files must REMAIN in source
    assert.strictEqual(await fileUtils.fileExists(path.join(TEST_SRC, 'node_modules', 'test.txt')), true);
    assert.strictEqual(await fileUtils.fileExists(path.join(TEST_SRC, 'debug.log')), true);
  });

  // 5. Conflict Resolution: replace_if_newer vs skip
  await test('Conflict Resolution Engine: skip vs replace_if_newer', async () => {
    await setupTestDir();
    const dest = path.join(TEST_BASE, 'ConflictDest');
    await fsPromises.mkdir(dest, { recursive: true });

    // Pre-create destination file with older timestamp
    const targetFile = path.join(dest, 'file1.txt');
    await fsPromises.writeFile(targetFile, 'Existing older content');

    // Test SKIP mode
    const skipStep = {
      source: TEST_SRC,
      destination: dest,
      operation: 'copy',
      exclude: ['node_modules', 'logs', '*.log', 'src/test']
    };

    const skipResult = await fileTransferService.executeStep({
      step: skipStep,
      conflictResolution: 'skip',
      isDryRun: false
    });

    assert.strictEqual(skipResult.stats.skipped >= 1, true);
    assert.strictEqual(await fsPromises.readFile(targetFile, 'utf8'), 'Existing older content');

    // Test REPLACE mode
    const replaceResult = await fileTransferService.executeStep({
      step: skipStep,
      conflictResolution: 'replace',
      isDryRun: false
    });

    assert.strictEqual(replaceResult.stats.replaced >= 1, true);
    assert.strictEqual(await fsPromises.readFile(targetFile, 'utf8'), 'Content 1');
  });

  // 6. Dry Run Test
  await test('Dry Run Simulation: scans accurately without writing files', async () => {
    await setupTestDir();
    const dryDest = path.join(TEST_BASE, 'DryDest');

    const dryStep = {
      source: TEST_SRC,
      destination: dryDest,
      operation: 'copy',
      exclude: ['node_modules', '*.log']
    };

    const dryResult = await fileTransferService.executeStep({
      step: dryStep,
      conflictResolution: 'replace_if_newer',
      isDryRun: true
    });

    assert.strictEqual(dryResult.isDryRun, true);
    assert.strictEqual(dryResult.stats.copied > 0, true);
    assert.strictEqual(dryResult.stats.skipped > 0, true);

    // Destination must NOT have been created
    assert.strictEqual(await fileUtils.fileExists(dryDest), false);
  });

  // 7. Abort Controller / Stop Support
  await test('AbortController: cancels running transfers gracefully', async () => {
    await setupTestDir();
    const abortDest = path.join(TEST_BASE, 'AbortDest');
    const controller = new AbortController();

    controller.abort(); // Abort immediately

    const step = {
      source: TEST_SRC,
      destination: abortDest,
      operation: 'copy',
      exclude: []
    };

    const res = await fileTransferService.executeStep({
      step,
      isDryRun: false,
      abortSignal: controller.signal
    });

    assert.strictEqual(res.aborted, true);
  });

  // 8. Database Persistence & Atomic Operations
  await test('Database Service: Atomic CRUD and History', async () => {
    await databaseService.init();

    const newJob = await databaseService.saveJob({
      name: 'Automated Test Job',
      description: 'Test Description',
      steps: [
        {
          source: TEST_SRC,
          destination: TEST_DEST,
          operation: 'copy',
          exclude: ['node_modules']
        }
      ]
    });

    assert.strictEqual(newJob.name, 'Automated Test Job');
    assert.strictEqual(newJob.steps.length, 1);

    const fetched = await databaseService.getJobById(newJob.id);
    assert.strictEqual(fetched.id, newJob.id);

    await databaseService.deleteJob(newJob.id);
    const deleted = await databaseService.getJobById(newJob.id);
    assert.strictEqual(deleted, null);
  });

  await cleanupTestDir();

  console.log('\n====================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
