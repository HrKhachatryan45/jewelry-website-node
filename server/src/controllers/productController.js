import prisma from '../config/prisma.js';
import { serializeItem, CATEGORY_LABELS } from '../services/serializers.js';

const CATEGORY_SLUGS = ['rings', 'necklaces', 'earrings', 'bracelets', 'bespoke', 'collections'];
const PAGE_SIZE = 12;

// GET /api/products  (views.menu)
export async function list(req, res) {
  const q = req.query;
  const category = q.category || 'all';
  const search = (q.search || '').trim();
  const sort = q.sort || '';
  const popularOnly = q.popular === 'true';

  const [priceRange, categoryCounts] = await Promise.all([
    prisma.menuItem.aggregate({
      where: { isActive: true },
      _min: { price: true },
      _max: { price: true },
    }),
    prisma.menuItem.groupBy({
      by: ['category'],
      where: { isActive: true },
      _count: { _all: true },
    }),
  ]);
  const priceMinGlobal = Number(priceRange._min.price || 0);
  const priceMaxGlobal = Number(priceRange._max.price || 0);

  let priceMin = parseInt(q.price_min ?? priceMinGlobal, 10);
  let priceMax = parseInt(q.price_max ?? priceMaxGlobal, 10);
  if (!Number.isFinite(priceMin)) priceMin = priceMinGlobal;
  if (!Number.isFinite(priceMax)) priceMax = priceMaxGlobal;

  const where = { isActive: true };
  if (category && category !== 'all') where.category = category;
  if (search) {
    where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }];
  }
  where.price = { gte: priceMin, lte: priceMax };
  if (popularOnly) where.isPopular = true;

  const orderBy = sort === 'price-asc' ? { price: 'asc' } : sort === 'price-desc' ? { price: 'desc' } : { id: 'asc' };

  const page = Math.max(1, parseInt(q.page || '1', 10));
  const [totalResults, categoryItems] = await Promise.all([
    prisma.menuItem.count({ where }),
    prisma.menuItem.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { images: true, variants: true },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const items = currentPage === page
    ? categoryItems
    : await prisma.menuItem.findMany({
      where,
      orderBy,
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { images: true, variants: true },
    });

  const categoryCountMap = new Map(categoryCounts.map((row) => [row.category, row._count._all]));
  const counts = { all: categoryCounts.reduce((sum, row) => sum + row._count._all, 0) };
  for (const slug of CATEGORY_SLUGS) {
    counts[slug] = categoryCountMap.get(slug) || 0;
  }

  let activeFilters = 0;
  if (priceMin > priceMinGlobal) activeFilters += 1;
  if (priceMax < priceMaxGlobal) activeFilters += 1;
  if (search) activeFilters += 1;
  if (popularOnly) activeFilters += 1;
  if (sort) activeFilters += 1;

  res.json({
    items: items.map((i) => serializeItem(i, { images: i.images, variants: i.variants })),
    pagination: {
      page: currentPage,
      hasNext: currentPage < totalPages,
      hasPrevious: currentPage > 1,
      totalPages,
      totalResults,
    },
    filters: {
      priceMin,
      priceMax,
      priceMinGlobal,
      priceMaxGlobal,
      category,
      search,
      sort,
      popularOnly,
      activeFilters,
      categoryCounts: counts,
      categoryLabels: CATEGORY_LABELS,
    },
  });
}

// GET /api/products/:slug  (views.menu_item)
export async function detail(req, res) {
  const item = await prisma.menuItem.findFirst({
    where: { slug: req.params.slug, isActive: true },
    include: { images: true, variants: true },
  });
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const related = await prisma.menuItem.findMany({
    where: { category: item.category, isActive: true, NOT: { id: item.id } },
    take: 4,
    include: { images: true, variants: true },
  });

  res.json({
    item: serializeItem(item, { images: item.images, variants: item.variants }),
    related: related.map((i) => serializeItem(i, { images: i.images, variants: i.variants })),
  });
}
