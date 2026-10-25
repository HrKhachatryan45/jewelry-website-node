import prisma from '../config/prisma.js';
import env from '../config/env.js';
import { mediaUrl, serializeItem, MATERIAL_LABELS } from '../services/serializers.js';
import { sendContactEmail } from '../services/email.js';

function heroSettingsToJson(hs) {
  return {
    titleLine1: hs.titleLine1,
    titleHighlight: hs.titleHighlight,
    description: hs.description,
  };
}

function serializeReview(r) {
  return {
    id: r.id,
    name: r.name,
    badge: r.badge,
    text: r.text,
    rating: r.rating,
    time: r.time,
    createdAt: r.createdAt,
  };
}

// GET /api/home  (views.home)
export async function home(_req, res) {
  const [heroSlides, heroSettings, featured, approved] = await Promise.all([
    prisma.heroSlide.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
    prisma.heroSettings.findUnique({ where: { id: 1 } }),
    prisma.menuItem.findMany({
      where: { isPopular: true, isActive: true },
      include: { images: true, variants: true },
      orderBy: { id: 'asc' },
    }),
    prisma.review.findMany({ where: { isApproved: true } }),
  ]);

  let homeReviews = approved.filter((r) => r.showOnMain).slice(0, 3);
  if (homeReviews.length === 0) {
    homeReviews = [...approved].sort(() => Math.random() - 0.5).slice(0, 3);
  }

  const total = approved.length;
  const avg = total > 0 ? approved.reduce((s, r) => s + r.rating, 0) / total : 0;
  const menuItemsCount = await prisma.menuItem.count({ where: { isActive: true } });

  res.json({
    heroSlides: heroSlides.map((s) => ({ id: s.id, title: s.title, image: mediaUrl(s.image), order: s.order })),
    heroSettings: heroSettings ? heroSettingsToJson(heroSettings) : null,
    featuredItems: featured.map((i) => serializeItem(i, { images: i.images, variants: i.variants })),
    reviews: homeReviews.map(serializeReview),
    totalReviews: total,
    avgRating: Math.round(avg * 10) / 10,
    menuItemsCount,
  });
}

// GET /api/about  (views.about)
export async function about(_req, res) {
  res.json({ contact: env.contact });
}

// POST /api/contact  (views.contact)
export async function contact(req, res) {
  const { name, email, phone = '', message } = req.body;
  const saved = await prisma.contactMessage.create({
    data: { name, email, phone, message },
  });
  if (env.email.ownerEmails.length) {
    sendContactEmail(env.email.ownerEmails, { name, email, phone, message });
  }
  res.status(201).json({ success: true, message: 'Ձեր հաղորդագրությունը ուղարկվեց։', id: saved.id });
}

export async function privacyPolicy(_req, res) {
  res.json({ page: 'privacy_policy' });
}
export async function returnPolicy(_req, res) {
  res.json({ page: 'return_policy' });
}
export async function termsConditions(_req, res) {
  res.json({ page: 'terms_conditions' });
}

// GET /api/categories  (MenuItem.CATEGORY_CHOICES)
export async function categories(_req, res) {
  const cats = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  if (cats.length) {
    const counts = await Promise.all(
      cats.map((c) => prisma.menuItem.count({ where: { category: c.slug, isActive: true } }))
    );
    return res.json({
      categories: cats.map((c, i) => ({
        slug: c.slug,
        name: c.nameHy,
        names: { hy: c.nameHy, ru: c.nameRu, en: c.nameEn },
        image: mediaUrl(c.image),
        count: counts[i],
      })),
    });
  }
  res.json({ categories: [] });
}

export { MATERIAL_LABELS };
