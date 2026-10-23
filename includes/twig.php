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

// Automated cache-busting helper: appends file modification timestamp so browsers
// fetch fresh assets instantly without requiring a manual hard refresh.
$twig->addFunction(new \Twig\TwigFunction('asset', function ($path) {
    $clean_path = strtok($path, '?');
    $file_path = dirname(__DIR__) . '/public/' . ltrim($clean_path, '/');
    $version = file_exists($file_path) ? filemtime($file_path) : time();
    return $clean_path . '?v=' . $version;
}));
