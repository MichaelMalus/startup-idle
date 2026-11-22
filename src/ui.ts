import * as D from './data';
import type { Role } from './data';
import { Game, fmt, fmtMoney } from './game';

type Tab = 'company' | 'teams' | 'services' | 'research' | 'exit' | 'settings';
const TABS: [Tab, string][] = [
  ['company', 'Company'], ['teams', 'Teams'], ['services', 'Services'], ['research', 'Research'], ['exit', 'Exit'], ['settings', 'Settings'],
];

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const btn = (action: string, label: string, enabled: boolean, title = '', cls = '') =>
  `<button data-action="${action}" ${enabled ? '' : 'disabled'} title="${esc(title)}" class="${cls}">${label}</button>`;
const cost = (sloc?: number, cash?: number) =>
  [sloc ? `${fmt(sloc)} SLoC` : '', cash ? fmtMoney(cash) : ''].filter(Boolean).join(' + ') || 'free';

export class UI {
  tab: Tab = 'company';
  private cache = new Map<string, string>();
  constructor(private g: Game, private root: HTMLElement) {
    root.innerHTML = `
      <header><h1>Startup Idle</h1><div id="hdr"></div></header>
      <div class="layout">
        <aside id="res"></aside>
        <main><nav id="tabs"></nav><section id="panel"></section></main>
      </div>
      <footer id="log"></footer>`;
    root.addEventListener('click', e => {
      const el = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
      if (!el || (el as HTMLButtonElement).disabled) return;
      this.act(el.dataset.action!);
      this.render();
    });
    root.addEventListener('change', e => {
      const el = e.target as HTMLSelectElement;
      if (el.dataset.assign) { this.g.assign(el.dataset.assign, el.value === '' ? null : Number(el.value)); this.render(); }
    });
  }

