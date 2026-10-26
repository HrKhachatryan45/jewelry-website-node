<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
requireAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Գործողությունն անհասանելի է։');
}
verifyCsrf();

$productId = filter_var($_POST['product_id'] ?? null, FILTER_VALIDATE_INT);
if ($productId === false || $productId < 1) {
    http_response_code(400);
    exit('Սխալ ապրանք։');
}

$imagePath = null;
$tryOnPath = null;

try {
    $name = trim((string) ($_POST['name'] ?? ''));
    $description = trim((string) ($_POST['description'] ?? ''));
    $category = (string) ($_POST['category'] ?? '');
    $price = filter_var($_POST['price'] ?? null, FILTER_VALIDATE_FLOAT);
    $preparationDays = filter_var($_POST['preparation_days'] ?? null, FILTER_VALIDATE_INT);
    $categories = productCategories();
    if ($name === '' || mb_strlen($name) > 191) {
        throw new RuntimeException('Մուտքագրեք զարդի անվանումը (մինչև 191 նիշ)։');
    }
    if (!isset($categories[$category])) {
        throw new RuntimeException('Ընտրեք զարդի ճիշտ կատեգորիան։');
    }
    if ($price === false || $price < 0 || $price > 9999999999) {
        throw new RuntimeException('Մուտքագրեք ճիշտ գինը։');
    }
    if ($preparationDays === false || $preparationDays < 0) {
        throw new RuntimeException('Մուտքագրեք պատրաստման օրերի ճիշտ քանակը։');
    }

    $productStatement = $mysqli->prepare('SELECT id, name FROM bakery_app_menuitem WHERE id = ? LIMIT 1');
    $productStatement->bind_param('i', $productId);
    $productStatement->execute();
    $current = $productStatement->get_result()->fetch_assoc();
    if (!$current) {
        throw new RuntimeException('Զարդն այլևս գոյություն չունի։');
    }

    $variants = $_POST['variants'] ?? [];
    if (!is_array($variants)) {
        throw new RuntimeException('Զարդի տարբերակները սխալ են։');
    }

    $existingStatement = $mysqli->prepare(
        'SELECT id FROM bakery_app_menuitemvariant WHERE menu_item_id = ?'
    );
    $existingStatement->bind_param('i', $productId);
    $existingStatement->execute();
    $existingIds = array_map(
        static fn (array $row): int => (int) $row['id'],
        $existingStatement->get_result()->fetch_all(MYSQLI_ASSOC)
    );
    $keptIds = [];
    $cleanVariants = [];
    foreach ($variants as $variant) {
        if (!is_array($variant)) {
            throw new RuntimeException('Զարդի տարբերակը սխալ է։');
        }
        $variantId = filter_var($variant['id'] ?? null, FILTER_VALIDATE_INT);
        $weight = filter_var($variant['weight'] ?? null, FILTER_VALIDATE_FLOAT);
        $stock = filter_var($variant['stock'] ?? null, FILTER_VALIDATE_INT);
        $variantPrice = filter_var($variant['price'] ?? null, FILTER_VALIDATE_FLOAT);
        $size = trim((string) ($variant['size'] ?? ''));

        if ($weight === false || $weight < 0 || $stock === false || $stock < 0 || $variantPrice === false || $variantPrice < 0) {
            throw new RuntimeException('Ստուգեք յուրաքանչյուր տարբերակի քաշը, պահեստի քանակը և գինը։');
        }
        if ($variantId !== false && $variantId > 0) {
            if (!in_array($variantId, $existingIds, true)) {
                throw new RuntimeException('Ընտրված տարբերակը չի պատկանում այս զարդին։');
            }
            $keptIds[] = $variantId;
        } else {
            $variantId = null;
        }
        $cleanVariants[] = [
            'id' => $variantId,
            'size' => $size !== '' ? $size : null,
            'weight' => (string) $weight,
            'stock' => (int) $stock,
            'price' => (string) (int) round((float) $variantPrice),
            'available' => isset($variant['is_available']) ? 1 : 0,
        ];
    }

    $imagePath = saveProductImage($_FILES['image'] ?? []);
    $tryOnPath = saveProductImage($_FILES['try_on_asset'] ?? []);
    if ($tryOnPath !== null && pathinfo($tryOnPath, PATHINFO_EXTENSION) !== 'png') {
        unlink(MENU_UPLOAD_DIR . '/' . basename($tryOnPath));
        $tryOnPath = null;
        throw new RuntimeException('Փորձարկման նկարը պետք է լինի PNG ձևաչափով։');
    }

    $slug = $name !== $current['name'] ? uniqueProductSlug($mysqli, $name, $productId) : null;
    $priceValue = (string) (int) round((float) $price);
    $material = trim((string) ($_POST['material_karat'] ?? ''));
    $gemstone = trim((string) ($_POST['gemstone'] ?? ''));
    $dimensions = trim((string) ($_POST['dimensions'] ?? ''));
    $model3d = trim((string) ($_POST['model_3d'] ?? ''));
    $priceType = ($_POST['price_type'] ?? 'fixed') === 'per_gram' ? 'per_gram' : 'fixed';
    $materialsInput = trim((string) ($_POST['available_materials'] ?? ''));
    $availableMaterials = $materialsInput === ''
        ? []
        : array_values(array_unique(array_filter(array_map('trim', explode(',', $materialsInput)))));
    $materialsJson = json_encode($availableMaterials, JSON_THROW_ON_ERROR);
    $isPopular = isset($_POST['is_popular']) ? 1 : 0;
    $isNew = isset($_POST['is_new']) ? 1 : 0;
    $isActive = isset($_POST['is_active']) ? 1 : 0;
    $allowsCustomText = isset($_POST['allows_custom_text']) ? 1 : 0;

    $mysqli->begin_transaction();
    try {
        if ($imagePath === null && $tryOnPath === null && $slug === null) {
            $statement = $mysqli->prepare(
                'UPDATE bakery_app_menuitem SET name=?, description=?, price=?, category=?, '
                . 'is_popular=?, is_new=?, is_active=?, material_karat=?, gemstone=?, dimensions=?, '
                . 'available_materials=?, allows_custom_text=?, preparation_days=?, price_type=?, '
                . 'model_3d=?, updated_at=NOW() WHERE id=?'
            );
            $statement->bind_param(
                'ssssiiissssiissi',
                $name,
                $description,
                $priceValue,
                $category,
                $isPopular,
                $isNew,
                $isActive,
                $material,
                $gemstone,
                $dimensions,
                $materialsJson,
                $allowsCustomText,
                $preparationDays,
                $priceType,
                $model3d,
                $productId
            );
        } else {
            $slugValue = $slug ?? (string) $current['name'];
            $sql = 'UPDATE bakery_app_menuitem SET name=?, description=?, price=?, category=?, '
                . 'is_popular=?, is_new=?, is_active=?, material_karat=?, gemstone=?, dimensions=?, '
                . 'available_materials=?, allows_custom_text=?, preparation_days=?, price_type=?, '
                . 'model_3d=?, updated_at=NOW()';
            $types = 'ssssiiissssiiss';
            $values = [
                &$name, &$description, &$priceValue, &$category, &$isPopular, &$isNew, &$isActive,
                &$material, &$gemstone, &$dimensions, &$materialsJson, &$allowsCustomText,
                &$preparationDays, &$priceType, &$model3d,
            ];
            if ($slug !== null) {
                $sql .= ', slug=?';
                $types .= 's';
                $values[] = &$slugValue;
            }
            if ($imagePath !== null) {
                $sql .= ', image=?';
                $types .= 's';
                $values[] = &$imagePath;
            }
            if ($tryOnPath !== null) {
                $sql .= ', try_on_asset=?';
                $types .= 's';
                $values[] = &$tryOnPath;
            }
            $sql .= ' WHERE id=?';
            $types .= 'i';
            $values[] = &$productId;
            $statement = $mysqli->prepare($sql);
            $statement->bind_param($types, ...$values);
        }
        $statement->execute();

        foreach ($existingIds as $existingId) {
            if (!in_array($existingId, $keptIds, true)) {
                $deleteVariant = $mysqli->prepare(
                    'DELETE FROM bakery_app_menuitemvariant WHERE id = ? AND menu_item_id = ?'
                );
                $deleteVariant->bind_param('ii', $existingId, $productId);
                $deleteVariant->execute();
            }
        }

        foreach ($cleanVariants as $variant) {
            if ($variant['id'] === null) {
                $insertVariant = $mysqli->prepare(
                    'INSERT INTO bakery_app_menuitemvariant '
                    . '(menu_item_id, size, weight, stock, price, is_available) VALUES (?, ?, ?, ?, ?, ?)'
                );
                $insertVariant->bind_param(
                    'issisi',
                    $productId,
                    $variant['size'],
                    $variant['weight'],
                    $variant['stock'],
                    $variant['price'],
                    $variant['available']
                );
                $insertVariant->execute();
            } else {
                $updateVariant = $mysqli->prepare(
                    'UPDATE bakery_app_menuitemvariant SET size=?, weight=?, stock=?, price=?, is_available=? '
                    . 'WHERE id=? AND menu_item_id=?'
                );
                $updateVariant->bind_param(
                    'ssisiii',
                    $variant['size'],
                    $variant['weight'],
                    $variant['stock'],
                    $variant['price'],
                    $variant['available'],
                    $variant['id'],
                    $productId
                );
                $updateVariant->execute();
            }
        }
        $mysqli->commit();
    } catch (Throwable $exception) {
        $mysqli->rollback();
        foreach ([$imagePath, $tryOnPath] as $uploadedPath) {
            if ($uploadedPath !== null && is_file(MENU_UPLOAD_DIR . '/' . basename($uploadedPath))) {
                unlink(MENU_UPLOAD_DIR . '/' . basename($uploadedPath));
            }
        }
        throw $exception;
    }

    setFlash('success', 'Փոփոխությունները պահպանվել են։');
    redirectHome();
} catch (RuntimeException $exception) {
    setFlash('error', $exception->getMessage());
    header('Location: edit.php?id=' . $productId);
    exit; 
} catch (mysqli_sql_exception $exception) {
    error_log('Jewelry product update failed: ' . $exception->getMessage());
    setFlash('error', 'Չհաջողվեց թարմացնել զարդը։ Ստուգեք տվյալների բազայի աղյուսակները և կրկին փորձեք։');
    header('Location: edit.php?id=' . $productId);
    exit;
}
