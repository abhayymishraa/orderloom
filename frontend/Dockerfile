FROM oven/bun:latest

WORKDIR /home

RUN bun install -g serve

COPY package.json bun.lock ./
RUN bun install

COPY . .
    
ENV VITE_API_URL=https://api.orderloom.abhayymishraa.com/api/v1
ENV VITE_WEBSOCKET_URL=wss://ws.orderloom.abhayymishraa.com

RUN bun run build

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
