<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Գործողությունն անհասանելի է։');
}

verifyCsrf();
$action = (string) ($_POST['action'] ?? '');

try {
    if ($action === 'login') {
        $username = trim((string) ($_POST['username'] ?? ''));
        $password = (string) ($_POST['password'] ?? '');

        $statement = $mysqli->prepare(
            "SELECT id, username, password, role, is_active FROM users WHERE username = ? OR email = ? LIMIT 1"
        );
        $statement->bind_param('ss', $username, $username);
        $statement->execute();
        $user = $statement->get_result()->fetch_assoc();

        if (
            !$user
            || !(bool) $user['is_active']
            || $user['role'] !== 'admin'
            || !password_verify($password, (string) $user['password'])
        ) {
            setFlash('error', 'Մուտքանունը կամ գաղտնաբառը սխալ է։');
            redirectHome();
        }

        session_regenerate_id(true);
        $_SESSION['admin_id'] = (int) $user['id'];
        $_SESSION['admin_user'] = (string) $user['username'];
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));

        $loginUpdate = $mysqli->prepare('UPDATE users SET last_login = NOW() WHERE id = ?');
        $userId = (int) $user['id'];
        $loginUpdate->bind_param('i', $userId);
        $loginUpdate->execute();
        redirectHome();
    }

    requireAdmin();

    if ($action === 'logout') {
        unset($_SESSION['admin_id'], $_SESSION['admin_user']);
        session_regenerate_id(true);
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        setFlash('success', 'Դուք դուրս եք եկել համակարգից։');
        redirectHome();
    }

    if ($action === 'create') {
        $name = trim((string) ($_POST['name'] ?? ''));
        $description = trim((string) ($_POST['description'] ?? ''));
        $category = (string) ($_POST['category'] ?? '');
        $price = filter_var($_POST['price'] ?? null, FILTER_VALIDATE_FLOAT);
        $stock = filter_var($_POST['stock'] ?? null, FILTER_VALIDATE_INT);
        $weight = filter_var($_POST['weight'] ?? '0', FILTER_VALIDATE_FLOAT);
        $size = trim((string) ($_POST['size'] ?? ''));
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
        if ($stock === false || $stock < 0) {
            throw new RuntimeException('Մուտքագրեք պահեստի ճիշտ քանակը։');
        }
        if ($weight === false || $weight < 0) {
            throw new RuntimeException('Մուտքագրեք ճիշտ քաշը։');
        }

        $imagePath = saveProductImage($_FILES['image'] ?? []);
        $slug = uniqueProductSlug($mysqli, $name);
        $priceValue = (string) (int) round((float) $price);
        $isPopular = isset($_POST['is_popular']) ? 1 : 0;
        $isNew = isset($_POST['is_new']) ? 1 : 0;
        $isActive = ($_POST['is_active'] ?? '1') === '0' ? 0 : 1;
        $availableMaterials = json_encode([], JSON_THROW_ON_ERROR);

        $mysqli->begin_transaction();
        try {
            $statement = $mysqli->prepare(
                'INSERT INTO bakery_app_menuitem '
                . '(name, slug, description, price, category, is_popular, is_new, is_active, image, '
                . 'available_materials, created_at, updated_at) '
                . 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())'
            );
            $statement->bind_param(
                'sssssiiiss',
                $name,
                $slug,
                $description,
                $priceValue,
                $category,
                $isPopular,
                $isNew,
                $isActive,
                $imagePath,
                $availableMaterials
            );
            $statement->execute();
            $menuItemId = (int) $mysqli->insert_id;

            $variantPrice = $priceValue;
            $variantStock = (int) $stock;
            $variantWeight = (string) $weight;
            $available = 1;
            $variant = $mysqli->prepare(
                'INSERT INTO bakery_app_menuitemvariant '
                . '(menu_item_id, size, weight, stock, price, is_available) VALUES (?, ?, ?, ?, ?, ?)'
            );
            $variant->bind_param(
                'issisi',
                $menuItemId,
                $size,
                $variantWeight,
                $variantStock,
                $variantPrice,
                $available
            );
            $variant->execute();
            $mysqli->commit();
        } catch (Throwable $exception) {
            $mysqli->rollback();
            if ($imagePath !== null && is_file(MENU_UPLOAD_DIR . '/' . basename($imagePath))) {
                unlink(MENU_UPLOAD_DIR . '/' . basename($imagePath));
            }
            throw $exception;
        }

        setFlash('success', 'Զարդը ավելացվել է տեսականուն։');
        redirectHome();
    }

    if ($action === 'delete') {
        $productId = filter_var($_POST['product_id'] ?? null, FILTER_VALIDATE_INT);
        if ($productId === false || $productId < 1) {
            throw new RuntimeException('Ընտրեք ջնջելու ենթակա զարդը։');
        }

        $statement = $mysqli->prepare('DELETE FROM bakery_app_menuitem WHERE id = ?');
        $statement->bind_param('i', $productId);
        $statement->execute();
        setFlash($statement->affected_rows > 0 ? 'success' : 'error', $statement->affected_rows > 0
            ? 'Զարդը հեռացվել է տեսականուց։'
            : 'Զարդը չի գտնվել։');
        redirectHome();
    }
} catch (RuntimeException $exception) {
    setFlash('error', $exception->getMessage());
    redirectHome();
} catch (mysqli_sql_exception $exception) {
    error_log('Jewelry product operation failed: ' . $exception->getMessage());
    setFlash('error', 'Չհաջողվեց պահպանել զարդը։ Ստուգեք տվյալների բազայի աղյուսակները և կրկին փորձեք։');
    redirectHome();
}

http_response_code(400);
exit('Անհայտ գործողություն։');
