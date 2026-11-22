import * as D from './data';
import type { Skill, Work, Mods } from './data';

export interface Worker {
  id: number; name: string; founder?: boolean; skills: Partial<Record<Skill, number>>;
  traits: string[]; salary: number; task: string; team: number | null;
}
export interface Team { id: number; name: string; task: string }
export interface Live { version: number; bugs: number }
export interface State {
  version: number; day: number; era: D.Era; cash: number; hype: number; users: number;
  funding: number; equity: number; desksBought: number; floors: number;
  done: string[]; progress: Record<string, Work>; pendingBugs: Record<string, number>;
  services: Record<string, Live>; workers: Worker[]; candidates: Worker[]; teams: Team[];
  nextId: number; nextCandidate: number; reputation: number; exits: number;
  log: string[]; lastSaved: number; nextEvent: number;
}

const SAVE_VERSION = 2;
const SAVE_KEY = 'startup-idle-save';
const TEAM_NAMES = ['Core', 'Platform', 'Growth', 'Web', 'Infra', 'Payments', 'Mobile', 'Search', 'Tiger team', 'Special projects'];
const SKILL_LIST = Object.keys(D.SKILLS) as Skill[];

export function newState(reputation = 0, exits = 0): State {
  return {
    version: SAVE_VERSION, day: 0, era: 'garage', cash: D.START_CASH * (1 + reputation * 0.1), hype: 0, users: 0,
    funding: 0, equity: 1, desksBought: 0, floors: 0, done: [], progress: {}, pendingBugs: {}, services: {},
    workers: [{ id: 1, name: 'You (Founder)', founder: true, skills: { coding: 1 }, traits: [], salary: 0, task: '', team: null }],
    candidates: [], teams: [], nextId: 2, nextCandidate: 0, reputation, exits, log: [], lastSaved: Date.now(), nextEvent: 40,
  };
}

export interface ServiceRates { target: number; uptime: number; load: number; capacity: number; fix: number; bugsIn: number }
export interface Rates {
  output: Map<number, string>; // per-worker summary
  projects: Record<string, Work>; // work per day going into each project
  services: Record<string, ServiceRates>;
  userTarget: number; hype: number; revenue: number; salaries: number; infra: number; rent: number; burn: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

export class Game {
  s: State;
  constructor(s?: State) { this.s = s ?? newState(); }

  has(id: string) { return id.startsWith('svc:') ? !!this.s.services[id.slice(4)] : this.s.done.includes(id); }
  reqsMet(req?: string[]) { return !req || req.every(r => this.has(r)); }
  mods(): Mods {
    const m = D.baseMods();
    for (const id of this.s.done) D.UPGRADES[id]?.effect?.(m);
    return m;
  }
  repMult() { return 1 + this.s.reputation * 0.05; }
  skillUnlocked(k: Skill) { const u = D.SKILLS[k].unlock; return !u || this.has(u); }
  headcount() { return this.s.workers.length; }
  desks() { return D.START_DESKS + this.s.desksBought + this.s.floors * D.OFFICE_FLOOR.desks; }
  deskCost() { return D.DESK_BASE_COST * Math.pow(D.DESK_GROWTH, this.s.desksBought); }
  trait(w: Worker, f: 'output' | 'learn' | 'bugs' | 'salary') {
    return w.traits.reduce((x, t) => x * (D.TRAITS[t][f] ?? 1), 1);
  }
  taskOf(w: Worker) {
    if (w.team !== null) { const t = this.s.teams.find(x => x.id === w.team); if (t) return t.task; }
    return w.task;
  }
  teamMembers(id: number) { return this.s.workers.filter(w => w.team === id); }
  teamLimit(id: number) {
    const mgmt = this.teamMembers(id).reduce((n, w) => n + (w.skills.management ?? 0), 0);
    return D.TEAM_LIMIT + mgmt * D.TEAM_LIMIT_PER_MGMT;
  }
  teamEff(id: number) {
    const ms = this.teamMembers(id), limit = this.teamLimit(id);
    const jerks = ms.filter(w => w.traits.includes('jerk')).length;
    return (ms.length <= limit ? 1 : limit / ms.length) * Math.pow(0.9, jerks);
  }

