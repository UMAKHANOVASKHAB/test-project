# Один контейнер: собирает мини-апп и сервер, сервер отдаёт и API, и статику
FROM node:22-slim AS build
WORKDIR /app
COPY package.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN npm install --no-audit --no-fund
COPY . .
ENV VITE_API_URL=
RUN npm run build -w apps/web && npm run build -w apps/api

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/web/dist apps/web/dist
# по этому меню сервер сам считает цены и штампы
COPY --from=build /app/apps/web/src/data/menu.json apps/web/src/data/menu.json
# Railway запрещает VOLUME в Dockerfile: диск подключается в настройках сервиса (Volume → /data)
ENV PORT=3000 WEB_DIST=/app/apps/web/dist DB_FILE=/data/ninebar.db
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
