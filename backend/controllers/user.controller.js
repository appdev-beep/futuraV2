const { createUser, listUsers, deleteUser, getUserById, updateUser } = require('../services/user.service');

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
      password,
      supervisor_id
    } = req.body;

    if (!employee_id || !email || !position_id || !department_id || !role || !password) {
      return res.status(400).json({
        message:
          'employee_id, email, position_id, department_id, role, and password are required'
      });
    }

    // Validate that Employee role has a supervisor
    if (role === 'Employee' && !supervisor_id) {
      return res.status(400).json({
        message: 'Employees must have a supervisor assigned'
      });
    }

    const user = await createUser({
      employee_id,
      name: name || null,
      email,
      position_id,
      department_id,
      role,
      password,
      supervisor_id: supervisor_id || null
    });

    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/users/:id
async function deleteById(req, res, next) {
  try {
    const { id } = req.params;
    const result = await deleteUser(id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/users/:id
async function getById(req, res, next) {
  try {
    const { id } = req.params;

    // Allow access if requesting own profile or admin
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (String(req.user.id) !== String(id) && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const user = await getUserById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

// PUT /api/users/:id
async function update(req, res, next) {
  try {
    const { id } = req.params;
    const {
      employee_id,
      name,
      email,
      position_id,
      department_id,
      role,
      password,
      supervisor_id
    } = req.body;

    if (!employee_id || !email || !position_id || !department_id || !role) {
      return res.status(400).json({
        message: 'employee_id, email, position_id, department_id, and role are required'
      });
    }

    // Validate that Employee role has a supervisor
    if (role === 'Employee' && !supervisor_id) {
      return res.status(400).json({
        message: 'Employees must have a supervisor assigned'
      });
    }

    const user = await updateUser(id, {
      employee_id,
      name: name || null,
      email,
      position_id,
      department_id,
      role,
      password: password || undefined,
      supervisor_id: supervisor_id || null
    });

    res.json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAll,
  create,
  deleteById,
  getById,
  update
};
