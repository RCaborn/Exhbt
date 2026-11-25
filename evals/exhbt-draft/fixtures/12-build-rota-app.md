# Larder Rota: a web app for a food bank's volunteer shifts

BSc Computer Science, Year 2 software engineering project. University of Thornbury, spring term 2026. Individual project for Millgate Food Bank.

## The problem

Millgate Food Bank filled its volunteer shifts from a paper sheet pinned up in the hall. Volunteers had to come in to sign up, and the coordinator rang round each week to fill the gaps.

## What it does

- A volunteer signs in with their email address and picks open shifts from a weekly calendar.
- The coordinator sees unfilled shifts in red and can message everyone who is free that day.
- Each volunteer gets a reminder email the evening before their shift.

## How I built it

I interviewed the coordinator and four volunteers, then sketched the screens on paper. I built the front end in React and the back end in Node.js with a PostgreSQL database, and deployed it on a free hosting tier. I wrote 38 automated tests. I tested it with 12 volunteers over three weeks and fixed the problems they found, mainly on older phones.

## Result

In the three weeks of the trial the coordinator made 4 phone calls to fill gaps, down from 23 in the three weeks before.

"I get my Thursday evenings back." Dawn Okoro, volunteer coordinator.

## Links

Demo, with a test login on the page: https://example.com/larder-rota-demo

Code: https://example.com/larder-rota-code

## What I would do next

I would add text-message reminders, because several older volunteers do not read email.

## References

I followed the accessibility checklist at https://example.org/accessibility-checklist when I built the forms.
