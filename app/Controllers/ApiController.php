<?php
namespace App\Controllers;

use App\Models\User;
use App\Models\ServiceRequest;

class ApiController extends BaseController {



    public function getSlots() {
        $user_id = $this->requireAuth();

        header('Content-Type: application/json');
        $check_date = trim($_GET['date'] ?? '');
        $check_service = trim($_GET['service'] ?? '');

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $check_date)) {
            echo json_encode(['success' => false, 'message' => 'Invalid date format.']);
            exit();
        }

        $blackoutModel = new \App\Models\BlackoutDate();
        if ($blackoutModel->isBlackout($check_date)) {
            // Return all slots as booked to block the entire day
            echo json_encode([
                'success' => true,
                'is_blackout' => true,
                'message' => 'This date is unavailable due to shop closure or holiday.',
                'booked_service_slots' => ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'],
                'user_conflict_slots' => []
            ]);
            exit();
        }

        $requestModel = new ServiceRequest();
        $records = $requestModel->getSlotsByDate($check_date);

        $exclude_id = (int) ($_GET['exclude_id'] ?? 0);
        $booked_slots = [];
        $user_slots = [];

        foreach ($records as $r) {
            if ($exclude_id > 0 && (int)$r['id'] === $exclude_id) {
                continue;
            }
            $t = date('H:i', strtotime($r['request_datetime']));
            if ($r['user_id'] == $user_id) {
                $user_slots[] = $t;
            }
            // If service is specified, filter by it; if empty (admin reschedule check), mark all booked
            if (empty($check_service) || $r['service_type'] === $check_service) {
                $booked_slots[] = $t;
            }
        }

        echo json_encode([
            'success' => true,
            'date' => $check_date,
            'booked_service_slots' => array_values(array_unique($booked_slots)),
            'user_conflict_slots' => array_values(array_unique($user_slots))
        ]);
        exit();
    }

    public function updateStatus() {
        $user_id = $this->requireAuth();
        $this->requireAdmin($user_id);

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (!$this->validateCsrfToken()) {
                header('Content-Type: application/json');
                echo json_encode(['success' => false, 'message' => 'CSRF token validation failed.']);
                exit();
            }

            header('Content-Type: application/json');
            $request_id = (int) ($_POST['request_id'] ?? 0);
            $new_status = trim($_POST['status'] ?? '');

            if (!in_array($new_status, ['pending', 'confirmed', 'in_progress', 'for_pickup', 'completed', 'cancelled'])) {
                echo json_encode(['success' => false, 'message' => 'Invalid status option.']);
                exit();
            }

            $requestModel = new ServiceRequest();
            $req_data = $requestModel->findWithUser($request_id);

            if (!$req_data) {
                echo json_encode(['success' => false, 'message' => 'Service request not found.']);
                exit();
            }

            $old_status = $req_data['status'];
            $requestModel->updateStatus($request_id, $new_status);

            // Auto-approve pending quote if moving to active repair status
            if (in_array($new_status, ['in_progress', 'for_pickup', 'completed']) && $req_data['quote_status'] === 'pending') {
                $requestModel->updateQuoteStatus($request_id, $req_data['user_id'], 'approved');
            }

            $email_sent = false;
            if ($old_status !== $new_status && in_array($new_status, ['confirmed', 'in_progress', 'for_pickup', 'completed', 'cancelled'])) {
                $email = $req_data['email'] ?? '';
                $formatted_date = date('F j, Y \a\t g:i A', strtotime($req_data['request_datetime']));
                $service = $req_data['service_type'];
                $name = $req_data['name'];

                $email_title = "";
                $email_body = "";
                
                switch ($new_status) {
                    case 'confirmed':
                        $email_title = "Appointment Confirmed";
                        $email_body = "Hi {$name},<br><br>Your drop-off slot for <strong>{$service}</strong> on <strong>{$formatted_date}</strong> is confirmed. Please arrive on time.";
                        break;
                    case 'in_progress':
                        $email_title = "Repair In Progress";
                        $email_body = "Hi {$name},<br><br>Great news! Our technicians have begun working on your <strong>{$service}</strong> repair.";
                        break;
                    case 'for_pickup':
                        $email_title = "Ready for Pickup";
                        $email_body = "Hi {$name},<br><br>Your <strong>{$service}</strong> is fixed and ready for pickup at our clinic!";
                        break;
                    case 'completed':
                        $email_title = "Transaction Complete";
                        $email_body = "Hi {$name},<br><br>Thank you for trusting Gadget Clinic! Your <strong>{$service}</strong> transaction is now complete. We hope to see you again.";
                        break;
                    case 'cancelled':
                        $email_title = "Appointment Cancelled";
                        $email_body = "Hi {$name},<br><br>Your drop-off slot for <strong>{$service}</strong> on <strong>{$formatted_date}</strong> has been cancelled by the technician desk.";
                        break;
                }

                if (!empty($email_body) && !empty($email)) {
                    $htmlContent = get_branded_email_html($email_title, $email_body, 'View Dashboard', $_ENV['APP_URL'] . '/dashboard');
                    $email_result = send_app_email($email, $email_title . ' - Gadget Clinic', $htmlContent);
                    if ($email_result['success']) {
                        $email_sent = true;
                    }
                }
            }

            $stats = $requestModel->getSummaryStats();

            echo json_encode([
                'success' => true,
                'message' => "Request status updated to " . ucwords(str_replace('_', ' ', $new_status)),
                'email_sent' => $email_sent,
                'old_status' => $old_status,
                'new_status' => $new_status,
                'counters' => [
                    'total' => (int) $stats['total'],
                    'pending' => (int) $stats['pending'],
                    'confirmed' => (int) $stats['confirmed'],
                    'in_progress' => (int) $stats['in_progress'],
                    'for_pickup' => (int) $stats['for_pickup'],
                    'completed' => (int) $stats['completed'],
                    'cancelled' => (int) $stats['cancelled']
                ]
            ]);
            exit();
        }
    }

    public function checkNewRequests() {
        $user_id = $this->requireAuth();
        $this->requireAdmin($user_id);
        
        $client_max_id = (int) ($_GET['last_id'] ?? 0);
        $requestModel = new ServiceRequest();
        $server_max_id = $requestModel->getMaxId();
        
        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'has_new' => $server_max_id > $client_max_id,
            'max_id' => $server_max_id
        ]);
        exit();
    }

    public function issueQuote() {
        $user_id = $this->requireAuth();
        $this->requireAdmin($user_id);

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (!$this->validateCsrfToken()) {
                header('Content-Type: application/json');
                echo json_encode(['success' => false, 'message' => 'CSRF token validation failed.']);
                exit();
            }

            header('Content-Type: application/json');
            $request_id = (int) ($_POST['request_id'] ?? 0);
            $amount = floatval($_POST['amount'] ?? 0);
            $description = trim($_POST['description'] ?? '');

            if ($amount <= 0 || empty($description)) {
                echo json_encode(['success' => false, 'message' => 'Amount and description are required.']);
                exit();
            }

            $requestModel = new ServiceRequest();
            $req_data = $requestModel->findWithUser($request_id);

            if (!$req_data) {
                echo json_encode(['success' => false, 'message' => 'Service request not found.']);
                exit();
            }

            // If already in progress, auto-approve the quote
            $initial_quote_status = in_array($req_data['status'], ['in_progress', 'for_pickup', 'completed']) ? 'approved' : 'pending';
            
            $requestModel->updateQuote($request_id, $amount, $description, $initial_quote_status);

            $email = $req_data['email'] ?? '';
            $email_sent = false;
            
            if (!empty($email)) {
                $email_title = "Quotation Issued";
                $email_body = "Hi {$req_data['name']},<br><br>A quotation of <strong>PHP " . number_format($amount, 2) . "</strong> has been issued for your repair.<br><br>Please review and respond to the quote in the Repair Portal.";
                $htmlContent = get_branded_email_html($email_title, $email_body, 'View Quote', $_ENV['APP_URL'] . '/dashboard');
                
                $email_result = send_app_email($email, $email_title . ' - Gadget Clinic', $htmlContent);
                $email_sent = $email_result['success'] ?? false;
            }

            echo json_encode([
                'success' => true,
                'message' => "Quotation issued successfully.",
                'email_sent' => $email_sent
            ]);
            exit();
        }
    }

    public function rescheduleRequest() {
        $user_id = $this->requireAuth();
        $this->requireAdmin($user_id);

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (!$this->validateCsrfToken()) {
                header('Content-Type: application/json');
                echo json_encode(['success' => false, 'message' => 'CSRF token validation failed.']);
                exit();
            }

            header('Content-Type: application/json');
            $request_id = (int) ($_POST['request_id'] ?? 0);
            $date = trim($_POST['date'] ?? '');
            $time = trim($_POST['time'] ?? '');
            $reason = trim($_POST['reason'] ?? '');
            $new_datetime = $date . ' ' . $time . ':00';

            if (empty($date) || empty($time) || empty($reason)) {
                echo json_encode(['success' => false, 'message' => 'All fields are required.']);
                exit();
            }

            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !preg_match('/^\d{2}:\d{2}$/', $time)) {
                echo json_encode(['success' => false, 'message' => 'Invalid appointment date or time format.']);
                exit();
            }

            if (strtotime($new_datetime) <= time()) {
                echo json_encode(['success' => false, 'message' => 'Selected schedule is in the past.']);
                exit();
            }

            $day_of_week = (int) date('w', strtotime($date));
            if ($day_of_week === 0 || $day_of_week === 6) {
                echo json_encode(['success' => false, 'message' => 'Appointments are strictly available Monday through Friday.']);
                exit();
            }

            $hour = (int) date('H', strtotime($time));
            $minute = (int) date('i', strtotime($time));
            $time_minutes = $hour * 60 + $minute;
            if ($time_minutes < (9 * 60) || $time_minutes > (17 * 60)) {
                echo json_encode(['success' => false, 'message' => 'Appointments must fall within operating hours (9:00 AM - 5:00 PM).']);
                exit();
            }

            $blackoutModel = new \App\Models\BlackoutDate();
            if ($blackoutModel->isBlackout($date)) {
                echo json_encode(['success' => false, 'message' => 'Cannot reschedule to a designated blackout date or holiday.']);
                exit();
            }

            $requestModel = new ServiceRequest();
            $req_data = $requestModel->findWithUser($request_id);

            if (!$req_data) {
                echo json_encode(['success' => false, 'message' => 'Service request not found.']);
                exit();
            }

            if (in_array($req_data['status'], ['completed', 'cancelled'])) {
                echo json_encode(['success' => false, 'message' => 'Cannot reschedule a completed or cancelled request.']);
                exit();
            }

            if ($requestModel->isSlotBooked($new_datetime, $req_data['service_type'], $request_id)) {
                echo json_encode(['success' => false, 'message' => 'This slot is already booked for another appointment.']);
                exit();
            }

            $requestModel->reschedule($request_id, $new_datetime);

            $email = $req_data['email'] ?? '';
            $email_sent = false;
            
            if (!empty($email)) {
                $formatted_new_date = date('F j, Y \a\t g:i A', strtotime($new_datetime));
                $safe_name = htmlspecialchars($req_data['name'], ENT_QUOTES, 'UTF-8');
                $safe_service = htmlspecialchars($req_data['service_type'], ENT_QUOTES, 'UTF-8');
                $safe_reason = htmlspecialchars($reason, ENT_QUOTES, 'UTF-8');

                $email_title = "Appointment Rescheduled";
                $email_body = "Hi {$safe_name},<br><br>We had to update the schedule for your <strong>{$safe_service}</strong> drop-off.<br><br><strong>New Schedule:</strong> {$formatted_new_date}<br><br><strong>Reason from Technician:</strong><br><em>{$safe_reason}</em><br><br>If this new time doesn't work for you, please log into your dashboard to cancel or contact us.";
                $htmlContent = get_branded_email_html($email_title, $email_body, 'View Dashboard', $_ENV['APP_URL'] . '/dashboard');
                
                $email_result = send_app_email($email, $email_title . ' - Gadget Clinic', $htmlContent);
                $email_sent = $email_result['success'] ?? false;
            }

            echo json_encode([
                'success' => true,
                'message' => "Appointment rescheduled successfully.",
                'email_sent' => $email_sent
            ]);
            exit();
        }
    }

    public function getBlackoutDates() {
        $this->requireAdmin();

        header('Content-Type: application/json');
        $model = new \App\Models\BlackoutDate();
        echo json_encode(['success' => true, 'data' => $model->getUpcoming()]);
        exit();
    }

    public function addBlackoutDate() {
        $user_id = $this->requireAuth();
        $this->requireAdmin($user_id);

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (!$this->validateCsrfToken()) {
                header('Content-Type: application/json');
                echo json_encode(['success' => false, 'message' => 'CSRF token validation failed.']);
                exit();
            }

            header('Content-Type: application/json');
            $date = trim($_POST['date'] ?? '');
            $reason = trim($_POST['reason'] ?? '');

            if (empty($date) || empty($reason)) {
                echo json_encode(['success' => false, 'message' => 'Date and reason are required.']);
                exit();
            }

            $model = new \App\Models\BlackoutDate();
            if ($model->isBlackout($date)) {
                echo json_encode(['success' => false, 'message' => 'This date is already a blackout date.']);
                exit();
            }

            try {
                $model->add($date, $reason);
                echo json_encode(['success' => true, 'message' => 'Blackout date added successfully.']);
            } catch (\Exception $e) {
                echo json_encode(['success' => false, 'message' => 'Failed to add blackout date.']);
            }
            exit();
        }
    }

    public function deleteBlackoutDate() {
        $user_id = $this->requireAuth();
        $this->requireAdmin($user_id);

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (!$this->validateCsrfToken()) {
                header('Content-Type: application/json');
                echo json_encode(['success' => false, 'message' => 'CSRF token validation failed.']);
                exit();
            }

            header('Content-Type: application/json');
            $id = (int) ($_POST['id'] ?? 0);

            if ($id <= 0) {
                echo json_encode(['success' => false, 'message' => 'Invalid ID.']);
                exit();
            }

            $model = new \App\Models\BlackoutDate();
            $model->delete($id);
            echo json_encode(['success' => true, 'message' => 'Blackout date removed.']);
            exit();
        }
    }
}
