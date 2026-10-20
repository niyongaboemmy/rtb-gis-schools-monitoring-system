# Personal-data breach response runbook (WS8.6)

**Status:** draft for RTB review · **Prepared:** 2026-10-14
**Legal basis:** Law No. 058/2021, which requires the controller (RTB) to notify the **National Cyber Security Authority (NCSA)** of a personal-data breach **within 48 hours** of becoming aware of it, and to inform the affected people when the breach is likely to put them at high risk. Confirm the exact channel and form with NCSA (decision D9).

## 1. Roles (fill in names before go-live)

| Role | Responsibility | Name / phone |
|---|---|---|
| **Incident lead** (RTB) | Owns the incident, decides on notification, signs the NCSA notice | |
| **RTB Data Protection Officer / legal** | Assesses risk to people, drafts notices | |
| **Technical lead** (vendor) | Contains, investigates, preserves evidence, fixes | |
| **RTB ICT** | Infrastructure access, liaison with RISA / NCSA | |
| **Communications** (RTB) | Messages to users / schools / public if needed | |

The vendor (processor) must tell RTB **within 24 hours** of discovering a breach so RTB can meet the 48-hour deadline.

## 2. What counts as a breach

Any accidental or unlawful destruction, loss, change, disclosure of, or access to personal data. Examples for this system:

- an account used by someone other than its owner (stolen password, shared credentials);
- a user seeing schools or reports outside their access scope (scope-enforcement bug);
- a database dump, backup or `server.env` copied off the server or published;
- the break-glass SSH key leaked; the GitHub repository exposing secrets;
- report photos showing students made public;
- ransomware / deletion of the database or uploads without a usable backup.

## 3. Detection sources

| Source | Where | Signal |
|---|---|---|
| Audit trail (WS11) | Settings ▸ Audit (`VIEW_AUDIT_LOGS`), `audit_logs` table | Spikes of `denied` outcomes, logins from new IPs, mass exports, role/permission changes, user deletions |
| Auth protections | `users.failedLoginCount`, `lockedUntil`; refresh-token reuse detection in `user_sessions` | Lockouts, "token reuse" revocations |
| Server logs | `pm2 logs rtb-api`, `/var/log/nginx/access.log` | 401/403 storms, unusual `/export` downloads, scanning |
| AWS | CloudTrail / billing alerts, EC2 status checks | Unknown console activity, new instances, unusual traffic |
| People | Users, school leaders, RTB staff, external reporters | "I can see another school", "I got a reset email I didn't ask for" |

## 4. Timeline (T0 = when RTB or the vendor becomes aware)

| When | Action | Who |
|---|---|---|
| **T0 – 1 h** | Open an incident record (date/time, who reported, what is known). Notify the incident lead and technical lead. | Whoever detects it |
| **T0 – 4 h** | **Contain**: revoke sessions (`UPDATE user_sessions SET revoked_at = now(), revoked_reason = 'incident' WHERE revoked_at IS NULL` — add `AND "userId" = '…'` for specific users; check the column names with `\d user_sessions` first), disable affected accounts, rotate secrets (`JWT_SECRET`, DB password, SMTP, Google client secret, break-glass key), block attacker IPs in nginx / security group, take the service offline if data is still leaking. | Technical lead + RTB ICT |
| **T0 – 4 h** | **Preserve evidence** before changing more (see §5). | Technical lead |
| **T0 – 24 h** | **Assess**: what data, how many people, which roles/schools, whether data was encrypted, likely consequences. Decide whether the breach is *likely to result in a risk* (notify NCSA) and *high risk* (also tell the people). | DPO + incident lead |
| **≤ T0 + 48 h** | **Notify NCSA** with the template in §6, even if some facts are still unknown (send a follow-up later). | Incident lead |
| **Without undue delay** | **Inform affected people** if high risk: plain language, what happened, what we did, what they should do (change password, watch for phishing). | Communications + DPO |
| **T0 + 2 weeks** | Post-incident review: root cause, fixes, test added (e.g. extend `server/test/permission-matrix.e2e-spec.ts` for a scope bug), update this runbook. | All |

## 5. Evidence preservation

1. Snapshot the EC2 volume (AWS Console ▸ EC2 ▸ Volumes ▸ *Create snapshot*, tag `incident-<date>`). Do this **before** rebuilding anything.
2. Copy logs to a separate, access-controlled location:
   ```bash
   sudo tar czf /var/lib/rtb/incident-$(date +%F).tgz /var/log/nginx /home/deploy/.pm2/logs
   ```
3. Export the audit trail for the window (keeps the hash chain for integrity checks):
   ```bash
   psql -h 127.0.0.1 -U rtb rtb_gis_db -c "\copy (SELECT * FROM audit_logs WHERE created_at >= now() - interval '30 days' ORDER BY created_at) TO '/var/lib/rtb/incident-audit.csv' CSV HEADER"
   ```
4. Record hashes of the exported files (`sha256sum`) in the incident record.
5. Keep a timeline of every action taken, by whom, at what time.

## 6. NCSA notification template (send within 48 hours)

> **To:** National Cyber Security Authority (NCSA) — Data Protection Office
> **From:** Rwanda TVET Board (RTB), data controller
> **Subject:** Personal data breach notification — TVET 3D GIS (RTB Schools Monitoring System)
>
> 1. **Controller:** Rwanda TVET Board, [address]. Registration certificate no. [ ].
>    **Contact person / DPO:** [name, title, phone, email].
> 2. **Processor involved (if any):** [vendor name, contact].
> 3. **Date and time the breach occurred:** [date/time or "unknown, first evidence at …"].
>    **Date and time RTB became aware:** [date/time].
> 4. **Nature of the breach:** [confidentiality / integrity / availability]; short description of what happened and how it was discovered.
> 5. **Categories and approximate number of data subjects:** [e.g. ~N RTB staff users, ~N school leaders].
> 6. **Categories and approximate number of records:** [e.g. names, email addresses, phone numbers, IP addresses, report photos].
> 7. **Likely consequences for the people concerned:** [e.g. phishing risk, account takeover, exposure of school contact details].
> 8. **Measures taken or proposed:** containment (sessions revoked, credentials rotated, access blocked, service restored from backup on …), and measures to reduce adverse effects.
> 9. **Communication to data subjects:** [done on … / planned on … / not required because …].
> 10. **Cross-border aspect:** data hosted in [location per decision D1].
> 11. **Information still pending** and date of the follow-up report: [ ].
>
> Signed: [Incident lead, RTB] — Date: [ ]

## 7. Message to affected users (template)

> Subject: Important: security incident affecting your TVET GIS account
>
> On [date] we found that [plain description]. The information involved was [list]. We have [what we did]. As a precaution, please **change your password** at [link] and be careful with emails asking for your password — RTB will never ask for it. If you have questions contact [name, email, phone].

## 8. Checklist after each incident

- [ ] Incident record complete, evidence hashed and stored
- [ ] NCSA notified within 48 h (copy filed) and follow-up sent
- [ ] Affected people informed (if high risk)
- [ ] Root cause fixed and covered by a test
- [ ] Secrets rotated and old sessions revoked
- [ ] `COMPLIANCE_CHECKLIST.md` and this runbook updated
