/* =========================================================
   80 ЖИЛИЙН ОЙ — Дурсамжийн сан
   Google Drive (зураг) + YouTube (бичлэг) → нэг цомог
   ========================================================= */
(() => {
'use strict';

const C   = window.CONFIG || {};
const $   = (s, r = document) => r.querySelector(s);
const $$  = (s, r = document) => [...r.querySelectorAll(s)];
const el  = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };

/* ---------------- Төлөв ---------------- */
const state = {
  photos: [],        // { id, title, category, w, h, src, full, open }
  videos: [],        // { id, title, desc, featured }
  view: [],          // шүүлтийн дараах зургууд
  cat: 'Бүгд',
  q: '',
  shown: 0,
  PAGE: 24,
  vAll: [], vView: [], vShown: 0, VPAGE: 9, vCat: 'Бүгд', vQ: '',
  lbIndex: -1,
  lbKind: 'photo',
  slideTimer: null,
  demo: false,
  demoVid: false
};

/* ---------------- Drive / YouTube URL үүсгэгч ---------------- */
const driveThumb = (id, w) => `https://drive.google.com/thumbnail?id=${id}&sz=w${w}`;
const driveOpen  = (id)    => `https://drive.google.com/file/d/${id}/view`;
/* mqdefault = 16:9 (hqdefault нь 4:3 тул босоо бичлэгт хар зураас их гардаг) */
const ytThumb    = (id)    => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
const ytThumbHi  = (id)    => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;

/* Drive заримдаа түр хязгаарладаг (олон хүн зэрэг үзвэл). Нэг удаа дахин оролдоно. */
function driveRetry(img, url, tries) {
  tries = tries || 0;
  img.onerror = () => {
    if (tries >= 2) { img.dataset.failed = '1'; img.dispatchEvent(new Event('givenup')); return; }
    setTimeout(() => driveRetry(img, url, tries + 1), 700 * (tries + 1));
  };
  img.src = url + (tries ? '&r=' + tries : '');
}

/* maxresdefault байхгүй бичлэгт YouTube алдаа биш, 120x90 саарал зураг буцаадаг.
   Тиймээс хэмжээгээр нь шалгаж, mqdefault руу шилжинэ. */
function setYtThumb(img, id) {
  const fall = () => {
    if (img.dataset.fb) return;
    img.dataset.fb = '1';
    img.src = ytThumb(id);
  };
  img.onload  = () => { if (img.naturalWidth <= 120) fall(); };
  img.onerror = fall;
  img.src = ytThumbHi(id);
}
const ytWatch    = (id)    => `https://www.youtube.com/watch?v=${id}`;
const ytEmbed    = (id)    => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;

/* Хавтасны ID-г бүтэн холбооосноос салгах (хэрэглэгч линк буулгасан бол) */
function cleanId(v) {
  if (!v) return '';
  v = String(v).trim();
  const m = v.match(/[-\w]{25,}/);
  return m ? m[0] : v;
}
function cleanYtId(v) {
  if (!v) return '';
  v = String(v).trim();
  const m = v.match(/(?:v=|be\/|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : v;
}

/* ---------------- Toast ---------------- */
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2400);
}

/* =========================================================
   1. ЕРӨНХИЙ МЭДЭЭЛЭЛ БАЙРЛУУЛАХ
   ========================================================= */
function fillSite() {
  const s = C.site || {};
  const yrs = s.years || 80;
  const full = [s.schoolName, s.soum].filter(Boolean).join(' · ');

  document.title = `${yrs} жилийн ой — ${s.schoolName || 'Дурсамжийн сан'}`;
  $('#brandName').textContent = s.schoolName || 'Сургуулийн ой';
  $('#brandSub').textContent  = s.soum || 'Дурсамжийн сан';
  $('#footName').textContent  = s.schoolName || 'Сургуулийн ой';
  $('#footNote').textContent  = s.heroNote || $('#footNote').textContent;
  $('#emblemNum').textContent = yrs;
  $('#badgeYears').textContent = `${yrs} ЖИЛ`;
  $$('.brand-mark').forEach(n => n.textContent = yrs);

  // Огноо — бүтэн огноо эсвэл зөвхөн он
  if (s.eventDate) {
    if (/^\d{4}$/.test(String(s.eventDate).trim())) {
      $('#badgeDate').textContent = `${s.eventDate} оны ойн баяр`;
    } else {
      const d = new Date(s.eventDate + 'T00:00:00');
      if (!isNaN(d)) {
        const MN = ['1 дүгээр','2 дугаар','3 дугаар','4 дүгээр','5 дугаар','6 дугаар',
                    '7 дугаар','8 дугаар','9 дүгээр','10 дугаар','11 дүгээр','12 дугаар'];
        $('#badgeDate').textContent = `${d.getFullYear()} оны ${MN[d.getMonth()]} сарын ${d.getDate()}`;
      }
    }
  }

  if (full) $('#heroLede').textContent =
    `${full} — ${yrs} жилийн ойн баярын өдрүүдэд буулгасан зураг, бичлэг бүрийг нэг дор. ` +
    `Бүх агуулга Google Drive болон YouTube дээрээ хадгалагдсан хэвээр.`;

  const founded = s.foundedYear;
  $('#footCopy').textContent =
    `© ${new Date().getFullYear()} ${s.schoolName || ''}${founded ? ` · ${founded} оноос` : ''} · Бүх эрх хуулиар хамгаалагдсан`;

  // Эх файл цуглуулах уриалга
  const cb = s.contribute;
  if (cb && cb.text) {
    const box = $('#contribute');
    box.hidden = false;
    let btn = '';
    if (s.contactEmail) {
      btn = `<a class="btn btn-primary" href="mailto:${s.contactEmail}?subject=${encodeURIComponent('80 жилийн ойн эх зураг')}">Эх файл илгээх</a>`;
    } else if (s.facebook) {
      btn = `<a class="btn btn-primary" href="${s.facebook}" target="_blank" rel="noopener">Холбоо барих</a>`;
    }
    box.innerHTML = `<div class="ct-body"><h3>${cb.title || 'Эх файл байгаа бол илгээнэ үү'}</h3><p>${cb.text}</p></div>${btn}`;
  }

  // Эх сурвалж ба зориулалт
  if (s.mediaCredit) $('#footCredit').textContent = s.mediaCredit;
  if (s.dedication) {
    const d = $('#dedication');
    d.hidden = false;
    d.innerHTML = `<p>${s.dedication}</p>` +
      (s.mediaCredit ? `<small>${s.mediaCredit}</small>` : '');
  }

  // Холбоосууд
  const mail = $('#footMail');
  if (s.contactEmail) mail.href = 'mailto:' + s.contactEmail; else mail.remove();
  const fb = $('#footFb');
  if (s.facebook) fb.href = s.facebook; else fb.remove();

  const fid = cleanId((C.drive || {}).folderId) || cleanId(((C.drive || {}).folders || [])[0]?.id);
  const dl = $('#driveLink');
  if (fid) dl.href = `https://drive.google.com/drive/folders/${fid}`;
  else { dl.textContent = 'Хавтас тохируулаагүй байна'; dl.removeAttribute('href'); dl.style.opacity = '.5'; }

  const yl = $('#ytLink');
  const yt = C.youtube || {};
  if (yt.playlistId) yl.href = `https://www.youtube.com/playlist?list=${yt.playlistId}`;
  else if (yt.channelUrl) { yl.href = yt.channelUrl; yl.firstChild.textContent = 'YouTube суваг нээх '; }
  else { yl.textContent = 'Суваг тохируулаагүй байна'; yl.removeAttribute('href'); yl.style.opacity = '.5'; }
}

/* =========================================================
   2. ОДТОЙ ТЭНГЭР (hero арын хэсэг)
   ========================================================= */
function stars() {
  const cv = $('#stars');
  if (!cv || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = cv.getContext('2d');
  let W, H, pts = [], raf;

  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.width  = cv.offsetWidth  * dpr;
    H = cv.height = cv.offsetHeight * dpr;
    const n = Math.min(120, Math.round(cv.offsetWidth * cv.offsetHeight / 14000));
    pts = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: (Math.random() * 1.5 + .4) * dpr,
      a: Math.random() * .6 + .15,
      s: Math.random() * .28 + .05,
      p: Math.random() * Math.PI * 2
    }));
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    const t = performance.now() / 1000;
    for (const p of pts) {
      p.y -= p.s; if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; }
      const tw = p.a * (.55 + .45 * Math.sin(t * 1.6 + p.p));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 7);
      ctx.fillStyle = `rgba(212,175,95,${tw})`;
      ctx.fill();
    }
    raf = requestAnimationFrame(loop);
  }

  size(); loop();
  addEventListener('resize', () => { cancelAnimationFrame(raf); size(); loop(); });
}

