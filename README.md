# Macrolog

A personal calorie and macro tracker that runs as a web app on your iPhone's Home Screen. It's free to host, it never expires, and your data stays on your phone.

## What's in this first build

- **Barcode scanning** with the camera. Lookups check USDA FoodData Central and Open Food Facts at the same time. Every scanned food is saved, so the next scan comes straight from your phone with no lookup.
- **Your foods:** a searchable library. Log by servings or by grams, and edit or delete any food.
- **Quick add** for home cooking. Only calories are required, and you can save the result as a food.
- **Meals:** build a recipe from your foods, set how many servings it makes, and log a serving in one tap.
- **Profile and goals:** your calorie goal comes from your age, height, weight, activity and weekly loss rate. It also sets goals for protein, carbs, fat, fiber, added sugar, saturated fat, sodium, cholesterol, and six vitamins and minerals. Each goal shows where it comes from.
- **Progress:** a weight chart with a 7-day average and your goal pace, your actual weekly pace, an estimated date for your goal weight, calories for the last 14 days, and 7-day nutrient averages.
- **Monday weigh-in:** the first time you open the app on a Monday, it asks for your weight. "Not today" skips it until next week.
- **Backup:** export and restore from Profile, with a reminder every 30 days.

### Added in version 1.6: Recipes

For batch cooking, where you weigh your bowl instead of guessing servings.

1. **Foods tab > Recipes > New recipe.** Name it, set the date you made it, and add each ingredient with how much went in: grams, a USDA portion like "1 medium" onion, or servings from a label. Ingredients come from your foods, a USDA search, a barcode scan, or by hand.
2. **Weigh the finished food.** Put the full pot on the scale and enter that, plus the empty pot's weight (remembered for next time). The app subtracts. No scale? Enter how many bowls the batch makes instead.
3. **Log a serving** by the grams in your bowl (weigh the food, not the bowl). It's under the recipe, in the Add sheet's **Meals** tab, and in **Recent** once you've had it.
4. **Make it again** next week. It copies the last batch to today. Swap the pork sausage for turkey, drop what you didn't have, change amounts, and weigh the new pot. Older batches stay as they were, so leftovers from last week still log correctly (pick the batch when logging).
5. **Fix a batch** any time. If you'd already logged servings from it, the app offers to recalculate them.

### Added in version 1.5

