<?php
session_start();

// Security headers
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline';");

// settings
$settingsFile = 'settings.json';
$settings = [
    'enable_logs' => false,
    'log_writes' => false,
    'log_deletes' => false,
    'log_modifications' => false,
    'log_auth' => false,
    'rate_limit_ms' => 250,
    'log_file' => 'logs/pcspecs.log'
];
if (file_exists($settingsFile)) {
    $s = json_decode(@file_get_contents($settingsFile), true);
    if (is_array($s)) $settings = array_merge($settings, $s);
}

// helper sanitize
function sanitize($s, $max = 200) {
    $s = strip_tags((string)$s);
    $s = preg_replace('/[\x00-\x1F\x7F]/u', '', $s);
    $s = trim($s);
    if (mb_strlen($s) > $max) $s = mb_substr($s, 0, $max);
    return $s;
}

function readData() {
    global $jsonFile;
    $content = @file_get_contents($jsonFile);
    if ($content === false) return [];
    $data = json_decode($content, true);
    return is_array($data) ? $data : [];
}

// logger
function log_event($action, $details = []) {
    global $settings;
    if (empty($settings['enable_logs'])) return;
    $allowed = [
        'create' => $settings['log_writes'] ?? false,
        'delete' => $settings['log_deletes'] ?? false,
        'update' => $settings['log_modifications'] ?? false,
        'auth' => $settings['log_auth'] ?? false,
    ];
    if (isset($allowed[$action]) && !$allowed[$action]) return;
    $logFile = $settings['log_file'] ?? 'logs/pcspecs.log';
    $entry = [
        'time' => gmdate('c'),
        'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
        'action' => $action,
        'details' => $details
    ];
    $line = json_encode($entry, JSON_UNESCAPED_UNICODE) . PHP_EOL;
    $dir = dirname($logFile);
    if (!is_dir($dir)) @mkdir($dir, 0750, true);
    @file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX);
}

// path to data file
$jsonFile = 'pcs.json';
if (!file_exists($jsonFile)) {
    file_put_contents($jsonFile, json_encode([]), LOCK_EX);
}

// authentication check
if (empty($_SESSION['authenticated'])) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

// CSRF check for mutating requests
if (in_array($method, ['POST', 'PUT', 'DELETE'])) {
    $csrfHeader = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
    if (empty($csrfHeader) || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $csrfHeader)) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'CSRF token missing or invalid']);
        exit;
    }
}

// rate-limit per-session
if (in_array($method, ['POST', 'PUT', 'DELETE'])) {
    $rl = intval($settings['rate_limit_ms'] ?? 250);
    if (!empty($_SESSION['last_write']) && (microtime(true) - $_SESSION['last_write']) < ($rl / 1000.0)) {
        http_response_code(429);
        echo json_encode(['status' => 'error', 'message' => 'Too many requests']);
        exit;
    }
}

switch ($method) {
    case 'GET':
        echo json_encode(readData());
        break;

    case 'POST':
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        if (stripos($contentType, 'application/json') === false) {
            http_response_code(415);
            echo json_encode(['status' => 'error', 'message' => 'Content-Type must be application/json']);
            exit;
        }
        $input = file_get_contents('php://input');
        $newPC = json_decode($input, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Invalid JSON']);
            exit;
        }
        if (!is_array($newPC) || empty(trim($newPC['cpu'] ?? ''))) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Invalid input']);
            exit;
        }
        $pc = [
            'cpu' => sanitize($newPC['cpu'], 128),
            'gpu' => sanitize($newPC['gpu'] ?? '', 128),
            'storage' => sanitize($newPC['storage'] ?? '', 64),
            'os' => sanitize($newPC['os'] ?? '', 64),
            'brand' => sanitize($newPC['brand'] ?? '', 128),
        ];
        $data = readData();
        $data[] = $pc;
        if (!file_put_contents($jsonFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX)) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Write failed']);
            exit;
        }
        $_SESSION['last_write'] = microtime(true);
        log_event('create', ['index' => count($data)-1, 'pc' => $pc]);
        echo json_encode(['status' => 'success', 'message' => 'PC ajouté']);
        break;

    case 'DELETE':
        $index = isset($_GET['index']) ? intval($_GET['index']) : null;
        if ($index === null || $index < 0) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Index non fourni']);
            exit;
        }
        $data = readData();
        if (!isset($data[$index])) {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'Index non trouvé']);
            exit;
        }
        $old = $data[$index];
        array_splice($data, $index, 1);
        if (!file_put_contents($jsonFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX)) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Write failed']);
            exit;
        }
        $_SESSION['last_write'] = microtime(true);
        log_event('delete', ['index' => $index, 'old' => $old]);
        echo json_encode(['status' => 'success', 'message' => 'PC supprimé']);
        break;

    case 'PUT':
        $index = isset($_GET['index']) ? intval($_GET['index']) : null;
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        if (stripos($contentType, 'application/json') === false) {
            http_response_code(415);
            echo json_encode(['status' => 'error', 'message' => 'Content-Type must be application/json']);
            exit;
        }
        $input = file_get_contents('php://input');
        $updatedPC = json_decode($input, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Invalid JSON']);
            exit;
        }
        if ($index === null || !is_array($updatedPC) || empty(trim($updatedPC['cpu'] ?? ''))) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Données invalides']);
            exit;
        }
        $data = readData();
        if (!isset($data[$index])) {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'Index non trouvé']);
            exit;
        }
        $old = $data[$index];
        $data[$index] = [
            'cpu' => sanitize($updatedPC['cpu'], 128),
            'gpu' => sanitize($updatedPC['gpu'] ?? '', 128),
            'storage' => sanitize($updatedPC['storage'] ?? '', 64),
            'os' => sanitize($updatedPC['os'] ?? '', 64),
            'brand' => sanitize($updatedPC['brand'] ?? '', 128),
        ];
        if (!file_put_contents($jsonFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX)) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Write failed']);
            exit;
        }
        $_SESSION['last_write'] = microtime(true);
        log_event('update', ['index' => $index, 'old' => $old, 'new' => $data[$index]]);
        echo json_encode(['status' => 'success', 'message' => 'PC modifié']);
        break;

    default:
        http_response_code(405);
        echo json_encode(['status' => 'error', 'message' => 'Méthode non autorisée']);
        break;
}

?>