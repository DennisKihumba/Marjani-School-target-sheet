import { auth, db } from "./firebase-config.js";
import { signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  collection, query, where, getDocs, getDoc, doc, updateDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { downloadSubmissionPdf } from "./pdf-helper.js";

const SCHOOL_NAME = "Marjani School";

const state = {
  uid: null,
  learnerId: null,
  submissionId: null,
  firstName: "",
  lastName: "",
  grade: "",
  term: "",
  year: "",
  subjects: [],
  targets: {},
  locked: false,
  subjectsList: []
};

signInAnonymously(auth).catch(err => {
  console.error("Anonymous sign-in failed:", err);
  showLoginError("Could not connect. Check your internet connection and reload the page.");
});

let authReady = new Promise(resolve => {
  onAuthStateChanged(auth, user => { if (user) { state.uid = user.uid; resolve(); } });
});

function norm(str) { return str.trim().toLowerCase().replace(/\s+/g, " "); }
function termKey(term, year) { return `${year}-${term}`.replace(/\s+/g, ""); }

function showScreen(n) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen-" + n).classList.add("active");
  document.querySelectorAll(".step").forEach(s => {
    const step = Number(s.dataset.step);
    s.classList.remove("done", "active");
    if (step < n) s.classList.add("done");
    else if (step === n) s.classList.add("active");
  });
}

function showLoginError(msg) {
  const box = document.getElementById("loginError");
  box.textContent = msg;
  box.classList.add("show");
}

async function loadSubjectsList() {
  try {
    const snap = await getDoc(doc(db, "config", "subjects"));
    if (snap.exists() && Array.isArray(snap.data().list) && snap.data().list.length) {
      state.subjectsList = snap.data().list;
      return;
    }
  } catch (e) { console.warn("Could not load subject config, using default list.", e); }
  state.subjectsList = ["English", "Kiswahili", "Mathematics", "Integrated Science", "Social Studies", "CRE", "Agriculture", "ICT"];
}

async function loadCurrentTerm() {
  try {
    const snap = await getDoc(doc(db, "config", "term"));
    if (snap.exists()) {
      state.term = snap.data().term || "Term 1";
      state.year = snap.data().year || new Date().getFullYear();
      return;
    }
  } catch (e) { console.warn("Could not load current term, using default.", e); }
  state.term = "Term 1";
  state.year = new Date().getFullYear();
}

/* ---------------- Screen 1: login ---------------- */
document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  submitBtn.textContent = "Checking…";

  try {
    await authReady;

    const first = document.getElementById("firstName").value;
    const last = document.getElementById("lastName").value;
    const school = document.getElementById("schoolName").value;
    const pin = document.getElementById("pin").value;

    if (norm(school) !== norm(SCHOOL_NAME)) {
      showLoginError("That school name doesn't match our records. Please check the spelling and try again.");
      return;
    }

    // Run the learner lookup and the two config reads at the same time —
    // they don't depend on each other, so there's no reason to wait for
    // one before starting the next. On slower school internet, doing
    // these one-after-another (as this used to) is the main thing that
    // made login feel slow.
    const q = query(
      collection(db, "learners"),
      where("firstNameLower", "==", norm(first)),
      where("lastNameLower", "==", norm(last))
    );
    const [results] = await Promise.all([
      getDocs(q),
      loadCurrentTerm(),
      loadSubjectsList()
    ]);

    if (results.empty) {
      showLoginError("We couldn't find that name on the class register. Check your spelling, or see your teacher.");
      return;
    }

    const learnerDoc = results.docs[0];
    const learnerData = learnerDoc.data();

    if (String(learnerData.pin) !== String(pin).trim()) {
      showLoginError("That PIN doesn't match. Ask your teacher if you've forgotten it.");
      return;
    }

    // This is just informational now (shows admin who's currently signed
    // in) — nothing downstream depends on it finishing, so don't make the
    // learner wait for it.
    updateDoc(doc(db, "learners", learnerDoc.id), { linkedUid: state.uid }).catch(() => {});

    state.learnerId = learnerDoc.id;
    state.firstName = learnerData.firstName;
    state.lastName = learnerData.lastName;
    state.grade = learnerData.grade || "";

    // Each term gets its own submission record, so moving to a new term
    // (or a new grade at the start of Term 1) always starts fresh here,
    // while past terms stay on file untouched.
    state.submissionId = `${state.learnerId}_${termKey(state.term, state.year)}`;
    const subSnap = await getDoc(doc(db, "submissions", state.submissionId));
    if (subSnap.exists()) {
      const d = subSnap.data();
      state.subjects = d.subjectNames || [];
      state.targets = d.targets || {};
      state.locked = !!d.locked;
    } else {
      state.subjects = [];
      state.targets = {};
      state.locked = false;
    }

    document.getElementById("loginError").classList.remove("show");
    buildSubjectGrid();
    showScreen(2);
  } catch (err) {
    console.error(err);
    showLoginError("Something went wrong. Please try again.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Continue →";
  }
});

