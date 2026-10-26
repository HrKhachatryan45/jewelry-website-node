<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
requireAdmin();

$categories = productCategories();
$productId = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
if ($productId === false || $productId < 1) {
    http_response_code(404);
    exit('Զարդը չի գտնվել։');
}

$statement = $mysqli->prepare('SELECT * FROM bakery_app_menuitem WHERE id = ? LIMIT 1');
$statement->bind_param('i', $productId);
$statement->execute();
$product = $statement->get_result()->fetch_assoc();
if (!$product) {
    http_response_code(404);
    exit('Զարդը չի գտնվել։');
}

$variantsStatement = $mysqli->prepare(
    'SELECT id, size, weight, stock, price, is_available FROM bakery_app_menuitemvariant WHERE menu_item_id = ? ORDER BY id'
);
$variantsStatement->bind_param('i', $productId);
$variantsStatement->execute();
$variants = $variantsStatement->get_result()->fetch_all(MYSQLI_ASSOC);
$galleryStatement = $mysqli->prepare(
    'SELECT id, image, `order` FROM bakery_app_menuitemimage WHERE menu_item_id = ? ORDER BY `order`, id'
);
$galleryStatement->bind_param('i', $productId);
$galleryStatement->execute();
$galleryImages = $galleryStatement->get_result()->fetch_all(MYSQLI_ASSOC);
$flash = $_SESSION['flash'] ?? null;
unset($_SESSION['flash']);
?>
<!doctype html>
<html lang="hy">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>Luxe Jewelry — Խմբագրել զարդը</title>
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
        <p class="eyebrow">ԶԱՐԴԻ ՄԱՆՐԱՄԱՍՆԵՐ</p>
        <h1>Խմբագրել զարդը</h1>
        <p class="heading-copy">Փոփոխությունները պահպանվում են անմիջապես ապրանքի տվյալներում։</p>
        <?php if (is_array($flash)): ?>
            <div class="alert <?= escape((string) $flash['type']) ?>" role="status"><?= escape((string) $flash['message']) ?></div>
        <?php endif; ?>

        <form class="edit-form" action="edit-action.php" method="post" enctype="multipart/form-data">
            <input type="hidden" name="csrf_token" value="<?= escape($_SESSION['csrf_token']) ?>">
            <input type="hidden" name="product_id" value="<?= (int) $product['id'] ?>">
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
                <label class="edit-description">Հիմնական նկար <span class="optional">(պահպանվում է ընդհանուր uploads/menu թղթապանակում)</span>
                    <?php if ($product['image']): ?>
                        <?php $imageUrl = productImageUrl((string) $product['image']); ?>
                        <img class="edit-preview" src="image.php?file=<?= urlencode($product['image']) ?>" alt="Ապրանքի ընթացիկ նկարը">
                    <?php endif; ?>
                    <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif,image/avif">
                </label>
                <label class="edit-description">3D մոդելի հասցե / ուղի
                    <input type="text" name="model_3d" value="<?= escape((string) ($product['model_3d'] ?? '')) ?>">
                </label>
                <label class="edit-description">Փորձարկման նկար <span class="optional">(ըստ ցանկության)</span>
                    <input type="file" name="try_on_asset" accept="image/png">
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
                <div class="variants-heading"><div><h2>Նկարների պատկերասրահ</h2><p>Պահպանելիս առկա պատկերները չեն ջնջվի։</p></div></div>
                <?php if ($galleryImages !== []): ?>
                    <div class="gallery-grid">
                        <?php foreach ($galleryImages as $galleryImage): ?>
                            <?php $galleryUrl = productImageUrl((string) $galleryImage['image']); ?>
                            <img src="image.php?file=<?= urlencode($galleryImage['image']) ?>" alt="Պատկերասրահի նկար" loading="lazy">
                        <?php endforeach; ?>
                    </div>
                <?php else: ?>
                    <p class="gallery-empty">Լրացուցիչ նկարներ չկան։</p>
                <?php endif; ?>
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
</script>
</body>
</html>
