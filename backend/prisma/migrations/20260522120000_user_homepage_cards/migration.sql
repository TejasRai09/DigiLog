-- Homepage big-card access (Forms Hub / BI Control Tower on `/`)
CREATE TABLE `user_homepage_cards` (
    `user_id` INTEGER NOT NULL,
    `card_key` VARCHAR(32) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`user_id`, `card_key`),
    INDEX `user_homepage_cards_user_id_idx`(`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `user_homepage_cards` ADD CONSTRAINT `user_homepage_cards_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from existing app mappings so current employees keep homepage access
INSERT IGNORE INTO `user_homepage_cards` (`user_id`, `card_key`)
SELECT DISTINCT m.user_id, 'forms_hub'
FROM `mappings` m
INNER JOIN `apps` a ON a.id = m.app_id
WHERE a.name <> 'BI Control Tower';

INSERT IGNORE INTO `user_homepage_cards` (`user_id`, `card_key`)
SELECT DISTINCT m.user_id, 'bi_control_tower'
FROM `mappings` m
INNER JOIN `apps` a ON a.id = m.app_id
WHERE a.name = 'BI Control Tower';
