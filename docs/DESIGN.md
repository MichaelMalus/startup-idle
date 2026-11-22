# Startup Idle — design (proposal)

## Shape
Evolve-style: no big clicky cookie. A dashboard of resources with caps, a growing list of
actions/hires, a research tree that gates everything, and eras that change the rules.

## Core loop
1. **Founders** write SLoC by hand at first (a slow manual "Write code" action, as in Evolve's early gathering).
2. **Hire people** (cost: Cash per month, i.e. ongoing burn, plus a one-off recruiting fee).
   People are a capped resource — the cap is **Desks** (garage → co-working → office → campus → "remote-first").
3. **Assign people to teams.** Each team owns one or more **services**. Roles: engineers (SLoC),
   QA (reduces Bugs), ops/SRE (uptime), product (turns Services into Features), managers
   (needed above team-size thresholds — Brooks's law penalty without them).
4. **Services** are built by spending SLoC; each running service produces **Features/Users**,
   costs infra, generates **Tech Debt** and **Incidents**.
5. **Users** → **Revenue** (or, more realistically early on, **Hype** → **Funding rounds**).
6. **Cash** pays salaries and infra. Runway hitting zero = game over for the run.

## Resources
SLoC, Cash, Hype, Users, Bugs, Tech Debt, Morale, Uptime. Most have caps raised by buildings/research (Evolve style).

## Eras (progression, each with tech + org upgrades)
| Era | Tech | Org/social |
|---|---|---|
| Garage (~1999) | CVS, LAMP, FTP deploys | Founders in a garage, all-nighters |
| Dot-com | Java EE, SOAP, Oracle licences | Foosball, stock options, dot-com crash event |
| Web 2.0 | Git, Rails, AJAX, AWS | Agile Manifesto, open-plan office, "rockstar" job ads |
| Cloud/Mobile | Docker, Kubernetes, microservices, mobile apps | Scrum, DevOps, Spotify model squads, unlimited PTO |
| Growth-at-all-costs | Serverless, GraphQL, data lakes | Blitzscaling, perks arms race, OKRs |
| Remote | Zoom, async tooling | Remote-first, then return-to-office mandates |
| Efficiency | Copilots, AI agents | "Year of efficiency", layoffs, flattening management |

Upgrades carry trade-offs (microservices: more services per team but more incidents; Agile: faster
delivery but meetings tax; layoffs: lower burn, morale crash).

## Prestige
A run ends in an **Exit**: acquihire / IPO / bankruptcy. Earns **Serial Founder Reputation** for
permanent bonuses; later prestige layers TBD.

## First playable (proposal)
Garage + Dot-com eras: manual SLoC, hiring, 2–3 team roles, services, Cash/Hype/funding,
~20 research items, saves + offline progress, deploy to Pages.
