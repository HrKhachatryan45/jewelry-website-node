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
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'] ?? '')) {
        throw new RuntimeException('Նկարը չի վերբեռնվել։ Կրկին ընտրեք նկարը։');
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
            $statement = $mysqli->prepare('SELECT id FROM bakery_app_menuitem WHERE slug = ? LIMIT 1');
            $statement->bind_param('s', $candidate);
        } else {
            $statement = $mysqli->prepare('SELECT id FROM bakery_app_menuitem WHERE slug = ? AND id <> ? LIMIT 1');
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
