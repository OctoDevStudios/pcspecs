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
  'log_file' => 'logs/pcspecs.log',
  // IP blocking (optional)
  'ip_block_enabled' => false,
  'ip_block_threshold' => 20,
  'ip_block_seconds' => 3600,
];
$settings = $defaults;
if (file_exists($settingsFile)) {
  $s = json_decode(@file_get_contents($settingsFile), true);
  if (is_array($s)) $settings = array_merge($defaults, $s);
}

// files for IP tracking
$ipAttemptsFile = 'logs/ip_attempts.json';
$blockedIpsFile = 'logs/blocked_ips.json';

// helper: read/write JSON with basic safety
function read_json_file($file) {
  if (!file_exists($file)) return [];
  $c = @file_get_contents($file);
  if ($c === false) return [];
  $d = json_decode($c, true);
  return is_array($d) ? $d : [];
}

function write_json_file_atomic($file, $data) {
  $dir = dirname($file);
  if (!is_dir($dir)) @mkdir($dir, 0750, true);
  $tmp = tempnam($dir, 'tmp');
  if ($tmp === false) return false;
  $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  if (@file_put_contents($tmp, $json) === false) { @unlink($tmp); return false; }
  if (!@rename($tmp, $file)) { @unlink($tmp); return false; }
  return true;
}

function get_client_ip() {
  if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
    $parts = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
    return trim($parts[0]);
  }
  return $_SERVER['REMOTE_ADDR'] ?? '';
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
  $ip = get_client_ip();

  // if IP blocked (only when login attempts and IP block enabled)
  if ($login_attempts_enabled && !empty($settings['ip_block_enabled'])) {
    $blocked = read_json_file($blockedIpsFile);
    $blockUntil = isset($blocked[$ip]) ? intval($blocked[$ip]) : 0;
    if ($blockUntil && time() < $blockUntil) {
      $wait = $blockUntil - time();
      $login_error = 'Trop de tentatives depuis votre IP. Réessayez dans ' . intval($wait) . ' secondes.';
    }
  }

  // proceed only if IP not currently blocked
  if (empty($login_error)) {
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

      // reset IP attempts/block for this IP
      if (!empty($settings['ip_block_enabled'])) {
        $ipAttempts = read_json_file($ipAttemptsFile);
        if (isset($ipAttempts[$ip])) {
          unset($ipAttempts[$ip]);
          write_json_file_atomic($ipAttemptsFile, $ipAttempts);
        }
        $blocked = read_json_file($blockedIpsFile);
        if (isset($blocked[$ip])) {
          unset($blocked[$ip]);
          write_json_file_atomic($blockedIpsFile, $blocked);
        }
      }

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

      // IP-based tracking + blocking
      if ($login_attempts_enabled && !empty($settings['ip_block_enabled'])) {
        $ipAttempts = read_json_file($ipAttemptsFile);
        $rec = $ipAttempts[$ip] ?? ['count' => 0, 'last' => 0];
        $rec['count'] = intval($rec['count'] ?? 0) + 1;
        $rec['last'] = time();
        $ipAttempts[$ip] = $rec;
        write_json_file_atomic($ipAttemptsFile, $ipAttempts);
        $threshold = intval($settings['ip_block_threshold'] ?? 20);
        if ($rec['count'] >= $threshold) {
          $blocked = read_json_file($blockedIpsFile);
          $blocked[$ip] = time() + intval($settings['ip_block_seconds'] ?? 3600);
          write_json_file_atomic($blockedIpsFile, $blocked);
          // reset attempts for ip
          unset($ipAttempts[$ip]);
          write_json_file_atomic($ipAttemptsFile, $ipAttempts);
          $login_error = 'Trop de tentatives. Votre IP a été bloquée temporairement.';
          if (!empty($settings['enable_logs']) && !empty($settings['log_auth'])) {
            $logFile = $settings['log_file'] ?? 'logs/pcspecs.log';
            $entry = json_encode(['time' => gmdate('c'), 'ip' => $ip, 'event' => 'ip_blocked', 'threshold' => $threshold]);
            @mkdir(dirname($logFile), 0750, true);
            @file_put_contents($logFile, $entry.PHP_EOL, FILE_APPEND | LOCK_EX);
          }
        }
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
              <th>RAM</th>
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
          <span class="field-label">RAM</span>
          <div class="field-row">
            <input type="text" name="ram" />
            <img id="ram-preview" src="icons/none.png" alt="">
            <span class="field-detected" id="ram-detected"></span>
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
          <label class="row">Activer le blocage IP
            <input type="checkbox" name="ip_block_enabled" data-depends="enable_login_attempts" />
          </label>
          <label class="row">Tentatives IP avant blocage
            <input type="number" name="ip_block_threshold" min="1" max="100000" step="1" data-depends="ip_block_enabled" />
          </label>
          <label class="row">Durée du blocage IP (secondes)
            <input type="number" name="ip_block_seconds" min="0" max="86400" step="1" data-depends="ip_block_enabled" />
          </label>
        </section>
      </form>
      <div class="modal-actions">
        <button id="settings-cancel" class="btn">Annuler</button>
        <button id="settings-save" class="btn btn-primary">Enregistrer</button>
      </div>
    </div>
  </div>

  <!-- Notifications container -->
  <div id="notifications" class="notifications" aria-live="polite"></div>

  <!-- Confirmation modal (simple) -->
  <div class="modal" id="confirm-modal" aria-hidden="true">
    <div class="modal-content" role="dialog" aria-modal="true">
      <p class="confirm-message">Confirmer ?</p>
      <div class="modal-actions" style="justify-content:flex-start;">
        <button class="btn confirm-no">Non</button>
        <button class="btn btn-primary confirm-yes">Oui</button>
      </div>
    </div>
  </div>

  <!-- Correction modal: show suggested corrections before persisting -->
  <div class="modal" id="correction-modal" aria-hidden="true">
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="correction-title">
      <h2 id="correction-title">Corrections proposées</h2>
      <div id="correction-list" style="max-height:260px;overflow:auto;margin:8px 0;padding-right:8px;"></div>
      <div class="modal-actions">
        <button id="correction-edit" class="btn">Me corriger</button>
        <button id="correction-keep" class="btn">Garder l'original</button>
        <button id="correction-apply" class="btn btn-primary">Appliquer corrections</button>
      </div>
    </div>
  </div>

  <!-- Loading overlay -->
  <div id="loading-overlay" class="loading-overlay" hidden>
    <div class="spinner"></div>
  </div>

  <script>
    (function(){
      try {
        var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.matchMedia && window.matchMedia('(max-width:700px)').matches);
        if (isMobile && window.location.pathname.indexOf('mobile.php') === -1) {
          window.location = 'mobile.php';
        }
      } catch (e) {}
    })();
  </script>
  <script src="detectai.js"></script>
  <script src="script.js"></script>
</body>
</html>
