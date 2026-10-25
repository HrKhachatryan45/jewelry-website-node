import prisma from '../config/prisma.js';

const PAGE_SIZE = 6;

function serialize(r) {
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

// GET /api/reviews  (views.reviews)
export async function list(req, res) {
  const sort = req.query.sort || 'recent';
  const approved = await prisma.review.findMany({
    where: { isApproved: true },
    orderBy: { createdAt: 'desc' },
  });

  const totalReviews = approved.length;
  const ratingBreakdown = [5, 4, 3, 2, 1].map((stars) => {
    const count = approved.filter((r) => r.rating === stars).length;
    return { stars, count, percentage: totalReviews > 0 ? Math.floor((count / totalReviews) * 100) : 0 };
  });
  const avg = totalReviews > 0 ? approved.reduce((s, r) => s + r.rating, 0) / totalReviews : 0;

  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const totalPages = Math.max(1, Math.ceil(totalReviews / PAGE_SIZE));
  const slice = approved.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  res.json({
    reviews: slice.map(serialize),
    totalReviews,
    avgRating: Math.round(avg * 10) / 10,
    ratingBreakdown,
    sort,
    pagination: {
      page,
      hasNext: page < totalPages,
      nextPage: page < totalPages ? page + 1 : null,
      totalPages,
    },
  });
}

// POST /api/reviews  (views.reviews)
export async function create(req, res) {
  const { name, text } = req.body;
  const errors = {};
  if (!name || !String(name).trim()) errors.name = 'Name is required';
  if (!text || !String(text).trim()) errors.text = 'Text is required';
  if (Object.keys(errors).length) return res.status(422).json({ errors });
  let rating = parseInt(req.body.rating || '5', 10);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) rating = 5;

  const review = await prisma.review.create({
    data: { name, text, rating, badge: 'Հաճախորդ', time: 'Նոր', isApproved: false },
  });
  res.status(201).json({ success: true, message: 'Ձեր կարծիքը հաջողությամբ ուղարկվեց և սպասում է հաստատման։', review: serialize(review) });
}
