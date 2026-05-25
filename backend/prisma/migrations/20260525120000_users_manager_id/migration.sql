-- Manager-employee hierarchy: add nullable manager_id self-FK on users
ALTER TABLE `users` ADD COLUMN `manager_id` INT NULL DEFAULT NULL;

ALTER TABLE `users` ADD CONSTRAINT `users_manager_id_fkey`
  FOREIGN KEY (`manager_id`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
