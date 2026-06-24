FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 \
    libgbm1 libasound2 libxcomposite1 libxdamage1 \
    libxrandr2 libpango-1.0-0 libcairo2 libcups2 libgtk-3-0 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY src/ src/

EXPOSE 3000
CMD ["node", "src/server.js"]
