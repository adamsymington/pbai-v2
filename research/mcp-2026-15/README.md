# MCP 2026-15 helicopter market research

Market research section for the rotary-wing MAS SIN business case.

- `report_draft.md`: Part 1 facts sheet and Part 2 full report under the MCP BCA headings. Public-source findings are filled in; obligation-based cells are marked [DATA].
- `data_requests.md`: FAIRS request text (send first), USAspending/SRP/TDR/eLibrary/LESO/grant pull specs, outreach list.
- `analyze.py`: ingests the exports and produces `outputs/tables.md`, `facts.json`, and supporting CSVs (CBP share under every base, MAS share, competition, unit prices, completion-work share, adjacent spend).
- `quantity_overrides.csv`: manual corrections after reviewing `outputs/award_review.csv`.
- `tests/make_fixture.py`: synthetic data for a smoke test. Its values are invented.

Smoke test:

```
python3 tests/make_fixture.py /tmp/fx
python3 analyze.py --psc /tmp/fx/psc1520.csv --naics /tmp/fx/naics336411.csv --out /tmp/out
```

Requires Python 3.10+ and pandas.
