import type { Request, Response } from "express";
import {
  createRepairAttempt,
  createQualityInspection,
  finalizeQualityInspection,
  getQualityInspection,
  listQualityInspections,
  listRepairAssignments,
  reopenQualityInspection,
  reviewRepairAttempt,
  updateQualityInspectionLine,
  QualityError,
  type QualityLineInput,
  type ReopenQualityLineInput,
} from "../../model/quality/quality.js";
import { InventoryError } from "../../model/inventory/inventory.js";
import {
  claimWipReject,
  createRejectReason,
  createWipReject,
  createWipRejectRepairAttempt,
  listRejectOptions,
  listRejectReasons,
  listWipRejects,
  reviewWipRejectRepair,
  WipRejectError,
} from "../../model/quality/wipReject.js";

function positiveInt(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function canRepairWork(req: Request): boolean {
  const access = req.access;
  return !!access && (
    access.role === "admin" ||
    access.role === "produksi" ||
    access.permissions.includes("REPAIR_WORK")
  );
}

function repairDivisionForRequest(
  req: Request,
  res: Response,
  requestedValue: unknown,
): number | null {
  const access = req.access;
  if (!access) {
    res.status(401).json({ message: "Token tidak ditemukan" });
    return null;
  }

  if (access.role === "admin") {
    const divisionId = positiveInt(requestedValue) ?? access.divisiId ?? null;
    if (!divisionId) {
      res.status(400).json({ message: "Pilih divisi kerja sebelum memproses rework" });
      return null;
    }
    return divisionId;
  }

  if (!canRepairWork(req)) {
    res.status(403).json({ message: "Tidak memiliki akses pekerjaan rework" });
    return null;
  }
  if (!access.divisiId) {
    res.status(403).json({ message: "Akun produksi harus terhubung ke divisi untuk mengerjakan rework" });
    return null;
  }

  if (requestedValue !== undefined && requestedValue !== null) {
    const requestedDivisionId = positiveInt(requestedValue);
    if (requestedDivisionId !== access.divisiId) {
      res.status(403).json({ message: "Rework hanya dapat dikerjakan pada divisi akun Anda" });
      return null;
    }
  }
  return access.divisiId;
}

function decimal(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return Number.NaN;
}

function respondError(res: Response, error: unknown) {
  if (error instanceof QualityError || error instanceof InventoryError || error instanceof WipRejectError) {
    const code = error.code;
    const status = code.includes("NOT_FOUND") ? 404
      : code.includes("SCOPE_DENIED") ? 403
      : code.includes("SHORT") || code.includes("FINALIZED") || code.includes("CONFLICT") ||
        code.includes("ALREADY") || code.includes("INSUFFICIENT") || code.includes("INVALID_STATUS") ? 409
      : 400;
    return res.status(status).json({ code, message: error.message });
  }
  return res.status(500).json({
    message: error instanceof Error ? error.message : "Terjadi kesalahan pada workflow QC",
  });
}

function rejectId(value: unknown): number | null {
  return positiveInt(value);
}

function isQcUser(req: Request) {
  return req.access?.role === "admin" || req.access?.role === "qc";
}

export async function listWipRejectOptionsHandler(req: Request, res: Response) {
  if (!isQcUser(req)) return res.status(403).json({ message: "Menu ini khusus petugas QC" });
  try {
    return res.json(await listRejectOptions());
  } catch (error) {
    return respondError(res, error);
  }
}

export async function listWipRejectReasonsHandler(req: Request, res: Response) {
  if (!isQcUser(req)) return res.status(403).json({ message: "Menu ini khusus petugas QC" });
  try {
    return res.json(await listRejectReasons());
  } catch (error) {
    return respondError(res, error);
  }
}

export async function createWipRejectReasonHandler(req: Request, res: Response) {
  if (!isQcUser(req)) return res.status(403).json({ message: "Menu ini khusus petugas QC" });
  if (typeof req.body?.name !== "string" || !req.body.name.trim()) {
    return res.status(400).json({ message: "Alasan reject wajib diisi" });
  }
  try {
    return res.status(201).json(await createRejectReason(req.body.name, req.user!.id));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function createWipRejectHandler(req: Request, res: Response) {
  if (!isQcUser(req)) return res.status(403).json({ message: "Menu ini khusus petugas QC" });
  const itemId = positiveInt(req.body?.itemId);
  const reasonId = positiveInt(req.body?.reasonId);
  const repairDivisionId = positiveInt(req.body?.repairDivisionId);
  const quantity = decimal(req.body?.quantity);
  if (!itemId || !reasonId || !repairDivisionId || !Number.isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({ message: "Item, jumlah reject, alasan, dan divisi repair wajib diisi" });
  }
  try {
    return res.status(201).json(await createWipReject({
      itemId,
      quantity,
      reasonId,
      repairDivisionId,
      recordedById: req.user!.id,
    }));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function listWipRejectsHandler(req: Request, res: Response) {
  const isAdmin = req.access?.role === "admin";
  const isRepairWorker = canRepairWork(req);
  if (!isQcUser(req) && !isRepairWorker) {
    return res.status(403).json({ message: "Tidak memiliki akses antrean reject" });
  }
  const divisionId = req.access?.divisiId ?? null;
  const requestedDivisionId = req.query.divisionId === undefined
    ? undefined
    : positiveInt(req.query.divisionId);
  if (req.query.divisionId !== undefined && !requestedDivisionId) {
    return res.status(400).json({ message: "Filter divisi rework tidak valid" });
  }
  const divisionFilter = isAdmin
    ? requestedDivisionId ?? undefined
    : isQcUser(req)
      ? undefined
      : divisionId ?? undefined;
  if (isRepairWorker && !isAdmin && !isQcUser(req) && !divisionId) {
    return res.status(403).json({ message: "Akun belum terhubung ke divisi repair" });
  }
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const validStatuses = new Set(["OPEN", "IN_PROGRESS", "WAITING_QC", "COMPLETED"]);
  const requestedStatuses = status?.split(",");
  if (status && status !== "ACTIVE" &&
      (!requestedStatuses?.length || requestedStatuses.some((value) => !validStatuses.has(value)))) {
    return res.status(400).json({ message: "Filter status reject tidak valid" });
  }
  const limit = req.query.limit === undefined ? 100 : positiveInt(req.query.limit);
  if (!limit || limit > 100) {
    return res.status(400).json({ message: "limit harus 1 sampai 100" });
  }
  try {
    return res.json(await listWipRejects({
      repairDivisionId: divisionFilter,
      status,
      limit,
    }));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function claimWipRejectHandler(req: Request, res: Response) {
  const id = rejectId(req.params.id);
  if (!id) return res.status(400).json({ message: "Reject tidak valid" });
  const divisionId = repairDivisionForRequest(req, res, req.body?.divisionId);
  if (!divisionId) return;
  try {
    return res.json(await claimWipReject(id, req.user!.id, divisionId));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function createWipRejectRepairAttemptHandler(req: Request, res: Response) {
  const id = rejectId(req.params.id);
  const divisionId = repairDivisionForRequest(req, res, req.body?.divisionId);
  const outputItemId = req.body?.outputItemId == null ? undefined : positiveInt(req.body.outputItemId) ?? undefined;
  const quantityAttempted = decimal(req.body?.quantityAttempted);
  const quantityRepaired = decimal(req.body?.quantityRepaired);
  if (!id) return res.status(400).json({ message: "Reject tidak valid" });
  if (!divisionId) return;
  if (typeof req.body?.notes !== "undefined" && typeof req.body.notes !== "string") {
    return res.status(400).json({ message: "Catatan repair tidak valid" });
  }
  try {
    return res.status(201).json(await createWipRejectRepairAttempt({
      rejectId: id,
      userId: req.user!.id,
      divisionId,
      quantityAttempted,
      quantityRepaired,
      outputItemId,
      notes: req.body?.notes,
    }));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function reviewWipRejectRepairHandler(req: Request, res: Response) {
  if (!isQcUser(req)) return res.status(403).json({ message: "Pemeriksaan repair hanya dapat dilakukan petugas QC" });
  const id = rejectId(req.params.id);
  const attemptId = rejectId(req.params.attemptId);
  if (!id || !attemptId || typeof req.body?.approved !== "boolean") {
    return res.status(400).json({ message: "Keputusan QC tidak valid" });
  }
  if (typeof req.body?.notes !== "undefined" && typeof req.body.notes !== "string") {
    return res.status(400).json({ message: "Catatan QC tidak valid" });
  }
  try {
    return res.json(await reviewWipRejectRepair({
      rejectId: id,
      attemptId,
      reviewerId: req.user!.id,
      approved: req.body.approved,
      notes: req.body.notes,
    }));
  } catch (error) {
    return respondError(res, error);
  }
}

function canManageAllRepairAssignments(req: Request) {
  return req.access?.role === "admin" || req.access?.permissions.includes("QUALITY_FINALIZE");
}

export async function listRepairAssignmentsHandler(req: Request, res: Response) {
  const divisiId = canManageAllRepairAssignments(req) ? undefined : req.access?.divisiId ?? undefined;
  if (!canManageAllRepairAssignments(req) && divisiId === undefined) {
    return res.status(403).json({ message: "Akun repair belum terhubung ke divisi" });
  }
  try {
    return res.json(await listRepairAssignments({ divisiId }));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function createRepairAttemptHandler(req: Request, res: Response) {
  const assignmentId = positiveInt(req.params.id);
  const quantityAttempted = decimal(req.body?.quantityAttempted);
  const quantityRepaired = decimal(req.body?.quantityRepaired);
  const notes = req.body?.notes;
  if (!assignmentId) return res.status(400).json({ message: "id penugasan tidak valid" });
  if (
    !Number.isSafeInteger(quantityAttempted) ||
    !Number.isSafeInteger(quantityRepaired) ||
    (notes !== undefined && notes !== null && typeof notes !== "string")
  ) {
    return res.status(400).json({ message: "Jumlah attempt, hasil repair, atau notes tidak valid" });
  }
  if (!req.user?.id || !req.access) return res.status(401).json({ message: "Token tidak ditemukan" });
  if (!canManageAllRepairAssignments(req) && req.access.divisiId == null) {
    return res.status(403).json({ message: "Akun repair belum terhubung ke divisi" });
  }
  try {
    const assignment = await createRepairAttempt(
      assignmentId,
      { quantityAttempted, quantityRepaired, notes },
      req.user.id,
      canManageAllRepairAssignments(req) ? undefined : req.access.divisiId ?? undefined,
    );
    return res.status(201).json(assignment);
  } catch (error) {
    return respondError(res, error);
  }
}

export async function reviewRepairAttemptHandler(req: Request, res: Response) {
  const assignmentId = positiveInt(req.params.id);
  const attemptId = positiveInt(req.params.attemptId);
  const approved = req.body?.approved;
  const notes = req.body?.notes;
  if (!assignmentId || !attemptId) return res.status(400).json({ message: "id repair tidak valid" });
  if (typeof approved !== "boolean" || (notes !== undefined && notes !== null && typeof notes !== "string")) {
    return res.status(400).json({ message: "approved harus boolean dan notes harus berupa teks" });
  }
  if (!req.user?.id) return res.status(401).json({ message: "Token tidak ditemukan" });
  try {
    return res.json(await reviewRepairAttempt(
      assignmentId,
      attemptId,
      { approved, notes },
      req.user.id,
    ));
  } catch (error) {
    return respondError(res, error);
  }
}

function parseLines(value: unknown): QualityLineInput[] | null {
  if (!Array.isArray(value)) return null;
  const lines: QualityLineInput[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") return null;
    const line = row as Record<string, unknown>;
    const pemakaianMaterialItemId = positiveInt(line.pemakaianMaterialItemId);
    const inspectedQuantity = decimal(line.inspectedQuantity);
    const passedQuantity = decimal(line.passedQuantity);
    const repairQuantity = decimal(line.repairQuantity);
    const rejectedQuantity = decimal(line.rejectedQuantity);
    const productVariantId = line.productVariantId == null
      ? null
      : positiveInt(line.productVariantId);
    if (
      !pemakaianMaterialItemId ||
      !Number.isFinite(inspectedQuantity) ||
      !Number.isFinite(passedQuantity) ||
      !Number.isFinite(repairQuantity) ||
      !Number.isFinite(rejectedQuantity) ||
      (line.productVariantId != null && !productVariantId)
    ) {
      return null;
    }
    const defects = line.defects === undefined ? [] : line.defects;
    if (!Array.isArray(defects)) return null;
    const parsedDefects = [];
    for (const rawDefect of defects) {
      if (!rawDefect || typeof rawDefect !== "object") return null;
      const defect = rawDefect as Record<string, unknown>;
      if (typeof defect.description !== "string") return null;
      const quantity = decimal(defect.quantity);
      const divisionId = (key: string) =>
        defect[key] == null ? null : positiveInt(defect[key]);
      const foundAtDivisionId = divisionId("foundAtDivisionId");
      const originDivisionId = divisionId("originDivisionId");
      const repairDivisionId = divisionId("repairDivisionId");
      if (
        !Number.isFinite(quantity) ||
        (defect.foundAtDivisionId != null && !foundAtDivisionId) ||
        (defect.originDivisionId != null && !originDivisionId) ||
        (defect.repairDivisionId != null && !repairDivisionId)
      ) {
        return null;
      }
      parsedDefects.push({
        description: defect.description,
        quantity,
        foundAtDivisionId,
        originDivisionId,
        repairDivisionId,
      });
    }
    lines.push({
      pemakaianMaterialItemId,
      productVariantId,
      inspectedQuantity,
      passedQuantity,
      repairQuantity,
      rejectedQuantity,
      defects: parsedDefects,
    });
  }
  return lines;
}

function parseReopenLines(value: unknown): ReopenQualityLineInput[] | null {
  if (!Array.isArray(value)) return null;
  const mapped = value.map((row) => {
    if (!row || typeof row !== "object") return row;
    const line = row as Record<string, unknown>;
    return { ...line, pemakaianMaterialItemId: line.sourceLineId };
  });
  const parsed = parseLines(mapped);
  if (!parsed) return null;
  return parsed.map(({ pemakaianMaterialItemId, productVariantId: _variantId, ...line }) => ({
    sourceLineId: pemakaianMaterialItemId,
    ...line,
  }));
}

export async function listQualityInspectionsHandler(req: Request, res: Response) {
  const take = req.query.take === undefined ? 100 : positiveInt(req.query.take);
  const status = req.query.status;
  if (!take || take > 500) return res.status(400).json({ message: "take harus 1 sampai 500" });
  if (status !== undefined && status !== "DRAFT" && status !== "COMPLETED") {
    return res.status(400).json({ message: "status inspeksi tidak valid" });
  }
  try {
    return res.json(await listQualityInspections({
      take,
      status: status as "DRAFT" | "COMPLETED" | undefined,
    }));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function getQualityInspectionHandler(req: Request, res: Response) {
  const id = positiveInt(req.params.id);
  if (!id) return res.status(400).json({ message: "id inspeksi tidak valid" });
  try {
    return res.json(await getQualityInspection(id));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function updateQualityInspectionLineHandler(req: Request, res: Response) {
  const inspectionId = positiveInt(req.params.id);
  const lineId = positiveInt(req.params.lineId);
  const passedQuantity = decimal(req.body?.passedQuantity);
  const repairQuantity = decimal(req.body?.repairQuantity);
  const rejectedQuantity = decimal(req.body?.rejectedQuantity);
  const inspectedQuantity = passedQuantity + repairQuantity + rejectedQuantity;
  const parsed = parseLines([{
    pemakaianMaterialItemId: 1,
    productVariantId: req.body?.productVariantId,
    inspectedQuantity,
    passedQuantity,
    repairQuantity,
    rejectedQuantity,
    defects: req.body?.defects,
  }]);
  if (!inspectionId || !lineId) return res.status(400).json({ message: "id inspeksi atau baris tidak valid" });
  if (!parsed) return res.status(400).json({ message: "Hasil inspeksi tidak valid" });
  try {
    const { productVariantId, passedQuantity: passed, repairQuantity: repair, rejectedQuantity: rejected, defects } = parsed[0];
    return res.json(await updateQualityInspectionLine(inspectionId, lineId, {
      productVariantId,
      passedQuantity: passed,
      repairQuantity: repair,
      rejectedQuantity: rejected,
      defects,
    }));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function createQualityInspectionHandler(req: Request, res: Response) {
  const lines = parseLines(req.body?.lines);
  if (!lines?.length) return res.status(400).json({ message: "lines harus berisi baris inspeksi valid" });
  if (req.body?.notes !== undefined && req.body.notes !== null && typeof req.body.notes !== "string") {
    return res.status(400).json({ message: "notes harus berupa teks" });
  }
  if (!req.user?.id) return res.status(401).json({ message: "Token tidak ditemukan" });
  try {
    const inspection = await createQualityInspection(
      { notes: req.body?.notes, lines },
      req.user.id,
    );
    return res.status(201).json(inspection);
  } catch (error) {
    return respondError(res, error);
  }
}

export async function finalizeQualityInspectionHandler(req: Request, res: Response) {
  const id = positiveInt(req.params.id);
  if (!id) return res.status(400).json({ message: "id inspeksi tidak valid" });
  if (!req.user?.id) return res.status(401).json({ message: "Token tidak ditemukan" });
  try {
    return res.json(await finalizeQualityInspection(id, req.user.id));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function reopenQualityInspectionHandler(req: Request, res: Response) {
  const id = positiveInt(req.params.id);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const lines = parseReopenLines(req.body?.lines);
  if (!id) return res.status(400).json({ message: "id inspeksi tidak valid" });
  if (reason.length < 5 || !lines?.length) {
    return res.status(400).json({ message: "reason minimal 5 karakter dan lines wajib diisi" });
  }
  if (!req.user?.id) return res.status(401).json({ message: "Token tidak ditemukan" });
  try {
    return res.status(201).json(await reopenQualityInspection(id, reason, lines, req.user.id));
  } catch (error) {
    return respondError(res, error);
  }
}
