# Système de Versioning de l'Interface Web

## 🎯 Objectif

Garantir que vous utilisez toujours la **bonne version** de l'interface web en affichant:
- Le **numéro de version** (v1.0.2-prod)
- Le **build timestamp** (20260117-154247)
- La **date de build** (17/01/2026 15:42)

## 📋 Affichage de la Version

### Dans l'Interface

1. **Header** (en haut): Version courte `v1.0.2-prod`
   - Survolez avec la souris pour voir le build timestamp complet

2. **Footer** (en bas): Version détaillée `NextPM Monitor v1.0.2-prod (build 20260117-154247)`
   - Survolez avec la souris pour voir la date de build complète

3. **Console du navigateur** (F12):
   ```
   NextPM Monitor
   Version: v1.0.2-prod (build 20260117-154247)
   Build Date: 17/01/2026 15:42:47
   Files: kernel.js, app.js, version.js
   ```

## 🔄 Mise à Jour de la Version

### Méthode Automatique (Recommandée)

Utilisez le script Python `update_version.py`:

```bash
# Mettre à jour seulement le build timestamp (changements mineurs)
python update_version.py

# Incrémenter la version patch (corrections de bugs)
python update_version.py patch
# Exemple: v1.0.1 → v1.0.2

# Incrémenter la version minor (nouvelles fonctionnalités)
python update_version.py minor
# Exemple: v1.0.2 → v1.1.0

# Incrémenter la version major (changements majeurs)
python update_version.py major
# Exemple: v1.1.0 → v2.0.0
```

**Résultat**: Le fichier `web/version.js` est automatiquement mis à jour avec:
- Le nouveau numéro de version
- Un nouveau build timestamp
- La date/heure actuelle

### Méthode Manuelle

Si vous préférez modifier manuellement:

1. Ouvrez `web/version.js`
2. Modifiez les valeurs:
   ```javascript
   const APP_VERSION = {
       major: 1,      // ← Modifier ici
       minor: 0,      // ← Modifier ici
       patch: 2,      // ← Modifier ici
       tag: 'prod',
       build: '20260117-154247',  // ← Format: YYYYMMDD-HHMMSS
       buildDate: new Date('2026-01-17T15:42:47Z'),  // ← ISO 8601
   ```
3. Sauvegardez le fichier

## ✅ Vérification de la Version

### Après Modification

1. **Rechargez la page avec cache vidé**:
   - Windows/Linux: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

2. **Vérifiez le footer**:
   - La version affichée doit correspondre à votre modification
   - Le build timestamp doit être récent

3. **Ouvrez la console** (F12):
   - Vérifiez le log de démarrage
   - Confirmez que les fichiers sont bien chargés

### Avant de Committer sur Git

Vérifiez que:
- ✅ Le `build` timestamp reflète la date/heure actuelle
- ✅ Le numéro de version est cohérent avec les changements
- ✅ Le fichier `version.js` est inclus dans le commit

## 🏷️ Convention de Versioning

### Format: `vMAJOR.MINOR.PATCH-TAG`

**MAJOR**: Changements incompatibles avec les versions précédentes
- Exemple: Refonte complète de l'interface, nouveau protocole

**MINOR**: Nouvelles fonctionnalités compatibles
- Exemple: Ajout d'un nouveau graphique, nouvelle commande

**PATCH**: Corrections de bugs
- Exemple: Fix BINS parsing, correction checksum display

**TAG**: Phase du projet
- `dev`: Développement
- `beta`: Tests
- `prod`: Production

### Exemples de Versioning

| Changement | Avant | Après | Commande |
|------------|-------|-------|----------|
| Fix bug BINS keys | v1.0.0 | v1.0.1 | `python update_version.py patch` |
| Ajout export CSV | v1.0.1 | v1.1.0 | `python update_version.py minor` |
| Nouvelle architecture | v1.1.0 | v2.0.0 | `python update_version.py major` |
| Changements CSS only | v1.0.1 | v1.0.1 | `python update_version.py` (build++) |

