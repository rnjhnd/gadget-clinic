<?php
// includes/twig.php
require_once __DIR__ . '/config.php'; // Ensure autoloader and session are loaded

$loader = new \Twig\Loader\FilesystemLoader(dirname(__DIR__) . '/templates');
$isProduction = ($_ENV['APP_ENV'] ?? 'local') !== 'local';
$twig = new \Twig\Environment($loader, [
    // Cache compiled templates in production while auto-reloading when source files update.
    'cache' => $isProduction ? dirname(__DIR__) . '/cache/twig' : false,
    'debug' => !$isProduction,
    'auto_reload' => true,
]);

// Add global variables that all templates might need
$twig->addGlobal('session', $_SESSION);
$twig->addGlobal('csrf_token', $_SESSION['csrf_token'] ?? '');
