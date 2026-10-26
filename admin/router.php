<?php
declare(strict_types=1);

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if (!is_string($requestPath) || preg_match('#(^|/)\.[^/]*#', $requestPath) === 1) {
    http_response_code(404);
    exit;
}

return false;
