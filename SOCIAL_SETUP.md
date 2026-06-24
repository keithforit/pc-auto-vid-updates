# Connecting TikTok & Instagram for direct posting

The result screen ("Your video is ready") can post a finished render straight to TikTok or Instagram once you connect an account in **Settings → Connect accounts**. Direct posting uses each platform's official API, which means **you must register your own developer app** on each platform and paste its keys into Settings. Nothing here is pre-configured — the app stores your keys/tokens locally in `SocialConnections.json` (gitignored, never uploaded).

Open **Settings → Connect accounts** first — it shows the exact **Redirect URI** you need to register (it's based on the port the app is running on, e.g. `http://localhost:3000/oauth/tiktok/callback`).

---

## TikTok

1. Go to <https://developers.tiktok.com/> → **Manage apps** → create an app.
2. Add the **Login Kit** and **Content Posting API** products.
3. Under **Login Kit**, add the Redirect URI shown in Settings (e.g. `http://localhost:3000/oauth/tiktok/callback`).
4. Request the scopes: `user.info.basic`, `video.upload`, `video.publish`.
5. Copy the app's **Client key** and **Client secret** into Settings → TikTok, click **Save keys**, then **Connect** and approve in the popup.

**Important — audit requirement:** until TikTok **audits/approves** your app for direct posting, the API only allows posting to your *own* account with **private** visibility (`SELF_ONLY`). So a connected-but-unaudited app will upload the video as a private draft; open the TikTok app to review and make it public. Once TikTok approves your app, public posting works without code changes.

---

## Instagram

Instagram is more involved, and has a hard requirement that a localhost tool can't satisfy on its own (see step 5).

1. Go to <https://developers.facebook.com/> → create an app (type **Business**).
2. Add the **Instagram Graph API** and **Facebook Login** products.
3. Under Facebook Login → Settings, add the Redirect URI shown in Settings (e.g. `http://localhost:3000/oauth/instagram/callback`).
4. Your Instagram account must be a **Business or Creator** account, **linked to a Facebook Page** you admin. (Personal IG accounts can't use the publishing API.)
5. **Public video URL** — Instagram's publishing API does **not** accept a file upload; it fetches the video from a **public URL**. A localhost path won't work. You must host the rendered file somewhere public and tell the app where, via the **"Public video URL base"** field (e.g. `https://your-bucket.example.com`). The app will point Instagram at `<base>/renders/<filename>.mp4`, so your renders need to be reachable there.
6. Permissions used: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `business_management`. For your own account these work in the app's **Development** mode; posting on behalf of others needs Meta **App Review**.
7. Copy the **App ID** and **App secret** into Settings → Instagram, set the public URL base, **Save keys**, then **Connect**.

---

## Using it

After connecting, the result screen's **TikTok / Instagram** buttons change to **"Post to TikTok" / "Post to Instagram"** and a caption box appears. Click to upload directly; you'll get a confirmation (or a clear error). If an account isn't connected, the button falls back to opening that platform's upload page so you can post the downloaded file manually.

## Notes
- Keys and tokens live only in `SocialConnections.json` on your machine.
- The server-side half of this feature loads when the app starts, so after updating you may need to fully **restart the app** once for it to take effect.
- TikTok access tokens are refreshed automatically; Instagram uses a long-lived token (re-connect if it expires).
