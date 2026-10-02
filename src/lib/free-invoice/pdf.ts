// Client-side PDF export of the live A4 preview. No server round-trip, and it
// works without an account. Libraries are dynamically imported so they never
// weigh down the landing page's initial load.

// The preview paper is rendered scaled (CSS transform) to fit its column; we
// clone it at natural size so the capture is crisp and un-cropped.
async function buildInvoicePdf(sourceId: string): Promise<import("jspdf").jsPDF> {
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

    return pdf;
  } finally {
    document.body.removeChild(clone);
  }
}

/** Download PDF: the document, saved. */
export async function exportInvoicePdf(sourceId: string, filename: string): Promise<void> {
  const pdf = await buildInvoicePdf(sourceId);
  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

/**
 * Print: **the same PDF** Download makes (one builder, never a second), handed to the browser's own print dialog — which
 * on every desktop browser also offers "Save as PDF". Printed from a hidden frame that holds the PDF rather than from
 * the page itself, so the printout is the document and not the editor around it.
 *
 * No analytics: this tool has no event route of its own and a new one is not made for a button (decision 0202).
 */
export async function printInvoicePdf(sourceId: string): Promise<void> {
  const pdf = await buildInvoicePdf(sourceId);
  const url = URL.createObjectURL(pdf.output("blob"));
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  // Present and laid out (some browsers print nothing from a display:none frame), but never seen.
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
  const cleanup = () => {
    // After the dialog has had its chance to read the document; a print dialog holds on to it until it closes.
    window.setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };
  await new Promise<void>((resolve, reject) => {
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        resolve();
      } catch (e) {
        // A browser that will not print a PDF from a frame: show the PDF itself, where its own Print is one click away.
        window.open(url, "_blank", "noopener");
        resolve();
        console.error("PDF print from a frame failed", e);
      } finally {
        cleanup();
      }
    };
    frame.onerror = () => {
      frame.remove();
      URL.revokeObjectURL(url);
      reject(new Error("print frame failed"));
    };
    frame.src = url;
    document.body.appendChild(frame);
  });
}
