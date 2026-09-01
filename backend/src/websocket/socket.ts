import Redis from "ioredis";
import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "node:http";
import type {
  Product,
  ProductVariant,
  Barang,
} from "../../generated/prisma/client.js";
import type { GenerateBarangResult } from "../model/barang/barang.generate.js";

// =============================================
// WebSocket Event Types
// =============================================

type ProductCreatedEvent = {
  type: "product.created";
  message: string;
  data: Product;
};

type ProductUpdatedEvent = {
  type: "product.updated";
  message: string;
  data: Product;
};

type ProductDeletedEvent = {
  type: "product.deleted";
  message: string;
  data: { id: number };
};

type VariantCreatedEvent = {
  type: "variant.created";
  message: string;
  data: ProductVariant;
};

type VariantUpdatedEvent = {
  type: "variant.updated";
  message: string;
  data: ProductVariant;
};

type VariantDeletedEvent = {
  type: "variant.deleted";
  message: string;
  data: { id: number };
};

type BarangGeneratedEvent = {
  type: "barang.generated";
  message: string;
  data: GenerateBarangResult;
};

type BarangStatusUpdatedEvent = {
  type: "barang.status_updated";
  message: string;
  data: Barang;
};

export type AppEvent =
  | ProductCreatedEvent
  | ProductUpdatedEvent
  | ProductDeletedEvent
  | VariantCreatedEvent
  | VariantUpdatedEvent
  | VariantDeletedEvent
  | BarangGeneratedEvent
  | BarangStatusUpdatedEvent;

// =============================================
// Redis Pub/Sub
// Dua instance terpisah — satu koneksi Redis
// tidak bisa dipakai untuk cache + subscribe
// secara bersamaan
// =============================================

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const CHANNEL = "product-events";

const redisPub = new Redis(REDIS_URL);
const redisSub = new Redis(REDIS_URL);

redisPub.on("error", (err) => {
  console.error("Redis publisher error:", err.message);
});

redisSub.on("error", (err) => {
  console.error("Redis subscriber error:", err.message);
});

// =============================================
// Client Registry
// =============================================

const clients = new Set<WebSocket>();

// =============================================
// Broadcast ke semua WS client lokal
// =============================================

function broadcastLocal(payload: string): void {
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch (error) {
        console.error("Gagal broadcast ke client:", error);
      }
    }
  }
}

// =============================================
// Publish event ke Redis
// Dipanggil dari route setelah operasi DB berhasil
// =============================================

export async function broadcast(event: AppEvent): Promise<void> {
  await redisPub.publish(CHANNEL, JSON.stringify(event));
}

// =============================================
// Initialize WebSocket + Redis Subscribe
// =============================================

export function initializeWebSocket(server: Server): void {
  // Subscribe ke Redis channel
  redisSub.subscribe(CHANNEL, (err) => {
    if (err) {
      console.error("Gagal subscribe Redis channel:", err.message);
    } else {
      console.log(`Redis subscribe ke channel: ${CHANNEL}`);
    }
  });

  // Terima pesan dari Redis → broadcast ke semua WS client lokal
  redisSub.on("message", (_channel, message) => {
    broadcastLocal(message);
  });

  // WebSocket server
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    clients.add(ws);
    console.log(`WebSocket client connected (total: ${clients.size})`);

    ws.send(JSON.stringify({ message: "WebSocket terhubung" }));

    ws.on("close", () => {
      clients.delete(ws);
      console.log(`WebSocket client disconnected (total: ${clients.size})`);
    });

    ws.on("error", (error) => {
      console.error("WebSocket client error:", error);
      clients.delete(ws);
    });
  });
}
