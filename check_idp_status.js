#!/usr/bin/env node

// Script to check IDP statuses in the database
// This helps diagnose the cycle completion issue

const mysql = require('mysql2/promise');

async function checkIDPStatus() {
  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '', // Add password if needed
      database: 'futura'
    });

    console.log('🔍 Checking IDP statuses in database...\n');

    // 1. Check all IDP statuses and counts
    console.log('📊 IDP Status Summary:');
    const [statusCounts] = await connection.query(`
      SELECT status, COUNT(*) as count 
      FROM idp_headers 
      GROUP BY status 
      ORDER BY count DESC
    `);
    
    statusCounts.forEach(row => {
      console.log(`   ${row.status}: ${row.count} IDPs`);
    });

    console.log('\n' + '='.repeat(60) + '\n');

    // 2. Check specifically for FOR_COMPLETION status IDPs
    console.log('🎯 FOR_COMPLETION Status IDPs:');
    const [forCompletionIDPs] = await connection.query(`
      SELECT 
        ih.id,
        ih.status,
        u_emp.name as employee_name,
        u_emp.employee_id as employee_code,
        d.name as department_name,
        ih.created_at,
        ih.updated_at
      FROM idp_headers ih
      LEFT JOIN users u_emp ON ih.employee_id = u_emp.id
      LEFT JOIN departments d ON u_emp.department_id = d.id
      WHERE ih.status = 'FOR_COMPLETION'
      ORDER BY ih.updated_at DESC
    `);

    if (forCompletionIDPs.length === 0) {
      console.log('   ❌ No IDPs found with FOR_COMPLETION status');
    } else {
      console.log(`   ✅ Found ${forCompletionIDPs.length} IDP(s) with FOR_COMPLETION status:`);
      forCompletionIDPs.forEach(idp => {
        console.log(`   📋 IDP #${idp.id} - ${idp.employee_name} (${idp.employee_code}) - ${idp.department_name}`);
        console.log(`       Created: ${idp.created_at}`);
        console.log(`       Updated: ${idp.updated_at}\n`);
      });
    }

    console.log('='.repeat(60) + '\n');

    // 3. Check for PENDING_HR status IDPs (alternative status for HR approval)
    console.log('📋 PENDING_HR Status IDPs:');
    const [pendingHRIDPs] = await connection.query(`
      SELECT 
        ih.id,
        ih.status,
        u_emp.name as employee_name,
        u_emp.employee_id as employee_code,
        d.name as department_name,
        ih.created_at,
        ih.updated_at
      FROM idp_headers ih
      LEFT JOIN users u_emp ON ih.employee_id = u_emp.id
      LEFT JOIN departments d ON u_emp.department_id = d.id
      WHERE ih.status = 'PENDING_HR'
      ORDER BY ih.updated_at DESC
    `);

    if (pendingHRIDPs.length === 0) {
      console.log('   ❌ No IDPs found with PENDING_HR status');
    } else {
      console.log(`   ✅ Found ${pendingHRIDPs.length} IDP(s) with PENDING_HR status:`);
      pendingHRIDPs.forEach(idp => {
        console.log(`   📋 IDP #${idp.id} - ${idp.employee_name} (${idp.employee_code}) - ${idp.department_name}`);
        console.log(`       Created: ${idp.created_at}`);
        console.log(`       Updated: ${idp.updated_at}\n`);
      });
    }

    console.log('='.repeat(60) + '\n');

    // 4. Check recent IDPs (last 10) to see their current status
    console.log('📅 Most Recent 10 IDPs:');
    const [recentIDPs] = await connection.query(`
      SELECT 
        ih.id,
        ih.status,
        u_emp.name as employee_name,
        u_emp.employee_id as employee_code,
        ih.created_at,
        ih.updated_at
      FROM idp_headers ih
      LEFT JOIN users u_emp ON ih.employee_id = u_emp.id
      ORDER BY ih.id DESC
      LIMIT 10
    `);

    recentIDPs.forEach(idp => {
      console.log(`   📋 IDP #${idp.id} - Status: ${idp.status} - ${idp.employee_name} (${idp.employee_code})`);
    });

    console.log('\n' + '='.repeat(60) + '\n');

    // 5. Test query that backend uses for hrForceCycleComplete
    console.log('🔧 Testing Backend Query (PENDING_HR OR FOR_COMPLETION):');
    const [backendQuery] = await connection.query(`
      SELECT 
        ih.id,
        ih.status,
        u_emp.name as employee_name,
        u_emp.employee_id as employee_code
      FROM idp_headers ih
      LEFT JOIN users u_emp ON ih.employee_id = u_emp.id
      WHERE ih.status = 'PENDING_HR' OR ih.status = 'FOR_COMPLETION'
      ORDER BY ih.updated_at DESC
    `);

    if (backendQuery.length === 0) {
      console.log('   ❌ No IDPs found that match backend query criteria');
      console.log('   🔍 This explains why cycle completion fails!');
    } else {
      console.log(`   ✅ Found ${backendQuery.length} IDP(s) that match backend criteria:`);
      backendQuery.forEach(idp => {
        console.log(`   📋 IDP #${idp.id} - Status: ${idp.status} - ${idp.employee_name} (${idp.employee_code})`);
      });
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 6. Check if there are any IDPs that should be FOR_COMPLETION
    console.log('🔄 Checking IDPs that might need status correction:');
    const [possibleForCompletion] = await connection.query(`
      SELECT 
        ih.id,
        ih.status,
        u_emp.name as employee_name,
        u_emp.employee_id as employee_code,
        ih.updated_at
      FROM idp_headers ih
      LEFT JOIN users u_emp ON ih.employee_id = u_emp.id
      WHERE ih.status IN ('PENDING_MANAGER', 'PENDING_AM', 'APPROVED')
      ORDER BY ih.updated_at DESC
      LIMIT 5
    `);

    if (possibleForCompletion.length > 0) {
      console.log('   📋 Recent IDPs that might need to be moved to FOR_COMPLETION:');
      possibleForCompletion.forEach(idp => {
        console.log(`   📋 IDP #${idp.id} - Status: ${idp.status} - ${idp.employee_name} (${idp.employee_code})`);
      });
    }

  } catch (error) {
    console.error('❌ Database error:', error.message);
    console.log('\n💡 Make sure:');
    console.log('   1. MySQL is running');
    console.log('   2. Database "futura" exists');
    console.log('   3. Database credentials are correct');
    console.log('   4. Node.js mysql2 package is installed');
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the script
checkIDPStatus().then(() => {
  console.log('✅ Database check complete!');
}).catch(error => {
  console.error('❌ Script error:', error.message);
});