# Ricette: recipes, shopping list and pantry

A small app (IT / DE / EN) that runs in the browser on phone, laptop and desktop,
works offline, and keeps all your data as plain files in this repository.

- **Two tabs for recipes:** **Import** holds the import tools (link, photo, write by hand, "Save in" folder, imports in
  progress, recently added); **Recipes** is your collection (search, pinned tags, filters, sorting, folders).
- **Recipes:** paste a link and it gets imported automatically, with its photo, or add a recipe by hand.
- **Recipes from photos (free):** tap *Recipe from a photo*, choose 📖 book or ✍️ note, and photograph the page
  (several pages are fine). The text is read for free on GitHub with Tesseract (open-source text recognition),
  turned into title, servings, ingredients and steps, and the recipe appears marked with its source (book title and
  page) and with the original pages attached, ready for you to check. A photo of the dish is taken from Wikipedia,
  with credit to its author. For **handwriting**, let your phone read the text (iPhone Live Text, Google Lens),
  copy it and use *Or paste the text*: the recipe opens straight away for checking.
- **Whole cookbooks (PDF or EPUB):** on the Import tab tap **📚 Whole book**, pick the file, and every recipe in the
  book becomes its own recipe, in a folder named after the book (with the cover). Each one keeps its page number, a
  picture of its page(s) to check against, and the book's own photo when there is one (on the page, or a photo page
  facing it). PDFs with text take a few minutes; scanned PDFs are read page by page with the same free text
  recognition as photos and take longer (roughly 5–15 s per page). Recipes are marked "check" because a book's
  layout can fool the reader. The file is read by GitHub in your private repo and deleted afterwards. The app uploads
  up to 50 MB; for bigger files, put them in the repo's `books/` folder (GitHub website or git) and they're picked up
  automatically. Imports run on GitHub Actions minutes (private repos get 2,000 free minutes a month).
- **Photos from the web:** recipes without a picture (typed in, pasted, books without photos, and all the ones you
  already have) get one automatically: Wikipedia first, then Pixabay (with your free key), then Openverse (openly
  licensed photos, no key, a few per run). The GitHub job does it, 40 recipes per sync, and each recipe is only tried
  once. While editing a recipe, **🔍 Search photo online** shows a grid of candidates from all sources. The
  photographer/licence is saved with the picture. Pictures are always stored in your repo: if a site doesn't let the
  phone download one, the app shows it from its address for a moment and GitHub saves the copy.
- **Pixabay key (free, no card):** create an account on pixabay.com and log in, open pixabay.com/api/docs: your key is
  shown in the "Parameters" section next to *key*. Paste it in **Settings → Online**. It is saved in your private data
  repo (`data/prefs.json`), so it works on every device and for the GitHub job. Limit: about 100 requests a minute.
  (Pexels has paused new API keys; if you already have one, it can still be added under Settings → Online.)
- **Ideas from the web ("What should I cook?"):** tick ingredients you have (things about to expire are preselected,
  and you can add others), then **Suggest recipes**. TheMealDB (free, English, ~700 recipes) answers within seconds.
  GialloZafferano, Il Cucchiaio d'Argento, Chefkoch and BBC Good Food are searched by the GitHub job in each site's
  language (results in about a minute, a few Actions minutes per search). Each result shows which of your ingredients
  it uses and what's missing; recipes with more missing ingredients than your limit (Settings → Online, default 3;
  salt, pepper, oil and water don't count) are tucked away under "show more". **Save** adds one to your recipes with
  its photo. Sources can be switched on/off one by one. Sites can change their pages or block automated searches;
  when that happens the app says which site couldn't be reached.
- **Ingredients in three languages:** the pantry check now knows that "Eier", "eggs" and "uova" are the same thing
  (about 190 common ingredients), so German and English recipes are matched against an Italian pantry too.
- **Photos:** add as many as you like to any recipe (camera or files), pick the cover, remove them.
  They're shrunk on the device (about 250 KB each) and kept on every device, so they show offline too.
