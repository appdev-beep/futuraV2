-- Seed script generated from your dump snippet
-- Target DB: futura

SET NAMES utf8mb4;
SET time_zone = '+00:00';

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO';

-- ------------------------------------------------------
-- DROP TABLES (child -> parent order)
-- ------------------------------------------------------

DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `cl_approvals`;
DROP TABLE IF EXISTS `cl_employee_logs`;
DROP TABLE IF EXISTS `cl_hr_logs`;
DROP TABLE IF EXISTS `cl_items`;
DROP TABLE IF EXISTS `cl_manager_logs`;
DROP TABLE IF EXISTS `cl_submissions`;
DROP TABLE IF EXISTS `competency_approvals`;
DROP TABLE IF EXISTS `competency_leveling_attachments`;
DROP TABLE IF EXISTS `competency_leveling`;
DROP TABLE IF EXISTS `competency_workflow_steps`;
DROP TABLE IF EXISTS `competency_workflow_templates`;
DROP TABLE IF EXISTS `department_competencies`;
DROP TABLE IF EXISTS `equimetrics_integration`;
DROP TABLE IF EXISTS `idp_approvals`;
DROP TABLE IF EXISTS `idp_headers`;
DROP TABLE IF EXISTS `idp_items`;
DROP TABLE IF EXISTS `idp`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `position_competencies`;
DROP TABLE IF EXISTS `recent_actions`;
DROP TABLE IF EXISTS `cl_headers`;
DROP TABLE IF EXISTS `competencies`;
DROP TABLE IF EXISTS `cycles`;
DROP TABLE IF EXISTS `departments`;
DROP TABLE IF EXISTS `positions`;
DROP TABLE IF EXISTS `users`;

-- ------------------------------------------------------
-- CREATE TABLES
-- ------------------------------------------------------

CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `action` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `module` enum('Competency Leveling','IDP','System') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `details` text COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_audit_logs_user` (`user_id`),
  CONSTRAINT `fk_audit_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cl_headers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cycle_id` int NOT NULL,
  `employee_id` int NOT NULL,
  `manager_id` int NOT NULL,
  `hr_id` int DEFAULT NULL,
  `status` enum('Draft','Submitted','In Review','Approved','Returned','Cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Draft',
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cl_headers_cycle` (`cycle_id`),
  KEY `idx_cl_headers_employee` (`employee_id`),
  KEY `idx_cl_headers_manager` (`manager_id`),
  KEY `idx_cl_headers_hr` (`hr_id`),
  CONSTRAINT `fk_cl_headers_cycle` FOREIGN KEY (`cycle_id`) REFERENCES `cycles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_cl_headers_employee` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_cl_headers_hr` FOREIGN KEY (`hr_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_cl_headers_manager` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cl_approvals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cl_id` int NOT NULL,
  `approver_id` int NOT NULL,
  `role` enum('Manager','HR') COLLATE utf8mb4_unicode_ci NOT NULL,
  `decision` enum('Pending','Approved','Returned') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Pending',
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `decided_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cl_approvals_cl` (`cl_id`),
  KEY `idx_cl_approvals_approver` (`approver_id`),
  CONSTRAINT `fk_cl_approvals_cl` FOREIGN KEY (`cl_id`) REFERENCES `cl_headers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cl_approvals_user` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cl_employee_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cl_id` int NOT NULL,
  `employee_id` int NOT NULL,
  `action` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cl_employee_logs_cl` (`cl_id`),
  KEY `idx_cl_employee_logs_employee` (`employee_id`),
  CONSTRAINT `fk_cl_employee_logs_cl` FOREIGN KEY (`cl_id`) REFERENCES `cl_headers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cl_employee_logs_user` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cl_hr_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cl_id` int NOT NULL,
  `hr_id` int NOT NULL,
  `action` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cl_hr_logs_cl` (`cl_id`),
  KEY `idx_cl_hr_logs_hr` (`hr_id`),
  CONSTRAINT `fk_cl_hr_logs_cl` FOREIGN KEY (`cl_id`) REFERENCES `cl_headers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cl_hr_logs_user` FOREIGN KEY (`hr_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cl_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cl_id` int NOT NULL,
  `competency_id` int NOT NULL,
  `current_level` int DEFAULT NULL,
  `target_level` int DEFAULT NULL,
  `employee_remarks` text COLLATE utf8mb4_unicode_ci,
  `manager_remarks` text COLLATE utf8mb4_unicode_ci,
  `hr_remarks` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cl_items_cl` (`cl_id`),
  KEY `idx_cl_items_competency` (`competency_id`),
  CONSTRAINT `fk_cl_items_cl` FOREIGN KEY (`cl_id`) REFERENCES `cl_headers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cl_items_competency` FOREIGN KEY (`competency_id`) REFERENCES `competencies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cl_manager_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cl_id` int NOT NULL,
  `manager_id` int NOT NULL,
  `action` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cl_manager_logs_cl` (`cl_id`),
  KEY `idx_cl_manager_logs_manager` (`manager_id`),
  CONSTRAINT `fk_cl_manager_logs_cl` FOREIGN KEY (`cl_id`) REFERENCES `cl_headers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cl_manager_logs_user` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cl_submissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cl_id` int NOT NULL,
  `submitted_by` int NOT NULL,
  `submitted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cl_submissions_cl` (`cl_id`),
  KEY `idx_cl_submissions_user` (`submitted_by`),
  CONSTRAINT `fk_cl_submissions_cl` FOREIGN KEY (`cl_id`) REFERENCES `cl_headers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cl_submissions_user` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `competencies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_competencies_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `competency_approvals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `leveling_id` int NOT NULL,
  `approver_id` int NOT NULL,
  `decision` enum('Pending','Approved','Returned') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Pending',
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `decided_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_competency_approvals_leveling` (`leveling_id`),
  KEY `idx_competency_approvals_user` (`approver_id`),
  CONSTRAINT `fk_competency_approvals_leveling` FOREIGN KEY (`leveling_id`) REFERENCES `competency_leveling` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_competency_approvals_user` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `competency_leveling` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cycle_id` int NOT NULL,
  `employee_id` int NOT NULL,
  `manager_id` int NOT NULL,
  `hr_id` int DEFAULT NULL,
  `status` enum('Draft','Submitted','In Review','Approved','Returned','Cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Draft',
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_comp_leveling_cycle` (`cycle_id`),
  KEY `idx_comp_leveling_employee` (`employee_id`),
  KEY `idx_comp_leveling_manager` (`manager_id`),
  KEY `idx_comp_leveling_hr` (`hr_id`),
  CONSTRAINT `fk_comp_leveling_cycle` FOREIGN KEY (`cycle_id`) REFERENCES `cycles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_comp_leveling_employee` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_comp_leveling_hr` FOREIGN KEY (`hr_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_comp_leveling_manager` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `competency_leveling_attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `leveling_id` int NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uploaded_by` int NOT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cla_leveling` (`leveling_id`),
  KEY `idx_cla_uploaded_by` (`uploaded_by`),
  CONSTRAINT `fk_cla_leveling` FOREIGN KEY (`leveling_id`) REFERENCES `competency_leveling` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cla_user` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `competency_workflow_steps` (
  `id` int NOT NULL AUTO_INCREMENT,
  `template_id` int NOT NULL,
  `step_order` int NOT NULL,
  `role` enum('Employee','Manager','HR') COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_required` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `idx_cws_template` (`template_id`),
  CONSTRAINT `fk_cws_template` FOREIGN KEY (`template_id`) REFERENCES `competency_workflow_templates` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `competency_workflow_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cwt_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cycles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cycles_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `departments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_departments_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `positions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `department_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_positions_name` (`name`),
  KEY `idx_positions_department` (`department_id`),
  CONSTRAINT `fk_positions_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_no` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `first_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('Employee','Manager','HR','Admin') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Employee',
  `department_id` int DEFAULT NULL,
  `position_id` int DEFAULT NULL,
  `supervisor_id` int DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_department` (`department_id`),
  KEY `idx_users_position` (`position_id`),
  KEY `idx_users_supervisor` (`supervisor_id`),
  CONSTRAINT `fk_users_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_users_position` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_users_supervisor` FOREIGN KEY (`supervisor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `department_competencies` (
  `department_id` int NOT NULL,
  `competency_id` int NOT NULL,
  PRIMARY KEY (`department_id`,`competency_id`),
  KEY `idx_dc_competency` (`competency_id`),
  CONSTRAINT `fk_dc_competency` FOREIGN KEY (`competency_id`) REFERENCES `competencies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_dc_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `equimetrics_integration` (
  `id` int NOT NULL AUTO_INCREMENT,
  `external_employee_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` int NOT NULL,
  `payload` json DEFAULT NULL,
  `synced_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_equimetrics_user` (`user_id`),
  CONSTRAINT `fk_equimetrics_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `idp` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cycle_id` int NOT NULL,
  `employee_id` int NOT NULL,
  `manager_id` int NOT NULL,
  `hr_id` int DEFAULT NULL,
  `status` enum('Draft','Submitted','In Review','Approved','Returned','Cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Draft',
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_idp_cycle` (`cycle_id`),
  KEY `idx_idp_employee` (`employee_id`),
  KEY `idx_idp_manager` (`manager_id`),
  KEY `idx_idp_hr` (`hr_id`),
  CONSTRAINT `fk_idp_cycle` FOREIGN KEY (`cycle_id`) REFERENCES `cycles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_idp_employee` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_idp_hr` FOREIGN KEY (`hr_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_idp_manager` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `idp_approvals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `idp_id` int NOT NULL,
  `approver_id` int NOT NULL,
  `role` enum('Manager','HR') COLLATE utf8mb4_unicode_ci NOT NULL,
  `decision` enum('Pending','Approved','Returned') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Pending',
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `decided_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_idp_approvals_idp` (`idp_id`),
  KEY `idx_idp_approvals_user` (`approver_id`),
  CONSTRAINT `fk_idp_approvals_idp` FOREIGN KEY (`idp_id`) REFERENCES `idp` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_idp_approvals_user` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `idp_headers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `idp_id` int NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_idp_headers_idp` (`idp_id`),
  CONSTRAINT `fk_idp_headers_idp` FOREIGN KEY (`idp_id`) REFERENCES `idp` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `idp_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `header_id` int NOT NULL,
  `goal` text COLLATE utf8mb4_unicode_ci,
  `action_plan` text COLLATE utf8mb4_unicode_ci,
  `target_date` date DEFAULT NULL,
  `status` enum('Not Started','In Progress','Completed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Not Started',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_idp_items_header` (`header_id`),
  CONSTRAINT `fk_idp_items_header` FOREIGN KEY (`header_id`) REFERENCES `idp_headers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user` (`user_id`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `position_competencies` (
  `position_id` int NOT NULL,
  `competency_id` int NOT NULL,
  PRIMARY KEY (`position_id`,`competency_id`),
  KEY `idx_pc_competency` (`competency_id`),
  CONSTRAINT `fk_pc_competency` FOREIGN KEY (`competency_id`) REFERENCES `competencies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pc_position` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `recent_actions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `actor_id` int NOT NULL,
  `employee_id` int DEFAULT NULL,
  `cl_id` int DEFAULT NULL,
  `action` varchar(255) DEFAULT NULL,
  `description` varchar(500) DEFAULT NULL,
  `url` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_actor_created` (`actor_id`,`created_at`),
  KEY `idx_employee_created` (`employee_id`,`created_at`),
  KEY `idx_cl_created` (`cl_id`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------
-- RESTORE SETTINGS
-- ------------------------------------------------------

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
