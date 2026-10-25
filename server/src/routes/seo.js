import { Router } from 'express';
import prisma from '../config/prisma.js';

const router = Router();

router.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n`);
});

router.get('/sitemap.xml', async (_req, res) => {
  const base = process.env.HOST_URL || 'http://localhost:4000';
  const items = await prisma.menuItem.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } });
  const urls = [
    '/',
    '/collection',
    '/bespoke',
    '/reviews',
    '/about',
    '/contact',
    '/privacy-policy',
    '/return-policy',
    '/terms-conditions',
  ].map(p => `<url><loc>${base}${p}</loc><changefreq>weekly</changefreq></url>`).join('');
  const prods = items.map(i => {
    const d = i.updatedAt ? new Date(i.updatedAt).toISOString() : new Date().toISOString();
    return `<url><loc>${base}/product?slug=${i.slug}</loc><lastmod>${d}</lastmod><changefreq>monthly</changefreq></url>`;
  }).join('');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}${prods}</urlset>`);
});

export default router;
