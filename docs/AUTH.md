# Authentication & Authorization

## Auth Method
- **Google OAuth 2.0** — no email/password; users sign in with their Google account
- After OAuth, the backend issues its own **JWT Bearer tokens** for subsequent API calls
- Access token: short-lived (15 min)
- Refresh token: long-lived (7 days), stored in `httpOnly` cookie

## OAuth Flow

```
1. Frontend redirects user to Google consent screen
   GET /api/v1/auth/google/redirect

2. Google redirects back with authorization code
   GET /api/v1/auth/google/callback?code=...

3. Backend exchanges code for Google tokens,
   fetches user profile (email, name, avatar)

4. Backend upserts User row (create on first login, update on subsequent)

5. Backend issues app JWT (access + refresh) and redirects to SPA
   → SPA stores access token in memory, refresh token in httpOnly cookie
```

## Libraries
- **Backend**: `authlib` (Google OAuth client) + `python-jose` (JWT)
- **Frontend**: redirect to `/api/v1/auth/google/redirect` — no frontend OAuth SDK needed

## Endpoints
```
GET  /api/v1/auth/google/redirect    # redirect to Google consent screen
GET  /api/v1/auth/google/callback    # OAuth callback, issues JWT, redirects to SPA
POST /api/v1/auth/refresh            # exchange refresh token for new access token
POST /api/v1/auth/logout             # clear refresh token cookie
GET  /api/v1/auth/me                 # return current user profile
```

## Token Payload
```json
{
  "sub": "<user_id>",
  "email": "user@example.com",
  "workspace_id": "<workspace_id>",
  "role": "admin | member | guest",
  "exp": 1234567890
}
```

## User Upsert Logic (on callback)
1. Fetch Google profile: `email`, `name`, `picture`
2. Look up `User` by `email`
3. If not found → create new `User` (first login)
4. If found → update `display_name` and `avatar_url` from Google profile
5. Issue JWT and set refresh token cookie

## Role Hierarchy (Workspace level)
| Role | Description |
|------|-------------|
| `owner` | Full control; can delete workspace |
| `admin` | Manage members, teams, settings |
| `member` | Create/edit tasks, manage own content |
| `guest` | Read-only or limited write as explicitly granted |

## Permission Enforcement
- Role checks enforced at the **service layer**, not just route decorators
- Custom field `visibility_roles` / `editable_roles` checked per field on every read/write
- Space/List visibility per Team checked before returning any list or task data

## Environment Variables
| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth app client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app client secret |
| `GOOGLE_REDIRECT_URI` | Must match Google Console setting (e.g. `http://localhost:8000/api/v1/auth/google/callback`) |
| `JWT_SECRET_KEY` | JWT signing secret |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Default: 15 |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Default: 7 |
