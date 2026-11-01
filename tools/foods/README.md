# The food dictionary's sources

`app/js/foods.js` is generated from these files. Edit them, then run from the repository root:

    node tools/foods/build.mjs            # writes app/js/foods.js, checks every old name still resolves
    node tools/foods/build.mjs --report   # also lists nutrition changes and split translation rows

- `src-1-staples.txt` … `src-4-pantry.txt`: one food per line,
  `id | department | it | de | en | other names (;) | nutrition key | extra`.
  `extra`: `of:<id>` (a more specific kind of that food), `basic` (always at home), weight overrides like `piece:55`.
  Household and personal-care lines have no nutrition key.
- `foods.template.js`: the resolver; the build puts the data into it.
- `nutrition-v38.js`, `lang-food-v38.js`: frozen copies of the tables the dictionary replaced (v38). The build takes
  nutrition values from them and checks that every name they knew still resolves. Don't edit them.
- `gone.txt` (optional): ids merged into others, one `old-id|>new-id` per line. Ids never change or get reused.

`foods.js` is shared with Everyday: after a change, send it with its new md5 in a handoff.
Nothing here is loaded by the app; the service worker doesn't cache this folder.
