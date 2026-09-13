# Dashboard App

## 1. Purpose

Aggregated KPIs — why APIView not ViewSet: multi-model aggregation, not CRUD.

## 2. Structure

`services/dashboard_service.py`, `DashboardAPIView`

## 6. API

`GET /api/v1/dashboard/` — permission `dashboard.view`

## 5. Sample data

```json
{
  "success": true,
  "data": {
    "customers": 2,
    "applications": 1,
    "active_loans": 0,
    "applications_by_state": { "draft": 1 }
  }
}
```

## 13. Queries

Single aggregate query with `values().annotate(Count)` for state breakdown.
