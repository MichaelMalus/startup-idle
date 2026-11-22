import * as D from './data';
import type { Skill } from './data';
import { Game, Worker, fmt, fmtMoney } from './game';

type Tab = 'work' | 'hiring' | 'teams' | 'company' | 'exit' | 'settings';
const TAB_NAMES: Record<Tab, string> = { work: 'Work', hiring: 'Hiring', teams: 'Teams', company: 'Company', exit: 'Exit', settings: 'Settings' };

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const btn = (action: string, label: string, enabled: boolean, cls = '') =>
  `<button data-action="${action}" ${enabled ? '' : 'disabled'} class="${cls}">${label}</button>`;
const skillName = (k: Skill) => D.SKILLS[k].name.toLowerCase();

// Panels are rebuilt only when their structure changes; fast-changing numbers are
// written into data-v / data-w placeholders so open dropdowns aren't destroyed.
export class UI {
  tab: Tab = 'work';
  private cache = new Map<string, string>();
  private vals = new Map<string, string>();
  constructor(private g: Game, private root: HTMLElement) {
    root.innerHTML = `
      <header><h1>Startup Idle</h1><div id="hdr"></div></header>
      <div class="layout">
        <aside id="res"></aside>
        <main><nav id="tabs"></nav><section id="panel"></section></main>
      </div>
      <footer id="log"></footer>`;
    root.addEventListener('click', e => {
      const el = (e.target as HTMLElement).closest('[data-action]') as HTMLButtonElement | null;
      if (!el || el.disabled) return;
      this.act(el.dataset.action!);
      this.render();
    });
    root.addEventListener('change', e => {
      const el = e.target as HTMLSelectElement, [k, id] = (el.dataset.set ?? '').split(':');
      if (k === 'task') this.g.setTask(Number(id), el.value);
      if (k === 'team') this.g.setTeam(Number(id), el.value === '' ? null : Number(el.value));
      if (k === 'teamtask') this.g.setTeamTask(Number(id), el.value);
      this.render();
    });
  }

  private v(key: string, text: string) { this.vals.set(key, text); return `<span data-v="${key}"></span>`; }
  private bar(key: string, frac: number) { this.vals.set(`w:${key}`, `${Math.min(100, frac * 100).toFixed(1)}%`); return `<div class="bar"><i data-w="w:${key}"></i></div>`; }

  private act(a: string) {
    const g = this.g, [k, x] = a.split(':');
    switch (k) {
      case 'tab': this.tab = x as Tab; break;
      case 'raise': g.raise(); break;
      case 'buy': g.buy(x); break;
      case 'desk': g.buyDesk(); break;
      case 'floor': g.leaseFloor(); break;
      case 'hire': g.hire(Number(x)); break;
      case 'reject': g.reject(Number(x)); break;
      case 'fire': if (confirm('Let them go?')) g.fire(Number(x)); break;
      case 'team': g.newTeam(); break;
      case 'disband': g.disband(Number(x)); break;
      case 'exit':
        if (confirm(x === 'ipo' ? 'Ring the bell and go public?' : 'Sell the company and start over?')) g.exit(x as 'ipo' | 'acquihire');
        break;
      case 'export': prompt('Your save (copy it somewhere safe):', g.exportSave()); break;
      case 'import': {
        const s = prompt('Paste a save:');
        if (s) try { g.importSave(s); g.save(); } catch { alert('That save is broken. Much like our build.'); }
        break;
      }
      case 'reset': if (confirm('Wipe everything, including reputation?')) g.reset(); break;
    }
  }

  private set(id: string, html: string) {
    if (this.cache.get(id) === html) return;
    this.cache.set(id, html);
    document.getElementById(id)!.innerHTML = html;
  }

  tabs(): Tab[] {
    const g = this.g, t: Tab[] = ['work'];
    if (g.has('incorporate')) t.push('hiring');
    if (g.teamsVisible()) t.push('teams');
    if (g.upgradeVisible('incorporate') || g.has('incorporate')) t.push('company');
    if (g.s.funding >= 1 || g.s.exits > 0) t.push('exit');
    t.push('settings');
    return t;
  }

