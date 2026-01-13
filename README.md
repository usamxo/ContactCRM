# ContactCRM

A minimal contacts/CRM app with search, tags, and local JSON storage.

## Features
- Add, edit, delete contacts
- Search and quick filtering
- Tags support
- Summary by company
- JSON file storage

## Run locally

```bash
npm install
npm start
```

Open: http://localhost:3000

### Configuration
- Set a custom port: `PORT=4000 npm start`

## API
Base URL: `/api/contacts`

- `GET /api/contacts` — list Contacts
- `POST /api/contacts` — create a Contact
- `PUT /api/contacts/:id` — update a Contact
- `DELETE /api/contacts/:id` — delete a Contact

Data is stored in `data/db.json` (auto-created).

## Notes
This is a lightweight starter intended for learning, prototypes, and small internal tools.
