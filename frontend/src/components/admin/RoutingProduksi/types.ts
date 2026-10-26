import type { Node } from "@xyflow/react";
import type { Item } from "../../../api/item";

export type StagePosition = { x: number; y: number };

export type RoutingStageForm = {
  key: string;
  stage: string;
  divisiId: string;
  inputItemIds: string[];
  outputItemIds: string[];
  position: StagePosition;
};

export type RoutingItem = {
  id: string;
  kode: string;
  nama: string;
  unit?: string | null;
  divisiId?: number | null;
  jenis?: string | null;
};

export type RoutingStageDraft = Pick<
  RoutingStageForm,
  "stage" | "divisiId" | "inputItemIds" | "outputItemIds"
>;

export type RoutingStageNodeData = {
  stageKey: string;
  index: number;
  total: number;
  title: string;
  divisionName: string;
  inputs: RoutingItem[];
  outputs: RoutingItem[];
  issues: string[];
  onEdit: (key: string) => void;
  onDuplicate: (key: string) => void;
  onRemove: (key: string) => void;
  onMove: (key: string, offset: -1 | 1) => void;
};

export type StageFlowNode = Node<RoutingStageNodeData, "routingStage">;

export const NODE_WIDTH = 292;
export const NODE_GAP = 92;

export function layoutPosition(index: number): StagePosition {
  return { x: index * (NODE_WIDTH + NODE_GAP), y: 0 };
}

export function toRoutingItem(item: Item): RoutingItem {
  return {
    id: String(item.id),
    kode: item.kode,
    nama: item.nama,
    unit: item.unit,
    divisiId: item.divisiId,
    jenis: item.jenis,
  };
}

export function fallbackRoutingItem(id: string, item: { kode: string; nama: string; unit: string | null }): RoutingItem {
  return { id, kode: item.kode, nama: item.nama, unit: item.unit };
}

export function itemLabel(item: RoutingItem): string {
  return `${item.kode} - ${item.nama}`;
}

export function itemUnit(item: RoutingItem): string {
  return item.unit || "pcs";
}

export function serializeStages(stages: RoutingStageForm[]): string {
  return JSON.stringify(stages.map((stage) => ({
    stage: stage.stage,
    divisiId: stage.divisiId,
    inputItemIds: [...stage.inputItemIds].sort(),
    outputItemIds: [...stage.outputItemIds].sort(),
  })));
}
