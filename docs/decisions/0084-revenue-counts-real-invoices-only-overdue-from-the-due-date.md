# 0084 — Revenue counts real invoices only, and overdue comes from the due date, on every screen

**Status:** decided by the owner on 2026-09-14 ("Haan, har jagah"). Being built:
- the app, for 1.4.6;
- the web, on its own branch, going live on the owner's word.

**Related:**
- 0081 and 0082, one currency on the money screens. This was found while building them.
- The web question of 2026-09-11: should both dashboards follow the list rule? Both still counted drafts.
- G3, trust.

## Context

- **The app's Analytics tab counted drafts and cancelled invoices** in Revenue and Outstanding. So its Revenue differed
  from the invoices dashboard's Total Revenue, even in one currency.
- **It read Overdue from the stored status,** which nothing sets. So Overdue likely always read 0.
- **The dashboard's breakdown sheet included drafts,** so its subtotals did not add up to its own total.
- **The web dashboard counted drafts too,** and showed a draft as "overdue".

## Decided

- **Every money screen uses the invoice list's rule,** through one shared function in each codebase:
  - drafts and cancelled invoices never count toward revenue, outstanding or overdue;
  - an invoice is overdue when it is unpaid past its due date. This is worked out from the date and never stored;
  - a draft is never overdue.
- **The screens it covers:**
  - the app's Analytics tab: Revenue, Outstanding, Overdue, the trend and the top customers;
  - the invoices dashboard's breakdown sheet;
  - the web dashboard.

## Rejected

- **Leaving each screen its own rule.** The same business showed different totals on screens one tab apart.
- **The app only, and the web later.** The owner chose every screen.

## Consequences

- **Numbers change for users who have drafts.** Their Analytics revenue drops to the dashboard's figure. That is the
  fix, not a regression.
- **The app half ships with 1.4.6,** which means iOS build 18 or later.
- **The web half goes live on the owner's word.**
- **Not part of this decision:**
  - expenses are not filtered by business;
  - the key metrics cover all time while the chart shows 30 days;
  - the All Businesses chip says "No business selected";
  - the Payments form's copies of these cards, which wait for that form's review.
