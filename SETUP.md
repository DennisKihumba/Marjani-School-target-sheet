# Marjani School Target Sheet — Setup Guide

## 1. Create the Firebase project
1. Go to https://console.firebase.google.com → **Add project** → name it e.g. `marjani-target-sheet` → finish the wizard (you can turn off Google Analytics, it isn't needed).
2. In the left sidebar: **Build → Authentication → Get started**.
   - Enable **Email/Password** (for admin & teacher accounts).
   - Enable **Anonymous** (for learners — this is what lets them use the app without a personal email).
3. In the left sidebar: **Build → Firestore Database → Create database** → start in **production mode** → pick a region close to Kenya (e.g. `europe-west1`).

This entire setup stays on Firebase's free **Spark** plan — no credit card required, as long as you don't also turn on Cloud Storage or Cloud Functions.

## 2. Connect your web app
1. In Project settings (gear icon) → scroll to **Your apps** → click the `</>` (web) icon → register an app (any nickname).
2. Firebase will show you a config object like:
   ```js
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
3. Paste those values into `js/firebase-config.js` in this project, replacing the placeholder text.

## 3. Deploy the security rules
1. Install the Firebase CLI once: `npm install -g firebase-tools`
2. From this project folder: `firebase login`, then `firebase init firestore` (choose your project, keep the default file names).
3. Replace the generated `firestore.rules` with the one included in this project.
4. Deploy: `firebase deploy --only firestore:rules`

(If you'd rather not use the command line, you can also paste the contents of `firestore.rules` directly into **Firestore Database → Rules** in the Firebase console and click Publish.)

## 4. Create your first admin account
Since there's no admin yet to create the first admin, do this once by hand:
1. Firebase console → Authentication → **Add user** → enter your email + a password.
2. Firestore Database → **Start collection** → collection ID `users` → document ID = paste the new user's UID (copy it from the Authentication tab) → add a field `role` (string) = `admin`, and `name` (string) = your name.
3. That's it — you can now sign in at `staff-login.html` and use the Admin dashboard to add teachers and learners from now on (no more manual console work needed).

## 5. Add subjects, teachers, and learners
From the Admin dashboard:
- **Subjects tab** — set up your CBC subject list (this is what learners pick from).
- **Teachers tab** — create teacher accounts and assign each teacher the subjects they should see submissions for.
- **Learners tab** — add each learner (first name, last name, class). A 4-digit PIN is generated automatically unless you set one — write it down or read it out to the learner. This PIN plus their name is how they sign in.

## 6. Host the website
This is a static site (no server needed to run it) — any static host works. For GitHub Pages:
1. Create a GitHub repository and push all these files to it (`index.html`, `admin.html`, `teacher.html`, `staff-login.html`, `style.css`, `js/`, etc.).
2. Repository → Settings → Pages → set source to your main branch, root folder.
3. GitHub gives you a URL like `https://yourusername.github.io/marjani-target-sheet/`.
4. Back in the Firebase console → Authentication → Settings → **Authorized domains** → add that GitHub Pages domain (Firebase blocks sign-in from unrecognized domains by default).

Netlify works the same way (drag-and-drop the folder onto netlify.com, then add the resulting domain to Firebase's authorized domains).

## 7. Test end-to-end before the exhibition
- Sign in as admin → add a test learner and a test teacher.
- Open the site in a private/incognito window (so you're not still signed in as admin) → sign in as that test learner → select subjects → enter a target → submit.
- Sign in as the test teacher at `staff-login.html` → confirm the submission shows up.
- Delete the test learner/teacher afterwards from the Admin dashboard.

## 8. How terms and grades work (new)

- **Terms**: the Admin dashboard has a "Current school term" banner at the top — set it once per term (e.g. Term 1, 2026). Every submission a learner makes is tagged with whatever term is active at that moment, and stored as its own permanent record. Moving to a new term never overwrites old data — a learner's Grade 4 Term 3 sheet and their Grade 5 Term 1 sheet are two separate records, both kept.
- **Grades**: every learner is assigned a grade (Grade 1–7) when added. When a learner moves up a grade at the start of a new year, use the **"Move grade"** control next to their name in the Learners tab — their past submissions stay correctly labeled with whatever grade they were in at the time.
- **Teachers**: each teacher account is tied to exactly one grade (set when the admin creates their account) — they only ever see submissions from learners in that grade, for the current term. Their dashboard greets them as "Tr. [Name]".
- A Firestore composite index is *not* needed for the teacher grade/term filtering — Firestore handles multiple equality filters automatically. If you ever do see an "index required" error in the browser console, it will include a direct link to create it with one click.

## 9. Honest limitations to know about
- **PDF download** works the same everywhere now (learner, teacher, admin) — same layout, includes school, grade, and term on every sheet.
- **The "send to email" option has been removed** per your request — download-and-print is now the only handoff method.

- **Learner "accounts" aren't full logins** — there's no personal email/password for each learner, just name + PIN, which is proportionate for young learners but not bank-grade security. A learner who knows a classmate's PIN could submit under their name. For a school exhibition/term-target use case this is a reasonable tradeoff; flag to the school that this isn't meant for anything higher-stakes.
- **Free tier limits**: Firestore's free tier is 50,000 reads and 20,000 writes per day — far more than one school will use in a term, so this should cost nothing.
