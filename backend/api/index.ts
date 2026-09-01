import { createServer } from "node:http";

process.env.TZ = process.env.TZ ?? "Asia/Jakarta";

import app from "../src/app.js";
import { initializeWebSocket } from "../src/websocket/socket.js";

const PORT = Number(process.env.PORT) || 8000;

// Vercel menggunakan app sebagai Serverless Function.
// Runtime biasa menggunakan HTTP server + WebSocket.
if (process.env.VERCEL !== "1") {
  const server = createServer(app);

  initializeWebSocket(server);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server berjalan di http://0.0.0.0:${PORT}`);
    console.log(`WebSocket berjalan di ws://0.0.0.0:${PORT}`);
  });
}

export default app;