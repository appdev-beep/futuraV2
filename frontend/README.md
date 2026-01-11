# Frontend

## PDF/CSV Export

The Supervisor CL Review page supports structured exports:

- Export CSV: Downloads a CSV with employee info and competencies.
- Export PDF: Generates a formatted PDF (title, employee info, and a table of competencies) using jsPDF + autoTable.

### Install dependencies

Run these commands inside `frontend/`:

```
npm install jspdf jspdf-autotable
npm run dev
```

