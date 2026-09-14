'use strict';
/* ==========================================================================
   Busy Bee — servidor mínimo
   Sirve la página estática y recibe los pedidos, que reenvía por Telegram.
   Sin dependencias: sólo módulos de Node.
   ========================================================================== */

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const datos = require('./datos');
const admin = require('./admin');
const telegram = require('./telegram');

const PUERTO = Number(process.env.PORT) || 3000;
const RAIZ = path.join(__dirname, 'public');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

/* --------------------------------------------------------------------------
   Catálogo

   Los precios los sigue poniendo el servidor y NO el navegador, para que nadie
   pueda encargar una Colmena por un céntimo manipulando el JavaScript. Lo que
   cambia es de dónde salen: antes estaban escritos aquí, ahora vienen del JSON
   que Raquel edita desde el panel.
   -------------------------------------------------------------------------- */

/* --------------------------------------------------------------------------
   Versión de los estáticos.

   Cloudflare cachea el css y el js en el borde, así que tras un despliegue
   quien ya hubiera entrado seguía recibiendo los ficheros viejos y la tienda
   le aparecía rota. En vez de purgar la caché a mano cada vez, se les cuelga
   una versión sacada de la fecha del fichero: al cambiar el fichero cambia la
   URL, y una URL nueva nunca está cacheada.
   -------------------------------------------------------------------------- */
function versionDe(relativa) {
  try {
    return fs.statSync(path.join(RAIZ, relativa)).mtimeMs.toString(36);
  } catch {
    return '0';
  }
}

const V_CSS    = versionDe('assets/css/style.css');
const V_JS     = versionDe('assets/js/main.js');
const V_FUENTE = versionDe('assets/css/fuentes.css');
const V_PANEL  = versionDe('assets/css/panel.css');
const V_PANELJS= versionDe('assets/js/panel.js');

/* --------------------------------------------------------------------------
   Pintado del catálogo

   Las tarjetas se generan en el servidor y no en el navegador, para que quien
   entre sin JavaScript —o un buscador— vea los productos igual.
   -------------------------------------------------------------------------- */
function escHtml(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tarjeta(p, indice) {
  const ficha = (p.ficha || []).map(t => '<span>' + escHtml(t) + '</span>').join('');
  const insignia = p.insignia
    ? '<span class="producto__insignia' +
      (p.insigniaColor === 'verde' ? ' producto__insignia--verde' : '') + '">' +
      escHtml(p.insignia) + '</span>'
    : '';

  return [
    '<article class="producto revelar" data-retardo="' + ((indice % 3) + 1) + '">',
      '<div class="producto__foto">',
        insignia,
        '<img src="/fotos/' + escHtml(p.foto) + '" alt="' + escHtml(p.alt) + '"',
          ' loading="lazy" width="540" height="675">',
      '</div>',
      '<div class="producto__cuerpo">',
        '<h3 class="producto__nombre">' + escHtml(p.nombre) + '</h3>',
        '<p class="producto__detalle">' + escHtml(p.descripcion) + '</p>',
        '<div class="producto__ficha">' + ficha + '</div>',
        '<div class="producto__pie">',
          '<p class="producto__precio">' + escHtml(p.precio) + '&nbsp;€',
            '<small>' + escHtml(p.unidad || 'unidad') + '</small></p>',
          '<button class="btn-anadir"',
            ' data-id="' + escHtml(p.id) + '"',
            ' data-ficha="' + escHtml((p.ficha || []).join(' · ')) + '"',
            ' data-foto="/fotos/' + escHtml(p.foto) + '"',
            ' data-nombre="' + escHtml(p.nombre) + '"',
            ' data-precio="' + escHtml(p.precio) + '">',
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"',
            ' aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
            ' Añadir',
          '</button>',
        '</div>',
      '</div>',
    '</article>'
  ].join('');
}

function pintarCatalogo() {
  const lista = datos.visibles();
  if (!lista.length) {
    return '<p class="entradilla" style="grid-column:1/-1;text-align:center">' +
           'Ahora mismo no hay velas disponibles. Vuelve pronto o escríbeme por Instagram.' +
           '</p>';
  }
  return lista.map(tarjeta).join('\n');
}

/** Cuelga la versión de las referencias al css y al js dentro del HTML. */
function versionar(html) {
  return html
    .replace('<!--PRODUCTOS-->', pintarCatalogo)
    .replace('assets/css/fuentes.css"', 'assets/css/fuentes.css?v=' + V_FUENTE + '"')
    .replace('assets/css/style.css"', 'assets/css/style.css?v=' + V_CSS + '"')
    .replace('assets/js/main.js"', 'assets/js/main.js?v=' + V_JS + '"')
    .replace('assets/css/panel.css"', 'assets/css/panel.css?v=' + V_PANEL + '"')
    .replace('assets/js/panel.js"', 'assets/js/panel.js?v=' + V_PANELJS + '"');
}

const MAX_UNIDADES = 20;   // por línea
const MAX_LINEAS = 12;

/* --------------------------------------------------------------------------
   Utilidades
   -------------------------------------------------------------------------- */

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function log(...a) {
  console.log(new Date().toISOString(), ...a);
}

function json(res, codigo, cuerpo) {
  const txt = JSON.stringify(cuerpo);
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(txt),
    'Cache-Control': 'no-store'
  });
  res.end(txt);
}