  // ---- projects ----
  workNeeded(key: string): Work {
    const [kind, id] = key.split(':');
    if (kind === 'tech') return D.UPGRADES[id].work ?? {};
    const def = D.SERVICES[id], v = this.s.services[id]?.version ?? 0;
    const w: Work = {};
    for (const k of Object.keys(def.work) as Skill[]) w[k] = def.work[k]! * Math.pow(D.VERSION_WORK, v);
    return w;
  }
  remaining(key: string): Work {
    const need = this.workNeeded(key), got = this.s.progress[key] ?? {}, r: Work = {};
    for (const k of Object.keys(need) as Skill[]) { const left = need[k]! - (got[k] ?? 0); if (left > 1e-9) r[k] = left; }
    return r;
  }
  serviceVisible(id: string) { return this.reqsMet(D.SERVICES[id].req); }
  upgradeVisible(id: string) {
    const d = D.UPGRADES[id];
    if (this.has(id) || !this.reqsMet(d.req)) return false;
    if (d.era === 'dotcom' && this.s.era !== 'dotcom') return false;
    if (d.funding !== undefined && this.s.funding < d.funding - 1) return false;
    if (d.kind === 'policy' && d.cash && this.s.cash < d.cash * 0.5) return false;
    return true;
  }
  canBuy(id: string) {
    const d = D.UPGRADES[id];
    return d.kind === 'policy' && this.upgradeVisible(id) && this.s.cash >= (d.cash ?? 0) && (d.funding === undefined || this.s.funding >= d.funding);
  }
  buy(id: string) {
    if (!this.canBuy(id)) return;
    const d = D.UPGRADES[id];
    this.s.cash -= d.cash ?? 0;
    this.complete(id);
  }
  private complete(id: string) {
    const d = D.UPGRADES[id];
    this.s.done.push(id);
    if (d.dilution) this.s.equity *= 1 - d.dilution;
    if (id === 'dotcom') { this.s.era = 'dotcom'; this.log('Welcome to the dot-com boom. Profits are so last century.'); }
    else this.log(`${d.kind === 'tech' ? 'Built' : 'Adopted'} ${d.name}.`);
    if (id === 'incorporate') this.s.nextCandidate = this.s.day;
  }
  // Tasks a worker can be given, as [value, label].
  taskOptions(): [string, string][] {
    const o: [string, string][] = [['', 'Idle']];
    for (const id of Object.keys(D.SERVICES)) {
      if (!this.serviceVisible(id)) continue;
      const live = this.s.services[id];
      o.push([`build:${id}`, live ? `Build ${D.SERVICES[id].name} v${live.version + 1}` : `Build ${D.SERVICES[id].name}`]);
      if (live) o.push([`maintain:${id}`, `Maintain ${D.SERVICES[id].name}`]);
    }
    for (const id of Object.keys(D.UPGRADES)) if (D.UPGRADES[id].kind === 'tech' && this.upgradeVisible(id)) o.push([`tech:${id}`, `Build ${D.UPGRADES[id].name}`]);
    if (this.skillUnlocked('sales')) o.push(['pitch', 'Pitch investors']);
    return o;
  }
  projectKey(task: string) {
    const [k, id] = task.split(':');
    return k === 'build' ? `svc:${id}` : k === 'tech' ? `tech:${id}` : null;
  }

