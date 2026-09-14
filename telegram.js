'use strict';
/* ==========================================================================
   Busy Bee — comandos de Telegram

   Para los cambios del día a día —agotar una vela, cambiar un precio— abrir el
   panel es más lento que escribir dos palabras en el chat que Raquel ya tiene
   abierto. Esto cubre eso; lo demás (fotos, descripciones) sigue en el panel.

   La autenticación sale gratis: sólo se atiende al chat de la vendedora. A
   cualquier otro se le ignora sin contestar, para no darle pistas a nadie.
   ========================================================================== */

const crypto = require('node:crypto');
const datos = require('./datos');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const SITIO = process.env.SITIO_URL || 'https://busybee.loco-space.com';

const ACTIVO = Boolean(TOKEN && CHAT_ID);

/* El secreto del webhook se deriva del propio token, así no hace falta otra
   variable de entorno que alguien tenga que acordarse de poner. */
const SECRETO = ACTIVO
  ? crypto.createHmac('sha256', TOKEN).update('webhook-busybee').digest('hex').slice(0, 40)
  : '';

function log(...a) {
  console.log(new Date().toISOString(), '[telegram]', ...a);
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* --------------------------------------------------------------------------
   Envío
   -------------------------------------------------------------------------- */
async function responder(chatId, texto) {
  const control = new AbortController();
  const corte = setTimeout(() => control.abort(), 10000);
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: texto,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }),
      signal: control.signal
    });
  } catch (e) {
    log('No se ha podido responder:', e.message);
  } finally {
    clearTimeout(corte);
  }
}

/* --------------------------------------------------------------------------
   Alta del webhook al arrancar
   -------------------------------------------------------------------------- */
async function registrarWebhook() {
  if (!ACTIVO) {
    log('sin token o sin chat: no se registra el webhook');
    return;
  }

  const destino = SITIO.replace(/\/$/, '') + '/api/telegram';

  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: destino,
        secret_token: SECRETO,
        allowed_updates: ['message'],
        drop_pending_updates: true
      })
    });
    const d = await r.json().catch(() => ({}));
    if (d.ok) log('webhook registrado en', destino);
    else log('el webhook no se ha podido registrar:', d.description || r.status);
  } catch (e) {
    // Que falle no debe tumbar la tienda: los pedidos siguen funcionando igual
    log('no se ha podido contactar con Telegram para el webhook:', e.message);
  }
}

/* --------------------------------------------------------------------------
   Búsqueda de un producto por identificador o por nombre
   -------------------------------------------------------------------------- */