/* =========================================================
   3. UI — nav, theme, reveal, progress
   ========================================================= */
function ui() {
  // Theme
  const saved = localStorage.getItem('theme80');
  if (saved) document.documentElement.dataset.theme = saved;
  $('#themeBtn').onclick = () => {
    const cur = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = cur;
    localStorage.setItem('theme80', cur);
    $('meta[name=theme-color]').content = cur === 'light' ? '#fbf9f5' : '#0b0e14';
  };

  // Nav + progress
  const nav = $('#nav'), prog = $('#progress');
  const links = $$('#navLinks a');
  const onScroll = () => {
    nav.classList.toggle('stuck', scrollY > 40);
    const max = document.body.scrollHeight - innerHeight;
    prog.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + '%';
    let act = '';
    for (const sec of $$('section[id]')) {
      if (sec.getBoundingClientRect().top <= 140) act = sec.id;
    }
    links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + act));
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Гар утасны цэс
  const mm = $('#mobileMenu');
  $('#burger').onclick = () => { mm.classList.toggle('open'); document.body.classList.toggle('no-scroll', mm.classList.contains('open')); };
  $$('#mobileMenu a').forEach(a => a.onclick = () => { mm.classList.remove('open'); document.body.classList.remove('no-scroll'); });

  // Reveal
  window.revealer = new IntersectionObserver((es, o) => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); o.unobserve(e.target); } });
  }, { threshold: .12, rootMargin: '0px 0px -40px' });
  $$('.rv, .tl-item, .src-card').forEach(n => window.revealer.observe(n));

  // Слайд шоу товч
  $('#slideBtn').onclick = () => {
    if (!state.view.length) return toast('Эхлээд зураг нэмнэ үү');
    openLightbox(0); startSlideshow();
  };
}

