# Equipment Loan Behavior Specification

Single source of truth for CCAs, equipment and equipment loans. Code: `app/Services/EquipmentLoanService.php`, `app/Http/Controllers/Api/EquipmentLoanController.php`, `MasterService` / `MasterApiController` branches for `ccas`, `equipment`, `equipment_loans`. Tests: `tests/Feature/EquipmentLoanTest.php`. Any change to these rules updates this file and the tests in the same PR.

## Data

- **CCA** (`ccas`): name (unique), description, `active`. Inactive CCAs are hidden from the kiosk.
- **Equipment** (`equipment`): belongs to a CCA; name, optional code, `quantity` (units, at least 1), `active` (available for loan).
- **Loan** (`equipment_loans`): one unit of one equipment item for one student, `start_date`..`end_date` (dates, inclusive), `status`, optional `notes`, `user_id` = staff member who created it from the admin page (null for kiosk requests).

## Lifecycle

| From | Action | To | Who |
| --- | --- | --- | --- |
| (new) | Kiosk request | `requested` | Anyone at the kiosk |
| (new) | Admin create | `reserved` | `equipment_loans create` |
| `requested` | Approve | `reserved` | `equipment_loans confirm` |
| `requested` | Reject | `rejected` | `equipment_loans confirm` |
| `reserved` | Mark returned | `returned` | `equipment_loans confirm` |
| `requested` | Cancel | `cancelled` | Anyone (any time) |
| `reserved`, start date after today | Cancel | `cancelled` | Anyone |

Any other transition returns 422 with a message naming the current status. Once a reserved loan has started, it can only be marked returned.

**Overdue** is not a stored status. A loan is overdue when it is `reserved` and its `end_date` is before today. The API exposes it as `is_overdue` and filters it with `?status=overdue`; the admin list shows it as an "Overdue" badge.

## Rules (enforced on the server for kiosk and admin paths alike)

1. **Duration:** at most 2 calendar days, counting both the start and the end day.
2. **Start date:** today or later. Admin edits may keep a start date that has already passed.
3. **Availability:** the equipment and its CCA must both be active.
4. **Stock:** `requested` and `reserved` loans whose dates overlap the new loan each hold one unit. If they already hold `quantity` units, the loan is refused (422 on `equipment_id`). `rejected`, `cancelled` and `returned` loans hold nothing.
5. **Concurrency:** the stock check runs in a transaction that locks the equipment row.
6. **Editing:** only `requested` or `reserved` loans can be edited (equipment, student, dates, notes). Status changes only go through the transition endpoints. Edits re-run rules 1-4, ignoring the loan being edited.

## Deleting

- A loan can be deleted by `equipment_loans delete`.
- Equipment with any loan history, or a CCA whose equipment has any, cannot be deleted (422). Set it inactive instead. The database foreign keys cascade, so deleting would erase that history.

## Endpoints

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/api/ccas?active=1` | CCAs (kiosk passes `active=1`) | public |
| GET | `/api/equipment?active=1&cca_id=` | Equipment | public |
| GET | `/api/equipment_loans` | Admin list; filters `status` (incl. `overdue`), `student_id`, `equipment_id`, `range_time[start]`/`[end]` (overlap, `YYYY-MM-DD`) | `equipment_loans view` |
| POST | `/api/equipment-loans` | Kiosk request | public |
| POST / PUT | `/api/equipment_loans[/{id}]` | Admin create / edit | `equipment_loans create` / `edit` |
| PUT | `/api/equipment-loans-confirm/{id}` | Approve | `equipment_loans confirm` |
| PUT | `/api/equipment-loans-reject/{id}` | Reject | `equipment_loans confirm` |
| PUT | `/api/equipment-loans-return/{id}` | Mark returned | `equipment_loans confirm` |
| PUT | `/api/equipment-loans-cancel/{id}` | Cancel | public |

Permissions are held by Superadmin and the Booking role.

## Frontend

- **Kiosk** (`components/pages/kiosk/EquipmentLoanSteps.jsx`): Level → Class → Name → CCA → Equipment → Dates. The calendar stops at 2 days. After sending, it shows what was requested and offers "Cancel request".
- **Master › Equipment** (`ManageEquipment.jsx`): CCAs expanding to their equipment.
- **Report › Equipment Loans** (`EquipmentLoans.jsx`): row actions depend on status. Requested: Approve, Reject, Cancel, Edit. Reserved: Mark returned, Edit, plus Cancel before it starts. Date filters send local `YYYY-MM-DD`.
