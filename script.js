/* ==========================================================================
   Sarana Teknik Motor
   Ubah data bengkel di bagian BUSINESS. Semua alamat, nomor telepon,
   tombol WhatsApp, jam buka, dan link peta di halaman ikut berubah.
   ========================================================================== */

(() => {
  'use strict';

  const root = document.documentElement;
  // Class "js" dipasang di <head>, kecuali pengunjung memilih "kurangi gerakan"
  const motionOK = root.classList.contains('js');
  const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));

  /* ---------- GANTI DATA INI ---------- */
  const BUSINESS = {
    phone: '0813-3756-2560',          // tampilan nomor
    phoneIntl: '6281337562560',       // format internasional tanpa +, tanpa spasi (62 = Indonesia)
    address: 'Jl. Komodo, Kampung Ka, Kec. Langke Rembong, Kabupaten Manggarai, Nusa Tenggara Timur',
    hours: 'Senin sampai Sabtu, 08.00–17.30 WITA',
    whatsappText: 'Halo Sarana Teknik Motor, saya ingin bertanya tentang servis motor.',
    mapsQuery: '-8.6025898,120.4557273', // koordinat lokasi bengkel (lat,lng) agar link "Buka di Google Maps" akurat
  };
  /* ------------------------------------ */

  const links = {
    tel: `tel:+${BUSINESS.phoneIntl}`,
    wa: `https://wa.me/${BUSINESS.phoneIntl}?text=${encodeURIComponent(BUSINESS.whatsappText)}`,
    maps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(BUSINESS.mapsQuery)}`,
  };

  // Isi teks dari data BUSINESS
  document.querySelectorAll('[data-bind]').forEach((el) => {
    const value = BUSINESS[el.dataset.bind];
    if (value) el.textContent = value;
  });

  // Isi link telepon, WhatsApp, dan peta
  document.querySelectorAll('[data-href]').forEach((a) => {
    const type = a.dataset.href;
    if (!links[type]) return;
    a.href = links[type];
    if (type !== 'tel') {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
  });

  // Tahun di footer
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Menu di layar kecil ---------- */
  const header = document.getElementById('site-header');
  const toggle = header ? header.querySelector('.menu-toggle') : null;

  const setMenu = (open) => {
    if (!header || !toggle) return;
    header.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Tutup' : 'Menu';
  };

  if (toggle) {
    toggle.addEventListener('click', () => {
      setMenu(!header.classList.contains('is-open'));
    });

    header.querySelectorAll('.site-nav a').forEach((a) => {
      a.addEventListener('click', () => setMenu(false));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && header.classList.contains('is-open')) {
        setMenu(false);
        toggle.focus();
      }
    });

    window.matchMedia('(min-width: 861px)').addEventListener('change', (e) => {
      if (e.matches) setMenu(false);
    });
  }

  /* ---------- Galeri: placeholder jika foto belum ada, lightbox jika ada ---------- */
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = lightbox ? lightbox.querySelector('img') : null;
  const lightboxCap = lightbox ? lightbox.querySelector('.lightbox__cap') : null;
  const lightboxPrev = lightbox ? lightbox.querySelector('.lightbox__nav--prev') : null;
  const lightboxNext = lightbox ? lightbox.querySelector('.lightbox__nav--next') : null;

  // Daftar foto yang valid (belum tentu semua terisi), diisi begitu status tiap foto diketahui
  const shots = [];
  let currentIndex = 0;
  // Animasi + timer yang sedang berjalan di gambar lightbox. Disimpan di satu tempat dan selalu
  // dibersihkan sebelum animasi baru dimulai, supaya klik cepat/berturut-turut (mis. buka lalu
  // langsung pindah foto) tidak membuat rantai animasi putus di tengah jalan.
  let activeShotAnim = null;
  let flipTimer = null;

  const cancelActiveShotAnim = () => {
    if (flipTimer) {
      clearTimeout(flipTimer);
      flipTimer = null;
    }
    if (activeShotAnim) {
      try { activeShotAnim.cancel(); } catch (err) { /* animasi sudah selesai, aman diabaikan */ }
      activeShotAnim = null;
    }
    lightboxImg.style.transform = '';
    lightboxImg.style.opacity = '';
    lightboxImg.style.transformOrigin = '';
  };

  // Foto membesar dari posisi miniaturnya ke tengah layar
  const playLightboxOpen = (thumb) => {
    if (!motionOK || !thumb.animate) return;
    requestAnimationFrame(() => {
      const from = thumb.getBoundingClientRect();
      const to = lightboxImg.getBoundingClientRect();
      if (!to.width || !to.height) return;
      const scale = from.width / to.width;
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      // Dilacak di activeShotAnim juga, supaya kalau tombol prev/next diklik saat animasi ini
      // masih jalan, animasinya langsung dibatalkan lebih dulu (tidak bentrok dengan animasi flip).
      activeShotAnim = lightboxImg.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.35 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 520, easing: 'cubic-bezier(.2,.85,.2,1)' }
      );
      activeShotAnim.onfinish = () => { activeShotAnim = null; };
      lightboxCap.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 250, fill: 'backwards' });
    });
  };

  // Tampilkan/sembunyikan panah kiri-kanan sesuai jumlah foto yang tersedia
  const updateLightboxNav = () => {
    const enoughShots = shots.length > 1;
    if (lightboxPrev) lightboxPrev.classList.toggle('is-hidden', !enoughShots);
    if (lightboxNext) lightboxNext.classList.toggle('is-hidden', !enoughShots);
  };

  // Isi ulang gambar + caption lightbox dari entri galeri, dengan efek "buka buku" opsional.
  // Pergantian konten dijadwalkan lewat setTimeout (bukan animation.onfinish), supaya tetap
  // pasti jalan walau animasi sebelumnya sempat dibatalkan oleh klik berikutnya.
  const renderLightbox = (index, direction) => {
    const entry = shots[index];
    if (!entry) return;
    currentIndex = index;

    const applyContent = () => {
      lightboxImg.src = entry.img.currentSrc || entry.img.src;
      lightboxImg.alt = entry.img.alt;
      lightboxCap.textContent = entry.caption ? entry.caption.textContent : '';
    };

    // Selalu bersihkan animasi/timer sebelumnya dulu supaya tidak ada state lama yang nyangkut
    cancelActiveShotAnim();

    if (!direction || !motionOK || !lightboxImg.animate) {
      applyContent();
      return;
    }

    // direction: 1 = ke foto berikutnya, -1 = ke foto sebelumnya.
    // Halaman "menutup" berputar pada poros sisi arah tujuan, lalu halaman baru "membuka" dari sisi itu juga.
    const hingeOut = direction > 0 ? 'right center' : 'left center';
    const hingeIn = direction > 0 ? 'left center' : 'right center';
    const outAngle = direction > 0 ? -80 : 80;
    const inAngle = direction > 0 ? 80 : -80;
    const outDuration = 240;
    const inDuration = 300;

    lightboxImg.style.transformOrigin = hingeOut;
    activeShotAnim = lightboxImg.animate(
      [
        { transform: 'perspective(1400px) rotateY(0deg)', opacity: 1 },
        { transform: `perspective(1400px) rotateY(${outAngle}deg)`, opacity: 0.2 },
      ],
      { duration: outDuration, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }
    );

    flipTimer = setTimeout(() => {
      flipTimer = null;
      if (activeShotAnim) {
        try { activeShotAnim.cancel(); } catch (err) { /* aman diabaikan */ }
      }
      applyContent();
      lightboxImg.style.transformOrigin = hingeIn;
      activeShotAnim = lightboxImg.animate(
        [
          { transform: `perspective(1400px) rotateY(${inAngle}deg)`, opacity: 0.2 },
          { transform: 'perspective(1400px) rotateY(0deg)', opacity: 1 },
        ],
        { duration: inDuration, easing: 'cubic-bezier(.25,.65,.3,1)' }
      );
      flipTimer = setTimeout(() => {
        flipTimer = null;
        activeShotAnim = null;
        lightboxImg.style.transformOrigin = '';
      }, inDuration);
    }, outDuration);
  };

  const goToShot = (index, direction) => {
    if (!shots.length) return;
    const nextIndex = (index + shots.length) % shots.length;
    renderLightbox(nextIndex, direction);
  };

  const closeLightbox = () => {
    if (!lightbox || !lightbox.open) return;
    cancelActiveShotAnim();
    if (!motionOK) return lightbox.close();
    if (lightbox.classList.contains('is-closing')) return;
    lightbox.classList.add('is-closing');
    setTimeout(() => {
      lightbox.classList.remove('is-closing');
      lightbox.close();
    }, 250);
  };

  document.querySelectorAll('.shot').forEach((shot) => {
    const button = shot.querySelector('.shot__btn');
    const img = button.querySelector('img');
    const caption = shot.querySelector('figcaption');

    const markEmpty = () => {
      img.remove();
      button.classList.add('is-empty');
      button.setAttribute('aria-disabled', 'true');
      button.setAttribute('aria-label', `${caption ? caption.textContent : 'Foto'} (foto belum dipasang)`);
    };

    // Gambar bisa gagal sebelum script berjalan, jadi cek keduanya
    if (img.complete && img.naturalWidth === 0) {
      markEmpty();
    } else {
      shots.push({ img, caption });
    }
    img.addEventListener('error', () => {
      const idx = shots.findIndex((s) => s.img === img);
      if (idx !== -1) shots.splice(idx, 1);
      markEmpty();
      updateLightboxNav();
    }, { once: true });

    button.addEventListener('click', () => {
      if (button.classList.contains('is-empty') || !lightbox || !lightbox.showModal) return;
      const index = shots.findIndex((s) => s.img === img);
      if (index === -1) return;
      currentIndex = index;
      cancelActiveShotAnim();
      renderLightbox(index, 0);
      lightbox.showModal();
      updateLightboxNav();
      playLightboxOpen(img);
    });
  });

  if (lightboxPrev) lightboxPrev.addEventListener('click', () => goToShot(currentIndex - 1, -1));
  if (lightboxNext) lightboxNext.addEventListener('click', () => goToShot(currentIndex + 1, 1));

  if (lightbox) {
    // Klik di luar foto, tombol Tutup, dan tombol Esc semuanya lewat animasi tutup
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
    lightbox.addEventListener('cancel', (e) => {
      if (!motionOK) return;
      e.preventDefault();
      closeLightbox();
    });
    const closeForm = lightbox.querySelector('form');
    if (closeForm) {
      closeForm.addEventListener('submit', (e) => {
        if (!motionOK) return;
        e.preventDefault();
        closeLightbox();
      });
    }

    // Panah kiri/kanan untuk pindah foto, Esc tetap menutup lewat listener "cancel" di atas
    lightbox.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToShot(currentIndex + 1, 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToShot(currentIndex - 1, -1);
      }
    });

    // Geser (swipe) di layar sentuh untuk pindah foto
    let touchStartX = null;
    let touchStartY = null;
    lightbox.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    lightbox.addEventListener('touchend', (e) => {
      if (touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      touchStartX = null;
      touchStartY = null;
      // Abaikan jika geraknya lebih vertikal daripada horizontal, atau terlalu pendek
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) goToShot(currentIndex + 1, 1);
      else goToShot(currentIndex - 1, -1);
    });
  }

  /* ==========================================================================
     ANIMASI
     Blok di bawah hanya berjalan jika class "js" ada di <html>. CSS-nya ada di
     bagian ANIMASI pada style.css.
     ========================================================================== */
  if (motionOK) {

    /* ---------- 1. Persiapan ---------- */

    // Pecah judul supaya huruf/kata bisa naik satu per satu dari balik topeng
    const splitText = (el, byChar) => {
      const text = el.textContent.replace(/\s+/g, ' ').trim();
      el.setAttribute('aria-label', text); // pembaca layar tetap membaca judul utuh
      el.textContent = '';
      let i = 0;
      text.split(' ').forEach((word, wi, all) => {
        const w = document.createElement('span');
        w.className = 'w';
        w.setAttribute('aria-hidden', 'true');
        (byChar ? [...word] : [word]).forEach((part) => {
          const c = document.createElement('span');
          c.className = 'ch';
          c.style.setProperty('--i', i++);
          c.textContent = part;
          w.append(c);
        });
        el.append(w);
        if (wi < all.length - 1) el.append(' ');
      });
      el.classList.add('is-split');
    };

    const heroTitle = document.querySelector('.hero__title');
    if (heroTitle) splitText(heroTitle, true);
    document.querySelectorAll('.section-head h2, .contact__info h2').forEach((h) => splitText(h, false));

    // Garis SVG dinormalkan (pathLength=1) agar bisa "digambar" dengan stroke-dashoffset
    document.querySelectorAll('.callouts polyline, .service__icon *').forEach((el) => {
      el.setAttribute('pathLength', '1');
    });

    // Label roda muncul bergiliran: Velg, Ban, As roda, Cakram rem
    const callouts = document.querySelector('.callouts');
    if (callouts) {
      [...callouts.children].forEach((el, i) => {
        el.style.setProperty('--d', `${(2.1 + Math.floor(i / 3) * 0.2).toFixed(2)}s`);
      });
    }

    /* ---------- 2. Mulai urutan buka setelah font siap (maksimal 1,2 detik) ---------- */
    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1200))]).then(() => {
      requestAnimationFrame(() => root.classList.add('is-ready'));
    });

    /* ---------- 3. Isi halaman muncul saat digulir ---------- */
    const revealables = document.querySelectorAll(
      'h2, .section-head p, .contact__lead, .contact__actions, .details__row, .spec, .specs, .service, .services, .shot, .map'
    );

    if ('IntersectionObserver' in window) {
      const reveal = new IntersectionObserver(
        (entries) => {
          const batch = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
          const counts = new Map();
          batch.forEach(({ target }) => {
            // Yang muncul bersamaan diberi jeda bertahap, kiri ke kanan lalu atas ke bawah
            const n = counts.get(target.parentElement) || 0;
            counts.set(target.parentElement, n + 1);
            target.style.setProperty('--d', `${(Math.min(n, 8) * 0.09).toFixed(2)}s`);
            target.classList.add('is-in');
            reveal.unobserve(target);
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -6% 0px' }
      );
      revealables.forEach((el) => reveal.observe(el));
    } else {
      revealables.forEach((el) => el.classList.add('is-in'));
    }

    // Peta: animasi tak berujung hanya berjalan saat peta terlihat
    const map = document.querySelector('.map');
    if (map && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => map.classList.toggle('is-live', e.isIntersecting), { rootMargin: '120px' }).observe(map);
    } else if (map) {
      map.classList.add('is-live');
    }

    /* ---------- 4. Roda: berputar pelan, ikut gulir, bisa diseret ---------- */
    const drawing = document.querySelector('.drawing');
    const wheel = drawing ? drawing.querySelector('.wheel') : null;

    if (wheel) {
      const spokes = wheel.querySelector('.spokes');
      const IDLE = 9;            // putaran santai, derajat per detik
      const GEAR = 0.3;          // seberapa kuat kecepatan gulir memutar roda
      let angle = 0;
      let vel = 0;               // mulai diam, lalu "menyala" pelan ke kecepatan santai
      let last = 0;
      let lastY = window.scrollY;
      let raf = 0;
      let drag = null;

      const render = () => {
        wheel.setAttribute('transform', `rotate(${angle.toFixed(2)} 450 250)`);
        // Makin kencang, jari-jari makin samar (kesan buram akibat gerak)
        if (spokes) spokes.style.opacity = (1 - Math.min(0.5, Math.abs(vel) / 1500)).toFixed(2);
      };

      const frame = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const y = window.scrollY;
        const scrollSpeed = dt > 0 ? (y - lastY) / dt : 0;
        lastY = y;

        if (drag) {
          vel = drag.v;
        } else {
          const target = IDLE + clamp(scrollSpeed, -2500, 2500) * GEAR;
          vel += (target - vel) * (1 - Math.exp(-dt * 2.2)); // inersia
          angle += vel * dt;
        }
        render();
        raf = requestAnimationFrame(frame);
      };

      const startLoop = () => {
        if (raf) return;
        last = performance.now();
        lastY = window.scrollY;
        raf = requestAnimationFrame(frame);
      };
      const stopLoop = () => {
        cancelAnimationFrame(raf);
        raf = 0;
      };

      // Hanya berputar saat gambar roda terlihat (hemat baterai)
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => (e.isIntersecting ? startLoop() : stopLoop()), { rootMargin: '80px' }).observe(drawing);
      } else {
        startLoop();
      }

      // Seret roda seperti memutar roda sungguhan; dilepas, roda terus berputar lalu melambat
      const centerOf = () => {
        const r = wheel.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      };
      const angleTo = (e, c) => (Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180) / Math.PI;

      wheel.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const c = centerOf();
        drag = { id: e.pointerId, c, a: angleTo(e, c), t: performance.now(), v: 0 };
        wheel.setPointerCapture(e.pointerId);
        drawing.classList.add('is-dragging');
        e.preventDefault();
      });

      wheel.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const now = performance.now();
        const a = angleTo(e, drag.c);
        let d = a - drag.a;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        const dt = Math.max(1, now - drag.t) / 1000;
        angle += d;
        drag.v = clamp(drag.v * 0.55 + (d / dt) * 0.45, -1600, 1600);
        drag.a = a;
        drag.t = now;
      });

      const endDrag = (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        // Jika jari/kursor berhenti dulu sebelum dilepas, roda tidak dilempar
        vel = performance.now() - drag.t > 90 ? 0 : drag.v;
        drag = null;
        drawing.classList.remove('is-dragging');
      };
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => wheel.addEventListener(type, endDrag));
    }

    /* ---------- 5. Gulir: progres di penggaris, header, menu aktif, langkah kerja ---------- */
    const rulerTop = header ? header.querySelector('.ruler') : null;
    const stepsEl = document.querySelector('.steps');
    const stepEls = stepsEl ? [...stepsEl.querySelectorAll('.step')] : [];
    const stackMQ = window.matchMedia('(max-width: 900px)');

    const updateSteps = () => {
      if (!stepsEl || !stepEls.length) return;
      const vh = window.innerHeight;
      let p;
      if (stackMQ.matches) {
        // Susunan vertikal: garis terisi sampai heksagon yang sudah melewati garis pemicu
        const centers = stepEls.map((s) => {
          const r = s.querySelector('.step__num').getBoundingClientRect();
          return r.top + r.height / 2;
        });
        const y0 = centers[0];
        const y1 = centers[centers.length - 1];
        const trigger = vh * 0.62;
        p = clamp((trigger - y0) / (y1 - y0 || 1));
        stepsEl.style.setProperty('--line-h', `${y1 - y0}px`);
        stepEls.forEach((s, i) => s.classList.toggle('is-active', centers[i] <= trigger));
      } else {
        // Susunan mendatar: progres mengikuti posisi blok langkah di layar
        const r = stepsEl.getBoundingClientRect();
        p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.28));
        stepsEl.style.removeProperty('--line-h');
        const last = stepEls.length - 1;
        stepEls.forEach((s, i) => s.classList.toggle('is-active', p >= (i / last) * 0.94 + 0.04));
      }
      stepsEl.style.setProperty('--p', p.toFixed(4));
    };

    let ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      if (header) header.classList.toggle('is-stuck', y > 80);
      if (rulerTop) {
        const max = root.scrollHeight - window.innerHeight;
        rulerTop.style.setProperty('--scroll', max > 0 ? (y / max).toFixed(4) : '0');
      }
      updateSteps();
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    stackMQ.addEventListener('change', onScroll);
    update();

    // Menu ikut menandai bagian yang sedang dibaca
    const navLinks = [...document.querySelectorAll('.site-nav a')];
    if ('IntersectionObserver' in window && navLinks.length) {
      const spy = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (!e.isIntersecting) return;
            navLinks.forEach((a) => {
              const on = !!e.target.id && a.getAttribute('href') === `#${e.target.id}`;
              a.classList.toggle('is-current', on);
              if (on) a.setAttribute('aria-current', 'location');
              else a.removeAttribute('aria-current');
            });
          });
        },
        { rootMargin: '-45% 0px -50% 0px' }
      );
      document.querySelectorAll('.hero, .section[id]').forEach((el) => spy.observe(el));
    }

    /* ---------- 6. Interaksi kursor (hanya perangkat dengan mouse) ---------- */
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      // Tombol utama sedikit tertarik ke arah kursor
      document.querySelectorAll('.hero__actions .btn, .contact__actions .btn').forEach((btn) => {
        btn.addEventListener('pointermove', (e) => {
          const r = btn.getBoundingClientRect();
          const x = (e.clientX - (r.left + r.width / 2)) / r.width;
          const y = (e.clientY - (r.top + r.height / 2)) / r.height;
          btn.style.setProperty('--tx', `${(x * 12).toFixed(1)}px`);
          btn.style.setProperty('--ty', `${(y * 10).toFixed(1)}px`);
        });
        btn.addEventListener('pointerleave', () => {
          btn.style.removeProperty('--tx');
          btn.style.removeProperty('--ty');
        });
      });

      // Sorotan cahaya mengikuti kursor di kartu layanan
      const services = document.querySelector('.services');
      if (services) {
        services.addEventListener('pointermove', (e) => {
          const card = e.target.closest('.service');
          if (!card) return;
          const r = card.getBoundingClientRect();
          card.style.setProperty('--mx', `${e.clientX - r.left}px`);
          card.style.setProperty('--my', `${e.clientY - r.top}px`);
        });
      }
    }
  }
})();
