import { auth, db, firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  onAuthStateChanged, signOut, getAuth, createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { downloadSubmissionPdf, GRADES, TERMS } from "./pdf-helper.js";

function norm(s) { return s.trim().toLowerCase().replace(/\s+/g, " "); }
function fillSelect(sel, options, placeholder) {
  sel.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : "") +
    options.map(o => `<option value="${o}">${o}</option>`).join("");
}

/* ---------------- Auth guard ---------------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "staff-login.html"; return; }
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists() || snap.data().role !== "admin") {
    alert("This page is for admin accounts only.");
    window.location.href = "staff-login.html";
    return;
  }
  init();
});

document.getElementById("signOutBtn").addEventListener("click", () => signOut(auth).then(() => window.location.href = "staff-login.html"));

/* ---------------- Tabs ---------------- */
document.querySelectorAll(".dash-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".dash-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.style.display = "none");
    tab.classList.add("active");
    document.getElementById("tab-" + tab.dataset.tab).style.display = "block";
  });
});

let subjectsList = [];

async function init() {
  fillSelect(document.getElementById("lGrade"), GRADES);
  fillSelect(document.getElementById("sGrade"), GRADES);
  fillSelect(document.getElementById("learnerGradeFilter"), GRADES, "All grades");
  fillSelect(document.getElementById("subGradeFilter"), GRADES, "All grades");
  fillSelect(document.getElementById("termSelect"), TERMS);

  await loadTerm();
  await loadSubjects();
  await loadLearners();
  await loadStaff();
  await loadSubmissions();
}

/* ---------------- Term ---------------- */
async function loadTerm() {
  const snap = await getDoc(doc(db, "config", "term"));
  const term = snap.exists() ? snap.data().term : "Term 1";
  const year = snap.exists() ? snap.data().year : new Date().getFullYear();
  document.getElementById("currentTermLabel").textContent = `${term}, ${year}`;
  document.getElementById("termSelect").value = term;
  document.getElementById("termYear").value = year;
}

document.getElementById("saveTermBtn").addEventListener("click", async () => {
  const errBox = document.getElementById("termError");
  const okBox = document.getElementById("termSuccess");
  const term = document.getElementById("termSelect").value;
  const year = Number(document.getElementById("termYear").value);
  if (!year || year < 2020) {
    errBox.textContent = "Enter a valid year.";
    errBox.classList.add("show");
    return;
  }
  try {
    await setDoc(doc(db, "config", "term"), { term, year });
    errBox.classList.remove("show");
    okBox.textContent = `Term updated to ${term}, ${year}. Learners will now submit under this term.`;
    okBox.classList.add("show");
    await loadTerm();
    setTimeout(() => okBox.classList.remove("show"), 3500);
  } catch (e) {
    errBox.textContent = "Could not update the term — try again.";
    errBox.classList.add("show");
  }
});

/* ---------------- Subjects ---------------- */
async function loadSubjects() {
  const snap = await getDoc(doc(db, "config", "subjects"));
  subjectsList = (snap.exists() && snap.data().list) ? snap.data().list : [];
  renderSubjectsEditGrid();
}

function renderSubjectsEditGrid() {
  const grid = document.getElementById("subjectsEditGrid");
  grid.innerHTML = "";
  subjectsList.forEach((subj, i) => {
    const pill = document.createElement("div");
    pill.className = "subject-pill checked";
    pill.innerHTML = `<span>${subj}</span><span style="margin-left:auto;cursor:pointer;color:var(--bad);" data-i="${i}">✕</span>`;
    pill.querySelector("span[data-i]").addEventListener("click", () => {
      subjectsList.splice(i, 1);
      renderSubjectsEditGrid();
    });
    grid.appendChild(pill);
  });
}

document.getElementById("addSubjectBtn").addEventListener("click", () => {
  const input = document.getElementById("newSubjectInput");
  const val = input.value.trim();
  if (!val) return;
  if (!subjectsList.includes(val)) subjectsList.push(val);
  input.value = "";
  renderSubjectsEditGrid();
});

document.getElementById("saveSubjectsBtn").addEventListener("click", async () => {
  const errBox = document.getElementById("subjectsError");
  const okBox = document.getElementById("subjectsSuccess");
  try {
    await setDoc(doc(db, "config", "subjects"), { list: subjectsList });
    okBox.textContent = "Subject list saved.";
    okBox.classList.add("show");
    errBox.classList.remove("show");
    setTimeout(() => okBox.classList.remove("show"), 2500);
  } catch (e) {
    errBox.textContent = "Could not save — try again.";
    errBox.classList.add("show");
  }
});

