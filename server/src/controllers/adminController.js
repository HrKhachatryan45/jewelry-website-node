import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';
import {
  mediaUrl,
  serializeItem,
  serializeOrder,
  num,
  STATUS_LABELS,
  BESPOKE_STATUS_LABELS,
  DELIVERY_LABELS,
  PAYMENT_LABELS,
} from '../services/serializers.js';
import { uniqueSlug } from '../services/slug.js';
import { scheduleTryOnAsset } from '../services/tryonAsset.js';
import { removeUnusedModelUpload } from '../services/modelUploads.js';
import { relPath } from '../middleware/upload.js';
import { sendOrderEmail, STATUS_TEMPLATES } from '../services/email.js';

function paginate(page, size) {
  const p = Math.max(1, parseInt(page || '1', 10));
  return { skip: (p - 1) * size, take: size, page: p };
}

function pageMeta(page, size, total) {
  const totalPages = Math.max(1, Math.ceil(total / size));
  return { page, hasNext: page < totalPages, hasPrevious: page > 1, totalPages, totalResults: total };
}

// ── Dashboard ─────────────────────────────────────────────────────────
export async function dashboard(req, res) {
  const [
    totalMenuItems,
    totalReviews,
    avgAgg,
    totalMessages,
    totalOrders,
    newOrders,
    revenueAgg,
    totalBespoke,
    newBespoke,
    recentBespoke,
    recentOrders,
    recentReviews,
    recentMessages,
    popularItems,
    categoryPerf,
  ] = await Promise.all([
    prisma.menuItem.count(),
    prisma.review.count(),
    prisma.review.aggregate({ _avg: { rating: true } }),
    prisma.contactMessage.count(),
    prisma.order.count(),
    prisma.order.count({ where: { status: 'new' } }),
    prisma.order.aggregate({ _sum: { total: true }, _avg: { total: true }, where: { status: 'delivered' } }),
    prisma.bespokeOrder.count(),
    prisma.bespokeOrder.count({ where: { status: 'new' } }),
    prisma.bespokeOrder.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.review.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.menuItem.findMany({ where: { isPopular: true }, take: 5 }),
    prisma.menuItem.groupBy({ by: ['category'], _count: { id: true } }),
  ]);

  const unreadMessages = req.user.lastLogin
    ? await prisma.contactMessage.count({ where: { createdAt: { gte: req.user.lastLogin } } })
    : totalMessages;

  const chartLabels = [];
  const chartData = [];
  const today = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    chartLabels.push(start.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }));
    // eslint-disable-next-line no-await-in-loop
    chartData.push(await prisma.order.count({ where: { createdAt: { gte: start, lt: end } } }));
  }

  res.json({
    stats: {
      totalMenuItems,
      totalReviews,
      avgRating: Math.round(num(avgAgg._avg.rating || 0) * 10) / 10,
      totalMessages,
      unreadMessages,
      totalOrders,
      newOrders,
      totalRevenue: Math.trunc(num(revenueAgg._sum.total || 0)),
      avgOrderValue: Math.trunc(num(revenueAgg._avg.total || 0)),
      totalBespoke,
      newBespoke,
    },
    recentBespoke: recentBespoke.map((b) => ({ id: b.id, fullName: b.fullName, status: b.status, statusDisplay: BESPOKE_STATUS_LABELS[b.status], createdAt: b.createdAt })),
    recentOrders: recentOrders.map((o) => ({ id: o.id, fullName: o.fullName, phone: o.phone, total: num(o.total), status: o.status, statusDisplay: STATUS_LABELS[o.status], createdAt: o.createdAt })),
    recentReviews: recentReviews.map((r) => ({ id: r.id, name: r.name, rating: r.rating, text: r.text, isApproved: r.isApproved, createdAt: r.createdAt })),
    recentMessages: recentMessages.map((m) => ({ id: m.id, name: m.name, email: m.email, message: m.message, createdAt: m.createdAt })),
    popularItems: popularItems.map((i) => ({ id: i.id, name: i.name, price: num(i.price), image: mediaUrl(i.image) })),
    categoryPerf: categoryPerf.map((c) => ({ category: c.category, count: c._count.id })),
    chart: { labels: chartLabels, data: chartData },
  });
}

