# Company Documents (Nimbus Digital Solutions)

Company-level HR documents only. No employee-specific data. All content is synthetic sample material.

| File | Content |
|---|---|
| 01-employee-handbook.md | Values, employment basics, hours, onboarding, policy index |
| 02-leave-policy.md | Leave types and days, applying for leave, LOP |
| 03-code-of-conduct.md | Conflicts of interest, gifts, anti-bribery, social media |
| 04-anti-harassment-posh-policy.md | POSH Internal Committee, complaint process, timelines |
| 05-information-security-policy.md | Data classes, access, devices, incident SLA |
| 06-data-privacy-policy.md | HR data processed, retention schedule, individuals' rights |
| 07-remote-hybrid-work-policy.md | Work models, allowances |
| 08-travel-reimbursement-policy.md | Claim rules, limits, travel |
| 09-performance-management-policy.md | Cycle, rating scale, increment matrix, PIP, promotions |
| 10-compensation-benefits-policy.md | Salary bands, payroll structure, benefits by country |
| 11-learning-development-policy.md | L&D budget, mandatory training |
| 12-disciplinary-policy.md | Progressive steps, gross misconduct |
| 13-whistleblower-policy.md | Channels, handling, protection |
| 14-separation-exit-policy.md | Resignation, exit checklist, full & final settlement, exit documents |
| 15-statutory-compliance-calendar.md | PF/ESI/TDS/gratuity and US/CA/DE/SG filings, audit exports |
| 16-holiday-calendar-2026.md | Public holidays by location |

## PDFs (`pdf/`) - one layout per doc, each needs its own chunking strategy
Build with `.venv/bin/python -m scripts.build_company_pdfs`. The MD files are the source; the PDFs are regenerated from them.

| Layout | Docs | Structure | Chunking strategy |
|---|---|---|---|
| book | 01 handbook | Cover, table of contents, one chapter per page, running header | Heading hierarchy: split per chapter, carry the chapter title as metadata |
| legal | 03 conduct, 04 POSH, 12 disciplinary | ARTICLE n, numbered clauses n.m (tables flattened to clauses) | Clause-level: regex `^\d+\.\d+`, prefix with the article title |
| matrix | 02 leave, 05 infosec | Whole doc is one 2-column Topic/Requirement table | Row-as-record: one row = one chunk, topic as key |
| twocol | 06 privacy, 16 holidays | Two-column newspaper flow | Layout-aware: extract per column (bounding box) before splitting |
| faq | 07 remote work | Everything rewritten as Q/A pairs | Q&A pair: one question and its answer = one chunk |
| slides | 09 performance | Landscape, one topic per page, large type | Page-level: one page = one chunk |
| sheet | 08 travel, 10 compensation, 15 statutory | Landscape dense tables, prose moved into numbered note tables | Table-row: one row plus its header row = one chunk |
| checklist | 11 L&D, 14 separation | Checkbox items grouped in per-section tables | List-group: section title plus its items (split by item if long) |
| memo | 13 whistleblower | Memo header block, then continuous prose with no headings | Fixed-size sliding window (e.g. 800 chars, 150 overlap) |
