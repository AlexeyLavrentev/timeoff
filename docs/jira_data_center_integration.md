# Jira Data Center Integration (Auto Replacement On Leave)

## Goal

Keep vacation planning in TimeOff, and automatically reassign Jira issues to a deputy when assignee is absent.

## What is added in this repository

1. New replacement mapping model: `UserReplacement`
2. New migration: `migrations/20260212112000-add-user-replacements.js`
3. New Integration API endpoint:
   `GET /integration/v1/report/replacements`

## Data model

`UserReplacement` stores replacement rules inside the same company:

- `companyId`
- `userId` (employee who can be absent)
- `replacementUserId` (deputy)
- `priority` (1 is highest priority)

Unique rule: `(companyId, userId, replacementUserId)`.

## Endpoint

`GET /integration/v1/report/replacements`

Auth:

- Header `Authorization: Bearer <integration_api_token>`

Query params:

- `date=YYYY-MM-DD` (optional, defaults to company "today")
- `start_date=YYYY-MM-DD` (optional)
- `end_date=YYYY-MM-DD` (optional)
- `department=<id>` (optional)
- `leave_statuses=Approved,New` (optional, default: `Approved`)

Behavior:

- Finds employees absent in date range by leave status.
- Resolves replacement candidates by priority.
- Marks candidate as unavailable if candidate is absent in same period.
- Returns `selectedReplacement` as first available candidate.

## Example request

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/integration/v1/report/replacements?date=2026-02-12&leave_statuses=Approved"
```

## Example response shape

```json
{
  "startDate": "2026-02-12",
  "endDate": "2026-02-12",
  "leaveStatuses": ["Approved"],
  "totalAbsentEmployees": 2,
  "data": [
    {
      "user": { "id": 7, "email": "a@example.com", "fullName": "Alice Smith", "department": "Support" },
      "leaves": [{ "id": 120, "startDate": "2026-02-12", "endDate": "2026-02-14", "status": "Approved" }],
      "selectedReplacement": { "id": 12, "email": "b@example.com", "fullName": "Bob Brown", "priority": 1, "available": true },
      "candidates": [
        { "id": 12, "email": "b@example.com", "fullName": "Bob Brown", "priority": 1, "available": true },
        { "id": 13, "email": "c@example.com", "fullName": "Carol White", "priority": 2, "available": false }
      ]
    }
  ]
}
```

## Recommended Jira DC flow

Use a small external worker (cron every 5-15 minutes):

1. Call TimeOff `/integration/v1/report/replacements` for today.
2. For each absent user with `selectedReplacement`:
3. Find Jira issues via JQL by assignee and status/project constraints.
4. Reassign issue to replacement via Jira REST.
5. Write audit logs in worker.

Suggested JQL example:

```text
assignee = "alice.smith" AND statusCategory != Done
```

Jira reassignment API:

`PUT /rest/api/2/issue/{issueKey}/assignee`

Body:

```json
{ "name": "bob.brown" }
```

## Notes

- Keep mapping between TimeOff employee and Jira user in one place
  (email is usually simplest).
- Start with dry-run mode in worker to validate replacement rules.
- If no replacement is available, route issue to team lead queue user.
