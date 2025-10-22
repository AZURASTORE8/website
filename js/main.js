// Dropdown toggle
document.addEventListener('click', (e)=>{
  const toggle = document.getElementById('profileToggle');
  const menu = document.getElementById('profileMenu');
  if(!toggle || !menu) return;
  if(toggle.contains(e.target)){
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  } else if(!menu.contains(e.target)){
    menu.style.display = 'none';
  }
});



// Populate Discord profile if available
document.addEventListener('DOMContentLoaded', () => {
  // Load public config (e.g., TrueWallet phone)
  window.publicConfig = { twPhone: '' };
  (async () => {
    try{
      const r = await fetch('/config');
      const j = await r.json();
      if(r.ok && j && j.success){ window.publicConfig = j; }
    }catch{}
  })();
  try{
    try{
      const m = document.cookie.match(/(?:^|; )discordUser=([^;]+)/);
      const v = m && m[1] ? decodeURIComponent(m[1]) : '';
      if(v && !localStorage.getItem('discordUser')){ localStorage.setItem('discordUser', v); }
    }catch{}
    const data = localStorage.getItem('discordUser');
    const loginLink = document.querySelector('.login-link');
    const account = document.querySelector('.account');
    if(!loginLink && !account) return;

    if(data){
      const user = JSON.parse(data);
      const nameEl = document.querySelector('.account .name');
      const avatarEl = document.querySelector('.account .avatar');
      if(nameEl) nameEl.textContent = user.username || 'USER';
      if(avatarEl){
        const av = user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
          : 'https://cdn.discordapp.com/embed/avatars/0.png';
        avatarEl.src = av;
      }
    // (removed) stray global admClearAll handler; button lives inside renderAdmin()
      if(account) account.style.display = 'flex';
      if(loginLink) loginLink.style.display = 'none';
      document.body.classList.add('authed');
      try{
        (async()=>{
          try{
            await fetch('/users/register', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ id: user.id, username: user.username, discriminator: user.discriminator, avatar: user.avatar }) });
          }catch{}
        })();
      }catch{}
      // If on index.html and already logged in, skip to main.html
      try{
        const currentPath = (location.pathname.split('/').pop() || '').toLowerCase();
        if(currentPath === '' || currentPath === 'index.html'){
          window.location.replace('./main.html');
          return; // prevent further init on this page
        }
      }catch{}
      // If admin, add Admin menu entry
      try{
        const menu = document.getElementById('profileMenu');
        if(menu){
          const ensureAdminLink = () => {
            let a = Array.from(menu.querySelectorAll('a')).find(x=>x.textContent.includes('หลังบ้าน'));
            if(!a){
              a = document.createElement('a');
              a.href = '#';
              a.textContent = 'หลังบ้าน';
              // insert after โปรไฟล์
              const first = menu.querySelector('a');
              if(first && first.nextSibling){ menu.insertBefore(a, first.nextSibling); } else { menu.appendChild(a); }
            }
            return a;
          };
    // Fallback reader: load snapshot from config.txt written by server
    const getSnapshotFromConfig = async () => {
      try{
        const r = await fetch('/config.txt?_=' + Date.now(), { cache:'no-store' });
        const text = await r.text();
        try{ return JSON.parse(text); }catch{ return null; }
      }catch{ return null; }
    };
          (async()=>{
            try{
              const r = await fetch(`/admin/check?userId=${encodeURIComponent(user.id)}`);
              const j = await r.json().catch(()=>({success:false}));
              if(r.ok && j && j.success && j.isAdmin){ ensureAdminLink(); }
            }catch{}
          })();
        }
      }catch{}
      // Show points badge next to account (also on index.html)
      try{
        const ensurePoint = () => {
          let p = document.querySelector('.account .point');
          if(!p){
            p = document.createElement('span');
            p.className = 'point';
            const anchor = document.querySelector('.account .profile') || document.querySelector('.account .login-link') || document.querySelector('.account');
            anchor.parentNode.insertBefore(p, anchor);
          }
          return p;
        };
        const updatePoints = async () => {
          try{
            const res = await fetch(`/points?userId=${encodeURIComponent(JSON.parse(data).id)}`);
            const json = await res.json().catch(()=>({ success:false }));
            if(res.ok && json && json.success){
              const p = ensurePoint();
              p.textContent = `POINT: ${json.balance}`;
            }
          }catch{}
        };
        updatePoints();
        // Update on focus return
        window.addEventListener('focus', updatePoints);
      }catch{}
    } else {
      if(account) account.style.display = 'none';
      if(loginLink) loginLink.style.display = 'inline-block';
      document.body.classList.add('guest');
      try{
        const path = (location.pathname.split('/').pop() || '').toLowerCase();
        const protectedPages = ['roles.html','rewards.html','topup.html','shop.html'];
        if(protectedPages.includes(path)){
          window.location.href = './login.html';
        }
      }catch{}
    }
  }catch{}
});

