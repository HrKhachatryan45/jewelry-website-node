import prisma from '../config/prisma.js';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import env from '../config/env.js';
import { serializeOrder } from '../services/serializers.js';
import { buildCartView } from './cartController.js';
import { getCart, saveCart } from '../middleware/cart.js';
import { sendOrderEmail, Templates } from '../services/email.js';
import * as idram from '../services/idram.js';
import * as arca from '../services/arca.js';
import { setAuthCookie, signToken } from '../middleware/auth.js';

function round2(n) {
  return Math.round(n * 100) / 100;
}

// GET /api/checkout  (views.checkout) — order summary + prefill for retry
export async function checkoutContext(req, res) {
  const cart = await getCart(req.cartId);
  const isBuyNow = Object.keys(cart.buyNow || {}).length > 0;
  const active = isBuyNow ? cart.buyNow : cart.items || {};
  if (Object.keys(active).length === 0) {
    return res.status(400).json({ error: 'Cart is empty', redirect: '/cart/' });
  }
  const enriched = await buildCartView(active);

  let prefill = req.user
    ? {
      full_name: [req.user.firstName, req.user.lastName].filter(Boolean).join(' '),
    }
    : {};
  if (req.query.order_id) {
    const prev = await prisma.order.findUnique({ where: { id: parseInt(req.query.order_id, 10) } });
    if (prev) {
      prefill = {
        full_name: prev.fullName,
        phone: prev.phone,
        delivery_type: prev.deliveryType,
        city: prev.city,
        address: prev.address,
        order_note: prev.orderNote,
      };
    }
  }
  res.json({ ...enriched, is_buy_now: isBuyNow, prefill });
}

// POST /api/checkout  (views.checkout POST)
export async function placeOrder(req, res) {
  const b = req.body;
  const cart = await getCart(req.cartId);
  const isBuyNow = Object.keys(cart.buyNow || {}).length > 0;
  const active = isBuyNow ? cart.buyNow : cart.items || {};
  if (Object.keys(active).length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  let deliveryPrice = Number(b.delivery_price);
  if (!Number.isFinite(deliveryPrice)) deliveryPrice = 0;

  const total = round2(
    Object.values(active).reduce((s, v) => s + Number(v.price) * v.quantity, 0) + deliveryPrice
  );

  const email = String(b.email || '').trim().toLowerCase();
  let account = req.user || null;
  let accountCreated = false;

  if (!account) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        error: 'An account already uses this email. Sign in before placing your order.',
        loginRequired: true,
      });
    }
  }

  const setupPasswordHash = account ? null : await bcrypt.hash(randomBytes(32).toString('hex'), 12);
  let order;
  try {
    ({ order, account, accountCreated } = await prisma.$transaction(async (tx) => {
      let customer = account;
      if (!customer) {
        customer = await tx.user.create({
          data: {
            username: `customer_${randomBytes(12).toString('hex')}`,
            email,
            password: setupPasswordHash,
            firstName: String(b.full_name || '').trim().split(/\s+/)[0] || '',
            lastName: String(b.full_name || '').trim().split(/\s+/).slice(1).join(' '),
            role: 'customer',
          },
        });
      }

      const createdOrder = await tx.order.create({
        data: {
          fullName: b.full_name || '',
          email,
          phone: b.phone || '',
          deliveryType: b.delivery_type || 'pickup',
          paymentMethod: b.payment_method || 'cash',
          city: b.city || '',
          address: b.address || '',
          lat: b.lat || '',
          lng: b.lng || '',
          deliveryPrice,
          deliveryTime: b.delivery_time || '',
          orderNote: b.notes || b.order_note || '',
          total,
          totalAmountAmd: total,
          userId: customer.id,
        },
      });

      for (const entry of Object.values(active)) {
        const dbItem = await tx.menuItem.findUnique({ where: { id: parseInt(entry.pk, 10) } });
        if (!dbItem) continue;
        await tx.orderItem.create({
          data: {
            orderId: createdOrder.id,
            menuItemId: dbItem.id,
            name: dbItem.name,
            price: Number(entry.price),
            quantity: entry.quantity,
            weight: entry.weight != null ? Number(entry.weight) : null,
            material: entry.material || null,
            customText: entry.custom_text || null,
            size: entry.size || null,
            note: entry.note || '',
          },
        });
      }
      return { order: createdOrder, account: customer, accountCreated: !req.user };
    }));
  } catch (error) {
    if (error?.code === 'P2002' && String(error.meta?.target).includes('email')) {
      return res.status(409).json({
        error: 'An account already uses this email. Sign in before placing your order.',
        loginRequired: true,
      });
    }
    throw error;
  }

  if (accountCreated) {
    setAuthCookie(res, signToken(account, { passwordSetupRequired: true }));
  }

  const method = order.paymentMethod;
  // Clear cart only for immediate (non-online) payments.
  if (!['idram', 'card'].includes(method)) {
    await saveCart({ cartId: req.cartId, ...(isBuyNow ? { buyNow: {} } : { items: {} }) });
  }

  if (method === 'cash') {
    const withItems = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true },
    });
    sendOrderEmail(withItems.email, withItems, Templates.OrderReceived);
    if (env.email.ownerEmails.length) sendOrderEmail(env.email.ownerEmails, withItems, Templates.OrderNotification);
  }

  if (['idram', 'card'].includes(method)) {
    return res.status(201).json({ order: { id: order.id }, accountCreated, payment: { method, initiate: `/api/payments/initiate/${order.id}` } });
  }
  return res.status(201).json({
    order: { id: order.id },
    accountCreated,
    redirect: method === 'cash'
      ? `/account/orders/${order.id}`
      : `/payment/order-success.html?pm=${method}&id=${order.id}`,
  });
}

