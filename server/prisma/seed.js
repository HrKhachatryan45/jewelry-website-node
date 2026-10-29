// Seeds the database from prisma/seed-data.json (exported from Django's cake_db).
// Run: npm run db:push && npm run db:seed
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-data.json'), 'utf8'));

// Image paths mirror the ones hardcoded in Django's templates/bakery/index.html.
const CATEGORIES = [
  { slug: 'rings', nameHy: 'Մատանիներ', nameRu: 'Кольца', nameEn: 'Rings', sortOrder: 0, image: 'categories/unnamed.webp' },
  { slug: 'necklaces', nameHy: 'Վզնոցներ', nameRu: 'Колье', nameEn: 'Necklaces', sortOrder: 1, image: 'categories/unnamed-2.webp' },
  { slug: 'earrings', nameHy: 'Ականջօղեր', nameRu: 'Серьги', nameEn: 'Earrings', sortOrder: 2, image: 'categories/unnamed-3.webp' },
  { slug: 'bracelets', nameHy: 'Ապարանջաններ', nameRu: 'Браслеты', nameEn: 'Bracelets', sortOrder: 3, image: 'categories/unnamed-4.webp' },
  { slug: 'watches', nameHy: 'Ժամացույցներ', nameRu: 'Часы', nameEn: 'Watches', sortOrder: 4, image: null },
  { slug: 'bespoke', nameHy: 'Անհատական Պատվեր', nameRu: 'Индивидуальный заказ', nameEn: 'Bespoke', sortOrder: 5, image: null },
  { slug: 'collections', nameHy: 'Հավաքածուներ', nameRu: 'Коллекции', nameEn: 'Collections', sortOrder: 6, image: null },
];

const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'admin123';

async function seedCategories() {
  for (const c of CATEGORIES) {
    await prisma.category.upsert({ where: { slug: c.slug }, create: c, update: c });
  }
}

async function seedUsers() {
  const src = data.auth_user?.[0];
  const username = src?.username || 'admin';
  const email = src?.email || 'admin@example.com';
  await prisma.user.upsert({
    where: { username },
    create: {
      username,
      email,
      password: await bcrypt.hash(ADMIN_PASSWORD, 12),
      role: src?.is_staff ? 'admin' : 'customer',
      isActive: true,
    },
    update: { role: 'admin', email },
  });
}

async function seedItems() {
  const demoAssets = [
    ['assets/ar-demo-halo-ring.jpg', '../uploads/menu/ar-demo-halo-ring.jpg'],
    ['assets/ar-demo-halo-ring.png', '../uploads/tryon/26.png'],
    ['assets/ADRG001.glb', '../uploads/models/ADRG001.glb'],
    ['assets/models/huggie_earring_single.glb', '../uploads/models/huggie_earring_single.glb'],
    ['assets/models/huggie_earring_single.json', '../uploads/models/huggie_earring_single.json'],
    ['assets/models/watch_atlantic.glb', '../uploads/models/watch_atlantic.glb'],
  ];
  for (const [source, destination] of demoAssets) {
    const sourcePath = path.join(__dirname, source);
    const destinationPath = path.resolve(__dirname, destination);
    await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.promises.copyFile(sourcePath, destinationPath);
  }

  for (const it of data.bakery_app_menuitem) {
    const product = await prisma.menuItem.upsert({
      where: { id: it.id },
      create: {
        id: it.id,
        name: it.name,
        slug: it.slug,
        description: it.description || '',
        price: it.price,
        category: it.category,
        isPopular: it.is_popular,
        isNew: it.is_new,
        isActive: it.is_active,
        image: it.image,
        materialKarat: it.material_karat,
        gemstone: it.gemstone,
        dimensions: it.dimensions,
        availableMaterials: it.available_materials || [],
        allowsCustomText: it.allows_custom_text ?? true,
        preparationDays: it.preparation_days ?? 7,
        priceType: it.price_type || 'fixed',
        tryOnAsset: it.try_on_asset || null,
        model3d: it.model_3d || null,
        createdAt: it.created_at ? new Date(it.created_at) : undefined,
        updatedAt: it.updated_at ? new Date(it.updated_at) : undefined,
      },
      update: {
        name: it.name,
        slug: it.slug,
        price: it.price,
        ...(it.try_on_asset ? { tryOnAsset: it.try_on_asset } : {}),
        ...(it.model_3d ? { model3d: it.model_3d } : {}),
      },
    });
    void product;
  }

  for (const v of data.bakery_app_menuitemvariant) {
    await prisma.menuItemVariant.upsert({
      where: { id: v.id },
      create: {
        id: v.id,
        menuItemId: v.menu_item_id,
        size: v.size,
        weight: v.weight,
        stock: v.stock ?? 0,
        price: v.price,
        isAvailable: v.is_available,
      },
      update: { size: v.size, weight: v.weight, stock: v.stock ?? 0, price: v.price, isAvailable: v.is_available },
    });
  }

  for (const img of data.bakery_app_menuitemimage) {
    await prisma.menuItemImage.upsert({
      where: { id: img.id },
      create: { id: img.id, menuItemId: img.menu_item_id, image: img.image, order: img.order ?? 0 },
      update: { image: img.image, order: img.order ?? 0 },
    });
  }
}

