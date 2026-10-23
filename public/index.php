<?php
require_once dirname(__DIR__) . '/includes/config.php';
require_once dirname(__DIR__) . '/includes/db.php';
require_once dirname(__DIR__) . '/includes/email_helper.php';
require_once dirname(__DIR__) . '/includes/twig.php';

$router = new \Bramus\Router\Router();

// Views
$router->get('/', 'App\Controllers\HomeController@index');
$router->get('/dashboard', 'App\Controllers\DashboardController@index');
$router->get('/admin', 'App\Controllers\AdminController@index');

// Actions and APIs
$router->post('/actions/book', 'App\Controllers\ServiceRequestController@book');
$router->post('/actions/cancel', 'App\Controllers\ServiceRequestController@cancel');
$router->get('/actions/download_ticket', 'App\Controllers\ServiceRequestController@downloadTicket');
$router->get('/actions/view_document', 'App\Controllers\ServiceRequestController@viewDocument');
$router->post('/actions/quote/respond', 'App\Controllers\ServiceRequestController@respondToQuote');
$router->get('/actions/download_invoice', 'App\Controllers\ServiceRequestController@downloadInvoice');
$router->get('/auth/google/callback', 'App\Controllers\AuthController@googleCallback');
$router->get('/logout', function() {
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    session_destroy();
    header("Location: " . ($_ENV['APP_URL'] ?? '') . "/");
    exit();
});

// API Endpoints
$router->get('/api/slots', 'App\Controllers\ApiController@getSlots');
$router->post('/api/status', 'App\Controllers\ApiController@updateStatus');
$router->post('/api/quote/issue', 'App\Controllers\ApiController@issueQuote');
$router->post('/api/requests/reschedule', 'App\Controllers\ApiController@rescheduleRequest');
$router->get('/api/check-new', 'App\Controllers\ApiController@checkNewRequests');
$router->get('/api/blackout-dates', 'App\Controllers\ApiController@getBlackoutDates');
$router->post('/api/blackout-dates/add', 'App\Controllers\ApiController@addBlackoutDate');
$router->post('/api/blackout-dates/delete', 'App\Controllers\ApiController@deleteBlackoutDate');

$router->set404(function() {
    http_response_code(404);
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    if (str_contains($uri, '/api/') || (isset($_SERVER['HTTP_ACCEPT']) && str_contains($_SERVER['HTTP_ACCEPT'], 'application/json'))) {
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Endpoint or resource not found.']);
        exit();
    }
    require_once dirname(__DIR__) . '/includes/errors/404.php';
});

$router->run();
