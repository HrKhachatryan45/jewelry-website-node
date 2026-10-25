// Port of views.initiate_payment (card / ARCA iPay) + card_success status check.
import env from '../config/env.js';

async function postForm(url, data) {
  const body = new URLSearchParams(data).toString();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
  });
  return res.json();
}

// register.do — returns { orderId, formUrl } on success.
export async function registerOrder(order) {
  const amountLumas = Math.round(Number(order.total) * 100);
  const data = await postForm(env.arca.registerUrl, {
    userName: env.arca.username,
    password: env.arca.password,
    orderNumber: String(order.id),
    amount: amountLumas,
    currency: '051',
    returnUrl: env.arca.returnUrl,
    description: `Order ${order.id}`,
    language: 'hy',
  });
  if (Number(data.errorCode) === 0) {
    return { ok: true, orderId: data.orderId || '', formUrl: data.formUrl || '' };
  }
  return { ok: false, errorMessage: data.errorMessage || 'Անհայտ սխալ' };
}

// getOrderStatusExtended.do — orderStatus 2 == fully paid.
export async function getOrderStatus(arcaOrderId, language = 'hy') {
  return postForm(env.arca.statusUrl, {
    userName: env.arca.username,
    password: env.arca.password,
    orderId: arcaOrderId,
    language,
  });
}
