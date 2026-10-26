// Helpers that reproduce Django template filter output in the JSON API.

export function mediaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `/uploads/${String(path).replace(/^\/+/, '')}`;
}

// Decimal.js instances stringify with toJSON -> string; convert to Number for prices.
export function num(value) {
  if (value == null) return value;
  if (typeof value === 'number') return value;
  const n = Number(value.toString());
  return Number.isNaN(n) ? value : n;
}

// Django `floatformat:0` -> rounded integer string.
export function intQty(value) {
  const n = num(value);
  return typeof n === 'number' ? Math.round(n) : n;
}

export const MATERIAL_LABELS = {
  gold_yellow: 'Դեղին Ոսկի',
  gold_white: 'Սպիտակ Ոսկի',
  gold_rose: 'Վարդագույն Ոսկի',
  silver: 'Արծաթ 925',
  platinum: 'Պլատին',
};

export const CATEGORY_LABELS = {
  rings: 'Մատանիներ',
  necklaces: 'Վզնոցներ',
  earrings: 'Ականջօղեր',
  bracelets: 'Ապարանջաններ',
  bespoke: 'Անհատական Պատվեր',
  collections: 'Հավաքածուներ',
};

export const DELIVERY_LABELS = { pickup: 'Սրահից', delivery: 'Առաքում' };
export const PAYMENT_LABELS = { cash: 'Կանխիկ', card: 'Քարտ', idram: 'Idram' };
export const STATUS_LABELS = {
  new: 'Նոր',
  confirmed: 'Հաստատված',
  ready: 'Պատրաստ է',
  delivered: 'Ավարտված',
  cancelled: 'Չեղարկված',
};
export const BESPOKE_STATUS_LABELS = {
  new: 'Նոր',
  contacted: 'Կապ հաստատված',
  in_progress: 'Ընթացքի մեջ',
  completed: 'Ավարտված',
  cancelled: 'Չեղարկված',
};

export function serializeVariant(v) {
  return {
    id: v.id,
    size: v.size,
    weight: num(v.weight),
    stock: v.stock,
    price: intQty(v.price),
    isAvailable: v.isAvailable,
  };
}

export function serializeImage(img) {
  return { id: img.id, image: mediaUrl(img.image), order: img.order };
}

export function serializeItem(item, { variants = [], images = [] } = {}) {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    description: item.description,
    price: intQty(item.price),
    category: item.category,
    categoryDisplay: CATEGORY_LABELS[item.category] || item.category,
    isPopular: item.isPopular,
    menuItemId: item.menuItemId,
    isNew: item.isNew,
    isActive: item.isActive,
    image: mediaUrl(item.image),
    materialKarat: item.materialKarat,
    gemstone: item.gemstone,
    dimensions: item.dimensions,
    availableMaterials: item.availableMaterials || [],
    materialDisplay: (item.availableMaterials || []).map((m) => MATERIAL_LABELS[m] || m),
    allowsCustomText: item.allowsCustomText,
    preparationDays: item.preparationDays,
    priceType: item.priceType,
    tryOnAsset: mediaUrl(item.tryOnAsset),
    model3d: mediaUrl(item.model3d),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    variants: variants.map(serializeVariant),
    images: images.map(serializeImage),
  };
}

export function serializeOrder(order, items = []) {
  return {
    id: order.id,
    fullName: order.fullName,
    email: order.email,
    phone: order.phone,
    deliveryType: order.deliveryType,
    deliveryTypeDisplay: DELIVERY_LABELS[order.deliveryType] || order.deliveryType,
    paymentMethod: order.paymentMethod,
    paymentMethodDisplay: PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod,
    city: order.city,
    address: order.address,
    deliveryPrice: num(order.deliveryPrice),
    deliveryTime: order.deliveryTime,
    orderNote: order.orderNote,
    status: order.status,
    statusDisplay: STATUS_LABELS[order.status] || order.status,
    total: num(order.total),
    totalAmountAmd: num(order.totalAmountAmd),
    isPaid: order.isPaid,
    onlinePaymentStatus: order.onlinePaymentStatus,
    emailSent: order.emailSent,
    createdAt: order.createdAt,
    items: items.map((it) => ({
      id: it.id,
      name: it.name,
      price: num(it.price),
      quantity: it.quantity,
      menuItemId: it.menuItemId,
      weight: it.weight == null ? null : num(it.weight),
      material: it.material,
      materialDisplay: it.material ? MATERIAL_LABELS[it.material] || it.material : null,
      customText: it.customText,
      size: it.size,
      note: it.note,
      subtotal: num(it.price) * it.quantity,
      image: mediaUrl(it.menuItem?.image),
      tryOnCategory: it.menuItem?.category || null,
      tryOnAsset: it.menuItem?.tryOnAsset ? mediaUrl(it.menuItem.tryOnAsset) : null,
    })),
  };
}
