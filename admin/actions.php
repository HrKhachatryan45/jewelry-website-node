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
                'INSERT INTO products '
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
                'INSERT INTO product_variants '
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

        $statement = $mysqli->prepare('DELETE FROM products WHERE id = ?');
        $statement->bind_param('i', $productId);
        $statement->execute();
        setFlash($statement->affected_rows > 0 ? 'success' : 'error', $statement->affected_rows > 0
            ? 'Զարդը հեռացվել է տեսականուց։'
            : 'Զարդը չի գտնվել։');
        redirectHome();
    }

    if ($action === 'hero_settings') {
        $titleLine1 = trim((string) ($_POST['title_line1'] ?? ''));
        $titleHighlight = trim((string) ($_POST['title_highlight'] ?? ''));
        $description = trim((string) ($_POST['description'] ?? ''));
        $statement = $mysqli->prepare(
            'INSERT INTO hero_settings (id, title_line1, title_highlight, description) VALUES (1, ?, ?, ?)
             ON DUPLICATE KEY UPDATE title_line1 = VALUES(title_line1), title_highlight = VALUES(title_highlight), description = VALUES(description)'
        );
        $statement->bind_param('sss', $titleLine1, $titleHighlight, $description);
        $statement->execute();
        setFlash('success', 'Գլխավոր էջի տեքստը թարմացվեց։');
        header('Location: content.php?view=hero');
        exit;
    }

    if ($action === 'hero_slide') {
        $title = trim((string) ($_POST['title'] ?? ''));
        $order = filter_var($_POST['order'] ?? 0, FILTER_VALIDATE_INT);
        $image = saveAdminImage($_FILES['image'] ?? [], __DIR__ . '/../server/uploads/hero', 'hero');
        $statement = $mysqli->prepare('INSERT INTO hero_slides (image, title, `order`, is_active) VALUES (?, ?, ?, 1)');
        $order = $order === false ? 0 : $order;
        $statement->bind_param('ssi', $image, $title, $order);
        $statement->execute();
        setFlash('success', 'Սլայդը ավելացվեց։');
        header('Location: content.php?view=hero');
        exit;
    }

    if ($action === 'hero_delete') {
        $id = (int) ($_POST['id'] ?? 0);
        $statement = $mysqli->prepare('DELETE FROM hero_slides WHERE id = ?');
        $statement->bind_param('i', $id);
        $statement->execute();
        setFlash('success', 'Սլայդը հեռացվեց։');
        header('Location: content.php?view=hero');
        exit;
    }

    if ($action === 'hero_update') {
        $id = (int) ($_POST['id'] ?? 0);
        $title = trim((string) ($_POST['title'] ?? ''));
        $order = (int) ($_POST['order'] ?? 0);
        $active = isset($_POST['is_active']) ? 1 : 0;
        if (isset($_FILES['image']) && ($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
            $image = saveAdminImage($_FILES['image'], __DIR__ . '/../server/uploads/hero', 'hero');
            $statement = $mysqli->prepare('UPDATE hero_slides SET title = ?, `order` = ?, is_active = ?, image = ? WHERE id = ?');
            $statement->bind_param('siisi', $title, $order, $active, $image, $id);
        } else {
            $statement = $mysqli->prepare('UPDATE hero_slides SET title = ?, `order` = ?, is_active = ? WHERE id = ?');
            $statement->bind_param('siii', $title, $order, $active, $id);
        }
        $statement->execute();
        setFlash('success', 'Սլայդը թարմացվեց։');
        header('Location: content.php?view=hero');
        exit;
    }

    if ($action === 'order_paid') {
        $id = (int) ($_POST['id'] ?? 0);
        $value = (int) ($_POST['value'] ?? 0) === 1 ? 1 : 0;
        $statement = $mysqli->prepare('UPDATE orders SET is_paid = ? WHERE id = ?');
        $statement->bind_param('ii', $value, $id);
        $statement->execute();
        setFlash('success', 'Վճարման կարգավիճակը թարմացվեց։');
        header('Location: ' . (!empty($_POST['order']) ? 'order-detail.php?id=' . (int) $_POST['order'] : 'content.php?view=orders'));
        exit;
    }

    if ($action === 'order_update') {
        $id = (int) ($_POST['id'] ?? 0);
        $status = (string) ($_POST['status'] ?? '');
        if (!in_array($status, ['new', 'confirmed', 'ready', 'delivered', 'cancelled'], true)) {
            throw new RuntimeException('Պատվերի կարգավիճակը սխալ է։');
        }
        $statement = $mysqli->prepare('UPDATE orders SET status = ? WHERE id = ?');
        $statement->bind_param('si', $status, $id);
        $statement->execute();
        setFlash('success', 'Պատվերի կարգավիճակը թարմացվեց։');
        header('Location: ' . (!empty($_POST['order']) ? 'order-detail.php?id=' . (int) $_POST['order'] : 'content.php?view=orders'));
        exit;
    }

    if ($action === 'order_delete') {
        $id = (int) ($_POST['id'] ?? 0);
        $statement = $mysqli->prepare('DELETE FROM orders WHERE id = ?');
        $statement->bind_param('i', $id);
        $statement->execute();
        setFlash('success', 'Պատվերը հեռացվեց։');
        header('Location: content.php?view=orders');
        exit;
    }

    if ($action === 'bespoke_update') {
        $id = (int) ($_POST['id'] ?? 0);
        $status = (string) ($_POST['status'] ?? '');
        if (!in_array($status, ['new', 'contacted', 'in_progress', 'completed', 'cancelled'], true)) {
            throw new RuntimeException('Հայտի կարգավիճակը սխալ է։');
        }
        $statement = $mysqli->prepare('UPDATE bespoke_orders SET status = ? WHERE id = ?');
        $statement->bind_param('si', $status, $id);
        $statement->execute();
        setFlash('success', 'Հայտի կարգավիճակը թարմացվեց։');
        header('Location: ' . (!empty($_POST['bespoke_detail']) ? 'bespoke-detail.php?id=' . $id : 'content.php?view=bespoke'));
        exit;
    }

    if ($action === 'review_delete') {
        $id = (int) ($_POST['id'] ?? 0);
        $statement = $mysqli->prepare('DELETE FROM reviews WHERE id = ?');
        $statement->bind_param('i', $id);
        $statement->execute();
        setFlash('success', 'Կարծիքը հեռացվեց։');
        header('Location: content.php?view=reviews');
        exit;
    }

    if ($action === 'review_toggle') {
        $id = (int) ($_POST['id'] ?? 0);
        $value = (int) ($_POST['value'] ?? 0) === 1 ? 1 : 0;
        $statement = $mysqli->prepare('UPDATE reviews SET is_approved = ? WHERE id = ?');
        $statement->bind_param('ii', $value, $id);
        $statement->execute();
        setFlash('success', 'Կարծիքի կարգավիճակը թարմացվեց։');
        header('Location: content.php?view=reviews');
        exit;
    }

    if ($action === 'message_delete') {
        $id = (int) ($_POST['id'] ?? 0);
        $statement = $mysqli->prepare('DELETE FROM contact_messages WHERE id = ?');
        $statement->bind_param('i', $id);
        $statement->execute();
        setFlash('success', 'Հաղորդագրությունը հեռացվեց։');
        header('Location: content.php?view=messages');
        exit;
    }

    if ($action === 'user_create') {
        $username = trim((string) ($_POST['username'] ?? ''));
        $email = trim((string) ($_POST['email'] ?? ''));
        $password = (string) ($_POST['password'] ?? '');
        if ($username === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 6) {
            throw new RuntimeException('Մուտքագրեք ճիշտ օգտատիրոջ տվյալներ։');
        }
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $role = 'admin';
        $active = 1;
        $statement = $mysqli->prepare('INSERT INTO users (username, email, password, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())');
        $statement->bind_param('ssssi', $username, $email, $hash, $role, $active);
        $statement->execute();
        setFlash('success', 'Ադմինի հաշիվը ստեղծվեց։');
        header('Location: content.php?view=users');
        exit;
    }

    if ($action === 'user_delete') {
        $id = (int) ($_POST['id'] ?? 0);
        if ($id === (int) ($_SESSION['admin_id'] ?? 0)) {
            throw new RuntimeException('Չեք կարող ջնջել ակտիվ ադմինի հաշիվը։');
        }
        $statement = $mysqli->prepare('DELETE FROM users WHERE id = ?');
        $statement->bind_param('i', $id);
        $statement->execute();
        setFlash('success', 'Օգտատերը հեռացվեց։');
        header('Location: content.php?view=users');
        exit;
    }

    if ($action === 'user_role' || $action === 'user_active') {
        $id = (int) ($_POST['id'] ?? 0);
        if ($action === 'user_role') {
            $role = (string) ($_POST['role'] ?? '');
            if (!in_array($role, ['admin', 'customer'], true)) {
                throw new RuntimeException('Օգտատիրոջ դերը սխալ է։');
            }
            $statement = $mysqli->prepare('UPDATE users SET role = ? WHERE id = ?');
            $statement->bind_param('si', $role, $id);
        } else {
            $value = (int) ($_POST['value'] ?? 0) === 1 ? 1 : 0;
            if ($id === (int) ($_SESSION['admin_id'] ?? 0) && $value === 0) {
                throw new RuntimeException('Չեք կարող անջատել ակտիվ ադմինին։');
            }
            $statement = $mysqli->prepare('UPDATE users SET is_active = ? WHERE id = ?');
            $statement->bind_param('ii', $value, $id);
        }
        $statement->execute();
        setFlash('success', 'Օգտատիրոջ տվյալները թարմացվեցին։');
        header('Location: content.php?view=users');
        exit;
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
