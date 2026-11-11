/**
 * Exportação do acompanhamento (XLS e imagem).
 */

// ---------- Exportar Acompanhamento em XLS (abre direto no Excel / Google Planilhas) ----------
function exportPeriodXls() {
  const table = document.querySelector('#analysis-period-content table.period-sheet');
  if (!table) return alert('Não há planilha de acompanhamento para exportar. Cadastre um período na aba Período.');

  const cycle = DB.getCycles().find(c => c.id === analysisPeriodCycleId);
  const team = DB.getTeams()[session.teamCode];
  const sel = id => { const el = document.getElementById(id); return el && el.selectedIndex >= 0 ? el.options[el.selectedIndex].text : ''; };
  const scopeText = (document.getElementById('analysis-scope-label')?.textContent || '').trim();
  const esc = escapeHtml;
  const TIME = /^\d+:\d{2}:\d{2}$/;

  const cellHtml = (cell, isHead) => {
    const tag = isHead ? 'th' : 'td';
    let text;
    if (isHead) {
      const small = cell.querySelector('small');
      const main = Array.from(cell.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
      text = small ? `${main} (${small.textContent.trim()})` : cell.textContent.trim();
    } else {
      text = cell.textContent.replace('*', '').trim();
    }
    const flagged = !isHead && !!cell.querySelector('.min-flag');
    const colspan = cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : '';
    let style = 'border:1px solid #c9d3df;padding:4px 8px;';
    if (isHead) style += 'background:#e1e6ed;color:#23262f;font-weight:bold;text-align:center;';
    else if (cell.classList.contains('member-col') || cell.classList.contains('foot-label')) style += 'font-weight:bold;text-align:left;';
    else style += 'text-align:center;';
    if (flagged) style += 'background:#fff1b8;';
    if (cell.classList.contains('is-done')) style += 'color:#2f7d4f;font-weight:bold;';
    if (!isHead && TIME.test(text)) style += "mso-number-format:'\\[h\\]\\:mm\\:ss';";
    else style += "mso-number-format:'\\@';";
    return `<${tag}${colspan} style="${style}">${esc(text)}</${tag}>`;
  };
  const rowsHtml = sel => Array.from(table.querySelectorAll(sel)).map(tr => {
    const isHead = !!tr.closest('thead');
    return `<tr>${Array.from(tr.children).map(c => cellHtml(c, isHead)).join('')}</tr>`;
  }).join('');

  const info = [
    ['Equipe', team?.name || ''],
    ['Período', cycle ? `${fmtBR(cycle.startDate)} a ${fmtBR(cycle.endDate)}` : ''],
    ['Quem', scopeText],
    ['Cargo/Projeto', sel('analysis-cargo')],
    ['Local', sel('analysis-modalidade')],
    ['Gerado em', new Date().toLocaleString('pt-BR')]
  ].map(([k, v]) => `<tr><td style="font-weight:bold;border:none;">${esc(k)}</td><td colspan="4" style="border:none;text-align:left;">${esc(v)}</td></tr>`).join('');

  const legend = table.querySelector('td .min-flag') ? '<tr><td colspan="6" style="border:none;color:#7a5b00;">Células em amarelo: abaixo do mínimo semanal.</td></tr>' : '';

  const html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8">'
    + '<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Acompanhamento</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->'
    + '</head><body><table>'
    + `<tr><td colspan="6" style="font-size:16px;font-weight:bold;border:none;">PETimer — Acompanhamento</td></tr>${info}<tr><td colspan="6" style="border:none;"></td></tr>`
    + `<thead>${rowsHtml('thead tr')}</thead><tbody>${rowsHtml('tbody tr')}${rowsHtml('tfoot tr')}</tbody>`
    + `<tr><td colspan="6" style="border:none;"></td></tr>${legend}</table></body></html>`;

  const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PETimer_acompanhamento${cycle ? `_${cycle.startDate}_${cycle.endDate}` : ''}.xls`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function exportCurrentAnalysis() {
  if (analysisMode === 'period') return exportPeriodXls();
  const entries=getAnalysisFilteredEntries();
  if(!entries.length) return alert('Não há registros para exportar neste período.');

  // Abre a janela imediatamente (mantém o gesto do clique e evita bloqueio de pop-up).
  const win=window.open('', '_blank');
  if(!win) return alert('O navegador bloqueou a janela de exportação. Permita pop-ups para o PETimer e tente novamente.');

  const {start,end}=analysisWeekRange();
  const total=uniqueWorkMs(entries);
  const colors=['#276097','#4f8ec7','#7b61a8','#2f8a70','#c58a2d','#b85c69','#557c8d','#6a8f3f','#8b6d52','#4a6fa5','#a15f9d','#3d8b91'];
  const colorFor=(key,index)=>{
    const known=getCargoColor(key);
    return known || colors[index % colors.length];
  };
  const pct=(value)=> total ? (value/total*100) : 0;
  const formatDate=(d)=>`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  const shortDate=(d)=>`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  const dayNames=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

  const daily=Array.from({length:7},(_,i)=>({date:new Date(start.getFullYear(),start.getMonth(),start.getDate()+i),total:0}));
  const effective = effectiveWorkDurations(entries);
  const cargoTotals={};
  const descTotals={};
  entries.forEach((e,idx)=>{
    const dur=effective.get(e)||0;
    const d=new Date(e.date+'T12:00:00');
    const dayIndex=Math.round((startOfDay(d)-startOfDay(start))/86400000);
    if(dayIndex>=0 && dayIndex<7) daily[dayIndex].total+=dur;
    const cargo=e.cargo||'Sem cargo';
    if(!cargoTotals[cargo]) cargoTotals[cargo]={duration:0,color:colorFor(cargo,Object.keys(cargoTotals).length)};
    cargoTotals[cargo].duration+=dur;
    const desc=(e.activity||'Sem descrição').trim() || 'Sem descrição';
    if(!descTotals[desc]) descTotals[desc]={duration:0,color:colors[Object.keys(descTotals).length % colors.length]};
    descTotals[desc].duration+=dur;
  });

  const cargoRows=Object.entries(cargoTotals).sort((a,b)=>b[1].duration-a[1].duration);
  const descRows=Object.entries(descTotals).sort((a,b)=>b[1].duration-a[1].duration);
  const maxDaily=Math.max(...daily.map(d=>d.total),3600000);

  const donutStyle=(rows)=>{
    let angle=0;
    const parts=[];
    rows.forEach(([name,o])=>{
      const next=angle+(total?o.duration/total*360:0);
      parts.push(`${o.color} ${angle}deg ${next}deg`);
      angle=next;
    });
    return parts.length?`conic-gradient(${parts.join(',')})`:'#e9edf2';
  };

  const rowsHtml=(rows)=>rows.map(([name,o])=>`<div class="metric-row"><span class="dot" style="background:${o.color}"></span><span class="metric-name">${escapeHtml(name)}</span><span class="metric-time">${fmtClock(o.duration)}</span><span class="metric-pct">${pct(o.duration).toFixed(2).replace('.',',')}%</span></div>`).join('');

  const sorted=[...entries].sort((a,b)=>(a.cargo||'').localeCompare(b.cargo||'','pt-BR') || (b.date||'').localeCompare(a.date||'') || (b.startTime||'').localeCompare(a.startTime||''));
  const detailRows=sorted.map(e=>`<tr><td>${escapeHtml(e.cargo||'Sem cargo')}</td><td>${escapeHtml((e.activity||'Sem descrição').trim()||'Sem descrição')}</td><td>${escapeHtml(reportMemberName(e.user))}</td><td>${e.date?e.date.split('-').reverse().join('/'):'—'}</td><td>${escapeHtml(e.startTime||'—')} - ${escapeHtml(e.endTime||'—')}</td><td class="right">${fmtClock(Number(e.duration)||0)}</td></tr>`).join('');

  const reportHtml=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PETimer - Relatório</title>
      <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"><\/script>
      <style>
        *{box-sizing:border-box} html,body{margin:0;background:#eef2f6;color:#1f2937;font-family:Inter,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .toolbar{position:sticky;top:0;z-index:5;display:flex;justify-content:flex-end;gap:10px;padding:12px 18px;background:#fff;border-bottom:1px solid #dbe2ea}
        .toolbar button{height:38px;border-radius:8px;padding:0 15px;border:1px solid #b9cce0;background:#fff;color:#1f5f99;font:600 13px/1 Arial;cursor:pointer}.toolbar button.primary{background:#276097;color:#fff;border-color:#276097}
        #report{width:1120px;max-width:calc(100vw - 32px);margin:20px auto;background:#fff;box-shadow:0 6px 24px rgba(15,23,42,.08);padding:42px 48px 34px}
        .head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px}.brand{width:190px;flex:0 0 190px}.brand img{display:block;width:100%;height:auto}.title{font-size:30px;font-weight:700;margin:0 0 8px}.period{font-size:13px;color:#6b7280}.total-line{margin-top:14px;font-size:14px;color:#6b7280}.total-line strong{font-size:20px;color:#111827;margin-left:6px}
        .section{margin-top:34px}.section-title{font-size:19px;font-weight:700;margin:0 0 13px;padding-bottom:8px;border-bottom:1px solid #d9e0e7}
        .bars-wrap{height:300px;display:grid;grid-template-columns:54px 1fr;gap:10px;margin-top:10px}.axis{position:relative;border-right:1px solid #e7ebf0}.axis span{position:absolute;right:10px;color:#8792a0;font-size:11px;transform:translateY(50%)}
        .bars{display:grid;grid-template-columns:repeat(7,1fr);align-items:end;gap:18px;border-bottom:1px solid #dfe5eb;background:repeating-linear-gradient(to top,transparent 0,transparent 24.7%,#eef2f6 25%,transparent 25.3%);padding:0 14px}.day{height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;position:relative}.bar{width:72%;min-width:42px;max-width:78px;background:#7facd2;border-radius:3px 3px 0 0;position:relative}.bar-label{position:absolute;top:-22px;left:50%;transform:translateX(-50%);font-size:11px;color:#66717f;white-space:nowrap}.day-label{height:34px;padding-top:9px;font-size:11px;color:#586473;white-space:nowrap}
        .split{display:grid;grid-template-columns:270px 1fr;gap:38px;align-items:center}.donut{width:210px;height:210px;border-radius:50%;position:relative;margin:4px auto}.donut:after{content:"";position:absolute;inset:47px;border-radius:50%;background:#fff}.donut-center{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:1;font-weight:700;font-size:17px}
        .metric-list{border-top:1px solid #e5e9ee}.metric-row{display:grid;grid-template-columns:12px minmax(0,1fr) 90px 70px;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid #e9edf2;font-size:12px}.dot{width:7px;height:7px;border-radius:50%}.metric-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.metric-time,.metric-pct{text-align:right;font-variant-numeric:tabular-nums}.metric-pct{color:#6b7280}
        table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}th{background:#f3f6f9;text-align:left;padding:9px 8px;border-bottom:1px solid #d8e0e8;color:#52606f}td{padding:8px;border-bottom:1px solid #edf1f4;vertical-align:top}.right{text-align:right;font-variant-numeric:tabular-nums}.foot{margin-top:28px;padding-top:12px;border-top:1px solid #e4e8ed;color:#8b95a3;font-size:10px;display:flex;justify-content:space-between}
        @media print{body{background:#fff}.toolbar{display:none}#report{width:auto;max-width:none;margin:0;box-shadow:none;padding:12mm 12mm 10mm}.section{break-inside:avoid}.details{break-inside:auto}thead{display:table-header-group}tr{break-inside:avoid}.foot{position:relative}@page{size:A4 portrait;margin:0}}
      </style><style id="timer-digits-size">
#view-tracker .tracker-bar #timer-digits{font-size:18px;}
</style>
</head><body>
      <div class="toolbar"><button onclick="downloadPng()">BAIXAR IMAGEM (PNG)</button><button class="primary" onclick="printReport()">SALVAR COMO PDF</button></div>
      <main id="report">
        <div class="head"><div><h1 class="title">Relatório resumo</h1><div class="period">${formatDate(start)} - ${formatDate(end)}</div><div class="total-line">Total:<strong>${fmtClock(total)}</strong></div></div><div class="brand"><img id="report-brand-logo" src="${escapeHtml(getLightBrandLogo())}" width="1177" height="552" alt="PETimer"></div></div>
        <section class="section"><h2 class="section-title">Horas por dia</h2><div class="bars-wrap"><div class="axis"><span style="bottom:0">0h</span><span style="bottom:25%">${(maxDaily/3600000*.25).toFixed(1).replace('.',',')}h</span><span style="bottom:50%">${(maxDaily/3600000*.5).toFixed(1).replace('.',',')}h</span><span style="bottom:75%">${(maxDaily/3600000*.75).toFixed(1).replace('.',',')}h</span><span style="bottom:100%">${(maxDaily/3600000).toFixed(1).replace('.',',')}h</span></div><div class="bars">${daily.map((d,i)=>`<div class="day"><div class="bar" style="height:${Math.max(d.total?4:0,d.total/maxDaily*88)}%"><span class="bar-label">${fmtClock(d.total)}</span></div><div class="day-label">${dayNames[i]}, ${shortDate(d.date)}</div></div>`).join('')}</div></div></section>
        <section class="section"><h2 class="section-title">Cargo / Projeto</h2><div class="split"><div class="donut" style="background:${donutStyle(cargoRows)}"><div class="donut-center">${fmtClock(total)}</div></div><div class="metric-list">${rowsHtml(cargoRows)}</div></div></section>
        <section class="section"><h2 class="section-title">Descrição</h2><div class="split"><div class="donut" style="background:${donutStyle(descRows)}"><div class="donut-center">${fmtClock(total)}</div></div><div class="metric-list">${rowsHtml(descRows)}</div></div></section>
        <section class="section details"><h2 class="section-title">Registros detalhados</h2><table><thead><tr><th>Cargo/Projeto</th><th>Descrição</th><th>Membro</th><th>Data</th><th>Horário</th><th class="right">Duração</th></tr></thead><tbody>${detailRows}</tbody></table></section>
        <div class="foot"><span>PETimer - ${escapeHtml(session.teamCode||'Equipe')}</span><span>Gerado em ${new Date().toLocaleString('pt-BR')}</span></div>
      </main>
      <script>
        async function ensureReportLogo(){
          const logo=document.getElementById('report-brand-logo');
          await logo.decode();
        }
        async function printReport(){
          try{await ensureReportLogo();window.print();}
          catch(e){alert('Não foi possível carregar a logo do relatório. Tente novamente.');}
        }
        async function downloadPng(){
          if(typeof html2canvas!=='function'){alert('Não foi possível carregar o gerador de imagem. Verifique sua conexão e tente novamente.');return;}
          const btns=document.querySelector('.toolbar'); btns.style.display='none';
          try{
            await ensureReportLogo();
            const canvas=await html2canvas(document.getElementById('report'),{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false});
            const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='PETimer_relatorio_${localDateStr(new Date())}.png';a.click();
          }catch(e){alert('Não foi possível gerar a imagem deste relatório.');}
          finally{btns.style.display='flex';}
        }
      <\/script></body></html>`;

  win.document.open();
  win.document.write(reportHtml);
  win.document.close();
}