function normalizar(t) {
  return String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function buscar(texto) {
  const aguja = normalizar(texto);
  if (!aguja) return { error: 'Dime cuál.' };

  const lista = datos.leer();

  const exacto = lista.find(p => normalizar(p.id) === aguja || normalizar(p.nombre) === aguja);
  if (exacto) return { producto: exacto };

  const parciales = lista.filter(p => normalizar(p.nombre).includes(aguja) || normalizar(p.id).includes(aguja));

  if (!parciales.length) return { error: 'No encuentro ninguna vela que se llame así.' };
  if (parciales.length > 1) {
    return {
      error: 'Hay varias que encajan: ' +
             parciales.map(p => '<b>' + esc(p.nombre) + '</b>').join(', ') +
             '. Dime cuál con más detalle.'
    };
  }
  return { producto: parciales[0] };
}

async function cambiar(id, cambios) {
  const lista = datos.leer().map(p => (p.id === id ? Object.assign({}, p, cambios) : p));
  await datos.guardar(lista);
}

/* --------------------------------------------------------------------------
   Comandos
   -------------------------------------------------------------------------- */
const AYUDA = [
  '🐝 <b>Qué puedo hacer</b>',
  '',
  '<b>/lista</b> — ver todas tus velas',
  '<b>/agotado</b> colmena — quitarla de la tienda',
  '<b>/disponible</b> colmena — volver a ponerla',
  '<b>/precio</b> colmena 15 — cambiar el precio',
  '',
  'Puedes escribir el nombre en vez del identificador.',
  '',
  'Para fotos, descripciones y velas nuevas, el panel:',
  SITIO + '/admin'
].join('\n');

async function ejecutar(texto) {
  const partes = String(texto).trim().split(/\s+/);
  const orden = partes[0].toLowerCase().replace(/@.*$/, '');
  const resto = partes.slice(1).join(' ');

  if (orden === '/start' || orden === '/ayuda' || orden === '/help') {
    return AYUDA;
  }

  if (orden === '/lista') {
    const lista = datos.leer();
    if (!lista.length) return 'No hay ninguna vela en el catálogo.';

    const filas = lista.map(p =>
      (p.disponible === false ? '🚫' : '✅') + ' <b>' + esc(p.nombre) + '</b> — ' +
      esc(p.precio) + ' € <i>(' + esc(p.id) + ')</i>'
    );

    const aLaVenta = lista.filter(p => p.disponible !== false).length;
    return ['🕯 <b>Tus velas</b>', '', ...filas, '',
            aLaVenta + ' de ' + lista.length + ' a la venta'].join('\n');
  }

  if (orden === '/agotado' || orden === '/disponible') {
    if (!resto) return 'Dime cuál. Por ejemplo: <code>' + orden + ' colmena</code>';

    const { producto, error } = buscar(resto);
    if (error) return error;

    const poner = orden === '/disponible';
    if ((producto.disponible !== false) === poner) {
      return '<b>' + esc(producto.nombre) + '</b> ya estaba ' +
             (poner ? 'a la venta.' : 'agotada.');
    }

    await cambiar(producto.id, { disponible: poner });
    return poner
      ? '✅ <b>' + esc(producto.nombre) + '</b> vuelve a estar a la venta.'
      : '🚫 <b>' + esc(producto.nombre) + '</b> ya no aparece en la tienda.';
  }

  if (orden === '/precio') {
    const trozos = resto.split(/\s+/);
    const importe = Number(String(trozos.pop() || '').replace(',', '.'));
    const cual = trozos.join(' ');

    if (!cual || !Number.isFinite(importe)) {
      return 'Escríbelo así: <code>/precio colmena 15</code>';
    }
    if (importe < 0 || importe > 10000) return 'Ese precio no me cuadra.';

    const { producto, error } = buscar(cual);
    if (error) return error;

    const antes = producto.precio;
    await cambiar(producto.id, { precio: Math.round(importe * 100) / 100 });

    return '💰 <b>' + esc(producto.nombre) + '</b>: ' +
           esc(antes) + ' € → <b>' + esc(Math.round(importe * 100) / 100) + ' €</b>';
  }

  if (orden.startsWith('/')) {
    return 'No conozco ese comando. Escribe <b>/ayuda</b> para ver los que hay.';
  }

  return null;   // no es un comando: no contestamos
}

/* --------------------------------------------------------------------------
   Entrada del webhook
   -------------------------------------------------------------------------- */
async function manejarActualizacion(req, actualizacion) {
  // Telegram firma cada petición con el secreto que le dimos al registrarnos
  if (req.headers['x-telegram-bot-api-secret-token'] !== SECRETO) {
    log('petición con secreto incorrecto, descartada');
    return { ok: false };
  }

  const mensaje = actualizacion && actualizacion.message;
  if (!mensaje || !mensaje.chat) return { ok: true };

  // Sólo la vendedora. A cualquier otro se le ignora en silencio.
  if (String(mensaje.chat.id) !== String(CHAT_ID)) {
    log('mensaje de un chat ajeno, ignorado');
    return { ok: true };
  }

  const texto = mensaje.text || '';
  if (!texto.trim()) return { ok: true };

  let respuesta;
  try {
    respuesta = await ejecutar(texto);
  } catch (e) {
    log('error ejecutando el comando:', e.message);
    respuesta = 'Se me ha atragantado. Prueba otra vez o usa el panel.';
  }

  if (respuesta) await responder(mensaje.chat.id, respuesta);
  return { ok: true };
}

module.exports = { ACTIVO, SECRETO, registrarWebhook, manejarActualizacion };
