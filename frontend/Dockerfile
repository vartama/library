# --- build: compile the React app to static files ---
FROM node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite reads VITE_* at build time. The browser calls the API, so this must be a URL reachable
# from the user's machine (e.g. http://localhost:3000/api), not the compose service name.
ARG VITE_API_URL=http://localhost:3000/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- serve: only the built files, behind nginx ---
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -q -O /dev/null http://localhost/ || exit 1
