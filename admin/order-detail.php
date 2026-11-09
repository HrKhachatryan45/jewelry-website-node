<?php
declare(strict_types=1);

$_GET['view'] = 'orders';
if (isset($_GET['id'])) {
    $_GET['order'] = $_GET['id'];
}
require __DIR__ . '/content.php';
