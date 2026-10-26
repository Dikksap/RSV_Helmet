import type { RoutingItem, RoutingStageForm } from "./types";

export type RoutingValidation = {
  stageIssues: Record<string, string[]>;
  globalIssues: string[];
  issueCount: number;
};

export function validateRouting(
  stages: RoutingStageForm[],
  itemById: Map<string, RoutingItem>,
): RoutingValidation {
  const stageIssues: Record<string, string[]> = {};
  const globalIssues: string[] = [];

  if (stages.length < 2) {
    globalIssues.push("Routing harus memiliki minimal dua tahap produksi.");
  }

  function itemOf(id: string): RoutingItem | undefined {
    return itemById.get(id);
  }

  stages.forEach((stage, index) => {
    const issues: string[] = [];
    const divisionId = Number(stage.divisiId);
    const hasDivision = Boolean(stage.divisiId) && Number.isFinite(divisionId);

    if (!stage.stage.trim()) issues.push("Nama tahap wajib diisi.");
    if (stage.stage.trim().length > 80) issues.push("Nama tahap maksimal 80 karakter.");
    if (!hasDivision) issues.push("Divisi produksi wajib dipilih.");
    if (stage.inputItemIds.length === 0) issues.push("Pilih minimal satu item input.");
    if (stage.outputItemIds.length === 0) issues.push("Pilih minimal satu item output.");
    if (new Set(stage.inputItemIds).size !== stage.inputItemIds.length) {
      issues.push("Item input tidak boleh duplikat.");
    }
    if (new Set(stage.outputItemIds).size !== stage.outputItemIds.length) {
      issues.push("Item output tidak boleh duplikat.");
    }

    for (const itemId of stage.outputItemIds) {
      const item = itemOf(itemId);
      if (!item) {
        issues.push(`Item output #${itemId} tidak ditemukan pada master item.`);
        continue;
      }
      if (item.jenis !== undefined && item.jenis !== "SM") {
        issues.push(`Item output ${item.kode} harus berjenis SM.`);
      }
      if (hasDivision && item.divisiId !== undefined && item.divisiId !== divisionId) {
        issues.push(`Item output ${item.kode} bukan milik divisi yang dipilih.`);
      }
    }

    if (index === 0) {
      for (const itemId of stage.inputItemIds) {
        const item = itemOf(itemId);
        if (!item) {
          issues.push(`Item input #${itemId} tidak ditemukan pada master item.`);
          continue;
        }
        if (hasDivision && item.divisiId !== undefined && item.divisiId !== divisionId) {
          issues.push(`Item input ${item.kode} tidak tersedia di divisi yang dipilih.`);
        }
      }
    } else {
      const previousOutputs = new Set(stages[index - 1]!.outputItemIds);
      for (const itemId of stage.inputItemIds) {
        if (!previousOutputs.has(itemId)) {
          const item = itemOf(itemId);
          issues.push(`Item input ${item ? item.kode : `#${itemId}`} bukan output tahap ${index}.`);
        }
      }
    }

    if (issues.length > 0) stageIssues[stage.key] = issues;
  });

  const issueCount = globalIssues.length
    + Object.values(stageIssues).reduce((total, issues) => total + issues.length, 0);

  return { stageIssues, globalIssues, issueCount };
}