// ── Hero slides ───────────────────────────────────────────────────────
export async function heroList(_req, res) {
  const [slides, settings] = await Promise.all([
    prisma.heroSlide.findMany({ orderBy: { order: 'asc' } }),
    prisma.heroSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
  ]);
  res.json({
    slides: slides.map((s) => ({ id: s.id, title: s.title, image: mediaUrl(s.image), order: s.order, isActive: s.isActive })),
    settings: { titleLine1: settings.titleLine1, titleHighlight: settings.titleHighlight, description: settings.description },
  });
}

export async function heroSlideCreate(req, res) {
  const slide = await prisma.heroSlide.create({
    data: {
      title: req.body.title || '',
      image: relPath(req.file),
      order: parseInt(req.body.order || '0', 10) || 0,
      isActive: req.body.is_active !== 'false',
    },
  });
  res.status(201).json({ success: true, message: 'Սլայդը հաջողությամբ ավելացվեց', id: slide.id });
}

export async function heroSlideUpdate(req, res) {
  const id = parseInt(req.params.id, 10);
  const data = {};
  if (req.body.title !== undefined) data.title = req.body.title;
  if (req.body.order !== undefined) data.order = parseInt(req.body.order, 10) || 0;
  if (req.body.is_active !== undefined) data.isActive = req.body.is_active !== 'false';
  if (req.file) data.image = relPath(req.file);
  await prisma.heroSlide.update({ where: { id }, data });
  res.json({ success: true, message: 'Սլայդը հաջողությամբ թարմացվեց' });
}

export async function heroSlideDelete(req, res) {
  await prisma.heroSlide.delete({ where: { id: parseInt(req.params.id, 10) } });
  res.json({ success: true, message: 'Սլայդը հեռացվեց' });
}

export async function heroSettingsUpdate(req, res) {
  const data = {};
  if (req.body.title_line1 !== undefined) data.titleLine1 = req.body.title_line1;
  if (req.body.title_highlight !== undefined) data.titleHighlight = req.body.title_highlight;
  if (req.body.description !== undefined) data.description = req.body.description;
  await prisma.heroSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  res.json({ success: true, message: 'Գլխավոր էջի տեքստը թարմացվեց' });
}

// ── Products ──────────────────────────────────────────────────────────
export async function productsList(req, res) {
  const { skip, take, page } = paginate(req.query.page, 12);
  const where = {};
  if (req.query.category) where.category = req.query.category;
  if (req.query.search) {
    where.OR = [
      { name: { contains: req.query.search, mode: 'insensitive' } },
      { description: { contains: req.query.search, mode: 'insensitive' } },
    ];
  }
  const [total, items] = await Promise.all([
    prisma.menuItem.count({ where }),
    prisma.menuItem.findMany({
      where,
      orderBy: { category: 'asc' },
      skip,
      take,
      include: { images: { orderBy: [{ order: 'asc' }, { id: 'asc' }] }, variants: true },
    }),
  ]);
  res.json({
    items: items.map((i) => serializeItem(i, { images: i.images, variants: i.variants })),
    pagination: pageMeta(page, 12, total),
  });
}

export async function productGet(req, res) {
  const item = await prisma.menuItem.findUnique({
    where: { id: parseInt(req.params.id, 10) },
    include: { images: { orderBy: [{ order: 'asc' }, { id: 'asc' }] }, variants: true },
  });
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json({ item: serializeItem(item, { images: item.images, variants: item.variants }) });
}

