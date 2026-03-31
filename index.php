<?php
session_start();
// load settings
$settingsFile = 'settings.json';
$defaults = [
  'enable_logs' => false,
  'log_writes' => false,
  'log_deletes' => false,
  'log_modifications' => false,
  'log_auth' => false,
  'enable_login_attempts' => false,
  'login_attempts_count' => 5,
  'lockout_seconds' => 300,
  'rate_limit_ms' => 250,
  'log_file' => 'logs/pcspecs.log'
];
$settings = $defaults;
if (file_exists($settingsFile)) {
  $s = json_decode(@file_get_contents($settingsFile), true);
  if (is_array($s)) $settings = array_merge($defaults, $s);
}

// load password values from pass.env or env vars
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
if (!$password && getenv('PCS_PASSWORD')) $password = getenv('PCS_PASSWORD');
if (!$password_hash && getenv('PCS_PASSWORD_HASH')) $password_hash = getenv('PCS_PASSWORD_HASH');

// login attempt protection (configurable via settings.json)
$login_error = '';
if (!isset($_SESSION['login_attempts'])) $_SESSION['login_attempts'] = 0;
if (!isset($_SESSION['login_locked_until'])) $_SESSION['login_locked_until'] = 0;

$login_attempts_enabled = !empty($settings['enable_login_attempts']);
$maxAttempts = $login_attempts_enabled ? intval($settings['login_attempts_count'] ?? 5) : PHP_INT_MAX;
$lockoutSeconds = $login_attempts_enabled ? intval($settings['lockout_seconds'] ?? 300) : 0;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
  // if lockout active (only applies if login attempts enabled)
  if ($login_attempts_enabled && !empty($_SESSION['login_locked_until']) && time() < $_SESSION['login_locked_until']) {
    $wait = $_SESSION['login_locked_until'] - time();
    $login_error = 'Trop de tentatives. Réessayez dans ' . intval($wait) . ' secondes.';
  } else {
    $entered = (string)($_POST['password'] ?? '');
    $ok = false;
    if (!empty($password_hash)) {
      $ok = password_verify($entered, $password_hash);
    } elseif ($password !== '') {
      $ok = hash_equals((string)$password, $entered);
    }

    if ($ok) {
      // reset attempts
      $_SESSION['login_attempts'] = 0;
      $_SESSION['login_locked_until'] = 0;
      session_regenerate_id(true);
      $_SESSION['authenticated'] = true;
      $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
      // log auth success if enabled
      if (!empty($settings['enable_logs']) && !empty($settings['log_auth'])) {
        $logFile = $settings['log_file'] ?? 'logs/pcspecs.log';
        $entry = json_encode(['time' => gmdate('c'), 'ip' => $_SERVER['REMOTE_ADDR'] ?? '', 'event' => 'login_success']);
        @mkdir(dirname($logFile), 0750, true);
        @file_put_contents($logFile, $entry.PHP_EOL, FILE_APPEND | LOCK_EX);
      }
      header('Location: ' . $_SERVER['PHP_SELF']);
      exit;
    } else {
      if ($login_attempts_enabled) {
        $_SESSION['login_attempts'] = ($_SESSION['login_attempts'] ?? 0) + 1;
        if ($_SESSION['login_attempts'] >= $maxAttempts) {
          $_SESSION['login_locked_until'] = time() + $lockoutSeconds;
          $_SESSION['login_attempts'] = 0;
          $login_error = 'Trop de tentatives. Verrouillage temporaire.';
        } else {
          $login_error = 'Mot de passe incorrect ! (' . intval($_SESSION['login_attempts']) . '/' . $maxAttempts . ')';
        }
      } else {
        // attempts not enabled: simple message, no lockout
        $login_error = 'Mot de passe incorrect !';
      }
      if (!empty($settings['enable_logs']) && !empty($settings['log_auth'])) {
        $logFile = $settings['log_file'] ?? 'logs/pcspecs.log';
        $entry = json_encode(['time' => gmdate('c'), 'ip' => $_SERVER['REMOTE_ADDR'] ?? '', 'event' => 'login_failed', 'attempts' => $_SESSION['login_attempts']]);
        @mkdir(dirname($logFile), 0750, true);
        @file_put_contents($logFile, $entry.PHP_EOL, FILE_APPEND | LOCK_EX);
      }
    }
  }
}


if (empty($_SESSION['authenticated'])):
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Connexion — PC Specs</title>
  <link rel="stylesheet" href="style.css">
</head>
<body class="login-page">
  <div class="auth-card">
    <h1>PC SPECS</h1>
    <p class="muted">Connectez-vous pour accéder à la base</p>
    <?php if (!empty($login_error)): ?>
      <div class="error"><?php echo htmlspecialchars($login_error, ENT_QUOTES, 'UTF-8'); ?></div>
    <?php endif; ?>
    <form method="post" class="login-form">
      <input type="password" name="password" placeholder="Mot de passe" required />
      <button class="btn btn-primary" type="submit">Se connecter</button>
    </form>
  </div>