/** Escapa lo que va dentro de un mensaje HTML de Telegram. */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Recorta y normaliza un texto de formulario. */
function limpiar(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

/** Referencia corta y legible para que cliente y vendedora hablen del mismo pedido. */
function referencia() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = '';
  for (let i = 0; i < 5; i++) r += letras[Math.floor(Math.random() * letras.length)];
  return 'BB-' + r;
}

function ipDe(req) {
  const ff = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'];
  if (ff) return String(ff).split(',')[0].trim();
  return req.socket.remoteAddress || 'desconocida';
}

/* --------------------------------------------------------------------------
   Límite de envíos por IP: 5 cada 15 minutos.
   La página es pública, así que sin esto cualquiera podría llenar de avisos
   el móvil de la vendedora.
   -------------------------------------------------------------------------- */
const VENTANA = 15 * 60 * 1000;
const MAX_ENVIOS = 5;
const historial = new Map();

function demasiados(ip) {
  const ahora = Date.now();
  const previos = (historial.get(ip) || []).filter(t => ahora - t < VENTANA);
  if (previos.length >= MAX_ENVIOS) {
    historial.set(ip, previos);
    return true;
  }
  previos.push(ahora);
  historial.set(ip, previos);
  return false;
}

// Limpieza periódica, para que el mapa no crezca sin fin.
setInterval(() => {
  const ahora = Date.now();
  for (const [ip, marcas] of historial) {
    const vivas = marcas.filter(t => ahora - t < VENTANA);
    if (vivas.length) historial.set(ip, vivas);
    else historial.delete(ip);
  }
}, VENTANA).unref();

/* --------------------------------------------------------------------------
   Telegram
   -------------------------------------------------------------------------- */
async function avisarPorTelegram(texto) {
  if (!TOKEN || !CHAT_ID) {
    log('AVISO: falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID; el pedido no se ha enviado a Telegram.');
    return { ok: false, motivo: 'sin-configurar' };
  }

  const control = new AbortController();
  const corte = setTimeout(() => control.abort(), 10000);

  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: texto,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }),
      signal: control.signal
    });

    const datos = await r.json().catch(() => ({}));
    if (!r.ok || !datos.ok) {
      log('Telegram ha respondido con error:', r.status, datos.description || '');
      return { ok: false, motivo: datos.description || ('http ' + r.status) };
    }
    return { ok: true };
  } catch (e) {
    log('No se ha podido contactar con Telegram:', e.message);
    return { ok: false, motivo: e.message };
  } finally {
    clearTimeout(corte);
  }
}

/* --------------------------------------------------------------------------
   Validación y montaje del pedido
   -------------------------------------------------------------------------- */
