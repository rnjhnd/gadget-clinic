<?php
// config.php
require_once dirname(__DIR__) . '/vendor/autoload.php';

// 1. Load environment variables securely
if (class_exists('Dotenv\Dotenv')) {
    $dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__));
    $dotenv->safeLoad();
}

// Set timezone from environment variable (default to UTC)
date_default_timezone_set($_ENV['APP_TIMEZONE'] ?? 'UTC');

// 2. Environment-based error reporting
// APP_DEBUG=true enables full error output. Defaults to true only when APP_ENV=local.
// Explicit APP_DEBUG in .env always takes precedence over the APP_ENV inference.
$app_is_debug = filter_var(
    $_ENV['APP_DEBUG'] ?? (($_ENV['APP_ENV'] ?? 'local') === 'local' ? 'true' : 'false'),
    FILTER_VALIDATE_BOOLEAN
);
if ($app_is_debug) {
    ini_set('display_errors', 1);
    ini_set('display_startup_errors', 1);
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', 0);
    ini_set('display_startup_errors', 0);
    error_reporting(0);
}

// 3. Hardened session configuration (Mitigates XSS cookie theft and CSRF)
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', 1);
    ini_set('session.use_only_cookies', 1);
    ini_set('session.cookie_samesite', 'Lax');
    ini_set('session.gc_maxlifetime', 7200); // 2 hours idle timeout
    ini_set('session.cookie_lifetime', 0); // Expire on browser close
    // Restrict cookie to HTTPS only in production; prevents MITM interception.
    if (($_ENV['APP_ENV'] ?? 'local') !== 'local') {
        ini_set('session.cookie_secure', 1);
    }
    session_start();
}

// 4. CSRF Token Generation
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

$clientID = $_ENV['GOOGLE_CLIENT_ID'] ?? '';
$clientSecret = $_ENV['GOOGLE_CLIENT_SECRET'] ?? '';
$redirectUri = $_ENV['GOOGLE_REDIRECT_URI'] ?? '';

// 4. Initialize Google OAuth Client
$client = new Google_Client();
$client->setClientId($clientID);
$client->setClientSecret($clientSecret);
$client->setRedirectUri($redirectUri);
$client->addScope("email");
$client->addScope("profile");
?>