/* ==========================================================================
   Busy Bee — panel de administración

   Las fotos se encogen aquí, en el navegador, antes de subirlas. Así una foto
   de cuatro megas del móvil llega al servidor como un JPEG de cien kilos y no
   hace falta instalar ninguna librería de imágenes en el Pi.
   ========================================================================== */
(function () {
  'use strict';

  var ANCHO_MAXIMO = 1100;
  var CALIDAD = 0.82;

  var productos = [];
  var sucio = false;

  var $ = function (s) { return document.querySelector(s); };

  var vistaEntrar = $('#vista-entrar');
  var vistaPanel  = $('#vista-panel');
  var barraAcc    = $('#barra-acciones');
  var lista       = $('#lista-productos');
  var plantilla   = $('#plantilla-producto');

  /* ------------------------------------------------------------------
     Avisos
     ------------------------------------------------------------------ */
  function error(caja, texto) {
    var el = $(caja);
    el.textContent = texto;
    el.hidden = !texto;
  }

  function correcto(texto) {
    var el = $('#ok-panel');
    el.textContent = texto;
    el.hidden = false;
    setTimeout(function () { el.hidden = true; }, 3500);
  }

  function marcarSucio(valor) {
    sucio = valor;
    $('#guardar').disabled = !valor;
    $('#pendiente').hidden = !valor;
  }

  window.addEventListener('beforeunload', function (e) {
    if (sucio) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ------------------------------------------------------------------
     Llamadas al servidor
     ------------------------------------------------------------------ */
  function pedir(url, opciones) {
    return fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opciones))
      .then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok || !d.ok) throw new Error(d.error || 'Algo ha fallado.');
          return d;
        });
      });
  }

  /* ------------------------------------------------------------------
     Entrar y salir
     ------------------------------------------------------------------ */
  $('#form-entrar').addEventListener('submit', function (e) {
    e.preventDefault();
    error('#error-entrar', '');

    var boton = e.target.querySelector('button');
    boton.disabled = true;

    pedir('/api/admin/entrar', {
      method: 'POST',
      body: JSON.stringify({ clave: $('#clave').value })
    })
      .then(function () { $('#clave').value = ''; abrirPanel(); })
      .catch(function (err) { error('#error-entrar', err.message); })
      .finally(function () { boton.disabled = false; });
  });

  $('#salir').addEventListener('click', function () {
    if (sucio && !confirm('Tienes cambios sin guardar. ¿Salir igualmente?')) return;
    pedir('/api/admin/salir', { method: 'POST' })
      .catch(function () {})
      .finally(function () { location.reload(); });
  });

  /* ------------------------------------------------------------------
     Arranque
     ------------------------------------------------------------------ */
  function abrirPanel() {
    vistaEntrar.hidden = true;
    vistaPanel.hidden = false;
    barraAcc.hidden = false;
    cargar();
  }

  function cargar() {
    pedir('/api/admin/productos')
      .then(function (d) {
        productos = d.productos || [];
        pintar();
        marcarSucio(false);
      })
      .catch(function (err) { error('#error-panel', err.message); });
  }

  pedir('/api/admin/sesion')
    .then(function (d) {
      if (!d.configurado) {
        vistaEntrar.hidden = false;
        error('#error-entrar', 'Falta definir ADMIN_PASSWORD en el servidor.');
        $('#form-entrar').querySelector('button').disabled = true;
        return;
      }
      if (d.dentro) abrirPanel();
      else vistaEntrar.hidden = false;
    })
    .catch(function () { vistaEntrar.hidden = false; });

  /* ------------------------------------------------------------------
     Pintado de la lista
     ------------------------------------------------------------------ */
  function pintar() {
    lista.innerHTML = '';

    productos.forEach(function (p, i) {
      var nodo = plantilla.content.cloneNode(true);
      var ficha = nodo.querySelector('.ficha');
      ficha.dataset.indice = i;
      ficha.classList.toggle('ficha--oculta', p.disponible === false);

      nodo.querySelector('[data-titulo]').textContent = p.nombre || 'Sin nombre';
      nodo.querySelector('[data-resumen]').textContent =
        p.precio + ' € · ' + (p.ficha || []).join(' · ');

      var miniatura = nodo.querySelector('.ficha__foto');
      miniatura.src = '/fotos/' + p.foto;
      miniatura.alt = '';

      nodo.querySelector('[data-previa]').src = '/fotos/' + p.foto;
      nodo.querySelector('[data-disponible]').checked = p.disponible !== false;

      ['nombre', 'precio', 'unidad', 'insignia', 'insigniaColor', 'id', 'descripcion', 'alt']
        .forEach(function (campo) {
          var el = nodo.querySelector('[data-campo="' + campo + '"]');
          if (el) el.value = p[campo] == null ? '' : p[campo];
        });

      for (var k = 0; k < 3; k++) {
        var el = nodo.querySelector('[data-ficha="' + k + '"]');
        if (el) el.value = (p.ficha && p.ficha[k]) || '';
      }

      nodo.querySelector('[data-subir]').disabled = i === 0;
      nodo.querySelector('[data-bajar]').disabled = i === productos.length - 1;

      lista.appendChild(nodo);
    });

    var aLaVenta = productos.filter(function (p) { return p.disponible !== false; }).length;
    $('#resumen').textContent =
      productos.length + (productos.length === 1 ? ' vela' : ' velas') +
      ' · ' + aLaVenta + ' a la venta';
  }

  /* ------------------------------------------------------------------
     Cambios dentro de una ficha
     ------------------------------------------------------------------ */
  function indiceDe(el) {
    return Number(el.closest('.ficha').dataset.indice);
  }

  lista.addEventListener('input', function (e) {
    var el = e.target;
    var i = indiceDe(el);
    if (Number.isNaN(i)) return;

    if (el.dataset.campo) {
      var campo = el.dataset.campo;
      productos[i][campo] = campo === 'precio' ? Number(el.value) : el.value;

      if (campo === 'nombre') {
        el.closest('.ficha').querySelector('[data-titulo]').textContent = el.value || 'Sin nombre';
      }
    }

    if (el.dataset.ficha !== undefined) {
      productos[i].ficha = productos[i].ficha || [];
      productos[i].ficha[Number(el.dataset.ficha)] = el.value;
    }

    marcarSucio(true);
  });

  lista.addEventListener('change', function (e) {
    var el = e.target;

    if (el.matches('[data-disponible]')) {
      var i = indiceDe(el);
      productos[i].disponible = el.checked;
      el.closest('.ficha').classList.toggle('ficha--oculta', !el.checked);
      marcarSucio(true);
    }

    if (el.matches('[data-archivo]') && el.files && el.files[0]) {
      subirFoto(el, el.files[0]);
    }
  });

  lista.addEventListener('click', function (e) {
    var boton = e.target.closest('button');
    if (!boton) return;

    var ficha = boton.closest('.ficha');
    var i = Number(ficha.dataset.indice);

    if (boton.hasAttribute('data-abrir')) {
      var cuerpo = ficha.querySelector('.ficha__cuerpo');
      var abierto = cuerpo.hidden;
      cuerpo.hidden = !abierto;
      boton.setAttribute('aria-expanded', String(abierto));
      boton.textContent = abierto ? 'Cerrar' : 'Editar';
      return;
    }

    if (boton.hasAttribute('data-subir') && i > 0) {
      intercambiar(i, i - 1);
    }

    if (boton.hasAttribute('data-bajar') && i < productos.length - 1) {
      intercambiar(i, i + 1);
    }

    if (boton.hasAttribute('data-borrar')) {
      var nombre = productos[i].nombre || 'esta vela';
      if (!confirm('¿Borrar «' + nombre + '»? No se puede deshacer.')) return;
      productos.splice(i, 1);
      renumerar();
      pintar();
      marcarSucio(true);
    }
  });

  function intercambiar(a, b) {
    var tmp = productos[a];
    productos[a] = productos[b];
    productos[b] = tmp;
    renumerar();
    pintar();
    marcarSucio(true);
  }

  function renumerar() {
    productos.forEach(function (p, i) { p.orden = i + 1; });
  }

  /* ------------------------------------------------------------------
     Añadir
     ------------------------------------------------------------------ */
  $('#nuevo').addEventListener('click', function () {
    productos.push({
      id: 'vela-' + Date.now().toString(36).slice(-4),
      nombre: '',
      descripcion: '',
      ficha: ['', '', ''],
      precio: 0,
      unidad: 'unidad',
      foto: productos.length ? productos[0].foto : '',
      alt: '',
      insignia: '',
      insigniaColor: 'miel',
      disponible: false,
      orden: productos.length + 1
    });
    pintar();
    marcarSucio(true);

    // Se abre la ficha nueva para rellenarla
    var ultima = lista.lastElementChild;
    if (ultima) {
      ultima.querySelector('[data-abrir]').click();
      ultima.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ultima.querySelector('[data-campo="nombre"]').focus();
    }
  });

  /* ------------------------------------------------------------------
     Foto: se encoge en el navegador y se sube en base64
     ------------------------------------------------------------------ */
  function subirFoto(entrada, archivo) {
    var ficha = entrada.closest('.ficha');
    var i = Number(ficha.dataset.indice);
    var estado = ficha.querySelector('[data-estado-foto]');

    estado.textContent = 'Preparando la imagen…';

    encoger(archivo)
      .then(function (dataUrl) {
        estado.textContent = 'Subiendo…';
        return pedir('/api/admin/foto', {
          method: 'POST',
          body: JSON.stringify({ nombre: archivo.name, datos: dataUrl })
        });
      })
      .then(function (d) {
        productos[i].foto = d.foto;
        ficha.querySelector('[data-previa]').src = '/fotos/' + d.foto;
        ficha.querySelector('.ficha__foto').src = '/fotos/' + d.foto;
        estado.textContent = 'Lista. Recuerda guardar los cambios.';
        marcarSucio(true);
      })
      .catch(function (err) {
        estado.textContent = 'No se ha podido subir: ' + err.message;
      })
      .finally(function () { entrada.value = ''; });
  }

  function encoger(archivo) {
    return new Promise(function (resolve, reject) {
      if (!/^image\//.test(archivo.type)) {
        reject(new Error('Eso no es una imagen.'));
        return;
      }

      var lector = new FileReader();
      lector.onerror = function () { reject(new Error('No se ha podido leer el archivo.')); };
      lector.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('La imagen está dañada.')); };
        img.onload = function () {
          var escala = Math.min(1, ANCHO_MAXIMO / img.width);
          var lienzo = document.createElement('canvas');
          lienzo.width = Math.round(img.width * escala);
          lienzo.height = Math.round(img.height * escala);

          var ctx = lienzo.getContext('2d');
          ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);

          resolve(lienzo.toDataURL('image/jpeg', CALIDAD));
        };
        img.src = lector.result;
      };
      lector.readAsDataURL(archivo);
    });
  }

  /* ------------------------------------------------------------------
     Guardar
     ------------------------------------------------------------------ */
  $('#guardar').addEventListener('click', function () {
    error('#error-panel', '');
    renumerar();

    var boton = $('#guardar');
    boton.disabled = true;
    var original = boton.textContent;
    boton.textContent = 'Guardando…';

    pedir('/api/admin/productos', {
      method: 'PUT',
      body: JSON.stringify({ productos: productos })
    })
      .then(function (d) {
        productos = d.productos || productos;
        pintar();
        marcarSucio(false);
        correcto('Guardado. Ya se ve en la tienda.');
      })
      .catch(function (err) {
        error('#error-panel', err.message);
        marcarSucio(true);
      })
      .finally(function () { boton.textContent = original; });
  });

})();
