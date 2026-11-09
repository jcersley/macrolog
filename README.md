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
