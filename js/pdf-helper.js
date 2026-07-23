// Builds a clean, print-ready target sheet and downloads it as a PDF.
// Used by the learner page, teacher dashboard, and admin dashboard so
// every generated PDF looks identical no matter who downloads it.
//
// sub: { firstName, lastName, school, grade, term, year, subjectNames, targets }
export function downloadSubmissionPdf(sub) {
  const termLabel = sub.term && sub.year ? `${sub.term}, ${sub.year}` : "";
  const filename = `${sub.firstName}_${sub.lastName}_${sub.grade || ""}_${sub.term || ""}_Target_Sheet.pdf`
    .replace(/\s+/g, "_").replace(/_+/g, "_");

  const rows = (sub.subjectNames || []).map(subj => {
    const t = (sub.targets || {})[subj] || {};
    return `<tr>
      <td>${subj}</td>
      <td>${t.target || ""}</td>
      <td>${t.midterm || ""}</td>
      <td>${t.endterm || ""}</td>
    </tr>`;
  }).join("");

  const sheet = document.createElement("div");
  sheet.style.cssText = "width:794px;background:#ffffff;";
  sheet.innerHTML = `
    <div style="font-family:Sora,sans-serif;padding:30px;color:#0a0e27;">
      <h2 style="margin:0 0 4px;">${sub.school || "Marjani School"} — Term Target Score Sheet</h2>
      <p style="font-weight:700;font-size:17px;margin:14px 0 2px;">${sub.firstName} ${sub.lastName}</p>
      <p style="color:#555;font-size:13px;margin:0 0 4px;">${sub.school || ""}${sub.grade ? " — " + sub.grade : ""}${termLabel ? " — " + termLabel : ""}</p>
      <table style="width:100%;border-collapse:collapse;font-family:Inter,sans-serif;margin-top:14px;">
        <thead>
          <tr>
            <th style="text-align:left;border-bottom:2px solid #0a0e27;padding:8px 6px;font-size:13px;">Subject</th>
            <th style="text-align:left;border-bottom:2px solid #0a0e27;padding:8px 6px;font-size:13px;">Target</th>
            <th style="text-align:left;border-bottom:2px solid #0a0e27;padding:8px 6px;font-size:13px;">Midterm</th>
            <th style="text-align:left;border-bottom:2px solid #0a0e27;padding:8px 6px;font-size:13px;">End Term</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  document.body.appendChild(sheet);

  return html2pdf().set({
    margin: 0,
    filename,
    html2canvas: {
      scale: 2, scrollX: 0, scrollY: 0,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight
    },
    jsPDF: { unit: "pt", format: "a4", orientation: "landscape" }
  }).from(sheet).save().then(() => {
    document.body.removeChild(sheet);
  });
}

export const GRADES = ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7"];
export const TERMS = ["Term 1", "Term 2", "Term 3"];
