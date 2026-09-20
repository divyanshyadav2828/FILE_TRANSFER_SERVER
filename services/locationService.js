const databaseService = require('./databaseService');
const pathUtils = require('../utils/pathUtils');
const fileUtils = require('../utils/fileUtils');

class LocationService {
  async getAllLocations() {
    const locations = await databaseService.getLocations();
    // Check paths existence status for UI badges
    const enriched = await Promise.all(
      locations.map(async (loc) => {
        const exists = await fileUtils.fileExists(loc.path);
        const isDir = exists ? await fileUtils.isDirectory(loc.path) : false;
        return {
          ...loc,
          exists,
          isDir
        };
      })
    );
    return enriched;
  }

  async getLocationById(id) {
    return await databaseService.getLocationById(id);
  }

  async saveLocation(data) {
    if (!data.name || !data.name.trim()) {
      throw new Error('Location name is required.');
    }
    if (!data.path || !data.path.trim()) {
      throw new Error('Location path is required.');
    }

    const normPath = pathUtils.normalizePath(data.path);

    return await databaseService.saveLocation({
      id: data.id,
      name: data.name.trim(),
      path: normPath,
      description: data.description ? data.description.trim() : ''
    });
  }

  async deleteLocation(id) {
    return await databaseService.deleteLocation(id);
  }
}

module.exports = new LocationService();
