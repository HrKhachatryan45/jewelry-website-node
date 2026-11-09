<?php
declare(strict_types=1);

session_set_cookie_params([
    'httponly' => true,
    'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'samesite' => 'Lax',
]);
session_start();
require_once __DIR__ . '/db.php';

if (!isset($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

function escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function redirectHome(): never
{
    header('Location: index.php');
    exit;
}

function setFlash(string $type, string $message): void
{
    $_SESSION['flash'] = ['type' => $type, 'message' => $message];
}

function verifyCsrf(): void
{
    $token = $_POST['csrf_token'] ?? '';
    if (!is_string($token) || !hash_equals($_SESSION['csrf_token'], $token)) {
        http_response_code(403);
        exit('Ձևը ժամկետանց է։ Թարմացրեք էջը և կրկին փորձեք։');
    }
}

function requireAdmin(): void
{
    if (!isset($_SESSION['admin_id'])) {
        setFlash('error', 'Մուտք գործեք ադմինի հաշիվով։');
        redirectHome();
    }
}

function productCategories(): array
{
    return [
        'rings' => 'Մատանիներ',
        'necklaces' => 'Վզնոցներ',
        'earrings' => 'Ականջօղեր',
        'bracelets' => 'Ապարանջաններ',
        'bespoke' => 'Անհատական պատվեր',
        'collections' => 'Հավաքածուներ',
    ];
}

function saveProductImage(array $file): ?string
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return null;
    }
    $uploadError = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($uploadError !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'] ?? '')) {
        $messages = [
            UPLOAD_ERR_INI_SIZE => 'Նկարը գերազանցում է PHP-ի upload_max_filesize սահմանաչափը։',
            UPLOAD_ERR_FORM_SIZE => 'Նկարը գերազանցում է ձևի թույլատրած չափը։',
            UPLOAD_ERR_PARTIAL => 'Նկարը ամբողջությամբ չի վերբեռնվել։',
            UPLOAD_ERR_NO_TMP_DIR => 'PHP-ի ժամանակավոր upload թղթապանակը հասանելի չէ։',
            UPLOAD_ERR_CANT_WRITE => 'PHP-ն չի կարող գրել վերբեռնված ֆայլը։',
        ];
        throw new RuntimeException($messages[$uploadError] ?? 'Նկարը չի վերբեռնվել։ Կրկին ընտրեք նկարը։');
    }
    if ((int) ($file['size'] ?? 0) > 12 * 1024 * 1024) {
        throw new RuntimeException('Ընտրեք մինչև 12 ՄԲ չափի նկար։');
    }

    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $extensions = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
        'image/avif' => 'avif',
    ];
    if (!is_string($mime) || !isset($extensions[$mime])) {
        throw new RuntimeException('Ընտրեք JPG, PNG, WebP, GIF կամ AVIF ձևաչափի նկար։');
    }

    if (!is_dir(MENU_UPLOAD_DIR) && !mkdir(MENU_UPLOAD_DIR, 0775, true) && !is_dir(MENU_UPLOAD_DIR)) {
        throw new RuntimeException('Չհաջողվեց ստեղծել ընդհանուր uploads/menu թղթապանակը։');
    }

    $filename = bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
    if (!move_uploaded_file($file['tmp_name'], MENU_UPLOAD_DIR . '/' . $filename)) {
        throw new RuntimeException('Չհաջողվեց պահպանել վերբեռնված նկարը։');
    }

    return MENU_UPLOAD_PATH . '/' . $filename;
}

function slugBase(string $name): string
{
    $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name);
    $slug = strtolower(trim(preg_replace('/[^a-zA-Z0-9]+/', '-', $ascii === false ? $name : $ascii) ?? '', '-'));
    return $slug !== '' ? $slug : 'item';
}

function uniqueProductSlug(mysqli $mysqli, string $name, ?int $excludeId = null): string
{
    $base = slugBase($name);
    $candidate = $base;
    $suffix = 2;

    while (true) {
        if ($excludeId === null) {
            $statement = $mysqli->prepare('SELECT id FROM products WHERE slug = ? LIMIT 1');
            $statement->bind_param('s', $candidate);
        } else {
            $statement = $mysqli->prepare('SELECT id FROM products WHERE slug = ? AND id <> ? LIMIT 1');
            $statement->bind_param('si', $candidate, $excludeId);
        }
        $statement->execute();
        if ($statement->get_result()->num_rows === 0) {
            return $candidate;
        }
        $candidate = $base . '-' . $suffix++;
    }
}

function productImageUrl(?string $image): ?string
{
    if ($image === null || $image === '') {
        return null;
    }
    if (preg_match('#^https?://#i', $image) === 1) {
        return $image;
    }

    return MENU_UPLOAD_DIR . '/' . $image;
}

function adminIcon(string $name): string
{
    $paths = [
        'dashboard' => '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
        'products' => '<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>',
        'hero' => '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
        'orders' => '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
        'bespoke' => '<path d="m2 7 10 5 10-5-10-5-10 5Z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>',
        'reviews' => '<path d="m12 2 3.09 6.26 6.91 1-5 4.87 1.18 6.87L12 17.77l-6.18 3.23L7 14.13 2 9.26l6.91-1L12 2Z"/>',
        'messages' => '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
        'users' => '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        'external' => '<path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
    ];
    $path = $paths[$name] ?? $paths['dashboard'];
    return '<svg class="admin-svg-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' . $path . '</svg>';
}

function saveAdminImage(array $file, string $directory, string $relativeDirectory): string
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'] ?? '')) {
        throw new RuntimeException('Նկարը չի վերբեռնվել։');
    }
    if ((int) ($file['size'] ?? 0) > 12 * 1024 * 1024) {
        throw new RuntimeException('Ընտրեք մինչև 12 ՄԲ չափի նկար։');
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif', 'image/avif' => 'avif'];
    if (!is_string($mime) || !isset($extensions[$mime])) {
        throw new RuntimeException('Ընտրեք JPG, PNG, WebP, GIF կամ AVIF նկար։');
    }
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new RuntimeException('Չհաջողվեց ստեղծել uploads թղթապանակը։');
    }
    $filename = bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
    if (!move_uploaded_file($file['tmp_name'], $directory . '/' . $filename)) {
        throw new RuntimeException('Չհաջողվեց պահպանել նկարը։');
    }
    return $relativeDirectory . '/' . $filename;
}
