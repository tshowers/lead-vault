<p align="center">
  <img src="public/assets/lead-vault-readme-banner.png" alt="Lead Vault" width="100%">
</p>

# Lead Vault

Lead Vault is a standalone Angular app for searching curated and enriched business contacts by company, industry, capability, or buying signal — and unlocking full contact records for a purchase or credit.

Live at [leadvault.taliferro.tech](https://leadvault.taliferro.tech/), part of the Taliferro Tech product suite.

## Features

- **Search** — look up companies, sectors, capabilities, or buyer needs, or validate a single email address.
- **Preview & full record pages** — preview a matched lead, then unlock the full contact record.
- **Checkout flow** — success, unlimited-success, and cancel pages for paid unlocks.
- **Auth callback** — handles redirect-based authentication.

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
