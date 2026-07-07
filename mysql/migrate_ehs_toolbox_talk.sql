-- Daily Safety Toolbox Talk (EHS)
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_ehs_toolbox_talk.sql
-- Database: __MYSQL_DATABASE__ from MYSQL_DATABASE / DATABASE_URL in backend/.env

USE `__MYSQL_DATABASE__`;

CREATE TABLE IF NOT EXISTS `ehs_toolbox_talk` (
  `id`                     INT          NOT NULL AUTO_INCREMENT,
  `Date`                   DATE             DEFAULT NULL,
  `Shift`                  VARCHAR(20)      DEFAULT NULL,
  `start_time`             VARCHAR(20)      DEFAULT NULL,
  `end_time`               VARCHAR(20)      DEFAULT NULL,
  `report_prepared_by`     VARCHAR(255)     DEFAULT NULL,
  `topic_discussed`        VARCHAR(150)     DEFAULT NULL,
  `no_of_attendees`        INT              DEFAULT NULL,
  `attendance_sheet_photo` MEDIUMTEXT       DEFAULT NULL,
  `session_photo`          MEDIUMTEXT       DEFAULT NULL,
  `session_photo_2`        MEDIUMTEXT       DEFAULT NULL,
  `timestamp`              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `forms` (`name`, `description`, `form_key`, `app_id`, `sort_order`, `is_active`)
SELECT
  'Daily Safety Toolbox Talk',
  'Record daily toolbox talk session with attendance sheet and session photos',
  'ehs_toolbox_talk',
  `id`,
  5,
  1
FROM `apps`
WHERE `name` = 'EHS — Environment Health & Safety'
ON DUPLICATE KEY UPDATE
  `name`        = VALUES(`name`),
  `description` = VALUES(`description`),
  `sort_order`  = VALUES(`sort_order`),
  `is_active`   = VALUES(`is_active`);
