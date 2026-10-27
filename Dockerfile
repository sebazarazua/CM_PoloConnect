FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
    && python3 -m venv /opt/polo-venv \
    && rm -rf /var/lib/apt/lists/*
ENV PYTHON_EXECUTABLE=/opt/polo-venv/bin/python
COPY package.json package-lock.json requirements-dev.txt ./
RUN npm ci && /opt/polo-venv/bin/python -m pip install --no-cache-dir -r requirements-dev.txt \
    && npx playwright install --with-deps chromium --only-shell
COPY . .
RUN npm run db:generate && npm run build
ENV NODE_ENV=production
CMD ["npm","run","cm:auto-cycle"]