/* ---------------- Learners ---------------- */
function randomPin() { return String(Math.floor(1000 + Math.random() * 9000)); }

let learnersCache = [];

async function loadLearners() {
  const snap = await getDocs(query(collection(db, "learners"), orderBy("lastName")));
  learnersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  applyLearnerFilters();
}

function applyLearnerFilters() {
  const q = norm(document.getElementById("learnerSearch").value);
  const grade = document.getElementById("learnerGradeFilter").value;
  renderLearnerTable(learnersCache.filter(l =>
    (!q || norm(l.firstName + " " + l.lastName).includes(q)) &&
    (!grade || l.grade === grade)
  ));
}

function renderLearnerTable(list) {
  const body = document.getElementById("learnerTableBody");
  body.innerHTML = "";
  list.forEach(l => {
    const tr = document.createElement("tr");
    const status = l.linkedUid ? `<span class="badge locked">Signed in</span>` : `<span class="badge open">New</span>`;
    tr.innerHTML = `
      <td>${l.firstName} ${l.lastName}</td>
      <td>${l.grade || "—"}</td>
      <td class="pin-display">${l.pin}</td>
      <td>${status}</td>
      <td>
        <select data-action="grade-select" data-id="${l.id}" style="display:inline-block;width:auto;margin:0 6px 0 0;padding:6px 8px;font-size:12.5px;"></select>
        <button class="btn ghost small" data-action="save-grade" data-id="${l.id}">Move grade</button>
        <button class="btn ghost small" data-action="reset-session" data-id="${l.id}">Reset sign-in</button>
        <button class="btn danger small" data-action="delete" data-id="${l.id}">Delete</button>
      </td>`;
    body.appendChild(tr);
    const gradeSel = tr.querySelector('[data-action="grade-select"]');
    fillSelect(gradeSel, GRADES);
    gradeSel.value = l.grade || GRADES[0];
  });

  body.querySelectorAll('[data-action="save-grade"]').forEach(btn => btn.addEventListener("click", async () => {
    const newGrade = tr_gradeValue(btn);
    await updateDoc(doc(db, "learners", btn.dataset.id), { grade: newGrade });
    await loadLearners();
  }));
  body.querySelectorAll('[data-action="reset-session"]').forEach(btn => btn.addEventListener("click", async () => {
    await updateDoc(doc(db, "learners", btn.dataset.id), { linkedUid: null });
    alert("Sign-in reset — this learner can now log in from any device again.");
  }));
  body.querySelectorAll('[data-action="delete"]').forEach(btn => btn.addEventListener("click", async () => {
    if (!confirm("Remove this learner from the register? Their past submissions will stay on file.")) return;
    await deleteDoc(doc(db, "learners", btn.dataset.id));
    await loadLearners();
  }));
}

function tr_gradeValue(saveBtn) {
  const row = saveBtn.closest("tr");
  return row.querySelector('[data-action="grade-select"]').value;
}

document.getElementById("learnerSearch").addEventListener("input", applyLearnerFilters);
document.getElementById("learnerGradeFilter").addEventListener("change", applyLearnerFilters);

document.getElementById("addLearnerBtn").addEventListener("click", async () => {
  const errBox = document.getElementById("learnerError");
  const okBox = document.getElementById("learnerSuccess");
  const first = document.getElementById("lFirst").value.trim();
  const last = document.getElementById("lLast").value.trim();
  const grade = document.getElementById("lGrade").value;
  let pin = document.getElementById("lPin").value.trim();

  if (!first || !last || !grade) {
    errBox.textContent = "First name, last name, and grade are required.";
    errBox.classList.add("show");
    return;
  }
  if (pin && !/^\d{4}$/.test(pin)) {
    errBox.textContent = "PIN must be exactly 4 digits, or left blank to auto-generate.";
    errBox.classList.add("show");
    return;
  }
  if (!pin) pin = randomPin();

  try {
    await setDoc(doc(collection(db, "learners")), {
      firstName: first, lastName: last,
      firstNameLower: norm(first), lastNameLower: norm(last),
      grade, pin, linkedUid: null,
      createdAt: new Date().toISOString()
    });
    errBox.classList.remove("show");
    okBox.textContent = `Added ${first} ${last} (${grade}) — PIN: ${pin}`;
    okBox.classList.add("show");
    document.getElementById("addLearnerForm").reset();
    document.getElementById("lGrade").value = grade;
    await loadLearners();
  } catch (e) {
    console.error(e);
    errBox.textContent = "Could not add learner — try again.";
    errBox.classList.add("show");
  }
});

