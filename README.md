# Busy Bee · Arts and Crafts

Sitio de muestra para la venta de velas artesanales de cera de abeja de
[@busybee.gardenandcrafts](https://www.instagram.com/busybee.gardenandcrafts/) (Valencia).

HTML, CSS y JavaScript sin dependencias ni paso de compilación. Se sirve con nginx
dentro de un contenedor.

## Contenido

```
index.html            una sola página con todas las secciones
assets/css/style.css  estilos, paleta y animaciones
assets/js/main.js     abejas, polen, revelado al hacer scroll y cesta de demostración
assets/img/           fotografías del perfil de Instagram
Dockerfile            imagen de nginx con el sitio dentro
nginx.conf            compresión, cacheado y cabeceras
```

## Paleta

Tomada del logotipo del perfil:

| | |
|---|---|
| Verde oliva | `#4e6650` |
| Dorado miel | `#db9a00` |
| Cera        | `#fdfaf3` |

## En local

```bash
python -m http.server 8777
```

## Despliegue

Aplicación de Coolify en el Raspberry Pi (`LocoServer`), build pack *Dockerfile*,
puerto interno **80**, dominio `http://busybee.loco-space.com`.

El tráfico entra por el túnel de Cloudflare, que ya tiene una regla comodín
`*.loco-space.com → localhost:80`, así que Traefik enruta por cabecera `Host`
sin necesidad de añadir una ruta nueva.

## Aviso

Página de demostración. Los precios y las fichas de producto son inventados;
las fotografías pertenecen al perfil de Instagram de Busy Bee.
