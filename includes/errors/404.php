<?php
$is_logged_in = isset($_SESSION['user_id']);
$btn_text = $is_logged_in ? "Return to Dashboard" : "Return to Homepage";
$btn_link = $is_logged_in ? "/dashboard" : "/";
$base_url = $_ENV['APP_URL'] ?? '';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Page Not Found — Gadget Clinic</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&family=Space+Mono:wght@700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="<?= htmlspecialchars($base_url) ?>/assets/css/error.css">
</head>
<body>
    <div class="denied-card">
        <div class="code">HTTP 404 / NOT FOUND</div>
        <h1>Endpoint Not Found</h1>
        <p>The page or resource you are looking for does not exist on the Gadget Clinic platform. It might have been moved or deleted.</p>
        <a href="<?= htmlspecialchars($base_url . $btn_link) ?>"><?= htmlspecialchars($btn_text) ?></a>
    </div>
</body>
</html>
