<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$flash = $_SESSION['flash'] ?? null;
unset($_SESSION['flash']);
$isAuthenticated = isset($_SESSION['admin_id']);
$products = [];
$totalProducts = 0;
$page = filter_var($_GET['page'] ?? 1, FILTER_VALIDATE_INT);
$page = $page !== false && $page > 0 ? $page : 1;
$pageSize = 12;
$search = trim((string) ($_GET['search'] ?? ''));
$category = (string) ($_GET['category'] ?? '');
$categories = productCategories();

if ($isAuthenticated) {
    try {
        $userCheck = $mysqli->prepare('SELECT role, is_active FROM users WHERE id = ? LIMIT 1');
        $adminId = (int) $_SESSION['admin_id'];
        $userCheck->bind_param('i', $adminId);
        $userCheck->execute();
        $currentAdmin = $userCheck->get_result()->fetch_assoc();
        if (!$currentAdmin || $currentAdmin['role'] !== 'admin' || !(bool) $currentAdmin['is_active']) {
            unset($_SESSION['admin_id'], $_SESSION['admin_user']);
            session_regenerate_id(true);
            $isAuthenticated = false;
            $flash = ['type' => 'error', 'message' => 'Ադմինի հաշիվն այլևս ակտիվ չէ։ Կրկին մուտք գործեք։'];
        } else {
            $where = [];
            $parameters = [];
            $types = '';
            if ($search !== '') {
                $where[] = '(p.name LIKE ? OR p.description LIKE ?)';
                $like = '%' . $search . '%';
                $parameters[] = $like;
                $parameters[] = $like;
                $types .= 'ss';
            }
            if (isset($categories[$category])) {
                $where[] = 'p.category = ?';
                $parameters[] = $category;
                $types .= 's';
            } else {
                $category = '';
            }

            $whereSql = $where === [] ? '' : ' WHERE ' . implode(' AND ', $where);
            $countQuery = $mysqli->prepare('SELECT COUNT(*) AS total FROM bakery_app_menuitem p' . $whereSql);
            if ($parameters !== []) {
                $countQuery->bind_param($types, ...$parameters);
            }
            $countQuery->execute();
            $totalProducts = (int) $countQuery->get_result()->fetch_assoc()['total'];
            $totalPages = max(1, (int) ceil($totalProducts / $pageSize));
            $page = min($page, $totalPages);
            $offset = ($page - 1) * $pageSize;

            $productQuery = $mysqli->prepare(
                'SELECT p.id, p.name, p.description, p.price, p.category, p.is_popular, p.is_new, '
                . 'p.is_active, p.image, p.material_karat, p.gemstone, '
                . 'COALESCE((SELECT SUM(v.stock) FROM bakery_app_menuitemvariant v WHERE v.menu_item_id = p.id), 0) AS stock_total '
                . 'FROM bakery_app_menuitem p' . $whereSql . ' ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?'
            );
            $listParameters = $parameters;
            $listTypes = $types . 'ii';
            $listParameters[] = $pageSize;
            $listParameters[] = $offset;
            $productQuery->bind_param($listTypes, ...$listParameters);
            $productQuery->execute();
            $products = $productQuery->get_result()->fetch_all(MYSQLI_ASSOC);
        }
    } catch (mysqli_sql_exception $exception) {
        error_log('Jewelry products could not be loaded: ' . $exception->getMessage());
        $flash = ['type' => 'error', 'message' => 'Չհաջողվեց բեռնել զարդերը։ Ստուգեք MySQL տվյալների բազայի աղյուսակները։'];
    }
}

function pageUrl(int $targetPage, string $search, string $category): string
{
    return '?' . http_build_query(array_filter([
        'page' => $targetPage,
        'search' => $search,
        'category' => $category,
    ], static fn ($value): bool => $value !== ''));
}
?>
<!doctype html>
<html lang="hy">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>Luxe Jewelry — Ադմին Պանել</title>
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
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(212, 175, 55, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(212, 175, 55, 0.4); }
        @supports (padding: env(safe-area-inset-bottom)) { .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom); } }
    </style>
</head>
<body>
<?php if (!$isAuthenticated): ?>
    <main class="login-shell">
        <form class="login-card" method="post" action="actions.php">
            <div class="login-brand">Luxe <span>Jewelry</span></div>
            <p class="eyebrow">ԱԴՄԻՆ ՊԱՆԵԼ</p>
            <h1>Բարի վերադարձ</h1>
            <p class="login-copy">Մուտք գործեք՝ տեսականին կառավարելու համար։</p>
            <?php if (is_array($flash)): ?>
                <div class="alert <?= escape((string) $flash['type']) ?>" role="status"><?= escape((string) $flash['message']) ?></div>
            <?php endif; ?>
            <input type="hidden" name="csrf_token" value="<?= escape($_SESSION['csrf_token']) ?>">
            <input type="hidden" name="action" value="login">
            <label>Մուտքանուն
                <input type="text" name="username" autocomplete="username" required>
            </label>
            <label>Գաղտնաբառ
                <input type="password" name="password" autocomplete="current-password" required>
            </label>
            <button class="primary-button" type="submit">Մուտք <span>→</span></button>
        </form>
    </main>