function parseVariants(raw) {
  if (raw == null) return null;
  let list = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(list)) return [];
  return list.map((v) => ({
    id: v.id ? parseInt(v.id, 10) : undefined,
    size: v.size || null,
    weight: parseFloat(v.weight) || 0,
    price: parseFloat(v.price) || 0,
    stock: parseInt(v.stock || '0', 10) || 0,
    isAvailable: v.is_available !== false && v.isAvailable !== false,
  }));
}

function parseImagesData(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    const error = new Error('Invalid image order data.');
    error.status = 400;
    throw error;
  }
}

async function validateProductImages(req, itemId = null) {
  const mainFile = req.files?.image?.[0] || null;
  const newFiles = req.files?.additional_images || [];
  if (newFiles.length + Number(Boolean(mainFile)) > 5) {
    const error = new Error('A product can have up to 5 images.');
    error.status = 400;
    throw error;
  }

  const rawImagesData = req.body.images_data;
  const imagesData = parseImagesData(rawImagesData);
  if (rawImagesData !== undefined && rawImagesData !== null && rawImagesData !== '' && !Array.isArray(imagesData)) {
    const error = new Error('Image order data must be a list.');
    error.status = 400;
    throw error;
  }

  let current = null;
  let existingGallery = [];
  if (itemId !== null) {
    [current, existingGallery] = await Promise.all([
      prisma.menuItem.findUnique({ where: { id: itemId } }),
      prisma.menuItemImage.findMany({ where: { menuItemId: itemId }, select: { id: true } }),
    ]);
  }

  if (!imagesData) {
    const currentCount = Number(Boolean(current?.image)) + existingGallery.length;
    if (itemId !== null && currentCount + newFiles.length + Number(Boolean(mainFile && !current?.image)) > 5) {
      const error = new Error('A product can have up to 5 images. Remove an image before adding another.');
      error.status = 400;
      throw error;
    }
    return;
  }

  if (imagesData.length > 5) {
    const error = new Error('A product can have up to 5 images.');
    error.status = 400;
    throw error;
  }

  const galleryIds = new Set(existingGallery.map((image) => String(image.id)));
  const seen = new Set();
  const newFileIndexes = new Set();
  for (const entry of imagesData) {
    if (!entry || !['main', 'existing', 'new'].includes(entry.type)) {
      const error = new Error('Image order contains an invalid entry.');
      error.status = 400;
      throw error;
    }
    const key = entry.type === 'main'
      ? 'main'
      : entry.type === 'existing'
        ? `existing:${entry.id}`
        : `new:${entry.index}`;
    if (seen.has(key)) {
      const error = new Error('Image order contains a duplicate image.');
      error.status = 400;
      throw error;
    }
    seen.add(key);

    if (entry.type === 'existing' && (!Number.isInteger(Number(entry.id)) || !galleryIds.has(String(entry.id)))) {
      const error = new Error('Image order references an unknown product image.');
      error.status = 400;
      throw error;
    }
    if (entry.type === 'new') {
      if (!Number.isInteger(entry.index) || entry.index < 0 || entry.index >= newFiles.length) {
        const error = new Error('Image order references an unknown uploaded image.');
        error.status = 400;
        throw error;
      }
      newFileIndexes.add(entry.index);
    }
    if (entry.type === 'main' && !current?.image && !mainFile) {
      const error = new Error('Image order references a missing main image.');
      error.status = 400;
      throw error;
    }
  }

  if (newFileIndexes.size !== newFiles.length) {
    const error = new Error('Every uploaded image must appear in the product image order.');
    error.status = 400;
    throw error;
  }
}

