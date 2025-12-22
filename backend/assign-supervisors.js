const { db } = require('./config/db');

async function assignSupervisors() {
  try {
    console.log('Starting supervisor assignment...');

    // Get all departments
    const [departments] = await db.query('SELECT id, name FROM departments');

    for (const dept of departments) {
      console.log(`\nProcessing department: ${dept.name}`);

      // Get first supervisor in this department
      const [supervisors] = await db.query(
        'SELECT id, name FROM users WHERE department_id = ? AND role = ? LIMIT 1',
        [dept.id, 'Supervisor']
      );

      if (supervisors.length === 0) {
        console.log(`  ⚠️  No supervisor found in ${dept.name}`);
        continue;
      }

      const supervisor = supervisors[0];
      console.log(`  ✓ Found supervisor: ${supervisor.name} (ID: ${supervisor.id})`);

      // Update all employees in this department who don't have a supervisor
      const [result] = await db.query(
        `UPDATE users 
         SET supervisor_id = ? 
         WHERE department_id = ? 
         AND role = 'Employee' 
         AND (supervisor_id IS NULL OR supervisor_id = 0)`,
        [supervisor.id, dept.id]
      );

      console.log(`  ✓ Updated ${result.affectedRows} employees`);
    }

    console.log('\n✅ Supervisor assignment complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

assignSupervisors();
