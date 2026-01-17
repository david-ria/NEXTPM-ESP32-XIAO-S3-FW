#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script pour mettre à jour la version de l'interface web
Usage: python update_version.py [major|minor|patch]

Si aucun argument n'est fourni, seul le build timestamp est mis à jour.
"""

import sys
import re
from datetime import datetime, timezone

VERSION_FILE = 'web/version.js'

def read_current_version():
    """Lit la version actuelle depuis version.js"""
    with open(VERSION_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    major = int(re.search(r'major:\s*(\d+)', content).group(1))
    minor = int(re.search(r'minor:\s*(\d+)', content).group(1))
    patch = int(re.search(r'patch:\s*(\d+)', content).group(1))
    tag = re.search(r"tag:\s*'([^']+)'", content).group(1)

    return major, minor, patch, tag

def update_version(increment=None):
    """Met à jour la version et le build timestamp"""
    major, minor, patch, tag = read_current_version()

    # Incrémenter si demandé
    if increment == 'major':
        major += 1
        minor = 0
        patch = 0
        print(f"✅ Version majeure incrémentée: v{major}.{minor}.{patch}")
    elif increment == 'minor':
        minor += 1
        patch = 0
        print(f"✅ Version mineure incrémentée: v{major}.{minor}.{patch}")
    elif increment == 'patch':
        patch += 1
        print(f"✅ Version patch incrémentée: v{major}.{minor}.{patch}")
    else:
        print(f"ℹ️  Version inchangée: v{major}.{minor}.{patch}")

    # Nouveau build timestamp
    now = datetime.now(timezone.utc)
    build = now.strftime('%Y%m%d-%H%M%S')
    iso_date = now.strftime('%Y-%m-%dT%H:%M:%SZ')

    print(f"🕒 Nouveau build: {build}")
    print(f"📅 Date: {now.strftime('%Y-%m-%d %H:%M:%S UTC')}")

    # Générer le nouveau contenu
    content = f"""/**
 * Version Information
 * Build timestamp: {now.strftime('%Y-%m-%d %H:%M:%S UTC')}
 *
 * This file is auto-generated on each build.
 * To update the version, run: python update_version.py [major|minor|patch]
 */

const APP_VERSION = {{
    major: {major},
    minor: {minor},
    patch: {patch},
    tag: '{tag}',
    build: '{build}',
    buildDate: new Date('{iso_date}'),

    // Full version string
    get full() {{
        return `v${{this.major}}.${{this.minor}}.${{this.patch}}-${{this.tag}}`;
    }},

    // Version with build timestamp
    get detailed() {{
        return `v${{this.major}}.${{this.minor}}.${{this.patch}}-${{this.tag}} (build ${{this.build}})`;
    }},

    // Human readable
    get display() {{
        const date = this.buildDate.toLocaleDateString('fr-FR', {{
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }});
        return `${{this.full}} - ${{date}}`;
    }}
}};

// Update version display on page load
document.addEventListener('DOMContentLoaded', () => {{
    // Update header version
    const headerVersion = document.getElementById('app-version');
    if (headerVersion) {{
        headerVersion.textContent = APP_VERSION.full;
        headerVersion.title = `Build: ${{APP_VERSION.build}}\\nDate: ${{APP_VERSION.buildDate.toLocaleString('fr-FR')}}`;
    }}

    // Update footer version
    const footerVersion = document.getElementById('app-version-footer');
    if (footerVersion) {{
        footerVersion.textContent = `NextPM Monitor ${{APP_VERSION.detailed}}`;
        footerVersion.title = `Build date: ${{APP_VERSION.buildDate.toLocaleString('fr-FR')}}`;
    }}

    // Log version to console
    console.log('%c NextPM Monitor ', 'background: #2196F3; color: white; font-weight: bold; padding: 5px 10px;');
    console.log(`Version: ${{APP_VERSION.detailed}}`);
    console.log(`Build Date: ${{APP_VERSION.buildDate.toLocaleString('fr-FR')}}`);
    console.log(`Files: kernel.js, app.js, version.js`);
}});

// Export for use in other scripts
window.APP_VERSION = APP_VERSION;
"""

    # Écrire le fichier
    with open(VERSION_FILE, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"\n✅ Fichier mis à jour: {VERSION_FILE}")
    print(f"📦 Version complète: v{major}.{minor}.{patch}-{tag} (build {build})")
    print(f"\n💡 Rechargez la page web (Ctrl+Shift+R) pour voir la nouvelle version")

if __name__ == '__main__':
    # Windows UTF-8 fix
    if sys.platform == 'win32':
        import codecs
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

    increment = sys.argv[1] if len(sys.argv) > 1 else None

    if increment and increment not in ['major', 'minor', 'patch']:
        print("❌ Argument invalide. Utilisez: major, minor ou patch")
        sys.exit(1)

    print("🔧 Mise à jour de la version de l'interface web...")
    print("="*60)

    update_version(increment)
