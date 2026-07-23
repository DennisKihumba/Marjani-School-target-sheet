import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

document.getElementById("staffLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errBox = document.getElementById("loginError");
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true; btn.textContent = "Signing in…";

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const userSnap = await getDoc(doc(db, "users", cred.user.uid));

    if (!userSnap.exists()) {
      errBox.textContent = "Your account isn't set up with a role yet. Ask the admin to check your account.";
      errBox.classList.add("show");
      return;
    }

    const role = userSnap.data().role;
    if (role === "admin") window.location.href = "admin.html";
    else if (role === "teacher") window.location.href = "teacher.html";
    else {
      errBox.textContent = "Your account doesn't have admin or teacher access.";
      errBox.classList.add("show");
    }
  } catch (err) {
    console.error(err);
    errBox.textContent = "Incorrect email or password.";
    errBox.classList.add("show");
  } finally {
    btn.disabled = false; btn.textContent = "Sign in";
  }
});
