import prisma from '../config/prisma.js';
import { mediaUrl } from '../services/serializers.js';
import { relPath } from '../middleware/upload.js';

// POST /api/bespoke  (views.bespoke_request)
export async function create(req, res) {
  const b = req.body;
  const files = req.files || [];
  let deadline = null;
  if (b.deadline) {
    const d = new Date(b.deadline);
    if (!Number.isNaN(d.getTime())) deadline = d;
  }

  const order = await prisma.bespokeOrder.create({
    data: {
      fullName: b.full_name || '',
      email: b.email || '',
      phone: b.phone || '',
      jewelryType: b.jewelry_type || '',
      gemstonePreferences: b.gemstone_preferences || '',
      budgetRange: b.budget_range || '',
      deadline,
      description: b.description || '',
      sketch: files[0] ? relPath(files[0]) : null,
      sketch2: files[1] ? relPath(files[1]) : null,
      sketch3: files[2] ? relPath(files[2]) : null,
    },
  });

  res.status(201).json({
    success: true,
    message: 'Ձեր անհատական պատվերի հայտը հաջողությամբ ուղարկվեց։ Մենք կկապվենք ձեզ հետ մանրամասները քննարկելու համար։',
    id: order.id,
    sketches: [order.sketch, order.sketch2, order.sketch3].filter(Boolean).map(mediaUrl),
  });
}
