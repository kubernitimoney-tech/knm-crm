# Documents App

## 1. Purpose

KYC document upload with versioning, storage abstraction, virus-scan hook.

## 2. Structure

`models/`, `storage/backends.py`, `services/document_service.py`, `UploadDocumentAPIView`

## 3. Schema

`DocumentType`, `LoanDocument`, `DocumentVersion` (file metadata + version_number)

## 4. Relationships

`LoanApplication` 1—* `LoanDocument` 1—* `DocumentVersion`

## 5. Sample types

pan, aadhaar, salary_slip, bank_statement, photograph — `seed_document_types`

## 6. API

`POST /api/v1/documents/upload/{application_id}/` multipart: `document_type`, `file`

## 7. Permissions

document.view | upload | download | delete

## 8–13. Upload flow

View → `DocumentService.upload_document` → virus hook → storage backend → `ActivityService` → response envelope.

Production: replace `LocalStorageBackend` with S3; enable `DOCUMENT_VIRUS_SCAN_ENABLED`.
