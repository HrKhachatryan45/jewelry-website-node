<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

$relativePath = trim(str_replace('\\', '/', (string) ($_GET['file'] ?? '')));
$relativePath = preg_replace('#^(?:/+|uploads/)+#i', '', $relativePath) ?? '';
$directory = 'menu';
if (preg_match('#^(menu|hero)/(.+)$#i', $relativePath, $matches) === 1) {
    $directory = strtolower($matches[1]);
    $relativePath = $matches[2];
}
$filename = basename($relativePath);
if ($relativePath !== $filename || preg_match('#^[a-zA-Z0-9_.-]+\.(jpe?g|png|webp|gif|avif)$#i', $filename) !== 1) {
    http_response_code(404);
    exit;
}

$uploadDirectories = [
    'menu' => MENU_UPLOAD_DIR,
    'hero' => __DIR__ . '/../server/uploads/hero',
];
$imagePath = $uploadDirectories[$directory] . '/' . $filename;
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
