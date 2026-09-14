'use strict';
/* ==========================================================================
   Busy Bee — zona de administración

   Autenticación con una cookie firmada. No hay base de sesiones: la cookie
   lleva su propia caducidad y una firma hecha con la contraseña, así que
   cambiar la contraseña invalida de golpe todas las sesiones abiertas y un
   reinicio del contenedor no echa a nadie fuera.

   Si ADMIN_PASSWORD no está definida, el panel queda desactivado por completo.
   Es la opción segura: más vale sin panel que con panel sin contraseña.
   ========================================================================== */

const crypto = require('node:crypto');
const fsp = require('node:fs/promises');
const path = require('node:path');

const CLAVE = process.env.ADMIN_PASSWORD || '';
const ACTIVO = CLAVE.length >= 8;

const DURACION = 7 * 24 * 60 * 60 * 1000;   // la sesión dura una semana
const COOKIE = 'bb_admin';

const MAX_FOTO = 3 * 1024 * 1024;           // 3 MB ya redimensionada

/* --------------------------------------------------------------------------
   Firma de la sesión
   -------------------------------------------------------------------------- */
function firmar(caduca) {
  return crypto.createHmac('sha256', CLAVE).update(String(caduca)).digest('hex');
}

function crearCookie() {
  const caduca = Date.now() + DURACION;
  return caduca + '.' + firmar(caduca);
}

/** Comparación en tiempo constante, para no filtrar nada por el tiempo de respuesta. */
function igual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

function cookieValida(valor) {
  if (!ACTIVO || !valor) return false;
  const trozos = String(valor).split('.');
  if (trozos.length !== 2) return false;

  const caduca = Number(trozos[0]);
  if (!Number.isFinite(caduca) || caduca < Date.now()) return false;

  return igual(trozos[1], firmar(caduca));
}

function leerCookies(req) {
  const crudo = req.headers.cookie || '';
  const salida = {};
  for (const trozo of crudo.split(';')) {
    const i = trozo.indexOf('=');
    if (i > 0) salida[trozo.slice(0, i).trim()] = trozo.slice(i + 1).trim();
  }
  return salida;
}

function autenticado(req) {
  return cookieValida(leerCookies(req)[COOKIE]);
}

/* --------------------------------------------------------------------------
   Freno a la fuerza bruta: 5 intentos fallidos cada 10 minutos por IP
   -------------------------------------------------------------------------- */
const VENTANA = 10 * 60 * 1000;
const MAX_INTENTOS = 5;
const intentos = new Map();

function bloqueado(ip) {
  const ahora = Date.now();
  const previos = (intentos.get(ip) || []).filter(t => ahora - t < VENTANA);
  intentos.set(ip, previos);
  return previos.length >= MAX_INTENTOS;
}

function apuntarFallo(ip) {
  const previos = intentos.get(ip) || [];
  previos.push(Date.now());
  intentos.set(ip, previos);
}

setInterval(() => {
  const ahora = Date.now();
  for (const [ip, marcas] of intentos) {
    const vivas = marcas.filter(t => ahora - t < VENTANA);
    if (vivas.length) intentos.set(ip, vivas);
    else intentos.delete(ip);
  }
}, VENTANA).unref();

/* --------------------------------------------------------------------------
   Guardado de fotos

   El navegador redimensiona la imagen antes de mandarla, así que aquí sólo
   llega un JPEG pequeño en base64. Eso evita tener que instalar una librería
   de imágenes en el servidor.
   -------------------------------------------------------------------------- */
async function guardarFoto(carpeta, nombreSugerido, dataUrl) {
  const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(String(dataUrl || ''));
  if (!m) return { error: 'El formato de la imagen no es válido.' };

  const binario = Buffer.from(m[2], 'base64');
  if (!binario.length) return { error: 'La imagen ha llegado vacía.' };
  if (binario.length > MAX_FOTO) return { error: 'La imagen pesa demasiado.' };

  // Comprobamos la cabecera real del fichero, no nos fiamos de lo que diga el nombre
  const esJpeg = binario[0] === 0xff && binario[1] === 0xd8;
  const esPng = binario.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const esWebp = binario.slice(0, 4).toString() === 'RIFF' && binario.slice(8, 12).toString() === 'WEBP';
  if (!esJpeg && !esPng && !esWebp) return { error: 'El fichero no es una imagen.' };

  const ext = esJpeg ? '.jpg' : (esPng ? '.png' : '.webp');
  const base = path.basename(String(nombreSugerido || 'foto'))
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'foto';

  // Marca de tiempo para no pisar una foto anterior ni servir una cacheada
  const nombre = base + '-' + Date.now().toString(36) + ext;
  const destino = path.join(carpeta, nombre);

  if (!destino.startsWith(carpeta)) return { error: 'Nombre de fichero no permitido.' };

  await fsp.writeFile(destino, binario);
  return { nombre };
}

/* --------------------------------------------------------------------------
   Cabeceras de la cookie
   -------------------------------------------------------------------------- */
function cabeceraSesion(valor, segura) {
  const partes = [
    COOKIE + '=' + valor,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=' + (valor ? Math.floor(DURACION / 1000) : 0)
  ];
  if (segura) partes.push('Secure');
  return partes.join('; ');
}

module.exports = {
  ACTIVO, COOKIE,
  autenticado, crearCookie, cabeceraSesion,
  bloqueado, apuntarFallo, igual,
  guardarFoto,
  comprobarClave: (dada) => ACTIVO && igual(
    crypto.createHash('sha256').update(String(dada)).digest('hex'),
    crypto.createHash('sha256').update(CLAVE).digest('hex')
  )
};
