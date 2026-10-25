import { get, post } from '/js/api.js';

function show(section) {
  document.getElementById('account-signed-out').classList.toggle('hidden', section !== 'out');
  document.getElementById('account-signed-in').classList.toggle('hidden', section !== 'in');
}

async function init() {
  let user = null;
  try {
    const res = await get('/auth/me');
    user = res.user;
  } catch {
    show('out');
    return;
  }

  show('in');
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
  document.getElementById('account-name').textContent = fullName || user.username;
  document.getElementById('account-meta').textContent = `${user.username} · ${user.email}`;

  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await post('/auth/logout');
    } finally {
      location.href = '/';
    }
  });
}
init();
