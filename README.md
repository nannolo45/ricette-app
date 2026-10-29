# Ricette: recipes, shopping list and pantry

A small app (IT / DE / EN) that runs in the browser on phone, laptop and desktop,
works offline, and keeps all your data as plain JSON files in **your own GitHub repository**.

- **Recipes:** paste a link and it gets imported automatically, with its photo, or add a recipe by hand.
- **Photos:** add as many as you like to any recipe (camera or files), pick the cover, remove them.
  They're shrunk on the device (about 250 KB each), saved in your repo under `images/`, and kept
  on every device so they show offline too.
- **Servings:** change the number of people and every quantity scales.
- **Shopping list:** add a recipe for N people and the ingredients get merged into one list.
  If the pantry already has something, only the missing amount is added.
- **Pantry:** set a "remind me at" threshold per item. When stock drops to it, the item goes on the
  shopping list by itself. Ticking it off at the shop restocks the pantry, and "I cooked it" uses
  ingredients up.
- **Offline:** everything works without a connection. Changes are saved on the device and sync
  as soon as you're back online, and edits made on two devices get merged.

## How it fits together

| Folder | GitHub repo | Visibility | What it holds |
|---|---|---|---|
| `app/` | `ricette` | public (needed for free GitHub Pages) | the app itself, with no personal data |
| `data-repo/` | `ricette-data` | **private** | your recipes, pantry, list, photos (`images/`) + the link importer |

The app talks to `ricette-data` directly through GitHub's API, using a token that is stored only on each device.
When you paste a link, it goes into `data/import-queue.json`. A GitHub Action in the data repo
then fetches the page, reads the recipe data most recipe sites embed (schema.org), and saves the
recipe to `data/recipes.json`, along with a copy of its photo in `images/`. About a minute later it shows up in the app.

## Setup (about 10 minutes, once)

1. **Data repo:** on GitHub, create a new **private** repository named `ricette-data`, then upload
   the contents of `data-repo/` (the `data`, `scripts` and `.github` folders).
   *Tip:* on a Mac, Finder hides `.github`. If the upload skips it, create the file in GitHub with
   "Add file → Create new file", name it `.github/workflows/import-recipes.yml` and paste in its contents.
2. **App repo:** create a **public** repository named `ricette`, upload the contents of `app/`,
   then go to **Settings → Pages → Deploy from a branch → `main` / root**. After a minute the app
   is live at `https://<your-username>.github.io/ricette/`.
3. **Token:** go to GitHub **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - Repository access: *Only select repositories* → `ricette-data`
   - Permissions → Repository → **Contents: Read and write**
   - Expiration: whatever you're comfortable with. When it expires, make a new one and paste it in again.
4. **Each device:** open the app → **Impostazioni / Einstellungen / Settings** → fill in your GitHub
   user, `ricette-data` and the token → **Salva e verifica**.
5. **Install it like an app:**
   - iPhone/iPad (Safari): Share → *Add to Home Screen*
   - Android (Chrome): ⋮ → *Install app*. You can then share a recipe page from the browser straight into the app.
   - Desktop (Chrome/Edge): the install icon in the address bar

## Good to know

- Some sites block automated readers. If an import fails, the app offers **Retry** or **Add by hand**,
  with the link already filled in.
- Want a backup? It's already on GitHub, with full history of every change. Settings also has a
  one-click JSON download.
- Updating the app: change the files in `ricette`, and bump `VERSION` in `app/sw.js` so devices pick up the new version.
- Run the importer manually: in `ricette-data` go to **Actions → Import recipe links → Run workflow**.
