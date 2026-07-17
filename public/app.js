async function apiFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
}

async function getMe() {
  const res = await apiFetch('/api/me');
  if (res.status === 401) return null;
  return res.json();
}

async function requireLogin(redirectTo = '/login.html') {
  const me = await getMe();
  if (!me) {
    window.location.href = redirectTo;
    return null;
  }
  return me;
}

async function logout() {
  await apiFetch('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

function renderNav(me, active) {
  const nav = document.createElement('nav');

  const brand = document.createElement('span');
  brand.className = 'brand';
  brand.textContent = 'Movie Catalog';
  nav.appendChild(brand);

  const link = (href, label, key) => {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    if (key === active) a.style.textDecoration = 'underline';
    return a;
  };

  nav.appendChild(link('/index.html', '电影列表', 'movies'));
  if (me.can_add) {
    nav.appendChild(link('/add-movie.html', '添加电影', 'add-movie'));
  }
  if (me.role === 'admin') {
    nav.appendChild(link('/admin-users.html', '用户管理', 'admin-users'));
  }
  nav.appendChild(link('/change-password.html', '修改密码', 'change-password'));

  const who = document.createElement('span');
  who.textContent = `${me.username} (${me.role === 'admin' ? '管理员' : '用户'})`;
  nav.appendChild(who);

  const logoutBtn = document.createElement('button');
  logoutBtn.textContent = '退出';
  logoutBtn.addEventListener('click', logout);
  nav.appendChild(logoutBtn);

  document.body.prepend(nav);
}