async function applyGallery(itemId, req, { creating }) {
  const imagesData = parseImagesData(req.body.images_data);
  const newFiles = (req.files && req.files.additional_images) || [];
  const mainFile = req.files && req.files.image ? req.files.image[0] : null;

  if (creating) {
    if (mainFile) await prisma.menuItem.update({ where: { id: itemId }, data: { image: relPath(mainFile) } });
    if (newFiles.length) {
      const startIdx = mainFile ? 0 : 1;
      for (let i = 0; i < newFiles.length; i += 1) {
        if (i === 0 && !mainFile) {
          // eslint-disable-next-line no-await-in-loop
          await prisma.menuItem.update({ where: { id: itemId }, data: { image: relPath(newFiles[i]) } });
        } else {
          // eslint-disable-next-line no-await-in-loop
          await prisma.menuItemImage.create({ data: { menuItemId: itemId, image: relPath(newFiles[i]), order: startIdx + i } });
        }
      }
    }
    return;
  }

  // Editing: images_data controls order/main/gallery. Mirrors the Django flow.
  const current = await prisma.menuItem.findUnique({ where: { id: itemId } });
  if (!imagesData) {
    if (mainFile) await prisma.menuItem.update({ where: { id: itemId }, data: { image: relPath(mainFile) } });
    if (newFiles.length) {
      for (let i = 0; i < newFiles.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await prisma.menuItemImage.create({ data: { menuItemId: itemId, image: relPath(newFiles[i]), order: i } });
      }
    }
    return;
  }

  const existingGallery = await prisma.menuItemImage.findMany({ where: { menuItemId: itemId } });
  const galleryByFile = new Map(existingGallery.map((g) => [String(g.id), g.image]));
  const gallery = [];
  const retainedGalleryOrders = [];
  let newMain = null;

  imagesData.forEach((entry, i) => {
    let image = null;
    if (entry.type === 'main') image = current.image;
    else if (entry.type === 'existing') image = galleryByFile.get(String(entry.id));
    else if (entry.type === 'new' && entry.index != null && entry.index < newFiles.length) {
      image = relPath(newFiles[entry.index]);
    }
    if (!image) return;

    if (i === 0) {
      newMain = image;
    } else if (entry.type === 'existing') {
      retainedGalleryOrders.push({ id: Number(entry.id), order: i });
    } else {
      gallery.push({ menuItemId: itemId, image, order: i });
    }
  });
  if (mainFile) newMain = relPath(mainFile);

  const retainedIds = retainedGalleryOrders.map(({ id }) => id);
  await prisma.menuItemImage.deleteMany({
    where: retainedIds.length
      ? { menuItemId: itemId, NOT: { id: { in: retainedIds } } }
      : { menuItemId: itemId },
  });
  for (const { id, order } of retainedGalleryOrders) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.menuItemImage.update({ where: { id }, data: { order } });
  }
  await prisma.menuItem.update({ where: { id: itemId }, data: { image: newMain } });
  if (gallery.length) await prisma.menuItemImage.createMany({ data: gallery });
}

function productData(b) {
  const modelPath = b.model_3d || null;
  return {
    name: b.name || '',
    description: b.description || '',
    price: parseFloat(b.price) || 0,
    category: b.category || 'rings',
    isPopular: b.is_popular === 'true' || b.is_popular === true || b.is_popular === 'on',
    isNew: b.is_new === 'true' || b.is_new === true || b.is_new === 'on',
    isActive: !(b.is_active === 'false' || b.is_active === false || b.is_active === 'off'),
    materialKarat: b.material_karat || null,
    gemstone: b.gemstone || null,
    dimensions: b.dimensions || null,
    availableMaterials: Array.isArray(b.available_materials)
      ? b.available_materials
      : b.available_materials
      ? JSON.parse(b.available_materials)
      : [],
    allowsCustomText: !(b.allows_custom_text === 'false' || b.allows_custom_text === false),
    preparationDays: parseInt(b.preparation_days || '7', 10) || 7,
    priceType: b.price_type || 'fixed',
    model3d: modelPath?.startsWith('/uploads/')
      ? modelPath.slice('/uploads/'.length)
      : modelPath,
  };
}

function productModelData(req) {
  const file = req.files?.model_3d_file?.[0];
  return file ? { model3d: relPath(file) } : null;
}