// GET /api/orders/:id/status  (views.order_success JSON)
export async function orderStatus(req, res) {
  const order = await prisma.order.findUnique({
    where: { id: parseInt(req.params.id, 10) },
    include: { items: true },
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ order: serializeOrder(order, order.items) });
}

// Customer order history is always scoped to the authenticated account.
export async function accountOrders(req, res) {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      items: {
        include: { menuItem: { select: { category: true, image: true, tryOnAsset: true } } },
      },
    },
  });
  res.json({ orders: orders.map((order) => serializeOrder(order, order.items)) });
}

export async function accountOrder(req, res) {
  const id = parseInt(req.params.id, 10);
  const order = await prisma.order.findFirst({
    where: { id, userId: req.user.id },
    include: {
      items: {
        include: { menuItem: { select: { category: true, image: true, tryOnAsset: true } } },
      },
    },
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ order: serializeOrder(order, order.items) });
}

export async function cancelAccountOrder(req, res) {
  const id = parseInt(req.params.id, 10);
  const result = await prisma.order.updateMany({
    where: {
      id,
      userId: req.user.id,
      status: 'new',
      isPaid: false,
      paymentMethod: { notIn: ['idram', 'card'] },
    },
    data: { status: 'cancelled' },
  });

  if (result.count === 0) {
    const order = await prisma.order.findFirst({
      where: { id, userId: req.user.id },
      select: { id: true },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    return res.status(409).json({ error: 'This order can no longer be cancelled online. Please contact us for help.' });
  }

  res.json({ success: true, status: 'cancelled' });
}

// GET /api/payments/initiate/:orderId  (views.initiate_payment)
export async function initiatePayment(req, res) {
  const order = await prisma.order.findUnique({ where: { id: parseInt(req.params.orderId, 10) } });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (order.paymentMethod === 'idram') {
    return res.json({
      method: 'idram',
      paymentUrl: idram.IDRAM_PAYMENT_URL,
      params: idram.buildPaymentParams(order),
    });
  }
  if (order.paymentMethod === 'card') {
    if (order.arcaOrderId && order.arcaFormUrl) {
      return res.json({ method: 'card', formUrl: order.arcaFormUrl });
    }
    const result = await arca.registerOrder(order);
    if (result.ok) {
      await prisma.order.update({
        where: { id: order.id },
        data: { arcaOrderId: result.orderId, arcaFormUrl: result.formUrl },
      });
      return res.json({ method: 'card', formUrl: result.formUrl });
    }
    return res.status(502).json({
      error: `Վճարման համակարգի սխալ: ${result.errorMessage}`,
      redirect: `/payment/order-success.html?pm=card_fail&id=${order.id}`,
    });
  }
  res.json({ method: order.paymentMethod, redirect: `/payment/order-success.html?pm=${order.paymentMethod}&id=${order.id}` });
}

// POST /api/payments/idram/result  (views.idram_result) — server-to-server, returns "OK"/"FAIL"
export async function idramResult(req, res) {
  const body = req.body || {};

  if (body.EDP_PRECHECK === 'YES') {
    const pre = idram.verifyPrecheck(body);
    if (!pre.ok) return res.type('text/plain').send('FAIL');
    const exists = await prisma.order.findFirst({
      where: { id: parseInt(pre.billNo, 10), totalAmountAmd: pre.amount, onlinePaymentStatus: 'pending' },
      select: { id: true },
    });
    return res.type('text/plain').send(exists ? 'OK' : 'FAIL');
  }

  const check = idram.verifyChecksum(body);
  if (!check.ok) return res.type('text/plain').send('FAIL');

  await prisma.order.updateMany({
    where: { id: parseInt(check.billNo, 10), onlinePaymentStatus: 'pending' },
    data: { onlinePaymentStatus: 'paid', isPaid: true, idramTransactionId: check.transId },
  });
  return res.type('text/plain').send('OK');
}

async function markPaidAndNotify(order) {
  if (order.onlinePaymentStatus === 'paid') return order;
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { onlinePaymentStatus: 'paid', isPaid: true },
    include: { items: true },
  });
  if (!updated.emailSent) {
    sendOrderEmail(updated.email, updated, Templates.OrderPaymentSuccess);
    if (env.email.ownerEmails.length) sendOrderEmail(env.email.ownerEmails, updated, Templates.OrderNotification);
    await prisma.order.update({ where: { id: updated.id }, data: { emailSent: true } });
  }
  return updated;
}