document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  if(body){
    requestAnimationFrame(()=>{ body.classList.add('page-ready'); });
  }
  // Responsive helper: toggle body.is-mobile for CSS fallback
  try{
    const mq = window.matchMedia('(max-width: 1024px)');
    const apply = () => {
      document.body.classList.toggle('is-mobile', mq.matches);
      // Force-hide header account on mobile
      try{
        const headerAcc = document.querySelector('.site-header .account');
        if(headerAcc){ headerAcc.style.display = mq.matches ? 'none' : ''; }
      }catch{}
    };
    apply();
    mq.addEventListener ? mq.addEventListener('change', apply) : mq.addListener(apply);
    window.addEventListener('resize', apply);
  }catch{}
  // Insert mobile toggler button for mobile (init on load and when breakpoint changes)
  try{
    const ensureMobileNav = () => {
      const isMobile = window.matchMedia && window.matchMedia('(max-width: 1024px)').matches;
      let nav = document.querySelector('.site-header .nav');
      if(!nav){
        const header = document.querySelector('.site-header');
        if(!header || !isMobile) return;
        nav = header.firstElementChild || header;
      }
      if(!isMobile) return;
      let toggler = document.getElementById('mobileToggler');
      if(!toggler){
        toggler = document.createElement('div');
        toggler.id = 'mobileToggler';
        toggler.className = 'mobile-nav-toggler';
        toggler.innerHTML = '<span class="icon flaticon-menu-1"></span>';
        // place at the far right in the header row
        toggler.style.marginLeft = 'auto';
        nav.appendChild(toggler);
      }
      // drawer host
      let host = document.getElementById('mobileMenuHost');
      if(!host){
        host = document.createElement('div');
        host.id = 'mobileMenuHost';
        host.innerHTML = '\
          <div id="mobileMenu">\
            <header><div style="font-weight:700">เมนู</div><button id="mobileClose" aria-label="Close" style="padding:6px 10px;background:transparent;border:0;color:#ff5c5c;font-weight:800;font-size:18px;cursor:pointer">×</button></header>\
            <div class="list" id="mobileList"></div>\
          </div>';
        document.body.appendChild(host);
        host.addEventListener('click',(e)=>{ if(e.target===host) host.classList.remove('open'); });
        host.querySelector('#mobileClose').addEventListener('click',()=> host.classList.remove('open'));
      }
      const renderList = () => {
        const list = document.getElementById('mobileList');
        if(!list) return;
        let user = null;
        try{ user = JSON.parse(localStorage.getItem('discordUser')||'null'); }catch{}
        const pointEl = document.querySelector('.account .point');
        const pointTxt = pointEl ? pointEl.textContent.replace(/\s+/g,' ').trim() : '';
        const accHtml = user ? `\
          <div class="acc" style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:16px;border-bottom:1px solid var(--border)">\
            <img src="${user.avatar?`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`:'https://cdn.discordapp.com/embed/avatars/0.png'}" alt="avatar" class="avatar-lg" style="width:84px;height:84px;border-radius:50%;border:2px solid #1f2a36">\
            <div class="uname" style="font-weight:800;letter-spacing:1px">${(user.username||'USER').toUpperCase()}</div>\
            ${pointTxt?`<div class="point-badge" style="border:1.5px solid var(--orange);padding:4px 10px;border-radius:8px;background:#0d1624;font-weight:800">${pointTxt}</div>`:''}\
          </div>`
        : `\
          <div class="acc" style="display:flex;flex-direction:column;gap:10px;padding:16px;border-bottom:1px solid var(--border)">\
            <a href="./login.html" class="drawer-link" style="text-align:center">เข้าสู่ระบบ</a>\
          </div>`;
        const current = (location.pathname.split('/').pop()||'').toLowerCase();
        const link = (href, label) => `\
          <a class="drawer-link${current===href.replace('./','').toLowerCase()?' active':''}" href="${href}">${label}</a>`;
        const extra = user ? `\
          <a href="#" id="mobileProfile" class="drawer-link">โปรไฟล์</a>\
          <a href="#" id="mobileHistory" class="drawer-link">ประวัติรายการ</a>\
          <a href="#" id="logoutBtnMobile" class="drawer-link">ออกจากระบบ</a>` : '';
        const social = `\
          <div style="display:flex;gap:10px;justify-content:center;margin-top:8px;padding:12px 0;border-top:1px solid var(--border)">\
            <a href="https://discord.gg/evolcity" target="_blank" rel="noopener" title="Discord">🗨️</a>\
            <a href="#" target="_blank" rel="noopener" title="Facebook">f</a>\
            <a href="#" target="_blank" rel="noopener" title="YouTube">▶</a>\
          </div>`;
        list.innerHTML = `\
          ${accHtml}\
          ${link('./index.html','หน้าแรก')}\
          ${link('./topup.html','เติมเงิน')}\
          ${link('./shop.html','ร้านค้า')}\
          ${link('./roles.html','รับยศไวริส')}\
          ${link('./rewards.html','รับของกิจกรรม')}\
          ${extra}\
          ${social}`;
        // Bind extras
        const prof = document.getElementById('mobileProfile');
        if(prof){ prof.addEventListener('click', (e)=>{ e.preventDefault(); try{ openProfileModal(); }catch{} document.getElementById('mobileMenuHost').classList.remove('open'); }); }
        const hist = document.getElementById('mobileHistory');
        if(hist){ hist.addEventListener('click', (e)=>{ e.preventDefault(); try{ renderHistory(); }catch{} document.getElementById('mobileMenuHost').classList.remove('open'); }); }
      };
      renderList();
      toggler = document.getElementById('mobileToggler');
      if(toggler && !toggler.dataset.bound){
        toggler.dataset.bound = '1';
        toggler.addEventListener('click', ()=>{
          renderList();
          document.getElementById('mobileMenuHost').classList.add('open');
        });
      }
      // always hide header account on mobile when nav is ensured
      try{ const headerAcc = document.querySelector('.site-header .account'); if(headerAcc) headerAcc.style.display = 'none'; }catch{}
    };
    ensureMobileNav();
    const mq2 = window.matchMedia('(max-width: 1024px)');
    mq2.addEventListener ? mq2.addEventListener('change', ensureMobileNav) : mq2.addListener(ensureMobileNav);
    window.addEventListener('resize', ensureMobileNav);
  }catch{}
  // Update USER ONLINE on main.html
  try{
    const path = (location.pathname.split('/').pop() || '').toLowerCase();
    if(path === 'main.html'){
      const el = document.querySelector('.hero .overline');
      if(el){
        const render = (c,m,ok=true)=>{ el.textContent = ok ? `SERVER STATUS | ${c}/${m}` : 'SERVER STATUS | OFFLINE'; };
        const refresh = async ()=>{
          try{
            const r = await fetch('/fivem/status', { cache:'no-store' });
            const j = await r.json().catch(()=>({ success:false }));
            if(r.ok && j && j.success){ render(Number(j.clients||0), Number(j.max||0), true); }
            else { render(0,0,false); }
          }catch{ render(0,0,false); }
        };
        refresh();
        setInterval(refresh, 20000);
      }
    }
  }catch{}
});

// Logout handler
document.addEventListener('click', (e) => {
  const target = e.target.closest('#logoutBtn, #logoutBtnMobile');
  if(!target) return;
  e.preventDefault();
  try{
    localStorage.removeItem('discordUser');
  }catch{}
  try{ document.cookie = 'discordUser=; Max-Age=0; Path=/; SameSite=Lax'; }catch{}
  window.location.href = './index.html';
});

document.addEventListener('click', (e) => {
  if(e.defaultPrevented) return;
  if(e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest('a');
  if(!a) return;
  const href = a.getAttribute('href');
  if(!href || href.startsWith('#')) return;
  if(a.target === '_blank' || a.hasAttribute('download')) return;
  try{
    const url = new URL(href, window.location.href);
    if(url.origin !== window.location.origin) return;
    if(url.pathname === window.location.pathname && url.search === window.location.search) return;
    e.preventDefault();
    document.body.classList.add('page-exit');
    setTimeout(()=>{ window.location.href = url.href; }, 250);
  }catch{}
});

// Handle WHITELISTED free claim (roles.html)
document.addEventListener('DOMContentLoaded', () => {
  const roleCard = document.querySelector('.card.role');
  if(!roleCard) return; // only on roles page

  const btn = roleCard.querySelector('.btn-buy');
  const input = roleCard.querySelector('input');
  if(!btn) return;

  const setState = (opts={}) => {
    if('disabled' in opts) btn.disabled = !!opts.disabled;
    if('text' in opts) btn.textContent = opts.text;
    if(input && 'input' in opts) input.value = opts.input;
  };

  const setVisual = (mode) => {
    // mode: 'free' | 'claimed'
    btn.classList.remove('btn-claim','btn-red');
    if(mode === 'claimed'){
      btn.classList.add('btn-red');
    } else {
      btn.classList.add('btn-claim');
    }
  };

  // Pre-check: if user already has role, disable button
  (async () => {
    try{
      // Global reset check: if server resetAt changes, clear client state and redirect to index.html
      const ensureResetWatcher = () => {
        let last = null;
        try{ last = Number(localStorage.getItem('resetAt')||'0')||0; }catch{}
        const check = async () => {
          try{
            const r = await fetch('/reset-at', { cache:'no-store' });
            const j = await r.json().catch(()=>({ success:false }));
            if(r.ok && j && j.success){
              const srv = Number(j.resetAt)||0;
              if(last && srv && srv > last){
                try{ localStorage.clear(); }catch{}
                try{ document.cookie = 'discordUser=; Max-Age=0; Path=/; SameSite=Lax'; }catch{}
                window.location.href = './index.html';
                return;
              }
              try{ localStorage.setItem('resetAt', String(srv||Date.now())); }catch{}
              last = srv;
            }
          }catch{}
        };
        check();
        try{ setInterval(check, 10000); }catch{}
      };
      ensureResetWatcher();

      const raw = localStorage.getItem('discordUser');
      if(!raw) return; // not logged in
      const user = JSON.parse(raw);
      if(!user || !user.id) return;
      const res = await fetch(`/has-role?discordId=${encodeURIComponent(user.id)}`);
      const json = await res.json().catch(()=>({ success:false }));
      if(res.ok && json && json.success && json.has){
        setState({ disabled: true, text: 'รับแล้ว', input: 'คุณมีไวริสแล้ว' });
        setVisual('claimed');
      } else {
        // ensure proper idle text
        setState({ disabled: false, text: 'รับไวริส' });
        setVisual('free');
      }
    }catch{
      // ignore pre-check errors to keep UI interactive
    }
  })();

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    try{
      const raw = localStorage.getItem('discordUser');
      if(!raw){
        alert('กรุณาเข้าสู่ระบบด้วย Discord ก่อน');
        window.location.href = './login.html';
        return;
      }
      const user = JSON.parse(raw);
      if(!user || !user.id){
        alert('ไม่พบข้อมูลผู้ใช้ Discord');
        return;
      }

      setState({ disabled: true, text: 'กำลังดำเนินการ…' });

      const res = await fetch('/give-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordId: user.id })
      });
      const json = await res.json().catch(()=>({ success:false, message:'Invalid response' }));

      if(res.ok && json && json.success){
        if(json.already){
          setState({ disabled: true, text: 'รับแล้ว', input: 'คุณมีไวริสแล้ว' });
          setVisual('claimed');
          alert('คุณมีไวริสแล้ว');
        } else {
          setState({ disabled: true, text: 'รับแล้ว', input: 'คุณมีไวริสแล้ว' });
          setVisual('claimed');
        }
      } else {
        const msg = (json && json.message) || 'Cannot grant role';
        setState({ disabled: false, text: 'รับไวริส' });
        setVisual('free');
        alert('ไม่สามารถให้ยศได้: ' + msg);
      }
    }catch(err){
      console.error(err);
      setState({ disabled: false, text: 'รับไวริส' });
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    }
  });
});

