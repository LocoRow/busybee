/* ==========================================================================
   Busy Bee · Arts and Crafts
   Sin dependencias. Todo se degrada con elegancia si algo no está disponible.
   ========================================================================== */
(function () {
  'use strict';

  var menosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------
     Abeja dibujada en SVG, reutilizada por las tres que vuelan
     ------------------------------------------------------------------ */
  var ABEJA = [
    '<svg viewBox="0 0 40 40" aria-hidden="true">',
      '<g class="ala ala--izq">',
        '<ellipse cx="17" cy="13" rx="8.5" ry="4.5" fill="#eaf3fb" opacity=".72"',
          ' stroke="#b9cfe0" stroke-width=".7" transform="rotate(-24 17 13)"/>',
      '</g>',
      '<g class="ala ala--der">',
        '<ellipse cx="25" cy="13" rx="8.5" ry="4.5" fill="#eaf3fb" opacity=".72"',
          ' stroke="#b9cfe0" stroke-width=".7" transform="rotate(24 25 13)"/>',
      '</g>',
      '<ellipse cx="21" cy="23" rx="9.5" ry="7" fill="#db9a00"/>',
      '<path d="M15 18.6q4 -1.4 8.2 -.6l1 2.2q-4.6 -1 -9.2 .6Z" fill="#2b2a25" opacity=".92"/>',
      '<path d="M14.2 23.2q5.4 -1.4 12.6 .2l-.2 2.3q-6.8 -1.6 -12.2 -.2Z" fill="#2b2a25" opacity=".92"/>',
      '<path d="M16.6 27.6q4.4 -1 8.6 -.2l-1.6 2q-3 .5 -5.6 -.2Z" fill="#2b2a25" opacity=".92"/>',
      '<circle cx="11" cy="20.4" r="4.4" fill="#2b2a25"/>',
      '<circle cx="9.6" cy="19.4" r="1.1" fill="#fdfaf3" opacity=".85"/>',
      '<path d="M9.6 16.4 7 13.2M12.4 16.2 11.4 12.6" stroke="#2b2a25" stroke-width="1.1"',
        ' stroke-linecap="round" fill="none"/>',
    '</svg>'
  ].join('');

  Array.prototype.forEach.call(document.querySelectorAll('.abeja'), function (a) {
    a.innerHTML = ABEJA;
  });

  /* ------------------------------------------------------------------
     Motas de polen flotando en la portada
     ------------------------------------------------------------------ */
  var polen = document.getElementById('polen');
  if (polen && !menosMovimiento) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < 22; i++) {
      var m = document.createElement('span');
      var tam = 3 + Math.random() * 5;
      m.className = 'mota';
      m.style.width = tam + 'px';
      m.style.height = tam + 'px';
      m.style.left = (Math.random() * 100) + '%';
      m.style.animationDuration = (16 + Math.random() * 20) + 's';
      m.style.animationDelay = (-Math.random() * 28) + 's';
      m.style.setProperty('--deriva', (Math.random() * 180 - 90) + 'px');
      frag.appendChild(m);
    }
    polen.appendChild(frag);
  }

  /* ------------------------------------------------------------------
     Cabecera que se pega al hacer scroll
     ------------------------------------------------------------------ */
  var cabecera = document.getElementById('cabecera');
  var ultimaY = -1;

  function alScroll() {
    var y = window.pageYOffset;
    if (y === ultimaY) return;
    ultimaY = y;
    cabecera.classList.toggle('pegada', y > 40);
  }
  window.addEventListener('scroll', function () {
    window.requestAnimationFrame(alScroll);
  }, { passive: true });
  alScroll();

  /* ------------------------------------------------------------------
     Menú en pantallas pequeñas
     ------------------------------------------------------------------ */
  var menuBtn = document.getElementById('menu-btn');
  var nav = document.getElementById('nav');

  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () {
      var abierto = nav.classList.toggle('abierta');
      menuBtn.setAttribute('aria-expanded', String(abierto));
      menuBtn.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
      document.body.style.overflow = abierto ? 'hidden' : '';
    });

    nav.addEventListener('click', function (e) {
      if (e.target.closest('a') && nav.classList.contains('abierta')) {
        nav.classList.remove('abierta');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.setAttribute('aria-label', 'Abrir menú');
        document.body.style.overflow = '';
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('abierta')) menuBtn.click();
    });
  }

  /* ------------------------------------------------------------------
     Revelado progresivo al entrar en pantalla
     ------------------------------------------------------------------ */
  var aRevelar = document.querySelectorAll('.revelar');

  if (!('IntersectionObserver' in window) || menosMovimiento) {
    Array.prototype.forEach.call(aRevelar, function (el) { el.classList.add('visible'); });
  } else {
    var observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (entrada.isIntersecting) {
          entrada.target.classList.add('visible');
          observador.unobserve(entrada.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    Array.prototype.forEach.call(aRevelar, function (el) { observador.observe(el); });
  }

  /* ------------------------------------------------------------------
     Cinta de valores: se duplica el grupo para que el bucle no corte
     ------------------------------------------------------------------ */
  var pista = document.getElementById('cinta-pista');
  if (pista && pista.children.length === 1) {
    pista.appendChild(pista.firstElementChild.cloneNode(true));
  }

  /* ------------------------------------------------------------------
     Cesta
     Vive en localStorage, así que sobrevive a recargas y a cerrar el móvil.
     Los precios de aquí son sólo para enseñarlos: al pedir se mandan
     identificadores y cantidades, y el precio bueno lo pone el servidor.
     ------------------------------------------------------------------ */
  var LLAVE = 'busybee.cesta.v1';
  var MAXIMO = 20;
  var cesta = [];

  try {
    var guardada = JSON.parse(localStorage.getItem(LLAVE) || '[]');
    if (Array.isArray(guardada)) {
      cesta = guardada.filter(function (l) {
        return l && typeof l.id === 'string' && Number(l.cantidad) > 0;
      });
    }
  } catch (e) { cesta = []; }

  function guardar() {
    try { localStorage.setItem(LLAVE, JSON.stringify(cesta)); } catch (e) {}
  }

  function unidades() {
    return cesta.reduce(function (s, l) { return s + l.cantidad; }, 0);
  }

  function total() {
    return cesta.reduce(function (s, l) { return s + l.precio * l.cantidad; }, 0);
  }

  function euros(n) { return n + ' €'; }

  /** Evita que un nombre con caracteres raros se cuele como HTML. */
  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* --- avisos flotantes --- */
  var brindis = document.getElementById('brindis');
  var brindisTexto = document.getElementById('brindis-texto');
  var temporizador;

  function avisar(texto) {
    if (!brindis) return;
    brindisTexto.textContent = texto;
    brindis.classList.add('visible');
    clearTimeout(temporizador);
    temporizador = setTimeout(function () { brindis.classList.remove('visible'); }, 2800);
  }

  /* --- elementos de la pantalla --- */
  var pantalla = document.getElementById('pantalla');
  var vistaPedido = document.getElementById('vista-pedido');
  var vistaHecho = document.getElementById('vista-hecho');
  var rejilla = document.getElementById('pedido-rejilla');
  var cestaVacia = document.getElementById('cesta-vacia');
  var lineasCaja = document.getElementById('lineas');
  var num = document.getElementById('carrito-num');
  var cuenta = document.getElementById('cuenta-articulos');
  var subtotal = document.getElementById('subtotal');
  var totalPedido = document.getElementById('total-pedido');
  var formPedido = document.getElementById('form-pedido');
  var errorPedido = document.getElementById('error-pedido');

  function pintar() {
    var u = unidades();

    if (num) {
      num.textContent = String(u);
      num.classList.add('saltar');
      setTimeout(function () { num.classList.remove('saltar'); }, 300);
    }

    if (cuenta) cuenta.textContent = u === 1 ? '1 artículo' : u + ' artículos';
    if (subtotal) subtotal.textContent = euros(total());
    if (totalPedido) totalPedido.textContent = euros(total());

    // Con la cesta vacía no tiene sentido enseñar la lista ni el formulario.
    if (rejilla) rejilla.hidden = cesta.length === 0;
    if (cestaVacia) cestaVacia.hidden = cesta.length > 0;

    if (!lineasCaja) return;

    var trozos = [];
    for (var i = 0; i < cesta.length; i++) {
      var l = cesta[i];
      trozos.push(
        '<li class="articulo">' +
          '<img class="articulo__foto" src="' + esc(l.foto) + '" alt="" width="88" height="88" loading="lazy">' +
          '<div class="articulo__datos">' +
            '<h3 class="articulo__nombre">' + esc(l.nombre) + '</h3>' +
            (l.ficha ? '<p class="articulo__ficha">' + esc(l.ficha) + '</p>' : '') +
            '<p class="articulo__unidad">' + euros(l.precio) + ' la unidad</p>' +
          '</div>' +
          '<div class="articulo__acciones">' +
            '<span class="articulo__importe">' + euros(l.precio * l.cantidad) + '</span>' +
            '<div class="contador">' +
              '<button type="button" data-menos="' + esc(l.id) + '" aria-label="Una unidad menos de ' + esc(l.nombre) + '">−</button>' +
              '<span aria-label="' + l.cantidad + ' unidades">' + l.cantidad + '</span>' +
              '<button type="button" data-mas="' + esc(l.id) + '"' + (l.cantidad >= MAXIMO ? ' disabled' : '') +
                ' aria-label="Una unidad más de ' + esc(l.nombre) + '">+</button>' +
            '</div>' +
            '<button type="button" class="articulo__quitar" data-quitar="' + esc(l.id) + '">Quitar</button>' +
          '</div>' +
        '</li>'
      );
    }
    lineasCaja.innerHTML = trozos.join('');
  }

  /* --- abrir y cerrar la pantalla --- */
  var ultimoFoco = null;

  function abrir() {
    if (!pantalla) return;
    ultimoFoco = document.activeElement;
    vistaHecho.hidden = true;
    vistaPedido.hidden = false;
    pantalla.hidden = false;
    document.body.style.overflow = 'hidden';
    pantalla.scrollTop = 0;
    pintar();
    var cerrarBtn = document.getElementById('cerrar-pantalla');
    if (cerrarBtn) cerrarBtn.focus();
  }

  function cerrar() {
    if (!pantalla) return;
    pantalla.hidden = true;
    document.body.style.overflow = '';
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }

  var botonAbrir = document.getElementById('abrir-cesta');
  if (botonAbrir) {
    botonAbrir.addEventListener('click', function () {
      // En móvil el menú puede estar abierto por encima.
      if (nav && nav.classList.contains('abierta')) {
        nav.classList.remove('abierta');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
      abrir();
    });
  }

  var botonCerrar = document.getElementById('cerrar-pantalla');
  if (botonCerrar) botonCerrar.addEventListener('click', cerrar);

  var cerrarHecho = document.getElementById('cerrar-hecho');
  if (cerrarHecho) cerrarHecho.addEventListener('click', cerrar);

  var irCatalogo = document.getElementById('ir-catalogo');
  if (irCatalogo) {
    irCatalogo.addEventListener('click', function () {
      cerrar();
      var destino = document.getElementById('velas');
      if (destino) destino.scrollIntoView({ behavior: menosMovimiento ? 'auto' : 'smooth' });
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && pantalla && !pantalla.hidden) cerrar();
  });

  /* --- añadir desde las fichas del catálogo --- */
  document.addEventListener('click', function (e) {
    var boton = e.target.closest('.btn-anadir');
    if (!boton) return;

    var id = boton.getAttribute('data-id');
    var linea = cesta.filter(function (l) { return l.id === id; })[0];

    if (linea) {
      if (linea.cantidad >= MAXIMO) {
        avisar('Máximo ' + MAXIMO + ' unidades. Para más, escríbeme.');
        return;
      }
      linea.cantidad += 1;
    } else {
      cesta.push({
        id: id,
        nombre: boton.getAttribute('data-nombre'),
        precio: Number(boton.getAttribute('data-precio')),
        foto: boton.getAttribute('data-foto'),
        ficha: boton.getAttribute('data-ficha') || '',
        cantidad: 1
      });
    }

    guardar();
    pintar();
    avisar(boton.getAttribute('data-nombre') + ' en la cesta · ' + euros(total()));
  });

  /* --- cantidades dentro de la lista --- */
  if (lineasCaja) {
    lineasCaja.addEventListener('click', function (e) {
      var mas = e.target.closest('[data-mas]');
      var menos = e.target.closest('[data-menos]');
      var quitar = e.target.closest('[data-quitar]');
      if (!mas && !menos && !quitar) return;

      var id = mas ? mas.getAttribute('data-mas')
             : menos ? menos.getAttribute('data-menos')
             : quitar.getAttribute('data-quitar');

      var linea = cesta.filter(function (l) { return l.id === id; })[0];
      if (!linea) return;

      if (mas) linea.cantidad = Math.min(linea.cantidad + 1, MAXIMO);
      else if (menos) linea.cantidad -= 1;

      if (quitar || linea.cantidad < 1) {
        cesta = cesta.filter(function (l) { return l.id !== id; });
      }

      guardar();
      pintar();
    });
  }

  /* --- enviar el pedido --- */
  if (formPedido) {
    formPedido.addEventListener('submit', function (e) {
      e.preventDefault();

      if (!cesta.length) { avisar('La cesta está vacía'); return; }

      var boton = document.getElementById('enviar-pedido');
      var datos = new FormData(formPedido);
      function v(k) { return (datos.get(k) || '').toString().trim(); }

      var fallos = [];
      if (v('nombre').length < 2) fallos.push('Escribe tu nombre.');
      if (!/^[+\d][\d\s().-]{5,24}$/.test(v('telefono'))) fallos.push('Revisa el teléfono.');
      if (v('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email'))) fallos.push('Revisa el correo.');
      if (v('direccion').length < 5) fallos.push('Escribe la dirección.');
      if (!/^\d{4,10}$/.test(v('cp'))) fallos.push('Revisa el código postal.');
      if (v('poblacion').length < 2) fallos.push('Escribe la población.');

      if (fallos.length) {
        errorPedido.textContent = fallos[0];
        errorPedido.hidden = false;
        errorPedido.scrollIntoView({ block: 'nearest', behavior: menosMovimiento ? 'auto' : 'smooth' });
        return;
      }

      errorPedido.hidden = true;
      boton.disabled = true;
      var textoOriginal = boton.textContent;
      boton.textContent = 'Enviando…';

      fetch('/api/pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente: {
            nombre: v('nombre'),
            telefono: v('telefono'),
            email: v('email'),
            direccion: v('direccion'),
            cp: v('cp'),
            poblacion: v('poblacion'),
            notas: v('notas')
          },
          items: cesta.map(function (l) { return { id: l.id, cantidad: l.cantidad }; }),
          web: v('web')
        })
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (!res.ok || !res.d.ok) throw new Error(res.d.error || 'No se ha podido enviar.');
          document.getElementById('ref-pedido').textContent = res.d.ref;
          cesta = [];
          guardar();
          pintar();
          formPedido.reset();
          vistaPedido.hidden = true;
          vistaHecho.hidden = false;
          pantalla.scrollTop = 0;
        })
        .catch(function (err) {
          errorPedido.textContent = err.message;
          errorPedido.hidden = false;
        })
        .finally(function () {
          boton.disabled = false;
          boton.textContent = textoOriginal;
        });
    });
  }

  pintar();


  /* ------------------------------------------------------------------
     Formulario de consulta del pie
     ------------------------------------------------------------------ */
  var formulario = document.getElementById('formulario');
  if (formulario) {
    formulario.addEventListener('submit', function (e) {
      e.preventDefault();

      var nombre = formulario.querySelector('#nombre');
      var contacto = formulario.querySelector('#email');

      if (!nombre.value.trim() || !contacto.value.trim()) {
        avisar('Rellena tu nombre y cómo contactarte');
        (!nombre.value.trim() ? nombre : contacto).focus();
        return;
      }

      var boton = formulario.querySelector('button[type=submit]');
      boton.disabled = true;
      var original = boton.textContent;
      boton.textContent = 'Enviando…';

      fetch('/api/consulta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.value.trim(),
          contacto: contacto.value.trim(),
          interes: formulario.querySelector('#interes').value,
          mensaje: formulario.querySelector('#mensaje').value.trim(),
          web: ''
        })
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (!res.ok || !res.d.ok) throw new Error(res.d.error || 'No se ha podido enviar.');
          avisar('¡Gracias, ' + nombre.value.trim().split(' ')[0] + '! Te escribo pronto.');
          formulario.reset();
        })
        .catch(function (err) { avisar(err.message); })
        .finally(function () {
          boton.disabled = false;
          boton.textContent = original;
        });
    });
  }

  /* ------------------------------------------------------------------
     Año en el pie
     ------------------------------------------------------------------ */
  var anio = document.getElementById('anio');
  if (anio) anio.textContent = String(new Date().getFullYear());

})();
