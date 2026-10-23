<?php
namespace App\Controllers;

use App\Models\User;
use App\Models\ServiceRequest;
use Dompdf\Dompdf;
use Dompdf\Options;

class ServiceRequestController extends BaseController {

    public function book() {
        $user_id = $this->requireAuth();

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (!$this->validateCsrfToken()) {
                $_SESSION['error_message'] = "Invalid security token. Please try again.";
                $this->redirect('/dashboard');
            }

            // Rate limiting: allow at most 5 booking attempts per 5-minute sliding window
            if (!$this->checkRateLimit('booking', 5, 300)) {
                $_SESSION['error_message'] = "Too many booking attempts. Please wait a few minutes before trying again.";
                $this->redirect('/dashboard');
            }

            $date = trim($_POST['date'] ?? '');
            $time = trim($_POST['time'] ?? '');
            $datetime = $date . ' ' . $time . ':00';
            $service = trim($_POST['service'] ?? '');
            $phone = preg_replace('/\D/', '', trim($_POST['phone'] ?? ''));

            $allowed_services = [
                'Screen & LCD Repair',
                'Battery Replacement',
                'Water Damage Recovery',
                'Data Recovery & Backup',
                'Hardware Diagnostics'
            ];
            if (!in_array($service, $allowed_services, true)) {
                $_SESSION['error_message'] = "Invalid service selection. Please choose a recognized service tier.";
                $this->redirect('/dashboard');
            }

            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !preg_match('/^\d{2}:\d{2}$/', $time)) {
                $_SESSION['error_message'] = "Invalid appointment date or time format.";
                $this->redirect('/dashboard');
            }

            if (strtotime($datetime) <= time()) {
                $_SESSION['error_message'] = "Selected schedule is in the past. Please choose a future date and time.";
                $this->redirect('/dashboard');
            }

            $day_of_week = (int) date('w', strtotime($date));
            if ($day_of_week === 0 || $day_of_week === 6) {
                $_SESSION['error_message'] = "Bookings are strictly available Monday through Friday.";
                $this->redirect('/dashboard');
            }

            $hour = (int) date('H', strtotime($time));
            $minute = (int) date('i', strtotime($time));
            $time_minutes = $hour * 60 + $minute;
            if ($time_minutes < (9 * 60) || $time_minutes > (17 * 60)) {
                $_SESSION['error_message'] = "Appointments must fall within operating hours (9:00 AM - 5:00 PM).";
                $this->redirect('/dashboard');
            }

            if (!preg_match('/^09[0-9]{9}$/', $phone)) {
                $_SESSION['error_message'] = "Please provide a valid 11-digit mobile number starting with 09.";
                $this->redirect('/dashboard');
            }

            $blackoutModel = new \App\Models\BlackoutDate();
            if ($blackoutModel->isBlackout($date)) {
                $_SESSION['error_message'] = "The selected date is unavailable due to a shop closure or holiday.";
                $this->redirect('/dashboard');
            }

            $document_path = NULL;
            $upload_dir = dirname(__DIR__, 2) . '/storage/uploads/';

            if (isset($_FILES['document']) && $_FILES['document']['error'] === UPLOAD_ERR_OK) {
                // Store uploads OUTSIDE public/ so they are never directly URL-accessible.
                // All access goes through viewDocument() which enforces ownership checks.
                if (!is_dir($upload_dir)) {
                    mkdir($upload_dir, 0755, true);
                }

                $max_file_size = 5 * 1024 * 1024;
                if ($_FILES['document']['size'] > $max_file_size) {
                    $_SESSION['error_message'] = "File size exceeds the 5MB limit.";
                    $this->redirect('/dashboard');
                }

                $file_name = $_FILES['document']['name'];
                $file_tmp = $_FILES['document']['tmp_name'];
                $file_ext = strtolower(pathinfo($file_name, PATHINFO_EXTENSION));

                $finfo = finfo_open(FILEINFO_MIME_TYPE);
                $detected_mime = finfo_file($finfo, $file_tmp);
                finfo_close($finfo);

                $allowed_mimes = [
                    'jpg'  => 'image/jpeg',
                    'jpeg' => 'image/jpeg',
                    'png'  => 'image/png',
                    'pdf'  => 'application/pdf'
                ];

                if (array_key_exists($file_ext, $allowed_mimes) && $allowed_mimes[$file_ext] === $detected_mime) {
                    $safe_token = bin2hex(random_bytes(8));
                    $new_filename = 'doc_' . $user_id . '_' . time() . '_' . $safe_token . '.' . $file_ext;
                    $destination = $upload_dir . $new_filename;

                    if (move_uploaded_file($file_tmp, $destination)) {
                        // Optimize images (downscale & progressive JPEG) if GD extension is available
                        if ($file_ext !== 'pdf') {
                            $this->optimizeImage($destination, $detected_mime);
                        }
                        // Store only the filename, not the full absolute path, for portability.
                        $document_path = $new_filename;
                    } else {
                        $_SESSION['error_message'] = "Server could not persist the uploaded document. Please retry.";
                        $this->redirect('/dashboard');
                    }
                } else {
                    $_SESSION['error_message'] = "Unsupported file type. Permitted formats: JPG, PNG, and PDF.";
                    $this->redirect('/dashboard');
                }
            }

