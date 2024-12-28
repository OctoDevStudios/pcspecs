<?php
header('Content-Type: application/json');

// chemin du fichier json 
$jsonFile = 'pcs.json';

// verif si le fichier existe car sinon il sera crée
if (!file_exists($jsonFile)) {
 file_put_contents($jsonFile, json_encode([]));
}

// fonction pour lire le fichier
function readData() {
    global $jsonFile;
    return json_decode(file_get_contents($jsonFile), true);
}

// fonjction pour ecrire les donnes 
function writeData($data) {
    global $jsonFile;
    file_put_contents($jsonFile, json_encode($data, JSON_PRETTY_PRINT));
}

// gestion des requetes
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // lis et retourne les donnes
    echo json_encode(readData());
} elseif ($method === 'POST') {
    // ajoute un nouv pc
    $newPC = json_decode(file_get_contents('php://input'), true);
    $data = readData();
    $data[] = $newPC;
    writeData($data);
    echo json_encode(["status" => "success", "message" => "PC ajouté"]);
} elseif ($method === 'DELETE') {
    // supprime un pc
    $index = $_GET['index'] ?? null;
    if ($index === null) {
        echo json_encode(["status" => "error", "message" => "Index non fourni"]);
        exit;
    }
    $data = readData();
    array_splice($data, $index, 1);
    writeData($data);
    echo json_encode(["status" => "success", "message" => "PC supprimé"]);
} elseif ($method === 'PUT') {
    // modifier un pc
    $index = $_GET['index'] ?? null;
    $updatedPC = json_decode(file_get_contents('php://input'), true);
    if ($index === null || !$updatedPC) {
        echo json_encode(["status" => "error", "message" => "Données invalides"]);
        exit;
    }
    $data = readData();
    $data[$index] = $updatedPC;
    writeData($data);
    echo json_encode(["status" => "success", "message" => "PC modifié"]);
}
?>