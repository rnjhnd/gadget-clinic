<?php
namespace App\Controllers;

use App\Models\User;

class BaseController {
    protected $db;
    protected $twig;
    protected $client;

    public function __construct() {
        global $pdo, $twig, $client;
        $this->db = $pdo;
        $this->twig = $twig;
        $this->client = $client;
    }

    protected function render($view, $data = []) {
        echo $this->twig->render($view, $data);
    }

    protected function redirect($url) {
        header('Location: ' . $_ENV['APP_URL'] . $url);
        exit();
    }

    /**
     * Enforce an active user session; redirects to login if unauthenticated.
     * Returns the authenticated user's ID.
     */
    protected function requireAuth(): int {
        if (!isset($_SESSION['user_id'])) {
            if (isset($_SERVER['HTTP_ACCEPT']) && str_contains($_SERVER['HTTP_ACCEPT'], 'application/json')) {
                http_response_code(401);
                header('Content-Type: application/json');
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                exit();
            }
            $this->redirect('/');
        }
        return (int) $_SESSION['user_id'];
    }

    /**
     * Enforce admin role for the current session.
     * Returns the admin User record if permitted, exits with 403 otherwise.
     */
    protected function requireAdmin(?int $user_id = null): array {
        $uid = $user_id ?? $this->requireAuth();
        $userModel = new User();
        $user = $userModel->findById($uid);

        if (!$user || $user['role'] !== 'admin') {
            http_response_code(403);
            if (isset($_SERVER['HTTP_ACCEPT']) && str_contains($_SERVER['HTTP_ACCEPT'], 'application/json')) {
                header('Content-Type: application/json');
                echo json_encode(['success' => false, 'message' => 'Forbidden']);
                exit();
            }
            require_once dirname(__DIR__, 2) . '/includes/errors/403.php';
            exit();
        }

        return $user;
    }

    /**
     * Timing-safe CSRF validation.
     */
    protected function validateCsrfToken(?string $token = null): bool {
        $token = $token ?? $_POST['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        return !empty($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
    }

    /**
     * Rotates the session CSRF token to prevent token fixation.
     */
    protected function rotateCsrfToken(): string {
        $newToken = bin2hex(random_bytes(32));
        $_SESSION['csrf_token'] = $newToken;
        if ($this->twig) {
            $this->twig->addGlobal('csrf_token', $newToken);
        }
        return $newToken;
    }

    /**
     * Simple sliding-window rate limiter per session.
     * Returns true if allowed, false if limit exceeded.
     */
    protected function checkRateLimit(string $action, int $maxAttempts = 5, int $windowSeconds = 300): bool {
        $now = time();
        $key = 'rate_limit_' . $action;

        if (!isset($_SESSION[$key]) || !is_array($_SESSION[$key])) {
            $_SESSION[$key] = [];
        }

        // Evict expired timestamps
        $_SESSION[$key] = array_filter($_SESSION[$key], function($timestamp) use ($now, $windowSeconds) {
            return ($now - $timestamp) < $windowSeconds;
        });

        if (count($_SESSION[$key]) >= $maxAttempts) {
            return false;
        }

        $_SESSION[$key][] = $now;
        return true;
    }
}

