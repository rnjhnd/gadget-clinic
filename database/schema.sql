-- ============================================================
-- Gadget Clinic Database Schema
-- Compatible with MySQL 5.7+ / MySQL 8.0+ / MariaDB 10.3+
--
-- CANONICAL LOCATION: database/schema.sql
-- This file lives outside the webroot and is the authoritative
-- schema definition. The legacy techfix_dump.sql in the project
-- root should be deleted from the server after deployment.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- ------------------------------------------------------------
-- Table structure for table `users`
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `google_id` VARCHAR(255) NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `phone` VARCHAR(20) NULL,
  `role` ENUM('client', 'admin') NOT NULL DEFAULT 'client',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Table structure for table `service_requests`
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `service_requests` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `request_datetime` DATETIME NOT NULL,
  `service_type` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(20) NULL,
  `document_path` VARCHAR(255) NULL,
  `status` ENUM('pending', 'confirmed', 'in_progress', 'for_pickup', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  `quote_amount` DECIMAL(10,2) NULL DEFAULT NULL,
  `quote_description` TEXT NULL DEFAULT NULL,
  `quote_status` ENUM('pending', 'approved', 'declined') NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_req_user_id` (`user_id`),
  INDEX `idx_req_datetime` (`request_datetime`),
  INDEX `idx_req_status` (`status`),
  INDEX `idx_slot_service_status` (`request_datetime`, `service_type`, `status`),
  CONSTRAINT `fk_service_requests_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Table structure for table `blackout_dates`
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `blackout_dates` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `blackout_date` DATE NOT NULL UNIQUE,
  `reason` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_blackout_date` (`blackout_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Optional Seed: Sample Admin User
-- Replace 'admin@gadgetclinic.com' with your Google account email.
-- ------------------------------------------------------------
INSERT INTO `users` (`id`, `google_id`, `name`, `email`, `phone`, `role`)
VALUES (1, NULL, 'System Administrator', 'admin@gadgetclinic.com', '09123456789', 'admin')
ON DUPLICATE KEY UPDATE `id` = `id`;

SET FOREIGN_KEY_CHECKS = 1;
