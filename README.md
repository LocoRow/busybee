# Busy Bee · Arts and Crafts

Sitio de muestra para la venta de velas artesanales de cera de abeja de
[@busybee.gardenandcrafts](https://www.instagram.com/busybee.gardenandcrafts/) (Valencia).

HTML, CSS y JavaScript sin dependencias ni paso de compilación, con un servidor
Node mínimo (sólo módulos de serie) que recibe los pedidos y se los manda a la
vendedora por Telegram.

## Contenido

```
server.js                    sirve public/, el catálogo y las rutas del panel
datos.js                     lectura y escritura del catálogo
admin.js                     sesión del panel y guardado de fotos
semilla.json                 catálogo inicial, sólo se usa la primera vez
public/index.html            una sola página con todas las secciones
public/admin.html            panel de gestión del catálogo
public/aviso-legal.html      datos identificativos (LSSI-CE art. 10)
public/privacidad.html       tratamiento de datos (RGPD / LOPDGDD)
public/condiciones.html      condiciones de venta y desistimiento
public/assets/fonts/         tipografías alojadas aquí, no en Google
public/assets/css/style.css  estilos, paleta y animaciones
public/assets/js/main.js     animaciones y la cesta (pantalla completa de pedido)
public/assets/img/           fotografías del perfil de Instagram
Dockerfile                   imagen de Node con el sitio dentro
```

## Variables de entorno

Se ponen en Coolify, **nunca en el repositorio**:

| Variable | Para qué |
|---|---|
| `TELEGRAM_BOT_TOKEN` | el token que da @BotFather |
| `TELEGRAM_CHAT_ID` | el identificador numérico de la vendedora |
| `ADMIN_PASSWORD` | contraseña del panel, mínimo 8 caracteres. Sin ella el panel queda desactivado |
| `DATOS_DIR` | carpeta del catálogo y las fotos. **Tiene que ser un volumen** |
| `PORT` | opcional, por defecto 3000 |

Sin ellas la página funciona, pero los pedidos sólo quedan en el registro del
contenedor y al cliente se le pide que escriba por Instagram.

## El catálogo

Ya no está en el código: vive en `productos.json`, dentro de `DATOS_DIR`, junto a
las fotos. Raquel lo edita desde `/admin`.

> ⚠️ **`DATOS_DIR` tiene que apuntar a un volumen de Docker.** Si no, cada
> despliegue borra el catálogo y las fotos que haya subido, y se vuelve a
> sembrar desde `semilla.json`.

En cada guardado se deja una copia de la versión anterior en
`productos.json.bak`.

Los precios los sigue poniendo el servidor a partir de ese fichero, nunca el
navegador.

## La API

| Ruta | Qué hace |
|---|---|
| `POST /api/pedido` | recibe la cesta y los datos, avisa por Telegram, devuelve una referencia |
| `GET /api/salud` | sonda para el healthcheck |

El navegador manda sólo identificadores y cantidades: **los precios los pone
`server.js`**, para que nadie pueda encargar nada a un precio manipulado. Si
cambias un precio hay que tocarlo en `server.js` y en `public/index.html`.

Hay límite de 5 envíos cada 15 minutos por IP y un campo trampa contra robots.

## Paleta

Tomada del logotipo del perfil:

| | |
|---|---|
| Verde oliva | `#4e6650` |
| Dorado miel | `#db9a00` |
| Cera        | `#fdfaf3` |

## En local

```bash
node server.js
```

## Despliegue

Aplicación de Coolify en el Raspberry Pi (`LocoServer`), build pack *Dockerfile*,
puerto interno **3000**, dominio `http://busybee.loco-space.com`.

El tráfico entra por el túnel de Cloudflare, que ya tiene una regla comodín
`*.loco-space.com → localhost:80`, así que Traefik enruta por cabecera `Host`
sin necesidad de añadir una ruta nueva.

## Pendiente antes de vender

Las tres páginas legales están escritas pero llevan datos de relleno marcados
en amarillo, que hay que sustituir por los reales:

- Nombre y apellidos de la titular
- NIF
- Dirección completa
- Correo de contacto
- Si los precios incluyen IVA, medios de pago, ámbito y plazo de envío

Conviene además que una gestoría revise los textos.

## Aviso

Página de demostración. Los precios y las fichas de producto son inventados;
las fotografías pertenecen al perfil de Instagram de Busy Bee.