  rates(): Rates {
    const s = this.s, m = this.mods(), rep = this.repMult();
    const out: Rates = { output: new Map(), projects: {}, services: {}, userTarget: 0, hype: 0, revenue: 0, salaries: 0, infra: 0, rent: 0, burn: 0 };
    for (const [id, sv] of Object.entries(s.services)) {
      const def = D.SERVICES[id];
      out.services[id] = { target: 0, uptime: 1, load: def.load * sv.version, capacity: D.BASE_CAPACITY, fix: 0, bugsIn: def.bugRate * sv.version * m.bugs };
    }
    for (const w of s.workers) {
      out.salaries += w.salary * m.salary;
      const task = this.taskOf(w);
      const mult = this.trait(w, 'output') * (w.team !== null ? this.teamEff(w.team) : 1) * rep;
      const lvl = (k: Skill) => (w.skills[k] ?? 0) * m[k as keyof Mods] * mult;
      const key = this.projectKey(task);
      if (key) {
        const rem = this.remaining(key), p = (out.projects[key] ??= {});
        const parts: string[] = [];
        for (const k of Object.keys(rem) as Skill[]) {
          const v = lvl(k);
          if (v > 0) { p[k] = (p[k] ?? 0) + v; parts.push(`${v.toFixed(1)} ${D.SKILLS[k].name.toLowerCase()}/d`); }
        }
        out.output.set(w.id, parts.join(', ') || 'no useful skills for this');
      } else if (task.startsWith('maintain:')) {
        const sr = out.services[task.slice(9)];
        if (sr) {
          sr.fix += lvl('coding') * D.FIX_CODING + lvl('testing') * D.FIX_TESTING;
          sr.capacity += lvl('coding') * D.OPS_PER_CODING + (w.skills.ops ?? 0) * m.ops * mult * D.OPS_PER_OPS;
          out.output.set(w.id, 'keeping it running');
        }
      } else if (task === 'pitch') {
        const h = lvl('sales') * D.HYPE_PER_SALES * m.hype;
        out.hype += h;
        out.output.set(w.id, h > 0 ? `${h.toFixed(1)} hype/d` : 'no sales skill');
      } else out.output.set(w.id, 'idle');
    }
    for (const [id, sv] of Object.entries(s.services)) {
      const def = D.SERVICES[id], sr = out.services[id];
      sr.uptime = Math.min(1, sr.capacity / sr.load);
      sr.target = def.users * Math.pow(D.VERSION_USERS, sv.version - 1) * sr.uptime / (1 + sv.bugs / D.BUG_SCALE) * m.users * rep;
      out.userTarget += sr.target;
      out.infra += sr.load * D.INFRA_PER_LOAD;
    }
    out.hype += s.users * D.HYPE_PER_USER * m.hype;
    out.revenue = s.users * m.arpu;
    out.rent = s.floors * D.OFFICE_FLOOR.rent;
    out.burn = out.salaries + out.infra + out.rent - out.revenue;
    return out;
  }