/* =========================================================
   4. ТООН ҮЗҮҮЛЭЛТ
   ========================================================= */
function statsBlock() {
  const g = $('#statsGrid');
  const items = (C.stats || []).slice();
  if (!items.length) return;
  items.forEach(s => {
    const n = el('div', 'stat rv', `<div class="stat-v" data-to="${s.value}">0${s.suffix || ''}</div><div class="stat-l">${s.label}</div>`);
    g.appendChild(n);
  });

  const io = new IntersectionObserver((es, o) => es.forEach(e => {
    if (!e.isIntersecting) return;
    o.unobserve(e.target);
    e.target.classList.add('in');
    const v = $('.stat-v', e.target);
    const to = +v.dataset.to, suf = (items.find(i => i.value === to) || {}).suffix || '';
    const t0 = performance.now(), dur = 1500;
    const final = () => { v.textContent = to.toLocaleString('mn-MN') + suf; };
    (function tick(t) {
      const p = Math.min((t - t0) / dur, 1);
      const e2 = 1 - Math.pow(1 - p, 3);
      v.textContent = Math.round(to * e2).toLocaleString('mn-MN') + suf;
      if (p < 1) requestAnimationFrame(tick); else final();
    })(t0);
    // Таб нуугдвал rAF зогсдог — эцсийн утгыг баталгаажуулна
    setTimeout(final, dur + 200);
  }), { threshold: .4 });
  $$('.stat', g).forEach(n => io.observe(n));
}

/* =========================================================
   5. ТҮҮХ + ИШЛЭЛ
   ========================================================= */
function historyBlock() {
  const tl = $('#timeline');
  (C.timeline || []).forEach(t => {
    tl.appendChild(el('div', 'tl-item',
      `<div class="tl-year">${t.year}</div><h3>${t.title}</h3><p>${t.text}</p>`));
  });
  const q = $('#quotes');
  const quotes = C.quotes || [];
  quotes.forEach(x => {
    q.appendChild(el('div', 'quote-card rv', `<p>${x.text}</p><cite>— ${x.author}</cite>`));
  });
  // Ишлэл байхгүй бол багана нь хоосон зай үлдээхгүйгээр замналыг бүтэн өргөнөөр
  if (!quotes.length) {
    q.remove();
    const g = $('.hist-grid');
    if (g) g.style.gridTemplateColumns = '1fr';
  }
  $$('.tl-item, .quote-card').forEach(n => window.revealer.observe(n));
}

/* =========================================================
   6. ЗУРАГ АЧААЛАХ  (Drive API → эсвэл гарын жагсаалт → эсвэл жишээ)
   ========================================================= */
async function loadPhotos() {
  const d = C.drive || {};
  const out = [];

  // (a) Гараар нэмсэн зургууд
  (C.photos || []).forEach(p => {
    const id = cleanId(p.id);
    if (!id) return;
    out.push(mkPhoto(id, p.title || 'Ойн дурсамж', p.category || 'Бусад', p.w, p.h));
  });

  // (b) Drive хавтас(ууд) — API түлхүүртэй бол автоматаар
  const folders = [];
  if (d.folderId) folders.push({ id: cleanId(d.folderId), label: '' });
  (d.folders || []).forEach(f => f && f.id && folders.push({ id: cleanId(f.id), label: f.label || '' }));

  if (d.apiKey && folders.length) {
    for (const f of folders) {
      try {
        const files = await driveList(f.id, d.apiKey);
        files.forEach(fl => {
          const meta = fl.imageMediaMetadata || {};
          out.push(mkPhoto(fl.id, prettyName(fl.name), f.label || deriveCategory(fl.name), meta.width, meta.height, fl.createdTime));
        });
      } catch (e) {
        console.warn('Drive хавтас уншиж чадсангүй:', f.id, e.message);
        toast('Drive хавтас уншиж чадсангүй — хуваалцах тохиргоог шалгана уу');
      }
    }
  }

  // (c) Юу ч тохируулаагүй бол — жишээ горим
  if (!out.length) {
    state.demo = true;
    return demoPhotos();
  }
  return out;
}

function mkPhoto(id, title, category, w, h, date) {
  return {
    id, title, category: category || 'Бусад',
    w: w || 4, h: h || 3, date: date || '',
    small: driveThumb(id, 220),   // филмстрипт
    src:   driveThumb(id, 800),   // цомгийн хавтан
    full:  driveThumb(id, 2000),  // томруулсан харагдац
    open:  driveOpen(id)
  };
}

async function driveList(folderId, apiKey) {
  const files = [];
  let token = '';
  do {
    const q = `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`;
    const url = 'https://www.googleapis.com/drive/v3/files'
      + `?q=${encodeURIComponent(q)}`
      + `&key=${encodeURIComponent(apiKey)}`
      + '&fields=nextPageToken,files(id,name,createdTime,imageMediaMetadata(width,height))'
      + '&pageSize=1000&orderBy=name'
      + (token ? `&pageToken=${token}` : '');
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    files.push(...(j.files || []));
    token = j.nextPageToken || '';
  } while (token);
  return files;
}

