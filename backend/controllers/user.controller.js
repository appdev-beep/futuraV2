const { createUser, listUsers } = require('../services/user.service');

// GET /api/users
async function getAll(req, res, next) {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
}

// POST /api/users
async function create(req, res, next) {
  try {
    const {
      employee_id,
      name,
      email,
      position_id,
      department_id,
      role,
      password
    } = req.body;

    if (!employee_id || !email || !position_id || !department_id || !role || !password) {
      return res.status(400).json({
        message:
          'employee_id, email, position_id, department_id, role, and password are required'
      });
    }

    const user = await createUser({
      employee_id,
      name: name || null,
      email,
      position_id,
      department_id,
      role,
      password
    });

    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAll,
  create
};
