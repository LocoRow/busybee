# Busy Bee — tienda, panel de gestion y aviso de pedidos por Telegram
FROM node:22-alpine

WORKDIR /app

# Sin dependencias: el servidor usa solo modulos de Node
COPY server.js datos.js admin.js semilla.json ./
COPY public/ ./public/

ENV NODE_ENV=production
ENV PORT=3000
# El catalogo y las fotos que sube Raquel viven aqui. TIENE que ser un volumen:
# sin el, cada despliegue borraria todo lo que haya metido.
ENV DATOS_DIR=/app/datos

# La carpeta se crea con el dueño correcto para que el usuario node pueda escribir
RUN mkdir -p /app/datos/fotos && chown -R node:node /app/datos

USER node

VOLUME ["/app/datos"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=4s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