/* "01_Ёслол_нээлт.jpg" → "Ёслол нээлт" ; ангиллыг нэрнээс таана */
function prettyName(name = '') {
  let n = name.replace(/\.[a-z0-9]+$/i, '').replace(/^[\d\s._-]+/, '');
  const parts = n.split(/\s*[-—–]\s*/);
  if (parts.length > 1) n = parts.slice(1).join(' - ');
  n = n.replace(/[_]+/g, ' ').trim();
  return n || 'Ойн дурсамж';
}
function deriveCategory(name = '') {
  const parts = name.replace(/\.[a-z0-9]+$/i, '').split(/\s*[-—–]\s*/);
  if (parts.length > 1) {
    const c = parts[0].replace(/^[\d\s._]+/, '').replace(/[_]+/g, ' ').trim();
    if (c && c.length <= 24) return c;
  }
  return 'Бусад';
}

/* Жишээ зургууд — сүлжээ шаардахгүй, SVG-ээр үүсгэнэ */
function demoPhotos() {
  const cats = ['Ёслол', 'Урлаг', 'Уулзалт', 'Спорт', 'Багш нар'];
  const names = [
    'Ойн ёслолын нээлт', 'Туг мандуулах ёслол', 'Ахмад багш нарын хүндэтгэл',
    'Төгсөгчдийн уулзалт', 'Урлагийн тоглолт', 'Бүжгийн чуулга', 'Хүндэт зочид',
    'Сурагчдын жагсаал', 'Дурсгалын гэрэл зураг', 'Спортын тэмцээн', 'Шагнал гардуулах',
    'Сургуулийн найрал дуу', 'Ангийнхны уулзалт', 'Сумын удирдлагууд', 'Гал голомтын ёслол',
    'Түүхэн үзэсгэлэн', 'Оюутан төгсөгчид', 'Багш нарын хүндэтгэлийн зоог'
  ];
  const pal = [['#2b2f45','#d4af5f'], ['#3a2c22','#e6c07a'], ['#22303a','#7fb2d8'],
               ['#33253a','#c99ad8'], ['#243328','#8fc79a'], ['#3a2430','#e08fa4']];
  return names.map((t, i) => {
    const [bg, fg] = pal[i % pal.length];
    const w = 1200, h = [800, 900, 700, 1500][i % 4];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="#0b0e14"/></linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <circle cx="${w * .78}" cy="${h * .26}" r="${h * .16}" fill="${fg}" opacity=".18"/>
      <text x="50%" y="48%" text-anchor="middle" fill="${fg}" opacity=".85"
        font-family="Georgia,serif" font-size="${Math.round(w / 11)}" font-weight="700">80</text>
      <text x="50%" y="58%" text-anchor="middle" fill="#fff" opacity=".55"
        font-family="Helvetica,Arial" font-size="${Math.round(w / 28)}">${t}</text></svg>`;
    const uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return { id: 'demo' + i, title: t, category: cats[i % cats.length], w, h, date: '',
             src: uri, full: uri, open: '' };
  });
}

/* =========================================================
   7. ЗУРГИЙН ЦОМОГ РЕНДЕР
   ========================================================= */
function buildChips() {
  const box = $('#chips');
  box.innerHTML = '';
  const counts = { 'Бүгд': state.photos.length };
  state.photos.forEach(p => counts[p.category] = (counts[p.category] || 0) + 1);

  Object.keys(counts).forEach(k => {
    if (k !== 'Бүгд' && counts[k] === 0) return;
    const b = el('button', 'chip' + (k === state.cat ? ' on' : ''), `${k}<span class="n">${counts[k]}</span>`);
    b.onclick = () => { state.cat = k; buildChips(); applyFilter(); };
    box.appendChild(b);
  });
  // Ангилал байхгүй (бүгд "Бусад") бол чипс нуух
  const uniq = new Set(state.photos.map(p => p.category));
  box.style.display = uniq.size <= 1 ? 'none' : '';
}

function applyFilter() {
  const q = state.q.trim().toLowerCase();
  state.view = state.photos.filter(p =>
    (state.cat === 'Бүгд' || p.category === state.cat) &&
    (!q || (p.title + ' ' + p.category).toLowerCase().includes(q))
  );
  state.shown = 0;
  $('#masonry').innerHTML = '';
  renderMore();

  const st = $('#galState');
  st.innerHTML = '';
  if (!state.view.length) {
    st.appendChild(el('div', 'empty', q || state.cat !== 'Бүгд'
      ? '<b>Илэрц олдсонгүй</b>Өөр түлхүүр үг эсвэл ангиллаар хайж үзнэ үү.'
      : '<b>Зураг хараахан нэмээгүй байна</b>' +
        '<code>assets/js/data.js</code> файлын <code>drive.folderId</code> болон <code>drive.apiKey</code>-г бөглөнө үү.'));
  }
}

function renderMore() {
  const m = $('#masonry');
  const next = state.view.slice(state.shown, state.shown + state.PAGE);
  next.forEach((p, i) => {
    const t = tile(p, state.shown + i);
    m.appendChild(t);
    const im = $('img', t);
    if (im) driveRetry(im, p.src);   // DOM-д орсны дараа → lazy зөв ажиллана
  });
  state.shown += next.length;
  const w = $('#moreWrap');
  w.hidden = state.shown >= state.view.length;
  $('#moreBtn').textContent = `Илүү ихийг үзэх (${state.view.length - state.shown})`;
}

function tile(p, idx) {
  const t = el('div', 'tile');
  t.style.setProperty('--ar', `${p.w}/${p.h}`);

  const ph = el('div', 'tile-ph');
  ph.style.aspectRatio = `${p.w}/${p.h}`;
  t.appendChild(ph);

  const img = new Image();
  img.loading = 'lazy'; img.decoding = 'async';
  img.alt = p.title;
  img.style.opacity = '0';
  img.style.transition = 'opacity .55s ease';
  img.onload = () => { ph.remove(); img.style.opacity = '1'; };
  img.addEventListener('givenup', () => {
    ph.style.animation = 'none'; ph.style.opacity = '.3';
    ph.style.display = 'grid'; ph.style.placeItems = 'center';
    ph.innerHTML = '<span style="font-size:11px;color:var(--text-3)">ачаалагдсангүй</span>';
    img.remove();
  });
  t.appendChild(img);   // src нь DOM-д орсны дараа (renderMore) — lazy зөв ажиллахын тулд

  t.appendChild(el('div', 'tile-ov',
    `<small>${p.category}</small><b>${p.title}</b>`));

  t.onclick = () => openLightbox(idx);
  t.style.transitionDelay = ((idx % state.PAGE) % 8) * 55 + 'ms';
  if (window.revealer) window.revealer.observe(t);
  else t.classList.add('in');
  return t;
}

/* =========================================================
   8. БИЧЛЭГҮҮД
   ========================================================= */
async function loadVideos() {
  const y = C.youtube || {};
  const out = (C.videos || [])
    .map(v => ({
      id: cleanYtId(v.id), title: v.title || 'Бичлэг', desc: v.desc || '',
      category: v.category || deriveVideoCategory(v.title || ''), featured: !!v.featured
    }))
    .filter(v => v.id);

  if (y.apiKey && y.playlistId) {
    try {
      let token = '', guard = 0;
      do {
        const url = 'https://www.googleapis.com/youtube/v3/playlistItems'
          + '?part=snippet&maxResults=50'
          + `&playlistId=${encodeURIComponent(y.playlistId)}`
          + `&key=${encodeURIComponent(y.apiKey)}`
          + (token ? `&pageToken=${token}` : '');
        const r = await fetch(url);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        (j.items || []).forEach(it => {
          const sn = it.snippet || {};
          const vid = sn.resourceId && sn.resourceId.videoId;
          if (!vid || out.some(v => v.id === vid)) return;
          if (/^(Private|Deleted) video$/i.test(sn.title || '')) return;
          const title = tidyVideoTitle(sn.title || 'Бичлэг');
          out.push({
            id: vid, title, category: deriveVideoCategory(sn.title || ''),
            desc: (sn.description || '').split('\n')[0].slice(0, 110), featured: false
          });
        });
        token = j.nextPageToken || '';
      } while (token && ++guard < 10);
    } catch (e) {
      console.warn('YouTube жагсаалт уншиж чадсангүй:', e.message);
    }
  }

  if (!out.length) { state.demoVid = true; return demoVideos(); }
  return out;
}

/* YouTube-ээс автоматаар ирсэн бичлэгийн гарчгаас давтагдах угтварыг хасах.
   "СУРГУУЛИЙН ТҮҮХТ 80 ЖИЛИЙН ОЙН БАЯРЫН ТОГЛОЛТ4" → "ТОГЛОЛТ 4" */
function tidyVideoTitle(t) {
  const pre = [
    'СУРГУУЛИЙН ТҮҮХТ 80 ЖИЛИЙН ОЙН БАЯР НААДМЫН ',
    'СУРГУУЛИЙН ТҮҮХТ 80 ЖИЛИЙН ОЙН БАЯР НААДАМ ',
    'СУРГУУЛИЙН ТҮҮХТ 80 ЖИЛИЙН ОЙН БАЯРЫН ',
    'СУРГУУЛИЙН ТҮҮХТ 80 ЖИЛИЙН ОЙН ',
    'СУРГУУЛИЙН ТҮҮХТ 80 ЖИЛИЙН ОЙ '
  ];
  let s = String(t).trim();
  for (const p of pre) {
    if (s.toUpperCase().startsWith(p)) { s = s.slice(p.length).trim(); break; }
  }
  return s.replace(/([^\s\d])(\d+)$/, '$1 $2') || String(t);
}

/* Гарчгаас ангиллыг таах — шинээр нэмэгдсэн бичлэг ч өөрөө ангилалдаа орно */
function deriveVideoCategory(title) {
  const u = String(title).toUpperCase();
  if (u.includes('МЭНД ДЭВШҮҮЛЬЕ')) return 'Мэндчилгээ';
  if (u.includes('ТОГЛОЛТ')) return 'Урлагийн тоглолт';
  if (u.includes('БӨХ') || u.includes('БАРИЛДААН') || u.includes('НАЧИН')) return 'Бөхийн барилдаан';
  if (u.includes('НЭЭЛТ') || u.includes('ХУРАЛ') || u.includes('NEELT') ||
      u.includes('BUGATSUM') || u.includes('ЖАСРАЙН')) return 'Ёслол, нээлт';
  if (u.includes('МОРЬ') || u.includes('АЗАРГА') || u.includes('ИХ НАС') || u.includes('СОЁОЛОН') ||
      u.includes('ДААГА') || u.includes('ШҮДЛЭН') || u.includes('ХЯЗААЛАН') ||
      u.includes('MORI')) return 'Морин уралдаан';
  return 'Бусад';
}

/* Жишээ бичлэгүүд — зөвхөн дизайныг харуулах зорилготой */
function demoVideos() {
  const list = [
    { t: 'Ойн баярын нэгдсэн бичлэг', d: 'Ёслолын ажиллагааны бүрэн хувилбар', f: true },
    { t: 'Урлагийн тоглолт',          d: 'Сурагчид, төгсөгчдийн үзүүлбэр' },
    { t: 'Ахмад багш нарын дурсамж',  d: 'Ярилцлагын цуврал' },
    { t: 'Сургуулийн 80 жилийн түүх', d: 'Баримтат богино кино' }
  ];
  return list.map((v, i) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1c2130"/><stop offset="1" stop-color="#0b0e14"/></linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <circle cx="1010" cy="200" r="150" fill="#d4af5f" opacity=".12"/>
      <text x="50%" y="46%" text-anchor="middle" fill="#d4af5f" opacity=".8"
        font-family="Georgia,serif" font-size="130" font-weight="700">80</text>
      <text x="50%" y="58%" text-anchor="middle" fill="#ffffff" opacity=".5"
        font-family="Helvetica,Arial" font-size="42">${v.t}</text></svg>`;
    return {
      id: 'demo' + i, title: v.t, desc: v.d, featured: !!v.f, demo: true,
      thumb: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    };
  });
}

