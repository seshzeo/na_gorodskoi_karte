FROM node:22-alpine AS build

WORKDIR /src

ARG VITE_API_URL=/api/v1
ARG VITE_MAP_TILE_URL=
ARG VITE_MAP_TILE_ATTRIBUTION=
ARG VITE_MAP_STYLE_URL=
ARG VITE_MAP_STYLE_URL_DARK=
ARG VITE_MAPTILER_API_KEY=

ENV VITE_API_URL=$VITE_API_URL \
    VITE_MAP_TILE_URL=$VITE_MAP_TILE_URL \
    VITE_MAP_TILE_ATTRIBUTION=$VITE_MAP_TILE_ATTRIBUTION \
    VITE_MAP_STYLE_URL=$VITE_MAP_STYLE_URL \
    VITE_MAP_STYLE_URL_DARK=$VITE_MAP_STYLE_URL_DARK \
    VITE_MAPTILER_API_KEY=$VITE_MAPTILER_API_KEY
COPY app/frontend/package.json app/frontend/package-lock.json ./
RUN npm ci

COPY app/frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine

COPY app/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html

EXPOSE 80
