# --- build stage ----------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Populates the login widget's @username at build time — Vite only embeds
# process.env-visible vars (VITE_*) that exist when `npm run build` runs.
ARG VITE_TELEGRAM_BOT_USERNAME
ENV VITE_TELEGRAM_BOT_USERNAME=$VITE_TELEGRAM_BOT_USERNAME
RUN npm run build

# --- serve stage ----------------------------------------------------------
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80