// Try-on overlay asset: an uploaded transparent PNG wins; a posted
// `try_on_asset` string sets/clears it; omitting both leaves it untouched.
function tryOnAssetData(req) {
  const file = req.files && req.files.try_on_asset ? req.files.try_on_asset[0] : null;
  if (file) return { tryOnAsset: relPath(file) };
  if (req.body.try_on_asset !== undefined) {
    const assetPath = req.body.try_on_asset
      ? req.body.try_on_asset.replace(/^(?:\/uploads\/)+/i, '').replace(/^\/+/, '')
      : null;
    return { tryOnAsset: assetPath };
  }
  return null;
}

export async function productCreate(req, res) {
  await validateProductImages(req);
  const data = productData(req.body);
  Object.assign(data, productModelData(req) || {});
  Object.assign(data, tryOnAssetData(req) || {});
  data.slug = await uniqueSlug(data.name);
  const item = await prisma.menuItem.create({ data });

  const variants = parseVariants(req.body.variants) || [];
  if (variants.length) {
    await prisma.menuItemVariant.createMany({
      data: variants.map((v) => ({ menuItemId: item.id, size: v.size, weight: v.weight, price: v.price, stock: v.stock, isAvailable: v.isAvailable })),
    });
  }
  await applyGallery(item.id, req, { creating: true });
  scheduleTryOnAsset(item.id); // transparent-PNG cut-out for the try-on studio

  res.status(201).json({ success: true, message: `Ապրանքը "${item.name}" հաջողությամբ ստեղծվեց`, id: item.id });
}

export async function productUpdate(req, res) {
  const id = parseInt(req.params.id, 10);
  const existing = await prisma.menuItem.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Item not found' });
  await validateProductImages(req, id);

  const data = productData(req.body);
  Object.assign(data, productModelData(req) || {});
  Object.assign(data, tryOnAssetData(req) || {});
  if (data.name && data.name !== existing.name) data.slug = await uniqueSlug(data.name, id);
  await prisma.menuItem.update({ where: { id }, data });

  const variants = parseVariants(req.body.variants);
  if (variants) {
    const keepIds = variants.filter((v) => v.id).map((v) => v.id);
    await prisma.menuItemVariant.deleteMany({ where: { menuItemId: id, NOT: { id: { in: keepIds } } } });
    for (const v of variants) {
      if (v.id) {
        // eslint-disable-next-line no-await-in-loop
        await prisma.menuItemVariant.update({ where: { id: v.id }, data: { size: v.size, weight: v.weight, price: v.price, stock: v.stock, isAvailable: v.isAvailable } });
      } else {
        // eslint-disable-next-line no-await-in-loop
        await prisma.menuItemVariant.create({ data: { menuItemId: id, size: v.size, weight: v.weight, price: v.price, stock: v.stock, isAvailable: v.isAvailable } });
      }
    }
  }
  await applyGallery(id, req, { creating: false });
  const mainImageChanged = (req.files && req.files.image && req.files.image.length) || (req.files && req.files.additional_images && req.files.additional_images.length);
  if (mainImageChanged) scheduleTryOnAsset(id);

  const modelCleanupWarnings = existing.model3d !== data.model3d
    ? await removeUnusedModelUpload(prisma, existing.model3d)
    : [];
  res.json({
    success: true,
    message: `Ապրանքը "${data.name}" հաջողությամբ թարմացվեց`,
    ...(modelCleanupWarnings.length ? { warnings: ['The previous 3D model upload could not be fully removed'] } : {}),
  });
}

export async function productDelete(req, res) {
  const id = parseInt(req.params.id, 10);
  const item = await prisma.menuItem.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ error: 'Item not found' });
  await prisma.menuItem.delete({ where: { id } });
  const modelCleanupWarnings = await removeUnusedModelUpload(prisma, item.model3d);
  res.json({
    success: true,
    message: `Ապրանքը "${item.name}" հաջողությամբ ջնջվեց`,
    ...(modelCleanupWarnings.length ? { warnings: ['The unused 3D model upload could not be fully removed'] } : {}),
  });
}

