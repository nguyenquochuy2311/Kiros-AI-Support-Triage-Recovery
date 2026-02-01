FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN apk -U upgrade && apk add --no-cache openssl
RUN npm install

COPY . .

RUN npm run build
RUN npx prisma generate

EXPOSE 3001

CMD ["npm", "start"]
