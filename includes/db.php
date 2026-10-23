<?php
// db.php - Database connection settings
require_once dirname(__DIR__) . '/vendor/autoload.php';

// Only load dotenv if not already initialized by config.php
if (empty($_ENV['DB_HOST']) && class_exists('Dotenv\Dotenv')) {
    $dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__));
    $dotenv->safeLoad();
}

$host = $_ENV['DB_HOST'] ?? 'localhost';
$dbname = $_ENV['DB_NAME'] ?? 'appointment_system';
$username = $_ENV['DB_USER'] ?? 'root';
$password = $_ENV['DB_PASS'] ?? '';

try {
    // Create PDO instance with strict security options
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false
    ]);

    // Align MySQL session timezone with PHP's configured application timezone
    $pdo->exec("SET time_zone = '" . date('P') . "'");
} catch (PDOException $e) {
    // Log the real error server-side; never expose DB internals to the browser.
    error_log('[Gadget Clinic] DB connection failed: ' . $e->getMessage());
    http_response_code(500);
    $base_url = $_ENV['APP_URL'] ?? '';
    require_once __DIR__ . '/errors/500.php';
    exit();
}
?>