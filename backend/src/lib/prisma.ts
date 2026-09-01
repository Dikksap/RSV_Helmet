import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "express_api",
  connectionLimit: 5,
});

const prisma = new PrismaClient({ adapter });

export default prisma;
