FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN corepack enable && pnpm install

COPY tsconfig.json ./
COPY src ./src

EXPOSE 5000

CMD ["pnpm", "run", "dev"]