function renderVideos() {
  const box = $('#videoWrap');
  box.innerHTML = '';

  if (!state.videos.length) {
    box.appendChild(el('div', 'empty',
      '<b>Бичлэг хараахан нэмээгүй байна</b>' +
      '<code>assets/js/data.js</code> файлын <code>videos</code> жагсаалтад YouTube ID-г нэмэх, ' +
      'эсвэл <code>youtube.playlistId</code> + <code>apiKey</code>-г бөглөнө үү.'));
    return;
  }

  const list = state.videos.slice();
  const heroIdx = Math.max(0, list.findIndex(v => v.featured));
  const hero = list.splice(heroIdx, 1)[0];

  // Онцлох бичлэг
  const h = el('div', 'vid-hero');
  const hi = new Image();
  hi.alt = hero.title;
  if (hero.thumb) hi.src = hero.thumb; else setYtThumb(hi, hero.id);
  h.appendChild(hi);
  h.appendChild(el('div', 'play', '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>'));
  h.appendChild(el('div', 'vid-hero-body', `<h3>${hero.title}</h3><p>${hero.desc || 'Ойн баярын бичлэг'}</p>`));
  h.onclick = () => openVideo(hero);
  box.appendChild(h);

  if (!list.length) return;
  state.vAll = list;

  // Олон бичлэгтэй үед — ангилал + хайлт
  if (list.length > 10) {
    const bar = el('div', 'gal-bar');
    bar.style.margin = '34px 0 22px';
    bar.appendChild(el('div', 'chips vchips'));

    const tools = el('div', 'gal-tools');
    const cnt = el('div', 'vcount', '');
    cnt.style.cssText = 'color:var(--text-3);font-size:13.5px;white-space:nowrap';
    tools.appendChild(cnt);

    const s = el('label', 'search',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">' +
      '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>' +
      '<input type="search" placeholder="Бичлэг хайх…" aria-label="Бичлэг хайх">');
    let t;
    $('input', s).addEventListener('input', e => {
      clearTimeout(t);
      state.vQ = e.target.value;
      t = setTimeout(filterVideos, 180);
    });
    tools.appendChild(s);
    bar.appendChild(tools);
    box.appendChild(bar);
    buildVideoChips();
  }

  box.appendChild(el('div', 'vgrid'));
  const mw = el('div', 'more-wrap');
  const mb = el('button', 'btn', 'Илүү ихийг үзэх');
  mb.onclick = () => renderVideoPage();
  mw.appendChild(mb);
  box.appendChild(mw);

  filterVideos();
}

