// Port of bakery_app/utils.py armenian_slugify + MenuItem.save() unique-slug loop.
import prisma from '../config/prisma.js';

const ARMENIAN_TO_LATIN = {
  ա: 'a', բ: 'b', գ: 'g', դ: 'd', ե: 'e', զ: 'z', է: 'e', ը: 'y', թ: 't', ժ: 'zh',
  ի: 'i', լ: 'l', խ: 'kh', ծ: 'ts', կ: 'k', հ: 'h', ձ: 'dz', ղ: 'gh', ճ: 'ch', մ: 'm',
  յ: 'y', ն: 'n', շ: 'sh', ո: 'o', չ: 'ch', պ: 'p', ջ: 'j', ռ: 'r', ս: 's', վ: 'v',
  տ: 't', ր: 'r', ց: 'ts', փ: 'p', ք: 'k', և: 'ev', օ: 'o', ֆ: 'f', ւ: 'v',
};

export function armenianSlugify(text = '') {
  let s = String(text).toLowerCase().trim();
  s = s.replace(/ու/g, 'u');
  let result = '';
  for (const char of s) result += ARMENIAN_TO_LATIN[char] ?? char;
  result = result.replace(/\s+/g, '-');
  result = result.replace(/[^a-z0-9-]/g, '');
  return result;
}

// Mirrors MenuItem.save(): avoid collisions, except for the item being edited.
export async function uniqueSlug(name, excludeId = null) {
  const base = armenianSlugify(name) || 'item';
  let slug = base;
  let counter = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const found = await prisma.menuItem.findFirst({
      where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!found) return slug;
    slug = `${base}-${counter}`;
    counter += 1;
  }
}
