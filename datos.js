'use strict';
/* ==========================================================================
   Busy Bee — catálogo

   El catálogo dejó de vivir en el código: ahora es un JSON en una carpeta
   persistente, para que Raquel pueda cambiarlo sin tocar nada ni redesplegar.

   Esa carpeta va montada como volumen de Docker. Sin volumen, todo lo que se
   escriba aquí desaparece en el siguiente despliegue, así que la ruta la marca
   DATOS_DIR y en producción DEBE apuntar al volumen.
   ========================================================================== */

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const DATOS = process.env.DATOS_DIR || path.join(__dirname, 'datos');
const FOTOS = path.join(DATOS, 'fotos');
const FICHERO = path.join(DATOS, 'productos.json');

const SEMILLA = path.join(__dirname, 'semilla.json');
const FOTOS_SEMILLA = path.join(__dirname, 'public', 'assets', 'img');

const CAMPOS_TEXTO = {
  nombre: 60,
  descripcion: 400,
  unidad: 24,
  foto: 120,
  alt: 200,
  insignia: 24
};

/* --------------------------------------------------------------------------
   Arranque: si la carpeta está vacía, se siembra con el catálogo de ejemplo
   -------------------------------------------------------------------------- */
function arrancar() {
  fs.mkdirSync(FOTOS, { recursive: true });

  if (!fs.existsSync(FICHERO)) {
    fs.copyFileSync(SEMILLA, FICHERO);
    console.log('Catálogo sembrado en', FICHERO);

    // Las fotos de ejemplo se copian al volumen para que todo viva en un sitio
    try {
      for (const p of JSON.parse(fs.readFileSync(SEMILLA, 'utf8')).productos) {
        const origen = path.join(FOTOS_SEMILLA, p.foto);
        const destino = path.join(FOTOS, p.foto);
        if (fs.existsSync(origen) && !fs.existsSync(destino)) {
          fs.copyFileSync(origen, destino);
        }
      }
    } catch (e) {
      console.log('No se han podido copiar las fotos de ejemplo:', e.message);
    }
  }
}

/* --------------------------------------------------------------------------
   Lectura con caché: se relee sólo si el fichero ha cambiado
   -------------------------------------------------------------------------- */
let cache = null;
let cacheMtime = 0;

function leer() {
  try {
    const mtime = fs.statSync(FICHERO).mtimeMs;
    if (cache && mtime === cacheMtime) return cache;

    const datos = JSON.parse(fs.readFileSync(FICHERO, 'utf8'));
    const lista = Array.isArray(datos.productos) ? datos.productos : [];

    lista.sort((a, b) => (a.orden || 0) - (b.orden || 0));
    cache = lista;
    cacheMtime = mtime;
    return cache;
  } catch (e) {
    console.log('No se ha podido leer el catálogo:', e.message);
    return cache || [];
  }
}

/** Sólo lo que se enseña en la tienda. */
function visibles() {
  return leer().filter(p => p.disponible !== false);
}

/** Mapa id -> producto, que es lo que usa el servidor para poner el precio. */
function porId() {
  const m = Object.create(null);
  for (const p of leer()) m[p.id] = p;
  return m;
}

/* --------------------------------------------------------------------------
   Escritura
   Se escribe primero en un temporal y luego se renombra, para que un corte a
   media escritura no deje el catálogo a medias.
   -------------------------------------------------------------------------- */
async function guardar(lista) {
  lista.sort((a, b) => (a.orden || 0) - (b.orden || 0));

  // Copia de la versión anterior: el panel guarda la lista entera, así que un
  // error dejaría el catálogo destruido sin forma de recuperarlo.
  try {
    if (fs.existsSync(FICHERO)) await fsp.copyFile(FICHERO, FICHERO + '.bak');
  } catch (e) {
    console.log('No se ha podido hacer la copia de seguridad:', e.message);
  }

  const temporal = FICHERO + '.tmp';
  await fsp.writeFile(temporal, JSON.stringify({ productos: lista }, null, 2), 'utf8');
  await fsp.rename(temporal, FICHERO);
  cache = null;
  return lista;
}

/** Limpia y valida lo que llega del panel. Devuelve {producto} o {error}. */
function normalizar(entrada, existentes) {
  const limpio = (v, max) =>
    typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';

  const p = {};

  for (const [campo, max] of Object.entries(CAMPOS_TEXTO)) {
    p[campo] = limpio(entrada[campo], max);
  }

  p.id = limpio(entrada.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!p.id) return { error: 'El identificador no puede quedar vacío.' };
  if (p.nombre.length < 2) return { error: 'Hace falta un nombre.' };
  if (!p.foto) return { error: 'Hace falta una foto.' };

  // No puede haber dos productos con el mismo identificador. Como la lista se
  // valida de principio a fin, 'existentes' solo contiene los ya procesados y
  // un producto nunca se compara consigo mismo.
  if (existentes.some(x => x.id === p.id)) {
    return { error: 'Hay dos productos con el identificador «' + p.id + '». Tienen que ser distintos.' };
  }

  const precio = Number(entrada.precio);
  if (!Number.isFinite(precio) || precio < 0 || precio > 10000) {
    return { error: 'El precio no es válido.' };
  }
  p.precio = Math.round(precio * 100) / 100;

  p.ficha = (Array.isArray(entrada.ficha) ? entrada.ficha : [])
    .map(t => limpio(t, 30))
    .filter(Boolean)
    .slice(0, 4);

  p.insigniaColor = entrada.insigniaColor === 'verde' ? 'verde' : 'miel';
  p.disponible = entrada.disponible !== false;

  const orden = Number(entrada.orden);
  p.orden = Number.isFinite(orden) ? orden : (existentes.length + 1);

  if (!p.unidad) p.unidad = 'unidad';
  if (!p.alt) p.alt = p.nombre;

  return { producto: p };
}

module.exports = {
  DATOS, FOTOS, FICHERO,
  arrancar, leer, visibles, porId, guardar, normalizar
};
