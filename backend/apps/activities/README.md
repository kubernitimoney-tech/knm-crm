# Activities App

## 1. Purpose

Generic timeline (Customer Created, Loan Approved, Document Uploaded) via ContentTypes.

## 2. Structure

`models/activity.py`, `services/activity_service.py`, `ActivityTimelineAPIView`

## 3. Schema

`Activity`: actor, verb, description, content_type, object_id (UUID), metadata JSON

## 4. Relationships

Generic FK to any model with UUID PK.

## 5. Sample response

```json
{
  "success": true,
  "data": {
    "timeline": [
      {
        "description": "Loan Submitted",
        "verb": "submit",
        "actor_email": "rm@lms.local",
        "created_at": "2026-06-01T12:00:00Z"
      }
    ]
  }
}
```

## 6. API

`GET /api/v1/activities/timeline/?type=loan_application&id=<uuid>`

## 7–13. Flow

Domain services call `ActivityService.log(actor, verb, description, target)` after successful commits.
