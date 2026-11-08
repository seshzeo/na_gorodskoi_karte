FROM node:22-alpine AS build

WORKDIR /src

ARG VITE_API_URL=/api/v1
ARG VITE_MAP_TILE_URL=
ENV VITE_API_URL=$VITE_API_URL \
    VITE_MAP_TILE_URL=$VITE_MAP_TILE_URL

COPY app/frontend/package.json app/frontend/package-lock.json ./
RUN npm ci

COPY app/frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine

COPY app/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html

EXPOSE 80