/* ---------------- Screen 2: subjects ---------------- */
function buildSubjectGrid() {
  const grid = document.getElementById("subjectGrid");
  grid.innerHTML = "";
  state.subjectsList.forEach(subj => {
    const id = "subj-" + subj.replace(/\s+/g, "-");
    const checked = state.subjects.includes(subj) ? "checked" : "";
    const disabled = state.locked ? "disabled" : "";
    const pill = document.createElement("label");
    pill.className = "subject-pill" + (checked ? " checked" : "");
    pill.setAttribute("for", id);
    pill.innerHTML = `<input type="checkbox" id="${id}" value="${subj}" ${checked} ${disabled}><span>${subj}</span>`;
    grid.appendChild(pill);
    if (!state.locked) pill.querySelector("input").addEventListener("change", onSubjectToggle);
  });
  updateSubjectCount();
  document.getElementById("subjectLockNote").style.display = state.locked ? "block" : "none";
}

function updateSubjectCount() {
  const n = state.subjects.length;
  document.getElementById("subjectCount").textContent = `${n} subject${n === 1 ? "" : "s"} selected`;
}

function onSubjectToggle() {
  state.subjects = [...document.querySelectorAll("#subjectGrid input:checked")].map(i => i.value);
  updateSubjectCount();
  document.querySelectorAll(".subject-pill").forEach(p => p.classList.toggle("checked", p.querySelector("input").checked));
}

document.getElementById("backTo1").addEventListener("click", () => showScreen(1));

document.getElementById("toScreen3").addEventListener("click", () => {
  const errBox = document.getElementById("subjectError");
  if (state.subjects.length === 0) {
    errBox.textContent = "Select at least one subject before continuing.";
    errBox.classList.add("show");
    return;
  }
  errBox.classList.remove("show");
  buildTargetForm();
  showScreen(3);
});

/* ---------------- Screen 3: target / midterm / end term ---------------- */
function buildTargetForm() {
  const box = document.getElementById("targetForm");
  box.innerHTML = "";
  state.subjects.forEach(subj => {
    const d = state.targets[subj] || { target: "", midterm: "", endterm: "" };
    const targetLock = state.locked ? "readonly" : "";
    const row = document.createElement("div");
    row.className = "target-row";
    row.innerHTML = `
      <span class="subject-label">${subj}</span>
      <div class="score-group"><label>Target</label>
        <input type="number" min="70" max="100" placeholder="70-100" data-subject="${subj}" data-field="target" value="${d.target}" ${targetLock}></div>
      <div class="score-group"><label>Midterm</label>
        <input type="number" min="0" max="100" placeholder="0-100" data-subject="${subj}" data-field="midterm" value="${d.midterm}"></div>
      <div class="score-group"><label>End Term</label>
        <input type="number" min="0" max="100" placeholder="0-100" data-subject="${subj}" data-field="endterm" value="${d.endterm}"></div>`;
    box.appendChild(row);
  });
  document.getElementById("targetLockNote").style.display = state.locked ? "block" : "none";
}