            $requestModel = new ServiceRequest();

            // Atomic transaction with exclusive row lock to eliminate TOCTOU double-booking race conditions
            $this->db->beginTransaction();
            try {
                if ($requestModel->hasActiveBooking($user_id, $datetime)) {
                    $this->db->rollBack();
                    if ($document_path && file_exists($upload_dir . $document_path)) {
                        unlink($upload_dir . $document_path);
                    }
                    $_SESSION['error_message'] = "You already have an active appointment scheduled for this date and time.";
                    $this->redirect('/dashboard');
                }

                if ($requestModel->isSlotBookedForUpdate($datetime, $service)) {
                    $this->db->rollBack();
                    if ($document_path && file_exists($upload_dir . $document_path)) {
                        unlink($upload_dir . $document_path);
                    }
                    $_SESSION['error_message'] = "This slot was just claimed for {$service}. Please select a different time or date.";
                    $this->redirect('/dashboard');
                }

                $requestModel->create($user_id, $datetime, $service, $phone, $document_path);

                $userModel = new User();
                $userModel->updatePhone($user_id, $phone);
                $this->db->commit();
            } catch (\Throwable $e) {
                if ($this->db->inTransaction()) {
                    $this->db->rollBack();
                }
                if ($document_path && file_exists($upload_dir . $document_path)) {
                    unlink($upload_dir . $document_path);
                }
                error_log('[Gadget Clinic] Booking error: ' . $e->getMessage());
                $_SESSION['error_message'] = "A database error occurred while creating your booking. Please try again.";
                $this->redirect('/dashboard');
            }

            $userModel = new User();
            $user = $userModel->findById($user_id);

            $formatted_date = date('F j, Y \a\t g:i A', strtotime($datetime));
            
            $email = $user['email'] ?? '';
            if (!empty($email)) {
                $safe_name = htmlspecialchars($user['name'] ?? '', ENT_QUOTES, 'UTF-8');
                $safe_service = htmlspecialchars($service, ENT_QUOTES, 'UTF-8');
                $email_title = "Service Booking Pending";
                $email_body = "Hi {$safe_name},<br><br>Your drop-off slot for <strong>{$safe_service}</strong> on <strong>{$formatted_date}</strong> has been placed successfully.<br><br><strong>Status:</strong> Pending Technician Review.";
                $htmlContent = get_branded_email_html($email_title, $email_body, 'View Dashboard', $_ENV['APP_URL'] . '/dashboard');
                send_app_email($email, $email_title . ' - Gadget Clinic', $htmlContent);
            }

