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
     Cesta de demostración
     ------------------------------------------------------------------ */
  var cesta = [];
  var num = document.getElementById('carrito-num');
  var brindis = document.getElementById('brindis');
  var brindisTexto = document.getElementById('brindis-texto');
  var temporizador;

  function avisar(texto) {
    if (!brindis) return;
    brindisTexto.textContent = texto;
    brindis.classList.add('visible');
    clearTimeout(temporizador);
    temporizador = setTimeout(function () {
      brindis.classList.remove('visible');
    }, 2600);
  }

  document.addEventListener('click', function (e) {
    var boton = e.target.closest('.btn-anadir');
    if (!boton) return;

    var nombre = boton.getAttribute('data-nombre');
    var precio = parseFloat(boton.getAttribute('data-precio'));
    cesta.push({ nombre: nombre, precio: precio });

    var total = cesta.reduce(function (s, p) { return s + p.precio; }, 0);

    if (num) {
      num.textContent = String(cesta.length);
      num.classList.add('saltar');
      setTimeout(function () { num.classList.remove('saltar'); }, 300);
    }

    avisar(nombre + ' en la cesta · ' + total.toFixed(0) + ' €');
  });

  /* ------------------------------------------------------------------
     Formulario (demostración: no envía)
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

      avisar('¡Gracias, ' + nombre.value.trim().split(' ')[0] + '! Te contesto pronto.');
      formulario.reset();
    });
  }

  /* ------------------------------------------------------------------
     Año en el pie
     ------------------------------------------------------------------ */
  var anio = document.getElementById('anio');
  if (anio) anio.textContent = String(new Date().getFullYear());

})();
