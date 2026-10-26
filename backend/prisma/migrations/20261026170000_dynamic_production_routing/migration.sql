ALTER TABLE `ProductionRoutingStage`
  DROP INDEX `ProductionRoutingStage_routingId_stage_key`,
  MODIFY `stage` VARCHAR(80) NOT NULL;
