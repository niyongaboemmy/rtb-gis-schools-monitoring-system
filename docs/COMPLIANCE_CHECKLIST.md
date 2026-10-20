# Compliance checklist: Law 058/2021 and RISA (WS8.1)

**Status:** draft for RTB review · **Prepared:** 2026-10-14 · **System:** TVET 3D GIS (RTB Schools Monitoring)
**Production today:** one AWS EC2 instance in **eu-north-1 (Stockholm)**, domain `rtb.aerovyntech.com` (see `deploy/README.md`).

> This is a working checklist, not legal advice. Law No. 058/2021 of 13/10/2021 on the Protection of Personal Data and Privacy is supervised by the **National Cyber Security Authority (NCSA)**. Government ICT standards come from **RISA**. The exact RISA standards and NCSA guidance must be obtained from the RTB ICT unit (decision **D9**). Items marked *"to confirm"* depend on that.

Status key: ✅ done · 🟡 partly done / in progress · ❌ open · ⏸ blocked on an RTB decision

## 1. Law 058/2021 requirements

| # | Requirement | Status | Evidence / what exists | Gap / next action | Owner |
|---|---|---|---|---|---|
| L1 | **Personal data stored in Rwanda**, unless the controller/processor holds an NCSA registration certificate permitting storage abroad | ⏸ **D1** | Prod DB, uploads and backups are on AWS eu-north-1 (Sweden): `deploy/README.md`, memory of the EC2 layout. | RTB to decide (**D1**): (a) migrate to in-country hosting (government data centre or an in-country cloud) **or** (b) RTB as controller obtains NCSA registration covering storage abroad. Until then this is the main legal blocker for go-live. Backups must follow the same decision (see `BACKUP_AND_DR.md`). | RTB management + RTB ICT |
| L2 | **Controller and processor registration** with NCSA | ❌ | None on file. RTB is the data controller; the development/hosting company acts as processor. | RTB registers as controller; processor registers (or is covered) as required by NCSA. File the certificates here. | RTB legal / DPO; vendor |
| L3 | **Data Protection Officer** designated (where required) | ❌ to confirm | — | Confirm with NCSA whether RTB must designate a DPO for this processing; name the contact in the privacy notice. | RTB |
| L4 | **Lawful basis and purpose** documented for each personal-data field | 🟡 | `docs/PERSONAL_DATA_INVENTORY.md` lists every field, purpose and retention. | RTB to approve purposes and retention periods (esp. audit log retention, decision **D7**). | RTB DPO + dev |
| L5 | **Privacy notice** shown to users; acceptance recorded | 🟡 | WS8.7 (Agent A): `client/src/components/auth/PrivacyNotice.tsx`; `users.privacyAcceptedAt` and `users.privacyVersion` columns. | RTB to approve the notice text; confirm it names the controller, purposes, retention, rights, contact, and the hosting location decided in L1. | RTB + dev |
| L6 | **Right of access** (data subject can obtain their data) | 🟡 | WS8.5: `GET /users/me/export` (users module, Agent A) returns the caller's personal data as JSON; profile page shows it. | Add a documented admin procedure for requests made outside the app (e.g. by letter). Response time target: to confirm with NCSA guidance. | dev (A) + RTB |
| L7 | **Right to correction** | 🟡 | Self-service profile edit (`/profile`, `PATCH /users/profile`). School data corrections: "Request a change" flow (WS7.7) files a tracked request. | — | dev |
| L8 | **Right to erasure** (and objection / restriction) | ❌ | Deactivation exists (`isActive=false`); no anonymisation. | WS8.5 admin erasure process: anonymise name/email/phone/avatar, keep audit rows with a pseudonymous id so the audit hash-chain stays intact. | dev (A) |
| L9 | **Records of processing activities** | 🟡 | This checklist + `PERSONAL_DATA_INVENTORY.md`; audit trail (WS11) records privileged actions with actor, time and target. | RTB to keep the processing record as an official document (owner, review date). | RTB DPO |
| L10 | **Security of processing** (appropriate technical and organisational measures) | 🟡 | WS9 hardening: TLS, JWT with short-lived access tokens, refresh-token rotation, rate limiting, RBAC + geographic scope enforced server-side, permission-matrix e2e test (WS7.6), optional 2FA (WS10), hashed passwords (bcrypt), tamper-evident audit log (hash chain). | Penetration test before go-live if RISA/NCSA require it (WS8.9); 2FA policy (decision **D3**). | dev + RTB |
| L11 | **Breach notification to NCSA within 48 hours**; inform affected subjects when high risk | 🟡 | `docs/BREACH_RESPONSE_RUNBOOK.md` with roles, timeline and a notification template. | RTB to name the incident lead and the NCSA contact channel; run one tabletop exercise. | RTB + dev |
| L12 | **Processor contract** (data processing agreement) between RTB and the vendor / hosting provider | ❌ | — | Sign a DPA covering: purpose limitation, sub-processors (AWS today), location, security, breach notice to RTB within 24 h, return/deletion at end of contract. | RTB legal + vendor |
| L13 | **Cross-border transfer safeguards** (if L1 option (b)) | ⏸ D1 | — | Only if storage abroad is authorised: document the safeguards required by the NCSA certificate. | RTB |
| L14 | **Retention limits** and deletion | 🟡 | Proposed periods in `PERSONAL_DATA_INVENTORY.md`; backups 14 days locally. | Implement scheduled purge for expired sessions / reset codes (mostly already time-boxed) and the audit retention once **D7** is decided. | dev |

