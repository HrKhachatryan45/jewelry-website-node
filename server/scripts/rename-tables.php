<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Run this script from the command line.\n");
    exit(1);
}

$envPath = __DIR__ . '/../.env';
if (is_file($envPath)) {
    foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) continue;
        [$key, $value] = array_pad(explode('=', $line, 2), 2, '');
        $value = trim($value);
        if (strlen($value) >= 2 && (($value[0] === '"' && $value[-1] === '"') || ($value[0] === "'" && $value[-1] === "'"))) {
            $value = substr($value, 1, -1);
        }
        if (getenv(trim($key)) === false) putenv(trim($key) . '=' . $value);
    }
}

$url = getenv('DATABASE_URL') ?: '';
$parts = parse_url($url);
$scheme = is_array($parts) ? strtolower((string) ($parts['scheme'] ?? '')) : '';
if (!is_array($parts) || !in_array($scheme, ['mysql', 'postgresql', 'postgres'], true)) {
    fwrite(STDERR, "DATABASE_URL must use mysql:// or postgresql:// and point to the database being migrated.\n");
    exit(1);
}

$database = rawurldecode(ltrim((string) ($parts['path'] ?? ''), '/'));
$mapping = [
    'bakery_app_menuitemvariant' => 'product_variants',
    'bakery_app_menuitemimage' => 'product_images',
    'bakery_app_menuitem' => 'products',
    'bakery_app_contactmessage' => 'contact_messages',
    'bakery_app_bespokeorder' => 'bespoke_orders',
    'bakery_app_heroslide' => 'hero_slides',
    'bakery_app_herosettings' => 'hero_settings',
    'bakery_app_orderitem' => 'order_items',
    'bakery_app_order' => 'orders',
    'bakery_app_review' => 'reviews',
];

if ($scheme === 'mysql') {
    $mysqli = new mysqli(
        (string) ($parts['host'] ?? '127.0.0.1'),
        rawurldecode((string) ($parts['user'] ?? '')),
        rawurldecode((string) ($parts['pass'] ?? '')),
        $database,
        (int) ($parts['port'] ?? 3306)
    );
    $mysqli->set_charset('utf8mb4');
    $exists = static function (string $table) use ($mysqli): bool {
        $statement = $mysqli->prepare(
            'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?'
        );
        $statement->bind_param('s', $table);
        $statement->execute();
        return (int) $statement->get_result()->fetch_row()[0] > 0;
    };
    $rename = static function (string $old, string $new) use ($mysqli): void {
        $mysqli->query("RENAME TABLE `{$old}` TO `{$new}`");
    };
} else {
    if (!extension_loaded('pdo_pgsql')) {
        fwrite(STDERR, "The pdo_pgsql PHP extension is required for PostgreSQL databases.\n");
        exit(1);
    }
    $host = (string) ($parts['host'] ?? '127.0.0.1');
    $port = (int) ($parts['port'] ?? 5432);
    $dsn = "pgsql:host={$host};port={$port};dbname=" . rawurlencode($database);
    try {
        $pdo = new PDO($dsn, rawurldecode((string) ($parts['user'] ?? '')), rawurldecode((string) ($parts['pass'] ?? '')), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } catch (PDOException $exception) {
        fwrite(STDERR, "Could not connect to PostgreSQL: {$exception->getMessage()}\n");
        exit(1);
    }
    $exists = static function (string $table) use ($pdo): bool {
        $statement = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = :table'
        );
        $statement->execute(['table' => $table]);
        return (int) $statement->fetchColumn() > 0;
    };
    $rename = static function (string $old, string $new) use ($pdo): void {
        $pdo->exec('ALTER TABLE "' . $old . '" RENAME TO "' . $new . '"');
    };
}

echo "Database: {$database}\n";
foreach ($mapping as $old => $new) {
    $oldExists = $exists($old);
    $newExists = $exists($new);
    if (!$oldExists && !$newExists) {
        echo "SKIP  {$old} (not found)\n";
        continue;
    }
    if (!$oldExists && $newExists) {
        echo "OK    {$new} (already renamed)\n";
        continue;
    }
    if ($newExists) {
        fwrite(STDERR, "STOP  both {$old} and {$new} exist; resolve this manually.\n");
        exit(1);
    }
    $rename($old, $new);
    echo "RENAMED {$old} -> {$new}\n";
}

echo "Table rename complete. Run this command again after changing server/.env for the next database.\n";
