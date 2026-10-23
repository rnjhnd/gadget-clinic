<?php
// email_helper.php - Centralized Email Service using PHPMailer
require_once dirname(__DIR__) . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Only load dotenv if not already initialized
if (empty($_ENV['SMTP_HOST']) && class_exists('Dotenv\Dotenv')) {
    $dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__));
    $dotenv->safeLoad();
}

/**
 * Sends an email using PHPMailer and environment credentials.
 *
 * @param string $toEmail Customer email address
 * @param string $subject Email subject
 * @param string $htmlBody HTML content of the email
 * @return array ['success' => bool, 'error' => string|null]
 */
function send_app_email($toEmail, $subject, $htmlBody) {
    if (empty($toEmail) || empty($subject) || empty($htmlBody)) {
        return ['success' => false, 'error' => 'Missing required email parameters.'];
    }

    // Gracefully handle unconfigured SMTP in local development without hanging on timeouts
    if (empty($_ENV['SMTP_USER']) || empty($_ENV['SMTP_PASS'])) {
        error_log("[Gadget Clinic] SMTP credentials not set in environment. Skipping email dispatch to: {$toEmail}");
        return ['success' => false, 'error' => 'SMTP credentials not configured.'];
    }

    $mail = new PHPMailer(true);
    
    try {
        // Server settings
        $mail->isSMTP();
        $mail->Host       = $_ENV['SMTP_HOST'] ?? 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = $_ENV['SMTP_USER'] ?? '';
        $mail->Password   = $_ENV['SMTP_PASS'] ?? '';
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = $_ENV['SMTP_PORT'] ?? 587;
        $mail->Timeout    = 5; // 5-second socket timeout to prevent indefinite hangs

        // Recipients
        $mail->setFrom($_ENV['SMTP_USER'] ?? 'noreply@gadgetclinic.com', 'Gadget Clinic');
        $mail->addAddress($toEmail);

        // Content
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $htmlBody;
        $mail->AltBody = strip_tags(str_replace(['<br>', '<br/>', '</p>'], "\n", $htmlBody));

        $mail->send();
        return ['success' => true];
    } catch (Exception $e) {
        return ['success' => false, 'error' => "Message could not be sent. Mailer Error: {$mail->ErrorInfo}"];
    }
}

/**
 * Helper to generate standard branded HTML email frame
 */
function get_branded_email_html($title, $messageContent, $ctaLabel = '', $ctaUrl = '') {
    $ctaHtml = '';
    if (!empty($ctaLabel) && !empty($ctaUrl)) {
        $ctaHtml = '
        <div style="margin-top: 30px; margin-bottom: 20px;">
            <a href="' . htmlspecialchars($ctaUrl) . '" style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-family: Arial, sans-serif;">' . htmlspecialchars($ctaLabel) . '</a>
        </div>';
    }

    return '
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
            .header { background-color: #000000; color: #ffffff; padding: 24px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; letter-spacing: -0.5px; }
            .content { padding: 32px; color: #333333; font-size: 16px; line-height: 1.6; }
            .footer { padding: 24px; text-align: center; color: #888888; font-size: 13px; background-color: #fafafa; border-top: 1px solid #eeeeee; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Gadget Clinic</h1>
            </div>
            <div class="content">
                <h2 style="margin-top: 0; color: #111111; font-size: 20px;">' . htmlspecialchars($title) . '</h2>
                <p>' . $messageContent . '</p>
                ' . $ctaHtml . '
                <p style="margin-top: 30px;">Thank you for choosing Gadget Clinic!<br>Our technicians are always ready to help.</p>
            </div>
            <div class="footer">
                &copy; ' . date('Y') . ' Gadget Clinic. All rights reserved.
            </div>
        </div>
    </body>
    </html>';
}
