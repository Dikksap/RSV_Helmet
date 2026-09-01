FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=development
ENV TZ=Asia/Jakarta

# Install dependencies sistem
# tzdata diperlukan agar timezone Asia/Jakarta tersedia
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        openssl \
        tzdata \
    && ln -snf /usr/share/zoneinfo/Asia/Jakarta /etc/localtime \
    && echo "Asia/Jakarta" > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies dulu
# Akan di-cache selama package.json/package-lock.json tidak berubah
COPY package*.json ./

RUN npm ci

# Prisma generate dijalankan saat startup via CMD,
# bukan saat build, karena schema.prisma di-mount
# dari host melalui bind mount.

EXPOSE 8000

# Startup:
# 1. Generate Prisma Client dari schema terbaru
# 2. Jalankan API dengan hot reload
#
# Migration TIDAK dijalankan otomatis.
# Jalankan manual jika diperlukan:
#
# docker compose exec api npx prisma migrate dev --name <nama_migration>

CMD ["sh", "-c", "npx prisma generate && npm run dev"]