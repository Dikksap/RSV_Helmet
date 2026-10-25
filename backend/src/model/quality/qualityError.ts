export class QualityError extends Error {
  constructor(
    public readonly code:
      | "INPUT_INVALID"
      | "INSPECTION_NOT_FOUND"
      | "INSPECTION_FINALIZED"
      | "LOT_NOT_FOUND"
      | "WIP_SHORT"
      | "LOCATION_NOT_FOUND"
      | "VARIANT_REQUIRED"
      | "DEFECT_ASSIGNMENT_REQUIRED"
      | "REPAIR_NOT_FOUND"
      | "REPAIR_SCOPE_DENIED"
      | "REPAIR_NOT_READY"
      | "REPAIR_QUANTITY_EXCEEDED"
      | "REPAIR_ALREADY_REVIEWED"
      | "ROUTING_INVALID"
      | "ITEM_NOT_FOUND"
      | "STOCKTAKE_CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "QualityError";
  }
}