            $this->rotateCsrfToken();
            $_SESSION['success_message'] = "Your drop-off slot for {$service} on {$formatted_date} has been booked!";
            $this->redirect('/dashboard');
        }
    }

    public function cancel() {
        $user_id = $this->requireAuth();

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (!$this->validateCsrfToken()) {
                $_SESSION['error_message'] = "Invalid security token. Please try again.";
                $this->redirect('/dashboard');
            }

            $cancel_id = (int) $_POST['request_id'];

            $requestModel = new ServiceRequest();
            $target_appt = $requestModel->findByIdAndUser($cancel_id, $user_id);

            if ($target_appt) {
                if ($target_appt['status'] === 'cancelled') {
                    $_SESSION['error_message'] = "This appointment is already cancelled.";
                } elseif (!in_array($target_appt['status'], ['pending', 'confirmed'])) {
                    $_SESSION['error_message'] = "Appointments currently in progress or completed cannot be cancelled online. Please contact our support team.";
                } else {
                    $requestModel->cancel($cancel_id, $user_id);
                    $this->rotateCsrfToken();
                    $_SESSION['success_message'] = "Your appointment has been cancelled successfully.";
                }
            } else {
                $_SESSION['error_message'] = "Appointment not found or unauthorized action.";
            }

            $this->redirect('/dashboard');
        }
    }

    public function downloadTicket() {
        $user_id = $this->requireAuth();
        if (!isset($_GET['id'])) {
            $this->redirect('/');
        }
        
        $appt_id = (int) $_GET['id'];

        $requestModel = new ServiceRequest();
        $appt = $requestModel->getTicketInfo($appt_id, $user_id);

        if (!$appt) {
            http_response_code(404);
            require_once dirname(__DIR__) . '/../includes/errors/404.php';
            exit();
        }

        $reference_code = "TECH-" . strtoupper(date('ymd', strtotime($appt['request_datetime']))) . "-" . str_pad($appt['id'], 4, '0', STR_PAD_LEFT);
        $customer_name  = htmlspecialchars((string) ($appt['name'] ?? ''));
        $customer_email = htmlspecialchars((string) ($appt['email'] ?? ''));
        $customer_phone = htmlspecialchars((string) ($appt['customer_phone'] ?? 'N/A'));
        $service_tier   = htmlspecialchars((string) ($appt['service_type'] ?? ''));
        $session_date   = date('l, F j, Y', strtotime($appt['request_datetime']));
        $session_time   = date('g:i A', strtotime($appt['request_datetime']));
        $status_clean   = strtoupper($appt['status']);
        $issued_at      = date('M j, Y • H:i:s T');

        // Generate genuine scannable Code 128 barcode
        $generator = new \Picqer\Barcode\BarcodeGeneratorHTML();
        $barcode_html = $generator->getBarcode($reference_code, $generator::TYPE_CODE_128, 2, 38);

        $css_file_path = dirname(__DIR__, 2) . '/public/assets/css/ticket.css';
        $css_ticket = file_exists($css_file_path) ? file_get_contents($css_file_path) : '';

        $html = <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Service Drop-off Stub - {$reference_code}</title>
    <style>
        {$css_ticket}
    </style>
</head>
<body>

    <!-- Header Section -->
    <div class="pass-header">
        <table class="header-table">
            <tr>
                <td style="vertical-align: middle;">
                    <h1 class="brand-title">GADGET CLINIC</h1>
                    <div class="brand-sub">Service Drop-off Verification Stub</div>
                </td>
                <td style="vertical-align: middle; text-align: right;">
                    <div class="badge-voucher">REF: {$reference_code}</div>
                </td>
            </tr>
        </table>
    </div>

    <!-- Hero Session Banner -->
    <div class="hero-box">
        <div class="hero-label">Confirmed Drop-off Time & Date</div>
        <div class="hero-time">{$session_time}</div>
        <div class="hero-date">{$session_date}</div>
    </div>

    <!-- Credentials Table -->
    <table class="info-table">
        <tr>
            <td class="cell-label">Customer Name</td>
            <td>
                <div class="cell-value">{$customer_name}</div>
            </td>
        </tr>
        <tr>
            <td class="cell-label">Contact Details</td>
            <td>
                <div class="cell-value">{$customer_email}</div>
                <div class="cell-sub">Phone: {$customer_phone}</div>
            </td>
        </tr>
        <tr>
            <td class="cell-label">Repair Service</td>
            <td>
                <div class="cell-value">{$service_tier}</div>
                <div class="cell-sub">Hardware Diagnostics & Repair Drop-off</div>
            </td>
        </tr>
        <tr>
            <td class="cell-label">Current Status</td>
            <td>
                <span class="status-pill">{$status_clean}</span>
            </td>
        </tr>
        <tr>
            <td class="cell-label">Stub Reference</td>
            <td>
                <div class="cell-value" style="font-family: 'Courier New', Courier, monospace;">#{$appt['id']}</div>
                <div class="cell-sub">Issued: {$issued_at}</div>
            </td>
        </tr>
    </table>

    <!-- Verification Barcode / Checkpoint Voucher -->
    <div class="stub-box">
        <div class="stub-title">Device Tag Barcode</div>
        <div class="barcode-container">
            {$barcode_html}
        </div>
        <div class="stub-code">{$reference_code}</div>
    </div>

    <!-- Legal & Security Footnote -->
    <div class="pass-footer">
        This document represents an authenticated digital voucher issued by the Gadget Clinic Service Management Platform. Present this stub when dropping off your device at the service center. We are not liable for data loss; please backup your data before drop-off.
    </div>

</body>
</html>
HTML;

        $options = new Options();
        $options->set('isHtml5ParserEnabled', true);
        $options->set('isRemoteEnabled', false);
        $options->set('defaultFont', 'Helvetica');

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');
        try {
            if (ob_get_length()) {
                ob_end_clean();
            }
            $dompdf->render();

            $mode = $_GET['mode'] ?? 'download';
            $is_attachment = ($mode !== 'view');

            $filename = "GadgetClinic_Stub_" . $reference_code . ".pdf";
            $dompdf->stream($filename, ["Attachment" => $is_attachment]);
            exit();
        } catch (\Throwable $e) {
            error_log('[Gadget Clinic] PDF Stub Generation Error: ' . $e->getMessage());
            http_response_code(500);
            require_once dirname(__DIR__, 2) . '/includes/errors/500.php';
            exit();
        }
    }

    public function respondToQuote() {
        $user_id = $this->requireAuth();

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (!$this->validateCsrfToken()) {
                $_SESSION['error_message'] = "Invalid security token. Please try again.";
                $this->redirect('/dashboard');
            }

            $request_id = (int) ($_POST['request_id'] ?? 0);
            $action = $_POST['action'] ?? '';

            if (!in_array($action, ['approved', 'declined'])) {
                $_SESSION['error_message'] = "Invalid action.";
                $this->redirect('/dashboard');
            }

            $requestModel = new ServiceRequest();
            $target_appt = $requestModel->findByIdAndUser($request_id, $user_id);

            if ($target_appt) {
                if ($target_appt['quote_status'] !== 'pending') {
                    $_SESSION['error_message'] = "This quotation is not pending client review or has already been finalized.";
                } else {
                    $requestModel->updateQuoteStatus($request_id, $user_id, $action);
                    $this->rotateCsrfToken();
                    $_SESSION['success_message'] = "Quote has been {$action} successfully.";
                }
            } else {
                $_SESSION['error_message'] = "Appointment not found or unauthorized action.";
            }

            $this->redirect('/dashboard');
        }
    }

    public function downloadInvoice() {
        $user_id = $this->requireAuth();
        if (!isset($_GET['id'])) {
            $this->redirect('/');
        }
        
        $appt_id = (int) $_GET['id'];

        $requestModel = new ServiceRequest();
        $appt = $requestModel->getTicketInfo($appt_id, $user_id);

        if (!$appt || $appt['quote_status'] !== 'approved' || $appt['status'] !== 'completed') {
            http_response_code(404);
            require_once dirname(__DIR__) . '/../includes/errors/404.php';
            exit();
        }

        $reference_code = "INV-" . strtoupper(date('ymd', strtotime($appt['request_datetime']))) . "-" . str_pad($appt['id'], 4, '0', STR_PAD_LEFT);
        $customer_name  = htmlspecialchars((string) ($appt['name'] ?? ''));
        $customer_email = htmlspecialchars((string) ($appt['email'] ?? ''));
        $service_tier   = htmlspecialchars((string) ($appt['service_type'] ?? ''));
        $quote_amount   = number_format((float) ($appt['quote_amount'] ?? 0), 2);
        $quote_desc     = nl2br(htmlspecialchars((string) ($appt['quote_description'] ?? '')));
        $issued_at      = date('M j, Y');

        $html = <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Invoice - {$reference_code}</title>
    <style>
        body { font-family: 'Helvetica', sans-serif; color: #333; line-height: 1.6; }
        .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, .15); }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
        .header-left h1 { margin: 0; color: #333; }
        .header-right { text-align: right; }
        .info-table { width: 100%; margin-bottom: 20px; }
        .info-table td { padding: 5px; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .items-table th, .items-table td { padding: 12px; border-bottom: 1px solid #ddd; text-align: left; }
        .items-table th { background-color: #f8f9fa; font-weight: bold; }
        .total-row td { font-weight: bold; border-top: 2px solid #333; }
        .footer { text-align: center; color: #777; margin-top: 40px; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; }
    </style>
</head>
<body>
    <div class="invoice-box">
        <table style="width: 100%; margin-bottom: 40px;">
            <tr>
                <td style="font-size: 24px; font-weight: bold; color: #333;">GADGET CLINIC</td>
                <td style="text-align: right; font-size: 20px; color: #666;">INVOICE</td>
            </tr>
            <tr>
                <td style="color: #777;">Repair & Service Center</td>
                <td style="text-align: right; color: #777;">#{$reference_code}</td>
            </tr>
        </table>

        <table class="info-table">
            <tr>
                <td style="width: 50%;">
                    <strong>Bill To:</strong><br>
                    {$customer_name}<br>
                    {$customer_email}
                </td>
                <td style="width: 50%; text-align: right;">
                    <strong>Date:</strong> {$issued_at}<br>
                    <strong>Status:</strong> <span style="color: #2e7d32;">Paid / Accepted</span>
                </td>
            </tr>
        </table>

        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 70%;">Description</th>
                    <th style="width: 30%; text-align: right;">Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>
                        <strong>{$service_tier}</strong><br>
                        <span style="color: #666; font-size: 14px;">{$quote_desc}</span>
                    </td>
                    <td style="text-align: right;">PHP {$quote_amount}</td>
                </tr>
                <tr class="total-row">
                    <td style="text-align: right;">Total Amount</td>
                    <td style="text-align: right;">PHP {$quote_amount}</td>
                </tr>
            </tbody>
        </table>

        <div class="footer">
            Thank you for choosing Gadget Clinic. This is a system-generated invoice.
        </div>
    </div>
</body>
</html>
HTML;

        $options = new Options();
        $options->set('isHtml5ParserEnabled', true);
        $options->set('isRemoteEnabled', false);
        $options->set('defaultFont', 'Helvetica');

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');

        try {
            if (ob_get_length()) {
                ob_end_clean();
            }
            $dompdf->render();

            $filename = "GadgetClinic_Invoice_" . $reference_code . ".pdf";
            $dompdf->stream($filename, ["Attachment" => true]);
            exit();
        } catch (\Throwable $e) {
            error_log('[Gadget Clinic] Dompdf Invoice Error: ' . $e->getMessage());
            http_response_code(500);
            require_once dirname(__DIR__, 2) . '/includes/errors/500.php';
            exit();
        }
    }

    /**
     * Securely serve an uploaded document after verifying the requester owns
     * the associated service request. Files live outside public/ and are never
     * directly accessible via URL — this method is the only access gate.
     */
    public function viewDocument() {
        $user_id = $this->requireAuth();

        $request_id = (int) ($_GET['request_id'] ?? 0);
        if ($request_id <= 0) {
            http_response_code(400);
            exit('Bad Request');
        }

        $requestModel = new ServiceRequest();
        $appt = $requestModel->findByIdAndUser($request_id, $user_id);

        // Explicit admin bypass: verify the current user is an admin before granting
        // cross-user document access. All admin document views are audit-logged.
        if (!$appt) {
            $viewerModel = new User();
            $viewer = $viewerModel->findById($user_id);
            if ($viewer && $viewer['role'] === 'admin') {
                $appt = $requestModel->getTicketInfo($request_id, $user_id);
                error_log(sprintf(
                    '[Gadget Clinic][AUDIT] Admin user_id=%d viewed document for request_id=%d from IP %s',
                    $user_id,
                    $request_id,
                    $_SERVER['REMOTE_ADDR'] ?? 'unknown'
                ));
            }
        }

        if (!$appt || empty($appt['document_path'] ?? '')) {
            http_response_code(404);
            exit('Document not found.');
        }

        $storage_dir = dirname(__DIR__, 2) . '/storage/uploads/';
        // Support both legacy absolute paths and new filename-only paths
        $filename = basename($appt['document_path']);
        $file_path = $storage_dir . $filename;

        if (!file_exists($file_path)) {
            $legacy_path = dirname(__DIR__, 2) . '/public/uploads/' . $filename;
            if (file_exists($legacy_path)) {
                $file_path = $legacy_path;
            } else {
                http_response_code(404);
                exit('File not found on server.');
            }
        }

        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        $mime_map = [
            'jpg'  => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png'  => 'image/png',
            'pdf'  => 'application/pdf',
        ];

        $mime = $mime_map[$ext] ?? 'application/octet-stream';

        header('Content-Type: ' . $mime);
        header('Content-Length: ' . filesize($file_path));
        // Private browser cache for 24 hours so repeat views load instantaneously
        header('Cache-Control: private, max-age=86400');
        // Inline display in browser; change to 'attachment' to force download
        header('Content-Disposition: inline; filename="' . $filename . '"');
        header('X-Content-Type-Options: nosniff');
        readfile($file_path);
        exit();
    }

    /**
     * Downscales and compresses uploaded images using PHP GD.
     * Preserves aspect ratio up to max 1600px, enables progressive JPEG encoding,
     * corrects EXIF camera orientation, and reduces network payload by up to 90%.
     */
    private function optimizeImage(string $filePath, string $mime): void
    {
        if (!extension_loaded('gd') || !file_exists($filePath)) {
            return;
        }

        try {
            $src = null;
            if ($mime === 'image/jpeg') {
                $src = @imagecreatefromjpeg($filePath);
            } elseif ($mime === 'image/png') {
                $src = @imagecreatefrompng($filePath);
            }

            if (!$src) {
                return;
            }

            // Correct EXIF orientation for smartphone camera photos
            if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
                $exif = @exif_read_data($filePath);
                if (!empty($exif['Orientation'])) {
                    switch ((int) $exif['Orientation']) {
                        case 3:
                            $rotated = imagerotate($src, 180, 0);
                            if ($rotated !== false) {
                                imagedestroy($src);
                                $src = $rotated;
                            }
                            break;
                        case 6:
                            $rotated = imagerotate($src, -90, 0);
                            if ($rotated !== false) {
                                imagedestroy($src);
                                $src = $rotated;
                            }
                            break;
                        case 8:
                            $rotated = imagerotate($src, 90, 0);
                            if ($rotated !== false) {
                                imagedestroy($src);
                                $src = $rotated;
                            }
                            break;
                    }
                }
            }

            $orig_w = imagesx($src);
            $orig_h = imagesy($src);

            $max_dim = 1600;
            if ($orig_w > $max_dim || $orig_h > $max_dim) {
                $ratio = min($max_dim / $orig_w, $max_dim / $orig_h);
                $new_w = max(1, (int) round($orig_w * $ratio));
                $new_h = max(1, (int) round($orig_h * $ratio));

                $target = imagecreatetruecolor($new_w, $new_h);

                if ($mime === 'image/png') {
                    imagealphablending($target, false);
                    imagesavealpha($target, true);
                    $transparent = imagecolorallocatealpha($target, 255, 255, 255, 127);
                    imagefilledrectangle($target, 0, 0, $new_w, $new_h, $transparent);
                }

                imagecopyresampled($target, $src, 0, 0, 0, 0, $new_w, $new_h, $orig_w, $orig_h);
                imagedestroy($src);
                $src = $target;
            }

            if ($mime === 'image/jpeg') {
                // Enable progressive JPEG to prevent top-to-bottom raster scan chunking
                imageinterlace($src, true);
                imagejpeg($src, $filePath, 82);
            } elseif ($mime === 'image/png') {
                imagepng($src, $filePath, 7);
            }

            imagedestroy($src);
        } catch (\Throwable $e) {
            error_log('[Gadget Clinic] Image optimization error: ' . $e->getMessage());
        }
    }
}