- **Tags:** recipes get automatic tags from their ingredients, title and time. Each recipe gets one course
  (antipasti, primi, secondi, contorni, desserts, drinks), plus salads, soups, pasta, rice, meat, fish, vegetarian,
  vegan, quick ≤ 30 min and oven-baked. Add your own tags on the recipe page, and remove any automatic tag that
  doesn't fit. In **Settings → Tags** you can rename, switch off, or add keywords to any automatic tag (keywords on a
  course tag win over the guess, e.g. "gnocchi" → Primi). You can also create your own keyword tags (e.g.
  *Aperitivo*: spritz, prosecco) and rename or delete your own tags across all recipes. Tag settings sync like
  everything else, in `data/tags.json`.
- **Origin tags:** recipes also get a country tag (🇮🇹 Italia, 🇬🇷 Grecia…) and a continent tag (🌍 Europa, 🌏 Asia,
  🌍 Medio Oriente, 🌎 America Latina…). They come from the cuisine the website states (schema.org `recipeCuisine`,
  TheMealDB's area), from words of origin in the title ("insalata greca", "Thai curry", "Wiener Schnitzel",
  "alla romana") and from a few hundred well-known dishes (carbonara, paella, moussaka, ramen…). An origin word beats a
  dish name ("Pizza alla messicana" → Messico). If nothing is clear the recipe gets no origin tag rather than a guess.
  Fix it in the recipe's **Origin / cuisine** field (e.g. "Greek", "Italia", "Thai"), or remove the tag; in Settings →
  Tags → Origin you can switch any of them off, rename them or add keywords (e.g. "nonna Fatima" → Marocco, which also
  brings its continent). Filters have an **Origin** group.
- **Sorting and filters:** sort by newest, A–Z, quickest, fewest ingredients, most or recently cooked, or "what I
  have". Filter by tags (grouped into course, diet and more), source (web / book / note), time, or "ready with my
  pantry" across all folders. **Pin** tags (📌 in the filters or in Settings → Tags): pinned tags come first in the
  filters and appear as one-tap shortcuts above your recipes; the others are sorted by how often they're used.
- **What should I cook?** Two orders: **I have most of it** (the biggest share of ingredients already at home first)
  or **Expiring first** (recipes that use what goes bad soonest first, showing which item and when). One tap adds
  what's missing to the shopping list. Salt, pepper, oil and
  water count as always available (you can turn that off).
- **Folders:** organize recipes in folders and sub-folders, each with a cover: your own photo, or automatically the
  newest recipe's photo. Choose where imports go with "Save in" on the Import tab; search looks through every
  folder. Delete a folder with 🗑 inside it (or ⋯ on its tile): keep its recipes (they move up) or delete them too.
- **Times: hands-on work and waiting.** Every recipe shows its total time split into 🔪 work and ⏳ waiting.
  Times stated by the recipe come first: "Prep/Cook/Total time" from websites, and labelled times in books, photos
  and pasted text ("Prep Time: 30 mins", "Cottura: 1 ora e 15 minuti", "Ruhezeit: über Nacht"). Where nothing is
  stated, the app estimates it from the steps. Oven, resting, rising, cooling, fridge, marinating and simmering
  count as waiting ("leave it to cool completely" ≈ 1 h, "until doubled" ≈ 1½ h). Kneading, stirring, frying and
  chopping count as work, plus a little per ingredient and step. Preheating doesn't count. Estimates are marked "≈".
  This works for existing recipes too, with nothing to migrate. Set your own numbers in the editor if you prefer.
  Filter by total time or by hands-on time, and sort by "least hands-on work".
- **Servings:** change the number of people and every quantity scales. In the Recipes view, **👥 People for all
  recipes** sets the number for every recipe at once (recipe pages, shopping list, "What should I cook?"); each recipe
  can still be changed on its own, and the original number stays visible.
