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
     Los precios de aquí son sólo para enseñarlos: el pedido que se envía
     lleva identificadores y cantidades, y el precio bueno lo pone el servidor.
     ------------------------------------------------------------------ */
  var LLAVE = 'busybee.cesta.v1';
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

  /* --- elementos del panel --- */
  var panel = document.getElementById('panel');
  var velo = document.getElementById('velo');
  var lineasCaja = document.getElementById('lineas');
  var pieCesta = document.getElementById('pie-cesta');
  var num = document.getElementById('carrito-num');
  var totalCesta = document.getElementById('total-cesta');
  var totalDatos = document.getElementById('total-datos');
  var formPedido = document.getElementById('form-pedido');
  var errorPedido = document.getElementById('error-pedido');

  function pintar() {
    if (num) {
      num.textContent = String(unidades());
      num.classList.add('saltar');
      setTimeout(function () { num.classList.remove('saltar'); }, 300);
    }

    if (totalCesta) totalCesta.textContent = euros(total());
    if (totalDatos) totalDatos.textContent = euros(total());
    if (pieCesta) pieCesta.hidden = cesta.length === 0;
    if (!lineasCaja) return;

    if (!cesta.length) {
      lineasCaja.innerHTML =
        '<div class="vacia">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">' +
            '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/>' +
            '<path d="M16 10a4 4 0 0 1-8 0"/>' +
          '</svg>' +
          '<p>Todavía no has puesto nada.</p>' +
          '<p style="font-size:.86rem">Las velas están un poco más arriba.</p>' +
        '</div>';
      return;
    }

    var trozos = [];
    for (var i = 0; i < cesta.length; i++) {
      var l = cesta[i];
      trozos.push(
        '<div class="linea">' +
          '<img class="linea__foto" src="' + l.foto + '" alt="" width="64" height="64" loading="lazy">' +
          '<div>' +
            '<div class="linea__nombre">' + l.nombre + '</div>' +
            '<div class="linea__precio">' + euros(l.precio) + ' · ' + euros(l.precio * l.cantidad) + '</div>' +
            '<a class="linea__quitar" href="#" data-quitar="' + l.id + '">Quitar</a>' +
          '</div>' +
          '<div class="contador">' +
            '<button type="button" data-menos="' + l.id + '" aria-label="Una unidad menos">−</button>' +
            '<span>' + l.cantidad + '</span>' +
            '<button type="button" data-mas="' + l.id + '" aria-label="Una unidad más">+</button>' +
          '</div>' +
        '</div>'
      );
    }
    lineasCaja.innerHTML = trozos.join('');
  }

  /* --- abrir, cerrar y moverse entre pasos --- */
  var ultimoFoco = null;

  function irA(paso) {
    ['paso-cesta', 'paso-datos', 'paso-hecho'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.toggle('activo', id === paso);
    });
  }

  function abrir() {
    if (!panel) return;
    ultimoFoco = document.activeElement;
    velo.hidden = false;
    requestAnimationFrame(function () {
      velo.classList.add('visible');
      panel.classList.add('abierto');
    });
    panel.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (!document.getElementById('paso-hecho').classList.contains('activo')) irA('paso-cesta');
    pintar();
    var cerrarBtn = document.getElementById('cerrar-cesta');
    if (cerrarBtn) cerrarBtn.focus();
  }

  function cerrar() {
    if (!panel) return;
    panel.classList.remove('abierto');
    velo.classList.remove('visible');
    panel.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(function () { velo.hidden = true; }, 420);
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }

  var botonAbrir = document.getElementById('abrir-cesta');
  if (botonAbrir) botonAbrir.addEventListener('click', abrir);
  var botonCerrar = document.getElementById('cerrar-cesta');
  if (botonCerrar) botonCerrar.addEventListener('click', cerrar);
  if (velo) velo.addEventListener('click', cerrar);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel && panel.classList.contains('abierto')) cerrar();
  });

  /* --- añadir desde las fichas --- */
  document.addEventListener('click', function (e) {
    var boton = e.target.closest('.btn-anadir');
    if (!boton) return;

    var id = boton.getAttribute('data-id');
    var linea = cesta.filter(function (l) { return l.id === id; })[0];

    if (linea) {
      linea.cantidad = Math.min(linea.cantidad + 1, 20);
    } else {
      cesta.push({
        id: id,
        nombre: boton.getAttribute('data-nombre'),
        precio: Number(boton.getAttribute('data-precio')),
        foto: boton.getAttribute('data-foto'),
        cantidad: 1
      });
    }

    guardar();
    pintar();
    avisar(boton.getAttribute('data-nombre') + ' en la cesta · ' + euros(total()));
  });

  /* --- cantidades dentro del panel --- */
  if (lineasCaja) {
    lineasCaja.addEventListener('click', function (e) {
      var mas = e.target.closest('[data-mas]');
      var menos = e.target.closest('[data-menos]');
      var quitar = e.target.closest('[data-quitar]');
      if (!mas && !menos && !quitar) return;
      e.preventDefault();

      var id = mas ? mas.getAttribute('data-mas')
             : menos ? menos.getAttribute('data-menos')
             : quitar.getAttribute('data-quitar');

      var linea = cesta.filter(function (l) { return l.id === id; })[0];
      if (!linea) return;

      if (mas) linea.cantidad = Math.min(linea.cantidad + 1, 20);
      else if (menos) linea.cantidad -= 1;

      if (quitar || linea.cantidad < 1) {
        cesta = cesta.filter(function (l) { return l.id !== id; });
      }

      guardar();
      pintar();
    });
  }

  var irDatos = document.getElementById('ir-datos');
  if (irDatos) {
    irDatos.addEventListener('click', function () {
      if (!cesta.length) { avisar('La cesta está vacía'); return; }
      irA('paso-datos');
      var primero = document.getElementById('p-nombre');
      if (primero) primero.focus();
    });
  }

  var volver = document.getElementById('volver-cesta');
  if (volver) volver.addEventListener('click', function () { irA('paso-cesta'); });

  var cerrarHecho = document.getElementById('cerrar-hecho');
  if (cerrarHecho) {
    cerrarHecho.addEventListener('click', function () { cerrar(); irA('paso-cesta'); });
  }

  /* --- enviar el pedido --- */
  if (formPedido) {
    formPedido.addEventListener('submit', function (e) {
      e.preventDefault();

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
          irA('paso-hecho');
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
