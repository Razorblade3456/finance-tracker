# Fixing Google OAuth "redirect_uri_mismatch" on Netlify

When you deploy Finance Tracker on Netlify, Google rejects sign-in attempts if the redirect URL coming from your app does not exactly match what is registered in the Google Cloud Console. The error message you saw (**Error 400: redirect_uri_mismatch**) is Google’s way of telling you that it does not recognize the Netlify URL trying to finish the sign-in flow.

Below is a simple checklist you can follow using your live site at **https://moneyflowshigh.netlify.app**.

Follow the steps below to resolve this:

## 1. Verify the URL Netlify Uses for Your Site
1. Open `https://moneyflowshigh.netlify.app` in your browser and copy the full address. This is the base URL Google must trust.
2. If you connected a custom domain (for example, `https://finance.example.com`), copy that full address too. You will add every domain you use to Google in a later step.

## 2. Locate the OAuth Redirect Path in Finance Tracker
1. In the Finance Tracker project, the Google sign-in flow redirects back to a path such as `/auth/google/callback` (this path must match whatever your frontend or backend uses when handling Google sign-in).
2. Combine the Netlify base URL from step 1 with this path to build the exact redirect URL. For your deployment, that will normally be `https://moneyflowshigh.netlify.app/auth/google/callback`. If you have a custom domain, repeat the same pattern with that domain.

## 3. Update Google Cloud Console OAuth Settings
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Select the project that owns your OAuth client ID for Finance Tracker.
3. Navigate to **APIs & Services → Credentials**.
4. Click your **OAuth 2.0 Client ID** (usually of type "Web application").
5. In the **Authorized JavaScript origins** section, add the base URLs you noted (for example, `https://moneyflowshigh.netlify.app` and any custom domains).
6. In the **Authorized redirect URIs** section, add the full redirect URL(s) you built in step 2 (for example, `https://moneyflowshigh.netlify.app/auth/google/callback`). Add each custom-domain version as well.
7. Click **Save**.

## 4. Redeploy or Clear Cache if Needed
1. If you changed any environment variables or OAuth client IDs used by Netlify, trigger a rebuild/deploy of your site so the new settings take effect.
2. After redeploying, open your Netlify site in an incognito/private window and try signing in with Google again.

## 5. Confirm No Extra Redirects Are Added
* Ensure that Netlify redirects or rewrites (in `netlify.toml` or dashboard settings) do not change the `/auth/google/callback` path.
* If you use environment-specific URLs (like preview deploys), remember to add those URLs to the Google Console as well.

## 6. (Optional) Use Netlify OAuth App Section If Needed
The **Applications → OAuth** section inside Netlify is not required for Google sign-in. It is only for connecting Netlify to other services. You can leave it untouched unless you need Netlify to talk to another API on your behalf.

After these steps, Google should accept the redirect from your Netlify deployment, and the sign-in flow will complete without the mismatch error.