- **Calories and protein (estimated, offline):** every recipe shows ≈ kcal and protein per person, plus the total for
  the people you're cooking for, with a per-ingredient breakdown. The app works it out from a built-in table of average
  values per 100 g (Italian, German and English ingredient names, piece weights like "2 uova", spoons, cans, "una noce
  di burro"…); no internet, no API. Ingredients without a quantity ("q.b.") are left out, and unrecognised ones are
  named so you know the estimate is partial. While editing a recipe the estimate updates as you type. Filter by
  ≤ 400/600/800 kcal or ≥ 15/25/35 g protein per person, and sort by fewest calories or most protein.
- **Shopping list:** add a recipe for N people and the ingredients get merged into one list.
  If the pantry already has something, only the missing amount is added. Show the list **by department**, **by
  recipe** or as a **plain list**, and drag ⠿ to put items, departments and recipes in your own order (works with a
  finger on the phone; arrow keys on a computer). The department order (also in Settings) is used by the pantry too,
  and the order syncs to all your devices.
- **From the shop to the pantry:** tick items as you shop, then **Put in pantry**: check quantities, add expiry dates,
  and scan products to link them (scanning the same product twice = two packs). Everything goes into the pantry in
  one go: existing items are topped up, new ones are created in the right department.
- **Departments:** the pantry and the shopping list are grouped by department (fruit & veg, bread, meat & fish,
  dairy & eggs, pasta & rice, pantry staples, condiments, sweets, drinks, frozen). Each department shows what's out or
  running low; change an item's department in its edit window.
- **Barcodes for things you already have:** scanning an unknown product offers to link it to a matching pantry item
  ("Latte intero UHT" → your "Latte"); each item can also link barcodes itself (several per item, e.g. two brands).
- **Pantry:** set a "remind me at" threshold per item. When stock drops to it, the item goes on the
  shopping list by itself. Ticking it off at the shop restocks the pantry, and "I cooked it" uses
  ingredients up.
- **Barcode scanning:** in the pantry, tap *Scan barcode* and point the camera at a package. The product
  name, brand and pack size come from [Open Food Facts](https://world.openfoodfacts.org), a free open database.
  Scanning something you already have adds a pack (or removes one when used up), and the ± buttons then
  move by whole packs. You can also type the number under the barcode. Scanning works offline: the name
  is looked up as soon as you're back online.
- **Expiry dates:** give pantry items an expiry date. Items about to expire are listed at the top
  of the pantry with a count on the tab. Every morning a notification lists what's expiring, even
  with the app closed. Choose how many days ahead in Settings (default 3), or per item.
- **Offline:** everything works without a connection. Changes are saved on the device and sync
  as soon as you're back online, and edits made on two devices get merged.

## Updating an existing setup

From now on the zip has two folders: copy everything in `ricette-app/` into the app repository, and everything in
`ricette-data/` into the data repository (see `READ-ME-FIRST.md` in the zip). `ricette-data/` never contains your
`data/` files, so copying it can't overwrite your recipes.

- **Shops for several items at once (Oct 30):** replace the `app/` folder (ricette-app). Nothing to do in the data repo.
- **Shops (Oct 30):** replace the `app/` folder (new files `app/js/shops.js`, Everyday's file copied unchanged, and
  `app/js/shop-status.js`). Nothing to do in the data repo: `data/shops.json` is created when you add the first shop.

- **Cleaner book imports, nutrition from the book (Oct 30, evening):** replace the `app/` folder (new file
  `app/js/book-fix.js`). In the repository with your data, replace `scripts/book.mjs`, `scripts/import-recipes.mjs`,
  `scripts/lib/recipe-text.js` and `scripts/lib/times.js` (one commit). Books imported before: open the book's folder
  and tap **Sistema** on the 🧹 banner.

- **Faster scanned books, progress, no more endless imports (Oct 30):** replace the `app/` folder. In the repository with
  your data, replace `scripts/import-recipes.mjs`, `scripts/book.mjs` and `.github/workflows/import-recipes.yml` —
  **all three in one commit**. If a book has been "reading" for hours, its run was most likely stopped by the time
  limit: after updating, start it again with *Actions → Import recipes → Run workflow*.

- **Taps lost during a sync (Oct 29):** replace the `app/` folder. Nothing to do in the data repo.

- **Origin tags (Oct 29, after midnight):** replace the `app/` folder (new file `app/js/geo.js`). In the repository with
  your data, replace `scripts/import-recipes.mjs` and `scripts/online-search.mjs`, so recipes imported from now on
  keep the cuisine the website states. Existing recipes get their origin tags straight away.

- **Times and book fixes (Oct 29, late night):** replace the `app/` folder (new file `app/js/times.js`). In the
  repository with your data, replace `scripts/import-recipes.mjs`, `scripts/book.mjs` and
  `scripts/lib/recipe-text.js`, and add `scripts/lib/times.js`. Books imported before keep their recipes: times printed in
  the book that the old import left in the recipe's notes are read from there, otherwise they're estimated from the
  steps.
- **Photos from the web, ideas from the web (Oct 29, night):** replace the `app/` folder (new files `app/js/online.js`
  and `app/js/lang-food.js`). In the repository with your data, replace `scripts/import-recipes.mjs` and
  `scripts/lib/dish-image.js`, and add `scripts/online-search.mjs` and `scripts/lib/lang-food.js`. Then add your free
  Pixabay key in Settings → Online.
- **Whole books + scroll fix (Oct 29, evening):** replace the `app/` folder. In the repository with your data, also
  replace `scripts/import-recipes.mjs`, `scripts/lib/recipe-text.js` and `.github/workflows/import-recipes.yml`, and add
  `scripts/book.mjs`.
- **Calories, protein, people for all recipes (Oct 29, afternoon):** replace the `app/` folder (new file
  `app/js/nutrition.js`). Nothing to do in the data repo.
- **Import tab, list views and drag and drop, pinned tags, folder deletion (Oct 29):** replace the `app/` folder
  (it has a new file, `app/js/sortable.js`). Nothing to do in the data repo: `data/prefs.json` is created on first use.
- **Course tags and tag settings (Oct 30, evening):** replace the `app/` folder. Nothing to do in the data repo:
  `data/tags.json` is created the first time you change a tag in Settings.
- **Locked connection settings (Oct 30, later):** replace the `app/` folder. Once connected, Settings shows the repository
  and a masked token; use *Change connection* to edit it (an empty token field keeps the current token) or *Disconnect*.
- **Put in pantry, departments, barcode linking (Oct 30):** replace the `app/` folder (and `scripts/lib/parse.js`,
  if you keep the data in a separate repo). Tap **Update** when the bar appears.
- **Tags, filters, sorting, folder covers, "What should I cook?" (Oct 29, late night):** replace the `app/` folder.
  That's all. Tap **Update** when the bar appears.
- **Recipes from photos, free version (Oct 29, night):** replace the `app/` folder. In the repository with your data:
  replace `scripts/import-recipes.mjs` and `.github/workflows/import-recipes.yml`, add `scripts/ocr.mjs` and the
  `scripts/lib/` folder, and delete `scripts/photo-recipes.mjs` if you had added it (and the `ANTHROPIC_API_KEY`
  secret, if you created one). Tap **Update** when the bar appears.
- **Update bar (Oct 29, evening):** replace the `app/` folder. On each phone or computer, fully close and reopen
  the app twice (one time only). From then on, new versions show a "New version available → Update" bar.
- **Barcode scanning (Oct 29):** replace the `app/` folder. That's all.
- **Folders + expiry reminders (Oct 29):** replace the `app/` folder, and add `scripts/expiry-reminders.mjs` and
  `.github/workflows/expiry-reminders.yml` to the repository that holds your data (the same one if you have only one).

Your recipes, pantry and settings stay as they are.

## What's in the repository

| Path | What it is |
|---|---|
| `app/` | the app. **Only this folder** is published as the website. |
| `data/` | your recipes, pantry, shopping list and import queue (JSON) |
| `images/` | recipe photos (created automatically) |
| `scripts/import-recipes.mjs` | reads recipe pages for pasted links |
| `scripts/ocr.mjs` | reads photographed pages with Tesseract (columns, line sizes, paragraphs) |
| `scripts/lib/` | copies of the app's recipe reading code (`recipe-text.js`, `parse.js`, `dish-image.js`) |
| `.github/workflows/import-recipes.yml` | runs the importer when you paste a link |
| `push/` | notification keys and the devices that turned reminders on (created automatically) |
| `scripts/expiry-reminders.mjs` | builds the daily expiry notifications |
| `.github/workflows/expiry-reminders.yml` | runs it every morning |
| `.github/workflows/publish-app.yml` | publishes `app/` to GitHub Pages when the app changes |
| `tests/` | automated tests (not needed to use the app) |

The app reads and writes `data/` and `images/` through GitHub's API, using a token stored only on each device.
When you paste a link, it goes into `data/import-queue.json`. The importer then fetches the page, reads
the recipe data most recipe sites embed, saves the recipe and a copy of its photo, and about a minute
later it shows up in the app.

## Public or private?

On a free GitHub account, the website can only be published from a **public** repository.

- **Public repo (free):** the website shows only the app, but anyone who finds
  `github.com/<you>/ricette` can browse your recipes, pantry and photos.
- **Private repo + GitHub Pro (about $4/month):** your data stays private. The website (the app
  itself, without data) is still reachable by anyone with the address, which is harmless:
  without your token it shows an empty app.

Everything else is identical, and you can switch the visibility later in the repo settings.

## Setup (about 10 minutes, once)

1. **Create the repo:** on GitHub, create a new repository named `ricette` (public or private, see above),
   and upload **everything** in this folder.
   *Tip:* on a Mac, Finder hides the `.github` folder and it often gets skipped. Check that
   `.github/workflows/` shows up in the repo. If it doesn't, create the two files with
   "Add file → Create new file" (e.g. name `.github/workflows/import-recipes.yml`) and paste in their contents.
2. **Turn on the website:** go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
   Then go to **Actions → Publish app → Run workflow**. After a minute the app is live at
   `https://<your-username>.github.io/ricette/`.
3. **Create a token:** go to GitHub **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - Repository access: *Only select repositories* → `ricette`
   - Permissions → Repository → **Contents: Read and write**
   - Expiration: whatever you're comfortable with. When it expires, make a new one and paste it in again.
4. **On each device:** open the app → **Impostazioni / Einstellungen / Settings**. User and repository
   are already filled in, so just paste the token → **Salva e verifica**.
5. **Install it like an app:**
   - iPhone/iPad (Safari): Share → *Add to Home Screen*
   - Android (Chrome): ⋮ → *Install app*. You can then share a recipe page from the browser straight into the app.
   - Desktop (Chrome/Edge): the install icon in the address bar

## Recipes from photos: what to expect

- Nothing to set up and nothing to pay: no API keys. Photos are read by the *Import recipe links* job on GitHub,
  usually within 1–2 minutes (the first photo of a run takes a bit longer while the text reader is installed).
- **Printed books and typed notes** work well: in tests with tilted, unevenly lit phone photos of cookbook pages
  (Italian, German, English, one and two columns) titles, servings, ingredients and steps were all read correctly.
  Shoot the page straight, filling the frame, in good light.
- **Handwriting** is not something Tesseract can read reliably. Use your phone instead: on iPhone open the photo,
  press and hold on the text → *Select All* → *Copy* (Android: Google Lens → *Text* → *Copy*), then in the app
  *Recipe from a photo* → *Or paste the text*. Pasted text is read on the device and opens in the edit form.
- Recipes read from photos are marked *please check* until you open and save them once; the original page is shown
  above the form so you can compare.
- The dish photo comes from the Wikipedia article about the dish (only if one clearly matches, e.g. "Tiramisù
  classico" → *Tiramisù*). If none fits, add your own photo.
- Privacy: the photos only go to your own GitHub repository; just the dish name is sent to Wikipedia.

## Expiry notifications

1. Open the app → Settings → **Turn on notifications**, on every device where you want them.
   - **iPhone/iPad:** this only works in the installed app (Safari → Share → *Add to Home Screen*, iOS 16.4 or later),
     not in a normal Safari tab.
2. That's it. Every morning at about 7:00 (Italy/Germany) the *Expiry reminders* job checks the pantry and
   notifies each device in its own language. To change the time, edit the `cron` line in
   `.github/workflows/expiry-reminders.yml` (it's in UTC). To try it right away: **Actions → Expiry reminders → Run workflow**.

The keys used to send notifications are stored in `push/vapid.json`. That's fine as long as the repo
holding your data stays **private**.

If notifications aren't turned on for a device, the app still reminds you once a day when you open it,
and the pantry tab always shows how many items are expiring.

## Renaming the app repository

Fine to do (e.g. `ricette` → `ricette-app`), but GitHub does not redirect the website address of a renamed repository:
the app moves to `https://<you>.github.io/<new-name>/`. Your data repository and token are unaffected. Afterwards,
open the new address on each device, add it to the home screen again, delete the old icon, and turn notifications off
and on again in Settings. On Android/desktop the new address starts already set up (same site storage); on iPhone a
home-screen app has its own storage, so make sure everything is synced first and paste the token again.

## Good to know

- **Shops:** Settings → Negozi: add your shops with opening hours (by weekday, several time ranges a day, or a
  single date), visit length, address and link; drag them into your order of preference. On the shopping list, ✎ on
  an item picks the shops that sell it, in order of preference (none = any shop). For several items at once, tap
  **Seleziona** under the list, tick the items (or *Tutte* on a group header), then **Negozi**: add the shops to what
  each item already has, replace them, or set them back to any shop. The **Negozi** view of the list
  shows the fewest shops that sell everything, each with its items and whether it's open now ("aperto fino alle
  12:30", "apre lun alle 08:00"); dragging a shop group reorders your shops. Shops live in `data/shops.json` in the
  same format as Everyday, so both apps share them; Ricette keeps any field Everyday adds to list items.
- **What a book import keeps out:** front and back matter (introduction, contents, abbreviations, legal notes, "about
  the author", adverts for the author's other books and newsletters) are not recipes. Tables of times ("Timing
  Information": preparation, cooking, total) and nutrition values ("Nutritional Information": calories, fat,
  carbohydrates, protein) stay with the recipe they belong to: the times fill in work and waiting time, and calories
  and protein printed in the book are shown instead of the app's estimate ("as stated in the book"). Websites that
  state nutrition per serving are used the same way. For a book imported before this, its folder shows a 🧹 banner:
  *Tidy up* lists the entries to delete (sure ones ticked, doubtful ones not) and the recipes that get their times and
  nutrition back.
- **How long a book takes:** a PDF with text or an EPUB takes a few minutes. A scanned PDF (photographed pages, no
  text layer) is read page by page with Tesseract: two pages at a time, the first few in all three languages and the
  rest only in the book's language. Count on very roughly 5–15 seconds per page. The app shows "120 of 340 pages read".
  Runs are kept to about 40 minutes each: the pages read so far are saved in `books/.progress/` and the job starts
  itself again until the book is done, so a big book is never lost to the time limit. If a run fails anyway, the book
  shows as stopped with a *Retry* button that carries on from the saved pages. Each run counts towards the free monthly
  GitHub Actions minutes of a private repository (2,000 on GitHub Free).
- **Updating while a book is being imported is safe.** Your phone's copy of the book stays in the app until GitHub has it,
  so tapping *Update* mid-upload only means the upload starts again. A job that is already running finishes; if you
  change files in the data repo meanwhile, the job notices when it saves, starts over from the newest files and reuses
  the pages it has already read. Upload the changed `scripts/` files in **one** commit (drag them all into *Add file →
  Upload files* together), so the job never sees half of an update. If a job ever fails, the book stays queued: run
  *Actions → Import recipes → Run workflow* again.

- "What should I cook?" matches pantry items and recipe ingredients by name, so name them alike: a German recipe
  asking for "Eier" won't find "uova" in the pantry.

- Barcode scanning needs camera permission the first time. On iPhone, allow it for the installed app
  (Settings → the app, or the prompt when you first scan). Products that aren't in Open Food Facts
  can be named by hand, and from then on scanning them is instant.

- Some sites block automated readers. If an import fails, the app offers **Retry** or **Add by hand**,
  with the link already filled in.
- Backups: every change is a commit, so the full history is in the repo. Settings also has a one-click JSON download.
- If you change `app/js/recipe-text.js`, `parse.js` or `dish-image.js`, copy them to `scripts/lib/` too (a test checks they match).
- Updating the app: change files in `app/` and **always** bump `VERSION` in `app/sw.js`: that's what makes devices
  notice the new version (they show an "Update" bar; without the bump they keep the old one).
  The publish workflow runs by itself. Changes to your data don't republish the site.
- Run the importer manually: **Actions → Import recipe links → Run workflow**.
- Run the tests: `node --test tests/unit.test.mjs`, `node tests/e2e.mjs` (needs Playwright), and
  `node tests/scanner.e2e.mjs` (Playwright + ffmpeg, uses a fake camera). `tests/barcode-bench/` benchmarks the barcode decoder.
