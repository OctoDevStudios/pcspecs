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
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#0f9d58">
  <title>Scanner QR — PC Specs</title>
  <link rel="stylesheet" href="style.css">
  <style>
    :root { --primary: #0f9d58; --accent: #018786; --surface: #ffffff; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'Roboto', Arial, sans-serif; background: linear-gradient(180deg,#eaf7ee,#ffffff); color:#222; -webkit-font-smoothing:antialiased; }
    .appbar { height:56px; display:flex; align-items:center; padding:0 16px; background:var(--primary); color:white; font-weight:600; box-shadow:0 2px 4px rgba(0,0,0,0.12); position:fixed; top:0; left:0; right:0; z-index:50; }
    .appbar .title { margin-left:8px; font-size:18px; letter-spacing:0.2px; }
    .container { padding-top:80px; padding-bottom:80px; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { width:100%; max-width:420px; margin:16px; background:var(--surface); border-radius:16px; box-shadow:0 8px 20px rgba(16,24,40,0.08); overflow:hidden; padding:16px; }
    .scan-area { position:relative; width:100%; padding-top:66%; background:#000; border-radius:12px; overflow:hidden; display:flex; align-items:center; justify-content:center; }
    #qr-reader { position:absolute; inset:0; width:100%; height:100%; background:black; }
    .scan-frame { position:absolute; width:70%; height:70%; border-radius:12px; box-shadow:0 0 0 9999px rgba(0,0,0,0.4); pointer-events:none; display:flex; align-items:center; justify-content:center; }
    .scan-ring { width:80%; height:80%; border:3px solid rgba(255,255,255,0.95); border-radius:8px; box-shadow: 0 8px 20px rgba(0,0,0,0.4) inset; animation: pulse 1.8s infinite; }
    @keyframes pulse { 0% { transform: scale(1); opacity:1 } 50% { transform: scale(1.02); opacity:0.8 } 100% { transform: scale(1); opacity:1 } }
    .info { margin-top:12px; text-align:center; color:#444; }
    .controls { display:flex; gap:8px; justify-content:center; margin-top:12px; }
    .btn { padding:10px 14px; border-radius:8px; border:none; background:#f1f3f4; color:#111; font-weight:600; box-shadow:0 2px 6px rgba(0,0,0,0.06); }
    .btn.primary { background:var(--primary); color:#fff; }
    .fab { position:fixed; right:16px; bottom:24px; width:64px; height:64px; border-radius:50%; background:var(--accent); color:white; display:flex; align-items:center; justify-content:center; font-size:28px; box-shadow:0 10px 20px rgba(1,135,134,0.24); border:none; z-index:60; }
    .fab.secondary { right:92px; background:#fff; color:#333; width:56px; height:56px; box-shadow:0 8px 18px rgba(0,0,0,0.08); }
    .snackbar { position:fixed; left:50%; transform:translateX(-50%) translateY(100px); bottom:20px; background:#323232; color:#fff; padding:12px 18px; border-radius:8px; opacity:0; transition: transform .3s ease, opacity .3s; z-index:70; display:flex; gap:12px; align-items:center; }
    .snackbar.show { transform:translateX(-50%) translateY(0); opacity:1; }
    .popup { position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); background:#fff; border-radius:12px; padding:16px 18px; width:90%; max-width:360px; box-shadow:0 12px 40px rgba(0,0,0,0.12); display:none; z-index:90; }
    .popup.active { display:block; }
    .overlay { position:fixed; inset:0; background:rgba(0,0,0,0.4); display:none; z-index:80; }
    .overlay.active{ display:block; }
    .loading { position:fixed; inset:0; background:linear-gradient(0deg, rgba(255,255,255,0.96), rgba(255,255,255,0.92)); display:flex; align-items:center; justify-content:center; z-index:100; display:none; flex-direction:column; gap:14px; }
    .loading.active { display:flex; }
    .loading .spinner { width:56px; height:56px; border-radius:50%; border:6px solid rgba(0,0,0,0.08); border-top-color:var(--primary); animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading .progress { width:240px; height:8px; background:#eee; border-radius:8px; overflow:hidden; box-shadow: inset 0 1px 0 rgba(255,255,255,0.6); }
    .loading .progress > i { display:block; height:100%; width:0%; background: linear-gradient(90deg, var(--primary), var(--accent)); transition: width .2s linear; }
    .message { margin-top:12px; font-weight:600; }
    .pc-item { padding:12px; border-radius:10px; background:#fafafa; box-shadow:0 2px 6px rgba(0,0,0,0.04); margin-bottom:8px; cursor:pointer; }
    .hidden { display:none !important; }
    @media (max-width:420px){ .card{ border-radius:12px; margin:10px } .fab { right:12px; bottom:20px; } }
  </style>
</head>
<body>
  <div class="appbar">
    <div class="title">PC SPECS</div>
  </div>
  <div class="container">
    <div class="card">
      <div class="scan-area">
        <div id="qr-reader"></div>
        <div class="scan-frame"><div class="scan-ring"></div></div>
      </div>
      <div class="info">
        <div id="scan-result" class="message">Appuyez sur Démarrer pour scanner</div>
        <div class="controls">
          <button id="btn-start" class="btn primary">Démarrer</button>
          <button id="btn-stop" class="btn" disabled>Arrêter</button>
          <button id="btn-flash" class="btn" disabled>Flash</button>
          <button id="btn-list" class="btn">Liste</button>
        </div>
      </div>
      <div id="pc-detail" class="hidden"></div>
      <div id="pc-list" class="hidden"></div>
    </div>
  </div>

  <button class="fab" id="fab-scan">⌘</button>
  <button class="fab secondary" id="fab-list">☰</button>

  <div id="snackbar" class="snackbar" aria-live="polite"></div>
  <div class="popup" id="popup"><p id="popup-message">Message</p><div style="text-align:right;margin-top:12px;"><button id="popup-close" class="btn">Fermer</button></div></div>
  <div class="overlay" id="overlay"></div>
  <div class="loading" id="loading"><div class="spinner"></div><div class="progress"><i id="progress-bar"></i></div><div id="loading-text">Chargement...</div></div>

  <script src="html5-qrcode.min.js"></script>
  <script src="mobile.js"></script>
</body>
</html>
