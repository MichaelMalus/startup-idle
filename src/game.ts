import * as D from './data';
import type { Role, Mods } from './data';

export interface Team { id: number; name: string; eng: number; qa: number; ops: number; mgr: number }
export interface ServiceState { level: number; team: number | null }
export interface State {
  version: number; day: number; era: D.Era;
  sloc: number; cash: number; hype: number; users: number; bugs: number; debt: number;
  funding: number; equity: number; desksBought: number; floors: number;
  research: string[]; teams: Team[]; nextTeamId: number; services: Record<string, ServiceState>;
  reputation: number; exits: number; log: string[]; lastSaved: number; nextEvent: number;
}

const SAVE_KEY = 'startup-idle-save';
const TEAM_NAMES = ['Core', 'Platform', 'Growth', 'Web', 'Infra', 'Payments', 'Mobile', 'Search', 'Tiger team', 'Special projects'];

export function newState(reputation = 0, exits = 0): State {
  return {
    version: 1, day: 0, era: 'garage', sloc: 0, cash: D.START_CASH * (1 + reputation * 0.1), hype: 0, users: 0,
    bugs: 0, debt: 0, funding: 0, equity: 1, desksBought: 0, floors: 0, research: [], teams: [],
    nextTeamId: 1, services: {}, reputation, exits, log: [], lastSaved: Date.now(), nextEvent: 60,
  };
}

export interface Rates {
  sloc: number; bugsIn: number; bugsOut: number; debt: number; opsCap: number; load: number; uptime: number;
  userTarget: number; revenue: number; salaries: number; infra: number; rent: number; hype: number; burn: number;
}

export class Game {
  s: State;
  onLog: (msg: string) => void = () => {};
  constructor(s?: State) { this.s = s ?? newState(); }

  has(id: string) { return this.s.research.includes(id); }
  mods(): Mods {
    const m = D.baseMods();
    for (const id of this.s.research) D.RESEARCH[id]?.effect?.(m);
    return m;
  }
  repMult() { return 1 + this.s.reputation * 0.05; }
  headcount() { return this.s.teams.reduce((n, t) => n + t.eng + t.qa + t.ops + t.mgr, 0); }
  desks() { return D.START_DESKS + this.s.desksBought + this.s.floors * D.OFFICE_FLOOR.desks; }
  deskCost() { return D.DESK_BASE_COST * Math.pow(D.DESK_GROWTH, this.s.desksBought) * this.mods().deskCost; }
  teamSize(t: Team) { return t.eng + t.qa + t.ops + t.mgr; }
  teamEff(t: Team) {
    const limit = D.TEAM_SIZE_LIMIT + t.mgr * D.MGR_SIZE_BONUS;
    const size = this.teamSize(t);
    return size <= limit ? 1 : limit / size;
  }
  teamCapacity(t: Team) { return 1 + Math.floor(t.eng / 2); }
  teamOwned(t: Team) { return Object.values(this.s.services).filter(sv => sv.team === t.id).length; }
  roleUnlocked(r: Role) { const u = D.ROLES[r].unlock; return this.has('incorporate') && (!u || this.has(u)); }
  serviceUnlocked(id: string) { const u = D.SERVICES[id].unlock; return !u || this.has(u); }
  serviceCost(id: string) {
    const lvl = this.s.services[id]?.level ?? 0;
    return D.SERVICES[id].sloc * Math.pow(D.SERVICE_LEVEL_COST, lvl) * this.mods().serviceCost;
  }
  // Services owned by a team within its capacity run at full speed; others at 25%.
  serviceEff(id: string) {
    const sv = this.s.services[id];
    if (!sv || sv.team === null) return 0.25;
    const t = this.s.teams.find(x => x.id === sv.team);
    if (!t) return 0.25;
    const owned = Object.entries(this.s.services).filter(([, x]) => x.team === t.id).map(([k]) => k);
    return owned.indexOf(id) < this.teamCapacity(t) ? 1 : 0.25;
  }

  rates(): Rates {
    const m = this.mods(), s = this.s, rep = this.repMult();
    const debtPen = 1 / (1 + s.debt / D.DEBT_SCALE);
    let sloc = D.FOUNDERS * D.FOUNDER_SLOC * m.founderMult * debtPen * rep;
    let bugsOut = 0, opsCap = D.FOUNDERS * D.FOUNDER_OPS * m.opsMult, salaries = 0;
    for (const t of s.teams) {
      const eff = this.teamEff(t);
      sloc += t.eng * D.ENG_SLOC * m.engMult * eff * debtPen * rep;
      bugsOut += t.qa * 2 * m.qaMult * eff;
      opsCap += t.ops * 3 * m.opsMult * eff;
      for (const r of Object.keys(D.ROLES) as Role[]) salaries += t[r] * D.ROLES[r].salary * m.salaryMult;
    }
    let load = 0, userTarget = 0;
    for (const [id, sv] of Object.entries(s.services)) {
      const def = D.SERVICES[id];
      load += def.load * sv.level;
      userTarget += def.users * Math.pow(D.SERVICE_LEVEL_USERS, sv.level - 1) * this.serviceEff(id);
    }
    const uptime = load === 0 ? 1 : Math.min(1, opsCap / load);
    userTarget *= m.usersMult * uptime / (1 + s.bugs / D.BUG_SCALE) * rep;
    const revenue = s.users * m.arpu * uptime;
    const infra = load * D.INFRA_PER_LOAD;
    const rent = s.floors * D.OFFICE_FLOOR.rent;
    const hype = s.users * D.HYPE_PER_USER * m.hypeMult;
    return {
      sloc, bugsIn: sloc * D.BUGS_PER_SLOC * m.bugMult, bugsOut, debt: sloc * D.DEBT_PER_SLOC * m.debtMult,
      opsCap, load, uptime, userTarget, revenue, salaries, infra, rent, hype,
      burn: salaries + infra + rent - revenue,
    };
  }