</body>
</html>
<?php
exit;
endif;
?>

<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>PC Specs Database</title>
  <meta name="csrf-token" content="<?php echo htmlspecialchars($_SESSION['csrf_token'] ?? '', ENT_QUOTES); ?>">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="topbar">
    <div class="brand">
      <h1>PC SPECS</h1>
      <p class="subtitle">Inventaire matériel</p>
    </div>
    <div class="top-actions">
      <button id="btn-create" class="btn btn-primary">Créer</button>
      <button id="btn-settings" class="btn">Paramètres</button>
      <a href="logout.php" class="btn">Se déconnecter</a>
    </div>
  </header>

  <main class="container">
    <section class="card">
      <div class="card-header">
        <input id="search" type="search" placeholder="Rechercher CPU, GPU, marque..." />
      </div>
      <div class="table-wrap">
        <table class="pc-table">
          <thead>
            <tr>
              <th>#</th>
              <th>CPU</th>
              <th>GPU</th>
              <th>STORAGE</th>
              <th>OS</th>
              <th>BRAND</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="pc-table"></tbody>
        </table>
      </div>
    </section>
  </main>

  <div class="modal" id="pc-modal" aria-hidden="true">
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h2 id="modal-title">Ajouter un PC</h2>
      <form id="pc-form" class="pc-modal-form" novalidate>
        <div class="field">
          <span class="field-label">CPU</span>
          <div class="field-row">
            <input type="text" name="cpu" required />
            <img id="cpu-preview" src="icons/none.png" alt="">
            <span class="field-detected" id="cpu-detected"></span>
          </div>
        </div>
        <div class="field">
          <span class="field-label">GPU</span>
          <div class="field-row">
            <input type="text" name="gpu" />
            <img id="gpu-preview" src="icons/none.png" alt="">
            <span class="field-detected" id="gpu-detected"></span>
          </div>
        </div>
        <div class="field">
          <span class="field-label">STORAGE</span>
          <div class="field-row">
            <input type="text" name="storage" />
            <img id="storage-preview" src="icons/none.png" alt="">
            <span class="field-detected" id="storage-detected"></span>
          </div>
        </div>
        <div class="field">
          <span class="field-label">OS</span>
          <div class="field-row">
            <input type="text" name="os" />
            <img id="os-preview" src="icons/none.png" alt="">
            <span class="field-detected" id="os-detected"></span>
          </div>
        </div>
        <div class="field">
          <span class="field-label">BRAND</span>
          <div class="field-row">
            <input type="text" name="brand" />
            <img id="brand-preview" src="icons/none.png" alt="">
            <span class="field-detected" id="brand-detected"></span>
          </div>
        </div>
      </form>
      <div class="modal-actions">
        <button id="modal-cancel" class="btn">Annuler</button>
        <button id="modal-save" class="btn btn-primary">Enregistrer</button>
      </div>
    </div>
  </div>

  <!-- Settings modal (separate from PC modal) -->
  <div class="modal" id="settings-modal" aria-hidden="true">
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <h2 id="settings-title">Paramètres</h2>
      <form id="settings-form" class="modal-form" novalidate>
        <section class="settings-section">
          <h3>Logs</h3>
          <label class="row">Activer les logs
            <input type="checkbox" name="enable_logs" />
          </label>
          <label class="row">Journaliser les ajouts
            <input type="checkbox" name="log_writes" data-depends="enable_logs" />
          </label>
          <label class="row">Journaliser les suppressions
            <input type="checkbox" name="log_deletes" data-depends="enable_logs" />
          </label>
          <label class="row">Journaliser les modifications
            <input type="checkbox" name="log_modifications" data-depends="enable_logs" />
          </label>
          <label class="row">Journaliser les connexions
            <input type="checkbox" name="log_auth" data-depends="enable_logs" />
          </label>
          <label class="row">Fichier de log
            <input type="text" name="log_file" placeholder="logs/pcspecs.log" data-depends="enable_logs" />
          </label>
        </section>

        <section class="settings-section">
          <h3>Sécurité</h3>
          <label class="row">Activer la protection des tentatives de connexion
            <input type="checkbox" name="enable_login_attempts" />
          </label>
          <label class="row">Tentatives avant verrouillage
            <input type="number" name="login_attempts_count" min="1" max="100" step="1" data-depends="enable_login_attempts" />
          </label>
          <label class="row">Durée du verrouillage (secondes)
            <input type="number" name="lockout_seconds" min="0" max="86400" step="1" data-depends="enable_login_attempts" />
          </label>
        </section>
      </form>
      <div class="modal-actions">
        <button id="settings-cancel" class="btn">Annuler</button>
        <button id="settings-save" class="btn btn-primary">Enregistrer</button>
      </div>
    </div>
  </div>

  <script src="script.js"></script>
</body>
</html>
