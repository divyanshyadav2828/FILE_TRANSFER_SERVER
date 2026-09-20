const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const config = require('../config/config');
const logger = require('../utils/logger');

class DatabaseService {
  constructor() {
    this.dbPath = config.DATABASE_PATH;
    this.writeQueue = Promise.resolve();
    this.memoryCache = null;
  }

  getDefaultLocations() {
    const userProfile = process.env.USERPROFILE || (process.platform === 'win32' ? 'C:\\Users\\Default' : process.env.HOME || '/');
    const now = new Date().toISOString();
    return [
      {
        id: 'loc_desktop',
        name: 'Desktop Folder',
        path: path.join(userProfile, 'Desktop'),
        description: 'Windows Desktop Directory',
        createdAt: now
      },
      {
        id: 'loc_downloads',
        name: 'Downloads Folder',
        path: path.join(userProfile, 'Downloads'),
        description: 'Windows Downloads Directory',
        createdAt: now
      },
      {
        id: 'loc_docs',
        name: 'Documents Folder',
        path: path.join(userProfile, 'Documents'),
        description: 'Windows User Documents Directory',
        createdAt: now
      }
    ];
  }

  async init() {
    try {
      await fsPromises.mkdir(config.DATA_DIR, { recursive: true });
      const exists = await fsPromises.access(this.dbPath).then(() => true).catch(() => false);
      if (!exists) {
        const initialData = {
          settings: {
            version: 1,
            defaultConflict: config.DEFAULTS.conflictResolution,
            defaultOperation: config.DEFAULTS.operation,
            maxConcurrency: config.DEFAULTS.maxConcurrency,
            logLevel: config.DEFAULTS.logLevel,
            theme: config.DEFAULTS.theme,
            confirmMove: config.DEFAULTS.confirmMove
          },
          locations: this.getDefaultLocations(),
          jobs: [],
          history: []
        };
        await this.writeAtomic(initialData);
        this.memoryCache = initialData;
        logger.info('Initialized new JSON database at ' + this.dbPath);
      } else {
        await this.readDb();
      }
    } catch (err) {
      logger.error('Failed to initialize database:', err);
      throw err;
    }
  }

  async readDb() {
    try {
      const raw = await fsPromises.readFile(this.dbPath, 'utf8');
      this.memoryCache = JSON.parse(raw);
      return this.memoryCache;
    } catch (err) {
      if (err.code === 'ENOENT') {
        await this.init();
        return this.memoryCache;
      }
      logger.error('Error reading JSON database, attempting recovery:', err);
      throw err;
    }
  }

  async writeAtomic(data) {
    const tempPath = `${this.dbPath}.tmp.${Date.now()}`;
    const serialized = JSON.stringify(data, null, 2);
    await fsPromises.writeFile(tempPath, serialized, 'utf8');
    await fsPromises.rename(tempPath, this.dbPath);
    this.memoryCache = data;
  }

  async mutate(fn) {
    // Chain writes sequentially to prevent race conditions
    this.writeQueue = this.writeQueue.then(async () => {
      const data = await this.readDb();
      const result = await fn(data);
      await this.writeAtomic(data);
      return result;
    });
    return this.writeQueue;
  }

  // --- Settings ---
  async getSettings() {
    const db = await this.readDb();
    return db.settings || {};
  }

  async updateSettings(updates) {
    return this.mutate((db) => {
      db.settings = { ...db.settings, ...updates };
      return db.settings;
    });
  }

  // --- Locations ---
  async getLocations() {
    const db = await this.readDb();
    return db.locations || [];
  }

  async getLocationById(id) {
    const db = await this.readDb();
    return (db.locations || []).find(l => l.id === id) || null;
  }