## 2. RISA / government ICT items (to obtain from RTB ICT)

These are the items we expect RISA to require. Each needs the **exact standard reference** from RTB ICT (decision **D9**).

| # | Item | Status | Evidence / current state | Next action | Owner |
|---|---|---|---|---|---|
| R1 | **Government domain** (`*.rtb.gov.rw` or as RISA directs) | ❌ | Prod is on `rtb.aerovyntech.com`. | WS8.3: obtain the sub-domain, issue TLS cert, update `APP_CORS_ORIGINS`, Google OAuth origins and the nginx server name. | RTB ICT + dev |
| R2 | **TLS + HSTS**, modern cipher suites | 🟡 | Let's Encrypt TLS via certbot on nginx. | Enable HSTS (`max-age=31536000; includeSubDomains`) after the domain move; test with SSL Labs (target A). | dev |
| R3 | **Hosting standard** (government data centre / approved cloud) | ⏸ D1 | AWS eu-north-1. | Follows the L1 decision. | RTB |
| R4 | **Security baseline** (hardening, patching, logging) | 🟡 | Ubuntu LTS, PM2, firewall to 22/80/443, DB on localhost only, secrets in `/var/lib/rtb/env` (0640). Break-glass SSH key `rtb-gis-prod.pem.pem` is **git-ignored and has never been committed** (verified with `git log --all`). | Get RISA's baseline checklist; add unattended-upgrades, fail2ban, central log shipping; rotate the break-glass key and keep it in a vault, not on developer laptops. | dev / ops |
| R5 | **Backup and DR** | 🟡 | Nightly `pg_dump` (14 days) + EBS snapshots described in `deploy/README.md` §14. | Apply `docs/BACKUP_AND_DR.md`: encrypted, in-country copies, quarterly restore test. | ops |
| R6 | **Interoperability** (e.g. data exchange with other government systems, Irembo/IECMS if applicable) | ❌ to confirm | REST API with Swagger at `/api/docs`. | Confirm with RISA whether an interoperability platform registration is needed. | RTB ICT |
| R7 | **Accessibility** of government web services | 🟡 | WCAG 2.1 AA pass in progress: `docs/UX_REVIEW.md`. | Close the remaining severity-3 items; run axe on every route. | dev |
| R8 | **Independent security assessment / pentest** | ❌ | — | WS8.9, if RISA/NCSA require it before go-live. | RTB |
| R9 | **Source code escrow / ownership and documentation hand-over** | ❌ to confirm | Repo on GitHub (public). | Confirm whether the repo must be private or mirrored to a government repository. **A public repo is a risk** even without secrets. | RTB ICT |

## 3. Decisions this checklist depends on

| Decision | Blocks | Recommendation (from the plan) |
|---|---|---|
| **D1** data residency | L1, L13, R3, backups | Migrate to in-country / government hosting |
| **D3** 2FA policy | L10 | Mandatory for privileged roles |
| **D7** audit log retention | L14 | 2 years online, then archive |
| **D9** RISA / NCSA contacts | all R items | — |

## 4. Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| RTB Data Protection Officer / legal | | | |
| RTB ICT lead | | | |
| Vendor technical lead | | | |