function buildVideoChips() {
  const box = $('.vchips', $('#videoWrap'));
  if (!box) return;
  box.innerHTML = '';
  const counts = { 'Бүгд': state.vAll.length };
  state.vAll.forEach(v => {
    const c = v.category || 'Бусад';
    counts[c] = (counts[c] || 0) + 1;
  });
  if (Object.keys(counts).length <= 2) { box.style.display = 'none'; return; }

  Object.keys(counts).forEach(k => {
    const b = el('button', 'chip' + (k === state.vCat ? ' on' : ''), `${k}<span class="n">${counts[k]}</span>`);
    b.onclick = () => { state.vCat = k; buildVideoChips(); filterVideos(); };
    box.appendChild(b);
  });
}

function videoCard(v) {
  const c = el('div', 'vcard');
  const th = el('div', 'vthumb');
  const im = new Image();
  im.alt = v.title; im.loading = 'lazy'; im.decoding = 'async';
  th.appendChild(im);   // src нь DOM-д орсны дараа (renderVideoPage)
  th.appendChild(el('div', 'play', '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>'));
  c.appendChild(th);
  const meta = [v.category, v.desc].filter(Boolean).join(' · ') || 'YouTube дээр үзэх';
  c.appendChild(el('div', 'vbody', `<h4>${v.title}</h4><p>${meta}</p>`));
  c.onclick = () => openVideo(v);
  if (window.revealer) window.revealer.observe(c); else c.classList.add('in');
  return c;
}

