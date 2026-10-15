# Quiet Dashboard

A simple dark personal dashboard with a greeting for Daniel, a Bible verse that changes with the time of day, editable Google Tasks, and a monthly view combining selected Google calendars.

## Run locally

1. Extract this entire folder somewhere permanent.
2. Install Node.js 24 or newer from https://nodejs.org/ (include its PATH option).
3. Open a terminal in the extracted quiet-dashboard folder.
4. Run `npm start` (or `node dashboard-server.mjs`).
5. Open http://localhost:4173/ in Chrome or Edge. Keep the terminal open; press Ctrl+C to stop.

No package installation or build is required. There are no third-party npm dependencies. Google sign-in and Google API access require an internet connection. Open the HTTP address rather than double-clicking the HTML file.

This is the Windows version. Persistent Google sign-in uses Windows PowerShell and Windows Data Protection API (DPAPI). The local server binds only to 127.0.0.1 on port 4173. If the port is already occupied, it exits; stop the other dashboard instance first when testing this copy.

## Connect your own Google account

No credentials or saved Google sessions are included.

1. In Google Cloud Console, create/select your project and enable Google Calendar API and Google Tasks API.
2. Configure Google Auth Platform Branding and Audience. If using Testing, add your Google email as a test user.
3. Under Data Access, configure these scopes:
   - https://www.googleapis.com/auth/calendar.readonly
   - https://www.googleapis.com/auth/tasks
4. Create an OAuth client of type Web application.
5. Add http://localhost:4173 under Authorized JavaScript origins.
6. Add http://localhost:4173/oauth/google/callback under Authorized redirect URIs.
7. Open dashboard Settings. For a short-lived connection, enter the client ID and save, then Connect Google.
8. To stay connected, download that OAuth Web client's credentials JSON and import it under Settings > Stay connected. Close Settings, then Connect Google and approve access once.

Keep the client secret private. Credentials and the refresh token are encrypted under runtime/google-vault.dpapi for the current Windows user. This folder is created only after setup. It is excluded by .gitignore and must never be shared, even though encrypted. Access tokens stay in memory. Do not copy the vault between accounts/computers. Clearing browser cookies requires signing in again. Disconnect clears the saved session and attempts to revoke Google access.

Google refresh tokens for external apps in Testing generally expire after seven days. Google revocation or account policy may also require reconnecting. See https://developers.google.com/identity/protocols/oauth2#expiration.

## Features and editing

- quiet-dashboard.html contains the complete editable HTML, CSS, and client JavaScript, including inline visual assets. Edit it directly and refresh the browser.
- dashboard-server.mjs serves the page and delegates local OAuth endpoints.
- google-offline.mjs implements offline OAuth, automatic access renewal, browser session cookies, and Windows encryption. Restart the server after editing this file or the server file.
- package.json and package-lock.json describe the Node runtime and scripts; there are no external npm packages.
- scripts/check-page.mjs checks the inline client script syntax.
- Start-Quiet.vbs is an optional portable Windows launcher that runs the server without a terminal window.

The greeting and Bible verses use local browser time: morning begins at 5 AM, afternoon at noon, and evening at 6 PM. Edit the encouragements array and greetingTime function to customize them. Verse selections are stored locally per time period.

Tasks support adding, editing, completing, reopening, deleting, notes, and due dates. Changes are sent to Google; use the same Google account on phone/tablet for synchronization. Automatic reads run while the dashboard is open and connected, including on a new day and when returning to the page. No background task runs when the page is closed, apart from Google access renewal when the dashboard is used again.

Calendar choices are at the bottom, collapsed by default. Selected calendars remain active while the list is hidden. The main calendar and an accessible calendar named danieline are selected initially; change this behavior in loadCalendars. Calendar choices are not saved across a fresh page session.

## Assets and external services

There are no separate local image, font, or media assets. Styling and decorative marks are inline; fonts use the operating system's font stack. Google Identity Services loads from https://accounts.google.com/gsi/client; requests go to Google's OAuth, Calendar, and Tasks endpoints. Those remote services are not bundled.

## Optional Windows startup

After installing Node and confirming npm start works, double-click Start-Quiet.vbs to start quietly. To start at Windows sign-in:

1. Right-click Start-Quiet.vbs and create a shortcut.
2. Press Win+R, enter shell:startup, and press Enter.
3. Put the shortcut in that folder. Keep its target pointing to the permanent extracted folder; do not copy the VBS alone.

Remove that shortcut to disable automatic startup. Only one instance should listen on port 4173. In Chrome, set Settings > On startup > Open a specific page to http://localhost:4173/.

## Check the source

Run npm run check. It checks server/module syntax and inline client JavaScript; it does not authorize Google or modify your real tasks. Live account features require your own OAuth setup.

## Package contents and exclusions

This archive contains the final editable implementation, a portable launcher, runtime/dependency metadata, and these instructions. It excludes OAuth credentials, encrypted vaults, cookies, saved sessions, downloaded user data, node_modules, Git history, deployment credentials, and intermediate generation scripts.