// ── Reviews ───────────────────────────────────────────────────────────
export async function reviewsList(req, res) {
  const { skip, take, page } = paginate(req.query.page, 10);
  const where = {};
  if (req.query.rating) where.rating = parseInt(req.query.rating, 10);
  if (req.query.search) {
    where.OR = [{ name: { contains: req.query.search, mode: 'insensitive' } }, { text: { contains: req.query.search, mode: 'insensitive' } }];
  }
  const [total, reviews] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
  ]);
  res.json({
    reviews: reviews.map((r) => ({ id: r.id, name: r.name, badge: r.badge, text: r.text, rating: r.rating, time: r.time, isApproved: r.isApproved, showOnMain: r.showOnMain, createdAt: r.createdAt })),
    pagination: pageMeta(page, 10, total),
  });
}

export async function reviewCreate(req, res) {
  const b = req.body;
  const review = await prisma.review.create({
    data: {
      name: b.name || '',
      badge: b.badge || '',
      text: b.text || '',
      rating: parseInt(b.rating || '5', 10) || 5,
      time: b.time || '',
      isApproved: b.is_approved !== 'false' && b.is_approved !== false,
      showOnMain: b.show_on_main === 'true' || b.show_on_main === true || b.show_on_main === 'on',
    },
  });
  res.status(201).json({ success: true, message: `Կարծիքը "${review.name}"-ից հաջողությամբ ստեղծվեց`, id: review.id });
}

export async function reviewUpdate(req, res) {
  const id = parseInt(req.params.id, 10);
  const b = req.body;
  const data = {};
  if (b.name !== undefined) data.name = b.name;
  if (b.badge !== undefined) data.badge = b.badge;
  if (b.text !== undefined) data.text = b.text;
  if (b.rating !== undefined) data.rating = parseInt(b.rating, 10) || 5;
  if (b.time !== undefined) data.time = b.time;
  if (b.is_approved !== undefined) data.isApproved = b.is_approved !== 'false' && b.is_approved !== false;
  if (b.show_on_main !== undefined) data.showOnMain = b.show_on_main === 'true' || b.show_on_main === true || b.show_on_main === 'on';
  await prisma.review.update({ where: { id }, data });
  res.json({ success: true, message: 'Կարծիքը հաջողությամբ թարմացվեց' });
}

export async function reviewDelete(req, res) {
  const id = parseInt(req.params.id, 10);
  const r = await prisma.review.delete({ where: { id } });
  res.json({ success: true, message: `"${r.name}"-ի կարծիքը հաջողությամբ ջնջվեց` });
}

// POST /api/admin/reviews/sync  (custom_admin_views.sync_google_reviews)
export async function reviewsSync(req, res) {
  const reviews = req.body.reviews || [];
  if (!reviews.length) return res.json({ success: false, error: 'No reviews provided' });
  let added = 0;
  let updated = 0;
  for (const r of reviews) {
    const name = (r.name || '').trim();
    const text = (r.text || '').trim();
    if (!name || !text) continue;
    // eslint-disable-next-line no-await-in-loop
    const existing = await prisma.review.findFirst({ where: { name, text } });
    if (existing) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.review.update({ where: { id: existing.id }, data: { rating: r.rating || 5, badge: r.badge || '', time: r.time || '', isApproved: true } });
      updated += 1;
    } else {
      // eslint-disable-next-line no-await-in-loop
      await prisma.review.create({ data: { name, text, rating: r.rating || 5, badge: r.badge || '', time: r.time || '', isApproved: true } });
      added += 1;
    }
  }
  res.json({ success: true, message: `Հաջողությամբ սինքրոնիզացվեց։ Ավելացվեց ${added} նոր կարծիք, թարմացվեց ${updated} կարծիք։`, added, updated });
}

// ── Messages ──────────────────────────────────────────────────────────
export async function messagesList(req, res) {
  const { skip, take, page } = paginate(req.query.page, 15);
  const [total, messages] = await Promise.all([
    prisma.contactMessage.count(),
    prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' }, skip, take }),
  ]);
  res.json({ messages, pagination: pageMeta(page, 15, total) });
}