function filterVideos() {
  const q = (state.vQ || '').trim().toLowerCase();
  state.vView = state.vAll.filter(v =>
    (state.vCat === 'Бүгд' || (v.category || 'Бусад') === state.vCat) &&
    (!q || (v.title + ' ' + (v.category || '') + ' ' + (v.desc || '')).toLowerCase().includes(q))
  );
  state.vShown = 0;
  const g = $('.vgrid', $('#videoWrap'));
  if (g) g.innerHTML = '';
  renderVideoPage();
}

function renderVideoPage() {
  const box = $('#videoWrap');
  const g = $('.vgrid', box);
  if (!g) return;
  const next = state.vView.slice(state.vShown, state.vShown + state.VPAGE);
  next.forEach((v, i) => {
    const c = videoCard(v);
    c.style.transitionDelay = (i % 6) * 55 + 'ms';
    g.appendChild(c);
    const im = $('img', c);
    if (v.thumb) im.src = v.thumb; else setYtThumb(im, v.id);
  });
  state.vShown += next.length;

  const left = state.vView.length - state.vShown;
  const mw = $('.more-wrap', box);
  if (mw) {
    mw.hidden = left <= 0;
    $('.btn', mw).textContent = `Илүү ихийг үзэх (${left})`;
  }
  const cnt = $('.vcount', box);
  if (cnt) cnt.textContent = state.vView.length
    ? `${state.vView.length} бичлэг · ${state.vShown} харагдаж байна`
    : 'Илэрц олдсонгүй';
}

/* =========================================================
   9. LIGHTBOX
   ========================================================= */
const lb = {
  root:  null, stage: null, media: null, title: null, sub: null,
  film:  null, openA: null
};

function clearStage() { $$('img, iframe, .lb-load', lb.stage).forEach(n => n.remove()); }

function initLightbox() {
  lb.root  = $('#lb');   lb.stage = $('#lbStage'); lb.media = $('#lbMedia');
  lb.title = $('#lbTitle'); lb.sub = $('#lbSub');
  lb.film  = $('#lbFilm');  lb.openA = $('#lbOpen');

  $('#lbClose').onclick = closeLightbox;
  $('#lbPrev').onclick  = e => { e.stopPropagation(); step(-1); };
  $('#lbNext').onclick  = e => { e.stopPropagation(); step(1); };
  $('#lbPlay').onclick  = e => { e.stopPropagation(); toggleSlideshow(); };
  $('#lbShare').onclick = e => { e.stopPropagation(); share(); };

  lb.root.addEventListener('click', e => {
    if (e.target === lb.root || e.target === lb.stage || e.target === lb.media) closeLightbox();
  });

  addEventListener('keydown', e => {
    if (!lb.root.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === ' ') { e.preventDefault(); toggleSlideshow(); }
  });

  // Хуруугаар шудрах
  let x0 = null, y0 = null;
  lb.stage.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  lb.stage.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
    x0 = null;
  }, { passive: true });
}

function openLightbox(i) {
  state.lbKind = 'photo';
  state.lbIndex = i;
  lb.root.classList.add('open');
  document.body.classList.add('no-scroll');
  buildFilm();
  showPhoto();
}

function showPhoto() {
  const p = state.view[state.lbIndex];
  if (!p) return;

  $$('.lb-nav', lb.root).forEach(n => n.style.display = state.view.length > 1 ? '' : 'none');
  lb.film.style.display = state.view.length > 1 ? '' : 'none';

  // Зураг
  clearStage();
  const load = el('div', 'lb-load');
  lb.stage.appendChild(load);

  const img = new Image();
  img.alt = p.title;
  img.onload = () => load.remove();
  img.addEventListener('givenup', () => {
    load.remove();
    toast('Зураг ачаалагдсангүй — дахин оролдоно уу');
  });
  lb.media.appendChild(img);
  driveRetry(img, p.full);

  lb.title.textContent = p.title;
  lb.sub.textContent = `${p.category} · ${state.lbIndex + 1} / ${state.view.length}`;
  if (p.open) { lb.openA.href = p.open; lb.openA.style.display = ''; }
  else lb.openA.style.display = 'none';

  // Филмстрип идэвхжүүлэх
  $$('img', lb.film).forEach((n, i) => {
    n.classList.toggle('on', i === state.lbIndex);
    if (i === state.lbIndex) n.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  });

  if (!state.demo) history.replaceState(null, '', '#p=' + encodeURIComponent(state.view[state.lbIndex].id));
}

function buildFilm() {
  // Зөвхөн шүүлт өөрчлөгдсөн үед дахин барина (617 зурагт чухал)
  const key = `${state.cat}|${state.q}|${state.view.length}`;
  if (lb.film.dataset.key === key && lb.film.childElementCount) return;
  lb.film.dataset.key = key;
  lb.film.innerHTML = '';
  state.view.forEach((p, i) => {
    const im = new Image();
    im.alt = p.title; im.loading = 'lazy'; im.decoding = 'async';
    im.onclick = e => { e.stopPropagation(); state.lbIndex = i; showPhoto(); };
    lb.film.appendChild(im);
    im.src = p.small || p.src;   // DOM-д орсны дараа → lazy зөв ажиллана
  });
}

