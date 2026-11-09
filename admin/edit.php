<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
requireAdmin();

$categories = productCategories();
$isNew = isset($_GET['new']);
$productId = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
if (!$isNew && ($productId === false || $productId < 1)) {
    http_response_code(404);
    exit('Զարդը չի գտնվել։');
}

$product = [
    'id' => null, 'name' => '', 'category' => 'rings', 'price' => '', 'material_karat' => '',
    'gemstone' => '', 'dimensions' => '', 'preparation_days' => 7, 'price_type' => 'fixed',
    'description' => '', 'available_materials' => '[]', 'is_active' => 1, 'is_popular' => 0,
    'is_new' => 1, 'allows_custom_text' => 1, 'image' => null, 'model_3d' => '',
];
$variants = [];
$galleryImages = [];
if (!$isNew) {
    $statement = $mysqli->prepare('SELECT * FROM products WHERE id = ? LIMIT 1');
    $statement->bind_param('i', $productId);
    $statement->execute();
    $product = $statement->get_result()->fetch_assoc();
    if (!$product) {
        http_response_code(404);
        exit('Զարդը չի գտնվել։');
    }
    $variantsStatement = $mysqli->prepare('SELECT id, size, weight, stock, price, is_available FROM product_variants WHERE menu_item_id = ? ORDER BY id');
    $variantsStatement->bind_param('i', $productId);
    $variantsStatement->execute();
    $variants = $variantsStatement->get_result()->fetch_all(MYSQLI_ASSOC);
    $galleryStatement = $mysqli->prepare('SELECT id, image, `order` FROM product_images WHERE menu_item_id = ? ORDER BY `order`, id');
    $galleryStatement->bind_param('i', $productId);
    $galleryStatement->execute();
    $galleryImages = $galleryStatement->get_result()->fetch_all(MYSQLI_ASSOC);
}
$flash = $_SESSION['flash'] ?? null;
unset($_SESSION['flash']);
?>
<!doctype html>
<html lang="hy">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>Luxe Jewelry — <?= $isNew ? 'Նոր զարդ' : 'Խմբագրել զարդը' ?></title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=Inter:wght@100..900&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: { primary: '#D4AF37', 'luxe-gold': '#D4AF37', 'luxe-black': '#111827', 'luxe-charcoal': '#1F2937' },
                    fontFamily: { heading: ['Cormorant Garamond', 'serif'], sans: ['Inter', 'sans-serif'] },
                },
            },
        };
    </script>
    <link rel="stylesheet" href="assets/css/admin-custom.css">
    <link rel="stylesheet" href="assets/style.css">
    <script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.7/Sortable.min.js"></script>
    <style>
        body { font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; background-color: #F9FAFB; }
        .font-heading { font-family: 'Cormorant Garamond', serif; }
    </style>
</head>
<body>
<div class="edit-shell">
    <header class="edit-topbar">
        <a class="brand" href="index.php"><span class="brand-mark">L</span><span class="brand-name">luxe <strong>jewelry</strong></span></a>
        <a class="back-link" href="index.php">← Վերադառնալ զարդերին</a>
    </header>
    <main class="edit-content">
        <p class="eyebrow">ԿԱՏԱԼՈԳ</p>
        <h1><?= $isNew ? 'Նոր զարդ' : 'Խմբագրել զարդը' ?></h1>
        <p class="heading-copy"><?= $isNew ? 'Ավելացրեք նոր ապրանք կատալոգում։' : 'Փոփոխությունները պահպանվում են անմիջապես ապրանքի տվյալներում։' ?></p>
        <?php if (is_array($flash)): ?>
            <div class="alert <?= escape((string) $flash['type']) ?>" role="status"><?= escape((string) $flash['message']) ?></div>
        <?php endif; ?>

        <form class="edit-form" action="edit-action.php" method="post" enctype="multipart/form-data">
            <input type="hidden" name="csrf_token" value="<?= escape($_SESSION['csrf_token']) ?>">
            <?php if (!$isNew): ?><input type="hidden" name="product_id" value="<?= (int) $product['id'] ?>"><?php endif; ?>
            <div class="edit-form-grid">
                <label>Անվանում
                    <input type="text" name="name" maxlength="191" value="<?= escape((string) $product['name']) ?>" required>
                </label>
                <label>Կատեգորիա
                    <select name="category" required>
                        <?php foreach ($categories as $value => $label): ?>
                            <option value="<?= escape($value) ?>" <?= $product['category'] === $value ? 'selected' : '' ?>><?= escape($label) ?></option>
                        <?php endforeach; ?>
                    </select>
                </label>
                <label>Գին (դրամ)
                    <input type="number" name="price" min="0" step="1" value="<?= escape((string) $product['price']) ?>" required>
                </label>
                <label>Նյութ / մետաղ
                    <input type="text" name="material_karat" maxlength="191" value="<?= escape((string) ($product['material_karat'] ?? '')) ?>" placeholder="օր․ 14 կարատ ոսկի">
                </label>
                <label>Թանկարժեք քար
                    <input type="text" name="gemstone" maxlength="191" value="<?= escape((string) ($product['gemstone'] ?? '')) ?>" placeholder="օր․ Ադամանդ">
                </label>
                <label>Չափսեր
                    <input type="text" name="dimensions" maxlength="191" value="<?= escape((string) ($product['dimensions'] ?? '')) ?>" placeholder="օր․ 18 մմ">
                </label>
                <label>Պատրաստման օրեր
                    <input type="number" name="preparation_days" min="0" value="<?= (int) $product['preparation_days'] ?>" required>
                </label>
                <label>Գնի տեսակ
                    <select name="price_type">
                        <option value="fixed" <?= $product['price_type'] === 'fixed' ? 'selected' : '' ?>>Ֆիքսված</option>
                        <option value="per_gram" <?= $product['price_type'] === 'per_gram' ? 'selected' : '' ?>>Ըստ գրամի</option>
                    </select>
                </label>
                <label class="edit-description">Նկարագրություն
                    <textarea name="description" rows="4"><?= escape((string) $product['description']) ?></textarea>
                </label>
                <label class="edit-description">Հասանելի նյութեր <span class="optional">(ստորակետով բաժանված)</span>
                    <input type="text" name="available_materials" value="<?= escape(implode(', ', json_decode((string) $product['available_materials'], true) ?: [])) ?>" placeholder="gold_yellow, silver">
                </label>
                <div class="edit-flags">
                    <label class="checkbox-label"><input type="checkbox" name="is_active" value="1" <?= (bool) $product['is_active'] ? 'checked' : '' ?>> Ակտիվ</label>
                    <label class="checkbox-label"><input type="checkbox" name="is_popular" value="1" <?= (bool) $product['is_popular'] ? 'checked' : '' ?>> Հանրաճանաչ</label>
                    <label class="checkbox-label"><input type="checkbox" name="is_new" value="1" <?= (bool) $product['is_new'] ? 'checked' : '' ?>> Նոր</label>
                    <label class="checkbox-label"><input type="checkbox" name="allows_custom_text" value="1" <?= (bool) $product['allows_custom_text'] ? 'checked' : '' ?>> Անհատական գրությամբ</label>
                </div>
                <label class="edit-description">3D մոդելի հասցե / ուղի
                    <input type="text" name="model_3d" value="<?= escape((string) ($product['model_3d'] ?? '')) ?>">
                </label>
                <label class="edit-description">Փորձարկման նկար <span class="optional">(ըստ ցանկության)</span>
                    <input class="edit-file-input" type="file" name="try_on_asset" >
                </label>
            </div>

            <section class="variants-editor">
                <div class="variants-heading"><div><h2>Տարբերակներ և պահեստ</h2><p>Կառավարեք չափսերը, քաշը և առկա քանակը։</p></div><button class="secondary-button" id="add-variant" type="button">＋ Ավելացնել տարբերակ</button></div>
                <div id="variant-list">
                    <?php foreach ($variants as $index => $variant): ?>
                        <div class="variant-row">
                            <input type="hidden" name="variants[<?= $index ?>][id]" value="<?= (int) $variant['id'] ?>">
                            <label>Չափս<input type="text" name="variants[<?= $index ?>][size]" value="<?= escape((string) ($variant['size'] ?? '')) ?>" placeholder="Չափս"></label>
                            <label>Քաշ (գ)<input type="number" name="variants[<?= $index ?>][weight]" min="0" step="0.01" value="<?= escape((string) $variant['weight']) ?>"></label>
                            <label>Քանակ<input type="number" name="variants[<?= $index ?>][stock]" min="0" value="<?= (int) $variant['stock'] ?>"></label>
                            <label>Գին (դրամ)<input type="number" name="variants[<?= $index ?>][price]" min="0" value="<?= escape((string) $variant['price']) ?>"></label>
                            <label class="variant-available"><input type="checkbox" name="variants[<?= $index ?>][is_available]" value="1" <?= (bool) $variant['is_available'] ? 'checked' : '' ?>> Առկա է</label>
                            <button class="remove-variant" type="button" aria-label="Հեռացնել տարբերակը">×</button>
                        </div>
                    <?php endforeach; ?>
                </div>
            </section>

            <section class="variants-editor">
                <div class="variants-heading"><div><h2>Նկարներ</h2><p>Առաջին նկարը հիմնականն է․ քաշեք նկարները՝ հերթականությունը փոխելու համար։</p></div></div>
                <label class="edit-file-label" for="product-images">Ավելացնել նկարներ (մինչև 5)</label>
                <input id="product-images" class="edit-file-input" type="file" accept="image/*" multiple>
                <p id="gallery-count" class="gallery-count">0/5 նկար․ առաջին նկարը կլինի հիմնականը, քաշեք՝ հերթականությունը փոխելու համար։</p>
                <div id="gallery" class="gallery-editor"></div>
                <input type="hidden" name="images_data" id="images-data">
            </section>

            <div class="edit-actions">
                <a class="secondary-button" href="index.php">Չեղարկել</a>
                <button class="primary-button" type="submit">Պահպանել <span>→</span></button>
            </div>
        </form>
    </main>
</div>
<template id="variant-template">
    <div class="variant-row">
        <label>Չափս<input type="text" data-field="size" placeholder="Չափս"></label>
        <label>Քաշ (գ)<input type="number" data-field="weight" min="0" step="0.01" value="0"></label>
        <label>Քանակ<input type="number" data-field="stock" min="0" value="0"></label>
        <label>Գին (դրամ)<input type="number" data-field="price" min="0" value="0"></label>
        <label class="variant-available"><input type="checkbox" data-field="is_available" value="1" checked> Առկա է</label>
        <button class="remove-variant" type="button" aria-label="Հեռացնել տարբերակը">×</button>
    </div>
</template>
<script>
const initialImages = <?= json_encode(array_values(array_merge(
    $product['image'] ? [['key' => 'main', 'type' => 'main', 'id' => null, 'image' => $product['image'], 'preview' => 'image.php?file=' . rawurlencode((string) $product['image'])]] : [],
    array_map(static fn (array $image): array => [
        'key' => 'existing-' . (int) $image['id'],
        'type' => 'existing',
        'id' => (int) $image['id'],
        'image' => $image['image'],
        'preview' => 'image.php?file=' . rawurlencode((string) $image['image']),
    ], array_filter($galleryImages, static fn (array $image): bool => (string) $image['image'] !== (string) ($product['image'] ?? '')))
)), JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT) ?>;
const list = document.getElementById('variant-list');
const template = document.getElementById('variant-template');
let nextVariantIndex = [...list.querySelectorAll('[name^="variants["]')]
    .map((input) => Number(input.name.match(/^variants\[(\d+)\]/)?.[1] || 0))
    .reduce((max, index) => Math.max(max, index + 1), 0);
document.getElementById('add-variant').addEventListener('click', () => {
    const row = template.content.cloneNode(true);
    const index = nextVariantIndex++;
    row.querySelectorAll('[data-field]').forEach((input) => {
        input.name = `variants[${index}][${input.dataset.field}]`;
    });
    list.append(row);
});
list.addEventListener('click', (event) => {
    if (event.target.closest('.remove-variant')) event.target.closest('.variant-row').remove();
});

const gallery = document.getElementById('gallery');
const imageInput = document.getElementById('product-images');
const galleryCount = document.getElementById('gallery-count');
const imagesData = document.getElementById('images-data');
const imageEntries = initialImages.map((entry) => ({ ...entry }));
const renderGallery = () => {
    gallery.innerHTML = imageEntries.map((entry, index) => `
        <div class="gallery-card" draggable="true" data-gallery-item data-key="${entry.key}" data-type="${entry.type}" ${entry.id ? `data-id="${entry.id}"` : ''}>
            <img src="${entry.preview || entry.image}" alt="" draggable="false">
            <span class="gallery-role">${index === 0 ? 'Հիմնական' : 'Նկար'}</span>
            <div class="gallery-card-actions">
                <button type="button" data-drag-image aria-label="Տեղափոխել նկարը">⠿</button>
                <button type="button" data-remove-image aria-label="Հեռացնել նկարը">×</button>
            </div>
        </div>`).join('');
    galleryCount.textContent = `${imageEntries.length}/5 նկար․ առաջին նկարը կլինի հիմնականը, քաշեք՝ հերթականությունը փոխելու համար։`;
    imageInput.disabled = imageEntries.length >= 5;
};
renderGallery();
if (window.Sortable) {
    new window.Sortable(gallery, {
        animation: 150,
        draggable: '[data-gallery-item]',
        handle: '[data-drag-image]',
        onEnd: () => {
            const order = [...gallery.querySelectorAll('[data-gallery-item]')].map((card) => card.dataset.key);
            imageEntries.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
            renderGallery();
        },
    });
} else {
    let draggedKey = null;
    gallery.addEventListener('dragstart', (event) => {
        const card = event.target.closest('[data-gallery-item]');
        if (!card) return;
        draggedKey = card.dataset.key;
        card.classList.add('gallery-dragging');
        event.dataTransfer.effectAllowed = 'move';
    });
    gallery.addEventListener('dragend', (event) => {
        const card = event.target.closest('[data-gallery-item]');
        if (card) card.classList.remove('gallery-dragging');
        draggedKey = null;
    });
    gallery.addEventListener('dragover', (event) => {
        if (draggedKey) event.preventDefault();
    });
    gallery.addEventListener('drop', (event) => {
        event.preventDefault();
        const target = event.target.closest('[data-gallery-item]');
        if (!target || !draggedKey || target.dataset.key === draggedKey) return;
        const fromIndex = imageEntries.findIndex((entry) => entry.key === draggedKey);
        const toIndex = imageEntries.findIndex((entry) => entry.key === target.dataset.key);
        if (fromIndex < 0 || toIndex < 0) return;
        const [entry] = imageEntries.splice(fromIndex, 1);
        imageEntries.splice(toIndex, 0, entry);
        renderGallery();
    });
}
imageInput.addEventListener('change', () => {
    const remaining = Math.max(0, 5 - imageEntries.length);
    [...imageInput.files].slice(0, remaining).forEach((file) => imageEntries.push({
        key: `new-${crypto.randomUUID()}`,
        type: 'new',
        file,
        preview: URL.createObjectURL(file),
    }));
    imageInput.value = '';
    renderGallery();
});
gallery.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-image]');
    if (!button) return;
    const card = button.closest('[data-gallery-item]');
    const index = imageEntries.findIndex((entry) => entry.key === card.dataset.key);
    if (index < 0) return;
    if (imageEntries[index].preview && imageEntries[index].type === 'new') URL.revokeObjectURL(imageEntries[index].preview);
    imageEntries.splice(index, 1);
    renderGallery();
});
document.querySelector('.edit-form').addEventListener('submit', (event) => {
    if (imageEntries.length === 0) {
        event.preventDefault();
        alert('Ավելացրեք առնվազն մեկ նկար։');
        return;
    }
    imagesData.value = JSON.stringify(imageEntries.map((entry) => ({
        type: entry.type,
        id: entry.id || null,
        key: entry.key,
    })));
    const formData = new FormData(event.currentTarget);
    const newImages = imageEntries.filter((entry) => entry.type === 'new');
    formData.delete('product_images');
    newImages.forEach((entry) => {
        const entryIndex = imageEntries.indexOf(entry);
        formData.append(entryIndex === 0 ? 'image' : 'additional_images[]', entry.file);
    });
    event.preventDefault();
    fetch(event.currentTarget.action, { method: 'POST', body: formData })
        .then((response) => {
            if (!response.redirected) throw new Error('Պահպանման սխալ։');
            window.location.href = response.url;
        })
        .catch((error) => alert(error.message));
});
</script>
</body>
</html>
