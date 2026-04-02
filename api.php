<?php
session_start();

// Minimal security headers for API responses
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');

// simple CSP for API responses only (page content is unaffected)
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

function sanitize($s, $max = 200) {
    $s = strip_tags((string)$s);
    $s = preg_replace('/[\x00-\x1F\x7F]/u', '', $s);
    $s = trim($s);
    if (mb_strlen($s) > $max) $s = mb_substr($s, 0, $max);
    return $s;
}

// SQLite: data storage
$jsonFile = 'pcs.json';
$dbFile = 'data/pcspecs.sqlite';
try {
    if (!is_dir(dirname($dbFile))) @mkdir(dirname($dbFile), 0750, true);
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("CREATE TABLE IF NOT EXISTS pcs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cpu TEXT,
        gpu TEXT,
        storage TEXT,
        ram TEXT,
        os TEXT,
        brand TEXT,
        created_at INTEGER
    )");
    // migrate from pcs.json if table empty
    $count = (int)$pdo->query('SELECT COUNT(*) FROM pcs')->fetchColumn();
    if ($count === 0 && file_exists($jsonFile)) {
        $cont = @file_get_contents($jsonFile);
        $arr = json_decode($cont, true);
        if (is_array($arr) && count($arr) > 0) {
            $ins = $pdo->prepare('INSERT INTO pcs (cpu,gpu,storage,ram,os,brand,created_at) VALUES (?,?,?,?,?,?,?)');
            $pdo->beginTransaction();
            foreach ($arr as $r) {
                $ins->execute([
                    isset($r['cpu']) ? $r['cpu'] : '',
                    isset($r['gpu']) ? $r['gpu'] : '',
                    isset($r['storage']) ? $r['storage'] : '',
                    isset($r['ram']) ? $r['ram'] : '',
                    isset($r['os']) ? $r['os'] : '',
                    isset($r['brand']) ? $r['brand'] : '',
                    time()
                ]);
            }
            $pdo->commit();
        }
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to open database']);
    exit;
}

function readData() {
    global $pdo;
    $stmt = $pdo->query('SELECT id,cpu,gpu,storage,ram,os,brand FROM pcs ORDER BY id');
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    return $rows ?: [];
}

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

// require authenticated session for API
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
        // get by id
        if (isset($_GET['id'])) {
            $id = intval($_GET['id']);
            $stmt = $pdo->prepare('SELECT id,cpu,gpu,storage,ram,os,brand FROM pcs WHERE id = ? LIMIT 1');
            $stmt->execute([$id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) { http_response_code(404); echo json_encode(['status'=>'error','message'=>'Not found']); exit; }
            echo json_encode($row);
            break;
        }
        // get by array index (legacy client uses indexes)
        if (isset($_GET['index'])) {
            $index = max(0, intval($_GET['index']));
            $stmt = $pdo->prepare('SELECT id,cpu,gpu,storage,ram,os,brand FROM pcs ORDER BY id LIMIT 1 OFFSET ?');
            $stmt->bindValue(1, $index, PDO::PARAM_INT);
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) { http_response_code(404); echo json_encode(['status'=>'error','message'=>'Index not found']); exit; }
            echo json_encode($row);
            break;
        }
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
            'ram' => sanitize($newPC['ram'] ?? '', 64),
            'os' => sanitize($newPC['os'] ?? '', 64),
            'brand' => sanitize($newPC['brand'] ?? '', 128),
        ];
        try {
            $stmt = $pdo->prepare('INSERT INTO pcs (cpu,gpu,storage,ram,os,brand,created_at) VALUES (?,?,?,?,?,?,?)');
            $stmt->execute([$pc['cpu'],$pc['gpu'],$pc['storage'],$pc['ram'],$pc['os'],$pc['brand'], time()]);
            $last = (int)$pdo->lastInsertId();
            $_SESSION['last_write'] = microtime(true);
            log_event('create', ['id' => $last, 'pc' => $pc]);
            echo json_encode(['status' => 'success', 'message' => 'PC ajouté', 'id' => $last]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Write failed']);
            exit;
        }
        break;

    case 'DELETE':
        $index = isset($_GET['index']) ? intval($_GET['index']) : null;
        if ($index === null || $index < 0) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Index non fourni']);
            exit;
        }
        $map = $pdo->prepare('SELECT id FROM pcs ORDER BY id LIMIT 1 OFFSET ?');
        $map->bindValue(1, $index, PDO::PARAM_INT);
        $map->execute();
        $row = $map->fetch(PDO::FETCH_ASSOC);
        if (!$row) { http_response_code(404); echo json_encode(['status'=>'error','message'=>'Index non trouvé']); exit; }
        $id = (int)$row['id'];
        $oldStmt = $pdo->prepare('SELECT id,cpu,gpu,storage,ram,os,brand FROM pcs WHERE id = ?');
        $oldStmt->execute([$id]);
        $old = $oldStmt->fetch(PDO::FETCH_ASSOC);
        try {
            $del = $pdo->prepare('DELETE FROM pcs WHERE id = ?');
            $del->execute([$id]);
            $_SESSION['last_write'] = microtime(true);
            log_event('delete', ['id' => $id, 'old' => $old]);
            echo json_encode(['status' => 'success', 'message' => 'PC supprimé']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Write failed']);
            exit;
        }
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
        $map = $pdo->prepare('SELECT id FROM pcs ORDER BY id LIMIT 1 OFFSET ?');
        $map->bindValue(1, $index, PDO::PARAM_INT);
        $map->execute();
        $row = $map->fetch(PDO::FETCH_ASSOC);
        if (!$row) { http_response_code(404); echo json_encode(['status'=>'error','message'=>'Index non trouvé']); exit; }
        $id = (int)$row['id'];
        $oldStmt = $pdo->prepare('SELECT id,cpu,gpu,storage,ram,os,brand FROM pcs WHERE id = ?');
        $oldStmt->execute([$id]);
        $old = $oldStmt->fetch(PDO::FETCH_ASSOC);
        $newRow = [
            'cpu' => sanitize($updatedPC['cpu'], 128),
            'gpu' => sanitize($updatedPC['gpu'] ?? '', 128),
            'storage' => sanitize($updatedPC['storage'] ?? '', 64),
            'ram' => sanitize($updatedPC['ram'] ?? '', 64),
            'os' => sanitize($updatedPC['os'] ?? '', 64),
            'brand' => sanitize($updatedPC['brand'] ?? '', 128),
        ];
        try {
            $upd = $pdo->prepare('UPDATE pcs SET cpu=?,gpu=?,storage=?,ram=?,os=?,brand=? WHERE id=?');
            $upd->execute([$newRow['cpu'],$newRow['gpu'],$newRow['storage'],$newRow['ram'],$newRow['os'],$newRow['brand'],$id]);
            $_SESSION['last_write'] = microtime(true);
            log_event('update', ['id' => $id, 'old' => $old, 'new' => $newRow]);
            echo json_encode(['status' => 'success', 'message' => 'PC modifié']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Write failed']);
            exit;
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(['status' => 'error', 'message' => 'Méthode non autorisée']);
        break;
}

?>
