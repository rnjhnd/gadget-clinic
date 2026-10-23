<?php
// auto_cancel_noshows.php
// This script is intended to run as a scheduled task (cron job).
// It automatically cancels "Pending" or "Confirmed" appointments 
// that have passed their drop-off time by more than 12 hours.

require_once dirname(__DIR__) . '/vendor/autoload.php';

// Initialize Environment Variables
if (class_exists('Dotenv\Dotenv')) {
    $dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__));
    $dotenv->safeLoad();
}

date_default_timezone_set($_ENV['APP_TIMEZONE'] ?? 'Asia/Manila');

require_once dirname(__DIR__) . '/includes/db.php';
require_once dirname(__DIR__) . '/includes/email_helper.php';

echo "Running Auto-Cancel No-Shows Job...\n";

// Find pending or confirmed requests where the appointment time was more than 12 hours ago
$stmt = $pdo->query("
    SELECT a.id, a.request_datetime, a.service_type, u.name, u.email 
    FROM service_requests a 
    JOIN users u ON a.user_id = u.id 
    WHERE a.status IN ('pending', 'confirmed') 
    AND a.request_datetime < DATE_SUB(NOW(), INTERVAL 12 HOUR)
");

$expired_requests = $stmt->fetchAll();
$count = 0;

if (empty($expired_requests)) {
    echo "No expired appointments found.\n";
    exit(0);
}

foreach ($expired_requests as $req) {
    try {
        // 1. Mark as cancelled in database
        $updateStmt = $pdo->prepare("UPDATE service_requests SET status = 'cancelled' WHERE id = ?");
        $updateStmt->execute([$req['id']]);

        // 2. Prepare and send No-Show Email
        $email = $req['email'];
        $formatted_date = date('F j, Y \a\t g:i A', strtotime($req['request_datetime']));
        
        $email_title = "Appointment Voided (No-Show)";
        $email_body = "Hi {$req['name']},<br><br>We missed you! Since you did not arrive for your scheduled drop-off for <strong>{$req['service_type']}</strong> on <strong>{$formatted_date}</strong>, the system has automatically released your slot.<br><br>If you still need repair services, please feel free to book a new appointment through your dashboard.";
        
        // Use the get_branded_email_html from email_helper.php
        $app_url = $_ENV['APP_URL'] ?? 'http://localhost/gadget_clinic/public';
        $htmlContent = get_branded_email_html($email_title, $email_body, 'Book New Appointment', $app_url . '/dashboard');
        
        // Dispatch Email
        $result = send_app_email($email, $email_title . ' - Gadget Clinic', $htmlContent);
        
        if ($result['success']) {
            echo "Cancelled Request ID #{$req['id']} and emailed {$email}.\n";
        } else {
            echo "Cancelled Request ID #{$req['id']} but failed to email {$email}. Error: {$result['error']}\n";
        }
        
        $count++;
    } catch (\Throwable $e) {
        error_log("Failed to auto-cancel Request ID #{$req['id']}: " . $e->getMessage());
        echo "Error processing Request ID #{$req['id']}: {$e->getMessage()}\n";
    }
}

echo "Job complete! Successfully auto-cancelled {$count} no-show appointments.\n";
