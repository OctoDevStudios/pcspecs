# Changelog

Toutes les modifications notables pour la « version finale du jour ».

## 2026-03-31 — Version finale du jour

- UI : ajout d'une modal de confirmation des corrections lors de la création/modification d'un PC (Propositions: Appliquer / Garder / Éditer).
- DetectAI : améliorations de la normalisation
  - Normalisation des stockages (ex. `ssd 1to` → `SSD 1TB`, `256go` → `256GB`).
  - Détection et normalisation de la RAM (ex. `16Go DDR4` → `16GB DDR4`).
  - Listes étendues pour CPU, GPU, marques et systèmes d'exploitation (meilleure détection fuzzy).
- Frontend : ajout du champ `ram` dans le formulaire et la table, + aperçu icônes/texte en direct.
- Backend : `api.php` accepte désormais le champ `ram` pour POST/PUT et le persiste dans `pcs.json`.
- Assets : nouvelles icônes ajoutées (png) : `pentium.png`, `ram.png`, `ryzen5.png`, `ryzen7.png`, `ryzen9.png`, `xeon.png`.
- Images : helper JS `setImgWithFallback()` pour tenter le SVG puis revenir au PNG si nécessaire.
