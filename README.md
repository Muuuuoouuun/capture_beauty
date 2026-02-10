# g2 Judgment MVP

A judgment-driven review and curation platform for SaaS and AI tools. This MVP emphasizes human impact, cognitive trade-offs, and problem-first discovery.

## What’s included
- **Next.js UI** with landing, search, tool review, and about pages.
- **Judgment-first data model** with human impact scores and verdict badges.
- **API routes** for tools, search, and admin creation with validation.
- **PostgreSQL schema** for production persistence.
- **Integration tests** for API endpoints.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:4001](http://localhost:4001).

## Tests

```bash
npm test
```

## Database schema
The PostgreSQL schema lives in `db/schema.sql`. Wire this up with your preferred ORM or query layer for production.

## API Endpoints
- `GET /api/tools`
- `GET /api/tool/:id`
- `GET /api/search?query=&problem=&badges=`
- `POST /api/tool` (admin)

## Admin
Use the seeded admin ID for admin-only actions:
`admin-9e9b87f3-7b17-4ab9-9c3a-15359e0a2f95`
