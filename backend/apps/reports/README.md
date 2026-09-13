# Reports App

## 1. Purpose

Async portfolio export — Celery task + synchronous preview rows.

## 2. Structure

`services/report_service.py`, `tasks.py`, `GenerateReportAPIView`

## 6. API

`POST /api/v1/reports/portfolio/` — permission `report.export`

## 12–13. Flow

`ReportService.export_portfolio_report` → `generate_loan_portfolio_report.delay()` + filtered `values()` preview (max 1000 rows).

Production: task writes CSV to S3 and notifies user via notifications app.
