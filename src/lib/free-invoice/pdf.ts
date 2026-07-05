// Client-side PDF export of the live A4 preview. No server round-trip, and it
// works without an account. Libraries are dynamically imported so they never
// weigh down the landing page's initial load.

// The preview paper is rendered scaled (CSS transform) to fit its column; we
// clone it at natural size so the capture is crisp and un-cropped.
export async function exportInvoicePdf(sourceId: string, filename: string): Promise<void> {
  const src = document.getElementById(sourceId);
  if (!src) throw new Error("preview element not found");

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const clone = src.cloneNode(true) as HTMLElement;
  clone.style.transform = "none";
  clone.style.width = "794px";
  // Keep the A4 min-height (inherited from the sheet) so the pinned footer sits
  // at the bottom of the page in the PDF, exactly like the on-screen preview.
  clone.style.position = "fixed";
  clone.style.left = "-10000px";
  clone.style.top = "0";
  clone.style.boxShadow = "none";
  document.body.appendChild(clone);

  try {
    const canvas = await html2canvas(clone, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    // JPEG keeps the file small (invoices are mostly white) while staying crisp.
    const img = canvas.toDataURL("image/jpeg", 0.95);

    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(img, "JPEG", 0, position, imgW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(img, "JPEG", 0, position, imgW, imgH);
      heightLeft -= pageH;
    }

    pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  } finally {
    document.body.removeChild(clone);
  }
}
