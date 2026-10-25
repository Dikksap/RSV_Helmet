import "dotenv/config";
import { pathToFileURL } from "node:url";
import prisma from "../src/lib/prisma.js";
import { seedProductionFlow } from "./seed-production-flow.js";

export const seedHasilProduksiHarian = seedProductionFlow;

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  seedHasilProduksiHarian()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
