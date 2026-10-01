# Design review checklist

Used before a design or ADR moves from **Proposed** to **Accepted**. The reviewer answers each
question in the pull request; "not applicable" needs a reason. The checklist is a prompt for
conversation, not a gate to tick through.

## Problem

- [ ] Can the problem be stated in two sentences without naming the solution?
- [ ] Are the non-negotiable constraints listed (site network, client policy, budget, deadline)?
- [ ] Is every claim about an external system backed by its documentation or a test, not memory?

## Options

- [ ] Were at least two real options considered, plus "keep what we have"?
- [ ] Is the cheapest option that could work among them?
- [ ] Is anything being built that a framework, the database or the platform already provides?

## Boundaries and contracts

- [ ] Which system owns each piece of data? Does anything read another system's database?
- [ ] Is every new cross-system interface written down as a contract (OpenAPI, event schema)?
- [ ] What happens on the other side when this side is down, slow, or sends something twice?

## Operations

- [ ] How is it deployed at a site with no internet access, and who upgrades it?
- [ ] How will we know it is broken before a user tells us — which metric, which alert?
- [ ] What is the rollback, and has it been tried?
- [ ] Does it change data retention, personal data handling or access control?

## Delivery

- [ ] Is it broken into tickets that each end in something demoable?
- [ ] What is the first ticket, and what does it prove?
- [ ] Which part is the riskiest, and is it scheduled early?

## The record

- [ ] Does the ADR name its negative consequences?
- [ ] Does it say when it should be revisited?
- [ ] If it replaces an earlier decision, are both records linked (`npm run adr:new -- "…" --supersedes N`)?
