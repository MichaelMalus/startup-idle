# Startup Idle — design

A management game with idle pacing. There is no click-to-earn: all progress comes from deciding who works on what.

## People
- Every worker is an individual with a name, skills (Coding, Testing, Ops, Sales, Management), a salary and maybe a trait
  ("10x (self-reported)", "Brilliant jerk", "Loves meetings", "Cowboy", ...).
- Skills improve through use, more slowly as they get higher.
- You start with only the Founder: no salary, Coding 1.
- After incorporating, candidates turn up over time. Hiring costs a recruiting fee and a daily salary, and needs a free desk.

## Work
- Each person has one task: build a service, build a tech upgrade, maintain a live service, or pitch investors.
- Services and tech are projects that need work in particular skills (a shopping cart needs coding and testing).
- Live services gain bugs over time and have load. Maintainers fix bugs (testing, or coding at a lower rate) and
  keep them up (ops, or coding at a lower rate). Bugs and downtime cut a service's users.
- Shipping a new version of a service needs 3× the work and doubles its users.
- From 4 people you can form teams; everyone in a team shares its task. Teams bigger than 5 slow down unless someone in
  them has management skill. Brilliant jerks slow their teammates.

## Company
- Users bring hype and (after Banner ads) revenue. Hype and users unlock funding rounds, which dilute your equity.
- Decisions (policies) cost cash: Incorporate, Buy a pager, Crunch culture, Stock options, Middle management, ...
- Salaries, infrastructure and rent burn cash. Running out ends the run.

## Hidden until nearly unlocked
Tabs, resources, projects, decisions and funding rounds only appear once you're close to them: when their requirements
are met, or when you have half the cash or hype they need.

## Eras
| Era | Tech | Org/social |
|---|---|---|
| Garage (1999) | CVS, PHP, Bugzilla, Perl, FTP deploys, banner ads | Incorporate, pager, crunch, co-working |
| Dot-com | Java EE, SOAP, JUnit, e-commerce, WAP, portals | Foosball, Aeron chairs, stock options, middle management, office lease, investment bank |
| Later (not built) | Git, Rails, AWS, Docker, Kubernetes, microservices, AI agents | Agile, Spotify model, blitzscaling, remote-first, return to office, layoffs |

## Exits
Acquihire (priced on your team's total skill), IPO, or bankruptcy. Exits award reputation, which gives later runs
more output and starting cash.