// GET /api/payments/idram/success  (views.idram_success)
export async function idramSuccess(req, res) {
  const billNo = req.query.EDP_BILL_NO;
  const order = billNo ? await prisma.order.findUnique({ where: { id: parseInt(billNo, 10) } }) : null;
  if (order && order.onlinePaymentStatus === 'paid') {
    await saveCart({ cartId: req.cartId, items: {} });
    await markPaidAndNotify(order);
  }
  res.redirect(`/payment/idram-success.html?order_id=${order ? order.id : ''}`);
}

// GET /api/payments/idram/fail  (views.idram_fail)
export async function idramFail(req, res) {
  const billNo = req.query.EDP_BILL_NO;
  const order = billNo ? await prisma.order.findUnique({ where: { id: parseInt(billNo, 10) } }) : null;
  if (order && order.onlinePaymentStatus === 'failed' && !order.emailSent) {
    sendOrderEmail(order.email, order, Templates.OrderPaymentFailed);
  }
  res.redirect(`/payment/idram-fail.html?order_id=${order ? order.id : ''}`);
}

// GET /api/payments/arca/callback  (views.card_success)
export async function cardSuccess(req, res) {
  const arcaOrderId = req.query.orderId || '';
  const order = await prisma.order.findFirst({ where: { arcaOrderId } });
  if (!order) return res.redirect(`/payment/card-fail.html?order_id=`);

  const data = await arca.getOrderStatus(arcaOrderId, req.query.lang || 'hy');
  const status = data.orderStatus; // 2 = fully paid

  if (status === 2) {
    await saveCart({ cartId: req.cartId, items: {} });
    await markPaidAndNotify(order);
    return res.redirect(`/payment/card-success.html?order_id=${order.id}`);
  }

  if (order.onlinePaymentStatus !== 'failed') {
    await prisma.order.update({ where: { id: order.id }, data: { onlinePaymentStatus: 'failed' } });
  }
  if (!order.emailSent) sendOrderEmail(order.email, order, Templates.OrderPaymentFailed);
  res.redirect(`/payment/card-fail.html?order_id=${order.id}`);
}

// GET /api/payments/arca/fail  (views.card_fail)
export async function cardFail(req, res) {
  const order = req.query.order_id
    ? await prisma.order.findUnique({ where: { id: parseInt(req.query.order_id, 10) } })
    : null;
  if (order && !order.emailSent) sendOrderEmail(order.email, order, Templates.OrderPaymentFailed);
  res.redirect(`/payment/card-fail.html?order_id=${order ? order.id : ''}`);
}
