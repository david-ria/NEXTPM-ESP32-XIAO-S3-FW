/**
 * Version Information
 * Build timestamp: 2026-01-17 15:42:47 UTC
 *
 * This file is auto-generated on each build.
 * To update the version, run: python update_version.py [major|minor|patch]
 */

const APP_VERSION = {
    major: 1,
    minor: 0,
    patch: 2,
    tag: 'prod',
    build: '20260117-154247',
    buildDate: new Date('2026-01-17T15:42:47Z'),

    // Full version string
    get full() {
        return `v${this.major}.${this.minor}.${this.patch}-${this.tag}`;
    },

    // Version with build timestamp
    get detailed() {
        return `v${this.major}.${this.minor}.${this.patch}-${this.tag} (build ${this.build})`;
    },

    // Human readable
    get display() {
        const date = this.buildDate.toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        return `${this.full} - ${date}`;
    }
};

// Update version display on page load
document.addEventListener('DOMContentLoaded', () => {
    // Update header version
    const headerVersion = document.getElementById('app-version');
    if (headerVersion) {
        headerVersion.textContent = APP_VERSION.full;
        headerVersion.title = `Build: ${APP_VERSION.build}\nDate: ${APP_VERSION.buildDate.toLocaleString('fr-FR')}`;
    }

    // Update footer version
    const footerVersion = document.getElementById('app-version-footer');
    if (footerVersion) {
        footerVersion.textContent = `NextPM Monitor ${APP_VERSION.detailed}`;
        footerVersion.title = `Build date: ${APP_VERSION.buildDate.toLocaleString('fr-FR')}`;
    }

    // Log version to console
    console.log('%c NextPM Monitor ', 'background: #2196F3; color: white; font-weight: bold; padding: 5px 10px;');
    console.log(`Version: ${APP_VERSION.detailed}`);
    console.log(`Build Date: ${APP_VERSION.buildDate.toLocaleString('fr-FR')}`);
    console.log(`Files: kernel.js, app.js, version.js`);
});

// Export for use in other scripts
window.APP_VERSION = APP_VERSION;
