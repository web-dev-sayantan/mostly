# iOS standalone sign-in keeps a redirect return path

Google sign-in uses a same-window redirect, never a popup. The OAuth callback returns to `/today` on the app's own origin, so the installed app lands back on Today when iOS keeps the flow inside the standalone web app.

**Fallback:** if iOS hands the flow to Safari, the browser completes at `/today`; the user can reopen the installed app from the home screen. Safari and a home-screen web app may keep separate cookies, so if the installed app still shows the sign-in screen, the user signs in once more there. Keep sign-in a full-page redirect; do not add a popup or an embedded webview flow.