function validar(cuerpo) {
  const errores = [];

  const c = cuerpo && typeof cuerpo === 'object' ? cuerpo : {};
  const cli = c.cliente && typeof c.cliente === 'object' ? c.cliente : {};

  const cliente = {
    nombre:    limpiar(cli.nombre, 80),
    telefono:  limpiar(cli.telefono, 25),
    email:     limpiar(cli.email, 120),
    direccion: limpiar(cli.direccion, 160),
    cp:        limpiar(cli.cp, 10),
    poblacion: limpiar(cli.poblacion, 80),
    notas:     limpiar(cli.notas, 500)
  };

  if (cliente.nombre.length < 2) errores.push('Hace falta un nombre.');
  if (!/^[+\d][\d\s().-]{5,24}$/.test(cliente.telefono)) errores.push('El teléfono no parece válido.');
  if (cliente.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cliente.email)) errores.push('El correo no parece válido.');
  if (cliente.direccion.length < 5) errores.push('Hace falta una dirección.');
  if (!/^\d{4,10}$/.test(cliente.cp)) errores.push('El código postal no parece válido.');
  if (cliente.poblacion.length < 2) errores.push('Hace falta una población.');

  // La aceptacion se comprueba tambien aqui: el navegador se puede manipular,
  // y hay que poder demostrar que se acepto en el momento del pedido.
  if (c.acepto !== true) errores.push('Hay que aceptar la política de privacidad y las condiciones.');

  // Líneas del pedido: el navegador manda id y cantidad; el precio lo ponemos aquí.
  const CATALOGO = datos.porId();
  const entrada = Array.isArray(c.items) ? c.items.slice(0, MAX_LINEAS) : [];
  const lineas = [];

  for (const it of entrada) {
    const id = limpiar(it && it.id, 40);
    const producto = CATALOGO[id];
    if (!producto || producto.disponible === false) continue;

    let cantidad = Number(it.cantidad);
    if (!Number.isInteger(cantidad) || cantidad < 1) cantidad = 1;
    if (cantidad > MAX_UNIDADES) cantidad = MAX_UNIDADES;

    const ya = lineas.find(l => l.id === id);
    if (ya) ya.cantidad = Math.min(ya.cantidad + cantidad, MAX_UNIDADES);
    else lineas.push({ id, nombre: producto.nombre, precio: producto.precio, cantidad });
  }

  if (!lineas.length) errores.push('La cesta está vacía.');

  const total = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
  return { errores, cliente, lineas, total };
}

function mensajeDePedido(ref, cliente, lineas, total) {
  const articulos = lineas
    .map(l => `• ${esc(l.nombre)} × ${l.cantidad} — ${l.precio * l.cantidad} €`)
    .join('\n');

  const partes = [
    `🕯 <b>Pedido nuevo ${esc(ref)}</b>`,
    '',
    articulos,
    '',
    `<b>Total: ${total} €</b> <i>(sin envío)</i>`,
    '',
    '👤 <b>Cliente</b>',
    `${esc(cliente.nombre)}`,
    `📞 ${esc(cliente.telefono)}`
  ];

  if (cliente.email) partes.push(`✉️ ${esc(cliente.email)}`);

  partes.push(
    '',
    '📦 <b>Envío</b>',
    `${esc(cliente.direccion)}`,
    `${esc(cliente.cp)} ${esc(cliente.poblacion)}`
  );

  if (cliente.notas) partes.push('', '📝 <b>Notas</b>', esc(cliente.notas));

  partes.push('', `<i>${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</i>`);

  return partes.join('\n');
}

/* --------------------------------------------------------------------------
   Lectura del cuerpo de la petición
   -------------------------------------------------------------------------- */
function leerCuerpo(req, limite = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const trozos = [];
    req.on('data', t => {
      total += t.length;
      if (total > limite) {
        reject(new Error('cuerpo demasiado grande'));
        req.destroy();
        return;
      }
      trozos.push(t);
    });
    req.on('end', () => resolve(Buffer.concat(trozos).toString('utf8')));
    req.on('error', reject);
  });
}

/* --------------------------------------------------------------------------
   Rutas
   -------------------------------------------------------------------------- */
