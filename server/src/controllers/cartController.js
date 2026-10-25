import crypto from 'node:crypto';
import prisma from '../config/prisma.js';
import { mediaUrl, MATERIAL_LABELS } from '../services/serializers.js';
import { getCart, saveCart } from '../middleware/cart.js';

function cartKey(pk, variantId, material, customText, weight, size) {
  const optionString = `${variantId}-${material}-${customText}-${weight}-${size}`;
  return crypto.createHash('md5').update(`${pk}-${optionString}`).digest('hex');
}

function clampQty(n) {
  return Math.max(1, Math.min(20, parseInt(n, 10) || 1));
}

// Enrich stored cart entries with live DB data (views.cart / _cart_context).
export async function buildCartView(activeItems) {
  const pks = Object.values(activeItems).map((v) => parseInt(v.pk, 10)).filter(Number.isFinite);
  const dbItems = await prisma.menuItem.findMany({ where: { id: { in: pks }, isActive: true } });
  const byId = new Map(dbItems.map((i) => [i.id, i]));

  const items = [];
  let total = 0;
  for (const [key, entry] of Object.entries(activeItems)) {
    const dbItem = byId.get(parseInt(entry.pk, 10));
    if (!dbItem) continue;
    const enriched = {
      ...entry,
      item_key: key,
      slug: dbItem.slug,
      name: dbItem.name,
      image: mediaUrl(dbItem.image),
      image_url: mediaUrl(dbItem.image),
      material_display: entry.material ? MATERIAL_LABELS[entry.material] || entry.material : entry.material,
    };
    enriched.subtotal = Number(entry.price) * entry.quantity;
    total += enriched.subtotal;
    items.push(enriched);
  }
  const cartCount = items.reduce((s, e) => s + e.quantity, 0);
  return { cart_items: items, total, cart_count: cartCount };
}

// POST /api/cart/add  (views.add_to_cart)
export async function add(req, res) {
  const pk = parseInt(req.params.pk || req.body.pk, 10);
  const item = await prisma.menuItem.findUnique({ where: { id: pk } });
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const quantity = clampQty(req.body.quantity);
  const note = (req.body.note || '').trim();
  const variantId = req.body.variant || req.body.variant_id || null;
  const material = req.body.material || null;
  const customText = (req.body.custom_text || '').trim();
  const size = req.body.size || null;
  let weight = req.body.weight || null;

  let basePrice = Number(item.price);
  let selectedWeight = weight;

  if (variantId) {
    const variant = await prisma.menuItemVariant.findFirst({ where: { id: parseInt(variantId, 10) } });
    if (variant) {
      basePrice = Number(variant.price);
      selectedWeight = Number(variant.weight);
    }
  } else if (weight && item.priceType === 'per_gram') {
    const w = Number(weight);
    if (Number.isFinite(w)) {
      selectedWeight = w;
      basePrice = Number(item.price) * w;
    }
  }

  const key = cartKey(pk, variantId, material, customText, weight, size);
  const itemData = {
    pk,
    name: item.name,
    price: basePrice,
    image: mediaUrl(item.image),
    quantity,
    note,
    variant_id: variantId,
    material,
    custom_text: customText,
    weight: selectedWeight,
    size,
  };

  const cart = await getCart(req.cartId);
  const action = req.body.action || 'add_to_cart';

  if (action === 'order_now') {
    await saveCart({ cartId: req.cartId, buyNow: { [key]: itemData } });
    return res.json({ success: true, order_now: true, redirect: '/checkout/' });
  }

  const items = { ...(cart.items || {}) };
  if (items[key]) {
    items[key] = { ...items[key], quantity: Math.min(20, items[key].quantity + quantity) };
  } else {
    items[key] = itemData;
  }
  await saveCart({ cartId: req.cartId, items });

  const cartCount = Object.values(items).reduce((s, v) => s + v.quantity, 0);
  res.json({
    success: true,
    cart_count: cartCount,
    item_name: item.name,
    item_image: mediaUrl(item.image),
    message: `«${item.name}»-ը ավելացվեց զամբյուղին։`,
  });
}

// GET /api/cart
export async function view(req, res) {
  const cart = await getCart(req.cartId);
  const buyNow = Object.keys(cart.buyNow || {}).length > 0;
  const active = buyNow ? cart.buyNow : cart.items || {};
  const enriched = await buildCartView(active);
  res.json({ ...enriched, is_buy_now: buyNow });
}

// POST /api/cart/update  (views.cart_update)
export async function update(req, res) {
  const cart = await getCart(req.cartId);
  const items = { ...(cart.items || {}) };
  const key = String(req.body.item_key);
  if (items[key]) {
    items[key] = { ...items[key], quantity: clampQty(req.body.quantity) };
    await saveCart({ cartId: req.cartId, items });
  }
  res.json({ success: true, cart_count: Object.values(items).reduce((s, v) => s + v.quantity, 0) });
}

// POST /api/cart/remove  (views.cart_remove)
export async function remove(req, res) {
  const cart = await getCart(req.cartId);
  const items = { ...(cart.items || {}) };
  delete items[String(req.body.item_key)];
  await saveCart({ cartId: req.cartId, items });
  res.json({ success: true, cart_count: Object.values(items).reduce((s, v) => s + v.quantity, 0) });
}

// POST /api/cart/clear  (views.cart_clear)
export async function clear(req, res) {
  await saveCart({ cartId: req.cartId, items: {} });
  res.json({ success: true });
}

// POST /api/cart/buy-now-clear  (views.buy_now_clear)
export async function buyNowClear(req, res) {
  await saveCart({ cartId: req.cartId, buyNow: {} });
  res.json({ success: true });
}
