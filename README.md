# 🖥️ PC Specs

[![PHP](https://img.shields.io/badge/php-7.2%2B-8892BF?style=flat-square)](https://www.php.net/)
[![Status](https://img.shields.io/badge/status-experimental-orange?style=flat-square)](#)
[![Maintained](https://img.shields.io/badge/maintained-yes-brightgreen?style=flat-square)](#)

Interface web minimaliste pour gérer une liste de configs PC — propulsée par **DetectAI**, un moteur client-side de correction et de normalisation des saisies.

---

## ✨ Fonctionnalités principales

- 📋 Interface CRUD pour lister, ajouter, modifier et supprimer des entrées
- 🔐 Authentification par mot de passe (session) + protection CSRF
- 💾 Stockage simple dans `pcs.json`
- ⚙️ Paramètres configurables via l'interface (`settings.json`) : logs, tentatives de connexion, fichier de log
- 🤖 **DetectAI** : reconnaissance intelligente des saisies, tolérante aux fautes

---

## 🤖 DetectAI — reconnaissance intelligente

DetectAI transforme les saisies approximatives en labels propres, prêts à afficher des icônes et des informations précises.

### Nouveautés — DetectAI encore plus intelligent

DetectAI est désormais plus intelligent que jamais : il corrige des fautes incroyablement bruitées, normalise automatiquement les capacités (SSD/HDD, TB/GB), détecte et normalise la RAM (ex. `16Go` → `16GB`) — la sortie conserve uniquement la capacité, et reconnaît des centaines de modèles CPU/GPU/marques. Il propose des corrections interactives (Appliquer / Garder / Éditer) avant sauvegarde et apprend localement pour s'améliorer avec votre catalogue. Résultat : des saisies approximatives deviennent immédiatement des labels propres, des icônes pertinentes et des recherches instantanées — c'est rapide, robuste et prêt pour une utilisation sérieuse.

- 🎯 Corrections orthographiques et phonétiques étendues (`nidia` → `NVIDIA`)
- 🧾 Normalisation avancée des unités et capacités (`1to` → `1TB`, `256go` → `256GB`)
- 🔋 Détection et normalisation de la RAM (`16Go` → `16GB`) — conserve uniquement la capacité
- 🛠️ Suggestions interactives UX (Appliquer / Garder / Éditer) pour plus de contrôle avant persistance
- 🧠 Base de candidats CPU/GPU/marques élargie pour une couverture bien supérieure des modèles
- ⚡ Performances en temps réel dans le navigateur et apprentissage local via `localStorage`

Essayez-le dans l'interface : saisissez une entrée approximative et constatez la transformation.

### Capacités

- ✅ Correction orthographique et phonétique (`micrrosoft` → `Microsoft`)
- ✅ Normalisation des marques et modèles (`gigbyte b550m` → `Gigabyte B550M`)
- ✅ Détection intelligente OS / GPU / CPU / stockage avec mapping automatique d'icônes
- ✅ Apprentissage local via `localStorage`
- ✅ Mode debug pour comprendre pourquoi une correction a été choisie

### Exemples rapides

| Saisie | Résultat |
|--------|----------|
| `gigbyte b550m` | `Gigabyte B550M` |
| `wdows 11` | `Windows 11` |
| `vidia rtx 3050` | `Nvidia RTX 3050` |
| `intl cor i5` | `Intel Core i5` |
| `nidia rtx 3070` | `NVIDIA RTX 3070` |
| `sds` | `SSD` |
| `ph` | `HP` |

### Utilisation (console navigateur)

```js
// Créer une instance
const d = new DetectAI();

// Tester une correction
d.correctBrandModel('gigbyte b550m'); // → "Gigabyte B550M"

// Lancer un jeu d'exemples
window.__DetectAI_Corrections.runSamples(30);
```

---

## 🚀 Installation

### Prérequis

- PHP 7.2+ (7.4+ recommandé)
- Navigateur moderne (Chrome / Firefox / Edge)

### Étapes

1. Copier le dépôt dans un dossier accessible par PHP.

2. Créer un fichier `pass.env` à la racine :
   ```
   password=ChangeMe
   ```

3. *(Optionnel)* Ajuster `settings.json` pour activer les logs ou la protection par tentatives.

4. Lancer le serveur de développement :
   ```bash
   php -S 0.0.0.0:8000
   ```

5. Ouvrir `http://localhost:8000/index.php` et se connecter.

---

## 📁 Structure des fichiers

| Fichier | Rôle |
|---------|------|
| `index.php` | Interface principale et point d'entrée |
| `api.php` | API CRUD (GET / POST / PUT / DELETE) |
| `settings.php` | Lecture/écriture des paramètres |
| `detectai.js` | Moteur DetectAI (correction client-side) |
| `script.js` | UI + intégration DetectAI |
| `pcs.json` | Stockage des données |
| `pass.env` | Mot de passe / hash |
| `settings.json` | Paramètres persistants |
| `icons/` | Icônes utilisées pour l'aperçu |

---

## 🔌 API

`api.php` est le point d'accès principal :

- `GET` → liste les entrées
- `POST` → crée une entrée
- `PUT` → modifie une entrée
- `DELETE` → supprime une entrée

> ⚠️ Les requêtes mutatives attendent l'en-tête `X-CSRF-Token` (token injecté dans la page via une balise `<meta>`).

---

## 🔒 Sécurité & recommandations

- Toujours servir via **HTTPS** en production
- Déplacer `pass.env`, `pcs.json` et `settings.json` **hors du répertoire web** si possible
- Utiliser `password_hash()` + `password_verify()` pour stocker le mot de passe
- Limiter l'accès réseau si l'application est exposée publiquement

---

## 🛠️ Dépannage

| Problème | Solution |
|----------|----------|
| API 401 | Session expirée — reconnectez-vous et vérifiez la présence de la meta `csrf-token` |

---

## ⚙️ Améliorer DetectAI

- Ajouter des mappings de fautes dans `detectai.js` (`typoMap`)
- Pour des déploiements sérieux, migrer les corrections et logs vers Redis / MySQL plutôt que `localStorage`

---

## ⚠️ Limitations

- Stockage fichier uniquement → **pas conçu pour une forte concurrence**
- Pas de chiffrement des backups intégré

---

## **Changelog**

Voir le fichier `CHANGELOG.md` pour le snapshot de la journée (2026-03-31).
