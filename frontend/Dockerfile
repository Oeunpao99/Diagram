# --- build stage ----------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Public OAuth client IDs are baked into the JS at build time. .env files are
# excluded from the build context, so they arrive as build args instead
# (set in the root .env next to docker-compose.yml). Empty = button disabled.
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_GITHUB_CLIENT_ID=
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_GITHUB_CLIENT_ID=$VITE_GITHUB_CLIENT_ID
RUN npm run build

# --- serve stage ----------------------------------------------------------
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80