  render() {
    const g = this.g, s = g.s, r = g.rates();
    this.vals.clear();
    const tabs = this.tabs();
    if (!tabs.includes(this.tab)) this.tab = 'work';
    this.set('hdr', `${this.v('day', `Day ${Math.floor(s.day)}`)} · ${D.ERA_NAMES[s.era]}${s.reputation ? ` · ★ ${s.reputation} reputation` : ''}`);
    const rate = (key: string, n: number, bad = false) => `<span class="${(n < 0) !== bad ? 'neg' : 'pos'}">${this.v(key, `${n >= 0 ? '+' : ''}${fmt(n)}/d`)}</span>`;
    const anyLive = Object.keys(s.services).length > 0;
    const totalBugs = Object.values(s.services).reduce((n, x) => n + x.bugs, 0);
    let res = '';
    if (anyLive || s.cash !== D.START_CASH) res += `<div class="res"><b>Cash</b>${this.v('cash', fmtMoney(s.cash))}${rate('burn', -r.burn)}</div>
      <div class="sub">${this.v('runway', r.burn > 0 ? `${fmt(s.cash / r.burn)} days runway` : 'profitable (allegedly)')}</div>`;
    if (anyLive) res += `<div class="res"><b>Users</b>${this.v('users', fmt(s.users))}<span class="dim">${this.v('ut', `→ ${fmt(r.userTarget)}`)}</span></div>`;
    if (s.hype > 0 || r.hype > 0) res += `<div class="res"><b>Hype</b>${this.v('hype', fmt(s.hype))}${rate('hr', r.hype)}</div>`;
    if (totalBugs > 0.5) res += `<div class="res"><b>Bugs</b>${this.v('bugs', fmt(totalBugs))}<span></span></div>`;
    if (g.has('incorporate')) res += `<div class="res"><b>Headcount</b>${this.v('hc', `${g.headcount()}/${g.desks()}`)}<span class="dim">desks</span></div>
      <div class="res"><b>Equity</b>${this.v('eq', `${(s.equity * 100).toFixed(1)}%`)}</div>`;
    this.set('res', res || '<div class="dim">Just you, a garage, and an idea.</div>');
    this.set('tabs', tabs.map(t => `<button data-action="tab:${t}" class="${t === this.tab ? 'active' : ''}">${TAB_NAMES[t]}</button>`).join(''));
    this.set('panel', this[this.tab](r));
    this.set('log', s.log.slice(0, 6).map(l => `<div>${esc(l)}</div>`).join(''));
    this.root.querySelectorAll<HTMLElement>('[data-v]').forEach(el => {
      const t = this.vals.get(el.dataset.v!); if (t !== undefined && el.textContent !== t) el.textContent = t;
    });
    this.root.querySelectorAll<HTMLElement>('[data-w]').forEach(el => {
      const t = this.vals.get(el.dataset.w!); if (t !== undefined && el.style.width !== t) el.style.width = t;
    });
  }

  private skills(w: Worker) {
    return (Object.keys(w.skills) as Skill[]).map(k => `${D.SKILLS[k].name} ${this.v(`sk${w.id}${k}`, (w.skills[k] ?? 0).toFixed(2))}`).join(' · ');
  }

