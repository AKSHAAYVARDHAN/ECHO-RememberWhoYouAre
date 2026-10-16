# Security Spec: EXIF — The Soul Within

## 1. Data Invariants
- Each user profile is strictly private to `/users/{userId}` where `{userId}` must equal `request.auth.uid`.
- Quotes in `/users/{userId}/quotes/{quoteId}` are strictly private to the authenticated owner where `userId == request.auth.uid`.
- Users cannot read or write another user's profile or quotes.
- Quotes must have non-empty text with a maximum of 280 characters.
- Profile display names are capped at 60 characters, bios at 300 characters, locations at 80 characters.
- Root collection catch-all denies all other reads and writes.

## 2. The Dirty Dozen Payloads & Attack Scenarios
1. Unauthenticated read on `/users/{userId}` -> PERMISSION_DENIED.
2. Unauthenticated write on `/users/{userId}` -> PERMISSION_DENIED.
3. Authenticated user A reading `/users/userB` -> PERMISSION_DENIED.
4. Authenticated user A writing `/users/userB` -> PERMISSION_DENIED.
5. Authenticated user A writing `/users/userA/quotes/quote1` with mismatched `userId: "userB"` -> PERMISSION_DENIED.
6. Authenticated user A listing `/users/userB/quotes` -> PERMISSION_DENIED.
7. Unauthenticated user listing `/users/userA/quotes` -> PERMISSION_DENIED.
8. Authenticated user A updating quote in `/users/userB/quotes/quote1` -> PERMISSION_DENIED.
9. Authenticated user A deleting quote in `/users/userB/quotes/quote1` -> PERMISSION_DENIED.
10. Attempting to inject oversized quote (>280 chars) -> PERMISSION_DENIED.
11. Reading root collection `/system` or `/test` without explicit rule -> PERMISSION_DENIED (catch-all default deny).
12. Attempting to write arbitrary ghost collection `/admins` or `/settings` -> PERMISSION_DENIED.
