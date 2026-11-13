import prisma from "../src/lib/prisma.js";
import {
  getFinishedGoodsSummary,
  getMaterialConsumption,
  getReconciliation,
  getTraceability,
} from "../src/model/reports/reports.js";

const from = new Date("2026-08-01T00:00:00+07:00");
const to = new Date("2026-11-30T00:00:00+07:00");

function log(label: string, value: unknown) {
  console.log(`[${label}]`, typeof value === "string" ? value : JSON.stringify(value));
}

try {
  const fg = await getFinishedGoodsSummary({ from, to });
  log("FG.totals", fg.totals);
  log("FG.warnings", fg.warnings.map((w) => w.code));
  log("FG.perVariant[0]", fg.perVariant[0] ?? null);

  const mcFg = await getMaterialConsumption({ from, to, basis: "FINISHGOOD" });
  log("MC-FG.summary", mcFg.summary);
  log("MC-FG.rows", mcFg.rows.length);
  log("MC-FG.warnings", mcFg.warnings.map((w) => w.code));
  log("MC-FG.sample", mcFg.rows.slice(0, 3));

  const mcProd = await getMaterialConsumption({ from, to, basis: "PRODUKSI" });
  log("MC-PROD.summary", mcProd.summary);
  log("MC-PROD.rows", mcProd.rows.length);
  log("MC-PROD.warnings", mcProd.warnings.map((w) => w.code));
  log("MC-PROD.sample", mcProd.rows.slice(0, 3));

  const rec = await getReconciliation({ from, to });
  log("REC.perVariant[0]", rec.perVariant[0] ?? null);
  log("REC.wip", rec.wip.length);
  log("REC.legacy", rec.legacy);

  const linked = await prisma.barang.findFirst({
    where: { hasilProduksiHarianItemId: { not: null } },
    select: { id: true, kodeBarang: true },
  });
  log("linkedUnit", linked);
  if (linked) {
    const tr = await getTraceability({ from, to, barangId: linked.id });
    log("TRACE.flags", tr.rows[0]?.flags);
    log("TRACE.production", tr.rows[0]?.production?.nomor ?? null);
    log("TRACE.materials", tr.rows[0]?.materialsPerUnit?.length ?? 0);
  }

  const anyFg = await prisma.barang.findFirst({
    where: { finishGoodAt: { not: null } },
    select: { id: true },
  });
  if (anyFg) {
    const tr = await getTraceability({ from, to, barangId: anyFg.id });
    log("TRACE.legacyFlags", tr.rows[0]?.flags);
    log("TRACE.legacySource", tr.rows[0]?.genealogySource ?? null);
  }
  console.log("SMOKE_OK");
} catch (error) {
  console.error("SMOKE_FAIL", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

