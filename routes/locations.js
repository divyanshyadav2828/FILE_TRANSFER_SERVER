const express = require('express');
const router = express.Router();
const locationService = require('../services/locationService');

// GET /api/locations - Get all locations
router.get('/', async (req, res) => {
  try {
    const locations = await locationService.getAllLocations();
    res.json({ success: true, locations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/locations - Create new location
router.post('/', async (req, res) => {
  try {
    const location = await locationService.saveLocation(req.body);
    res.status(201).json({ success: true, location });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/locations/:id - Get location by id
router.get('/:id', async (req, res) => {
  try {
    const location = await locationService.getLocationById(req.params.id);
    if (!location) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }
    res.json({ success: true, location });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/locations/:id - Update location
router.put('/:id', async (req, res) => {
  try {
    const location = await locationService.saveLocation({
      id: req.params.id,
      ...req.body
    });
    res.json({ success: true, location });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/locations/:id - Delete location
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await locationService.deleteLocation(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }
    res.json({ success: true, message: 'Location deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