export async function messageDelete(req, res) {
  await prisma.contactMessage.delete({ where: { id: parseInt(req.params.id, 10) } });
  res.json({ success: true, message: 'Հաղորդագրությունը ջնջված է։' });
}

// ── Orders ────────────────────────────────────────────────────────────
export async function ordersList(req, res) {
  const { skip, take, page } = paginate(req.query.page, 15);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.search) {
    where.OR = [{ fullName: { contains: req.query.search, mode: 'insensitive' } }, { phone: { contains: req.query.search } }];
  }
  const [total, orders, newCount] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take, include: { items: true } }),
    prisma.order.count({ where: { status: 'new' } }),
  ]);
  res.json({
    orders: orders.map((o) => ({
      id: o.id,
      fullName: o.fullName,
      email: o.email,
      phone: o.phone,
      total: num(o.total),
      status: o.status,
      statusDisplay: STATUS_LABELS[o.status],
      deliveryType: o.deliveryType,
      deliveryTypeDisplay: DELIVERY_LABELS[o.deliveryType] || o.deliveryType,
      paymentMethod: o.paymentMethod,
      paymentMethodDisplay: PAYMENT_LABELS[o.paymentMethod] || o.paymentMethod,
      isPaid: o.isPaid,
      itemCount: o.items.length,
      createdAt: o.createdAt,
    })),
    statusChoices: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
    newOrdersCount: newCount,
    pagination: pageMeta(page, 15, total),
  });
}

export async function orderGet(req, res) {
  const order = await prisma.order.findUnique({ where: { id: parseInt(req.params.id, 10) }, include: { items: true } });
  const menuItems = await prisma.menuItem.findMany({ where: { id: { in: order.items.map((i) => i.menuItemId) } } });
  console.log('menuItems', menuItems);
  console.log('order', order.items);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ order: serializeOrder(order, order.items), menuItems, statusChoices: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })) });
}

export async function orderUpdate(req, res) {
  const id = parseInt(req.params.id, 10);
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const data = {};
  let statusChanged = false;
  if (req.body.status !== undefined && req.body.status in STATUS_LABELS) {
    data.status = req.body.status;
    statusChanged = order.status !== req.body.status;
  }
  if (req.body.is_paid !== undefined) data.isPaid = req.body.is_paid === true || req.body.is_paid === 'true' || req.body.is_paid === 'on';

  const updated = await prisma.order.update({ where: { id }, data, include: { items: true } });

  if (statusChanged && STATUS_TEMPLATES[updated.status]) {
    sendOrderEmail(updated.email, updated, STATUS_TEMPLATES[updated.status]);
  }
  res.json({ success: true, message: `Պատվերի #${id} տվյալները թարմացվեցին։`, status: STATUS_LABELS[updated.status] });
}

export async function orderDelete(req, res) {
  const id = parseInt(req.params.id, 10);
  await prisma.order.delete({ where: { id } });
  res.json({ success: true, message: `Պատվերը #${id} հաջողությամբ ջնջվեց։` });
}

// ── Bespoke orders ────────────────────────────────────────────────────
export async function bespokeList(req, res) {
  const { skip, take, page } = paginate(req.query.page, 15);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.search) {
    where.OR = [
      { fullName: { contains: req.query.search, mode: 'insensitive' } },
      { phone: { contains: req.query.search } },
      { email: { contains: req.query.search, mode: 'insensitive' } },
    ];
  }
  const [total, orders] = await Promise.all([
    prisma.bespokeOrder.count({ where }),
    prisma.bespokeOrder.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
  ]);
  res.json({
    orders: orders.map((b) => ({ ...b, statusDisplay: BESPOKE_STATUS_LABELS[b.status] })),
    statusChoices: Object.entries(BESPOKE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
    pagination: pageMeta(page, 15, total),
  });
}

