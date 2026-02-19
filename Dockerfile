FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build
# Create SPA fallback
RUN cp build/index.html build/404.html

FROM nginx:alpine
# Copy built static files to Nginx default public directory
COPY --from=builder /app/build /usr/share/nginx/html
# SPA routing: redirect all requests to index.html if file not found
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
