# Entra to Cloudflare SSO Blueprint

Status: Draft v1
Date: 2026-04-14
Owner: MarketingOps / Property Analytics
Depends on:

- `/Users/mark/Property_Analytics/docs/DATA_POND_ROLE_MODEL_2026-04-14.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_SECURITY_ARCHITECTURE_2026-04-13.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_ACCESS_MATRIX_2026-04-13.md`

## 1. Purpose

Define the canonical workforce SSO setup for Data Pond using:

- Microsoft Entra ID for workforce identity
- Cloudflare Access for edge access control
- Data Pond for business authorization

This blueprint is the implementation bridge for internal user SSO.

It does not replace:

- external OTP access
- machine/service-token access
- app-level role checks

## 2. Canonical Identity Flow

The internal user flow should be:

1. user opens `app.venterradev.com`
2. Cloudflare Access intercepts the request
3. Cloudflare redirects the user to Microsoft Entra ID
4. Microsoft Entra authenticates the user
5. Cloudflare evaluates group membership and policy
6. Data Pond maps the authenticated identity to the canonical app role

That means:

- Entra proves workforce identity
- Cloudflare decides whether that identity may enter a protected surface
- Data Pond decides whether that user is `Observer`, `Curator`, or `Steward`

## 3. Canonical Group Model

Create these Microsoft Entra groups:

- `Data Pond Observers`
- `Data Pond Curators`
- `Data Pond Stewards`

Use the same names in Cloudflare Access where possible.

This keeps:

- onboarding simple
- screenshots and policy review readable
- audit conversations clear

## 4. Group To Role Mapping

| Microsoft Entra Group | Cloudflare Access Cohort | App Role Key | Product Title |
| --- | --- | --- | --- |
| `Data Pond Observers` | `Data Pond Observers` | `viewer` | `Observer` |
| `Data Pond Curators` | `Data Pond Curators` | `editor` | `Curator` |
| `Data Pond Stewards` | `Data Pond Stewards` | `admin` | `Steward` |

Launch rule:

- each internal user should have one primary Data Pond role group

This avoids privilege confusion early on.

## 5. Access Application Mapping

### 5.1 Data Pond - Main App

Target:

- `app.venterradev.com/*`

Include:

- `Data Pond Observers`
- `Data Pond Curators`
- `Data Pond Stewards`

Purpose:

- standard internal human access
- normal Data Pond entry point

### 5.2 Data Pond - Admin and Ops

Target:

- `app.venterradev.com/admin/*`
- `app.venterradev.com/watchtower*`
- `app.venterradev.com/intelligence-office*`
- `app.venterradev.com/site-content*`
- `app.venterradev.com/metrics-import*`
- `app.venterradev.com/backup*`

Default include:

- `Data Pond Stewards`

Selective include if truly needed:

- `Data Pond Curators`

Purpose:

- privileged internal-only surfaces

Recommended require rules:

- MFA
- short session duration
- managed-device posture when ready

### 5.3 Data Pond - Browser API

Target:

- `api.venterradev.com/v1/*`

Include:

- identities already admitted to the main app

Purpose:

- browser-driven frontend traffic

### 5.4 Data Pond - Service API

Target:

- `api.venterradev.com/v1/platform/*`
- `api.venterradev.com/v1/vacs/*`
- machine-only routes

Auth model:

- service tokens only

Do not mix Entra workforce login into machine access.

## 6. Launch Assignment Guidance

### 6.1 Observers

Use for:

- most internal stakeholders
- read-only users
- leadership visibility
- broad audience who should see Data Pond but not change it

### 6.2 Curators

Use for:

- internal editorial users
- intelligence and governed-content contributors
- limited write users who need to shape output but not govern the platform

### 6.3 Stewards

Use for:

- platform operators
- governance owners
- tightly scoped admins

Keep this group intentionally small.

## 7. External User Separation

Do not place external users into the Entra workforce group model by default.

Preferred launch posture:

- external users use Cloudflare Access One-time PIN
- external users default to `Observer`
- external users remain outside `Data Pond Observers`, `Data Pond Curators`, and `Data Pond Stewards`

If a future partner requires federated SSO, treat that as a separate identity
lane, not a reason to blur internal and external cohorts now.

## 8. App Role Mapping Rule

The app should continue using:

- `viewer`
- `editor`
- `admin`

The product should display:

- `Observer`
- `Curator`
- `Steward`

Recommended mapping rule:

- group membership should influence the default role assignment
- the app database remains the canonical source of the final role value

That preserves flexibility for edge cases and auditability.

## 9. Setup Sequence

### Step 1

Create the Microsoft Entra groups:

- `Data Pond Observers`
- `Data Pond Curators`
- `Data Pond Stewards`

### Step 2

Create the Cloudflare Access identity provider for Microsoft Entra ID.

Preferred protocol:

- OIDC when available

### Step 3

Create Cloudflare Access applications:

- `Data Pond - Main App`
- `Data Pond - Admin and Ops`
- `Data Pond - Browser API`

### Step 4

Assign group-based policies in Cloudflare Access.

### Step 5

Map authenticated users into app roles inside Data Pond.

### Step 6

After SSO is stable, consider SCIM for user and group lifecycle automation.

## 10. Security Posture Recommendations

At launch:

- `Observers` get standard main-app access
- `Curators` get governed write surfaces
- `Stewards` get admin/operator surfaces

For `Stewards`, require:

- Entra-backed workforce identity
- MFA
- tighter Cloudflare Access policy

Next maturity step:

- managed-device posture for `Stewards`

## 11. Canonical Recommendation

Adopt this as the workforce SSO model:

- Microsoft Entra ID is the workforce IdP
- Cloudflare Access is the entry gate
- Data Pond owns final role assignment
- group names remain:
  - `Data Pond Observers`
  - `Data Pond Curators`
  - `Data Pond Stewards`

This is the cleanest launch model for an internal workforce with external users
and machine clients living beside it.
