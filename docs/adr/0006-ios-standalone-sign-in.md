# iOS standalone sign-in keeps a redirect return path

Google sign-in uses a same-window redirect, never a popup. The OAuth callback returns to `/onboarding` on the app's own origin. That route is the first-run destination: it sends an account that has finished onboarding to Today, and a new account through the three setup steps before landing on Today. Keeping one return path means the installed app lands inside itself when iOS keeps the flow in the standalone web app.

**Fallback:** if iOS hands the flow to Safari, the browser completes at `/onboarding`, which forwards a completed account to Today. The user can reopen the installed app from the home screen. Safari and a home-screen web app may keep separate cookies, so if the installed app still shows the sign-in screen, the user signs in once more there. Keep sign-in a full-page redirect; do not add a popup or an embedded webview flow.
