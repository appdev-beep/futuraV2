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
DROP TABLE IF EXISTS `recent_actions`;
DROP TABLE IF EXISTS `competency_leveling_attachments`;
DROP TABLE IF EXISTS `competency_workflow_steps`;
DROP TABLE IF EXISTS `competency_workflow_templates`;
DROP TABLE IF EXISTS `competency_approvals`;
DROP TABLE IF EXISTS `competency_leveling`;
DROP TABLE IF EXISTS `cl_submissions`;
DROP TABLE IF EXISTS `idp_approvals`;
DROP TABLE IF EXISTS `idp_items`;
DROP TABLE IF EXISTS `idp_headers`;
DROP TABLE IF EXISTS `idp`;
DROP TABLE IF EXISTS `equimetrics_integration`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `department_competencies`;
DROP TABLE IF EXISTS `position_competencies`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `positions`;
DROP TABLE IF EXISTS `departments`;
DROP TABLE IF EXISTS `cycles`;
DROP TABLE IF EXISTS `competencies`;

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
  `employee_id` int NOT NULL,
  `supervisor_id` int NOT NULL,
  `department_id` int NOT NULL,
  `cycle_id` int NOT NULL,
  `status` enum('DRAFT','PENDING_AM','PENDING_EMPLOYEE','PENDING_HR','PENDING_MANAGER','APPROVED','REJECTED') DEFAULT 'DRAFT',
  `has_assistant_manager` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `awaiting_approval_from` varchar(50) DEFAULT NULL,
  `supervisor_remarks` text,
  `am_remarks` text,
  `manager_remarks` text,
  `employee_remarks` text,
  `hr_remarks` text,
  `manager_id` int DEFAULT NULL,
  `manager_decision` enum('APPROVED','RETURNED') DEFAULT NULL,
  `manager_decided_at` datetime DEFAULT NULL,
  `hr_id` int DEFAULT NULL,
  `hr_decision` enum('APPROVED','RETURNED') DEFAULT NULL,
  `hr_decided_at` datetime DEFAULT NULL,
  `employee_decision` enum('APPROVED','RETURNED') DEFAULT NULL,
  `employee_decided_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  KEY `department_id` (`department_id`),
  KEY `cycle_id` (`cycle_id`),
  KEY `supervisor_id` (`supervisor_id`),
  KEY `status` (`status`),
  KEY `fk_cl_headers_manager` (`manager_id`),
  KEY `fk_cl_headers_hr` (`hr_id`),
  CONSTRAINT `cl_headers_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`),
  CONSTRAINT `cl_headers_ibfk_2` FOREIGN KEY (`supervisor_id`) REFERENCES `users` (`id`),
  CONSTRAINT `cl_headers_ibfk_3` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`),
  CONSTRAINT `cl_headers_ibfk_4` FOREIGN KEY (`cycle_id`) REFERENCES `cycles` (`id`),
  CONSTRAINT `fk_cl_headers_hr` FOREIGN KEY (`hr_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_cl_headers_manager` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=63 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `cl_approvals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cl_header_id` int NOT NULL,
  `approver_id` int NOT NULL,
  `role` enum('AM','Employee','HR') NOT NULL,
  `action` enum('Pending','Approved','Returned') DEFAULT 'Pending',
  `remarks` text,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cl_header_id` (`cl_header_id`,`approver_id`,`role`),
  KEY `approver_id` (`approver_id`),
  CONSTRAINT `cl_approvals_ibfk_1` FOREIGN KEY (`cl_header_id`) REFERENCES `cl_headers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cl_approvals_ibfk_2` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `cl_employee_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cl_id` int NOT NULL,
  `employee_id` int NOT NULL,
  `action` enum('APPROVED','RETURNED') NOT NULL,
  `remarks` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `cl_employee_logs_ibfk_1` (`cl_id`),
  KEY `cl_employee_logs_ibfk_2` (`employee_id`),
  CONSTRAINT `cl_employee_logs_ibfk_1` FOREIGN KEY (`cl_id`) REFERENCES `cl_headers` (`id`),
  CONSTRAINT `cl_employee_logs_ibfk_2` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `cl_hr_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cl_id` int NOT NULL,
  `hr_id` int NOT NULL,
  `action` enum('APPROVED','RETURNED') NOT NULL,
  `remarks` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `cl_hr_logs_ibfk_1` (`cl_id`),
  KEY `cl_hr_logs_ibfk_2` (`hr_id`),
  CONSTRAINT `cl_hr_logs_ibfk_1` FOREIGN KEY (`cl_id`) REFERENCES `cl_headers` (`id`),
  CONSTRAINT `cl_hr_logs_ibfk_2` FOREIGN KEY (`hr_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `cl_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cl_header_id` int NOT NULL,
  `competency_id` int NOT NULL,
  `mplr_level` int DEFAULT NULL,
  `assigned_level` int DEFAULT NULL,
  `weight` decimal(5,2) DEFAULT '0.00',
  `justification` text,
  `score` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `pdf_path` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `cl_header_id` (`cl_header_id`),
  KEY `competency_id` (`competency_id`),
  CONSTRAINT `cl_items_ibfk_1` FOREIGN KEY (`cl_header_id`) REFERENCES `cl_headers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cl_items_ibfk_2` FOREIGN KEY (`competency_id`) REFERENCES `competencies` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=273 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `cl_manager_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cl_id` int NOT NULL,
  `manager_id` int NOT NULL,
  `action` enum('APPROVED','RETURNED') NOT NULL,
  `remarks` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `cl_id` (`cl_id`),
  CONSTRAINT `cl_manager_logs_ibfk_1` FOREIGN KEY (`cl_id`) REFERENCES `cl_headers` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `cl_submissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `supervisor_id` int NOT NULL,
  `total_score` decimal(5,2) DEFAULT NULL,
  `submitted_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `status` enum('Pending','AM_Review','Manager_Review','Approved','Rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'Pending',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `remarks` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `fk_cl_sub_employee` (`employee_id`),
  KEY `fk_cl_sub_supervisor` (`supervisor_id`),
  CONSTRAINT `fk_cl_sub_employee` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_cl_sub_supervisor` FOREIGN KEY (`supervisor_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `competencies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `competency_area` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `category` enum('Technical Skill','Leadership') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `competency_approvals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `leveling_id` int NOT NULL,
  `approver_id` int NOT NULL,
  `role` enum('Supervisor','AM','Manager','Employee','HR') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` enum('Approved','Rejected','Pending') COLLATE utf8mb4_unicode_ci DEFAULT 'Pending',
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `approved_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_comp_approvals_leveling` (`leveling_id`),
  KEY `fk_comp_approvals_approver` (`approver_id`),
  CONSTRAINT `fk_comp_approvals_approver` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_comp_approvals_leveling` FOREIGN KEY (`leveling_id`) REFERENCES `competency_leveling` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `competency_leveling` (
  `id` int NOT NULL AUTO_INCREMENT,
  `submission_id` int DEFAULT NULL,
  `employee_id` int NOT NULL,
  `supervisor_id` int NOT NULL,
  `competency_id` int NOT NULL,
  `level` int DEFAULT NULL,
  `justification` text COLLATE utf8mb4_unicode_ci,
  `mplr` int DEFAULT NULL,
  `status` enum('Pending','Approved','Rejected','Locked') COLLATE utf8mb4_unicode_ci DEFAULT 'Pending',
  `final_score` decimal(5,2) DEFAULT NULL,
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_cl_submission` (`submission_id`),
  KEY `fk_cl_employee` (`employee_id`),
  KEY `fk_cl_supervisor` (`supervisor_id`),
  KEY `fk_cl_competency` (`competency_id`),
  CONSTRAINT `fk_cl_competency` FOREIGN KEY (`competency_id`) REFERENCES `competencies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_cl_employee` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_cl_submission` FOREIGN KEY (`submission_id`) REFERENCES `cl_submissions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_cl_supervisor` FOREIGN KEY (`supervisor_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `competency_leveling_attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `leveling_id` int NOT NULL,
  `file_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_cl_attach_leveling` (`leveling_id`),
  CONSTRAINT `fk_cl_attach_leveling` FOREIGN KEY (`leveling_id`) REFERENCES `competency_leveling` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `competency_workflow_steps` (
  `id` int NOT NULL AUTO_INCREMENT,
  `leveling_id` int NOT NULL,
  `step_order` int DEFAULT NULL,
  `role` enum('Supervisor','AM','Manager','Employee','HR') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approver_id` int DEFAULT NULL,
  `status` enum('Pending','Approved','Rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'Pending',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_cw_steps_leveling` (`leveling_id`),
  KEY `fk_cw_steps_approver` (`approver_id`),
  CONSTRAINT `fk_cw_steps_approver` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_cw_steps_leveling` FOREIGN KEY (`leveling_id`) REFERENCES `competency_leveling` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `competency_workflow_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `department_id` int DEFAULT NULL,
  `position_id` int DEFAULT NULL,
  `step_order` int DEFAULT NULL,
  `role` enum('Supervisor','AM','Manager','HR') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_cw_templates_department` (`department_id`),
  KEY `fk_cw_templates_position` (`position_id`),
  CONSTRAINT `fk_cw_templates_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_cw_templates_position` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cycles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `type` enum('CL','IDP','BOTH') DEFAULT 'BOTH',
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `departments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `has_am` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `positions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `department_id` int NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `title` (`title`),
  KEY `fk_positions_department` (`department_id`),
  CONSTRAINT `fk_positions_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `position_id` int NOT NULL,
  `department_id` int NOT NULL,
  `role` enum('Employee','Supervisor','AM','Manager','HR','Admin') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_id` (`employee_id`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_users_position` (`position_id`),
  KEY `fk_users_department` (`department_id`),
  CONSTRAINT `fk_users_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_users_position` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `department_competencies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `department_id` int NOT NULL,
  `competency_id` int NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_dept_comp_department` (`department_id`),
  KEY `fk_dept_comp_competency` (`competency_id`),
  CONSTRAINT `fk_dept_comp_competency` FOREIGN KEY (`competency_id`) REFERENCES `competencies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_dept_comp_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `equimetrics_integration` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `competency_score` decimal(5,2) DEFAULT NULL,
  `idp_score` decimal(5,2) DEFAULT NULL,
  `total_score` decimal(5,2) DEFAULT NULL,
  `synced_at` datetime DEFAULT NULL,
  `status` enum('Pending','Synced','Error') COLLATE utf8mb4_unicode_ci DEFAULT 'Pending',
  `error_details` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `fk_equimetrics_employee` (`employee_id`),
  CONSTRAINT `fk_equimetrics_employee` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `idp` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `supervisor_id` int NOT NULL,
  `competency_id` int NOT NULL,
  `development_activity` text COLLATE utf8mb4_unicode_ci,
  `target_level` int DEFAULT NULL,
  `type` enum('Education','Experience','Exposure') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('Pending','In Progress','Completed','Validated','Rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'Pending',
  `certificate_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_level_increment` int NOT NULL DEFAULT '1',
  `score` int DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_idp_employee` (`employee_id`),
  KEY `fk_idp_supervisor` (`supervisor_id`),
  KEY `fk_idp_competency` (`competency_id`),
  CONSTRAINT `fk_idp_competency` FOREIGN KEY (`competency_id`) REFERENCES `competencies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_idp_employee` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_idp_supervisor` FOREIGN KEY (`supervisor_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `idp_approvals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `idp_id` int NOT NULL,
  `approver_id` int NOT NULL,
  `role` enum('Supervisor','AM','Manager','Employee','HR') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` enum('Approved','Rejected','Pending') COLLATE utf8mb4_unicode_ci DEFAULT 'Pending',
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `approved_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_idp_approvals_idp` (`idp_id`),
  KEY `fk_idp_approvals_approver` (`approver_id`),
  CONSTRAINT `fk_idp_approvals_approver` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_idp_approvals_idp` FOREIGN KEY (`idp_id`) REFERENCES `idp` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `idp_headers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `supervisor_id` int NOT NULL,
  `cycle_id` int NOT NULL,
  `status` enum('DRAFT','SUBMITTED','APPROVED','IN_PROGRESS','COMPLETED') DEFAULT 'DRAFT',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  KEY `cycle_id` (`cycle_id`),
  KEY `supervisor_id` (`supervisor_id`),
  KEY `status` (`status`),
  CONSTRAINT `idp_headers_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`),
  CONSTRAINT `idp_headers_ibfk_2` FOREIGN KEY (`supervisor_id`) REFERENCES `users` (`id`),
  CONSTRAINT `idp_headers_ibfk_3` FOREIGN KEY (`cycle_id`) REFERENCES `cycles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `idp_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `idp_header_id` int NOT NULL,
  `competency_id` int NOT NULL,
  `target_level` int DEFAULT NULL,
  `development_action` text,
  `timeline_months` int DEFAULT NULL,
  `status` enum('PLANNED','IN_PROGRESS','COMPLETED') DEFAULT 'PLANNED',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idp_header_id` (`idp_header_id`),
  KEY `competency_id` (`competency_id`),
  CONSTRAINT `idp_items_ibfk_1` FOREIGN KEY (`idp_header_id`) REFERENCES `idp_headers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `idp_items_ibfk_2` FOREIGN KEY (`competency_id`) REFERENCES `competencies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `recipient_id` int NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `module` enum('Competency Leveling','IDP','General') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('Unread','Read') COLLATE utf8mb4_unicode_ci DEFAULT 'Unread',
  `read_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_notifications_recipient` (`recipient_id`),
  CONSTRAINT `fk_notifications_recipient` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `position_competencies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `position_id` int NOT NULL,
  `competency_id` int NOT NULL,
  `required_level` int DEFAULT NULL,
  `max_level_increment` int NOT NULL DEFAULT '1',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_pos_comp_position` (`position_id`),
  KEY `fk_pos_comp_competency` (`competency_id`),
  CONSTRAINT `fk_pos_comp_competency` FOREIGN KEY (`competency_id`) REFERENCES `competencies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pos_comp_position` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `recent_actions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `actor_id` bigint NOT NULL,
  `module` varchar(50) NOT NULL DEFAULT 'CL',
  `action_type` varchar(50) NOT NULL,
  `cl_id` bigint DEFAULT NULL,
  `employee_id` bigint DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `url` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_actor_created` (`actor_id`,`created_at`),
  KEY `idx_employee_created` (`employee_id`,`created_at`),
  KEY `idx_cl_created` (`cl_id`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------
-- INSERT DATA (from your dump snippet)
-- ------------------------------------------------------

INSERT INTO `competencies` VALUES
(1,'Windows OS Proficiency','Technical Skills','Proficient in Windows operating systems','Technical Skill','2025-12-08 09:16:23',NULL),
(2,'Basic Networking Concepts','Technical Skills','Understands basic networking concepts','Technical Skill','2025-12-08 09:16:23',NULL),
(3,'Desktop Support','Technical Skills','Provides desktop support to end users','Technical Skill','2025-12-08 09:16:23',NULL),
(4,'Troubleshooting Skills','Problem-Solving','Able to diagnose and resolve issues','Technical Skill','2025-12-08 09:16:23',NULL),
(5,'System Administration','Dialer System Management','Administers and manages the dialer system','Technical Skill','2025-12-08 09:18:48',NULL),
(6,'System Configuration and Optimization','Configuration and Optimization','Configures and optimizes dialer system settings','Technical Skill','2025-12-08 09:18:48',NULL),
(7,'Outbound Campaign Management','Campaign Management','Manages outbound dialer campaigns','Technical Skill','2025-12-08 09:18:48',NULL),
(8,'Data Integration and Management','Data Management','Integrates and manages data sources for the dialer','Technical Skill','2025-12-08 09:18:48',NULL),
(9,'System and Campaign Performance Monitoring','Performance Monitoring','Monitors system and campaign performance metrics','Technical Skill','2025-12-08 09:18:48',NULL),
(10,'System Troubleshooting and Support','Troubleshooting and Issue Resolution','Troubleshoots dialer system issues and provides support','Technical Skill','2025-12-08 09:18:48',NULL),
(11,'Systems Infrastructure Maintenance','IT Operations Management','Oversees and maintains IT systems infrastructure','Leadership','2025-12-08 09:21:36',NULL),
(12,'Team Performance Management','Leadership & Management','Manages and monitors team performance and productivity','Leadership','2025-12-08 09:21:36',NULL),
(13,'Policy Enforcement','Leadership & Compliance','Ensures enforcement of IT and company policies','Leadership','2025-12-08 09:21:36',NULL),
(14,'Change Management Process','Project & Change Management','Manages and oversees the IT change management process','Leadership','2025-12-08 09:21:36',NULL),
(15,'Systems Monitoring & Analysis','IT Operations Management','Monitors and analyzes system performance and health','Technical Skill','2025-12-08 09:21:36',NULL),
(16,'Process Automation','Continuous Improvement','Identifies and implements automation opportunities in IT processes','Leadership','2025-12-08 09:21:36',NULL),
(17,'Infrastructure Planning & Upgrades','Infrastructure Planning','Plans and oversees infrastructure upgrades and improvements','Leadership','2025-12-08 09:21:36',NULL),
(18,'Networking & Systems','Technical Knowledge','Advanced knowledge of networking and systems architectures','Technical Skill','2025-12-08 09:21:36',NULL),
(19,'Supervisory Skills','Leadership & Management','Advanced supervisory and leadership skills for managing IT teams','Leadership','2025-12-08 09:24:35',NULL),
(20,'Planning & Executing Initiatives','Strategic Thinking','Plans and executes strategic IT initiatives and roadmaps','Leadership','2025-12-08 09:24:35',NULL),
(21,'IT Project Management','Project Management','Manages IT projects from planning to execution and closure','Leadership','2025-12-08 09:24:35',NULL),
(22,'Financial Planning & Control','Budget Management','Handles IT budgeting, cost control, and financial planning','Leadership','2025-12-08 09:24:35',NULL),
(23,'Employee Engagement Strategy','Employee Engagement','Understands and applies engagement strategies','Leadership','2025-12-08 12:23:02',NULL),
(24,'Employee Recognition','Employee Engagement','Implements employee recognition programs','Leadership','2025-12-08 12:23:02',NULL),
(25,'Employee Relations','Employee Relations','Handles employee concerns and workplace issues','Technical Skill','2025-12-08 12:23:02',NULL),
(26,'Legal Compliance','Legal Compliance','Ensures HR processes follow legal standards','Technical Skill','2025-12-08 12:23:02',NULL),
(27,'Performance Appraisal','Performance Management','Assists in performance evaluation processes','Technical Skill','2025-12-08 12:23:02',NULL),
(28,'Training Program Recommendations','Training & Development','Recommends training aligned to employee needs','Technical Skill','2025-12-08 12:23:02',NULL),
(29,'HR Policy Implementation','HR Policy','Executes HR policies and ensures adherence','Leadership','2025-12-08 12:23:02',NULL),
(30,'Onboarding Process','Recruitment & Onboarding','Facilitates the employee onboarding process','Technical Skill','2025-12-08 12:23:02',NULL),
(31,'HR Reporting','HR Analytics','Generates HR reports and data summaries','Technical Skill','2025-12-08 12:23:02',NULL),
(32,'HR Strategy Development','HR Strategy','Develops and aligns HR strategies with organizational goals','Leadership','2025-12-08 12:26:17',NULL),
(33,'Team Management','Leadership & Management','Leads and manages HR team members effectively','Leadership','2025-12-08 12:26:17',NULL),
(34,'Change Management','Change Management','Leads HR-driven organizational change initiatives','Leadership','2025-12-08 12:26:17',NULL),
(35,'Engagement Strategy','Employee Engagement','Designs and oversees employee engagement strategies','Leadership','2025-12-08 12:26:17',NULL),
(36,'Recognition Programs','Employee Engagement','Designs and manages employee recognition programs','Leadership','2025-12-08 12:26:17',NULL),
(37,'Conflict Resolution','Employee Relations','Resolves complex employee conflicts and disputes','Leadership','2025-12-08 12:26:17',NULL),
(38,'Training Program Development','Training & Development','Develops and oversees HR training programs','Leadership','2025-12-08 12:26:17',NULL),
(39,'Policy Development & Implementation','HR Policy','Develops and implements HR policies and procedures','Leadership','2025-12-08 12:26:17',NULL);

INSERT INTO `cycles` VALUES
(1,'Default Annual Cycle','CL','2025-01-01','2025-12-31',1,'2025-12-08 20:12:51','2025-12-08 20:12:51');

INSERT INTO `departments` VALUES
(1,'Human Resources','Human Resources',0,'2025-12-08 09:00:06',NULL),
(2,'Information Technology','Information Technology',0,'2025-12-08 09:00:06',NULL);

INSERT INTO `positions` VALUES
(1,'L1 - IT Engineer','Level 1 IT Engineer',2,1,'2025-12-08 09:05:09',NULL),
(2,'L1 - Dialer Administrator','Level 1 Dialer Administrator',2,1,'2025-12-08 09:05:09',NULL),
(3,'IT Supervisor','IT Supervisor',2,1,'2025-12-08 09:05:09',NULL),
(4,'IT Head','Head of IT',2,1,'2025-12-08 09:05:09',NULL),
(5,'Jr. HR Officer','Junior Human Resources Officer',1,1,'2025-12-08 09:28:29',NULL),
(6,'HR Manager','Human Resources Manager',1,1,'2025-12-08 09:28:29',NULL);

INSERT INTO `users` VALUES
(1,'EMP-ADMIN-001','System Administrator','admin@futura.local',6,1,'Admin','$2b$10$.nysKFvEpsBsgeuVgYvECu1XlOwMuqYNro4iU0H68sEAiUuDioUuC',1,'2025-12-08 13:02:51','2025-12-08 13:02:51'),
(2,'EMP 01','Hero Baceles','hero@gmail.com',1,2,'Employee','$2b$10$RHDz6KOZaJP1iANpgWJB5eZSOthYHCjfCdrZnxcCIcP2qBAfFNN4G',1,'2025-12-08 13:56:24','2025-12-08 13:56:24'),
(3,'EMP 03','ITsv','itsv@gmail.com',3,2,'Supervisor','$2b$10$elrdcJuozCY7dXSmLqNXqOZQMJxtumnKpuszYfIVxLNV4gbCOxIs2',1,'2025-12-08 14:00:36','2025-12-08 14:00:36'),
(4,'EMP-02','Rj btum','rj@gmail.com',2,2,'Employee','$2b$10$xVBD3JNvbuSv4Ym0W2/iHuNH.L9JjH/3ioxTUf7gBsd2jtAlFhmcO',1,'2025-12-08 19:43:34','2025-12-08 19:43:34'),
(5,'EMP 04','Aaron','aaron@gmail.com',5,1,'Employee','$2b$10$v.uChV1NbfgWhfm1D9ytCe46yMQmnu9rZFGO2J42UVVYtnIZcKM3q',1,'2025-12-08 19:54:57','2025-12-08 19:54:57'),
(6,'Manager IT - 01','IT Manager','itm@gmail.com',2,2,'Manager','$2b$10$1BjOgO.A0V2Urnn5QG/KRuJ4TuAMlZx3Sc6CUFPmseWaJhFERMf1W',1,'2025-12-08 20:52:01','2025-12-08 20:52:01'),
(7,'HR 0-1','HR GLOBAL','hr@gmail.com',6,1,'HR','$2b$10$jLvUz3wlqy6VnmG/F.gcd.N5I0/37IU1KvrV1TP19oGWMx1egs18m',1,'2025-12-09 02:11:45','2025-12-09 02:11:45'),
(8,'EMP 5','neil','neil@gmail.com',2,2,'Employee','$2b$10$9Gs5KsffLmSgKHwKDlNXnuECeMm5EJSGAezPJVWaZrwRRzLjgrZjq',1,'2025-12-09 06:13:44','2025-12-09 06:13:44'),
(9,'EMP 06','John lloyd','jl@gmail.com',1,2,'Employee','$2b$10$L2HvhThLE1PmC.9OiqvdbOV48EG.Dtf.csaUSQiDOj9BYtrc4hcj2',1,'2025-12-11 06:17:45','2025-12-11 06:17:45'),
(10,'EMP 07','Derek Ram','dr@gmail.com',2,2,'Employee','$2b$10$amfuxtsxPZ0jhEfduNrli.ggcgDpC3lDwqZbUGMsw2A3z8vEpNGYi',1,'2025-12-11 06:18:08','2025-12-11 06:18:08'),
(11,'EMP 08','Joshua Gars','jg@gmail.com',2,2,'Employee','$2b$10$YFWGT0I4b0VDMO2abB4nhu7dG/5R7cCoCetC7L8w16lLjZ3CTTJqO',1,'2025-12-11 06:18:39','2025-12-11 06:18:39');

INSERT INTO `position_competencies` VALUES
(1,1,1,3,1,'2025-12-08 09:16:23',NULL),(2,1,2,4,1,'2025-12-08 09:16:23',NULL),(3,1,3,3,1,'2025-12-08 09:16:23',NULL),(4,1,4,4,1,'2025-12-08 09:16:23',NULL),
(5,2,5,3,1,'2025-12-08 09:18:48',NULL),(6,2,6,3,1,'2025-12-08 09:18:48',NULL),(7,2,7,3,1,'2025-12-08 09:18:48',NULL),(8,2,8,3,1,'2025-12-08 09:18:48',NULL),(9,2,9,3,1,'2025-12-08 09:18:48',NULL),(10,2,10,3,1,'2025-12-08 09:18:48',NULL),
(11,3,11,3,1,'2025-12-08 09:21:36',NULL),(12,3,12,3,1,'2025-12-08 09:21:36',NULL),(13,3,13,3,1,'2025-12-08 09:21:36',NULL),(14,3,14,2,1,'2025-12-08 09:21:36',NULL),(15,3,15,3,1,'2025-12-08 09:21:36',NULL),(16,3,16,3,1,'2025-12-08 09:21:36',NULL),(17,3,17,3,1,'2025-12-08 09:21:36',NULL),(18,3,1,4,1,'2025-12-08 09:21:36',NULL),(19,3,2,4,1,'2025-12-08 09:21:36',NULL),(20,3,18,5,1,'2025-12-08 09:21:36',NULL),
(21,4,19,4,1,'2025-12-08 09:24:35',NULL),(22,4,20,4,1,'2025-12-08 09:24:35',NULL),(23,4,18,5,1,'2025-12-08 09:24:35',NULL),(24,4,21,4,1,'2025-12-08 09:24:35',NULL),(25,4,22,4,1,'2025-12-08 09:24:35',NULL),
(26,5,23,3,1,'2025-12-08 12:23:02',NULL),(27,5,24,3,1,'2025-12-08 12:23:02',NULL),(28,5,25,3,1,'2025-12-08 12:23:02',NULL),(29,5,26,3,1,'2025-12-08 12:23:02',NULL),(30,5,27,3,1,'2025-12-08 12:23:02',NULL),(31,5,28,3,1,'2025-12-08 12:23:02',NULL),(32,5,29,3,1,'2025-12-08 12:23:02',NULL),(33,5,30,3,1,'2025-12-08 12:23:02',NULL),(34,5,31,3,1,'2025-12-08 12:23:02',NULL),
(35,6,32,4,1,'2025-12-08 12:26:17',NULL),(36,6,33,4,1,'2025-12-08 12:26:17',NULL),(37,6,34,4,1,'2025-12-08 12:26:17',NULL),(38,6,35,4,1,'2025-12-08 12:26:17',NULL),(39,6,36,4,1,'2025-12-08 12:26:17',NULL),(40,6,37,4,1,'2025-12-08 12:26:17',NULL),(41,6,26,4,1,'2025-12-08 12:26:17',NULL),(42,6,27,4,1,'2025-12-08 12:26:17',NULL),(43,6,38,4,1,'2025-12-08 12:26:17',NULL),(44,6,39,4,1,'2025-12-08 12:26:17',NULL),(45,6,31,4,1,'2025-12-08 12:26:17',NULL);

INSERT INTO `cl_headers` VALUES
(50,2,3,2,1,'APPROVED',0,'2025-12-11 07:46:08','2025-12-11 08:30:19',NULL,NULL,NULL,'4 29','4 30\n',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(52,4,3,2,1,'APPROVED',0,'2025-12-11 08:04:20','2025-12-12 05:13:22',NULL,'dsd',NULL,NULL,NULL,'sdss',6,'APPROVED','2025-12-11 10:20:03',7,'APPROVED','2025-12-12 05:13:22',NULL,NULL),
(54,9,3,2,1,'APPROVED',0,'2025-12-11 08:04:31','2025-12-11 10:06:39',NULL,NULL,NULL,'ege','sd',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(56,8,3,2,1,'APPROVED',0,'2025-12-11 08:20:39','2025-12-11 11:12:40',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,7,'APPROVED','2025-12-11 11:12:40',NULL,NULL),
(58,10,3,2,1,'APPROVED',0,'2025-12-11 11:27:16','2025-12-11 12:28:58',NULL,'manager log testing',NULL,NULL,'try',NULL,NULL,NULL,NULL,7,'APPROVED','2025-12-11 12:28:58',NULL,NULL),
(60,8,3,2,1,'PENDING_EMPLOYEE',0,'2025-12-11 11:40:15','2025-12-12 03:43:52',NULL,NULL,NULL,NULL,'sdd',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(61,9,3,2,1,'PENDING_EMPLOYEE',0,'2025-12-11 12:04:04','2025-12-12 03:43:46',NULL,'sd',NULL,NULL,'sdsd',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'RETURNED','2025-12-11 12:05:21'),
(62,11,3,2,1,'PENDING_MANAGER',0,'2025-12-12 07:15:02','2025-12-12 07:15:49',NULL,'testing for the supervisor',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);

INSERT INTO `cl_employee_logs` VALUES
(1,61,9,'RETURNED','xz','2025-12-11 12:19:06'),
(2,61,9,'RETURNED','sdsd','2025-12-11 12:19:33');

INSERT INTO `cl_hr_logs` VALUES
(1,52,7,'APPROVED','sdss','2025-12-12 05:13:22');

INSERT INTO `cl_manager_logs` VALUES
(1,58,6,'RETURNED','this is manager for testing','2025-12-11 11:27:38'),
(2,58,6,'RETURNED','df','2025-12-11 11:28:23'),
(3,58,6,'APPROVED',NULL,'2025-12-11 11:29:01'),
(4,60,6,'APPROVED',NULL,'2025-12-11 11:40:36'),
(5,61,6,'APPROVED',NULL,'2025-12-11 12:04:20'),
(6,62,6,'RETURNED','h','2025-12-12 07:15:31');

INSERT INTO `cl_items` VALUES
(203,50,1,3,2,75.00,'',1.50,'2025-12-11 07:46:08','2025-12-11 07:46:08','uploads/cl/cl_50_1765439169158.pdf'),
(204,50,2,4,5,10.00,'',0.50,'2025-12-11 07:46:08','2025-12-11 07:46:08','uploads/cl/cl_50_1765439169158.pdf'),
(205,50,3,3,2,5.00,'',0.10,'2025-12-11 07:46:08','2025-12-11 07:46:08','uploads/cl/cl_50_1765439169158.pdf'),
(206,50,4,4,3,10.00,'',0.30,'2025-12-11 07:46:08','2025-12-11 07:46:08','uploads/cl/cl_50_1765439169158.pdf'),
(213,52,5,3,3,0.00,'',0.00,'2025-12-11 08:04:20','2025-12-11 11:14:41','uploads/cl/cl_52_1765451681282.pdf'),
(214,52,6,3,3,0.00,'',0.00,'2025-12-11 08:04:20','2025-12-11 11:14:41','uploads/cl/cl_52_1765451681282.pdf'),
(215,52,7,3,3,0.00,'',0.00,'2025-12-11 08:04:20','2025-12-11 11:14:41','uploads/cl/cl_52_1765451681282.pdf'),
(216,52,8,3,3,0.00,'',0.00,'2025-12-11 08:04:20','2025-12-11 11:14:41','uploads/cl/cl_52_1765451681282.pdf'),
(217,52,9,3,3,0.00,'',0.00,'2025-12-11 08:04:20','2025-12-11 11:14:41','uploads/cl/cl_52_1765451681282.pdf'),
(218,52,10,3,3,0.00,'',0.00,'2025-12-11 08:04:20','2025-12-11 11:14:41','uploads/cl/cl_52_1765451681282.pdf'),
(225,54,1,3,3,0.00,'',0.00,'2025-12-11 08:04:31','2025-12-11 08:04:31','uploads/cl/cl_54_1765440271797.pdf'),
(226,54,2,4,4,0.00,'',0.00,'2025-12-11 08:04:31','2025-12-11 08:04:31','uploads/cl/cl_54_1765440271797.pdf'),
(227,54,3,3,3,0.00,'',0.00,'2025-12-11 08:04:31','2025-12-11 08:04:31','uploads/cl/cl_54_1765440271797.pdf'),
(228,54,4,4,4,0.00,'',0.00,'2025-12-11 08:04:31','2025-12-11 08:04:31','uploads/cl/cl_54_1765440271797.pdf'),
(235,56,5,3,3,0.00,'',0.00,'2025-12-11 08:20:39','2025-12-11 08:20:39','uploads/cl/cl_56_1765441239011.pdf'),
(236,56,6,3,3,0.00,'',0.00,'2025-12-11 08:20:39','2025-12-11 08:20:39','uploads/cl/cl_56_1765441239011.pdf'),
(237,56,7,3,3,0.00,'',0.00,'2025-12-11 08:20:39','2025-12-11 08:20:39','uploads/cl/cl_56_1765441239011.pdf'),
(238,56,8,3,3,0.00,'',0.00,'2025-12-11 08:20:39','2025-12-11 08:20:39','uploads/cl/cl_56_1765441239011.pdf'),
(239,56,9,3,3,0.00,'',0.00,'2025-12-11 08:20:39','2025-12-11 08:20:39','uploads/cl/cl_56_1765441239011.pdf'),
(240,56,10,3,3,0.00,'',0.00,'2025-12-11 08:20:39','2025-12-11 08:20:39','uploads/cl/cl_56_1765441239011.pdf'),
(245,58,5,3,3,0.00,'',0.00,'2025-12-11 11:27:16','2025-12-11 11:28:46','uploads/cl/cl_58_1765452526095.pdf'),
(246,58,6,3,3,0.00,'',0.00,'2025-12-11 11:27:16','2025-12-11 11:28:46','uploads/cl/cl_58_1765452526095.pdf'),
(247,58,7,3,3,0.00,'',0.00,'2025-12-11 11:27:16','2025-12-11 11:28:46','uploads/cl/cl_58_1765452526095.pdf'),
(248,58,8,3,3,0.00,'',0.00,'2025-12-11 11:27:16','2025-12-11 11:28:46','uploads/cl/cl_58_1765452526095.pdf'),
(249,58,9,3,3,0.00,'',0.00,'2025-12-11 11:27:16','2025-12-11 11:28:46','uploads/cl/cl_58_1765452526095.pdf'),
(250,58,10,3,3,0.00,'',0.00,'2025-12-11 11:27:16','2025-12-11 11:28:46','uploads/cl/cl_58_1765452526095.pdf'),
(257,60,5,3,3,0.00,'',0.00,'2025-12-11 11:40:15','2025-12-12 03:43:52','uploads/cl/cl_60_1765511032278.pdf'),
(258,60,6,3,3,0.00,'',0.00,'2025-12-11 11:40:15','2025-12-12 03:43:52','uploads/cl/cl_60_1765511032278.pdf'),
(259,60,7,3,3,0.00,'',0.00,'2025-12-11 11:40:15','2025-12-12 03:43:52','uploads/cl/cl_60_1765511032278.pdf'),
(260,60,8,3,3,0.00,'',0.00,'2025-12-11 11:40:15','2025-12-12 03:43:52','uploads/cl/cl_60_1765511032278.pdf'),
(261,60,9,3,3,0.00,'',0.00,'2025-12-11 11:40:15','2025-12-12 03:43:52','uploads/cl/cl_60_1765511032278.pdf'),
(262,60,10,3,3,0.00,'',0.00,'2025-12-11 11:40:15','2025-12-12 03:43:52','uploads/cl/cl_60_1765511032278.pdf'),
(263,61,1,3,3,0.00,'',0.00,'2025-12-11 12:04:04','2025-12-12 03:43:46','uploads/cl/cl_61_1765511027020.pdf'),
(264,61,2,4,4,0.00,'',0.00,'2025-12-11 12:04:04','2025-12-12 03:43:46','uploads/cl/cl_61_1765511027020.pdf'),
(265,61,3,3,3,0.00,'',0.00,'2025-12-11 12:04:04','2025-12-12 03:43:46','uploads/cl/cl_61_1765511027020.pdf'),
(266,61,4,4,4,0.00,'',0.00,'2025-12-11 12:04:04','2025-12-12 03:43:46','uploads/cl/cl_61_1765511027020.pdf'),
(267,62,5,3,3,0.00,'',0.00,'2025-12-12 07:15:02','2025-12-12 07:15:49','uploads/cl/cl_62_1765523748553.pdf'),
(268,62,6,3,3,0.00,'',0.00,'2025-12-12 07:15:02','2025-12-12 07:15:49','uploads/cl/cl_62_1765523748553.pdf'),
(269,62,7,3,3,0.00,'',0.00,'2025-12-12 07:15:02','2025-12-12 07:15:49','uploads/cl/cl_62_1765523748553.pdf'),
(270,62,8,3,3,0.00,'',0.00,'2025-12-12 07:15:02','2025-12-12 07:15:49','uploads/cl/cl_62_1765523748553.pdf'),
(271,62,9,3,3,0.00,'',0.00,'2025-12-12 07:15:02','2025-12-12 07:15:49','uploads/cl/cl_62_1765523748553.pdf'),
(272,62,10,3,3,0.00,'',0.00,'2025-12-12 07:15:02','2025-12-12 07:15:49','uploads/cl/cl_62_1765523748553.pdf');

INSERT INTO `recent_actions` VALUES
(1,3,'CL','CL_SUBMITTED',62,11,'Created form for Joshua Gars','CL #62','/cl/supervisor/review/62','2025-12-12 07:15:03'),
(2,3,'CL','CL_RESUBMITTED',62,11,'Resubmitted form for Joshua Gars','CL #62','/cl/supervisor/review/62','2025-12-12 07:15:49');

-- ------------------------------------------------------
-- RESTORE SETTINGS
-- ------------------------------------------------------

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
