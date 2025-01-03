<?php
session_start();
if (!is_readable('pass.env')) {
    die('Unable to read pass.env file.');
}
$env = parse_ini_file('pass.env');
if ($env === false) {
    die('Error parsing pass.env file.');
}
$password = $env["password"];
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
    if ($_POST['password'] !== $password) {
        echo '<h1>Mot de passe incorrect !</h1>';
        exit;
    }
    $_SESSION['authenticated'] = true;
    header('Location: ' . $_SERVER['PHP_SELF']);
    exit;
}

if (!isset($_SESSION['authenticated'])) {
    echo '<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Connexion</title>
        <link rel="stylesheet" href="style.css">
    </head>
    <body>
        <div id="login-container">
            <h1>Connexion</h1>
            <form method="post">
                <label for="password">Mot de passe :</label><br>
                <input type="password" id="password" name="password" required><br>
                <button type="submit">Se connecter</button>
            </form>
        </div>
    </body>
    </html>';
    exit;
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PC Specs Database</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>PC SPECS</h1>
    <div id="actions">
        <button onclick="createNewPC()">Créer nouveau</button>
        <button onclick="deletePC()">Supprimer</button>
        <button onclick="modifyPC()">Modifier</button>
        <button onclick="logout()">Se déconnecter</button>
    </div>
    <table>
        <thead>
            <tr>
                <th>Index</th>
                <th>CPU</th>
                <th>GPU</th>
                <th>STORAGE</th>
                <th>OS</th>
                <th>BRAND</th>
            </tr>
        </thead>
        <tbody id="pc-table">
        </tbody>
    </table>
    <script src="script.js"></script>
</body>
</html>