## 🔍 Troubleshooting

### La version ne change pas après rafraîchissement

**Problème**: Le navigateur cache l'ancien `version.js`

**Solution**:
1. Forcez le rechargement: `Ctrl + Shift + R`
2. Ou videz le cache complet:
   - Chrome: `Ctrl + Shift + Delete` → Cocher "Images et fichiers en cache"
   - Firefox: `Ctrl + Shift + Delete` → Cocher "Cache"

### Le build timestamp n'est pas à jour

**Problème**: Le script `update_version.py` n'a pas été exécuté

**Solution**:
1. Lancez `python update_version.py` avant de committer
2. Vérifiez que `web/version.js` est modifié dans `git status`

### La version affiche "undefined"

**Problème**: Le fichier `version.js` n'est pas chargé

**Solution**:
1. Vérifiez que `<script src="version.js"></script>` est dans `index.html`
2. Vérifiez que `version.js` est bien dans le dossier `web/`
3. Ouvrez la console (F12) pour voir les erreurs de chargement

### Les emojis ne s'affichent pas dans le terminal

**Problème**: Encodage Windows

**Solution**: Le script inclut déjà le fix UTF-8 pour Windows. Si le problème persiste:
```bash
chcp 65001  # Forcer UTF-8 dans le terminal
python update_version.py patch
```

## 📝 Workflow Recommandé

### Lors d'une Modification

1. **Faites vos modifications** (kernel.js, app.js, etc.)
2. **Testez l'interface** avec le hardware
3. **Mettez à jour la version**:
   ```bash
   python update_version.py patch  # ou minor/major
   ```
4. **Vérifiez dans le navigateur** (Ctrl+Shift+R)
5. **Committez sur Git**:
   ```bash
   git add web/version.js web/kernel.js web/app.js
   git commit -m "fix(web): Description du fix"
   git push
   ```

### Avant de Tester

1. **Vérifiez la version affichée** dans le footer
2. **Notez le build timestamp** pour référence
3. **Capturez des screenshots** avec la version visible
4. **Documentez les résultats** avec le numéro de version

## 🎓 Exemples d'Utilisation

### Scénario 1: Correction du Bug BINS

```bash
# 1. Fixer le code dans kernel.js et app.js
# 2. Mettre à jour la version
python update_version.py patch
# Output: v1.0.1 → v1.0.2 (build 20260117-154247)

# 3. Tester avec hardware
# 4. Committer
git add web/version.js web/kernel.js web/app.js
git commit -m "fix(web): Correct BINS parsing with RAW priority"
git push
```

### Scénario 2: Ajout Export CSV

```bash
# 1. Ajouter la fonctionnalité export CSV
# 2. Mettre à jour la version minor
python update_version.py minor
# Output: v1.0.2 → v1.1.0 (build 20260118-103045)

# 3. Tester
# 4. Committer
git add web/version.js web/app.js
git commit -m "feat(web): Add CSV export functionality"
git push
```

### Scénario 3: Changement CSS Uniquement

```bash
# 1. Modifier styles.css
# 2. Mettre à jour seulement le build (pas de changement de version)
python update_version.py
# Output: v1.1.0 (build 20260118-110512)

# 3. Committer
git add web/version.js web/styles.css
git commit -m "style(web): Improve button hover effects"
git push
```

## 📊 Historique des Versions

| Version | Build | Date | Description |
|---------|-------|------|-------------|
| v1.0.0 | 20260117-140000 | 2026-01-17 | Initial release |
| v1.0.1 | 20260117-150000 | 2026-01-17 | Fix BINS key format (underscore → dots) |
| v1.0.2 | 20260117-154247 | 2026-01-17 | Add versioning system with build timestamp |

---

**Note**: Ce système garantit que vous savez **toujours** quelle version de l'interface vous utilisez, même si les fichiers HTML n'ont pas de date de modification différente (problème de cache).
