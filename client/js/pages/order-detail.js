import { get, post, money, fmtDate } from '/js/api.js';
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

function paymentStatus(order) {
  return order.isPaid || order.onlinePaymentStatus === 'paid'
    ? { text: 'Վճարված', className: 'border-green-700/20 bg-green-50 text-green-700' }
    : { text: 'Վճարումը սպասվում է', className: 'border-luxe-gold/30 bg-luxe-gold/5 text-luxe-gold' };
}

function canCancel(order) {
  return order.status === 'new'
    && !order.isPaid
    && !['idram', 'card'].includes(order.paymentMethod);
}

function renderItem(item) {
  const image = item.image
    ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" class="h-24 w-24 sm:h-32 sm:w-32 shrink-0 object-cover bg-[#f4f2ef]">`
    : '<div class="h-24 w-24 sm:h-32 sm:w-32 shrink-0 bg-[#f4f2ef] flex items-center justify-center text-[9px] uppercase tracking-widest text-foreground/30">Luxe</div>';

  return `
    <article class="flex gap-4 sm:gap-6 border-b border-border/10 py-6 last:border-0">
      ${image}
      <div class="min-w-0 flex-1">
        <div class="flex flex-col sm:flex-row sm:justify-between gap-2">
          <div>
            <h3 class="font-heading text-xl sm:text-2xl text-luxe-black">${escapeHtml(item.name)}</h3>
            <p class="mt-1 text-xs text-foreground/45">${money(item.price)} AMD · Քանակ՝ ${escapeHtml(item.quantity)}</p>
          </div>
          <p class="shrink-0 text-sm text-luxe-black">${money(item.subtotal)} AMD</p>
        </div>
        <div class="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[10px] uppercase tracking-wider text-foreground/45">
          ${item.materialDisplay ? `<span>Նյութ՝ ${escapeHtml(item.materialDisplay)}</span>` : ''}
          ${item.weight ? `<span>Քաշ՝ ${escapeHtml(item.weight)} գ</span>` : ''}
          ${item.size ? `<span>Չափս՝ ${escapeHtml(item.size)}</span>` : ''}
        </div>
        ${item.customText ? `<p class="mt-3 text-xs text-foreground/55">Փորագրություն՝ ${escapeHtml(item.customText)}</p>` : ''}
        ${item.note ? `<p class="mt-2 text-xs text-foreground/55">Նշում՝ ${escapeHtml(item.note)}</p>` : ''}
        ${item.tryOnAsset && item.tryOnCategory ? `<button type="button" data-try-on data-category="${escapeHtml(item.tryOnCategory)}" data-image="${escapeHtml(item.tryOnAsset)}" data-name="${escapeHtml(item.name)}" class="mt-4 text-[9px] uppercase tracking-[0.18em] text-luxe-gold hover:text-luxe-black">Վիրտուալ փորձել</button>` : ''}
      </div>
    </article>`;
}

function renderOrder(order) {
  const paid = paymentStatus(order);
  const cancelled = order.status === 'cancelled';
  const stages = [
    ['new', 'Ստացվել է'],
    ['confirmed', 'Հաստատվել է'],
    ['ready', 'Պատրաստ է'],
    ['delivered', 'Ավարտված է'],
  ];
  const currentStage = stages.findIndex(([status]) => status === order.status);
  const statusLine = cancelled
    ? '<p class="text-sm text-red-700">Պատվերը չեղարկված է</p>'
    : `<ol class="grid grid-cols-4 gap-2" aria-label="Պատվերի կարգավիճակ">${stages.map(([status, label], index) => {
      const complete = currentStage >= index;
      return `<li class="border-t-2 ${complete ? 'border-luxe-gold' : 'border-border/20'} pt-3 text-[9px] sm:text-[10px] uppercase tracking-wide ${complete ? 'text-luxe-black' : 'text-foreground/35'}">${label}</li>`;
    }).join('')}</ol>`;

  return `
    <header class="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
      <div>
        <span class="text-[10px] uppercase tracking-[0.35em] text-luxe-gold">Պատվերի ամփոփում</span>
        <h1 class="mt-2 font-heading text-3xl sm:text-4xl text-luxe-black">Պատվեր #${escapeHtml(order.id)}</h1>
        <p class="mt-2 text-xs text-foreground/45">${escapeHtml(fmtDate(order.createdAt))}</p>
      </div>
      <span class="self-start sm:self-auto border px-4 py-2 text-[9px] uppercase tracking-[0.15em] ${paid.className}">${paid.text}</span>
    </header>
    <div class="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 border border-border/10 bg-white p-5 sm:p-7">
      ${statusLine}
      ${canCancel(order) ? '<button type="button" data-cancel-order class="self-start border border-red-700/30 px-5 py-3 text-[9px] uppercase tracking-[0.16em] text-red-700 hover:bg-red-700 hover:text-white transition-colors">Չեղարկել պատվերը</button>' : ''}
    </div>
    <div class="grid lg:grid-cols-3 gap-6 lg:gap-8">
      <section class="lg:col-span-2 border border-border/10 bg-white">
        <div class="flex items-center justify-between border-b border-border/10 px-5 sm:px-7 py-5">
          <h2 class="font-heading text-xl sm:text-2xl text-luxe-black">Պատվիրված զարդեր</h2>
          <span class="text-[9px] uppercase tracking-widest text-foreground/40">${order.items.length} ապրանք</span>
        </div>
        <div class="px-5 sm:px-7">${order.items.length ? order.items.map(renderItem).join('') : '<p class="py-8 text-sm text-foreground/45">Ապրանքների տվյալները հասանելի չեն։</p>'}</div>
        ${order.orderNote ? `<div class="mx-5 sm:mx-7 mb-6 border-l-2 border-luxe-gold bg-[#faf9f7] p-4"><p class="text-[9px] uppercase tracking-widest text-luxe-gold">Պատվերի նշում</p><p class="mt-2 text-sm text-foreground/65">${escapeHtml(order.orderNote)}</p></div>` : ''}
      </section>
      <aside class="space-y-6">
        <section class="border border-border/10 bg-white p-5 sm:p-7">
          <h2 class="font-heading text-xl text-luxe-black">Գումարի մանրամասներ</h2>
          <dl class="mt-5 space-y-4 text-xs">
            <div class="flex justify-between gap-4 text-foreground/55"><dt>Ապրանքներ</dt><dd>${money(order.total - (Number(order.deliveryPrice) || 0))} AMD</dd></div>
            <div class="flex justify-between gap-4 text-foreground/55"><dt>Առաքում</dt><dd>${money(order.deliveryPrice)} AMD</dd></div>
            <div class="flex justify-between gap-4 border-t border-border/10 pt-4 text-sm font-medium text-luxe-black"><dt>Ընդամենը</dt><dd>${money(order.total)} AMD</dd></div>
          </dl>
        </section>
        <section class="border border-border/10 bg-white p-5 sm:p-7">
          <h2 class="font-heading text-xl text-luxe-black">Առաքում և վճարում</h2>
          <dl class="mt-5 space-y-4 text-xs">
            <div><dt class="text-[9px] uppercase tracking-widest text-foreground/35">Ստացման եղանակ</dt><dd class="mt-1 text-foreground/70">${escapeHtml(order.deliveryTypeDisplay || order.deliveryType)}</dd></div>
            <div><dt class="text-[9px] uppercase tracking-widest text-foreground/35">Վճարման եղանակ</dt><dd class="mt-1 text-foreground/70">${escapeHtml(order.paymentMethodDisplay || order.paymentMethod)}</dd></div>
            ${order.deliveryType === 'delivery' && (order.city || order.address) ? `<div><dt class="text-[9px] uppercase tracking-widest text-foreground/35">Հասցե</dt><dd class="mt-1 text-foreground/70">${escapeHtml([order.city, order.address].filter(Boolean).join(', '))}</dd></div>` : ''}
            ${order.deliveryTime ? `<div><dt class="text-[9px] uppercase tracking-widest text-foreground/35">Առաքման ժամ</dt><dd class="mt-1 text-foreground/70">${escapeHtml(order.deliveryTime)}</dd></div>` : ''}
            ${order.phone ? `<div><dt class="text-[9px] uppercase tracking-widest text-foreground/35">Հեռախոս</dt><dd class="mt-1"><a class="text-luxe-gold hover:underline" href="tel:${escapeHtml(order.phone)}">${escapeHtml(order.phone)}</a></dd></div>` : ''}
          </dl>
        </section>
      </aside>
    </div>`;
}

async function init() {
  const message = document.getElementById('order-detail-message');
  const content = document.getElementById('order-detail-content');
  const orderId = location.pathname.split('/').filter(Boolean).pop();
  if (!orderId || !/^\d+$/.test(orderId)) {
    message.textContent = 'Պատվերը չի գտնվել։';
    return;
  }

  try {
    const { order } = await get(`/account/orders/${encodeURIComponent(orderId)}`);
    let portraitUrl = null;
    try {
      ({ portraitUrl } = await get('/account/portrait'));
    } catch (error) {
      console.error('Could not load saved account portrait', error);
    }
    content.innerHTML = renderOrder(order);
    content.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-try-on]');
      if (button) {
        openTryOn({
          productCategory: button.dataset.category,
          productImageUrl: button.dataset.image,
          productName: button.dataset.name,
          portraitUrl,
        });
        return;
      }

      const cancelButton = event.target.closest('[data-cancel-order]');
      if (!cancelButton || !window.confirm('Չեղարկե՞լ այս պատվերը։')) return;
      cancelButton.disabled = true;
      cancelButton.textContent = 'Չեղարկվում է…';
      try {
        await post(`/account/orders/${encodeURIComponent(orderId)}/cancel`);
        location.reload();
      } catch (error) {
        message.textContent = error.data?.error || 'Պատվերը չեղարկել չհաջողվեց։ Թարմացրեք էջը և կրկին փորձեք։';
        message.classList.remove('hidden');
        cancelButton.disabled = false;
        cancelButton.textContent = 'Չեղարկել պատվերը';
      }
    });
    content.classList.remove('hidden');
    message.classList.add('hidden');
  } catch (error) {
    if (error.status === 401) {
      location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
      return;
    }
    message.textContent = error.status === 404
      ? 'Պատվերը չի գտնվել կամ հասանելի չէ։'
      : 'Պատվերը բեռնել չհաջողվեց։ Թարմացրեք էջը և կրկին փորձեք։';
  }
}

init();
