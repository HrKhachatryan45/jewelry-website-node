import { api, get } from '/js/api.js';

const params = new URLSearchParams(location.search);
const nextUrl = params.get('next') || '/account';

function showTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('login-form').classList.toggle('hidden', !isLogin);
  document.getElementById('register-form').classList.toggle('hidden', isLogin);
  document.getElementById('tab-login').classList.toggle('active', isLogin);
  document.getElementById('tab-register').classList.toggle('active', !isLogin);
  hideAlert();
  clearErrors();
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach((el) => {
    el.classList.remove('show');
    el.textContent = '';
  });
  document.querySelectorAll('.auth-input').forEach((el) => el.classList.remove('error'));
}

function showAlert(message) {
  const alert = document.getElementById('form-alert');
  alert.textContent = message;
  alert.classList.remove('hidden');
}

function hideAlert() {
  document.getElementById('form-alert').classList.add('hidden');
}

function fieldError(name, message) {
  const el = document.querySelector(`.field-error[data-for="${name}"]`);
  if (el) {
    el.textContent = message;
    el.classList.add('show');
  }
  const input = document.querySelector(`.auth-input[id*="${name}"]`);
  if (input) input.classList.add('error');
}

function setBusy(btn, busy) {
  const text = btn.querySelector('.btn-text');
  if (busy) {
    btn.dataset.orig = text.textContent;
    btn.classList.add('pointer-events-none', 'opacity-70');
    text.innerHTML = '<span class="animate-pulse">Սպասեք...</span>';
  } else {
    btn.classList.remove('pointer-events-none', 'opacity-70');
    text.textContent = btn.dataset.orig || '';
  }
}

function handleError(e) {
  clearErrors();
  if (e.data && e.data.errors) {
    Object.entries(e.data.errors).forEach(([field, msg]) => fieldError(field, msg));
    showAlert('Խնդրում ենք ուղղել նշված դաշտերը։');
  } else {
    const map = { 401: 'Մուտքանունը կամ գաղտնաբառը սխալ է։', 409: 'Այս մուտքանունը կամ էլ. փոստը արդեն օգտագործվում է։' };
    showAlert(map[e.status] || e.message || 'Սխալ տեղի ունեցավ։ Փորձեք կրկին։');
  }
}

async function init() {
  // Already signed in? Go straight to the requested page.
  try {
    await get('/auth/me');
    location.href = nextUrl;
    return;
  } catch {
    /* not logged in — show the forms */
  }

  document.getElementById('tab-login').addEventListener('click', () => showTab('login'));
  document.getElementById('tab-register').addEventListener('click', () => showTab('register'));
  if (params.get('tab') === 'register') showTab('register');

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    const btn = document.getElementById('login-submit');
    setBusy(btn, true);
    try {
      await api('/auth/login', {
        method: 'POST',
        body: {
          username: document.getElementById('login-username').value.trim(),
          password: document.getElementById('login-password').value,
        },
      });
      location.href = nextUrl;
    } catch (err) {
      handleError(err);
      setBusy(btn, false);
    }
  });

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    const btn = document.getElementById('register-submit');
    setBusy(btn, true);
    try {
      await api('/auth/register', {
        method: 'POST',
        body: {
          username: document.getElementById('reg-username').value.trim(),
          email: document.getElementById('reg-email').value.trim(),
          password: document.getElementById('reg-password').value,
          firstName: document.getElementById('reg-firstname').value.trim(),
          lastName: document.getElementById('reg-lastname').value.trim(),
        },
      });
      location.href = nextUrl;
    } catch (err) {
      handleError(err);
      setBusy(btn, false);
    }
  });
}
init();
