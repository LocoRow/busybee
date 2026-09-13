# Busy Bee — pagina estatica + aviso de pedidos por Telegram
FROM node:22-alpine

WORKDIR /app

# Sin dependencias: el servidor usa solo modulos de Node
COPY server.js ./
COPY public/ ./public/

ENV NODE_ENV=production
ENV PORT=3000

# No conviene ejecutar como root
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=4s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