  tick(dt: number) {
    const s = this.s, r = this.rates(), m = this.mods();
    s.day += dt;
    // project work, and skill growth for whoever did it
    for (const [key, work] of Object.entries(r.projects)) {
      const p = (s.progress[key] ??= {});
      const rem = this.remaining(key);
      for (const k of Object.keys(work) as Skill[]) {
        const add = Math.min(work[k]! * dt, rem[k] ?? 0);
        p[k] = (p[k] ?? 0) + add;
        if (k === 'coding') s.pendingBugs[key] = (s.pendingBugs[key] ?? 0) + add * D.BUGS_PER_WORK * m.bugs * this.bugFactor(key);
      }
      if (Object.keys(this.remaining(key)).length === 0) this.finish(key);
    }
    for (const w of s.workers) {
      const task = this.taskOf(w), key = this.projectKey(task);
      const used: Skill[] = key ? (Object.keys(this.workNeeded(key)) as Skill[])
        : task.startsWith('maintain:') ? ['coding', 'testing', 'ops'] : task === 'pitch' ? ['sales'] : [];
      if (w.team !== null && this.teamMembers(w.team).length > 1) used.push('management');
      for (const k of used) {
        const cur = w.skills[k];
        if (cur === undefined || cur <= 0) continue;
        const learn = this.trait(w, 'learn') * (k === 'management' && w.traits.includes('meetings') ? 3 : 1) * m.learn;
        w.skills[k] = cur + D.SKILL_GROWTH * learn * dt / cur;
      }
    }
    for (const [id, sv] of Object.entries(s.services)) {
      const sr = r.services[id];
      if (sr) sv.bugs = Math.max(0, sv.bugs + (sr.bugsIn - sr.fix) * dt);
    }
    s.users += (r.userTarget - s.users) * Math.min(1, D.USER_GROWTH * dt);
    s.hype += r.hype * dt;
    s.cash -= r.burn * dt;
    if (this.has('incorporate') && s.day >= s.nextCandidate) {
      s.nextCandidate = s.day + D.CANDIDATE_EVERY;
      if (s.candidates.length < D.MAX_CANDIDATES) s.candidates.push(this.makeCandidate());
    }
    s.nextEvent -= dt;
    if (s.nextEvent <= 0) {
      s.nextEvent = 30 + Math.random() * 45;
      const pool = D.EVENTS.filter(e => !e.when || e.when(this));
      const e = pick(pool); e.apply(this); this.log(e.msg);
    }
    if (s.cash < 0) this.exit('bankrupt');
  }
  // Average bug multiplier of the people working on a project.
  private bugFactor(key: string) {
    const ws = this.s.workers.filter(w => this.projectKey(this.taskOf(w)) === key);
    return ws.length ? ws.reduce((n, w) => n + this.trait(w, 'bugs'), 0) / ws.length : 1;
  }
  private finish(key: string) {
    const [kind, id] = key.split(':');
    const bugs = this.s.pendingBugs[key] ?? 0;
    delete this.s.progress[key]; delete this.s.pendingBugs[key];
    if (kind === 'tech') { this.complete(id); this.freeWorkers(`tech:${id}`); return; }
    const sv = this.s.services[id];
    if (sv) { sv.version++; sv.bugs += bugs; this.log(`Shipped ${D.SERVICES[id].name} v${sv.version}.`); }
    else { this.s.services[id] = { version: 1, bugs }; this.log(`Shipped ${D.SERVICES[id].name}. It mostly works.`); }
    this.freeWorkers(`build:${id}`, `maintain:${id}`);
  }
  // People on a finished project move to maintaining it (services) or go idle (tech).
  private freeWorkers(task: string, next = '') {
    for (const w of this.s.workers) if (w.team === null && w.task === task) w.task = next;
    for (const t of this.s.teams) if (t.task === task) t.task = next;
  }
  addBugs(n: number) {
    const ids = Object.keys(this.s.services);
    if (ids.length) this.s.services[pick(ids)].bugs += n;
  }

  log(msg: string) {
    this.s.log.unshift(`Day ${Math.floor(this.s.day)}: ${msg}`);
    this.s.log.length = Math.min(this.s.log.length, 30);
  }

  // ---- people ----
  makeCandidate(): Worker {
    const skills = SKILL_LIST.filter(k => this.skillUnlocked(k));
    const sk: Partial<Record<Skill, number>> = {};
    const main = Math.random() < 0.5 ? 'coding' : pick(skills);
    sk[main] = rand(0.6, 2.2);
    if (Math.random() < 0.4) { const o = pick(skills); sk[o] = (sk[o] ?? 0) + rand(0.3, 1); }
    const traits: string[] = [];
    if (Math.random() < 0.7) traits.push(pick(Object.keys(D.TRAITS)));
    if (traits.includes('overqualified')) for (const k of Object.keys(sk) as Skill[]) sk[k]! += 1;
    const total = Object.values(sk).reduce((a, b) => a + b!, 0)!;
    const salary = Math.round((D.SALARY_BASE + D.SALARY_PER_SKILL * total) * traits.reduce((x, t) => x * (D.TRAITS[t].salary ?? 1), 1) * rand(0.85, 1.15));
    return { id: this.s.nextId++, name: `${pick(D.FIRST_NAMES)} ${pick(D.LAST_NAMES)}`, skills: sk, traits, salary, task: '', team: null };
  }
  hireFee(w: Worker) { return w.salary * D.HIRE_FEE_DAYS; }
  canHire(w: Worker) { return this.headcount() < this.desks() && this.s.cash >= this.hireFee(w); }
  hire(id: number) {
    const w = this.s.candidates.find(c => c.id === id);
    if (!w || !this.canHire(w)) return;
    this.s.cash -= this.hireFee(w);
    this.s.candidates = this.s.candidates.filter(c => c !== w);
    this.s.workers.push(w);
    this.log(`Hired ${w.name}.`);
  }
  reject(id: number) { this.s.candidates = this.s.candidates.filter(c => c.id !== id); }
  fire(id: number) {
    const w = this.s.workers.find(x => x.id === id);
    if (!w || w.founder) return;
    this.s.workers = this.s.workers.filter(x => x !== w);
    this.log(`Let ${w.name} go. "We're a family," you remind everyone.`);
  }
  setTask(id: number, task: string) { const w = this.s.workers.find(x => x.id === id); if (w) w.task = task; }
  setTeam(id: number, team: number | null) { const w = this.s.workers.find(x => x.id === id); if (w) w.team = team; }
  teamsVisible() { return this.headcount() >= D.TEAM_UNLOCK - 1; }
  newTeam() {
    if (this.headcount() < D.TEAM_UNLOCK) return;
    const id = this.s.nextId++;
    this.s.teams.push({ id, name: TEAM_NAMES[this.s.teams.length % TEAM_NAMES.length], task: '' });
  }
  setTeamTask(id: number, task: string) { const t = this.s.teams.find(x => x.id === id); if (t) t.task = task; }
  disband(id: number) {
    for (const w of this.teamMembers(id)) w.team = null;
    this.s.teams = this.s.teams.filter(t => t.id !== id);
  }

