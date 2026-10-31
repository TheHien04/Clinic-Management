# Synthetic clinical dataset

The analytics dataset in this repository is database-backed but **fully synthetic**. It is designed for product demonstrations, data engineering exercises, and UI validation. It must not be described as real patient data and must not be used for clinical decisions.

## Version `health-synthetic-v1`

Migration `007_seed_synthetic_clinical_dataset.sql` deterministically creates:

- 240 synthetic patients across varied ages, genders, locations, and documented histories;
- 12 synthetic doctors across 12 specialties;
- 1,440 appointments, including 893 completed encounters, historical cancellations/check-ins, and future bookings;
- 893 ICD-10-coded medical records drawn from a governed terminology table;
- append-only care, analytics, research, and genomics consent decisions;
- 40 consent-linked molecular-profile metadata records (no raw sequence or identifiable specimen data).

The migration is idempotent. `dbo.SyntheticDatasetRuns` records the applied dataset version and row counts. Synthetic rows carry stable `SyntheticKey` values, so they can be distinguished from user-created operational records.

## Storage flow

1. SQL Server is the transactional source of truth.
2. Medical-record and molecular-profile commits append privacy-minimized events to `dbo.ClinicalEventOutbox` in the same transaction.
3. The backend relay claims outbox rows with row locks and publishes them to MongoDB using idempotent upserts.
4. MongoDB exposes read-optimized `clinical_events` and `molecular_profiles` collections.
5. Patient charts call the governed API; the page no longer injects patient or appointment mock arrays when the backend is unavailable.

## Governance controls

- clinic/tenant identifiers and scoped clinical queries;
- append-only consent decisions;
- hash-chained, immutable clinical audit events;
- ICD-10 terminology validation metrics;
- metadata-only genomics registry linked to an explicit genomics consent;
- no prescriptions or free-text clinical notes copied to MongoDB;
- explicit non-diagnostic labeling for operational prioritization.

The Mongo envelope is deliberately labeled **FHIR-inspired**. It has not been validated against an official FHIR implementation guide and is not a FHIR conformance claim.
