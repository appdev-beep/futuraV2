// src/controllers/lookup.controller.js
const lookupService = require('../services/lookup.service');

// GET /api/lookup/departments
async function getDepartments(req, res, next) {
  try {
    const rows = await lookupService.getDepartments();
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/lookup/positions
async function getPositions(req, res, next) {
  try {
    const rows = await lookupService.getPositions();
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/lookup/competencies
async function getCompetencies(req, res, next) {
  try {
    const rows = await lookupService.getCompetencies();
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/lookup/cycles
async function getAppraisalCycles(req, res, next) {
  try {
    const rows = await lookupService.getAppraisalCycles();
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDepartments,
  getPositions,
  getCompetencies,
  getAppraisalCycles
};