<?php else: ?>
<div class="app-shell">
    <aside class="sidebar">
        <a class="brand" href="index.php" aria-label="Luxe Jewelry home">
            <span class="brand-mark">L</span>
            <span class="brand-name">luxe <strong>jewelry</strong></span>
        </a>
        <div class="store-label">ԿԱՌԱՎԱՐՈՒՄ</div>
        <nav class="navigation" aria-label="Main navigation">
            <a class="nav-link active" href="index.php"><span class="nav-icon">◇</span>Զարդեր<span class="nav-count"><?= number_format($totalProducts) ?></span></a>
        </nav>
        <div class="sidebar-bottom">
            
            <div class="profile">
                <div class="avatar">L</div>
                <div><strong><?= escape((string) ($_SESSION['admin_user'] ?? 'Ադմին')) ?></strong><span>Ադմին</span></div>
                <form method="post" action="actions.php">
                    <input type="hidden" name="csrf_token" value="<?= escape($_SESSION['csrf_token']) ?>">
                    <input type="hidden" name="action" value="logout">
                    <button class="signout-button" type="submit">Ելք</button>
                </form>
            </div>
        </div>
    </aside>

    <main class="main-content">
        <header class="topbar">
            <div>
                <h2 class="topbar-title">Զարդեր</h2>
                <p class="topbar-subtitle">Կառավարեք ձեր տեսականին</p>
            </div>
            <div class="topbar-actions"><span class="store-status"><i></i> ՕՆԼԱՅՆ</span><div class="top-avatar"><?= escape(mb_strtoupper(mb_substr((string) ($_SESSION['admin_user'] ?? 'A'), 0, 1))) ?></div></div>
        </header>

        <div class="page-content">
            <?php if (is_array($flash)): ?>
                <div class="alert <?= escape((string) $flash['type']) ?>" role="status"><?= escape((string) $flash['message']) ?></div>
            <?php endif; ?>

            <section class="product-filter-panel">
                <form class="filters" method="get" action="index.php">
                    <label class="search-box">
                        <span aria-hidden="true">⌕</span>
                        <input type="search" name="search" placeholder="Փնտրել անունով, նկարագրությամբ..." value="<?= escape($search) ?>">
                    </label>
                    <select name="category" aria-label="Կատեգորիա">
                        <option value="">Բոլորը</option>
                        <?php foreach ($categories as $value => $label): ?>
                            <option value="<?= escape($value) ?>" <?= $category === $value ? 'selected' : '' ?>><?= escape($label) ?></option>
                        <?php endforeach; ?>
                    </select>
                    <button class="filter-button" type="submit">Ֆիլտրել</button>
                </form>
                <a class="primary-button" href="#add-product"><span>＋</span> Ավելացնել զարդ</a>
            </section>

            <section class="collection-section">
                <?php if ($products === []): ?>
                    <div class="empty-state">
                        <span>◇</span>
                        <h3><?= $search !== '' || $category !== '' ? 'Արդյունքներ չեն գտնվել' : 'Տեսականին դատարկ է' ?></h3>
                        <p><?= $search !== '' || $category !== '' ? 'Փորձեք փոխել ֆիլտրները կամ ավելացնել նոր ապրանքը։' : 'Ավելացրեք առաջին զարդը։' ?></p>
                        <?php if ($search === '' && $category === ''): ?><a class="primary-button" href="#add-product">＋ Ավելացնել առաջին զարդը</a><?php endif; ?>
                    </div>
                <?php else: ?>
                    <div class="product-grid">
                        <?php foreach ($products as $product): ?>
                            <?php $productImage = productImageUrl($product['image'] !== null ? (string) $product['image'] : null); ?>
                            <article class="product-card">
                                <a class="product-image-link" href="edit.php?id=<?= (int) $product['id'] ?>">
                                    <div class="product-image-wrap">
                                        <?php if ($productImage !== null): ?>
                                            <img class="product-image" src="image.php?file=<?= urlencode($product['image']) ?>" loading="lazy">
                                        <?php else: ?>
                                            <div class="image-placeholder"><span>◇</span></div>
                                        <?php endif; ?>
                                        <?php if (!(bool) $product['is_active']): ?><span class="hidden-pill">Ապակտիվ</span><?php endif; ?>
                                        <?php if ((bool) $product['is_popular']): ?><span class="featured-pill">ԸՆՏՐՎԱԾ</span><?php endif; ?>
                                    </div>
                                </a>
                                <div class="product-details">
                                    <div class="product-title-row">
                                        <h3><a href="edit.php?id=<?= (int) $product['id'] ?>"><?= escape((string) $product['name']) ?></a></h3>
                                        <?php if ((bool) $product['is_popular']): ?><span class="product-featured">ԸՆՏՐՎԱԾ</span><?php endif; ?>
                                    </div>
                                    <?php if ((string) $product['description'] !== ''): ?>
                                        <p class="product-description"><?= escape((string) $product['description']) ?></p>
                                    <?php endif; ?>
                                    <div class="product-summary">
                                        <p class="product-price"><?= number_format((float) $product['price']) ?> <span>ԴՐԱՄ</span></p>
                                        <span class="product-category"><?= escape($categories[$product['category']] ?? (string) $product['category']) ?></span>
                                    </div>
                                    <div class="product-actions">
                                        <a class="edit-product-link" href="edit.php?id=<?= (int) $product['id'] ?>">✎ ԽՄԲԱԳՐԵԼ</a>
                                        <form method="post" action="actions.php" onsubmit="return confirm('Համոզվա՞ծ եք, որ ցանկանում եք ջնջել այս զարդը։');">
                                            <input type="hidden" name="csrf_token" value="<?= escape($_SESSION['csrf_token']) ?>">
                                            <input type="hidden" name="action" value="delete">
                                            <input type="hidden" name="product_id" value="<?= (int) $product['id'] ?>">
                                            <button class="delete-button" type="submit" aria-label="Ջնջել <?= escape((string) $product['name']) ?>">×</button>
                                        </form>
                                    </div>
                                    <p class="product-stock <?= (int) $product['stock_total'] === 0 ? 'out-of-stock' : '' ?>">
                                        <i></i><?= number_format((int) $product['stock_total']) ?> հատ պահեստում
                                    </p>
                                </div>
                            </article>
                        <?php endforeach; ?>
                    </div>
                    <?php if ($totalProducts > $pageSize): ?>
                        <nav class="pagination" aria-label="Էջեր">
                            <?php if ($page > 1): ?><a href="<?= escape(pageUrl($page - 1, $search, $category)) ?>">← Առաջին</a><a href="<?= escape(pageUrl($page - 1, $search, $category)) ?>">Նախորդ</a><?php endif; ?>
                            <span>Էջ <?= $page ?></span>
                            <?php if ($page * $pageSize < $totalProducts): ?><a href="<?= escape(pageUrl($page + 1, $search, $category)) ?>">Հաջորդ</a><?php endif; ?>
                        </nav>
                    <?php endif; ?>
                <?php endif; ?>
            </section>

            <section class="add-section" id="add-product">
                <div class="add-section-heading">
                    <div>
                        <p class="eyebrow">ԼՐԱՑՐԵՔ ՏԵՍԱԿԱՆԻՆ</p>
                        <h2>Ավելացնել զարդ</h2>
                    </div>
                    <span class="form-sparkle">✳</span>
                </div>
                <form class="product-form" method="post" action="actions.php" enctype="multipart/form-data">
                    <input type="hidden" name="csrf_token" value="<?= escape($_SESSION['csrf_token']) ?>">
                    <input type="hidden" name="action" value="create">
                    <label>Անվանում
                        <input type="text" name="name" maxlength="191" placeholder="e.g. Gold solitaire ring" required>
                    </label>
                    <label>Կատեգորիա
                        <select name="category" required>
                            <?php foreach ($categories as $value => $label): ?>
                                <option value="<?= escape($value) ?>"><?= escape($label) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </label>
                    <label>Գին (դրամ)
                        <input type="number" name="price" min="0" step="1" placeholder="0" required>
                    </label>
                    <label>Քանակ
                        <input type="number" name="stock" min="0" step="1" value="1" required>
                    </label>
                    <label>Չափս <span class="optional">(ըստ ցանկության)</span>
                        <input type="text" name="size" placeholder="e.g. 17">
                    </label>
                    <label>Քաշ (գ)
                        <input type="number" name="weight" min="0" step="0.01" value="0">
                    </label>
                    <label>Կարգավիճակ
                        <select name="is_active"><option value="1">Ակտիվ</option><option value="0">Ապակտիվ</option></select>
                    </label>
                    <label class="image-url-field">Նկարագրություն <span class="optional">(ըստ ցանկության)</span>
                        <textarea name="description" rows="2" placeholder="A short description of this piece"></textarea>
                    </label>
                    <label class="image-url-field">Նկար <span class="optional">(ըստ ցանկության · մինչև 12 ՄԲ)</span>
                        <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif,image/avif">
                    </label>
                    <label class="checkbox-label"><input type="checkbox" name="is_new" value="1"> Նոր</label>
                    <label class="checkbox-label"><input type="checkbox" name="is_popular" value="1"> Հանրաճանաչ</label>
                    <button class="primary-button form-submit" type="submit">Ավելացնել <span>→</span></button>
                </form>
            </section>

            <footer class="page-footer">LUXE JEWELRY <span>·</span> ԱԴՄԻՆ ՊԱՆԵԼ</footer>
        </div>
    </main>
</div>
<?php endif; ?>
</body>
</html>