  private act(a: string) {
    const g = this.g, [k, x, y] = a.split(':');
    switch (k) {
      case 'tab': this.tab = x as Tab; break;
      case 'code': g.writeCode(); break;
      case 'pitch': g.pitch(); break;
      case 'raise': g.raise(); break;
      case 'desk': g.buyDesk(); break;
      case 'floor': g.leaseFloor(); break;
      case 'team': g.newTeam(); break;
      case 'disband': g.disband(Number(x)); break;
      case 'hire': g.hire(Number(x), y as Role); break;
      case 'fire': g.fire(Number(x), y as Role); break;
      case 'build': g.build(x); break;
      case 'research': g.research(x); break;
      case 'refactor': g.refactor(); break;
      case 'exit':
        if (confirm(x === 'ipo' ? 'Ring the bell and go public?' : 'Sell the company and start over?')) g.exit(x as 'ipo' | 'acquihire');
        break;
      case 'export': prompt('Your save (copy it somewhere safe):', g.exportSave()); break;
      case 'import': {
        const v = prompt('Paste a save:');
        if (v) try { g.importSave(v); g.save(); } catch { alert('That save is broken. Much like our build.'); }
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

  render() {
    const g = this.g, s = g.s, r = g.rates();
    this.set('hdr', `Day ${fmt(s.day)} · ${D.ERA_NAMES[s.era]}${s.reputation ? ` · ★ ${s.reputation} reputation` : ''}`);
    const rate = (n: number, bad = false) => `<span class="${(n < 0) !== bad ? 'neg' : 'pos'}">${n >= 0 ? '+' : ''}${fmt(n)}/d</span>`;
    const runway = r.burn > 0 ? `${fmt(s.cash / r.burn)} days runway` : 'profitable (allegedly)';
    this.set('res', `
      <div class="res"><b>SLoC</b><span>${fmt(s.sloc)}</span>${rate(r.sloc)}</div>
      <div class="res"><b>Cash</b><span>${fmtMoney(s.cash)}</span>${rate(-r.burn)}</div>
      <div class="sub">${runway}</div>
      <div class="res"><b>Hype</b><span>${fmt(s.hype)}</span>${rate(r.hype)}</div>
      <div class="res"><b>Users</b><span>${fmt(s.users)}</span><span class="dim">→ ${fmt(r.userTarget)}</span></div>
      <div class="res"><b>Bugs</b><span>${fmt(s.bugs)}</span>${rate(r.bugsIn - r.bugsOut, true)}</div>
      <div class="res"><b>Tech debt</b><span>${fmt(s.debt)}</span>${rate(r.debt, true)}</div>
      <div class="res"><b>Uptime</b><span>${Math.round(r.uptime * 100)}%</span><span class="dim">${fmt(r.load)}/${fmt(r.opsCap)} load</span></div>
      <div class="res"><b>Headcount</b><span>${g.headcount()}/${g.desks()}</span><span class="dim">desks</span></div>
      <div class="res"><b>Equity</b><span>${(s.equity * 100).toFixed(1)}%</span></div>`);
    this.set('tabs', TABS.map(([t, l]) => `<button data-action="tab:${t}" class="${t === this.tab ? 'active' : ''}">${l}</button>`).join(''));
    this.set('panel', this[this.tab]());
    this.set('log', s.log.slice(0, 6).map(l => `<div>${esc(l)}</div>`).join(''));
  }

  private company() {
    const g = this.g, s = g.s, f = g.nextRound();
    let h = `<h2>The garage</h2><p class="dim">Two founders, one idea, zero customers.</p>
      <div class="row">${btn('code', 'Write code', true, 'Founders bang out some SLoC')}${btn('pitch', 'Pitch an investor', true, 'Talk about synergy until hype appears')}</div>`;
    h += `<h2>Fundraising</h2>`;
    if (!g.has('incorporate')) h += `<p class="dim">Investors want a company. Incorporate first (Research).</p>`;
    else if (!f) h += `<p>No more rounds. Time to think about an exit.</p>`;
    else {
      const eraLock = f.era && f.era !== s.era ? ` <span class="neg">(needs ${D.ERA_NAMES[f.era]})</span>` : '';
      h += `<div class="card"><b>${f.name}</b>${eraLock}<div>Needs ${fmt(f.hype)} hype${f.users ? ` and ${fmt(f.users)} users` : ''}.
        Get ${fmtMoney(f.cash)} for ${Math.round(f.dilution * 100)}% of the company.</div>
        ${btn('raise', 'Raise', g.canRaise())}</div>`;
    }
    h += `<h2>Office</h2>`;
    h += g.has('coworking')
      ? `<div class="row">${btn('desk', `Rent a desk (${fmtMoney(g.deskCost())})`, s.cash >= g.deskCost())}</div>`
      : `<p class="dim">Garage fits ${D.START_DESKS}. Research Co-working space to rent desks.</p>`;
    if (g.has('office')) h += `<div class="row">${btn('floor', `Lease office floor (${fmtMoney(D.OFFICE_FLOOR.cost)}, +${D.OFFICE_FLOOR.desks} desks, ${fmtMoney(D.OFFICE_FLOOR.rent)}/d rent)`, s.cash >= D.OFFICE_FLOOR.cost)} <span class="dim">${s.floors} floors</span></div>`;
    h += `<h2>Tech debt</h2><div class="row">${btn('refactor', `Big rewrite (${fmt(g.refactorCost())} SLoC)`, s.debt >= 1 && s.sloc >= g.refactorCost(), 'Clears all tech debt')}
      <span class="dim">Debt slows all coding: −${Math.round((1 - 1 / (1 + s.debt / D.DEBT_SCALE)) * 100)}% right now.</span></div>`;
    const r = g.rates();
    h += `<h2>Burn</h2><table class="burn">
      <tr><td>Salaries</td><td>${fmtMoney(-r.salaries)}/d</td></tr><tr><td>Infrastructure</td><td>${fmtMoney(-r.infra)}/d</td></tr>
      <tr><td>Rent</td><td>${fmtMoney(-r.rent)}/d</td></tr><tr><td>Revenue</td><td>${fmtMoney(r.revenue)}/d</td></tr></table>`;
    return h;
  }

  private teams() {
    const g = this.g, s = g.s;
    if (!g.has('incorporate')) return `<p class="dim">You can't hire anyone until you incorporate. Research it first.</p>`;
    const full = g.headcount() >= g.desks();
    let h = `<p class="dim">Hire people into teams. Each team can own 1 service, +1 per 2 engineers.
      Teams bigger than ${D.TEAM_SIZE_LIMIT} slow down unless someone manages them.${full ? ' <span class="neg">No free desks.</span>' : ''}</p>
      <div class="row">${btn('team', `New team (${s.teams.length}/${g.maxTeams()})`, s.teams.length < g.maxTeams(), 'One more team per 4 people')}</div>`;
    for (const t of s.teams) {
      const eff = g.teamEff(t);
      h += `<div class="card"><div class="cardhead"><b>Team ${esc(t.name)}</b>
        <span class="dim">${g.teamSize(t)} people · owns ${g.teamOwned(t)}/${g.teamCapacity(t)} services${eff < 1 ? ` · <span class="neg">${Math.round(eff * 100)}% efficient (Brooks's law)</span>` : ''}</span>
        ${g.teamSize(t) === 0 ? btn(`disband:${t.id}`, 'Disband', true, '', 'small') : ''}</div>`;
      for (const r of Object.keys(D.ROLES) as Role[]) {
        if (!g.roleUnlocked(r)) continue;
        const d = D.ROLES[r];
        h += `<div class="role"><span title="${esc(d.desc)}">${d.plural}: <b>${t[r]}</b></span>
          ${btn(`fire:${t.id}:${r}`, '−', t[r] > 0, 'Let go (no severance, obviously)', 'small')}
          ${btn(`hire:${t.id}:${r}`, `+ Hire (${fmtMoney(d.fee)}, ${fmtMoney(d.salary)}/d)`, !full && s.cash >= d.fee, d.desc, 'small')}</div>`;
      }
      h += `</div>`;
    }
    return h;
  }

  private services() {
    const g = this.g, s = g.s;
    let h = `<p class="dim">Spend SLoC to ship services. They bring users, load and an infra bill.
      A service without an owning team (or over its team's capacity) runs at 25%.</p>`;
    for (const [id, d] of Object.entries(D.SERVICES)) {
      if (!g.serviceUnlocked(id)) continue;
      const sv = s.services[id], c = g.serviceCost(id);
      const owner = sv ? `<select data-assign="${id}"><option value="">Unowned</option>${s.teams.map(t => `<option value="${t.id}" ${sv.team === t.id ? 'selected' : ''}>Team ${esc(t.name)}</option>`).join('')}</select>
        ${g.serviceEff(id) < 1 ? '<span class="neg">25%</span>' : ''}` : '';
      h += `<div class="card"><div class="cardhead"><b>${d.name}</b>${sv ? `<span class="dim">level ${sv.level}</span>` : ''}${owner}</div>
        <div class="dim">${d.desc}</div>
        <div>${fmt(d.users * Math.pow(D.SERVICE_LEVEL_USERS, sv ? sv.level : 0))} users · ${d.load * ((sv?.level ?? 0) + 1)} load</div>
        ${btn(`build:${id}`, `${sv ? 'Scale up' : 'Build'} (${fmt(c)} SLoC)`, s.sloc >= c)}</div>`;
    }
    return h;
  }

  private research() {
    const g = this.g;
    const vis = Object.entries(D.RESEARCH).filter(([id]) => g.researchVisible(id));
    let h = vis.length ? '' : '<p class="dim">Nothing left to adopt in this era.</p>';
    for (const [id, d] of vis) {
      const fundLock = d.funding !== undefined && g.s.funding < d.funding ? ` <span class="neg">(needs ${D.FUNDING[d.funding - 1].name})</span>` : '';
      h += `<div class="card"><b>${d.name}</b>${fundLock}<div class="dim">${d.desc}</div>${btn(`research:${id}`, `Adopt (${cost(d.sloc, d.cash)})`, g.canResearch(id))}</div>`;
    }
    const done = g.s.research.map(id => D.RESEARCH[id]?.name).filter(Boolean);
    if (done.length) h += `<h2>Adopted</h2><p class="dim">${done.join(', ')}</p>`;
    return h;
  }

  private exit() {
    const g = this.g, s = g.s;
    return `<p>Every startup ends. Exiting starts a new run with your reputation (★ ${s.reputation}, +${s.reputation * 5}% output, +${s.reputation * 10}% starting cash).</p>
      <div class="card"><b>Acquihire</b><div class="dim">Needs Pre-seed and 5 staff. Valued at ${fmtMoney(150000)} per head.</div>
        <div>Your take: ${fmtMoney(g.exitTake('acquihire'))} → +${g.reputationFor('acquihire')} ★</div>${btn('exit:acquihire', 'Sell out', g.canExit('acquihire'))}</div>
      <div class="card"><b>IPO</b><div class="dim">Needs Series B and an investment bank. Valued on users, revenue and hype.</div>
        <div>Valuation: ${fmtMoney(g.valuation())} · your take: ${fmtMoney(g.exitTake('ipo'))} → +${g.reputationFor('ipo')} ★</div>${btn('exit:ipo', 'Ring the bell', g.canExit('ipo'))}</div>
      <div class="card"><b>Bankruptcy</b><div class="dim">Happens on its own when cash goes below zero. Worth 1 ★ if you raised anything.</div></div>
      <p class="dim">Exits so far: ${s.exits}</p>`;
  }

  private settings() {
    return `<div class="row">${btn('export', 'Export save', true)}${btn('import', 'Import save', true)}${btn('reset', 'Hard reset', true, '', 'danger')}</div>
      <p class="dim">The game saves to this browser every 10 seconds.</p>`;
  }
}