  tick(dt: number) {
    const s = this.s, r = this.rates();
    s.day += dt;
    s.sloc += r.sloc * dt;
    s.bugs = Math.max(0, s.bugs + (r.bugsIn - r.bugsOut) * dt);
    s.debt += r.debt * dt;
    s.users += (r.userTarget - s.users) * Math.min(1, D.USER_GROWTH * dt);
    s.hype += r.hype * dt;
    s.cash -= r.burn * dt;
    s.nextEvent -= dt;
    if (s.nextEvent <= 0) {
      s.nextEvent = 60 + Math.random() * 90;
      const pool = D.EVENTS.filter(e => !e.when || e.when(this));
      const e = pool[Math.floor(Math.random() * pool.length)];
      e.apply(this); this.log(e.msg);
    }
    if (s.cash < 0) this.exit('bankrupt');
  }

  log(msg: string) {
    this.s.log.unshift(`Day ${Math.floor(this.s.day)}: ${msg}`);
    this.s.log.length = Math.min(this.s.log.length, 30);
    this.onLog(msg);
  }

  // ---- actions ----
  writeCode() { this.s.sloc += D.CLICK_SLOC * this.mods().founderMult * this.repMult(); }
  pitch() { this.s.hype += D.CLICK_HYPE * this.mods().hypeMult; }

  canResearch(id: string) {
    const d = D.RESEARCH[id], s = this.s;
    return !this.has(id) && this.researchVisible(id) && (d.funding === undefined || s.funding >= d.funding) && s.sloc >= (d.sloc ?? 0) && s.cash >= (d.cash ?? 0);
  }
  researchVisible(id: string) {
    const d = D.RESEARCH[id];
    if (this.has(id)) return false;
    if (d.era === 'dotcom' && this.s.era !== 'dotcom') return false;
    if (d.req && !d.req.every(r => this.has(r))) return false;
    return true;
  }
  research(id: string) {
    if (!this.canResearch(id)) return;
    const d = D.RESEARCH[id];
    this.s.sloc -= d.sloc ?? 0; this.s.cash -= d.cash ?? 0;
    this.s.research.push(id);
    if (d.dilution) this.s.equity *= 1 - d.dilution;
    if (id === 'dotcom') { this.s.era = 'dotcom'; this.log('Welcome to the dot-com boom. Profits are so last century.'); }
    else this.log(`Adopted ${d.name}.`);
  }

  nextRound() { return D.FUNDING[this.s.funding]; }
  canRaise() {
    const f = this.nextRound();
    return !!f && this.has('incorporate') && (!f.era || f.era === this.s.era) && this.s.hype >= f.hype && this.s.users >= f.users;
  }
  raise() {
    if (!this.canRaise()) return;
    const f = this.nextRound();
    this.s.hype -= f.hype; this.s.cash += f.cash; this.s.equity *= 1 - f.dilution; this.s.funding++;
    this.log(`Raised ${f.name}: ${fmtMoney(f.cash)} for ${Math.round(f.dilution * 100)}% of the company.`);
  }

  buyDesk() {
    const c = this.deskCost();
    if (!this.has('coworking') || this.s.cash < c) return;
    this.s.cash -= c; this.s.desksBought++;
  }
  leaseFloor() {
    if (!this.has('office') || this.s.cash < D.OFFICE_FLOOR.cost) return;
    this.s.cash -= D.OFFICE_FLOOR.cost; this.s.floors++;
    this.log('Signed a 10-year lease. Bean bags arrive Tuesday.');
  }