export async function bespokeGet(req, res) {
  const order = await prisma.bespokeOrder.findUnique({ where: { id: parseInt(req.params.id, 10) } });
  if (!order) return res.status(404).json({ error: 'Bespoke order not found' });
  res.json({
    order: {
      ...order,
      statusDisplay: BESPOKE_STATUS_LABELS[order.status],
      sketches: [order.sketch, order.sketch2, order.sketch3].filter(Boolean).map(mediaUrl),
    },
    statusChoices: Object.entries(BESPOKE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
  });
}

export async function bespokeUpdate(req, res) {
  const id = parseInt(req.params.id, 10);
  const { status } = req.body;
  if (!(status in BESPOKE_STATUS_LABELS)) return res.status(400).json({ error: 'Invalid status' });
  await prisma.bespokeOrder.update({ where: { id }, data: { status } });
  res.json({ success: true, message: `Հայտի #${id} կարգավիճակը փոխվեց։` });
}

// ── Users ─────────────────────────────────────────────────────────────
export async function usersList(_req, res) {
  const users = await prisma.user.findMany({ orderBy: { id: 'asc' } });
  res.json({ users: users.map((u) => ({ id: u.id, username: u.username, email: u.email, role: u.role, isActive: u.isActive, lastLogin: u.lastLogin, createdAt: u.createdAt })) });
}

export async function userCreate(req, res) {
  const { username, email, password, role = 'customer' } = req.body;
  const exists = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
  if (exists) return res.status(409).json({ error: 'User already exists' });
  const user = await prisma.user.create({
    data: { username, email, password: await bcrypt.hash(password, 12), role: role === 'admin' ? 'admin' : 'customer' },
  });
  res.status(201).json({ success: true, id: user.id, message: `Օգտատերը "${user.username}" ստեղծվեց` });
}

export async function userUpdate(req, res) {
  const id = parseInt(req.params.id, 10);
  const data = {};
  if (req.body.role !== undefined) data.role = req.body.role === 'admin' ? 'admin' : 'customer';
  if (req.body.is_active !== undefined) data.isActive = req.body.is_active === true || req.body.is_active === 'true';
  if (req.body.password) data.password = await bcrypt.hash(req.body.password, 12);
  await prisma.user.update({ where: { id }, data });
  res.json({ success: true, message: 'Օգտատերը թարմացվեց' });
}

export async function userDelete(req, res) {
  const id = parseInt(req.params.id, 10);
  if (req.user && req.user.id === id) return res.status(400).json({ error: 'Cannot delete yourself' });
  await prisma.user.delete({ where: { id } });
  res.json({ success: true, message: 'Օգտատերը ջնջվեց' });
}

// ── Wishlist (new feature) ────────────────────────────────────────────
export async function wishlistList(req, res) {
  const where = req.user ? { userId: req.user.id } : { cartId: req.cartId };
  const items = await prisma.wishlistItem.findMany({ where });
  const products = await prisma.menuItem.findMany({
    where: { id: { in: items.map((w) => w.menuItemId) } },
    include: { images: { orderBy: [{ order: 'asc' }, { id: 'asc' }] }, variants: true },
  });
  res.json({ items: products.map((i) => serializeItem(i, { images: i.images, variants: i.variants })) });
}

export async function wishlistToggle(req, res) {
  const menuItemId = parseInt(req.body.menu_item_id, 10);
  const where = req.user ? { userId: req.user.id } : { cartId: req.cartId };
  const existing = await prisma.wishlistItem.findFirst({ where: { ...where, menuItemId } });
  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    return res.json({ success: true, in_wishlist: false });
  }
  await prisma.wishlistItem.create({
    // eslint-disable-next-line no-undef
    data: { menuItemId, userId: req.user ? req.user.id : null, cartId: req.user ? null : req.cartId, ...(req.user ? {} : {}) },
  });
  res.json({ success: true, in_wishlist: true });
}

// ── Seed helper token check (not exposed) ─────────────────────────────
export const _internal = { crypto };
