-- Power Plant Equipment History (new) — navigable hierarchy tree
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_ppn_hierarchy.sql

USE __MYSQL_DATABASE__;

CREATE TABLE IF NOT EXISTS `ppn_hierarchy_node` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `parent_id`     INT          DEFAULT NULL,
  `node_type`     ENUM('group','equipment') NOT NULL DEFAULT 'group',
  `name`          VARCHAR(200) NOT NULL,
  `equip_no`      VARCHAR(100) DEFAULT NULL,
  `lookup_name`   VARCHAR(300) DEFAULT NULL,
  `ppn_equip_id`  INT          DEFAULT NULL,
  `sort_order`    INT          NOT NULL DEFAULT 0,
  `is_active`     TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ppn_hier_parent (parent_id, sort_order, id),
  CONSTRAINT fk_ppn_hier_parent
    FOREIGN KEY (`parent_id`) REFERENCES `ppn_hierarchy_node`(`id`) ON DELETE RESTRICT,
  CONSTRAINT fk_ppn_hier_equip
    FOREIGN KEY (`ppn_equip_id`) REFERENCES `ppn_equipment`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