function step(d) {
  if (state.lbKind !== 'photo' || !state.view.length) return;
  state.lbIndex = (state.lbIndex + d + state.view.length) % state.view.length;
  showPhoto();
}

function openVideo(v) {
  if (v.demo) return toast('Жишээ бичлэг — data.js-д өөрийн YouTube ID-гаа нэмнэ үү');
  state.lbKind = 'video';
  stopSlideshow();
  lb.root.classList.add('open');
  document.body.classList.add('no-scroll');
  clearStage();
  $$('.lb-nav', lb.root).forEach(n => n.style.display = 'none');
  lb.film.style.display = 'none';

  const f = document.createElement('iframe');
  f.src = ytEmbed(v.id);
  f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
  f.allowFullscreen = true;
  f.title = v.title;
  lb.media.appendChild(f);

  lb.title.textContent = v.title;
  lb.sub.textContent = v.desc || 'YouTube бичлэг';
  lb.openA.href = ytWatch(v.id);
  lb.openA.style.display = '';
}

function closeLightbox() {
  stopSlideshow();
  lb.root.classList.remove('open');
  document.body.classList.remove('no-scroll');
  setTimeout(clearStage, 300);
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}

/* Слайд шоу */
function startSlideshow() {
  stopSlideshow();
  state.slideTimer = setInterval(() => step(1), 3800);
  $('#lbPlay').innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="5.5" width="3.4" height="13" rx="1"/><rect x="13.6" y="5.5" width="3.4" height="13" rx="1"/></svg>';
  toast('Слайд шоу эхэллээ');
}
function stopSlideshow() {
  if (state.slideTimer) clearInterval(state.slideTimer);
  state.slideTimer = null;
  const b = $('#lbPlay');
  if (b) b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M8 5.5v13l10-6.5-10-6.5z"/></svg>';
}
function toggleSlideshow() { state.slideTimer ? (stopSlideshow(), toast('Зогслоо')) : startSlideshow(); }

function share() {
  const url = location.href;
  const done = () => toast('Холбоос хуулагдлаа');
  if (navigator.share && matchMedia('(max-width: 820px)').matches) {
    navigator.share({ title: lb.title.textContent, url }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(done).catch(() => toast(url));
  } else toast(url);
}

/* Жишээ горимын мэдэгдэл */
function demoBanner(html) {
  const b = el('div', 'empty');
  b.style.cssText = 'margin-bottom:26px;text-align:left;border-style:solid;' +
    'border-color:var(--gold-dim);background:var(--gold-dim);padding:18px 22px';
  b.innerHTML = '<b style="margin-bottom:4px">Жишээ горим</b>' +
    `<span style="color:var(--text-2);font-size:14.5px">${html} Заавар: <code>README.md</code></span>`;
  return b;
}

/* =========================================================
   10. ЭХЛЭЛ
   ========================================================= */
async function init() {
  fillSite();
  ui();
  stars();
  statsBlock();
  historyBlock();
  initLightbox();

  // Хайлт + ангилал
  let qT;
  $('#search').addEventListener('input', e => {
    clearTimeout(qT);
    qT = setTimeout(() => { state.q = e.target.value; applyFilter(); }, 180);
  });
  $('#moreBtn').onclick = renderMore;

  // Өгөгдөл
  const [photos, videos] = await Promise.all([loadPhotos(), loadVideos()]);
  state.photos = photos;
  state.videos = videos;

  buildChips();
  applyFilter();
  renderVideos();

  // Тоон үзүүлэлт дэх "зураг / бичлэг"-ийн тоог бодит тоогоор шинэчлэх
  if (!state.demo) {
    $$('.stat').forEach(n => {
      const lab = $('.stat-l', n).textContent;
      let real = null;
      if (/зураг/i.test(lab)) real = state.photos.length;
      if (/бичлэг/i.test(lab)) real = state.videos.length;
      if (real == null || !real) return;
      const v = $('.stat-v', n);
      v.dataset.to = real;
      if (n.classList.contains('in')) v.textContent = real.toLocaleString('mn-MN');
    });
  }

  if (state.demo)
    $('#masonry').before(demoBanner('Одоогоор жишээ зургууд харагдаж байна. <code>assets/js/data.js</code> файлын ' +
      '<code>drive.folderId</code> + <code>drive.apiKey</code>-г бөглөмөгц Drive дэх бодит зургууд автоматаар орж ирнэ.'));

  if (state.demoVid)
    $('#videoWrap').before(demoBanner('Одоогоор жишээ бичлэгүүд харагдаж байна. <code>data.js</code>-ийн ' +
      '<code>videos</code> жагсаалтад YouTube ID нэмэх, эсвэл <code>youtube.playlistId</code>-г бөглөнө үү.'));

  // Deep link: #p=ЗУРГИЙН_ID
  const m = location.hash.match(/#p=(.+)/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    const i = state.view.findIndex(p => p.id === id);
    if (i >= 0) setTimeout(() => openLightbox(i), 400);
  }
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();

})();
