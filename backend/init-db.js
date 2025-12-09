// init-db.js - Initialize database schema
require('dotenv').config();
const mysql = require('mysql2/promise');

const SQL_STATEMENTS = [
  // Departments table
  `CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  // Positions table
  `CREATE TABLE IF NOT EXISTS positions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL UNIQUE,
    department_id INT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id)
  )`,

  // Users table
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    position_id INT NOT NULL,
    department_id INT NOT NULL,
    role ENUM('Employee', 'Supervisor', 'AM', 'Manager', 'HR', 'Admin') DEFAULT 'Employee',
    password VARCHAR(255),
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (position_id) REFERENCES positions(id),
    FOREIGN KEY (department_id) REFERENCES departments(id),
    INDEX (role)
  )`,

  // Competencies table
  `CREATE TABLE IF NOT EXISTS competencies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  // Position-Competency mapping
  `CREATE TABLE IF NOT EXISTS position_competencies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    position_id INT NOT NULL,
    competency_id INT NOT NULL,
    required_level INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (position_id) REFERENCES positions(id),
    FOREIGN KEY (competency_id) REFERENCES competencies(id),
    UNIQUE KEY (position_id, competency_id)
  )`,

  // Cycles table (for CL and IDP cycles)
  `CREATE TABLE IF NOT EXISTS cycles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type ENUM('CL', 'IDP', 'BOTH') DEFAULT 'BOTH',
    start_date DATE,
    end_date DATE,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  // CL Headers table
  `CREATE TABLE IF NOT EXISTS cl_headers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    supervisor_id INT NOT NULL,
    department_id INT NOT NULL,
    cycle_id INT NOT NULL,
    status ENUM('DRAFT', 'IN_PROGRESS', 'PENDING_AM', 'APPROVED', 'REJECTED') DEFAULT 'DRAFT',
    has_assistant_manager TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES users(id),
    FOREIGN KEY (supervisor_id) REFERENCES users(id),
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (cycle_id) REFERENCES cycles(id),
    INDEX (supervisor_id),
    INDEX (status)
  )`,

  // CL Items table
  `CREATE TABLE IF NOT EXISTS cl_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cl_header_id INT NOT NULL,
    competency_id INT NOT NULL,
    mplr_level INT,
    assigned_level INT,
    weight DECIMAL(5, 2) DEFAULT 0,
    justification TEXT,
    score DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cl_header_id) REFERENCES cl_headers(id) ON DELETE CASCADE,
    FOREIGN KEY (competency_id) REFERENCES competencies(id)
  )`,

  // IDP Headers table
  `CREATE TABLE IF NOT EXISTS idp_headers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    supervisor_id INT NOT NULL,
    cycle_id INT NOT NULL,
    status ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED') DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES users(id),
    FOREIGN KEY (supervisor_id) REFERENCES users(id),
    FOREIGN KEY (cycle_id) REFERENCES cycles(id),
    INDEX (supervisor_id),
    INDEX (status)
  )`,

  // IDP Items table
  `CREATE TABLE IF NOT EXISTS idp_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    idp_header_id INT NOT NULL,
    competency_id INT NOT NULL,
    target_level INT,
    development_action TEXT,
    timeline_months INT,
    status ENUM('PLANNED', 'IN_PROGRESS', 'COMPLETED') DEFAULT 'PLANNED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (idp_header_id) REFERENCES idp_headers(id) ON DELETE CASCADE,
    FOREIGN KEY (competency_id) REFERENCES competencies(id)
  )`
];

(async () => {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('📦 Initializing database schema...');

    for (const sql of SQL_STATEMENTS) {
      try {
        await conn.query(sql);
        console.log('✅ Created/verified table');
      } catch (err) {
        if (!err.message.includes('already exists')) {
          throw err;
        }
      }
    }

    console.log('✅ Database schema initialized successfully!');
  } catch (err) {
    console.error('❌ Database initialization failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
})();
