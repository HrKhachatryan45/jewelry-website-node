import crypto from 'node:crypto';
import env from '../config/env.js';
import prisma from '../config/prisma.js';

// Guest cart identity, replacing Django's session key.
export function ensureCartId(req, res) {
  let cartId = req.cookies?.[env.cartCookieName];
  if (!cartId) {
    cartId = crypto.randomUUID();
    res.cookie(env.cartCookieName, cartId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.isProd,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
  req.cartId = cartId;
  return cartId;
}

export async function getCart(cartId) {
  return prisma.cart.upsert({
    where: { cartId },
    create: { cartId, items: {}, buyNow: {} },
    update: {},
  });
}

export async function saveCart(cart) {
  const { cartId, items, buyNow, lang } = cart;
  return prisma.cart.update({
    where: { cartId },
    data: {
      ...(items !== undefined ? { items } : {}),
      ...(buyNow !== undefined ? { buyNow } : {}),
      ...(lang !== undefined ? { lang } : {}),
    },
  });
}