  private taskSelect(set: string, current: string, opts: [string, string][]) {
    return `<select data-set="${set}">${opts.map(([v, l]) => `<option value="${v}" ${v === current ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  }

  private work(r: ReturnType<Game['rates']>) {
    const g = this.g, s = g.s, opts = g.taskOptions();
    let people = '';
    for (const w of s.workers) {
      const team = s.teams.find(t => t.id === w.team);
      const traits = w.traits.map(t => `<span class="tag" title="${esc(D.TRAITS[t].desc)}">${D.TRAITS[t].name}</span>`).join('');
      const teamSel = s.teams.length ? `<select data-set="team:${w.id}"><option value="">No team</option>${s.teams.map(t => `<option value="${t.id}" ${t.id === w.team ? 'selected' : ''}>Team ${esc(t.name)}</option>`).join('')}</select>` : '';
      people += `<div class="card"><div class="cardhead"><b>${esc(w.name)}</b>${traits}
          <span class="dim">${w.salary ? `${fmtMoney(w.salary)}/d` : 'no salary'}</span>${w.founder ? '' : btn(`fire:${w.id}`, 'Fire', true, 'small')}</div>
        <div class="dim">${this.skills(w)}</div>
        <div class="row">${team ? `<span>Working with Team ${esc(team.name)}</span>` : this.taskSelect(`task:${w.id}`, w.task, opts)}${teamSel}</div>
        <div class="dim">${this.v(`out${w.id}`, r.output.get(w.id) ?? '')}</div></div>`;
    }
    const hint = s.day < 30 && Object.keys(s.services).length === 0 && !s.workers[0].task
      ? '<p class="hint">Every empire starts somewhere. Put yourself to work on the Landing page.</p>' : '';

    let projects = '';
    const project = (key: string, name: string, desc: string, extra = '') => {
      const need = g.workNeeded(key), got = s.progress[key] ?? {}, rate = r.projects[key] ?? {};
      const who = s.workers.filter(w => g.projectKey(g.taskOf(w)) === key).map(w => esc(w.name)).join(', ');
      let bars = '';
      for (const k of Object.keys(need) as Skill[]) {
        const done = got[k] ?? 0, n = need[k]!;
        const eta = (rate[k] ?? 0) > 0 && done < n ? ` · ${fmt((n - done) / rate[k]!)} days` : '';
        bars += `<div class="prog"><span>${D.SKILLS[k].name}</span>${this.bar(`${key}${k}`, done / n)}<span class="dim">${this.v(`p${key}${k}`, `${fmt(done)}/${fmt(n)}${eta}`)}</span></div>`;
        if (!g.skillUnlocked(k)) bars += `<div class="neg small">Nobody here can do ${skillName(k)} yet.</div>`;
      }
      return `<div class="card"><b>${name}</b>${extra}<div class="dim">${desc}</div>${bars}<div class="dim small">${who ? `On it: ${who}` : 'Nobody assigned'}</div></div>`;
    };
    for (const id of Object.keys(D.SERVICES)) {
      if (!g.serviceVisible(id)) continue;
      const live = s.services[id], d = D.SERVICES[id];
      projects += project(`svc:${id}`, live ? `${d.name} v${live.version + 1}` : d.name, live ? `Doubles its users.` : d.desc);
    }
    for (const id of Object.keys(D.UPGRADES)) {
      const d = D.UPGRADES[id];
      if (d.kind === 'tech' && g.upgradeVisible(id)) projects += project(`tech:${id}`, d.name, d.desc, ' <span class="tag">tech</span>');
    }

    let live = '';
    for (const [id, sv] of Object.entries(s.services)) {
      const sr = r.services[id], d = D.SERVICES[id];
      const who = s.workers.filter(w => g.taskOf(w) === `maintain:${id}`).map(w => esc(w.name)).join(', ');
      live += `<div class="card"><div class="cardhead"><b>${d.name}</b><span class="dim">v${sv.version}</span></div>
        <div>${this.v(`lu${id}`, `${fmt(sr.target)} users · ${fmt(sv.bugs)} bugs (${sr.bugsIn - sr.fix >= 0 ? '+' : ''}${(sr.bugsIn - sr.fix).toFixed(2)}/d) · uptime ${Math.round(sr.uptime * 100)}%`)}</div>
        <div class="dim small">${who ? `Maintained by ${who}` : 'Nobody is maintaining this. Bugs pile up and uptime suffers.'}</div></div>`;
    }
    return `${hint}<div class="cols"><div><h2>People</h2>${people}</div>
      <div><h2>Projects</h2>${projects || '<p class="dim">Nothing to build right now.</p>'}${live ? `<h2>Live services</h2>${live}` : ''}</div></div>`;
  }

  private hiring() {
    const g = this.g, s = g.s;
    const full = g.headcount() >= g.desks();
    let h = `<p class="dim">New candidates turn up every ${D.CANDIDATE_EVERY} days or so. The recruiting fee is ${D.HIRE_FEE_DAYS} days of their salary.
      ${full ? '<span class="neg">No free desks.</span>' : ''}</p>`;
    if (!s.candidates.length) h += '<p class="dim">No candidates right now. Your job ad is "competitive salary, rockstars only".</p>';
    for (const c of s.candidates) {
      const traits = c.traits.map(t => `<span class="tag">${D.TRAITS[t].name}</span> <span class="dim small">${D.TRAITS[t].desc}</span>`).join(' ');
      const skills = (Object.keys(c.skills) as Skill[]).map(k => `${D.SKILLS[k].name} ${c.skills[k]!.toFixed(1)}`).join(' · ');
      h += `<div class="card"><div class="cardhead"><b>${esc(c.name)}</b><span>${fmtMoney(c.salary)}/d</span></div>
        <div>${skills}</div><div>${traits}</div>
        <div class="row">${btn(`hire:${c.id}`, `Hire (${fmtMoney(g.hireFee(c))} fee)`, g.canHire(c))}${btn(`reject:${c.id}`, 'Pass', true)}</div></div>`;
    }
    return h;
  }

  private teams() {
    const g = this.g, s = g.s, opts = g.taskOptions();
    let h = `<p class="dim">People in a team all work on the team's task. Teams bigger than ${D.TEAM_LIMIT} slow down,
      unless someone in them has management skill (each level lets the team grow by ${D.TEAM_LIMIT_PER_MGMT}).</p>
      <div class="row">${btn('team', 'New team', g.headcount() >= D.TEAM_UNLOCK)}${g.headcount() < D.TEAM_UNLOCK ? `<span class="dim">Needs ${D.TEAM_UNLOCK} people.</span>` : ''}</div>`;
    for (const t of s.teams) {
      const ms = g.teamMembers(t.id), eff = g.teamEff(t.id);
      h += `<div class="card"><div class="cardhead"><b>Team ${esc(t.name)}</b>
        <span class="dim">${ms.length} people${eff < 1 ? ` · <span class="neg">${Math.round(eff * 100)}% efficient</span>` : ''}</span>${btn(`disband:${t.id}`, 'Disband', true, 'small')}</div>
        <div class="row">${this.taskSelect(`teamtask:${t.id}`, t.task, opts)}</div>
        <div class="dim small">${ms.map(w => esc(w.name)).join(', ') || 'No members. Add people from their cards on the Work tab.'}</div></div>`;
    }
    return h;
  }

  private company(r: ReturnType<Game['rates']>) {
    const g = this.g, s = g.s;
    let h = '';
    if (g.roundVisible()) {
      const f = g.nextRound();
      const eraLock = f.era && f.era !== s.era ? ` <span class="neg">(needs ${D.ERA_NAMES[f.era]})</span>` : '';
      h += `<h2>Fundraising</h2><div class="card"><b>${f.name}</b>${eraLock}<div>Needs ${fmt(f.hype)} hype and ${fmt(f.users)} users.
        Get ${fmtMoney(f.cash)} for ${Math.round(f.dilution * 100)}% of the company.</div>${btn('raise', 'Raise', g.canRaise())}</div>`;
    }
    const pol = Object.keys(D.UPGRADES).filter(id => D.UPGRADES[id].kind === 'policy' && g.upgradeVisible(id));
    if (pol.length) {
      h += '<h2>Decisions</h2>';
      for (const id of pol) {
        const d = D.UPGRADES[id];
        const lock = d.funding !== undefined && s.funding < d.funding ? ` <span class="neg">(needs ${D.FUNDING[d.funding - 1].name})</span>` : '';
        h += `<div class="card"><b>${d.name}</b>${lock}<div class="dim">${d.desc}</div>${btn(`buy:${id}`, d.cash ? `Do it (${fmtMoney(d.cash)})` : 'Do it', g.canBuy(id))}</div>`;
      }
    }
    if (g.has('coworking')) {
      h += `<h2>Office</h2><div class="row">${btn('desk', `Rent a desk (${fmtMoney(g.deskCost())})`, s.cash >= g.deskCost())}`;
      if (g.has('office')) h += btn('floor', `Lease office floor (${fmtMoney(D.OFFICE_FLOOR.cost)}, +${D.OFFICE_FLOOR.desks} desks, ${fmtMoney(D.OFFICE_FLOOR.rent)}/d rent)`, s.cash >= D.OFFICE_FLOOR.cost);
      h += '</div>';
    }
    if (g.has('incorporate')) h += `<h2>Burn</h2><table class="burn">
      <tr><td>Salaries</td><td>${this.v('bs', `${fmtMoney(-r.salaries)}/d`)}</td></tr><tr><td>Infrastructure</td><td>${this.v('bi', `${fmtMoney(-r.infra)}/d`)}</td></tr>
      <tr><td>Rent</td><td>${this.v('br', `${fmtMoney(-r.rent)}/d`)}</td></tr><tr><td>Revenue</td><td>${this.v('bv', `${fmtMoney(r.revenue)}/d`)}</td></tr></table>`;
    const done = s.done.map(id => D.UPGRADES[id]?.name).filter(Boolean);
    if (done.length) h += `<h2>History</h2><p class="dim">${done.join(', ')}</p>`;
    return h || '<p class="dim">Nothing to decide yet.</p>';
  }

  private exit() {
    const g = this.g, s = g.s;
    return `<p>Every startup ends. Exiting starts a new run with your reputation (★ ${s.reputation}: +${s.reputation * 5}% output, +${s.reputation * 10}% starting cash).</p>
      <div class="card"><b>Acquihire</b><div class="dim">Needs Pre-seed and 5 people. Priced on your team's total skill.</div>
        <div>${this.v('aq', `Your take: ${fmtMoney(g.exitTake('acquihire'))} → +${g.reputationFor('acquihire')} ★`)}</div>${btn('exit:acquihire', 'Sell out', g.canExit('acquihire'))}</div>
      ${s.funding >= 4 ? `<div class="card"><b>IPO</b><div class="dim">Needs Series B and an investment bank. Valued on users, revenue and hype.</div>
        <div>${this.v('ipo', `Valuation ${fmtMoney(g.valuation())} · your take ${fmtMoney(g.exitTake('ipo'))} → +${g.reputationFor('ipo')} ★`)}</div>${btn('exit:ipo', 'Ring the bell', g.canExit('ipo'))}</div>` : ''}
      <div class="card"><b>Bankruptcy</b><div class="dim">Happens on its own when cash goes below zero. Worth 1 ★ if you raised anything.</div></div>
      <p class="dim">Exits so far: ${s.exits}</p>`;
  }

  private settings() {
    return `<div class="row">${btn('export', 'Export save', true)}${btn('import', 'Import save', true)}${btn('reset', 'Hard reset', true, 'danger')}</div>
      <p class="dim">The game saves to this browser every 10 seconds.</p>`;
  }
}