/* ---------------- Staff accounts ---------------- */
document.getElementById("sRole").addEventListener("change", (e) => {
  document.getElementById("sGradeWrap").style.display = e.target.value === "teacher" ? "block" : "none";
});

let staffCache = [];

async function loadStaff() {
  const snap = await getDocs(collection(db, "users"));
  staffCache = snap.docs.map(d => d.data());
  const body = document.getElementById("staffTableBody");
  body.innerHTML = "";
  staffCache.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>Tr. ${u.name || "—"}</td><td>${u.email || "—"}</td><td>${u.role}</td><td>${u.role === "teacher" ? (u.grade || "—") : "—"}</td>`;
    body.appendChild(tr);
  });
}

document.getElementById("addStaffBtn").addEventListener("click", async () => {
  const errBox = document.getElementById("staffError");
  const okBox = document.getElementById("staffSuccess");
  const name = document.getElementById("sName").value.trim();
  const email = document.getElementById("sEmail").value.trim();
  const password = document.getElementById("sPassword").value;
  const role = document.getElementById("sRole").value;
  const grade = document.getElementById("sGrade").value;

  if (!name || !email || password.length < 6) {
    errBox.textContent = "Fill in name, email, and a password of at least 6 characters.";
    errBox.classList.add("show");
    return;
  }
  if (role === "teacher" && !grade) {
    errBox.textContent = "Choose which grade this teacher leads.";
    errBox.classList.add("show");
    return;
  }

  try {
    const secondaryApp = initializeApp(firebaseConfig, "Secondary-" + Date.now());
    const secondaryAuth = getAuth(secondaryApp);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);

    await setDoc(doc(db, "users", cred.user.uid), {
      name, email, role, grade: role === "teacher" ? grade : "",
      createdAt: new Date().toISOString()
    });

    await signOut(secondaryAuth);

    errBox.classList.remove("show");
    okBox.textContent = `Account created for Tr. ${name} (${role}${role === "teacher" ? ", " + grade : ""}). Share the email and password with them directly.`;
    okBox.classList.add("show");
    document.getElementById("addStaffForm").reset();
    document.getElementById("sGradeWrap").style.display = "block";
    await loadStaff();
  } catch (e) {
    console.error(e);
    errBox.textContent = e.code === "auth/email-already-in-use" ? "That email is already in use." : "Could not create account — try again.";
    errBox.classList.add("show");
  }
});

/* ---------------- Submissions ---------------- */
let submissionsCache = [];

async function loadSubmissions() {
  const snap = await getDocs(collection(db, "submissions"));
  submissionsCache = snap.docs.map(d => d.data());
  applySubmissionFilters();
}

function applySubmissionFilters() {
  const q = norm(document.getElementById("subSearch").value);
  const grade = document.getElementById("subGradeFilter").value;
  renderSubmissions(submissionsCache.filter(s =>
    (!q || norm(s.firstName + " " + s.lastName).includes(q)) &&
    (!grade || s.grade === grade)
  ));
}

function renderSubmissions(list) {
  const body = document.getElementById("submissionsTableBody");
  body.innerHTML = "";
  list.forEach((s, i) => {
    const summary = (s.subjectNames || []).length
      ? `<div class="score-lines">${(s.subjectNames || []).map(subj => {
          const t = (s.targets || {})[subj] || {};
          return `<span class="score-line"><b>${subj}</b>: target ${t.target || "-"}</span>`;
        }).join("")}</div>`
      : `<span style="color:var(--ink-dim);">—</span>`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.firstName} ${s.lastName}</td>
      <td>${s.grade || "—"}</td>
      <td>${s.term || "—"}${s.year ? ", " + s.year : ""}</td>
      <td>${summary}</td>
      <td>${s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : "—"}</td>
      <td><button class="btn ghost small" data-action="pdf" data-i="${i}">⬇ PDF</button></td>`;
    body.appendChild(tr);
  });
  body.querySelectorAll('[data-action="pdf"]').forEach(btn => btn.addEventListener("click", () => {
    downloadSubmissionPdf(list[Number(btn.dataset.i)]);
  }));
}

document.getElementById("subSearch").addEventListener("input", applySubmissionFilters);
document.getElementById("subGradeFilter").addEventListener("change", applySubmissionFilters);