async function manejarPedido(req, res) {
  const ip = ipDe(req);

  let cuerpo;
  try {
    cuerpo = JSON.parse(await leerCuerpo(req));
  } catch {
    return json(res, 400, { ok: false, error: 'No hemos entendido la petición.' });
  }

  // Campo trampa: los formularios los rellenan los robots, las personas no lo ven.
  if (limpiar(cuerpo && cuerpo.web, 100)) {
    log('Descartado por el campo trampa, ip', ip);
    return json(res, 200, { ok: true, ref: referencia() });
  }

  if (demasiados(ip)) {
    return json(res, 429, {
      ok: false,
      error: 'Has enviado varias solicitudes seguidas. Espera unos minutos o escribe por Instagram.'
    });
  }

  const { errores, cliente, lineas, total } = validar(cuerpo);
  if (errores.length) return json(res, 400, { ok: false, error: errores[0], errores });

  const ref = referencia();
  const envio = await avisarPorTelegram(mensajeDePedido(ref, cliente, lineas, total));

  // Minimizacion de datos: en marcha normal el registro solo guarda el importe
  // y que el aviso salio. Los datos personales solo se vuelcan si Telegram ha
  // fallado, que es el unico caso en que hacen falta para rescatar el pedido.
  if (envio.ok) {
    log('PEDIDO', ref, JSON.stringify({ lineas: lineas.length, total, telegram: true }));
  } else {
    log('PEDIDO-SIN-AVISO', ref, JSON.stringify({ cliente, lineas, total, motivo: envio.motivo }));
  }

  if (!envio.ok) {
    // Devolvemos 200 a proposito: Cloudflare intercepta los 5xx del origen y
    // sustituye el JSON por su propia pagina de error, asi que el navegador
    // nunca llegaria a leer este mensaje.
    return json(res, 200, {
      ok: false,
      ref,
      error: 'No hemos podido avisar a la vendedora. Escríbele por Instagram y dile la referencia ' + ref + '.'
    });
  }

  return json(res, 200, { ok: true, ref, total });
}

/* --------------------------------------------------------------------------
   Zona de administración
   -------------------------------------------------------------------------- */
function esHttps(req) {
  return (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

function exigirSesion(req, res) {
  if (!admin.ACTIVO) {
    json(res, 503, { ok: false, error: 'El panel no está configurado: falta ADMIN_PASSWORD.' });
    return false;
  }
  if (!admin.autenticado(req)) {
    json(res, 401, { ok: false, error: 'Sesión caducada. Vuelve a entrar.' });
    return false;
  }
  return true;
}

async function manejarAdmin(req, res, ruta, url) {

  /* --- entrar --- */
  if (ruta === '/api/admin/entrar' && req.method === 'POST') {
    if (!admin.ACTIVO) {
      return json(res, 503, { ok: false, error: 'El panel no está configurado: falta ADMIN_PASSWORD.' });
    }

    const ip = ipDe(req);
    if (admin.bloqueado(ip)) {
      return json(res, 429, { ok: false, error: 'Demasiados intentos. Espera diez minutos.' });
    }

    let cuerpo;
    try { cuerpo = JSON.parse(await leerCuerpo(req)); }
    catch { return json(res, 400, { ok: false, error: 'Petición no válida.' }); }

    if (!admin.comprobarClave(cuerpo && cuerpo.clave)) {
      admin.apuntarFallo(ip);
      log('Intento de acceso fallido al panel desde', ip);
      return json(res, 401, { ok: false, error: 'Contraseña incorrecta.' });
    }

    res.setHeader('Set-Cookie', admin.cabeceraSesion(admin.crearCookie(), esHttps(req)));
    log('Acceso al panel desde', ip);
    return json(res, 200, { ok: true });
  }

  /* --- salir --- */
  if (ruta === '/api/admin/salir' && req.method === 'POST') {
    res.setHeader('Set-Cookie', admin.cabeceraSesion('', esHttps(req)));
    return json(res, 200, { ok: true });
  }

  /* --- saber si la sesión sigue viva --- */
  if (ruta === '/api/admin/sesion' && req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      configurado: admin.ACTIVO,
      dentro: admin.ACTIVO && admin.autenticado(req)
    });
  }

  /* --- leer el catálogo completo, ocultos incluidos --- */
  if (ruta === '/api/admin/productos' && req.method === 'GET') {
    if (!exigirSesion(req, res)) return;
    return json(res, 200, { ok: true, productos: datos.leer() });
  }

  /* --- guardar el catálogo entero --- */
  if (ruta === '/api/admin/productos' && req.method === 'PUT') {
    if (!exigirSesion(req, res)) return;

    let cuerpo;
    try { cuerpo = JSON.parse(await leerCuerpo(req, 512 * 1024)); }
    catch { return json(res, 400, { ok: false, error: 'Petición no válida.' }); }

    const entrada = Array.isArray(cuerpo && cuerpo.productos) ? cuerpo.productos : null;
    if (!entrada) return json(res, 400, { ok: false, error: 'Faltan los productos.' });
    if (entrada.length > 60) return json(res, 400, { ok: false, error: 'Demasiados productos.' });

    // Se valida uno a uno; si alguno falla no se guarda nada
    const limpios = [];
    for (const bruto of entrada) {
      const { producto, error } = datos.normalizar(bruto, limpios);
      if (error) return json(res, 400, { ok: false, error });
      limpios.push(producto);
    }

    await datos.guardar(limpios);
    log('Catálogo actualizado:', limpios.length, 'productos');
    return json(res, 200, { ok: true, productos: datos.leer() });
  }

  /* --- subir una foto --- */
  if (ruta === '/api/admin/foto' && req.method === 'POST') {
    if (!exigirSesion(req, res)) return;

    let cuerpo;
    try { cuerpo = JSON.parse(await leerCuerpo(req, 6 * 1024 * 1024)); }
    catch { return json(res, 400, { ok: false, error: 'La imagen no ha llegado entera.' }); }

    const { nombre, error } = await admin.guardarFoto(datos.FOTOS, cuerpo.nombre, cuerpo.datos);
    if (error) return json(res, 400, { ok: false, error });

    log('Foto subida:', nombre);
    return json(res, 200, { ok: true, foto: nombre });
  }

  return json(res, 404, { ok: false, error: 'No encontrado' });
}

