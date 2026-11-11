# Workday weekly hours

Two Tampermonkey scripts for UVA Workday Enter Time. Neither one submits the timesheet.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Add `workday-weekly-hours.user.js` and, if you want the wipe tool, `workday-delete-hours.user.js`.
3. Open `https://www.myworkday.com/`. The scripts match that host directly, plus any `myworkday.com` or `workday.com` host, including frames.

## Default week

Each week uses the same Regular Hours template and totals 20. Monday through Sunday:

- Reiss `P590506`: 0.75, 1, 1.25, 2, 0, 0, 0.5 (5.5)
- Yi `P581852`: 0, 3.25, 1, 0, 1, 0, 0.5 (5.75)
- Floryan `P596989`: 0, 0, 2, 2, 2, 0.75, 1 (7.75)
- Somal `P599534`: 0, 0, 0, 1, 0, 0, 0 (1)

Nov 2–8 and Nov 9–15 both start from this template. Edit any day in the panel. Changes are saved in the browser.

## Fill

**Fill selected job** opens Quick Add for the selected week and position and types that row.

If the calendar already shows the same hours, Fill skips the job. If that job already has different hours, Fill does not add another block. Quick Add only adds time; it does not edit a block.

The script never clicks Submit. **Click OK after filling** is off until you turn it on.

## Delete

`workday-delete-hours.user.js` adds a **Delete hours** panel. Pick one week or both visible weeks, check **Delete these blocks**, then click **Delete**. It only removes blocks on the dates you picked, and it never clicks Submit.
