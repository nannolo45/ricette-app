# Ricette: user guide

Everything you need to set up Ricette and use it every day: your recipes, the shopping list and the pantry.

<div class="desk-only" markdown="1">
**You're reading the guide for a computer.** The pictures show the app on a wide screen: filters on the left, the tab in the middle and a panel on the right (see [On a computer](#on-a-computer)). Where the guide says *tap*, on a computer it's a click. At the top, **📱 Phone** shows the guide for a phone (your choice is kept). Click a picture to enlarge it.
</div>
<div class="phone-only" markdown="1">
*This is the guide for a phone. At the top, **💻 Computer** shows the one for a computer.*
</div>

## What Ricette is

Ricette keeps your recipes together with what's in your kitchen. You bring them in from a link, a photo or a whole cookbook, or type them yourself, and sort them into **Favourites**, the ones you make again, and **To try**. Next to them sit the **shopping list** and the **pantry**: every recipe knows what you're missing, and one tap puts it on the list.

It runs in the browser, on a phone or a computer, and installs like any other app. Your data stays yours: it lives on your devices and in a private space on GitHub that only you can see. There's no account with us and nothing to pay.

What it isn't: it isn't a recipe website, and it won't suggest dishes you didn't pick. It doesn't plan the week's meals either: the Everyday app does that, using your recipes from Ricette (see [With Everyday](#with-everyday)).

## First setup

It takes ten minutes and a GitHub account (free). Everything happens in Settings: tap the gear at the top right. Settings is a short list, and each entry opens its own page; where a page covers several things (like *Recipes*), it is a list itself. The card at the top says whether your data is synced, with *Sync now*.

![Settings: sync at the top, then the pages](guide/en/03-settings.webp)

### 1. Install the app

Open the app's address in Chrome on your phone, or in any browser on a computer. On Android choose *Install app* from the browser menu; on a computer click the install icon in the address bar. The app works offline too. New versions arrive by themselves; the bottom of Settings shows which one you have.

### 2. Connect your space on GitHub

This is where your data is saved, and how your phone and computer stay in step. Without it Ricette still works, but only on this device and without imports.

1. On GitHub, create an empty private repository, for example `ricette-data`. A repository is just a folder on GitHub.
2. Create an access token (GitHub → Settings → Developer settings → Fine-grained tokens) that can read and write the *Contents* of that repository. A token is like a password made for apps.
3. In Settings → *GitHub connection*, enter your *GitHub user*, the *Repository* and the *Access token*, then tap *Save and check*.

![User, repository and token](guide/en/01-sync-form.webp)

When it works, the page says **Connected** and the label at the top turns green. The token stays on this device only: repeat this step on every phone or computer you use.

![Connected: the repository and the last sync](guide/en/02-sync-connected.webp)

### 3. Optional: expiry reminders

In Settings → *Pantry and reminders* → *Expiry reminders*, tap *Turn on notifications*. Every morning you get a heads-up when something in the pantry is about to expire, even with the app closed. This is also where you choose how many days ahead.

![Pantry and reminders](guide/en/04-settings-pantry.webp)

### 4. Optional: people, language and appearance

In Settings → *Recipes* → *People*, choose how many people you usually cook for: quantities, the shopping list and *With the pantry* follow it. In *Language and appearance*, choose English, Italian or German, the theme (*Automatic* like your phone, *Light* or *Dark*) and the app's colour: aubergine, petrol, terracotta or cornflower. Language, theme and colour apply only to the device where you choose them.

### 5. A second person

Everyone has their own repository and token. On their phone, open the same address and connect their repository. If the device held someone else's data, the app asks whether to start empty: choose that. *Empty this device*, under *GitHub connection*, does the same whenever you like.

## The three tabs

| Tab | What it's for |
|---|---|
| Recipes | Your collection, split into Favourites, To try and All. Search, filter and add recipes here. |
| Shopping | The shopping list, by aisle, recipe or shop, with the cart. |
| Pantry | What you have at home, in the cupboard, fridge and freezer: quantities, expiry dates and staples running low. |

All three work the same way: search at the top with **Filters** beside it, and the coloured **+** at the bottom right to add. The gear at the top opens Settings. The dot next to it shows whether your data is synced: green means all is well; tap it to sync right away.

## Recipes

![Recipes: folders at the top, then all your recipes](guide/en/10-recipes.webp)

### Favourites, To try, All

Every recipe has a status. **Favourites** are the ones you make again. **To try** are the ones you imported and haven't judged yet: every import lands here. **All** also shows your folders, such as *Quick dinners* or *Baking*.

![Favourites: the recipes you make again](guide/en/11-favourites.webp)

To change the status, tap the ☆ on the recipe's page. Archived recipes stay, but hidden.

### Finding and filtering

Type a name or an ingredient in the search: it looks through your whole collection. **Filters** opens a panel right underneath:

- at the top, the order (*Recently added*, *Quickest*, *Most cooked*… also *Reverse*) and *List* or *Grid*;
- the quick switches: *With the pantry*, **≤ 15 / 30 / 60 min** and your pinned tags;
- the sections *Course*, *Diet*, *Origin*, *More tags* and *Work, calories, source*, which open one at a time.

![The Filters panel, with Course open](guide/en/12-filters.webp)

With the panel closed, the filters in use stay under the search: tap ✕ to remove one.

### With the pantry

The **With the pantry** switch puts the recipes you have almost everything for at the top, and says what's missing. *Add missing to shopping list* puts it on the list. Salt, pepper and oil can be taken for granted.

![With the pantry: what you can cook comes first](guide/en/13-with-pantry.webp)

### A recipe's page

Next to the ingredients, − and + change the number of people. Each ingredient says whether you have it: *at home* or *missing*. At the bottom:

- **to the list** puts only what's missing on the shopping list;
- **I cooked it** takes what you used out of the pantry;
- **⋯** to edit, move to a folder, share or delete.

![A recipe's page: what you have and what's missing](guide/en/14-recipe.webp)

After *I cooked it* on a recipe you were trying, the app asks **How was it?**: *Make it again: favourite*, *Good, tried* or *Not for us: archive*.

![How was it? after the first time](guide/en/15-how-was-it.webp)

## Adding recipes

Tap **+** on Recipes. The sheet has a tab for each way in, and *Save in* at the bottom to pick the folder. Everything you import lands in *To try* within a minute or two.

### From a link

Paste the recipe's address and tap *Import*. You can also share a link from another app straight to Ricette.

![Link: paste the address](guide/en/20-add-link.webp)

### From a photo

For a recipe in a book or a handwritten note. Tap *Take or choose photos*: the app walks you through three steps.

1. **Ingredients:** photograph the ingredient list; if it runs over several pages, one photo per page.
2. **Method:** the steps, in the order you read them. If they're on the same page as the ingredients, tick *Ingredients and method are on the same page* and this step is skipped.
3. **The dish:** optional. It becomes the cover and isn't read; with *Skip* I'll look for one.

![From a photo: the ingredients first](guide/en/21-add-photo.webp)

At the end, *All good?* sums up the photos: *Redo* changes a group, *Import the recipe* sends it. If you already have the text (Live Text, Google Lens), paste it at the first step under *Or paste the text*. The text is read on your own GitHub, not by an outside service.

### A whole cookbook

*Book* imports an entire cookbook, PDF or EPUB. Every recipe in it becomes a recipe of its own, with the book's page number and its picture when there is one. A book of a few hundred pages can take an hour.

![Book: a whole PDF or EPUB](guide/en/22-add-book.webp)

### From scratch

*From scratch* opens the empty form. Under *Goes to*, choose whether the recipe joins *Favourites* or *To try*.

![From scratch: the form, with Goes to](guide/en/23-new-recipe.webp)

### Editing a recipe

On the recipe's page, tap ⋯ → *Edit*. *Save* stays at the top; if you leave with unsaved changes, the app asks first.

| Part | What you set |
|---|---|
| Photos | The cover and other photos; *Search online* finds a picture of the dish |
| Title, people | The name and how many people the amounts are for |
| Time, Folder, Source | Total and hands-on time, the folder, the link or the book with its page |
| Ingredients | One row per ingredient: amount, name, detail. *+ Group* for "For the sauce" |
| Method | One step per card; drag ⠿ to reorder |
| Tags | The green ones are automatic; add your own with *+ Tag* |

![Ingredients as rows](guide/en/24-edit.webp)

Tap an ingredient to change it. Under the name is the food Ricette recognised; if it's wrong or missing, tap **Fix**. *Write as text* shows the whole list as text, handy for pasting.

![An ingredient: amount, group and Fix](guide/en/25-ingredient.webp)

### Ingredients and foods

Ricette knows foods in English, Italian and German: that way the eggs in a recipe are the eggs in your pantry, and everything lands in the right aisle. Settings → *Ingredients and foods* lists the names it didn't recognise: link each to a food or create your own. It applies to every recipe, the shopping list and the pantry.

![Ingredients and foods: the names to sort out](guide/en/26-foods.webp)

## Shopping

![The shopping list, by aisle](guide/en/30-list.webp)

### Adding

Tap **+** and type, for example, `2 l milk, eggs, 1.5 kg flour`, then Enter. Amounts and aisles are worked out for you, and the field stays open for the next one. What you've just added shows underneath: tap a name to change it.

![The + on Shopping: several at once](guide/en/31-list-add.webp)

From a recipe, *to the list* adds the missing ingredients with their amounts. When something runs out in the pantry, the app asks whether to put it on the list (see [When something runs out](#when-something-runs-out)).

### Views and filters

**Filters** opens the choice of view: *Group by* aisle, recipe or shop, or as a *Single list*: *My order*, *A–Z*, newest. Below are quick filters by shop. Departments, recipes and your own order apply on every device, Everyday included.

![Choosing the view](guide/en/32-list-views.webp)

### A product's sheet

Tap an item's name: the product's sheet opens, the same one you open from the cart and the pantry. At the top, three tabs say where it is: *On the list*, *In the cart* and *At home*, with amounts and place.

- Below is the part for that place: how much to buy, how much you took, or how much you have at home.
- At the bottom, *The product, everywhere*: aisle, shops under *Can be bought at* and a note, the same wherever you look. No shop means "anywhere". *+ New shop* asks for the name and, if you like, the address, hours and how long you usually spend; finish the rest later in Settings → *Shopping and shops* → *Shops*, where shops with only a name are marked *to finish*.
- If the product isn't on the list, *Add to the list* puts it there; if it isn't at home, *Put it in the pantry*.
- The red button says what it removes: *Remove from the list*, *Remove from the cart* or *Remove from the pantry* (with *Undo* right after).

![A product's sheet: where it is, how much, shops](guide/en/33-list-item.webp)

### The cart and Put in pantry

Tick what goes in your cart: it moves down to **In the cart**. At home, tap **Put in pantry**: check amounts, expiry dates and where each thing goes (cupboard, fridge or freezer), and everything goes into the pantry and off the list. A new product takes the item's shops with it.

![The cart](guide/en/34-cart.webp)

![Put in pantry: amounts and expiry dates](guide/en/35-put-away.webp)

### The next trip

If you use Everyday and plan a shopping trip, the list shows **Next trip**: when, and which shops. Each item says which trip it's for; *Show only this* keeps just those.

![The next trip, planned in Everyday](guide/en/36-trips.webp)

## The pantry

![The pantry: expiring first, then by aisle](guide/en/40-pantry.webp)

### Places: cupboard, fridge, freezer, home and baby

At the top, choose where to look: *All*, *Cupboard*, *Fridge*, *Freezer*, *Home & cleaning* or *Baby*, three to a row, each with how many products it holds. Every product has its place. Until you choose one, the app guesses it from the aisle: dairy, meat and fish in the fridge, frozen food in the freezer, cleaning products, paper and toiletries in *Home & cleaning*, nappies, creams, formula and baby food in *Baby*, the rest in the cupboard. To move a product, open its sheet and tap the place under *Where*.

The last tile, *✎ Places*, opens the list of places: untick the ones you don't use (their products stay in *All*), change the order with ▲ ▼, and tap ⋯ to rename a place or see which aisles end up there. From there, or from Settings → *Departments*, you can send an aisle to another place: eggs in the cupboard, say. The same *Departments* page is where you drag the aisles into your shops' order. Places, names and aisles are the same on all your devices.

![Just the fridge](guide/en/45-pantry-fridge.webp)

![The places](guide/en/46-pantry-places.webp)

### Adding and scanning

Tap **+** and type, for example, `6 eggs exp 20/11, 1 kg flour`: "exp 20/11" sets the expiry date. *Goes in* picks the place: the one you're looking at, or *Automatic* and each thing goes to its own. With *Scan*, point the camera at the barcode and the product is recognised.

![The + on Pantry](guide/en/41-pantry-add.webp)

### Expiry dates and thresholds

Tap a product for its sheet, the same as on the shopping list (see [A product's sheet](#a-products-sheet)). *Remind me when it drops to* is the threshold: when it gets there, the app asks whether to put it on the shopping list. *Restock up to* says how much to buy. *Expires* and *Remind days before* decide the morning reminder. The shops under *Can be bought at* come back with the product when it runs out and goes on the list.

![A product: amount, threshold, expiry](guide/en/42-pantry-product.webp)

### Staples: Have it, Low, Out

For salt, oil, spices and the like there's no need to count grams. Under *How you count it*, choose **Have it / Low / Out**: *Low* and *Out* ask whether to put it on the list, and putting it away sets it back to *Have it*. Cooking doesn't subtract from it.

![A staple: Have it, Low, Out](guide/en/43-staple.webp)

### When something runs out

When a staple goes to *Low* or *Out*, or a product reaches 0 (or its threshold), a message appears at the bottom: *H-Vollmilch: run out*. **Add** puts it on the list; for products with an amount it suggests how much to buy, up to the full stock or one pack like the one you had, and − and + change it. **No, thanks** leaves it off until it's back home. *From now on, add without asking* stops the question.

Anything that runs out on another phone, or in Everyday when you cook, shows at the top of the pantry: *Add* puts it on the list. On the list, the row shows *🛒 on the list*. In Settings → *Pantry and reminders* → *When something runs out* choose *Ask me*, *Add by itself* or *Do nothing*; it applies in Everyday too.

![Run out: on the list?](guide/en/44b-pantry-low.webp)

### Filters

**Filters** picks the view (aisles, expiry, stock, A–Z) and the filters *Expiring*, *Expired*, *Running low* and *Out*, together if you like. *Recipes with what you have* opens Recipes with *With the pantry* on.

![Only what's expiring](guide/en/44-pantry-filters.webp)

### Receipts

Under ⋯ → *Read a receipt*, photograph the receipt straight and well lit. It's read on your GitHub and then deleted; when it's ready it shows up in Pantry, and you put it away like the cart.

## With Everyday

Everyday is the app for planning your days. The two share the shopping list, the shops and the pantry once you enter Ricette's repository in Everyday.

- **There's one shopping list.** What you add in Everyday shows up here, and the other way round.
- **Meals.** In Everyday you pick a recipe for a meal, starting from your Favourites. When the meal is done, the recipe counts one more time (*cooked 4 times*).
- **Putting away.** In Everyday too, shopping you put away goes into the pantry, with the item's shops, cleaning and toiletries included: they land in *Home & cleaning*, and baby things, which go to *Baby*. You choose its place at home in Ricette; until then the guess applies.
- **Shopping trips.** Everyday decides when to go shopping; Ricette shows it on the list as the [next trip](#the-next-trip).

Who decides what: Ricette decides the recipes, the list and the pantry; Everyday decides when to cook and when to shop.

## A typical week

**Sunday evening.** Open *To try* and pick two new recipes: the red lentil soup and the lemon chicken. On each, tap *to the list*: only what's missing goes on. In Everyday, the soup goes on Tuesday.

**Monday, at the market.** Open Shopping grouped by shop: at the Covered Market you pick up fennel and lemons, ticking them as they go in the bag. At home you tap *Put in pantry* and type the feta's expiry date.

**Tuesday evening.** Red lentil soup. Afterwards you tap *I cooked it*: the pantry takes off the lentils, and to *How was it?* you answer *Make it again: favourite*.

**Thursday, short on time.** On Recipes, turn on *With the pantry* and **≤ 30 min**: pasta e ceci, with what you already have. The olive oil is getting low: you tap *Low*, then *Add to shopping*, and it's on Saturday's list.

## On a computer

On a wide screen Ricette uses three columns. On the left, the filters, always open. In the middle, the tab. On the right, a panel that changes with the tab:

- **Recipes:** *Add a recipe* and a preview of the recipe you clicked, with what's missing. *Open the recipe* opens it in full.
- **Shopping:** the field to add and the cart, with *Put in pantry*. The list spreads over several columns.
- **Pantry:** the field to add and scan.

![Recipes on a computer: filters, recipes, preview](guide/en/60-wide-recipes.webp)

![Shopping on a computer](guide/en/61-wide-list.webp)

![Pantry on a computer](guide/en/62-wide-pantry.webp)

## Tips and troubleshooting

**Sync doesn't start.** In Settings → *GitHub connection*, check that the token can write the repository's *Contents* and hasn't expired. *Change connection* lets you paste a new one.

**An import stays in the queue.** Imports run on your GitHub: they need the connection and a minute or two. If a page can't be read, the app says so at the top of *To try*: try a photo of the recipe instead.

**An ingredient lands in the wrong aisle.** Tap the item, then *Fix*, and pick the right food: it applies from then on, everywhere.

**I deleted something by mistake.** Tap *Undo* in the message at the bottom, straight away.

**I want a copy of my data.** Settings → *Backup* → *Download a copy of your data*. Your GitHub repository holds the same data anyway.

**My phone doesn't warn me about expiry dates.** Notifications have to be turned on on each device, in *Pantry and reminders*. On an iPhone they only work from the app installed on the Home Screen.