// Lightweight modals for Profile and History (init function to handle late script load)
const initUI = () => {
  // Global reset watcher: if admin clears all data, force-logout everyone
  try{
    let lastReset = 0;
    try{ lastReset = Number(localStorage.getItem('resetAt')||'0')||0; }catch{}
    const checkReset = async () => {
      try{
        const r = await fetch('/reset-at', { cache: 'no-store' });
        const j = await r.json().catch(()=>({ success:false }));
        if(r.ok && j && j.success){
          const srv = Number(j.resetAt)||0;
          if(lastReset && srv && srv > lastReset){
            try{ localStorage.clear(); }catch{}
            try{ document.cookie = 'discordUser=; Max-Age=0; Path=/; SameSite=Lax'; }catch{}
            window.location.href = './index.html';
            return;
          }
          try{ localStorage.setItem('resetAt', String(srv||Date.now())); }catch{}
          lastReset = srv;
        }
      }catch{}
    };
    checkReset();
    setInterval(checkReset, 10000);
  }catch{}
  const ensureModalHost = () => {
    let host = document.getElementById('modalHost');
    if(host) return host;
    host = document.createElement('div');
    host.id = 'modalHost';
    Object.assign(host.style, { position:'fixed', inset:'0', display:'none', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.5)', zIndex:10000 });
    host.innerHTML = '<div id="modalBox" style="max-width:560px;width:92%;background:#111;border:1px solid #333;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.6);overflow:hidden">\
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #222"><h3 id="modalTitle" style="margin:0;font-weight:700">TITLE</h3><button id="modalClose" aria-label="Close" style="padding:4px 8px;background:transparent;border:0;color:#ff5c5c;font-weight:800;font-size:18px;line-height:1;cursor:pointer">×</button></div>\
      <div id="modalBody" style="padding:16px"></div>\
    </div>';
    document.body.appendChild(host);
    host.addEventListener('click', (e)=>{ if(e.target === host) closeModal(); });
    document.getElementById('modalClose').addEventListener('click', closeModal);
    return host;
  };

  const openModal = (title, html) => {
    const host = ensureModalHost();
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    titleEl.textContent = title;
    bodyEl.innerHTML = html;
    host.style.display = 'flex';
  };
  const closeModal = () => {
    const host = document.getElementById('modalHost');
    if(host) host.style.display = 'none';
  };

  // Simple image viewer (lightbox)
  const openImageViewer = (src) => {
    let viewer = document.getElementById('imgViewer');
    if(!viewer){
      viewer = document.createElement('div');
      viewer.id = 'imgViewer';
      Object.assign(viewer.style, { position:'fixed', inset:'0', background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10001, padding:'16px' });
      viewer.innerHTML = '<div style="position:relative;max-width:92vw;max-height:92vh">\
        <img id="imgViewerImg" src="" alt="image" style="max-width:92vw;max-height:92vh;display:block;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.6)"/>\
        <button id="imgViewerClose" class="btn btn-outline" style="position:absolute;top:8px;right:8px">ปิด</button>\
      </div>';
      document.body.appendChild(viewer);
      const close = ()=>{ viewer.style.display = 'none'; };
      viewer.addEventListener('click', (e)=>{ if(e.target === viewer) close(); });
      viewer.querySelector('#imgViewerClose').addEventListener('click', close);
      document.addEventListener('keydown', (e)=>{ if(viewer.style.display==='flex' && e.key==='Escape') close(); });
    }
    viewer.querySelector('#imgViewerImg').src = src;
    viewer.style.display = 'flex';
  };

  // Lazy-load jsQR for QR decoding
  const loadJsQR = () => new Promise((resolve,reject)=>{
    if(window.jsQR) return resolve(window.jsQR);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    s.onload = ()=> resolve(window.jsQR);
    s.onerror = reject;
    document.head.appendChild(s);
  });

  // Render a simple image from text (e.g., phone number) to avoid plain text exposure
  const makeTextImage = (text) => {
    try{
      const padX = 16, padY = 12; // padding around text
      const font = '700 24px Kanit, system-ui, Arial';
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = font;
      const metrics = ctx.measureText(text);
      const textWidth = Math.ceil(metrics.width);
      const textHeight = 28; // approximate for 24px font
      canvas.width = textWidth + padX * 2;
      canvas.height = textHeight + padY * 2;
      // background box
      ctx.fillStyle = '#0c131d';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // border
      ctx.strokeStyle = '#1f2a36';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, canvas.width-2, canvas.height-2);
      // text
      ctx.font = font;
      ctx.fillStyle = '#e7efff';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, padX, canvas.height/2);
      return canvas.toDataURL('image/png');
    }catch{
      return '';
    }
  };

  const renderProfile = async () => {
    let user = null;
    try { user = JSON.parse(localStorage.getItem('discordUser') || 'null'); } catch {}
    if(!user){
      openModal('โปรไฟล์', '<p>กรุณาเข้าสู่ระบบด้วย Discord ก่อน</p>');
      return;
    }
    const avatar = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : 'https://cdn.discordapp.com/embed/avatars/0.png';
    let joinText = 'กำลังตรวจสอบ...';
    try{
      const guildId = '1423651393390252136';
      const res = await fetch(`/join-position?discordId=${encodeURIComponent(user.id)}&guildId=${encodeURIComponent(guildId)}`);
      const data = await res.json().catch(()=>({ success:false }));
      if(res.ok && data && data.success){
        if(data.found){
          joinText = `ลำดับเข้าเซิร์ฟเวอร์: ${data.position}`;
        } else {
          joinText = 'ไม่พบผู้ใช้อยู่ในเซิร์ฟเวอร์นี้';
        }
      } else {
        joinText = 'ไม่สามารถตรวจสอบลำดับได้';
      }
    }catch{
      joinText = 'ไม่สามารถตรวจสอบลำดับได้';
    }
    const html = `
      <div style="display:flex;gap:14px;align-items:center">
        <img src="${avatar}" alt="avatar" style="width:72px;height:72px;border-radius:50%"/>
        <div>
          <div style="font-weight:700;font-size:18px">${(user.username||'USER')}</div>
          <div style=\"color:var(--muted)\">ID: ${user.id}</div>
        </div>
      </div>
      <div style="margin-top:14px;display:grid;grid-template-columns:180px 1fr;gap:8px;color:var(--muted)">
        <div>การเข้าร่วมในเซิร์ฟเวอร์</div><div>${joinText}</div>
      </div>
    `;
    openModal('โปรไฟล์', html);
  };

  const renderHistory = async () => {
    let user = null;
    try { user = JSON.parse(localStorage.getItem('discordUser') || 'null'); } catch {}
    if(!user){ openModal('ประวัติรายการ','<p>กรุณาเข้าสู่ระบบก่อน</p>'); return; }
    try{
      // ensure user is registered before requesting history
      try{ await fetch('/users/register', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ id: user.id, username: user.username, discriminator: user.discriminator, avatar: user.avatar }) }); }catch{}
      const r = await fetch(`/history?userId=${encodeURIComponent(user.id)}`, { cache: 'no-store' });
      let j = null;
      try{ j = await r.json(); }
      catch{
        try{ const t = await r.text(); j = JSON.parse(t); }
        catch{ j = { success:false, message: 'Invalid response' }; }
      }
      if(!(r.ok && j && j.success)) { openModal('ประวัติรายการ', `<p>ไม่สามารถโหลดข้อมูลได้${j && j.message ? `: ${j.message}` : ''}</p>`); return; }
      const h = j.history || { topups:[], purchases:[], rewards:[] };
      const date = (ts)=> ts ? new Date(ts).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-';
      const rows = (arr, cols) => arr.length ? arr.map(x=>{
        const cells = (typeof cols === 'function') ? cols(x) : cols;
        return `<tr>${cells.map(c=>`<td style=\"padding:6px 8px;border-bottom:1px solid var(--border)\">${c(x)}</td>`).join('')}</tr>`;
      }).join('') : `<tr><td colspan=\"99\" style=\"padding:8px;color:var(--muted)\">ไม่มีข้อมูล</td></tr>`;
      const html = `
        <div style="display:grid;gap:14px">
          <div>
            <div style="font-weight:700;margin-bottom:6px">ประวัติการเติมเงิน</div>
            <div style="max-height:180px;overflow:auto;border:1px solid var(--border);border-radius:8px">
              <table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">เวลา</th><th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">ช่องทาง</th><th style="text-align:right;padding:6px 8px;border-bottom:1px solid var(--border)">จำนวน</th><th style="text-align:right;padding:6px 8px;border-bottom:1px solid var(--border)">ยอดคงเหลือ</th></tr></thead><tbody>${rows(h.topups||[], x=>[y=>date(x.ts), y=>x.method||'-', y=>Number(x.amount||0), y=>Number(x.balance||0)])}</tbody></table>
            </div>
          </div>
          <div>
            <div style="font-weight:700;margin-bottom:6px">ประวัติการซื้อสินค้า</div>
            <div style="max-height:180px;overflow:auto;border:1px solid var(--border);border-radius:8px">
              <table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">เวลา</th><th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">รายการ</th><th style="text-align:right;padding:6px 8px;border-bottom:1px solid var(--border)">POINT</th></tr></thead><tbody>${rows(h.purchases||[], x=>[y=>date(x.ts), y=>x.item||'-', y=>Number(x.amount||0)])}</tbody></table>
            </div>
          </div>
          <div>
            <div style="font-weight:700;margin-bottom:6px">ประวัติการรับของกิจกรรม</div>
            <div style="max-height:160px;overflow:auto;border:1px solid var(--border);border-radius:8px">
              <table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">เวลา</th><th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">รายการ</th></tr></thead><tbody>${rows(h.rewards||[], x=>[y=>date(x.ts), y=>x.item||'-'])}</tbody></table>
            </div>
          </div>
        </div>`;
      openModal('ประวัติรายการ', html);
    }catch{
      openModal('ประวัติรายการ','<p>ไม่สามารถโหลดข้อมูลได้</p>');
    }
  };

  const renderAdmin = async () => {
    let currentUser = null;
    try { currentUser = JSON.parse(localStorage.getItem('discordUser')||'null'); } catch {}
    if(!currentUser){ openModal('หลังบ้าน','<p>กรุณาเข้าสู่ระบบ</p>'); return; }
    const getHeaders = () => ({ 'Content-Type':'application/json', 'x-admin-user': String(currentUser.id) });
    // ensure the current admin is registered so at least one user exists
    try{ await fetch('/users/register', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ id: currentUser.id, username: currentUser.username, discriminator: currentUser.discriminator, avatar: currentUser.avatar }) }); }catch{}
    const listUsers = async () => {
      try{
        let r = await fetch('/admin/users', { headers: getHeaders(), method:'GET' });
        let j = await r.json().catch(()=>({ success:false }));
        if(r.ok && j && j.success){ return Array.isArray(j.users) ? j.users : []; }
        const snap = await getSnapshotFromConfig();
        if(snap && Array.isArray(snap.users)) return snap.users;
        return [];
      }catch{ const snap = await getSnapshotFromConfig(); return (snap && Array.isArray(snap.users)) ? snap.users : []; }
    };
    const users = await listUsers();
    const total = users.length;
    const makeAvatar = (u)=> u.avatar ? `https://cdn.discordapp.com/avatars/${u.userId}/${u.avatar}.png?size=64` : 'https://cdn.discordapp.com/embed/avatars/0.png';
    const tag = (u)=>{
      const disc = (u.discriminator==null?'' : String(u.discriminator)).trim();
      return disc && disc !== '0' ? `${u.username||'USER'}#${disc}` : `${u.username||'USER'}`;
    };
    const item = (u)=>`
      <div class="adm-row" data-id="${u.userId}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border);">
        <img src="${makeAvatar(u)}" alt="avatar" style="width:36px;height:36px;border-radius:50%"/>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${tag(u)}</div>
          <div style="color:var(--muted);font-family:monospace;font-size:12px">${u.userId}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-weight:700">${u.balance}</div>
          <button class="btn btn-outline adm-view" data-id="${u.userId}" style="padding:6px 10px">ดูข้อมูล</button>
        </div>
      </div>`;
    const listHtml = users.length ? users.sort((a,b)=>b.balance-a.balance).map(item).join('') : `<div style="padding:12px;color:var(--muted)">ยังไม่มีผู้ใช้ที่สมัคร/ล็อกอิน</div>`;
    const html = `
      <div style="display:grid;gap:12px">
        <div style="display:grid;gap:8px">
          <label>Discord User ID<input id="admUserId" style="width:100%;background:#0b0f14;border:1px solid #2a2e31;border-radius:8px;padding:10px;color:#e7efff" placeholder="เช่น 123456789012345678"/></label>
          <label>จำนวน POINT<input id="admAmount" type="number" min="0" step="1" style="width:100%;background:#0b0f14;border:1px solid #2a2e31;border-radius:8px;padding:10px;color:#e7efff" placeholder="เริ่มต้น 1 POINT"/></label>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button id="admAdd" class="btn btn-outline">เพิ่มเงิน</button>
            <button id="admSub" class="btn btn-outline">ลบเงิน</button>
            <button id="admdl" class="btn btn-outline">ล้างข้อมูล</button>
            <button id="admClearAll" class="btn btn-outline">ล้างฐานข้อมูลทั้งหมด</button>
          </div>
        </div>
        <div style="border-top:1px solid var(--border);padding-top:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div style="font-weight:700">รายชื่อผู้ใช้ที่สมัครแล้ว • ทั้งหมด ${total} คน</div>
            <input id="admSearch" placeholder="ค้นหาด้วยชื่อหรือ ID" style="max-width:260px;width:100%;background:#0b0f14;border:1px solid #2a2e31;border-radius:8px;padding:8px;color:#e7efff"/>
          </div>
          <div id="admList" style="max-height:320px;overflow:auto;border:1px solid var(--border);border-radius:8px">${listHtml}</div>
        </div>
      </div>`;
    openModal('หลังบ้าน', html);
    const bindRowClicks = () => {
      document.querySelectorAll('.adm-row').forEach(row => {
        row.addEventListener('click', (ev) => {
          const id = row.getAttribute('data-id');
          const inp = document.getElementById('admUserId');
          if(inp && id){ inp.value = id; }
        });
      });
      document.querySelectorAll('.adm-view').forEach(btn => {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const id = btn.getAttribute('data-id');
          if(id) fetchUserDetail(id);
        });
      });
    };
    bindRowClicks();
    const refreshList = async () => {
      const data = await listUsers();
      const list = document.getElementById('admList');
      if(list){
        const rows = data.length ? data.sort((a,b)=>b.balance-a.balance).map(item).join('') : `<div style="padding:12px;color:var(--muted)">ยังไม่มีผู้ใช้ที่สมัคร/ล็อกอิน</div>`;
        list.innerHTML = rows;
      }
    };
    const send = async (path) => {
      const userId = (document.getElementById('admUserId').value||'').trim();
      const amt = Number((document.getElementById('admAmount').value||'').trim());
      if(!userId || !Number.isFinite(amt) || amt < 0){ openModal('หลังบ้าน','<p>กรุณากรอกข้อมูลให้ถูกต้อง</p>'); return; }
      try{
        let r = await fetch(path, { method:'POST', headers: getHeaders(), body: JSON.stringify({ userId, amount: amt, adminId: currentUser.id }) });
        const j = await r.json().catch(()=>({ success:false }));
        if(r.ok && j && j.success){
          await refreshList();
          if(String(userId) === String(currentUser.id)){
            // update header points if affecting self
            try{
              let p = document.querySelector('.account .point');
              if(!p){ p = document.createElement('span'); p.className = 'point'; const anchor = document.querySelector('.account .profile') || document.querySelector('.account .login-link') || document.querySelector('.account'); anchor.parentNode.insertBefore(p, anchor); }
              p.textContent = `POINT: ${j.balance}`;
            }catch{}
          }
        } else {
          openModal('หลังบ้าน','<p>ไม่สำเร็จ</p>');
        }
      }catch{
        openModal('หลังบ้าน','<p>ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้</p>');
      }
    };
    document.getElementById('admAdd').addEventListener('click', ()=> send('/points/add'));
    document.getElementById('admSub').addEventListener('click', ()=> send('/points/subtract'));
    const btnClearAll = document.getElementById('admClearAll');
    if(btnClearAll){
      btnClearAll.addEventListener('click', async ()=>{
        const ok = window.confirm('ยืนยันล้างฐานข้อมูลทั้งหมด? (ลบผู้ใช้/พอยต์/ประวัติทั้งหมด และให้ทุกคนเด้งออก)');
        if(!ok) return;
        try{
          const r = await fetch('/admin/clear_all', { method:'POST', headers: getHeaders(), body: JSON.stringify({ adminId: String(currentUser.id) }) });
          const j = await r.json().catch(()=>({ success:false }));
          if(r.status === 403){
            openModal('สิทธิ์ไม่พอ', '<p>คุณไม่มีสิทธิ์ล้างฐานข้อมูล กรุณาตรวจสอบ ADMIN_IDS และการล็อกอิน</p>');
          } else if(r.ok && j && j.success){
            try{ localStorage.clear(); }catch{}
            try{ document.cookie = 'discordUser=; Max-Age=0; Path=/; SameSite=Lax'; }catch{}
            window.location.href = './index.html';
          } else {
            openModal('ไม่สำเร็จ', '<p>ล้างฐานข้อมูลไม่สำเร็จ</p>');
          }
        }catch{
          openModal('ข้อผิดพลาด', '<p>ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้</p>');
        }
      });
    }
    const fetchUserDetail = async (id) => {
      try{
        // Prefer API then fallback to config snapshot
        let db = null;
        let u, h;
        if(!u){
          // Fallback to API for real-time
          let r = await fetch(`/admin/user?userId=${encodeURIComponent(id)}`, { headers: getHeaders() });
          const j = await r.json().catch(()=>({ success:false }));
          if(r.ok && j && j.success){
            u = j.user || { id, username:'-', discriminator:'', avatar:'', balance:0 };
            h = j.history || { topups:[], purchases:[], rewards:[] };
          }
        }
        if(!u){
          db = await getSnapshotFromConfig();
          if(db){
            const userRow = (db.users||[]).find(x=>String(x.userId)===String(id));
            if(userRow){
              u = { id: userRow.userId, username: userRow.username, discriminator: userRow.discriminator, avatar: userRow.avatar, balance: userRow.balance };
              h = (db.histories && db.histories[id]) ? db.histories[id] : { topups:[], purchases:[], rewards:[] };
            }
          }
        }
        if(!u){
          u = { id, username:'-', discriminator:'', avatar:'', balance:0 };
          h = { topups:[], purchases:[], rewards:[] };
        }
        const avatar = u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128` : 'https://cdn.discordapp.com/embed/avatars/0.png';
        const date = (ts)=> ts ? new Date(ts).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-';
        const rows = (arr, cols) => arr.length ? arr.map(x=>`<tr>${cols.map(c=>`<td style=\"padding:6px 8px;border-bottom:1px solid var(--border)\">${c(x)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan=\"99\" style=\"padding:8px;color:var(--muted)\">ไม่มีข้อมูล</td></tr>`;
        const tag2 = (()=>{ const disc=(u.discriminator==null?'' : String(u.discriminator)).trim(); return disc && disc!=='0' ? `${u.username||'USER'}#${disc}` : `${u.username||'USER'}`; })();
        const html = `\
          <div style=\"display:grid;gap:12px\">\
            <div style=\"display:flex;gap:14px;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px\">\
              <img src=\"${avatar}\" style=\"width:72px;height:72px;border-radius:50%\"/>\
              <div>\
                <div style=\"font-weight:800;font-style:italic;text-transform:uppercase;font-size:18px\">${(u.username||'USER')}</div>\
                <div style=\"color:var(--muted);font-family:monospace\">ID: ${u.id}</div>\
              </div>\
            </div>\
            <div style=\"display:grid;grid-template-columns:180px 1fr;gap:8px\">\
              <div style=\"color:var(--muted)\">ชื่อ Discord</div><div>${(u.username||'USER')}</div>\
              <div style=\"color:var(--muted)\">ID: Discord</div><div style=\"font-family:monospace\">${u.id}</div>\
              <div style=\"color:var(--muted)\">POINT: ในเว็บ</div><div style=\"font-weight:800\">${u.balance||0}</div>\
              <div style=\"color:var(--muted)\">สมัครเมื่อ</div><div>${date(u.createdAt)}</div>\
              <div style=\"color:var(--muted)\">เข้า Discord</div><div>${date(u.joinedAt)}</div>\
            </div>\
            <div style=\"border-top:1px solid var(--border);padding-top:8px\">\
              <div style=\"font-weight:700;margin-bottom:6px\">ประวัติการเติมเงิน</div>\
              <div style=\"max-height:180px;overflow:auto;border:1px solid var(--border);border-radius:8px\">\
                <table style=\"width:100%;border-collapse:collapse\"><thead><tr><th style=\"text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)\">เวลา</th><th style=\"text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)\">ช่องทาง</th><th style=\"text-align:right;padding:6px 8px;border-bottom:1px solid var(--border)\">จำนวน</th><th style=\"text-align:right;padding:6px 8px;border-bottom:1px solid var(--border)\">ยอดคงเหลือ</th></tr></thead><tbody>${rows(h.topups, x=>[y=>date(x.ts), y=>x.method, y=>x.amount, y=>x.balance])}</tbody></table>\
              </div>\
            </div>\
            <div style=\"border-top:1px solid var(--border);padding-top:8px\">\
              <div style=\"font-weight:700;margin-bottom:6px\">ประวัติการซื้อสินค้า</div>\
              <div style=\"max-height:160px;overflow:auto;border:1px solid var(--border);border-radius:8px\">\
                <table style=\"width:100%;border-collapse:collapse\"><thead><tr><th style=\"text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)\">เวลา</th><th style=\"text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)\">รายการ</th><th style=\"text-align:right;padding:6px 8px;border-bottom:1px solid var(--border)\">POINT</th><th style=\"text-align:right;padding:6px 8px;border-bottom:1px solid var(--border)\">ลบ</th></tr></thead><tbody>${rows(h.purchases, x=>[y=>date(x.ts), y=>x.item||'-', y=>x.amount||0, y=>`<div style=\\\"display:flex;gap:6px;justify-content:flex-end\\\"><button class=\\\"btn btn-outline adm-del\\\" data-uid=\\\"${u.id}\\\" data-pid=\\\"${x.productId}\\\" data-ts=\\\"${x.ts}\\\">ลบ</button><button class=\\\"btn btn-outline adm-del-refund\\\" data-uid=\\\"${u.id}\\\" data-pid=\\\"${x.productId}\\\" data-ts=\\\"${x.ts}\\\">ลบ+คืนเงิน</button></div>`])}</tbody></table>\
              </div>\
            </div>\
            <div style=\"border-top:1px solid var(--border);padding-top:8px\">\
              <div style=\"font-weight:700;margin-bottom:6px\">ประวัติการรับของกิจกรรม</div>\
              <div style=\"max-height:160px;overflow:auto;border:1px solid var(--border);border-radius:8px\">\
                <table style=\"width:100%;border-collapse:collapse\"><thead><tr><th style=\"text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)\">เวลา</th><th style=\"text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)\">รายการ</th></tr></thead><tbody>${rows(h.rewards, x=>[y=>date(x.ts), y=>x.item||'-'])}</tbody></table>\
              </div>\
            </div>\
          </div>`;
        openModal('ข้อมูลผู้ใช้', html);
        // Bind delete actions
        try{
          const bind = (selector, refund) => {
            document.querySelectorAll(selector).forEach(btn => {
              btn.addEventListener('click', async (ev)=>{
                ev.stopPropagation();
                const userId = btn.getAttribute('data-uid');
                const productId = btn.getAttribute('data-pid');
                const ts = Number(btn.getAttribute('data-ts'))||undefined;
                const ok = window.confirm(refund ? 'ลบและคืน POINT ให้ผู้ใช้?' : 'ยืนยันลบประวัติการซื้อ?');
                if(!ok) return;
                try{
                  let r = await fetch('/admin/purchase/delete', { method:'POST', headers: getHeaders(), body: JSON.stringify({ userId, productId, ts, refund }) });
                  const j = await r.json().catch(()=>({ success:false }));
                  if(r.ok && j && j.success){
                    // refresh detail
                    fetchUserDetail(id);
                    // update header points if self
                    if(String(userId) === String(currentUser.id) && j.balance !== undefined){
                      try{
                        let p = document.querySelector('.account .point');
                        if(!p){ p = document.createElement('span'); p.className = 'point'; const anchor = document.querySelector('.account .profile') || document.querySelector('.account .login-link') || document.querySelector('.account'); anchor.parentNode.insertBefore(p, anchor); }
                        p.textContent = `POINT: ${j.balance}`;
                      }catch{}
                    }
                  } else {
                    alert('ลบไม่สำเร็จ');
                  }
                }catch{
                  alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
                }
              });
            });
          };
          bind('.adm-del', false);
          bind('.adm-del-refund', true);
        }catch{}
      }catch{ openModal('หลังบ้าน','<p>ไม่สามารถโหลดข้อมูลผู้ใช้ได้</p>'); }
    };
    const doFilter = () => {
      const q = (document.getElementById('admSearch').value||'').trim().toLowerCase();
      const list = document.getElementById('admList');
      if(!list) return;
      list.querySelectorAll('.adm-row').forEach(row => {
        const id = (row.getAttribute('data-id')||'').toLowerCase();
        const txt = row.textContent.toLowerCase();
        row.style.display = (!q || id.includes(q) || txt.includes(q)) ? '' : 'none';
      });
    };
    const s = document.getElementById('admSearch');
    if(s){ s.addEventListener('input', doFilter); }
  };

  document.addEventListener('click', (e) => {
    const a = e.target.closest('#profileMenu a');
    if(!a) return;
    const text = a.textContent.trim();
    if(text === 'โปรไฟล์'){
      e.preventDefault();
      renderProfile();
    } else if(text.startsWith('หลังบ้าน')){
      e.preventDefault();
      renderAdmin();
    } else if(text === 'ประวัติรายการ'){
      e.preventDefault();
      renderHistory();
    }
  });

  // Topup handlers (topup.html)
  const userRaw = localStorage.getItem('discordUser');
  const user = (()=>{ try{return JSON.parse(userRaw||'null')}catch{return null} })();
  const onTopupDone = async (balance) => {
    try{
      // update header points if present
      let p = document.querySelector('.account .point');
      if(!p){ p = document.createElement('span'); p.className = 'point'; const anchor = document.querySelector('.account .profile') || document.querySelector('.account .login-link') || document.querySelector('.account'); anchor.parentNode.insertBefore(p, anchor); }
      const nowText = (p.textContent||'').trim();
      const m = nowText.match(/(\d+)/);
      const from = m ? Number(m[1]) : 0;
      const to = Number(balance) || 0;
      if(from === to){ p.textContent = `POINT: ${to}`; return; }
      const start = performance.now();
      const duration = 900;
      const step = (t)=>{
        const e = Math.min(1, (t - start) / duration);
        const val = Math.round(from + (to - from) * e);
        p.textContent = `POINT: ${val}`;
        if(e < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }catch{}
  };
  const btnPrompt = document.getElementById('btnPromptPay');
  if(btnPrompt){
    btnPrompt.addEventListener('click', (e)=>{
      e.preventDefault();
      if(!user){ openModal('PROMPTPAY','<p>กรุณาเข้าสู่ระบบก่อน</p>'); return; }
      const cfg = (window.publicConfig||{});
      const bankName = cfg.bankName || 'ธนาคาร';
      const bankNo = cfg.bankNo || 'xxx-x-xxxxx-x';
      const bankAccName = cfg.bankAccName || 'EVOL CITY';
      const html = `
        <div style="display:grid;gap:12px">
          <div style="padding:10px;border:1px dashed var(--border);border-radius:8px;background:#0c131d">
            <div style="font-weight:700;margin-bottom:6px">โอนเข้าบัญชีธนาคาร</div>
            <div style="display:grid;grid-template-columns:140px 1fr;gap:6px">
              <div>ธนาคาร</div><div>${bankName}</div>
              <div>เลขบัญชี</div><div>${bankNo}</div>
              <div>ชื่อบัญชี</div><div>${bankAccName}</div>
            </div>
            <p style="color:var(--muted);margin:6px 0 0">จากนั้นอัปโหลดสลิป ระบบจะตรวจสอบจำนวนเงินอัตโนมัติและบวก POINT ให้</p>
          </div>
          <label>อัปโหลดสลิป<input type="file" id="ppSlip" accept="image/*" style="width:100%"/></label>
          <div id="ppQRStatus" style="font-size:12px;color:var(--muted)"></div>
          <button id="ppSubmit" class="btn btn-outline">ยืนยันการเติมเงิน</button>
          <p style="color:var(--muted);margin:0">หากอ่านจำนวนเงินไม่ได้ ระบบจะใช้ค่าเริ่มต้น (เดโม)</p>
        </div>`;
      openModal('PROMPTPAY', html);
      const readAsDataURL = f=>new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(f); });
      try{
        const fileInput = document.getElementById('ppSlip');
        const submitBtn = document.getElementById('ppSubmit');
        if(submitBtn){ submitBtn.disabled = true; }
        if(fileInput){
          fileInput.addEventListener('change', async ()=>{
            const has = !!fileInput.files && fileInput.files.length > 0;
            const statusEl = document.getElementById('ppQRStatus');
            if(!has){ if(submitBtn) submitBtn.disabled = true; if(statusEl) statusEl.textContent=''; return; }
            try{
              await loadJsQR();
              const f = fileInput.files[0];
              const dataUrl = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(f); });
              const img = new Image();
              await new Promise((res,rej)=>{ img.onload=()=>res(); img.onerror=rej; img.src=dataUrl; });
              const cv = document.createElement('canvas');
              cv.width = img.naturalWidth; cv.height = img.naturalHeight;
              const cx = cv.getContext('2d');
              cx.drawImage(img,0,0);
              const imgData = cx.getImageData(0,0,cv.width,cv.height);
              const qr = window.jsQR(imgData.data, imgData.width, imgData.height);
              const ok = !!(qr && qr.data && /000201/.test(qr.data));
              if(statusEl){ statusEl.textContent = ok ? 'ตรวจพบคิวอาร์โค้ดสลิปธนาคาร' : 'ไม่พบคิวอาร์โค้ดที่ถูกต้อง'; statusEl.style.color = ok ? '#35c46a' : '#ff6b6b'; }
              if(submitBtn){ submitBtn.disabled = !ok; }
            }catch{
              if(statusEl){ statusEl.textContent = 'ไม่สามารถตรวจสอบคิวอาร์โค้ดได้'; statusEl.style.color = '#ffb84d'; }
              if(submitBtn){ submitBtn.disabled = true; }
            }
          });
        }
      }catch{}
      document.getElementById('ppSubmit').addEventListener('click', async ()=>{
        try{
          const file = document.getElementById('ppSlip').files[0];
          if(!file){ openModal('PROMPTPAY','<p>กรุณาอัปโหลดสลิปก่อน</p>'); return; }
          const slipData = file ? await readAsDataURL(file) : undefined;
          const resp = await fetch('/topup/promptpay', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId: user.id, slipData }) });
          const json = await resp.json();
          if(resp.ok && json.success){
            const added = typeof json.detectedAmount === 'number' ? json.detectedAmount : undefined;
            const msg = added ? `เติมเข้า: ${added} POINT<br/>ยอดคงเหลือ: ${json.balance} POINT` : `ยอดคงเหลือ: ${json.balance} POINT`;
            openModal('สำเร็จ', `<p>${msg}</p>`);
            onTopupDone(json.balance);
          } else {
            openModal('ไม่สำเร็จ', `<p>${json.message||'ไม่สามารถดำเนินการได้'}</p>`);
          }
        }catch(err){ openModal('ข้อผิดพลาด', '<p>เกิดข้อผิดพลาด กรุณาลองใหม่</p>'); }
      });
    });
  }

  // Shop handlers (shop.html)
  try{
    const path = (location.pathname.split('/').pop() || '').toLowerCase();
    if(path === 'shop.html'){
      const raw = localStorage.getItem('discordUser');
      const me = (()=>{ try{return JSON.parse(raw||'null')}catch{return null} })();
      const cards = Array.from(document.querySelectorAll('.card.product'));
      const markPurchased = (card) => {
        try{
          const btn = card.querySelector('.btn-buy');
          if(btn){ btn.disabled = true; btn.textContent = 'ซื้อแล้ว'; btn.classList.add('btn-bought'); btn.classList.add('btn'); }
          const qty = card.querySelector('input[type="number"]');
          if(qty){ qty.value = 1; qty.disabled = true; }
        }catch{}
      };
      const markUnpurchased = (card) => {
        try{
          const btn = card.querySelector('.btn-buy');
          if(btn){ btn.disabled = false; btn.textContent = 'BUY'; btn.classList.remove('btn-bought'); btn.classList.add('btn'); }
          const qty = card.querySelector('input[type="number"]');
          if(qty){ qty.value = 1; qty.disabled = true; }
        }catch{}
      };
      const applyPurchasedState = (purchasedSet) => {
        cards.forEach(card => {
          const pid = card.getAttribute('data-product-id');
          if(purchasedSet.has(pid)) markPurchased(card); else markUnpurchased(card);
        });
      };
      const refreshPurchasedFromServer = async () => {
        try{
          if(!me){ applyPurchasedState(new Set()); return; }
          const r = await fetch(`/history?userId=${encodeURIComponent(me.id)}`);
          const j = await r.json().catch(()=>({ success:false }));
          if(r.ok && j && j.success){
            const set = new Set((j.history && Array.isArray(j.history.purchases)) ? j.history.purchases.map(x=>String(x.productId)) : []);
            applyPurchasedState(set);
          } else {
            applyPurchasedState(new Set());
          }
        }catch{ applyPurchasedState(new Set()); }
      };
      refreshPurchasedFromServer();
      cards.forEach(card => {
        const btn = card.querySelector('.btn-buy');
        if(btn && !btn.dataset.bound){
          btn.dataset.bound = '1';
          btn.addEventListener('click', (e)=>{
            e.preventDefault();
            if(!me){ window.location.href = './login.html'; return; }
            const pid = card.getAttribute('data-product-id');
            const title = (card.querySelector('h3')||{}).textContent || 'ยืนยันการซื้อ';
            const html = `
              <div style="display:grid;gap:10px">
                <div style="font-weight:700">${title}</div>
                <label>ชื่อในเกม<input id="shopFName" style="width:100%;background:#0b0f14;border:1px solid #2a2e31;border-radius:8px;padding:10px;color:#e7efff" placeholder="ชื่อ" required/></label>
                <label>นามสกุลในเกม<input id="shopLName" style="width:100%;background:#0b0f14;border:1px solid #2a2e31;border-radius:8px;padding:10px;color:#e7efff" placeholder="นามสกุล" required/></label>
                <label>UID<input id="shopUID" style="width:100%;background:#0b0f14;border:1px solid #2a2e31;border-radius:8px;padding:10px;color:#e7efff" placeholder="UID" required/></label>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">
                  <button id="shopCancel" class="btn btn-outline">ยกเลิก</button>
                  <button id="shopConfirm" class="btn">ยืนยันซื้อ</button>
                </div>
              </div>`;
            try{ openModal('ยืนยันการซื้อ', html); }catch{}
            const cancel = document.getElementById('shopCancel');
            if(cancel){ cancel.addEventListener('click', ()=>{ try{ document.getElementById('modalHost').style.display='none'; }catch{} }); }
            const confirm = document.getElementById('shopConfirm');
            if(confirm){
              confirm.addEventListener('click', async ()=>{
                try{
                  confirm.disabled = true;
                  const gameFirstName = (document.getElementById('shopFName').value||'').trim();
                  const gameLastName = (document.getElementById('shopLName').value||'').trim();
                  const gameUID = (document.getElementById('shopUID').value||'').trim();
                  if(!gameFirstName || !gameLastName || !gameUID){
                    try{ openModal('กรอกข้อมูลไม่ครบ', '<p>กรุณากรอก ชื่อ, นามสกุล และ UID ให้ครบ</p>'); }catch{}
                    return;
                  }
                  const r = await fetch('/shop/purchase', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ userId: me.id, productId: pid, gameFirstName, gameLastName, gameUID }) });
                  const j = await r.json().catch(()=>({ success:false }));
                  if(r.ok && j && j.success){
                    await refreshPurchasedFromServer();
                    try{ openModal('สำเร็จ', `<p>ซื้อ ${title} สำเร็จ</p>`); }catch{}
                  } else if(r.status === 409){
                    await refreshPurchasedFromServer();
                    try{ openModal('ซื้อแล้ว', '<p>คุณได้ซื้อสินค้านี้ไปแล้ว</p>'); }catch{}
                  } else if(r.status === 402){
                    try{ openModal('พอยต์ไม่พอ', '<p>พอยต์ไม่เพียงพอ</p>'); }catch{}
                  } else {
                    const msg = (j && j.message) || 'ไม่สามารถทำรายการได้';
                    try{ openModal('ไม่สำเร็จ', `<p>${msg}</p>`); }catch{}
                  }
                }catch{
                  try{ openModal('ข้อผิดพลาด', '<p>เกิดข้อผิดพลาด กรุณาลองใหม่</p>'); }catch{}
                }finally{ try{ confirm.disabled = false; }catch{} }
              });
            }
          });
        }
      });
    }
  }catch{}

  const btnTW = document.getElementById('btnTrueWallet');
  if(btnTW){
    btnTW.addEventListener('click', (e)=>{
      e.preventDefault();
      if(!user){ openModal('TrueWallet Gift','<p>กรุณาเข้าสู่ระบบก่อน</p>'); return; }
      const html = `
        <div style="display:grid;gap:10px">
          <div style="padding:10px;border:1px dashed var(--border);border-radius:8px;background:#0c131d">
            <div style="font-weight:700;margin-bottom:6px">เติมเงานผ่านซองอังเปา</div>
            <p style="color:var(--muted);margin:6px 0 0">วิธีใช้งาน</p>
            <img id="twImg" src="https://img2.pic.in.th/pic/-TrueMoney-1024x652.png" alt="TrueWallet Gift" style="max-width:100%;height:auto;cursor:zoom-in"/>
            <p style="color:var(--muted);margin:6px 0 0">วางลิงก์ซองอั่งเปาเพื่อให้ระบบตรวจสอบอัตโนมัติ</p>
          </div>
          <label>ลิงก์ซองอั่งเปา<input type="url" id="twLink" placeholder="https://gift.truemoney.com/campaign/?v=..." style="width:100%;background:#0b0f14;border:1px solid #2a2e31;border-radius:8px;padding:10px;color:#e7efff"/></label>
          <button id="twSubmit" class="btn btn-outline">ยืนยันการเติมเงิน</button>
          <p style="color:var(--muted);margin:0">ระบบจะตรวจสอบและบวก POINT อัตโนมัติ</p>
        </div>`;
      openModal('TrueWallet Gift', html);
      // Enable image viewer on click
      try{
        const img = document.getElementById('twImg');
        if(img){ img.addEventListener('click', ()=> openImageViewer(img.src)); }
      }catch{}
      document.getElementById('twSubmit').addEventListener('click', async ()=>{
        try{
          const link = (document.getElementById('twLink').value||'').trim();
          if(!link){ openModal('TRUE WALLET','<p>กรุณากรอกลิงก์ซองอั่งเปา</p>'); return; }
          // Start auto job
          const start = await fetch('/topup/truewallet/auto', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId: user.id, envelopeLink: link }) });
          const sj = await start.json();
          if(!start.ok || !sj.success){ openModal('ไม่สำเร็จ', `<p>${(sj&&sj.message)||'ไม่สามารถเริ่มการตรวจสอบได้'}</p>`); return; }
          const jobId = sj.jobId;
          openModal('กำลังตรวจสอบ', '<p>กำลังตรวจสอบการชำระเงิน กรุณารอสักครู่…</p>');
          // Poll status
          const poll = async () => {
            try{
              const r = await fetch(`/topup/truewallet/status?jobId=${encodeURIComponent(jobId)}`);
              const j = await r.json();
              if(r.ok && j && j.success){
                if(j.status === 'pending'){
                  setTimeout(poll, 1500);
                } else if(j.status === 'success'){
                  openModal('สำเร็จ', `<p>ยอดคงเหลือ: ${j.balance} POINT</p>`);
                  onTopupDone(j.balance);
                } else {
                  openModal('ไม่สำเร็จ', '<p>การชำระเงินล้มเหลวหรือไม่สำเร็จ</p>');
                }
              } else {
                openModal('ไม่สำเร็จ', `<p>${(j&&j.message)||'ไม่สามารถตรวจสอบสถานะได้'}</p>`);
              }
            }catch{
              openModal('ไม่สำเร็จ', '<p>ไม่สามารถตรวจสอบสถานะได้</p>');
            }
          };
          setTimeout(poll, 1500);
        }catch(err){ openModal('ข้อผิดพลาด', '<p>เกิดข้อผิดพลาด กรุณาลองใหม่</p>'); }
      });
    });
  }
};

// Ensure UI handlers are initialized
if (document.readyState !== 'loading') {
  try { initUI(); } catch (e) {}
} else {
  document.addEventListener('DOMContentLoaded', () => { try { initUI(); } catch (e) {} });
}
