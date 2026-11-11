/**
 * Cache local dos dados da equipe, camada DB e cálculo de durações de trabalho.
 */

// ---------- CACHE LOCAL ----------
// Espelha, em memória, os dados da equipe atualmente aberta. Toda
// gravação (registros, períodos, equipe, etc.) é feita através de
// chamadas api(...) para a planilha; o cache é então atualizado a
// partir da resposta do servidor (refreshTeamData), então todas as
// funções de renderização abaixo continuam lendo daqui, sem saber
// que os dados na verdade vêm do Google Sheets.
let CACHE = { users: {}, teams: {}, entries: [], cycles: [], running: null, teamRunning: [], myTeams: [] };

const DB = {
  getUsers: () => CACHE.users,
  getTeams: () => CACHE.teams,
  saveTeams: (v) => { CACHE.teams = v; },
  getEntries: () => CACHE.entries,
  saveEntries: (v) => { CACHE.entries = v; },
  getRunning: () => CACHE.running,
  saveRunning: (v) => { CACHE.running = v; },
  getCycles: () => CACHE.cycles,
  saveCycles: (v) => { CACHE.cycles = v; }
};

/* HORAS REAIS: intervalos simultâneos do mesmo membro contam uma única vez.
     Os registros e suas durações individuais continuam intactos no backend.
     Para gráficos por categoria, divide cada trecho simultâneo igualmente entre
     as atividades ativas; assim, a soma das categorias equivale às horas reais. */
function workInterval(e) {
  if (!e || !e.date) return null;
  const start = String(e.startTime || '').match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!start) return null;
  const begin = (+start[1] * 3600 + +start[2] * 60 + +(start[3] || 0)) * 1000;
  if (!Number.isFinite(begin) || begin < 0 || begin >= 86400000) return null;
  let duration = Number(e.duration) || 0;
  if (e.isRunning && e.start) duration = Math.max(0, Date.now() - new Date(e.start).getTime());
  if (!Number.isFinite(duration) || duration <= 0) return null;
  // Backend divide registros que atravessam a meia-noite em partes diárias.
  // No caso de um cronômetro ainda aberto, não contabilizar além do dia local.
  return [begin, Math.min(86400000, begin + duration)];
}

function effectiveWorkDurations(entries) {
  const result = new Map();
  const groups = new Map();
  (entries || []).forEach(e => {
    result.set(e, 0);
    const interval = workInterval(e);
    if (!interval) {
      // Compatibilidade com registros antigos sem horários utilizáveis.
      result.set(e, Math.max(0, Number(e.duration) || 0));
      return;
    }
    const key = String(e.user || '') + '\x1f' + String(e.date || '');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ e, start: interval[0], end: interval[1] });
  });
  groups.forEach(items => {
    const boundaries = [...new Set(items.flatMap(x => [x.start, x.end]))].sort((a,b) => a-b);
    for (let i = 1; i < boundaries.length; i++) {
      const a = boundaries[i-1], b = boundaries[i];
      if (b <= a) continue;
      const active = items.filter(x => x.start < b && x.end > a);
      if (!active.length) continue;
      const portion = (b-a) / active.length;
      active.forEach(x => result.set(x.e, result.get(x.e) + portion));
    }
  });
  return result;
}

function uniqueWorkMs(entries) {
  let total = 0;
  effectiveWorkDurations(entries).forEach(ms => { total += ms; });
  return total;
}

function mapEntryFromServer(e) {
  return { id: e.entryId, user: e.user, teamCode: session.teamCode, activity: e.activity, cargo: e.cargo, cargoColor: e.cargoColor, modalidade: e.modalidade, date: e.date, startTime: e.startTime, endTime: e.endTime, duration: e.duration };
}
function mapCycleFromServer(c) {
  return { id: c.id, teamCode: session.teamCode, startDate: c.startDate, endDate: c.endDate, unit: c.unit, goalMinutes: Number(c.goalMinutes)||0, minimumMinutes: Number(c.minimumMinutes)||0, holidayWeeks: Array.isArray(c.holidayWeeks) ? c.holidayWeeks : [], createdBy: c.createdBy };
}
function mapTeamFromServer(team, members) {
  const membersObj = {};
  (members || []).forEach(m => { membersObj[m.username] = { sector: m.sector || 'Geral', role: m.role || (m.isOwner ? 'owner' : m.isAdmin ? 'admin' : 'member') }; });
  const sectors = normalizeTeamSectors(team.sectors, membersObj);
  Object.values(membersObj).forEach(member => {
    member.sector = sectors.find(name => name.toLocaleLowerCase('pt-BR') === String(member.sector).trim().toLocaleLowerCase('pt-BR')) || 'Geral';
  });
  return { name: team.name, admin: team.admin, cargos: team.cargos, modalidades: team.modalidades, adminParticipatesInCycle: team.adminParticipatesInCycle, sectors, members: membersObj };
}

// Busca o estado completo da equipe atual na planilha e atualiza o cache.
// Controle de gravações otimistas: enquanto houver gravação em andamento (ou se
// uma começar durante a busca), o resultado da busca é descartado para não
// "desfazer" na tela algo que o servidor ainda não terminou de salvar.
let writeSeq = 0;
let pendingWrites = 0;
async function refreshTeamData() {
  if (!session || !session.teamCode) return;
  if (pendingWrites > 0) return;
  const seq = writeSeq;
  const d = await api('getTeamBootstrap', { code: session.teamCode });
  if (pendingWrites > 0 || seq !== writeSeq) return;
  CACHE.teams[session.teamCode] = mapTeamFromServer(d.team, d.members);
  const myMembership = (d.members || []).find(m => m.username === session.username);
  const myTeam = (CACHE.myTeams || []).find(t => t.code === session.teamCode);
  if (myMembership && myTeam) {
    myTeam.isOwner = !!myMembership.isOwner;
    myTeam.isAdmin = !!myMembership.isAdmin;
  }
  CACHE.entries = (d.entries || []).map(mapEntryFromServer);
  CACHE.cycles = (d.cycles || []).map(mapCycleFromServer);
  CACHE.goals = Array.isArray(d.goals) ? d.goals : [];
  (d.members || []).forEach(m => { CACHE.users[m.username] = { username: m.username, name: m.displayName }; });
  const running = d.running || [];
  const mine = running.find(r => r.user === session.username);
  CACHE.running = mine ? { id: 'running', teamCode: session.teamCode, ...mine } : null;
  CACHE.teamRunning = running.filter(r => r.user !== session.username);
}
