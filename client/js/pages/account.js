import { get, post, del, money, fmtDate } from '/js/api.js';
import { openTryOn } from '/js/tryon.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function orderMarkup(order) {
  const paid = order.isPaid || order.onlinePaymentStatus === 'paid';
  const tryOnItems = (order.items || []).filter((item) => item.tryOnAsset && item.tryOnCategory);

  return `
    <article class="border border-border/10 bg-white p-5 sm:p-7">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 class="text-sm font-medium text-luxe-black">Պատվեր #${order.id}</h3>
          <p class="mt-2 text-xs text-foreground/45">${escapeHtml(fmtDate(order.createdAt))} · ${escapeHtml(order.statusDisplay)}</p>
        </div>
        <div class="flex items-center justify-between sm:justify-end gap-5">
          <span class="text-sm text-luxe-black">${money(order.total)} AMD</span>
          <span class="px-3 py-1 text-[9px] uppercase tracking-widest border ${paid ? 'border-green-700/20 text-green-700' : 'border-luxe-gold/30 text-luxe-gold'}">${paid ? 'Վճարված' : 'Վճարումը սպասվում է'}</span>
        </div>
      </div>
      ${tryOnItems.length ? `
        <div class="mt-5 border-t border-border/10 pt-4">
          <p class="mb-3 text-[9px] uppercase tracking-[0.18em] text-foreground/40">Վիրտուալ փորձել</p>
          <div class="flex flex-wrap gap-2">
            ${tryOnItems.map((item) => `
              <button type="button" data-try-on data-category="${escapeHtml(item.tryOnCategory)}" data-image="${escapeHtml(item.tryOnAsset)}" data-name="${escapeHtml(item.name)}" class="border border-luxe-gold/30 px-3 py-2 text-[9px] uppercase tracking-wider text-luxe-gold hover:bg-luxe-gold hover:text-white transition-colors">
                ${escapeHtml(item.name)}
              </button>
            `).join('')}
          </div>
        </div>` : ''}
      <a href="/account/orders/${encodeURIComponent(order.id)}" class="mt-5 inline-flex items-center gap-2 border-t border-border/10 pt-4 text-[10px] uppercase tracking-[0.18em] text-luxe-gold hover:text-luxe-black">
        Դիտել պատվերի մանրամասները <span aria-hidden="true">→</span>
      </a>
    </article>`;
}

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

  let portraitUrl = null;
  let previewUrl = null;
  const portraitPreview = document.getElementById('account-portrait-preview');
  const portraitPlaceholder = document.getElementById('account-portrait-placeholder');
  const portraitForm = document.getElementById('account-portrait-form');
  const portraitFile = document.getElementById('account-portrait-file');
  const portraitSave = document.getElementById('account-portrait-save');
  const portraitDelete = document.getElementById('account-portrait-delete');
  const portraitMessage = document.getElementById('account-portrait-message');
  const portraitFilename = document.getElementById('account-portrait-filename');
  const showPortrait = (src) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
    portraitUrl = src;
    portraitPreview.classList.toggle('hidden', !src);
    portraitPlaceholder.classList.toggle('hidden', Boolean(src));
    portraitPreview.src = src || '';
    portraitDelete.classList.toggle('hidden', !src);
  };

  try {
    const portrait = await get('/account/portrait');
    showPortrait(portrait.portraitUrl);
  } catch (error) {
    portraitMessage.textContent = error.data?.error || 'Դիմանկարը բեռնել չհաջողվեց։';
    portraitMessage.className = 'mt-3 text-xs text-red-600';
  }

  portraitFile.addEventListener('change', () => {
    const [file] = portraitFile.files || [];
    portraitMessage.textContent = '';
    portraitFilename.textContent = file?.name || 'JPEG, PNG կամ WebP, առավելագույնը՝ 10 ՄԲ';
    portraitSave.classList.toggle('hidden', !file);
    if (file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(file);
      portraitPreview.src = previewUrl;
      portraitPreview.classList.remove('hidden');
      portraitPlaceholder.classList.add('hidden');
    }
  });

  portraitForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const [file] = portraitFile.files || [];
    if (!file) return;
    portraitSave.disabled = true;
    portraitSave.textContent = 'Պահպանվում է…';
    portraitMessage.textContent = '';
    try {
      const formData = new FormData();
      formData.append('portrait', file);
      const result = await post('/account/portrait', formData);
      showPortrait(result.portraitUrl);
      portraitFile.value = '';
      portraitFilename.textContent = 'JPEG, PNG կամ WebP, առավելագույնը՝ 10 ՄԲ';
      portraitSave.classList.add('hidden');
      portraitMessage.textContent = 'Դիմանկարը պահպանվեց։ Այն հասանելի կլինի վիրտուալ փորձի պատուհանում։';
      portraitMessage.className = 'mt-3 text-xs text-green-700';
    } catch (error) {
      portraitMessage.textContent = error.data?.error || 'Դիմանկարը պահպանել չհաջողվեց։';
      portraitMessage.className = 'mt-3 text-xs text-red-600';
    } finally {
      portraitSave.disabled = false;
      portraitSave.textContent = 'Պահպանել դիմանկարը';
    }
  });

  portraitDelete.addEventListener('click', async () => {
    if (!window.confirm('Ջնջե՞լ պահպանված դիմանկարը։')) return;
    portraitDelete.disabled = true;
    try {
      await del('/account/portrait');
      showPortrait(null);
      portraitFilename.textContent = 'JPEG, PNG կամ WebP, առավելագույնը՝ 10 ՄԲ';
      portraitMessage.textContent = 'Դիմանկարը ջնջվեց։';
      portraitMessage.className = 'mt-3 text-xs text-green-700';
    } catch (error) {
      portraitMessage.textContent = error.data?.error || 'Դիմանկարը ջնջել չհաջողվեց։';
      portraitMessage.className = 'mt-3 text-xs text-red-600';
    } finally {
      portraitDelete.disabled = false;
    }
  });

  const passwordSection = document.getElementById('account-password-section');
  const passwordForm = document.getElementById('account-password-form');
  const currentPasswordWrap = document.getElementById('account-current-password-wrap');
  const currentPasswordInput = document.getElementById('account-current-password');
  const passwordHelp = document.getElementById('account-password-help');
  const passwordMessage = document.getElementById('account-password-message');
  const setupRequired = user.passwordSetupRequired === true;
  passwordSection.classList.remove('hidden');
  passwordForm.dataset.setupRequired = String(setupRequired);
  currentPasswordWrap.classList.toggle('hidden', setupRequired);
  currentPasswordInput.required = !setupRequired;
  passwordHelp.textContent = setupRequired
    ? 'Ձեր հաշիվը ստեղծվել է պատվերը ձևակերպելիս։ Սահմանեք գաղտնաբառ՝ հետագայում հաշիվ մուտք գործելու համար։'
    : 'Փոխելու համար նախ մուտքագրեք ընթացիկ գաղտնաբառը։';
  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    passwordMessage.textContent = '';
    const password = document.getElementById('account-new-password').value;
    const confirmation = document.getElementById('account-confirm-password').value;
    if (password !== confirmation) {
      passwordMessage.textContent = 'Գաղտնաբառերը չեն համընկնում։';
      passwordMessage.className = 'text-xs text-red-600';
      return;
    }
    const body = { password };
    const currentPassword = document.getElementById('account-current-password').value;
    if (!passwordForm.dataset.setupRequired && currentPassword) body.currentPassword = currentPassword;
    try {
      await post('/auth/password', body);
      passwordForm.dataset.setupRequired = 'false';
      currentPasswordWrap.classList.remove('hidden');
      currentPasswordInput.required = true;
      currentPasswordInput.value = '';
      document.getElementById('account-new-password').value = '';
      document.getElementById('account-confirm-password').value = '';
      passwordMessage.textContent = 'Գաղտնաբառը պահպանվեց։';
      passwordMessage.className = 'text-xs text-green-700';
      passwordHelp.textContent = 'Փոխելու համար նախ մուտքագրեք ընթացիկ գաղտնաբառը։';
    } catch (error) {
      passwordMessage.textContent = error.data?.error || 'Գաղտնաբառը պահպանել չհաջողվեց։';
      passwordMessage.className = 'text-xs text-red-600';
    }
  });

  const ordersMessage = document.getElementById('account-orders-message');
  const ordersList = document.getElementById('account-orders-list');
  ordersList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-try-on]');
    if (!button) return;
    openTryOn({
      productCategory: button.dataset.category,
      productImageUrl: button.dataset.image,
      productName: button.dataset.name,
      portraitUrl,
    });
  });
  try {
    const { orders } = await get('/account/orders');
    ordersList.innerHTML = (orders || []).map(orderMarkup).join('');
    ordersMessage.textContent = orders?.length
      ? ''
      : 'Դուք դեռ պատվերներ չունեք։ Զարդերը դիտելու համար այցելեք հավաքածուն։';
  } catch (error) {
    console.error('Could not load account orders', error);
    ordersMessage.textContent = 'Պատվերները չհաջողվեց բեռնել։ Թարմացրեք էջը և կրկին փորձեք։';
  }

  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await post('/auth/logout');
    } finally {
      location.href = '/';
    }
  });
}
init();
