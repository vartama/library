# API Contract — Vartama Library

## Conventions

- Base URL: `/api`
- Success envelope: `{ "data": ... }`
- Error envelope: `{ "message": "...", "details"?: [{ "field": "...", "message": "..." }] }`
- Auth: `Authorization: Bearer <jwt>`
- All primary keys use UUID strings.

## Architecture

```mermaid
flowchart LR
  UI[React + Zustand] -->|HTTP JSON via axios + Bearer JWT| R[Router chi + Middlewares: Authenticate, Authorize]
  R --> H[Handlers + Validator]
  H --> S[Services]
  S --> Repo[Repositories]
  Repo --> PG[(PostgreSQL via Bun ORM)]
  S -.->|Fail-open read-through cache| RC[(Redis)]
```

- **Router & Middlewares** — URL routing, rate limiting, JWT verification (`Authenticate`), and role check (`Authorize`).
- **Handlers** — Decode and validate JSON/query inputs, call services, and format standard JSON envelopes.
- **Services** — Business logic (ACID lending transactions, genre deletion guard, authentication, cache orchestration).
- **Repositories** — The only layer interacting directly with Bun ORM and PostgreSQL.
- **Models** — Bun table mappings (`users`, `genres`, `books`, `lendings`, `lending_items`) and response DTOs.

## Data Model

```mermaid
erDiagram
  users {
    uuid id PK
    text username UK
    text name
    text password_hash
    text role
    timestamptz created_at
    timestamptz updated_at
  }
  genres {
    uuid id PK
    text name UK
    timestamptz created_at
    timestamptz updated_at
  }
  books {
    uuid id PK
    text title UK
    text author
    uuid genre_id FK
    int stock
    timestamptz created_at
    timestamptz updated_at
  }
  lendings {
    uuid id PK
    text borrower_name
    text phone_number
    date due_date
    uuid lent_by_id FK
    text lent_by_name
    timestamptz created_at
  }
  lending_items {
    uuid id PK
    uuid lending_id FK
    uuid book_id FK
    text title
    int quantity
  }

  genres ||--o{ books : "ON DELETE RESTRICT"
  lendings ||--|{ lending_items : "ON DELETE CASCADE"
  books |o--o{ lending_items : "ON DELETE SET NULL"
  users |o--o{ lendings : "ON DELETE SET NULL"
```

## Sequence Diagrams

### Login & Protected Request

```mermaid
sequenceDiagram
  actor U as Librarian
  participant FE as Frontend
  participant API as AuthHandler
  participant AS as AuthService
  participant MW as Authenticate / Authorize
  participant BK as BookHandler

  U->>FE: Username + password
  FE->>API: POST /api/auth/login
  API->>AS: Login()
  AS-->>API: JWT (sub, username, name, role, exp)
  API-->>FE: 200 { data: { token, user } }
  FE->>BK: DELETE /api/books/:id (Bearer token)
  BK->>MW: Verify JWT + require admin role
  alt missing or expired token
    MW-->>FE: 401
  else role is not admin
    MW-->>FE: 403
  else authorized
    BK-->>FE: 204
  end
```

### Create Lending (Atomic SQL Transaction)

```mermaid
sequenceDiagram
  actor U as Librarian
  participant FE as Frontend
  participant API as LendingHandler
  participant SV as LendingService
  participant TX as Bun RunInTx
  participant DB as PostgreSQL

  U->>FE: Fill form + Review lending
  FE-->>U: Lending summary (step 2 of 2)
  U->>FE: Confirm lending
  FE->>API: POST /api/lendings
  API->>API: Validate body (phone, future dueDate, no duplicate bookId)
  API->>SV: CreateLending(ctx, payload, actor)
  SV->>TX: Begin ACID Transaction
  TX->>DB: SELECT books WHERE id IN (...) ORDER BY id FOR UPDATE
  alt missing book(s)
    TX-->>SV: Rollback
    SV-->>API: 404 Some of these books are no longer in the library
  else insufficient stock
    TX-->>SV: Rollback
    SV-->>API: 409 Not enough copies available (+ details)
  else stock sufficient
    TX->>DB: UPDATE books SET stock = stock - qty WHERE id = ? AND stock >= qty
    TX->>DB: INSERT lendings + lending_items (title snapshot)
    TX-->>SV: Commit
    SV-->>API: LendingResponse
    API-->>FE: 201 { data }
    FE-->>U: Success notice + updated stock
  end
```

## Endpoints

| Method | Path | Feature | Auth | Notes |
|---|---|---|---|---|
| `GET` | `/api/health` | — | Public | Returns `{ status: "ok", cache: "up" \| "down" \| "off" }` |
| `POST` | `/api/auth/login` | Auth | Public (10 req / 15m per IP) | Returns `{ token, user }` |
| `GET` | `/api/auth/me` | Auth | Login | Returns `{ id, username, name, role }` |
| `GET` | `/api/books` | F3, F4, F5, Search/Page | Login | Query: `search`, `genreId`, `sortBy=title\|stock`, `order=asc\|desc`, `page`, `limit` |
| `GET` | `/api/books/overview` | Sidebar copies counter | Login | Returns `{ totalBooks, totalCopies }` |
| `POST` | `/api/books` | F1 | **Admin** | `{ title, author, genreId, stock >= 1 }` → `201` |
| `PATCH` | `/api/books/:id` | Edit book | **Admin** | Partial `{ title?, author?, genreId?, stock? >= 0 }` → `200` |
| `DELETE` | `/api/books/:id` | F2 | **Admin** | `204`; lending history snapshots are preserved |
| `GET` | `/api/genres` | Genre master | Login | Returns `[{ id, name, bookCount }]` |
| `POST` | `/api/genres` | Genre master | **Admin** | `{ name }` → `201` |
| `PATCH` | `/api/genres/:id` | Genre master | **Admin** | `{ name }` → `200` |
| `DELETE` | `/api/genres/:id` | Genre master | **Admin** | `204`; returns `409` if `bookCount > 0` |
| `POST` | `/api/lendings` | F6, F7 | Login | Atomic lending creation (`201`) |
| `GET` | `/api/lendings` | F9 | Login | Newest first (`createdAt` desc) |

## Error Status Codes

- `400` — Invalid JSON, invalid UUID, or validation failure (`details` includes field-level messages)
- `401` — Missing/expired JWT or wrong login credentials
- `403` — Insufficient role permission (`admin` required)
- `404` — Route or target resource not found
- `409` — Duplicate title/genre name, genre still in use, or insufficient stock during lending
- `429` — Login rate limit exceeded
- `500` — Unexpected server error
