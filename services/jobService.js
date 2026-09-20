const databaseService = require('./databaseService');
const fileTransferService = require('./fileTransferService');
const pathUtils = require('../utils/pathUtils');

class JobService {
  async getAllJobs() {
    return await databaseService.getJobs();
  }

  async getJobById(id) {
    return await databaseService.getJobById(id);
  }

  validateJobPayload(data) {
    const errors = [];

    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      errors.push('Job name is required.');
    }

    if (!data.steps || !Array.isArray(data.steps) || data.steps.length === 0) {
      errors.push('Job must contain at least one transfer step.');
    } else {
      data.steps.forEach((step, index) => {
        const stepVal = fileTransferService.validateStep(step);
        if (!stepVal.valid) {
          errors.push(`Step ${index + 1}: ${stepVal.error}`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async createJob(jobData) {
    const validation = this.validateJobPayload(jobData);
    if (!validation.valid) {
      const error = new Error(validation.errors.join(' '));
      error.validationErrors = validation.errors;
      throw error;
    }

    // Clean step data
    const cleanedSteps = jobData.steps.map((step, idx) => ({
      id: step.id || `step_${idx + 1}_${Date.now()}`,
      source: pathUtils.normalizePath(step.source),
      destination: pathUtils.normalizePath(step.destination),
      operation: (step.operation || 'copy').toLowerCase(),
      exclude: Array.isArray(step.exclude)
        ? step.exclude.map(e => e.trim()).filter(Boolean)
        : (typeof step.exclude === 'string' ? step.exclude.split('\n').map(e => e.trim()).filter(Boolean) : [])
    }));

    return await databaseService.saveJob({
      name: jobData.name.trim(),
      description: jobData.description ? jobData.description.trim() : '',
      steps: cleanedSteps,
      conflictResolution: jobData.conflictResolution || 'replace_if_newer'
    });
  }

  async updateJob(id, jobData) {
    const existing = await databaseService.getJobById(id);
    if (!existing) {
      throw new Error(`Job "${id}" not found.`);
    }

    const validation = this.validateJobPayload(jobData);
    if (!validation.valid) {
      const error = new Error(validation.errors.join(' '));
      error.validationErrors = validation.errors;
      throw error;
    }

    const cleanedSteps = jobData.steps.map((step, idx) => ({
      id: step.id || `step_${idx + 1}_${Date.now()}`,
      source: pathUtils.normalizePath(step.source),
      destination: pathUtils.normalizePath(step.destination),
      operation: (step.operation || 'copy').toLowerCase(),
      exclude: Array.isArray(step.exclude)
        ? step.exclude.map(e => e.trim()).filter(Boolean)
        : (typeof step.exclude === 'string' ? step.exclude.split('\n').map(e => e.trim()).filter(Boolean) : [])
    }));

    return await databaseService.saveJob({
      id,
      name: jobData.name.trim(),
      description: jobData.description ? jobData.description.trim() : '',
      steps: cleanedSteps,
      conflictResolution: jobData.conflictResolution || existing.conflictResolution || 'replace_if_newer'
    });
  }

  async deleteJob(id) {
    return await databaseService.deleteJob(id);
  }

  async duplicateJob(id) {
    const existing = await databaseService.getJobById(id);
    if (!existing) {
      throw new Error(`Job "${id}" not found.`);
    }

    const cloneData = {
      name: `${existing.name} (Copy)`,
      description: existing.description,
      steps: existing.steps.map((step, idx) => ({
        ...step,
        id: `step_${idx + 1}_${Date.now()}`
      })),
      conflictResolution: existing.conflictResolution
    };

    return await this.createJob(cloneData);
  }
}

module.exports = new JobService();
