<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
requireAdmin();

function adminQuery(string $sql, string $types = '', array $values = []): mysqli_result
{
    global $mysqli;
    $statement = $mysqli->prepare($sql);
    if ($types !== '') {
        $statement->bind_param($types, ...$values);
    }
    $statement->execute();
    return $statement->get_result();
}

function adminPost(string $action, array $fields = []): string
{
    $html = '<form method="post" action="actions.php"';
    if (isset($fields['enctype'])) {
        $html .= ' enctype="' . escape((string) $fields['enctype']) . '"';
        unset($fields['enctype']);
    }
    $html .= '>';
    $html .= '<input type="hidden" name="csrf_token" value="' . escape($_SESSION['csrf_token']) . '">';
    $html .= '<input type="hidden" name="action" value="' . escape($action) . '">';
    foreach ($fields as $name => $value) {
        $html .= '<input type="hidden" name="' . escape((string) $name) . '" value="' . escape((string) $value) . '">';
    }
    return $html;
}

function adminHeader(string $title, string $active): void
{
    $links = [
        'dashboard' => ['Վահանակ', 'dashboard.php'],
        'products' => ['Զարդեր', 'index.php'],
        'hero' => ['Գլխ. նկարներ', 'content.php?view=hero'],
        'orders' => ['Պատվերներ', 'content.php?view=orders'],
        'bespoke' => ['Անհատական', 'content.php?view=bespoke'],
        'reviews' => ['Կարծիքներ', 'content.php?view=reviews'],
        'messages' => ['Կապ', 'content.php?view=messages'],
        'users' => ['Օգտատերեր', 'content.php?view=users'],
    ];
    ?>
    <!doctype html>
    <html lang="hy">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="robots" content="noindex, nofollow">
        <title>Luxe Jewelry — <?= escape($title) ?></title>
        <script>
            tailwind.config = {
                    theme: {
                        extend: {
                            colors: {
                                primary: '#D4AF37',
                                'luxe-gold': '#D4AF37',
                                'luxe-black': '#111827',
                                'luxe-charcoal': '#1F2937'
                            },
                            fontFamily: { heading: ['Cormorant Garamond', 'serif'], sans: ['Inter', 'sans-serif'] }
                        }
                    }
            };
        </script>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=Inter:wght@100..900&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="<?= escape(rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/') . '/assets/style.css') ?>">
        <style>
            body { font-family: Inter, sans-serif; -webkit-font-smoothing: antialiased; }
            .font-heading { font-family: "Cormorant Garamond", serif; }
            .admin-table { width: 100%; border-collapse: collapse; background: #fff; }
            .admin-table th { padding: 20px 32px; background: #f9fafb; color: #9ca3af; font-size: 9px; letter-spacing: .3em; text-align: left; text-transform: uppercase; }
            .admin-table td { padding: 24px 32px; border-top: 1px solid #f3f4f6; font-size: 11px; }
            .admin-card { border: 1px solid #e5e7eb; background: #fff; box-shadow: 0 1px 3px rgb(17 24 39 / .05); }
            .admin-input { width: 100%; padding: 12px 16px; border: 1px solid #e5e7eb; outline: 0; font-size: 10px; font-weight: 700; letter-spacing: .1em; }
            .admin-input:focus { border-color: #d4af37; box-shadow: 0 0 0 1px #d4af37; }
            .admin-label { display: block; margin-bottom: 8px; color: #9ca3af; font-size: 10px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; }
            .admin-button { display: inline-flex; min-height: 40px; align-items: center; justify-content: center; padding: 0 20px; border: 0; background: #d4af37; color: #111827; font-size: 10px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; transition: all .2s; }
            .admin-button:hover { background: #111827; color: #d4af37; }
            .admin-button.dark { background: #111827; color: #d4af37; }
            .admin-button.danger { background: #fef2f2; color: #dc2626; }
            .nav-section { margin: 8px 16px 8px; color: rgb(255 255 255 / .2); font-size: 9px; font-weight: 700; letter-spacing: .4em; text-transform: uppercase; }
            .nav-section:first-child { margin-top: 0; }
            .mobile-logout { font-family: inherit; }
        </style>
    </head>
    <body>
    <div class="app-shell">
        <aside class="sidebar">
            <a class="brand" href="dashboard.php"><span class="brand-mark">L</span><span class="brand-name">luxe <strong>jewelry</strong></span></a>
            <nav class="navigation custom-scrollbar pt-5" aria-label="Main navigation">
                <p class="nav-section">Վահանակ</p>
                <?php foreach (['dashboard' => $links['dashboard']] as $key => [$label, $href]): ?>
                    <a class="nav-link <?= $active === $key ? 'active' : '' ?>" href="<?= escape($href) ?>"><span class="nav-icon"><?= adminIcon($key) ?></span><?= escape($label) ?></a>
                <?php endforeach; ?>
                <p class="nav-section">Կառավարում</p>
                <?php foreach (array_slice($links, 1, 7, true) as $key => [$label, $href]): ?>
                    <a class="nav-link <?= $active === $key ? 'active' : '' ?>" href="<?= escape($href) ?>"><span class="nav-icon"><?= adminIcon($key) ?></span><?= escape($label) ?></a>
                <?php endforeach; ?>
            </nav>
            <div class="p-6 border-t border-white/5"><a href="/" target="_blank" class="nav-link text-white/40"><span class="nav-icon"><?= adminIcon('external') ?></span>Դիտել կայքը</a></div>
            <div class="sidebar-bottom">
                <div class="profile">
                    <div class="avatar">L</div>
                    <div><strong><?= escape((string) ($_SESSION['admin_user'] ?? 'Ադմին')) ?></strong><span>Ադմին</span></div>
                    <?= adminPost('logout') ?><button class="signout-button" type="submit">Ելք</button></form>
                </div>
            </div>
        </aside>
        <nav class="mobile-admin-nav" aria-label="Mobile navigation">
            <div class="mobile-admin-nav-inner">
            <?php foreach (['dashboard' => ['Վահանակ', 'dashboard.php'], 'products' => ['Զարդեր', 'index.php'], 'hero' => ['Գլխ. Նկարներ', 'content.php?view=hero'], 'orders' => ['Պատվերներ', 'content.php?view=orders'], 'bespoke' => ['Անհատական', 'content.php?view=bespoke']] as $key => [$label, $href]): ?>
                <a class="<?= $active === $key ? 'active' : '' ?>" href="<?= escape($href) ?>"><span><?= adminIcon($key) ?></span><?= escape($label) ?></a>
            <?php endforeach; ?>
            <?= adminPost('logout') ?><button class="mobile-logout" type="submit"><span><?= adminIcon('logout') ?></span>Ելք</button></form>
            </div>
        </nav>
        <main class="main-content">
            <header class="topbar">
                <div class="mobile-brand"><span>Luxe</span> <strong>Jewelry</strong></div>
                <div class="desktop-page-heading"><h2 class="topbar-title"><?= escape($title) ?></h2><p class="topbar-subtitle"><?= escape($title === 'Գլխավոր' ? 'Բարի գալուստ ձեր ադմինիստրատիվ վահանակ' : 'Կառավարեք ձեր տվյալները') ?></p></div>
                <div class="topbar-actions"><div class="store-status"><i></i> ՕՆԼԱՅՆ</div><div class="top-avatar"><?= escape(mb_strtoupper(mb_substr((string) ($_SESSION['admin_user'] ?? 'A'), 0, 1))) ?></div></div>
            </header>
            <div class="page-content">
    <?php
}

function adminFooter(): void
{
    $flash = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    if (is_array($flash)): ?>
        <div class="alert <?= escape((string) $flash['type']) ?>" role="status"><?= escape((string) $flash['message']) ?></div>
    <?php endif; ?>
            </div>
        </main>
    </div>
    </body>
    </html>
    <?php
}

function statusLabel(string $status): string
{
    return [
        'new' => 'Նոր',
        'confirmed' => 'Հաստատված',
        'ready' => 'Պատրաստ',
        'delivered' => 'Ավարտված',
        'cancelled' => 'Չեղարկված',
        'contacted' => 'Կապ հաստատված',
        'in_progress' => 'Ընթացքում',
        'completed' => 'Ավարտված',
    ][$status] ?? $status;
}
