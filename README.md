# Riverstone Public School — Website Project

A two-mode school website:
- **User mode** — anyone can browse the site and submit a question through the contact form.
- **Admin mode** — a logged-in admin can edit everything (school name, logo, hero text/image,
  about section, stats, academic programs, achievements, gallery photos, events/invitations,
  contact info) and read visitor messages. Changes are saved permanently to a real database
  (Firebase Firestore), so every visitor sees the same, latest content — not just your browser.

## Files in this project

| File | Purpose |
|---|---|
| `index.html` | The site itself (structure + styling) |
| `app.js` | All logic: rendering, Firestore read/write, admin login, photo uploads |
| `firebase-config.js` | **Your** Firebase project credentials go here |
| `imgbb-config.js` | **Your** free ImgBB API key goes here (for device photo uploads) |
| `firestore.rules` | Security rules (paste into Firebase Console) |

## 1. Firebase setup (you've done most of this already)

1. **Firestore Database** → make sure it's created (test mode is fine to start).
2. **Authentication → Sign-in method** → enable **Email/Password**.
3. **Authentication → Users → Add user** → create your admin login
   (e.g. `admin@riverstoneschool.edu` + a strong password). This is the account
   you'll use to log into Admin Mode on the live site.
4. **Firestore Database → Rules tab** → replace the default rules with the contents
   of `firestore.rules` in this project → click **Publish**.
   This locks the database down so only your logged-in admin account can change content,
   while still letting the public site load and visitors submit questions.
5. **Project Settings (gear icon) → scroll to "Your apps"** → if you haven't already,
   register a Web app (`</>` icon) → copy the `firebaseConfig` object it shows you.

## 2. Add your config

Open `firebase-config.js` and replace the placeholder values with your real ones:

```js
export const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

## 2b. Enable photo uploads (free, no credit card)

Uploading photos directly from a device (instead of pasting a link) uses **ImgBB**,
a free image-hosting service — separate from Firebase, no billing account needed.

1. Go to **https://api.imgbb.com/**
2. Click **"Get API Key"** and sign up (completely free, no card required)
3. Copy the API key
4. Open `imgbb-config.js` and paste it in:

```js
export const IMGBB_API_KEY = "your-real-key-here";
```

Until you do this, the file-upload buttons in Admin Mode will show a reminder
message instead of uploading.

## 3. Deploy to GitHub Pages

1. Create a new GitHub repository (e.g. `school-website`).
2. Upload `index.html`, `app.js`, `firebase-config.js`, and `imgbb-config.js` to the repo
   (keep them in the root folder, all together — not inside a subfolder).
3. (Optional) Create an `images/` folder in the repo and upload school photos there —
   you can then use paths like `images/sports-day.jpg` as the "Image URL" when adding
   gallery photos, achievements, or notices in Admin Mode.
4. Go to **Settings → Pages** in the repo → under "Source," choose the `main` branch,
   root folder → **Save**.
5. GitHub gives you a live link, e.g. `https://yourusername.github.io/school-website/`.
6. (Optional) Under **Settings → Pages → Custom domain**, point your own domain
   (e.g. `www.riverstoneschool.edu`) at it if you have one.

## 4. Using Admin Mode on the live site

1. Visit your live GitHub Pages URL.
2. Click **"Admin Login"** (top nav or bottom-right button).
3. Log in with the email/password you created in Firebase Authentication (step 1.3 above).
4. A red admin bar appears at the top:
   - **Edit Site Info & Logo** — change school name, tagline, logo, hero, about section,
     stats, contact info, footer — applies instantly, site-wide, for every visitor.
   - **Messages** — read and delete questions submitted through the contact form.
   - **Exit Admin Mode** — logs you out, back to normal visitor view.
5. Inline "+ Add" forms in the Academics, Achievements, Gallery, and Events sections
   let you add or remove entries directly.

Any admin who logs in with a valid Firebase account can make changes — the site simply
reflects whatever was saved most recently. To add a second admin, just create another
user under Authentication → Users in the Firebase Console.

## Notes

- Photos are added by pasting an **image URL** — either a link to a photo you've uploaded
  into the `images/` folder of this repo, or any hosted image link (Google Drive shared
  link, Imgur, etc.).
- Firebase's free (Spark) tier is generous and more than enough for a typical school site's
  traffic. If you ever outgrow it, Firebase will prompt you to upgrade — it won't happen
  by surprise.
- If Admin Mode ever says "could not save," double-check that you're logged in and that the
  Firestore rules from step 1.4 were published correctly.