/* --------------------------------------------------------------------------
   Fotos de producto
   Se sirven desde el volumen. El nombre se sanea para que nadie pueda pedir
   ../../algo y salirse de la carpeta.
   -------------------------------------------------------------------------- */
async function servirFoto(req, res, nombre) {
  const limpio = path.basename(decodeURIComponent(nombre));
  const destino = path.join(datos.FOTOS, limpio);

  if (!destino.startsWith(datos.FOTOS)) {
    return json(res, 403, { ok: false, error: 'Prohibido' });
  }

  try {
    const info = await fsp.stat(destino);
    const ext = path.extname(limpio).toLowerCase();
    const etiqueta = '"' + info.size.toString(16) + '-' + info.mtimeMs.toString(16) + '"';

    if (req.headers['if-none-match'] === etiqueta) {
      res.writeHead(304, { 'ETag': etiqueta });
      return res.end();
    }

    res.writeHead(200, {
      'Content-Type': TIPOS[ext] || 'application/octet-stream',
      'Content-Length': info.size,
      // Corta: si Raquel cambia la foto de un producto tiene que verse pronto
      'Cache-Control': 'public, max-age=300',
      'ETag': etiqueta,
      'X-Content-Type-Options': 'nosniff'
    });

    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(destino).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Foto no encontrada');
  }
}

/* --------------------------------------------------------------------------
   Ficheros estáticos
   -------------------------------------------------------------------------- */
