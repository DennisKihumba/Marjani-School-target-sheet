// ============================================================
// FIREBASE SETUP — paste your project's config here.
// Get this from: Firebase console → Project settings → General
// → "Your apps" → the web app (</> icon) → SDK setup and configuration
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyBH_mk5h9OUSvqASQ8ezVlxQm0WpvzD7Ag",
  authDomain: "marjani-target-sheet.firebaseapp.com",
  projectId: "marjani-target-sheet",
  storageBucket: "marjani-target-sheet.firebasestorage.app",
  messagingSenderId: "580905313389",
  appId: "1:580905313389:web:e90bbc9936e5a1c740cb64"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
