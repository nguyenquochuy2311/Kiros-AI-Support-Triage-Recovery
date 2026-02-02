FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 expressjs
RUN adduser --system --uid 1001 expressjs

COPY --from=builder --chown=expressjs:expressjs /app/dist ./dist
COPY --from=builder --chown=expressjs:expressjs /app/node_modules ./node_modules
COPY --from=builder --chown=expressjs:expressjs /app/package.json ./package.json
COPY --from=builder --chown=expressjs:expressjs /app/prisma ./prisma

USER expressjs

EXPOSE 3001

CMD ["npm", "start"]