async function servirEstatico(req, res, ruta, versionPedida) {
  // Normalizamos y comprobamos que no se sale de public/
  const limpia = path.normalize(decodeURIComponent(ruta)).replace(/^(\.\.[/\\])+/, '');
  let destino = path.join(RAIZ, limpia);

  if (!destino.startsWith(RAIZ)) {
    return json(res, 403, { ok: false, error: 'Prohibido' });
  }

  try {
    let info = null;
    try {
      info = await fsp.stat(destino);
    } catch {
      // URLs limpias: /aviso-legal sirve aviso-legal.html
      if (!path.extname(destino)) {
        destino += '.html';
        info = await fsp.stat(destino);
      } else {
        throw new Error('no existe');
      }
    }

    if (info.isDirectory()) {
      destino = path.join(destino, 'index.html');
      info = await fsp.stat(destino);
    }

    const ext = path.extname(destino).toLowerCase();
    const esHtml = ext === '.html';

    // El HTML nunca se cachea: es quien reparte las URLs versionadas del resto.
    // Lo que llega con ?v= puede cachearse para siempre, porque al cambiar el
    // fichero cambia la URL. Sin ?v= se revalida, por si alguien lo pide a pelo.
    const cacheado = esHtml
      ? 'no-cache'
      : (versionPedida ? 'public, max-age=31536000, immutable' : 'no-cache');

    const marca = info.mtime.toUTCString();
    const etiqueta = '"' + info.size.toString(16) + '-' + info.mtimeMs.toString(16) + '"';

    const comunes = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };

    // Si el navegador ya tiene esta misma version, no hace falta reenviarla.
    if (!esHtml && (req.headers['if-none-match'] === etiqueta ||
                    req.headers['if-modified-since'] === marca)) {
      res.writeHead(304, { 'ETag': etiqueta, 'Cache-Control': cacheado });
      return res.end();
    }

    if (esHtml) {
      const html = versionar(await fsp.readFile(destino, 'utf8'));
      res.writeHead(200, Object.assign({
        'Content-Type': TIPOS['.html'],
        'Content-Length': Buffer.byteLength(html),
        'Cache-Control': cacheado
      }, comunes));
      return req.method === 'HEAD' ? res.end() : res.end(html);
    }

    res.writeHead(200, Object.assign({
      'Content-Type': TIPOS[ext] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': cacheado,
      'Last-Modified': marca,
      'ETag': etiqueta
    }, comunes));

    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(destino).pipe(res);
  } catch {
    // Cualquier ruta desconocida devuelve la portada.
    try {
      const portada = versionar(await fsp.readFile(path.join(RAIZ, 'index.html'), 'utf8'));
      res.writeHead(404, { 'Content-Type': TIPOS['.html'], 'Cache-Control': 'no-cache' });
      res.end(portada);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('No encontrado');
    }
  }
}

/* --------------------------------------------------------------------------
   Servidor
   -------------------------------------------------------------------------- */
const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const ruta = url.pathname;

  try {
    if (ruta === '/api/salud') {
      return json(res, 200, {
        ok: true,
        telegram: Boolean(TOKEN && CHAT_ID)
      });
    }

    if (ruta === '/api/telegram') {
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Método no permitido' });
      let cuerpo;
      try { cuerpo = JSON.parse(await leerCuerpo(req, 64 * 1024)); }
      catch { return json(res, 200, { ok: true }); }
      // A Telegram se le contesta 200 siempre: un error aquí haría que
      // reintentase el mismo mensaje una y otra vez.
      await telegram.manejarActualizacion(req, cuerpo);
      return json(res, 200, { ok: true });
    }

    if (ruta.startsWith('/api/admin/')) {
      return await manejarAdmin(req, res, ruta, url);
    }

    if (ruta === '/api/pedido') {
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Método no permitido' });
      return await manejarPedido(req, res);
    }

    // Las fotos de producto viven en el volumen, no en la imagen del contenedor
    if (ruta.startsWith('/fotos/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return json(res, 405, { ok: false, error: 'Método no permitido' });
      }
      return await servirFoto(req, res, ruta.slice('/fotos/'.length));
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return json(res, 405, { ok: false, error: 'Método no permitido' });
    }

    return await servirEstatico(req, res, ruta, url.searchParams.has('v'));
  } catch (e) {
    log('Error inesperado:', e && e.stack ? e.stack : e);
    if (!res.headersSent) json(res, 500, { ok: false, error: 'Error del servidor' });
    else res.end();
  }
});

datos.arrancar();

servidor.listen(PUERTO, () => {
  telegram.registrarWebhook();
  log(`Busy Bee escuchando en el puerto ${PUERTO}`);
  log(`Telegram: ${TOKEN && CHAT_ID ? 'configurado' : 'SIN CONFIGURAR (los pedidos sólo quedarán en el registro)'}`);
});

for (const senal of ['SIGTERM', 'SIGINT']) {
  process.on(senal, () => {
    log('Cerrando...');
    servidor.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
