import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { downloadSubmissionPdf } from "./pdf-helper.js";

function norm(s) { return s.trim().toLowerCase().replace(/\s+/g, " "); }

let myGrade = "";
let submissionsCache = [];

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "staff-login.html"; return; }
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists() || snap.data().role !== "teacher") {
    alert("This page is for teacher accounts only.");
    window.location.href = "staff-login.html";
    return;
  }
  const data = snap.data();
  myGrade = data.grade || "";

  document.getElementById("portalTitle").textContent = `Tr. ${data.name || ""}`;
  document.getElementById("portalSubtitle").textContent = myGrade ? `${myGrade} Lead Teacher` : "No grade assigned yet";

  const termSnap = await getDoc(doc(db, "config", "term"));
  const term = termSnap.exists() ? termSnap.data().term : "Term 1";
  const year = termSnap.exists() ? termSnap.data().year : new Date().getFullYear();
  document.getElementById("termNote").textContent = myGrade
    ? `Showing ${myGrade} submissions for ${term}, ${year}.`
    : "Ask the admin to assign you a grade to see submissions.";

  await loadSubmissions(term, year);
});

document.getElementById("signOutBtn").addEventListener("click", () => signOut(auth).then(() => window.location.href = "staff-login.html"));

async function loadSubmissions(term, year) {
  if (!myGrade) { submissionsCache = []; renderSubmissions([]); return; }
  const q = query(
    collection(db, "submissions"),
    where("grade", "==", myGrade),
    where("term", "==", term),
    where("year", "==", year)
  );
  const snap = await getDocs(q);
  submissionsCache = snap.docs.map(d => d.data());
  renderSubmissions(submissionsCache);
}

function renderSubmissions(list) {
  const body = document.getElementById("submissionsTableBody");
  body.innerHTML = "";
  list.forEach((s, i) => {
    const summary = (s.subjectNames || []).length
      ? `<div class="score-lines">${(s.subjectNames || []).map(subj => {
          const t = (s.targets || {})[subj] || {};
          return `<span class="score-line"><b>${subj}</b>: ${t.target || "-"} / ${t.midterm || "-"} / ${t.endterm || "-"}</span>`;
        }).join("")}</div>`
      : `<span style="color:var(--ink-dim);">—</span>`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.firstName} ${s.lastName}</td>
      <td>${summary}</td>
      <td>${s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : "—"}</td>
      <td><button class="btn ghost small" data-action="pdf" data-i="${i}">⬇ PDF</button></td>`;
    body.appendChild(tr);
  });
  body.querySelectorAll('[data-action="pdf"]').forEach(btn => btn.addEventListener("click", () => {
    downloadSubmissionPdf(list[Number(btn.dataset.i)]);
  }));
}

document.getElementById("subSearch").addEventListener("input", (e) => {
  const q = norm(e.target.value);
  renderSubmissions(submissionsCache.filter(s => norm(s.firstName + " " + s.lastName).includes(q)));
});
