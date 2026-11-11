# Workday weekly hours

Tampermonkey script that fills Quick Add hours for four UVA jobs. It does not submit the timesheet.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Create a new script and paste `workday-weekly-hours.user.js`, or use Tampermonkey’s “Install from file” on that file.
3. Open Workday **Enter Time**. A **Weekly hours** panel appears at the bottom right.

## Jobs

Defaults are the hours read on November 11, 2026. Time type is Regular Hours.

- **Nov 2–8, 2026:** all four jobs are 0 hours, Monday–Sunday.
- **Nov 9–15, 2026:**
  - Reiss `P590506`: 1, 1, 1.25, 2, 0, 0, 0.5
  - Yi `P581852`: 0, 3.25, 1, 0, 1, 0, 1
  - Floryan `P596989`: 0, 0, 2, 2, 2, 1, 1
  - Somal `P599534`: 0, 0, 0, 0, 0, 0, 0

Edit any day in the panel. Changes are saved in the browser.

## Fill

**Fill selected job** switches to that position in Quick Add and types the hours for the selected week.

If that job’s calendar blocks already match the panel, Fill skips it and does not add another block. Quick Add only adds time; it does not edit an existing block.

The script never clicks Submit. **Click OK after filling** is off until you turn it on. With it off, Fill leaves the grid for you to review.
