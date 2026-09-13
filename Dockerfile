# Busy Bee — sitio estatico servido por nginx
FROM nginx:1.27-alpine

# Configuracion propia: compresion, cacheado y cabeceras
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Contenido
COPY index.html /usr/share/nginx/html/index.html
COPY assets/ /usr/share/nginx/html/assets/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
