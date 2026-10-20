# Personal data inventory (WS8.4)

**Status:** draft for RTB review · **Prepared:** 2026-10-14 from the TypeORM entities in `server/src/modules/**/entities`.
**Controller:** Rwanda TVET Board (RTB). **Processor:** the development / hosting vendor. **Storage location today:** AWS eu-north-1 (see decision D1 in `COMPLIANCE_CHECKLIST.md`).

Retention periods are **proposals** for RTB to approve. "Roles with access" uses the permission names from `server/src/common/constants/permissions.constant.ts`; geographic scope (National ▸ Province ▸ District ▸ Sector ▸ School) further limits school-related data for sub-national roles.

## 1. System users (`users` table, `User` entity)

| Field | Personal? | Purpose | Retention (proposal) | Who can see it |
|---|---|---|---|---|
| `firstName`, `lastName` | Yes | Identify the account holder; shown in the app, reports and audit trail | Life of the account; anonymised on erasure | The user; `VIEW_USERS` / `MANAGE_USERS`; appears to report managers next to reports they filed |
| `email` | Yes | Login, password reset, notifications | Life of the account; anonymised on erasure | The user; `VIEW_USERS` / `MANAGE_USERS`; copied into audit rows (`actorEmail`) |
| `phone` | Yes | Contact by RTB staff | Life of the account | The user; `VIEW_USERS` / `MANAGE_USERS` |
| `department` | Low | Organisational context | Life of the account | Same as above |
| `avatarUrl` (+ image file in storage) | Yes (photo) | Profile picture | Until replaced or the account is erased | All signed-in users who see the avatar |
| `location` (province / district / sector / schoolId) | Low (work assignment) | Geographic access scope | Life of the account | `VIEW_USERS` / `MANAGE_USERS` |
| `role` | Low | Authorisation | Life of the account | `VIEW_USERS` / `MANAGE_USERS` / `MANAGE_ROLES` |
| `password` (bcrypt hash), `passwordHistory` (hashes) | Credential | Authentication; prevent password reuse | Life of the account; history limited to the last N hashes | Nobody (never returned by the API; `select: false`) |
| `passwordResetToken`, `passwordResetExpiresAt`, `passwordResetAttempts` | Credential | Password reset by emailed code | Minutes (expires); cleared on use | Nobody |
| `googleId`, `googleUnlinkedAt` | Yes (identifier) | Google sign-in link | Until unlinked / account erased | Nobody in the UI (server only) |
| `totpEnabled`, `totpSecretEnc`, `totpPendingSecretEnc`, `totpLastUsedStep`, `totpRecoveryCodes`, `mfaEmailOtp*` | Credential | Two-factor authentication | While 2FA is enabled; secrets encrypted at rest | Nobody (server only) |
| `failedLoginCount`, `lockedUntil` | Security | Brute-force protection | Reset on successful login | Nobody in the UI |
| `lastLoginAt` | Yes (activity) | Security and account hygiene | Life of the account | `VIEW_USERS` / `MANAGE_USERS` |
| `privacyAcceptedAt`, `privacyVersion` | Yes (consent record) | Evidence of privacy-notice acceptance (WS8.7) | Life of the account + 2 years | `MANAGE_USERS`; the user |
| `mustChangePassword`, `passwordChangedAt`, `isActive`, `createdAt` | Low | Account lifecycle | Life of the account | `VIEW_USERS` / `MANAGE_USERS` |

## 2. Login sessions (`user_sessions`, `UserSession` entity)

| Field | Personal? | Purpose | Retention (proposal) | Who can see it |
|---|---|---|---|---|
| `userId` | Yes (link) | Tie a refresh token to a user | Until expiry + 30 days | The user (own sessions list, if exposed); `MANAGE_USERS` |
| `ip`, `userAgent` | **Yes** (online identifiers) | Session security, "signed-in devices", incident investigation | Until expiry + 30 days | Same as above |
| `refreshTokenHash`, `previousTokenHash` | Credential | Token rotation and reuse detection | Until expiry | Nobody |
| `createdAt`, `lastUsedAt`, `expiresAt`, `revokedAt`, `revokedReason`, `method` | Activity | Session lifecycle | Until expiry + 30 days | `MANAGE_USERS` |

## 3. Audit trail (`audit_logs`, `AuditLog` entity — WS11)

