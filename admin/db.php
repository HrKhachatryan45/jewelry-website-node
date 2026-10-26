<?php
declare(strict_types=1);

function loadEnvironmentFile(string $path): void
{
    if (!is_file($path) || !is_readable($path)) {
        return;
    }

    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        if (str_starts_with($line, 'export ')) {
            $line = substr($line, 7);
        }

        $separator = strpos($line, '=');
        if ($separator === false) {
            continue;
        }

        $key = trim(substr($line, 0, $separator));
        $value = trim(substr($line, $separator + 1));
        if ($key === '' || getenv($key) !== false) {
            continue;
        }

        if (strlen($value) >= 2 && (
            ($value[0] === '"' && $value[strlen($value) - 1] === '"')
            || ($value[0] === "'" && $value[strlen($value) - 1] === "'")
        )) {
            $value = substr($value, 1, -1);
        } else {
            $value = trim(preg_replace('/\s+#.*$/', '', $value) ?? $value);
        }

        putenv($key . '=' . $value);
        $_ENV[$key] = $value;
    }
}

loadEnvironmentFile(__DIR__ . '/.env');

function databaseSettings(): array
{
    $url = getenv('DATABASE_URL') ?: '';
    if ($url !== '') {
        $parts = parse_url($url);
        if (!is_array($parts) || ($parts['scheme'] ?? '') !== 'mysql') {
            throw new RuntimeException('The jewelry website DATABASE_URL must use the mysql:// scheme.');
        }

        $database = rawurldecode(ltrim((string) ($parts['path'] ?? ''), '/'));
        if ($database === '') {
            throw new RuntimeException('The jewelry website DATABASE_URL is missing its database name.');
        }

        return [
            'host' => (string) ($parts['host'] ?? '127.0.0.1'),
            'port' => (int) ($parts['port'] ?? 3306),
            'username' => rawurldecode((string) ($parts['user'] ?? '')),
            'password' => rawurldecode((string) ($parts['pass'] ?? '')),
            'database' => $database,
        ];
    }

    $database = getenv('DB_NAME') ?: '';
    $username = getenv('DB_USER') ?: '';
    if ($database === '' || $username === '') {
        throw new RuntimeException('Set DATABASE_URL or DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD in this project’s .env file.');
    }

    return [
        'host' => getenv('DB_HOST') ?: '127.0.0.1',
        'port' => (int) (getenv('DB_PORT') ?: 3306),
        'username' => $username,
        'password' => getenv('DB_PASSWORD') ?: '',
        'database' => $database,
    ];
}

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

try {
    $settings = databaseSettings();
    $mysqli = new mysqli(
        $settings['host'],
        $settings['username'],
        $settings['password'],
        $settings['database'],
        $settings['port']
    );
    $mysqli->set_charset('utf8mb4');
} catch (mysqli_sql_exception $exception) {
    error_log('Jewelry admin MySQL connection failed: ' . $exception->getMessage());
    http_response_code(503);
    exit('Could not connect to the jewelry website MySQL database. Check its server/.env settings and MySQL status.');
} catch (RuntimeException $exception) {
    error_log('Jewelry admin database configuration failed: ' . $exception->getMessage());
    http_response_code(503);
    exit('Could not read the jewelry website MySQL settings. Check its server/.env configuration.');
}

const MENU_UPLOAD_DIR =  '../server/uploads/menu';
const MENU_UPLOAD_PATH = 'menu';
