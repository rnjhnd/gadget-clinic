<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Access Restricted — Gadget Clinic</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&family=Space+Mono:wght@700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="<?= htmlspecialchars($_ENV['APP_URL'] ?? '') ?>/assets/css/error.css">
</head>
<body>
    <div class="denied-card">
        <div class="code">HTTP 403 / RESTRICTED</div>
        <h1>Technician Deck Access Denied</h1>
        <p>Your current session does not hold administrative clearance to access the Gadget Clinic command console.</p>
        <a href="<?= htmlspecialchars($_ENV['APP_URL'] ?? '') ?>/dashboard">Return to Client Portal</a>
    </div>
</body>
</html>