document.getElementById("backTo2").addEventListener("click", () => showScreen(2));

document.getElementById("toScreen4").addEventListener("click", async () => {
  const inputs = document.querySelectorAll("#targetForm input");
  const errBox = document.getElementById("targetError");
  const bySubject = {};
  inputs.forEach(inp => {
    bySubject[inp.dataset.subject] = bySubject[inp.dataset.subject] || {};
    bySubject[inp.dataset.subject][inp.dataset.field] = inp.value;
  });

  for (const subj in bySubject) {
    const { target, midterm, endterm } = bySubject[subj];
    if (target === "" || isNaN(target) || target < 70 || target > 100) {
      errBox.textContent = "Enter a target score between 70 and 100 for every subject.";
      errBox.classList.add("show");
      return;
    }
    for (const v of [midterm, endterm]) {
      if (v !== "" && (isNaN(v) || v < 0 || v > 100)) {
        errBox.textContent = "Midterm and End Term must be between 0 and 100 if entered.";
        errBox.classList.add("show");
        return;
      }
    }
  }
  errBox.classList.remove("show");
  state.targets = bySubject;

  const submitBtn = document.getElementById("toScreen4");
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving…";

  try {
    await setDoc(doc(db, "submissions", state.submissionId), {
      learnerId: state.learnerId,
      firstName: state.firstName,
      lastName: state.lastName,
      school: SCHOOL_NAME,
      grade: state.grade,
      term: state.term,
      year: state.year,
      subjectNames: state.subjects,
      targets: state.targets,
      locked: true,
      updatedAt: new Date().toISOString()
    });
    state.locked = true;
    buildSummary();
    showScreen(4);
  } catch (err) {
    console.error(err);
    errBox.textContent = "Could not save your scores — check your connection and try again.";
    errBox.classList.add("show");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Review →";
  }
});

/* ---------------- Screen 4: summary / pdf ---------------- */
function buildSummary() {
  document.getElementById("sumName").textContent = `${state.firstName} ${state.lastName}`;
  document.getElementById("sumSchool").textContent = `${SCHOOL_NAME} — ${state.grade} — ${state.term}, ${state.year}`;

  const body = document.getElementById("sumTableBody");
  body.innerHTML = "";
  state.subjects.forEach(subj => {
    const d = state.targets[subj] || {};
    body.innerHTML += `<tr><td>${subj}</td><td>${d.target || ""}</td><td>${d.midterm || ""}</td><td>${d.endterm || ""}</td></tr>`;
  });
}

document.getElementById("backTo3").addEventListener("click", () => showScreen(3));

document.getElementById("startOverBtn").addEventListener("click", async () => {
  const btn = document.getElementById("startOverBtn");
  btn.disabled = true;
  btn.textContent = "Logging out…";
  try { await signOut(auth); } catch (e) { console.warn("Sign-out had an issue, continuing anyway:", e); }
  Object.assign(state, {
    uid: null, learnerId: null, submissionId: null, firstName: "", lastName: "",
    grade: "", subjects: [], targets: {}, locked: false
  });
  document.getElementById("loginForm").reset();
  showScreen(1);
  authReady = new Promise(resolve => {
    onAuthStateChanged(auth, user => { if (user) { state.uid = user.uid; resolve(); } });
  });
  signInAnonymously(auth).catch(err => console.error("Anonymous sign-in failed:", err));
});

document.getElementById("downloadPdfBtn").addEventListener("click", () => {
  downloadSubmissionPdf({
    firstName: state.firstName, lastName: state.lastName, school: SCHOOL_NAME,
    grade: state.grade, term: state.term, year: state.year,
    subjectNames: state.subjects, targets: state.targets
  });
});
