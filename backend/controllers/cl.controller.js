// src/controllers/cl.controller.js
const clService = require('../services/cl.service');

// GET /api/cl/:id
async function getById(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'Invalid CL id' });
    }

    const cl = await clService.getById(id);
    if (!cl) {
      return res.status(404).json({ message: 'CL not found' });
    }

    res.json(cl);
  } catch (err) {
    next(err);
  }
}

// POST /api/cl
// Body: { employee_id, supervisor_id, department_id, cycle_id }
async function create(req, res, next) {
  try {
    const { employee_id, supervisor_id, department_id, cycle_id } = req.body;

    if (!employee_id || !supervisor_id || !department_id || !cycle_id) {
      return res.status(400).json({
        message:
          'employee_id, supervisor_id, department_id, and cycle_id are required'
      });
    }

    const result = await clService.create({
      employee_id,
      supervisor_id,
      department_id,
      cycle_id
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

// PUT /api/cl/:id
// Body: { items: [ { id, assigned_level, weight, justification }, ... ] }
async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'Invalid CL id' });
    }

    const { items } = req.body;
    const result = await clService.update(id, { items: items || [] });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// PUT /api/cl/:id/submit
async function submit(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'Invalid CL id' });
    }

    const result = await clService.submit(id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getById,
  create,
  update,
  submit
};
