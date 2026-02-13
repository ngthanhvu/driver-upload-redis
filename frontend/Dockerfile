FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN corepack enable && pnpm install

COPY . .

EXPOSE 5173

CMD ["pnpm", "run", "dev", "--", "--host", "0.0.0.0"]
