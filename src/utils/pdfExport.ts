import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function generatePdfBlobFromElement(
  element: HTMLElement,
  fileName: string
): Promise<{ blob: Blob; file: File }> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    windowWidth: element.scrollWidth,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
    heightLeft -= pageHeight;
  }

  const cleanName = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  pdf.save(cleanName);

  const blob = pdf.output("blob");
  const file = new File([blob], cleanName, { type: "application/pdf" });

  return { blob, file };
}

export async function sharePdfToWhatsApp(options: {
  element: HTMLElement;
  fileName: string;
  phone: string;
  workerName: string;
  monthName: string;
  year: number;
  totalHours: string;
  totalDays: number;
  lang: "it" | "ar";
}): Promise<void> {
  const {
    element,
    fileName,
    phone,
    workerName,
    monthName,
    year,
    totalHours,
    totalDays,
    lang,
  } = options;

  const { file } = await generatePdfBlobFromElement(element, fileName);

  const canShareFiles =
    typeof navigator !== "undefined" &&
    !!navigator.canShare &&
    navigator.canShare({ files: [file] });

  if (canShareFiles) {
    try {
      await navigator.share({
        files: [file],
        title: lang === "ar" ? `استمارة ساعات ${workerName}` : `Scheda Ore - ${workerName}`,
        text:
          lang === "ar"
            ? `📄 استمارة ساعات العمل لشهر ${monthName} ${year} - العامل: ${workerName} (${totalHours} ساعة)`
            : `📄 Scheda ore ${monthName} ${year} - ${workerName} (${totalHours} ore)`,
      });
      return;
    } catch (e: any) {
      if (e?.name === "AbortError") return;
    }
  }

  const cleanPhone = phone.replace(/[^0-9+]/g, "");
  const note =
    lang === "ar"
      ? `📄 *استمارة ساعات العمل الرسمية (PDF)*\n━━━━━━━━━━━━━━━━━━━━━\n👤 *العامل:* ${workerName}\n📅 *الشهر:* ${monthName} ${year}\n⏱️ *إجمالي الساعات:* ${totalHours} ساعة\n🗓️ *أيام العمل:* ${totalDays} يوم\n━━━━━━━━━━━━━━━━━━━━━\n📎 *تم تجهيز وتحميل ملف الاستمارة (PDF).* يرجى التكرم بالاطلاع عليه والتوقيع والاعتماد.\n_— ElettroOre Italia_`
      : `📄 *SCHEDA ORE DI LAVORO UFFICIALE (PDF)*\n━━━━━━━━━━━━━━━━━━━━━\n👤 *Lavoratore:* ${workerName}\n📅 *Mese:* ${monthName} ${year}\n⏱️ *Ore Totali:* ${totalHours} h\n🗓️ *Giorni Lavorati:* ${totalDays}\n━━━━━━━━━━━━━━━━━━━━━\n📎 *Il file PDF della scheda è stato generato e scaricato.* Si prega di verificare e approvare.\n_— ElettroOre Italia_`;

  const waUrl = cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(note)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(note)}`;

  window.open(waUrl, "_blank");
}