  newTeam() {
    if (!this.has('incorporate') || this.s.teams.length >= this.maxTeams()) return;
    const id = this.s.nextTeamId++;
    this.s.teams.push({ id, name: TEAM_NAMES[(id - 1) % TEAM_NAMES.length], eng: 0, qa: 0, ops: 0, mgr: 0 });
  }
  maxTeams() { return 1 + Math.floor(this.headcount() / 4); }
  hire(teamId: number, r: Role) {
    const t = this.s.teams.find(x => x.id === teamId);
    if (!t || !this.roleUnlocked(r) || this.headcount() >= this.desks() || this.s.cash < D.ROLES[r].fee) return;
    this.s.cash -= D.ROLES[r].fee; t[r]++;
  }
  fire(teamId: number, r: Role) {
    const t = this.s.teams.find(x => x.id === teamId);
    if (!t || t[r] <= 0) return;
    t[r]--;
  }
  disband(teamId: number) {
    const t = this.s.teams.find(x => x.id === teamId);
    if (!t || this.teamSize(t) > 0) return;
    this.s.teams = this.s.teams.filter(x => x !== t);
    for (const sv of Object.values(this.s.services)) if (sv.team === teamId) sv.team = null;
  }

  build(id: string) {
    const c = this.serviceCost(id);
    if (!this.serviceUnlocked(id) || this.s.sloc < c) return;
    this.s.sloc -= c;
    const sv = this.s.services[id];
    if (sv) { sv.level++; return; }
    const free = this.s.teams.find(t => this.teamOwned(t) < this.teamCapacity(t));
    this.s.services[id] = { level: 1, team: free?.id ?? null };
    this.log(`Shipped ${D.SERVICES[id].name}.`);
  }
  assign(id: string, teamId: number | null) { const sv = this.s.services[id]; if (sv) sv.team = teamId; }

  refactorCost() { return this.s.debt * 0.5; }
  refactor() {
    const c = this.refactorCost();
    if (this.s.debt < 1 || this.s.sloc < c) return;
    this.s.sloc -= c; this.s.debt = 0;
    this.log('Rewrote it all from scratch. This time it will be different.');
  }

  // ---- exits ----
  valuation() {
    const r = this.rates();
    const perUser = this.s.era === 'dotcom' ? 400 : 50; // eyeballs!
    return this.s.users * perUser + Math.max(0, r.revenue) * 365 * 10 + this.s.hype * 100;
  }
  canExit(kind: 'acquihire' | 'ipo') {
    if (kind === 'acquihire') return this.s.funding >= 2 && this.headcount() >= 5;
    return this.has('goldman') && this.s.funding >= 5;
  }
  exitTake(kind: 'acquihire' | 'ipo' | 'bankrupt') {
    if (kind === 'bankrupt') return 0;
    const value = kind === 'ipo' ? this.valuation() : this.headcount() * 150000;
    return value * this.s.equity;
  }
  reputationFor(kind: 'acquihire' | 'ipo' | 'bankrupt') {
    if (kind === 'bankrupt') return this.s.funding > 0 ? 1 : 0;
    return Math.floor(Math.sqrt(this.exitTake(kind) / 100000));
  }
  exit(kind: 'acquihire' | 'ipo' | 'bankrupt') {
    if (kind !== 'bankrupt' && !this.canExit(kind)) return;
    const rep = this.reputationFor(kind), s = this.s;
    const msg = kind === 'bankrupt'
      ? `Ran out of money on day ${Math.floor(s.day)}. Posted "10 lessons from my failed startup" on LinkedIn. +${rep} reputation.`
      : kind === 'ipo'
        ? `IPO! You walk away with ${fmtMoney(this.exitTake(kind))}. +${rep} reputation.`
        : `Acquihired! The product is shut down "to focus on our core mission". You get ${fmtMoney(this.exitTake(kind))}. +${rep} reputation.`;
    this.s = newState(s.reputation + rep, s.exits + 1);
    this.log(msg);
  }

  // ---- persistence ----
  save() { this.s.lastSaved = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.s)); } catch { /* ignore */ } }
  static load(): Game {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return new Game({ ...newState(), ...JSON.parse(raw) });
    } catch { /* ignore */ }
    return new Game();
  }
  exportSave() { return btoa(unescape(encodeURIComponent(JSON.stringify(this.s)))); }
  importSave(str: string) {
    const s = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
    this.s = { ...newState(), ...s };
  }
  reset() { this.s = newState(); try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }
  // Simulate time away, capped at 8 hours of real time.
  catchUp() {
    const secs = Math.min((Date.now() - this.s.lastSaved) / 1000, 8 * 3600);
    if (secs < 5) return 0;
    const before = this.s.exits;
    let left = secs;
    while (left > 0 && this.s.exits === before) { const dt = Math.min(1, left); this.tick(dt); left -= dt; }
    return secs;
  }
}

export function fmt(n: number, digits = 1): string {
  const a = Math.abs(n);
  if (a < 1000) return a < 10 && n % 1 !== 0 ? n.toFixed(digits) : Math.floor(n).toString();
  const units = ['k', 'M', 'B', 'T', 'Qa', 'Qi'];
  let i = -1, v = a;
  while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
  return (n < 0 ? '-' : '') + v.toFixed(v < 100 ? digits : 0) + units[i];
}
export const fmtMoney = (n: number) => (n < 0 ? '-$' : '$') + fmt(Math.abs(n));
