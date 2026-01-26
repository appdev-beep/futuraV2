const { createUser, listUsers, deleteUser, getUserById, updateUser, changeUserPassword, getSupervisorEmployeesList } = require('../services/user.service');
const { sendWelcomeEmail, sendPasswordChangeEmail } = require('../services/email.service');
const { db } = require('../config/db');

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
      supervisor_id,
      manager_id,
      am_id
    } = req.body;

    const { review_period_id } = req.body;

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
      supervisor_id: supervisor_id || null,
      manager_id: manager_id || null,
      am_id: am_id || null,
      review_period_id: review_period_id || null
    });

    // Send welcome email to the new employee with login credentials
    try {
      // Get department, position, supervisor, manager, and AM names for the email
      const [lookupRows] = await db.query(`
        SELECT 
          d.name as department_name,
          p.title as position_title,
          s.name as supervisor_name,
          m.name as manager_name,
          am.name as am_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN positions p ON u.position_id = p.id
        LEFT JOIN users s ON u.supervisor_id = s.id
        LEFT JOIN users m ON u.manager_id = m.id
        LEFT JOIN users am ON u.am_id = am.id
        WHERE u.id = ?
      `, [user.id]);

      const lookupData = lookupRows[0] || {};

      // Send welcome email (don't wait for it to complete)
      sendWelcomeEmail({
        employeeId: employee_id,
        name: name || email.split('@')[0], // Fallback to email prefix if no name
        email,
        password, // Send the plain password before it gets hashed
        departmentName: lookupData.department_name,
        positionTitle: lookupData.position_title,
        supervisorName: lookupData.supervisor_name,
        managerName: lookupData.manager_name,
        amName: lookupData.am_name,
        role
      }).catch(err => {
        console.error('Failed to send welcome email:', err);
        // Don't fail the request if email fails
      });
    } catch (emailError) {
      console.error('Error preparing welcome email:', emailError);
      // Continue with response even if email preparation fails
    }

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


    // Allow access if requesting own profile, admin, or supervisor of the user
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Allow access if requesting own profile
    if (String(req.user.id) === String(id)) {
      // Self can access
    } else if (['Admin', 'HR', 'Manager', 'AM'].includes(req.user.role)) {
      // Admin, HR, Manager, and AM can access any user's profile
    } else if (req.user.role === 'Supervisor') {
      // Supervisor may access only their direct reports
      const user = await getUserById(id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (String(user.supervisor_id) !== String(req.user.id)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      // continue, user is supervised by requester
    } else {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const user = await getUserById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

// GET /api/users/public/:id - limited public info for any authenticated user
async function getPublicById(req, res, next) {
  try {
    const { id } = req.params;
    const user = await getUserById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Return only the fields necessary for frontend forms
    const publicData = {
      id: user.id,
      employee_id: user.employee_id,
      name: user.name,
      supervisor_id: user.supervisor_id,
      manager_id: user.manager_id,
      am_id: user.am_id,
      department_id: user.department_id,
      department_name: user.department_name,
      position_id: user.position_id,
      position_title: user.position_title,
      review_period_id: user.review_period_id || null,
      review_period_name: user.review_period_name || null,
    };

    res.json(publicData);
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
      , review_period_id
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
      supervisor_id: supervisor_id || null,
      review_period_id: review_period_id || null
    });

    res.json(user);
  } catch (err) {
    next(err);
  }
}

// POST /api/users/change-password
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: 'New password must be at least 6 characters long'
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: 'New password must be different from current password'
      });
    }

    const result = await changeUserPassword(userId, currentPassword, newPassword);

    // Send password change notification email
    try {
      // Get user details for email notification
      const [userRows] = await db.query(
        'SELECT name, email, employee_id FROM users WHERE id = ?',
        [userId]
      );

      if (userRows.length > 0) {
        const user = userRows[0];
        // Send notification email (don't wait for it to complete)
        sendPasswordChangeEmail({
          name: user.name || user.email.split('@')[0], // Fallback to email prefix if no name
          email: user.email,
          employeeId: user.employee_id
        }).catch(err => {
          console.error('Failed to send password change notification email:', err);
          // Don't fail the request if email fails
        });
      }
    } catch (emailError) {
      console.error('Error preparing password change notification email:', emailError);
      // Continue with response even if email preparation fails
    }

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
}

async function getSupervisorEmployees(req, res, next) {
  try {
    const supervisorId = req.user?.id;
    if (!supervisorId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const employees = await getSupervisorEmployeesList(supervisorId);
    res.json(employees || []);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAll,
  create,
  deleteById,
  getById,
  getPublicById,
  update,
  changePassword,
  getSupervisorEmployees
};
