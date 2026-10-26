<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

$relativePath = (string) ($_GET['file'] ?? '');
if (preg_match('#^menu/[a-zA-Z0-9_.-]+\.(jpg|png|webp|gif|avif)$#', $relativePath) !== 1) {
    http_response_code(404);
    exit;
}

$imagePath = MENU_UPLOAD_DIR . '/' . basename($relativePath);
if (!is_file($imagePath) || !is_readable($imagePath)) {
    http_response_code(404);
    exit;
}

$mime = (new finfo(FILEINFO_MIME_TYPE))->file($imagePath);
if (!is_string($mime) || !str_starts_with($mime, 'image/')) {
    http_response_code(404);
    exit;
}

header('Content-Type: ' . $mime);
header('Content-Length: ' . (string) filesize($imagePath));
header('Cache-Control: public, max-age=86400');
readfile($imagePath);
