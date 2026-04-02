<?php
session_start();

// Simple mobile entry with camera QR scanner and DB browse

// load password from pass.env (same format as index.php)
$password = '';
$password_hash = '';
$passFile = 'pass.env';
if (file_exists($passFile)) {
    $c = @file_get_contents($passFile);
    foreach (preg_split('/\r\n|\n|\r/', $c) as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, '#') === 0) continue;
        if (strpos($line, '=') === false) continue;
        list($k, $v) = explode('=', $line, 2);
        $k = trim($k); $v = trim($v);
        if ($k === 'password') $password = $v;
        if ($k === 'password_hash') $password_hash = $v;
    }
}

$login_error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
    $entered = (string)($_POST['password'] ?? '');
    $ok = false;
    if (!empty($password_hash)) {
        $ok = password_verify($entered, $password_hash);
    } elseif ($password !== '') {
        $ok = hash_equals((string)$password, $entered);
    }
    if ($ok) {
        $_SESSION['authenticated'] = true;
        session_regenerate_id(true);
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        header('Location: mobile.php');
        exit;
    } else {
        $login_error = 'Mot de passe incorrect';
    }
}

if (empty($_SESSION['authenticated'])):
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>PC Specs — Mobile Login</title>
  <link rel="stylesheet" href="mobile.css">
</head>
<body class="mobile-login">
  <div class="appbar">PC SPECS</div>
  <main class="mobile-card">
    <h2>Connexion mobile</h2>
    <?php if (!empty($login_error)): ?>
      <div class="error"><?php echo htmlspecialchars($login_error, ENT_QUOTES, 'UTF-8'); ?></div>
    <?php endif; ?>
    <form method="post" class="login-form">
      <input type="password" name="password" placeholder="Mot de passe" required />
      <button class="btn primary" type="submit">Se connecter</button>
    </form>
    <p class="muted">Ou naviguez depuis un ordinateur pour la vue complète.</p>
  </main>
</body>
</html>
<?php
exit;
endif;

// Authenticated mobile UI
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>PC Specs — Mobile</title>
  <link rel="stylesheet" href="mobile.css">
</head>
<body class="mobile-app">
  <header class="appbar">
    <div class="app-title">PC SPECS</div>
    <div class="app-actions">
      <button id="btn-browse" class="btn small">Consulter DB</button>
      <a href="logout.php" class="btn small">Se déconnecter</a>
    </div>
  </header>

  <main class="content">
    <section class="scanner">
      <div id="qr-reader" class="qr-reader">Chargement caméra…</div>
      <div id="scan-result" class="scan-result muted">Scanner un QR pour afficher un PC</div>
      <div class="scanner-actions">
        <button id="btn-stop" class="btn">Arrêter</button>
        <button id="btn-start" class="btn primary">Démarrer</button>
      </div>
    </section>

    <section id="pc-detail" class="pc-detail"></section>

    <section id="pc-list" class="pc-list hidden"></section>
  </main>

  <!-- QR library from CDN -->
  <script src="https://unpkg.com/html5-qrcode@2.3.8/minified/html5-qrcode.min.js"></script>
  <script src="mobile.js"></script>
</body>
</html>