  // ---- company ----
  nextRound() { return D.FUNDING[this.s.funding]; }
  roundVisible() { const f = this.nextRound(); return !!f && this.has('incorporate') && this.s.hype >= f.hype * 0.5; }
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
  buyDesk() { const c = this.deskCost(); if (this.has('coworking') && this.s.cash >= c) { this.s.cash -= c; this.s.desksBought++; } }
  leaseFloor() {
    if (!this.has('office') || this.s.cash < D.OFFICE_FLOOR.cost) return;
    this.s.cash -= D.OFFICE_FLOOR.cost; this.s.floors++;
    this.log('Signed a 10-year lease. Bean bags arrive Tuesday.');
  }

  // ---- exits ----
  valuation() {
    const perUser = this.s.era === 'dotcom' ? 400 : 50; // eyeballs!
    return this.s.users * perUser + Math.max(0, this.rates().revenue) * 3650 + this.s.hype * 100;
  }
  talent() { return this.s.workers.reduce((n, w) => n + Object.values(w.skills).reduce((a, b) => a + b!, 0)!, 0); }
  canExit(kind: 'acquihire' | 'ipo') {
    return kind === 'acquihire' ? this.s.funding >= 2 && this.headcount() >= 5 : this.has('goldman') && this.s.funding >= 5;
  }
  exitTake(kind: 'acquihire' | 'ipo' | 'bankrupt') {
    if (kind === 'bankrupt') return 0;
    return (kind === 'ipo' ? this.valuation() : this.talent() * 80000) * this.s.equity;
  }
  reputationFor(kind: 'acquihire' | 'ipo' | 'bankrupt') {
    if (kind === 'bankrupt') return this.s.funding > 0 ? 1 : 0;
    return Math.floor(Math.sqrt(this.exitTake(kind) / 200000));
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
      const s = raw && JSON.parse(raw);
      if (s && s.version === SAVE_VERSION) return new Game({ ...newState(), ...s });
    } catch { /* ignore */ }
    return new Game();
  }
  exportSave() { return btoa(unescape(encodeURIComponent(JSON.stringify(this.s)))); }
  importSave(str: string) {
    const s = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
    if (s.version !== SAVE_VERSION) throw new Error('old save');
    this.s = { ...newState(), ...s };
  }
  reset() { this.s = newState(); try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }
  // Simulate time away, capped at 8 hours of real time.
  catchUp() {
    const secs = Math.min((Date.now() - this.s.lastSaved) / 1000, 8 * 3600);
    if (secs < 5) return 0;
    const before = this.s.exits;
    let left = secs * D.DAYS_PER_SECOND;
    while (left > 0 && this.s.exits === before) { const dt = Math.min(0.5, left); this.tick(dt); left -= dt; }
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
