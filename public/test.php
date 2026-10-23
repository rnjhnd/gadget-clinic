<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

echo "<h2>PHP is working!</h2>";
echo "<p>PHP Version: " . phpversion() . "</p>";

try {
    require_once dirname(__DIR__) . '/includes/config.php';
    echo "<p>✓ config.php loaded successfully</p>";
} catch (Throwable $e) {
    echo "<p>✗ config.php failed: " . htmlspecialchars($e->getMessage()) . "</p>";
}

try {
    require_once dirname(__DIR__) . '/includes/db.php';
    echo "<p>✓ db.php loaded and database connected successfully!</p>";
} catch (Throwable $e) {
    echo "<p>✗ db.php failed: " . htmlspecialchars($e->getMessage()) . "</p>";
}

try {
    require_once dirname(__DIR__) . '/includes/twig.php';
    echo "<p>✓ twig.php loaded successfully</p>";
} catch (Throwable $e) {
    echo "<p>✗ twig.php failed: " . htmlspecialchars($e->getMessage()) . "</p>";
}
