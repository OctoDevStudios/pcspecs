<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

// auth
if (empty($_SESSION['authenticated'])) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
    exit;
}

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

function readSettings() {
    global $settingsFile, $defaults;
    if (!file_exists($settingsFile)) return $defaults;
    $c = @file_get_contents($settingsFile);
    $s = json_decode($c, true);
    return is_array($s) ? array_merge($defaults, $s) : $defaults;
}

function sanitize($s) {
    $s = strip_tags((string)$s);
    $s = preg_replace('/[\x00-\x1F\x7F]/u', '', $s);
    return trim($s);
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    echo json_encode(readSettings());
    exit;
}

if ($method === 'POST') {
    // csrf
    $csrfHeader = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
    if (empty($csrfHeader) || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $csrfHeader)) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'CSRF token missing or invalid']);
        exit;
    }

    $input = file_get_contents('php://input');
    $payload = json_decode($input, true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($payload)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Invalid JSON']);
        exit;
    }

    $s = readSettings();
    // bools
    $s['enable_logs'] = !empty($payload['enable_logs']);
    $s['log_writes'] = !empty($payload['log_writes']);
    $s['log_deletes'] = !empty($payload['log_deletes']);
    $s['log_modifications'] = !empty($payload['log_modifications']);
    $s['log_auth'] = !empty($payload['log_auth']);
    // login attempts settings
    $s['enable_login_attempts'] = !empty($payload['enable_login_attempts']);
    $lac = intval($payload['login_attempts_count'] ?? $s['login_attempts_count']);
    if ($lac < 1) $lac = 1;
    if ($lac > 100) $lac = 100;
    $s['login_attempts_count'] = $lac;
    $ls = intval($payload['lockout_seconds'] ?? $s['lockout_seconds']);
    if ($ls < 0) $ls = 0;
    if ($ls > 86400) $ls = 86400;
    $s['lockout_seconds'] = $ls;
    // rate limit (write throttling)
    $rl = intval($payload['rate_limit_ms'] ?? $s['rate_limit_ms']);
    if ($rl < 50) $rl = 50;
    if ($rl > 60000) $rl = 60000;
    $s['rate_limit_ms'] = $rl;
    // log file
    $logf = sanitize($payload['log_file'] ?? $s['log_file']);
    if ($logf === '') $logf = $s['log_file'];
    // ensure log file is inside logs/ for safety
    if (!preg_match('#^logs/#', $logf)) {
        $logf = 'logs/pcspecs.log';
    }
    $s['log_file'] = $logf;

    $ok = file_put_contents($settingsFile, json_encode($s, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    if ($ok === false) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Failed to save settings']);
        exit;
    }
    echo json_encode(['status' => 'success', 'message' => 'Settings saved', 'settings' => $s]);
    exit;
}

http_response_code(405);
echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
exit;
?>