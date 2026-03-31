# PC SPECS

[![PHP](https://img.shields.io/badge/php-7.2%2B-8892BF?style=flat-square)](https://www.php.net/) [![Status](https://img.shields.io/badge/status-experimental-orange?style=flat-square)](#) [![Maintained](https://img.shields.io/badge/maintained-yes-brightgreen?style=flat-square)](#)

Une petite application web (PHP + JavaScript) pour inventorier des machines et sauvegarder leurs spécifications dans `pcs.json`.

Principales caractéristiques
- Interface web minimaliste pour lister/ajouter/modifier/supprimer des entrées
- Authentification par mot de passe (session) et protection CSRF pour les opérations mutatives
- Sauvegarde simple dans `pcs.json` (fichier JSON)
- Paramètres configurables via l'interface (`settings.json`) : logs, tentatives de connexion, fichier de log

Prérequis
- PHP 7.2+ (PHP 7.4+ recommandé)
- Navigateur moderne pour l'interface (Chrome / Firefox / Edge)

Installation & exécution locale
1. Copier le dépôt dans un dossier accessible par PHP.
2. Créer un fichier `pass.env` à la racine (exemple) :

```
password=ChangeMe

```

3. (Optionnel) Ajuster `settings.json` pour activer les logs ou la protection des tentatives de connexion.

4. Lancer le serveur de développement PHP :

```
php -S 0.0.0.0:8000
```

5. Ouvrir `http://localhost:8000/index.php` et vous connecter.

Configuration importante
- `pass.env` : mot de passe ou `password_hash` pour utiliser `password_verify()`.
- `settings.json` : options (voir interface Paramètres). Par défaut, les logs et la protection par tentatives sont désactivés.

API (résumé)
- `api.php` : point d'accès principal (GET pour lister, POST pour créer, PUT pour modifier, DELETE pour supprimer). Les requêtes mutatives attendent l'en‑tête `X-CSRF-Token` (token injecté dans la page HTML via une meta).
- `settings.php` : lecture/écriture des paramètres (auth + CSRF requis).

Fichiers importants
- `index.php` : interface et point d'entrée
- `api.php` : API CRUD
- `settings.php` : gestion des paramètres
- `pcs.json` : stockage des données
- `pass.env` : mot de passe / hash
- `settings.json` : paramètres persistants
- `icons/` : images utilisées pour l'aperçu

Sécurité & recommandations
- Toujours servir via HTTPS en production.
- Déplacer `pass.env`, `pcs.json` et `settings.json` hors du répertoire web si possible.
- Utiliser `password_hash()` + `password_verify()` pour stocker le mot de passe.
- Limiter l'accès réseau au serveur si l'application est exposée publiquement.

Dépannage rapide
- API 401 : reconnectez-vous (session expirée) et vérifiez la présence de la meta `csrf-token` dans le HTML.

Limitations
- Stockage fichier (pas de base de données) → pas conçu pour une forte concurrence.
- Pas de chiffrement des backups intégrés.
