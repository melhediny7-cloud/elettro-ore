import { WorkLogEntry, WorkerProfile } from "./api";
import { getDayNameIT } from "./italian";

export function generateExcelReport(
  monthlyLogs: WorkLogEntry[],
  workers: WorkerProfile[],
  selectedMonthName: string,
  selectedYear: number,
  workerNameFilter: string,
  companyName: string
) {
  const sanitize = (text: string | null | undefined) => {
    if (!text) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  };

  const totalHours = monthlyLogs.reduce((acc, log) => acc + (parseFloat(log.totalHours) || 0), 0);
  const totalDays = monthlyLogs.length;
  const overtimeHours = monthlyLogs
    .filter((l) => l.workType === "Straordinario")
    .reduce((acc, l) => acc + (parseFloat(l.totalHours) || 0), 0);

  const totalPay = monthlyLogs.reduce((acc, log) => {
    let rate = 15.0;
    if (log.hourlyRate) {
      rate = parseFloat(String(log.hourlyRate)) || 15.0;
    } else {
      const mw = workers.find((w) => w.id === log.workerId || w.name === log.workerName);
      if (mw) rate = parseFloat(mw.hourlyRate) || 15.0;
    }
    const hours = parseFloat(log.totalHours) || 0;
    return acc + (log.totalPay ? parseFloat(log.totalPay) : rate * hours);
  }, 0);

  const rowsXml = monthlyLogs.map((log) => {
    const dayName = getDayNameIT(log.date);
    const isWeekend = dayName === "Sabato" || dayName === "Domenica";
    let rate = "15.00";
    if (log.hourlyRate) {
      rate = String(log.hourlyRate);
    } else {
      const mw = workers.find((w) => w.id === log.workerId || w.name === log.workerName);
      if (mw) rate = mw.hourlyRate;
    }
    const hours = parseFloat(log.totalHours) || 0;
    const pay = log.totalPay ? parseFloat(log.totalPay) : hours * parseFloat(rate);
    const styleId = isWeekend ? "WeekendRow" : "DataRow";

    return `
      <Row ss:StyleID="${styleId}">
        <Cell><Data ss:Type="String">${sanitize(log.workerName || "Mario Rossi")}</Data></Cell>
        <Cell><Data ss:Type="String">${sanitize(log.date)}</Data></Cell>
        <Cell><Data ss:Type="String">${sanitize(dayName)}</Data></Cell>
        <Cell><Data ss:Type="String">${sanitize(log.startTime)}</Data></Cell>
        <Cell><Data ss:Type="String">${sanitize(log.endTime || "-")}</Data></Cell>
        <Cell><Data ss:Type="Number">${log.breakMinutes || 0}</Data></Cell>
        <Cell><Data ss:Type="Number">${hours.toFixed(2)}</Data></Cell>
        <Cell><Data ss:Type="Number">${parseFloat(rate).toFixed(2)}</Data></Cell>
        <Cell><Data ss:Type="Number">${pay.toFixed(2)}</Data></Cell>
        <Cell><Data ss:Type="String">${sanitize(log.workType)}</Data></Cell>
        <Cell><Data ss:Type="String">${sanitize(log.locationName || "")}</Data></Cell>
        <Cell><Data ss:Type="String">${sanitize(log.address || "")}</Data></Cell>
        <Cell><Data ss:Type="String">${sanitize(log.notes || "")}</Data></Cell>
      </Row>`;
  }).join("");

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>${sanitize(companyName)}</Author>
  <Created>${new Date().toISOString()}</Created>
  <Company>${sanitize(companyName)}</Company>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="TitleStyle">
   <Font ss:FontName="Segoe UI" ss:Size="16" ss:Bold="1" ss:Color="#0F172A"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="SubtitleStyle">
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Italic="1" ss:Color="#475569"/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#334155"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#334155"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#334155"/>
   </Borders>
  </Style>
  <Style ss:ID="DataRow">
   <Font ss:FontName="Segoe UI" ss:Size="10"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="WeekendRow">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#B45309"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDE68A"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDE68A"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDE68A"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDE68A"/>
   </Borders>
  </Style>
  <Style ss:ID="TotalRow">
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0F172A"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0F172A"/>
   </Borders>
  </Style>
  <Style ss:ID="SummaryLabel">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#334155"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="SummaryValue">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
 </Styles>

 <Worksheet ss:Name="Dettaglio Ore">
  <Table ss:ExpandedColumnCount="13" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="20">
   <Column ss:Width="120"/>
   <Column ss:Width="80"/>
   <Column ss:Width="75"/>
   <Column ss:Width="65"/>
   <Column ss:Width="65"/>
   <Column ss:Width="75"/>
   <Column ss:Width="75"/>
   <Column ss:Width="90"/>
   <Column ss:Width="100"/>
   <Column ss:Width="95"/>
   <Column ss:Width="130"/>
   <Column ss:Width="180"/>
   <Column ss:Width="150"/>

   <Row ss:Height="28">
    <Cell ss:MergeAcross="12" ss:StyleID="TitleStyle">
     <Data ss:Type="String">REPORT MENSILE ORE DI LAVORO - ${sanitize(companyName)}</Data>
    </Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:MergeAcross="12" ss:StyleID="SubtitleStyle">
     <Data ss:Type="String">Mese: ${sanitize(selectedMonthName)} ${selectedYear} | Dipendente / Filtro: ${sanitize(workerNameFilter)}</Data>
    </Cell>
   </Row>
   <Row ss:Height="10"/>

   <Row ss:Height="24" ss:StyleID="HeaderStyle">
    <Cell><Data ss:Type="String">Lavoratore</Data></Cell>
    <Cell><Data ss:Type="String">Data</Data></Cell>
    <Cell><Data ss:Type="String">Giorno</Data></Cell>
    <Cell><Data ss:Type="String">Inizio</Data></Cell>
    <Cell><Data ss:Type="String">Fine</Data></Cell>
    <Cell><Data ss:Type="String">Pausa (min)</Data></Cell>
    <Cell><Data ss:Type="String">Ore Nette</Data></Cell>
    <Cell><Data ss:Type="String">Tariffa (€/h)</Data></Cell>
    <Cell><Data ss:Type="String">Compenso (€)</Data></Cell>
    <Cell><Data ss:Type="String">Tipo Lavoro</Data></Cell>
    <Cell><Data ss:Type="String">Cantiere</Data></Cell>
    <Cell><Data ss:Type="String">Indirizzo GPS</Data></Cell>
    <Cell><Data ss:Type="String">Note</Data></Cell>
   </Row>

   ${rowsXml}

   <Row ss:Height="24" ss:StyleID="TotalRow">
    <Cell><Data ss:Type="String">TOTALI GENERALI</Data></Cell>
    <Cell><Data ss:Type="String">${totalDays} giorni</Data></Cell>
    <Cell><Data ss:Type="String">-</Data></Cell>
    <Cell><Data ss:Type="String">-</Data></Cell>
    <Cell><Data ss:Type="String">-</Data></Cell>
    <Cell><Data ss:Type="String">-</Data></Cell>
    <Cell><Data ss:Type="Number">${totalHours.toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="String">-</Data></Cell>
    <Cell><Data ss:Type="Number">${totalPay.toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="String">-</Data></Cell>
    <Cell><Data ss:Type="String">-</Data></Cell>
    <Cell><Data ss:Type="String">-</Data></Cell>
    <Cell><Data ss:Type="String">Straordinari: ${overtimeHours.toFixed(2)}h</Data></Cell>
   </Row>
  </Table>
 </Worksheet>

 <Worksheet ss:Name="Riepilogo e Statistiche">
  <Table ss:ExpandedColumnCount="4" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="22">
   <Column ss:Width="180"/>
   <Column ss:Width="150"/>
   <Column ss:Width="180"/>
   <Column ss:Width="150"/>

   <Row ss:Height="28">
    <Cell ss:MergeAcross="3" ss:StyleID="TitleStyle">
     <Data ss:Type="String">RIEPILOGO MENSILE E STATISTICHE</Data>
    </Cell>
   </Row>
   <Row ss:Height="12"/>

   <Row>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">Azienda</Data></Cell>
    <Cell ss:StyleID="SummaryValue"><Data ss:Type="String">${sanitize(companyName)}</Data></Cell>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">Mese di Riferimento</Data></Cell>
    <Cell ss:StyleID="SummaryValue"><Data ss:Type="String">${sanitize(selectedMonthName)} ${selectedYear}</Data></Cell>
   </Row>

   <Row>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">Dipendente</Data></Cell>
    <Cell ss:StyleID="SummaryValue"><Data ss:Type="String">${sanitize(workerNameFilter)}</Data></Cell>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">Giorni Lavorati</Data></Cell>
    <Cell ss:StyleID="SummaryValue"><Data ss:Type="Number">${totalDays}</Data></Cell>
   </Row>

   <Row>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">Totale Ore Lavorate</Data></Cell>
    <Cell ss:StyleID="SummaryValue"><Data ss:Type="Number">${totalHours.toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">Ore di Straordinario</Data></Cell>
    <Cell ss:StyleID="SummaryValue"><Data ss:Type="Number">${overtimeHours.toFixed(2)}</Data></Cell>
   </Row>

   <Row>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">Media Ore Giornaliere</Data></Cell>
    <Cell ss:StyleID="SummaryValue"><Data ss:Type="Number">${totalDays > 0 ? (totalHours / totalDays).toFixed(2) : "0.00"}</Data></Cell>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">Totale Compenso Maturato</Data></Cell>
    <Cell ss:StyleID="SummaryValue"><Data ss:Type="String">€ ${totalPay.toFixed(2)}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xmlContent], { type: "application/vnd.ms-excel;charset=utf-8" });
  const filename = `Report_Ore_${workerNameFilter.replace(/\s+/g, "_")}_${selectedMonthName}_${selectedYear}.xls`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