- **USDA portion sizes:** when you pick a food from a USDA search, the app fetches every portion size USDA lists for it (the same choices as the dropdown on USDA's website). The amount screen gets a **Portion** menu, like "1 large (50 g)", "1 cup (243 g)" or Grams, and defaults to the first real portion instead of 100 g. Switching portions keeps the same total, so 100 g of egg becomes 2 large. The portions are saved with the food and the app remembers which one you used.
- **Older USDA foods:** open the food in the Foods tab and tap **Get portion sizes from USDA**.
- Picking a USDA food now uses two lookups (search, then portions), so a free personal USDA key is strongly recommended.

### Added in version 1.4

- **Custom calorie goal:** in **Profile > Calorie goal**, choose **Custom** and type a number. Macros and nutrient goals follow it.
- **Complete days:** at the bottom of Today, mark whether you logged everything. Today also asks about yesterday until you answer. Once you've marked any day, averages count complete days only.
- **What you actually burn (Progress):** after 10+ complete days and 3+ weigh-ins spread over at least 2 weeks (within the last 4), the app estimates your real maintenance calories from what you ate and how your weight moved. Tap **Use this for my goals** to base your calorie goal on it instead of the formula. Weighing in 2 or 3 times a week makes it steadier.
- **Week budget (Today):** your calories for Monday to Sunday against 7 days of goal, with what that leaves per day for the rest of the week. Past days with nothing logged, or marked incomplete, count as on goal.
- **Waist:** log it from Progress or on the Monday weigh-in.

### Added in version 1.3

- **Over-goal check:** before you log something that would push you past a daily goal, the app shows which goals and by how much, and asks you to confirm. It only asks when an item crosses a goal, not for every item after you're already over. Pick which goals count in **Profile > Settings**. By default that's calories, carbs, fat, added sugars, saturated fat, sodium and cholesterol.
- **Custom macros:** in **Profile > Macros**, choose **Custom**, set two macros in grams, and pick which one fills the rest of your calories. When your calorie goal changes, the filled macro adjusts on its own.

### Added in version 1.1

- **Recent:** the Add sheet opens on what you usually eat at that meal. Tap **+** to log it at the same amount without leaving the sheet, so you can add several things in a row.
- **Last amount:** any food opens with the amount you had last time.
- **Amount buttons:** ½, 1, 1½ and 2, so most logs need no typing.
- **Same as yesterday:** an empty meal offers to copy yesterday's version. **Copy from a past day** goes back two weeks.
- **Food search:** the Foods tab in the Add sheet searches USDA by name for foods without barcodes, like produce, meat, eggs, rice and common dishes. Whatever you log is saved to your foods.
- **Backup reminder:** about once a month the app asks you to export a backup.
- **Update notice:** when a new version arrives while the app is open, it offers to reload.

## Put it on your iPhone (about 15 minutes, free)

The app has to be served over https for the camera to work. GitHub Pages does this for free.

1. Make a free account at github.com.
2. Click **+** (top right), then **New repository**. Name it `macrolog`, keep it **Public**, and click **Create repository**. (Free Pages hosting needs a public repo. Your food data is never uploaded. It lives only on your phone.)
3. On the new repo page, click **uploading an existing file**. Unzip `macrolog.zip` on your Mac, open the `macrolog` folder, select everything inside it, and drag it onto the page. Click **Commit changes**.
4. Go to **Settings**, then **Pages**. Under "Branch", pick **main** and **/ (root)**, then **Save**.
5. Wait a minute or two, then refresh. The page shows your link, like `https://yourname.github.io/macrolog/`.
6. On your iPhone, open that link **in Safari**. Tap **Share**, then **Add to Home Screen**.
7. Open it from the Home Screen icon, allow the camera when it asks, and fill in your Profile first.

### Optional: your own USDA key

The app uses a shared demo key that only allows a few dozen lookups an hour. A free personal key allows 1,000.

1. Sign up at https://api.data.gov/signup/. The key arrives by email.
2. Paste it into **Profile > Settings > USDA API key** and tap **Save key**.

## Updating the app later

1. In your repo on github.com, click **Add file**, then **Upload files**.
2. Drag in everything inside the new `macrolog` folder (the contents, not the folder itself). Files with the same name are replaced.
3. Click **Commit changes** and wait for the green check under **Deployments** (a minute or two).
4. Close the app on your phone completely, then open it again. If it shows "An update is ready", tap **Reload**.

Each new version changes `VERSION` in `sw.js` (`macrolog-v2`, `v3`...). That's what tells phones to fetch the new files. If you edit files yourself, bump it too, and update `js/version.js` (the version number, release date and notes shown under Profile > About).

To confirm your phone has the new version, check **Profile > About**.

## Things to know

- **Your data lives in this browser on this phone.** It isn't synced or uploaded. Export a backup now and then. Clearing Safari's website data, or deleting the Home Screen app, erases it.
- **Database coverage varies.** Store brands and regional products are often missing, and some entries are wrong. When a barcode isn't found, the app opens a form so you can type in the label once. Check a scanned food's numbers against the package the first time.
- **Vitamins:** US labels must list vitamin D, calcium, iron and potassium. Vitamins A and C are optional, so their totals are often incomplete. A `*` on Today means some logged foods didn't report that nutrient.
- **Goals are general adult guidelines,** not medical advice. If you have a condition like high blood pressure, diabetes or kidney disease, ask your doctor.
- **Not in this build:** scanning the Nutrition Facts label itself, push notifications (the Monday reminder appears when you open the app), and syncing between devices.

## For working on it (with Claude Code or by hand)

Plain HTML, CSS and JavaScript with no build step.

```
index.html          app shell
css/app.css         all styles
js/app.js           startup, tabs, Monday prompt
js/nutrition.js     goal math, unit conversions, barcode helpers (no browser code)
js/lookup.js        USDA and Open Food Facts lookups
js/scanner.js       camera and barcode decoding
js/store.js         saving data on the phone, backup
js/charts.js        SVG charts
js/views/*.js       one file per screen
vendor/             ZXing barcode reader (WebAssembly), Apache-2.0 licence
tests/              unit tests: npm test (Node 20+)
sw.js               offline cache
```

To run it on your Mac: in Terminal, `cd` into the folder and run `python3 -m http.server 8080`, then open http://localhost:8080 in Chrome. The camera works on `localhost` in Chrome. Your iPhone needs the https link from GitHub Pages.
