<p align="center">
  <img src="public/assets/lead-vault-readme-banner.png" alt="Lead Vault" width="100%">
</p>

# Lead Vault

Lead Vault is a standalone Angular app for finding and researching business contacts when a company needs a better starting point for outreach. It searches curated and enriched lead data by company, industry, capability, location, or buying signal, then lets a user review a masked contact preview before deciding whether to unlock the full record.

Live at [lead-vault.taliferro.tech](https://lead-vault.taliferro.tech/), part of the Taliferro Tech product suite.

## What it's for

Lead Vault is designed for sales, business development, recruiting, partnerships, and research teams that need relevant contacts without beginning with a broad, unqualified list. It helps a user answer questions such as:

- Which companies may need a particular service or capability?
- Who appears to be a useful contact at a target company?
- Is an email address valid and how confident is that result?
- Does a lead have enough company context to justify an outreach conversation?

The app is intentionally focused on lead discovery and contact access. It is not a CRM, campaign sender, or saved-search management system.

## Features

- **Search** — look up companies, sectors, capabilities, or buyer needs, or validate a single email address.
- **Intent-aware searching** — natural-language queries can be translated into search terms, with fallback searches and recovery suggestions when the first query returns no matches.
- **Prepared lead sets** — open a lead set staged by a momentum workflow through a `momentumPreparedSet` link.
- **Preview & full record pages** — inspect a lead's masked email, quality score, capabilities, location, and company context before unlocking the full record.
- **Email validation** — check an email address and view a validity verdict with a confidence score; matching leads can be opened for review.
- **Contact access** — check whether an email already has access to a record, unlock an individual lead, or use the Suite subscription path for unlimited Lead Vault access.
- **Recommendations** — purchase or retrieve a lead-specific recommendation for an outreach goal.
- **Checkout flow** — Stripe checkout confirmation pages for individual unlocks, recommendations, and unlimited access, plus a cancellation page.
- **Authentication callback** — handles redirect-based sign-in flows and uses the signed-in email when checking contact access.

## Typical workflow

1. Search for a company, sector, capability, location, or buyer need, or switch to **Validate Email** to check an address.
2. Review matching lead cards and open a record preview.
3. Evaluate the visible company and lead intelligence, including the masked email, score, capabilities, and location.
4. Enter an email address to check for existing access or start Stripe checkout.
5. After confirmation, open the full record with the available contact and company details.

## Development

```bash
npm install
npm start
```

Navigate to `http://localhost:4200/`. The app reloads automatically on source changes.

## Build

```bash
npm run build
```

Build artifacts are written to `dist/lead-vault`.

## Test

```bash
npm test
```

Runs unit tests via [Karma](https://karma-runner.github.io).

## Deployment

Hosted on Firebase Hosting under the `lead-vault` site.

```bash
firebase deploy --only hosting:lead-vault
```

The app uses the Taliferro Tech API for search, email validation, previews, access checks, checkout, and full-record retrieval. Local and production builds are configured in `src/environments/`; both currently point at `https://api.taliferro.tech/api`.