| Field | Personal? | Purpose | Retention (proposal, decision **D7**) | Who can see it |
|---|---|---|---|---|
| `actorId`, `actorEmail`, `actorRole` | Yes | Accountability: who did what | **2 years online, then archive** (D7) | `VIEW_AUDIT_LOGS` (super admin, admin) |
| `subjectUserId`, `targetLabel` | Yes when the target is a person | "To whom" the action applied | Same | Same |
| `changes`, `meta` | May contain personal data (e.g. old/new email) | Before/after values for investigations | Same; sensitive fields are redacted by the audit service | Same |
| `ip`, `userAgent`, `sessionId`, `requestId` | **Yes** (online identifiers) | Investigating incidents and breaches | Same | Same |
| `prevHash`, `hash` | No | Tamper evidence (hash chain) | Same | Same |

On erasure of a user, audit rows are **kept** (legal obligation / legitimate interest) but should reference the anonymised user id; `actorEmail` is replaced by a pseudonym so the hash chain can be re-anchored. To design with WS8.5.

## 4. Schools (`schools`, `School` entity)

Schools are organisations, but some fields identify individuals.

| Field | Personal? | Purpose | Retention | Who can see it |
|---|---|---|---|---|
| `headTeacher` | **Yes** (name) | Contact person for the school | While the school is registered; update on change of head | `VIEW_SCHOOLS` within scope; editable with `EDIT_SCHOOL_CONTACT` |
| `phone`, `email` | Usually institutional; personal if a private number/email is used | Contact | Same | Same |
| Staff and student counts, programmes, land, buildings, coordinates | No (aggregate / institutional) | Monitoring and decisions | While registered | `VIEW_SCHOOLS` within scope |

## 5. Issue reports and change requests (`issue_reports`, `IssueReport` entity)

| Field | Personal? | Purpose | Retention (proposal) | Who can see it |
|---|---|---|---|---|
| `reportedBy` (→ user name/email) | Yes | Follow-up with the person who reported; status notifications | 5 years after resolution (asset-management history) — RTB to confirm | `VIEW_REPORTING` / `VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD` / `MANAGE_REPORTS` within scope |
| `description`, `changeRequest.reason` | Free text: may contain personal data | Describe the issue / requested change | Same | Same |
| `attachments` (photos / PDFs in storage) | **Possibly** (people in photos, faces of students) | Evidence of the issue | Same; delete with the report | Same |
| `type`, `assignedRole`, `status`, timestamps | No | Workflow | Same | Same |

Guidance to show in the upload dialog: *"Avoid photographing people. Do not include students' faces or names."* (handoff to the reporting form owner).

## 6. Facility surveys and site features

| Entity / field | Personal? | Purpose | Retention | Who can see it |
|---|---|---|---|---|
| `school_facility_surveys.inspectedBy` | Yes (inspector name) | Accountability for an assessment | Life of the survey record | `VIEW_SCHOOLS` within scope |
| `site_features.createdBy`, `createdByName` (WS5) | Yes | Who saved a measurement / note | Life of the feature | Users who can open the school's 2D/3D viewer |

## 7. Files and other stores

| Store | Personal content | Notes |
|---|---|---|
| `/var/lib/rtb/storage` (file-server; MinIO in some setups) | Avatars, report photos | Same location decision as the DB (D1). Included in backups. |
| `/var/lib/rtb/backups` | Full DB dumps (all of the above) | Encrypt at rest and keep in-country (`BACKUP_AND_DR.md`). |
| Server logs (PM2, nginx access logs) | IP addresses, URLs, user agents | Rotate after 30 days (logrotate). |
| Browser `localStorage` | Auth token, user profile, in-app notifications, saved filter views, tour flag | On the user's device; cleared on sign-out except notification/tour/view preferences (keyed by user id, no sensitive content). |
| Email (password reset / OTP) | Email address, one-time codes | Sent through the configured SMTP provider: list it as a sub-processor. |

## 8. Sub-processors (to confirm)

| Provider | Data | Location |
|---|---|---|
| Amazon Web Services (EC2, EBS, Route 53) | Everything above | eu-north-1 (Sweden) — decision D1 |
| Let's Encrypt | Domain name only | — |
| Google (Sign-in) | Email, Google account id (only for users who choose Google sign-in) | Global |
| SMTP provider (configured in `server.env`) | Email address, message content | To confirm |
| Esri ArcGIS (population data) | No personal data (school coordinates only) | — |
