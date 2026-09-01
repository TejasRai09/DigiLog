-- Sugar House Equipment History — navigable hierarchy tree
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_shn_hierarchy.sql

USE __MYSQL_DATABASE__;

CREATE TABLE IF NOT EXISTS `shn_hierarchy_node` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `parent_id`     INT          DEFAULT NULL,
  `node_type`     ENUM('group','equipment') NOT NULL DEFAULT 'group',
  `name`          VARCHAR(200) NOT NULL,
  `equip_no`      VARCHAR(100) DEFAULT NULL,
  `lookup_name`   VARCHAR(300) DEFAULT NULL,
  `hist_location` VARCHAR(300) DEFAULT NULL,
  `shn_equip_id`  INT          DEFAULT NULL,
  `sort_order`    INT          NOT NULL DEFAULT 0,
  `is_active`     TINYINT(1)   NOT NULL DEFAULT 1,
  `is_imported`   TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at`    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_shn_hier_parent (parent_id, sort_order, id),
  CONSTRAINT fk_shn_hier_parent
    FOREIGN KEY (`parent_id`) REFERENCES `shn_hierarchy_node`(`id`) ON DELETE RESTRICT,
  CONSTRAINT fk_shn_hier_equip
    FOREIGN KEY (`shn_equip_id`) REFERENCES `shn_equipment`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
