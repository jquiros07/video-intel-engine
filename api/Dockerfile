# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY tsconfig.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY src ./src

RUN npx prisma generate
RUN npm run build

# Stage 2: Run the application
FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/src/generated ./dist/generated
COPY prisma ./prisma
COPY prisma.config.ts ./

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Azure App Service sets the PORT environment variable
ENV PORT=8080
EXPOSE 8080

CMD ["./entrypoint.sh"]