async function seedReviews() {
  for (const r of data.bakery_app_review) {
    await prisma.review.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        name: r.name,
        badge: r.badge || '',
        text: r.text,
        rating: r.rating,
        time: r.time || '',
        isApproved: r.is_approved,
        showOnMain: r.show_on_main,
        createdAt: r.created_at ? new Date(r.created_at) : undefined,
      },
      update: { name: r.name, text: r.text, rating: r.rating, isApproved: r.is_approved, showOnMain: r.show_on_main },
    });
  }
}

async function seedHero() {
  for (const s of data.bakery_app_heroslide) {
    await prisma.heroSlide.upsert({
      where: { id: s.id },
      create: { id: s.id, image: s.image, title: s.title || '', order: s.order ?? 0, isActive: s.is_active },
      update: { image: s.image, title: s.title || '', order: s.order ?? 0, isActive: s.is_active },
    });
  }
  const hs = data.bakery_app_herosettings?.[0];
  if (hs) {
    await prisma.heroSettings.upsert({
      where: { id: 1 },
      create: { id: 1, titleLine1: hs.title_line1, titleHighlight: hs.title_highlight, description: hs.description },
      update: { titleLine1: hs.title_line1, titleHighlight: hs.title_highlight, description: hs.description },
    });
  }
}

async function seedOrders() {
  for (const o of data.bakery_app_order || []) {
    await prisma.order.upsert({
      where: { id: o.id },
      create: {
        id: o.id,
        fullName: o.full_name,
        email: o.email,
        phone: o.phone,
        deliveryType: o.delivery_type || 'pickup',
        paymentMethod: o.payment_method || 'cash',
        city: o.city,
        address: o.address || '',
        lat: o.lat,
        lng: o.lng,
        deliveryPrice: o.delivery_price ?? 0,
        deliveryTime: o.delivery_time,
        orderNote: o.order_note || '',
        status: o.status || 'new',
        total: o.total,
        totalAmountAmd: o.total_amount_amd,
        isPaid: o.is_paid ?? false,
        onlinePaymentStatus: o.online_payment_status || 'pending',
        idramTransactionId: o.idram_transaction_id,
        arcaOrderId: o.arca_order_id,
        arcaFormUrl: o.arca_form_url,
        emailSent: o.email_sent ?? true,
        createdAt: o.created_at ? new Date(o.created_at) : undefined,
      },
      update: { status: o.status || 'new', isPaid: o.is_paid ?? false },
    });
  }
  for (const it of data.bakery_app_orderitem || []) {
    await prisma.orderItem.upsert({
      where: { id: it.id },
      create: {
        id: it.id,
        orderId: it.order_id,
        menuItemId: it.menu_item_id,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        weight: it.weight,
        material: it.material,
        customText: it.custom_text,
        size: it.size,
        note: it.note || '',
      },
      update: {},
    });
  }
}

async function seedMessages() {
  for (const m of data.bakery_app_contactmessage || []) {
    await prisma.contactMessage.upsert({
      where: { id: m.id },
      create: { id: m.id, name: m.name, email: m.email, phone: m.phone || '', message: m.message, createdAt: m.created_at ? new Date(m.created_at) : undefined },
      update: {},
    });
  }
}

async function seedBespoke() {
  for (const b of data.bakery_app_bespokeorder || []) {
    await prisma.bespokeOrder.upsert({
      where: { id: b.id },
      create: {
        id: b.id,
        fullName: b.full_name,
        email: b.email,
        phone: b.phone,
        jewelryType: b.jewelry_type || '',
        gemstonePreferences: b.gemstone_preferences || '',
        budgetRange: b.budget_range || '',
        deadline: b.deadline ? new Date(b.deadline) : null,
        sketch: b.sketch,
        sketch2: b.sketch2,
        sketch3: b.sketch3,
        description: b.description || '',
        status: b.status || 'new',
        createdAt: b.created_at ? new Date(b.created_at) : undefined,
      },
      update: { status: b.status || 'new' },
    });
  }
}

// Keep Postgres sequences in sync after inserting explicit IDs.
async function resetSequences() {
  const tables = [
    'bakery_app_menuitem',
    'bakery_app_menuitemvariant',
    'bakery_app_menuitemimage',
    'bakery_app_review',
    'bakery_app_order',
    'bakery_app_orderitem',
    'bakery_app_heroslide',
    'bakery_app_bespokeorder',
    'bakery_app_contactmessage',
  ];
  for (const t of tables) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 1))`
    );
  }
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1))`);
}

async function main() {
  console.log('Seeding from Django export...');
  // await seedCategories();
  await seedUsers();
  // await seedItems();
  // await seedReviews();
  // await seedHero();
  // await seedOrders();
  // await seedMessages();
  // await seedBespoke();
  // await resetSequences();
  console.log('Seed complete.');
  console.log(`Admin login: ${data.auth_user?.[0]?.username || 'admin'} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