  async saveLocation(locationData) {
    return this.mutate((db) => {
      if (!db.locations) db.locations = [];
      const existingIdx = db.locations.findIndex(l => l.id === locationData.id);
      const now = new Date().toISOString();

      if (existingIdx >= 0) {
        db.locations[existingIdx] = {
          ...db.locations[existingIdx],
          ...locationData,
          updatedAt: now
        };
        return db.locations[existingIdx];
      } else {
        const newLocation = {
          id: locationData.id || `loc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: locationData.name || 'Unnamed Location',
          path: locationData.path,
          description: locationData.description || '',
          createdAt: now,
          updatedAt: now
        };
        db.locations.push(newLocation);
        return newLocation;
      }
    });
  }

  async deleteLocation(id) {
    return this.mutate((db) => {
      if (!db.locations) return false;
      const initialLen = db.locations.length;
      db.locations = db.locations.filter(l => l.id !== id);
      return db.locations.length < initialLen;
    });
  }

  // --- Jobs ---
  async getJobs() {
    const db = await this.readDb();
    return db.jobs || [];
  }

  async getJobById(id) {
    const db = await this.readDb();
    return (db.jobs || []).find(j => j.id === id) || null;
  }

  async saveJob(jobData) {
    return this.mutate((db) => {
      if (!db.jobs) db.jobs = [];
      const existingIdx = db.jobs.findIndex(j => j.id === jobData.id);
      const now = new Date().toISOString();

      if (existingIdx >= 0) {
        db.jobs[existingIdx] = {
          ...db.jobs[existingIdx],
          ...jobData,
          updatedAt: now
        };
        return db.jobs[existingIdx];
      } else {
        const newJob = {
          id: jobData.id || `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: jobData.name || 'Untitled Job',
          description: jobData.description || '',
          steps: jobData.steps || [],
          conflictResolution: jobData.conflictResolution || db.settings.defaultConflict || 'replace_if_newer',
          status: 'idle',
          lastRunAt: null,
          createdAt: now,
          updatedAt: now
        };
        db.jobs.push(newJob);
        return newJob;
      }
    });
  }

  async updateJobStatus(id, status, lastRunAt = null) {
    return this.mutate((db) => {
      const job = (db.jobs || []).find(j => j.id === id);
      if (job) {
        job.status = status;
        if (lastRunAt) job.lastRunAt = lastRunAt;
        job.updatedAt = new Date().toISOString();
      }
      return job;
    });
  }

  async deleteJob(id) {
    return this.mutate((db) => {
      if (!db.jobs) return false;
      const initialLen = db.jobs.length;
      db.jobs = db.jobs.filter(j => j.id !== id);
      return db.jobs.length < initialLen;
    });
  }

  // --- History ---
  async getHistory(filters = {}) {
    const db = await this.readDb();
    let list = db.history || [];

    if (filters.jobId) {
      list = list.filter(h => h.jobId === filters.jobId);
    }
    if (filters.status) {
      list = list.filter(h => h.status === filters.status);
    }
    // Sort newest first
    list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    return list;
  }

  async getHistoryById(id) {
    const db = await this.readDb();
    return (db.history || []).find(h => h.id === id) || null;
  }

  async addHistoryEntry(entry) {
    return this.mutate((db) => {
      if (!db.history) db.history = [];
      const historyItem = {
        id: entry.id || `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        jobId: entry.jobId,
        jobName: entry.jobName,
        isDryRun: !!entry.isDryRun,
        startedAt: entry.startedAt || new Date().toISOString(),
        finishedAt: entry.finishedAt || null,
        durationMs: entry.durationMs || 0,
        status: entry.status || 'running', // 'success', 'partial', 'failed', 'stopped'
        steps: entry.steps || [],
        stats: {
          processed: entry.stats?.processed || 0,
          copied: entry.stats?.copied || 0,
          skipped: entry.stats?.skipped || 0,
          failed: entry.stats?.failed || 0,
          bytes: entry.stats?.bytes || 0
        },
        errors: entry.errors || []
      };
      db.history.unshift(historyItem);
      // Keep last 500 history entries to keep database clean and fast
      if (db.history.length > 500) {
        db.history = db.history.slice(0, 500);
      }
      return historyItem;
    });
  }

  async updateHistoryEntry(id, updates) {
    return this.mutate((db) => {
      const idx = (db.history || []).findIndex(h => h.id === id);
      if (idx >= 0) {
        db.history[idx] = {
          ...db.history[idx],
          ...updates
        };
        return db.history[idx];
      }
      return null;
    });
  }

  async deleteHistoryEntry(id) {
    return this.mutate((db) => {
      if (!db.history) return false;
      const initialLen = db.history.length;
      db.history = db.history.filter(h => h.id !== id);
      return db.history.length < initialLen;
    });
  }

  async clearHistory() {
    return this.mutate((db) => {
      db.history = [];
      return true;
    });
  }
}

module.exports = new DatabaseService();
