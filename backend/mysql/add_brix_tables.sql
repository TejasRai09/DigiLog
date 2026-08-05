USE `__MYSQL_DATABASE__`;

CREATE TABLE IF NOT EXISTS `brix_yard_sampling` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `Date` DATE,
  `Name` VARCHAR(100),
  `DeliveryPoint` VARCHAR(50),
  `VillageOrCenterCode` VARCHAR(50),
  `GrowerCode` VARCHAR(50),
  `TruckNumber` VARCHAR(50),
  `VehicleType` VARCHAR(50),
  `VarietyOfCane` VARCHAR(100),
  `CropType` VARCHAR(50),
  `MiddleBrix` DECIMAL(5,2),
  `DiseasedCane` VARCHAR(10),
  `StaleCane` VARCHAR(10),
  `ConsignmentConditions` VARCHAR(50),
  `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `brix_field_sampling` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `Date` DATE,
  `Name` VARCHAR(100),
  `TestType` VARCHAR(50),
  `GrowerName` VARCHAR(150),
  `VillageName` VARCHAR(100),
  `Variety` VARCHAR(100),
  `LandType` VARCHAR(50),
  `SoilType` VARCHAR(50),
  `CropType` VARCHAR(50),
  `FieldCondition` VARCHAR(50),
  `CropCondition` VARCHAR(50),
  `SamplingPoint` VARCHAR(50),
  `BottomBrix` DECIMAL(5,2),
  `MiddleBrix` DECIMAL(5,2),
  `TopBrix` DECIMAL(5,2),
  `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
