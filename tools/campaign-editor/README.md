# Campaign editor

Local editor for Chapter I settings. It is not part of the public site. It reads and writes `apiv2/src/domain/campaign/chapter-i.json`.

## Prerequisites

Run `npm ci` in `apiv2` before installing or running this tool. The editor does not depend on `zod`. Imports from `apiv2` resolve it out of `apiv2/node_modules`.

```bash
cd apiv2
npm ci
cd ../tools/campaign-editor
npm ci
```

## Run

```bash
cd tools/campaign-editor
npm run dev
```

The dev server is Vite, at `http://localhost:5173`. `npm test` runs Vitest. `npm run build` typechecks and builds.

The map is on the left. The tabs on the right are Tile, Chapter, Rules, Inventory, Rewards, Routes, and Problems. The top bar has Open, Bundled, Undo, Redo, the error and warning counts, Save to repo, and Export. Save to repo is present only while `npm run dev` is running.

**Bundled** loads the repo file. **Open** and drag-and-drop read a local file. A file that fails the schema is not loaded; the dialog lists each issue with its path. **Export** downloads `chapter-i.json`. Export and Save to repo stay disabled while an error exists. Save to repo writes only `apiv2/src/domain/campaign/chapter-i.json`, and the dev server checks the schema before writing.

The document and the designer's routes are stored in `localStorage` on each change and offered as **Resume draft**.

## Routes

The Routes tab walks the reference routes in `routes/chapter-i.routes.json` and any route added with **Add route**. Every route re-runs on each edit. The tab label shows how many fail. On the bundled file the bare rush scores 200, and the south-stash route stops at the citadel attack with 6 copper.

## Simulation

Select one tile that is not owned by the player. The panel runs autobattle in a worker. The default is 200 runs and the maximum is 2000. It shows the defender kit, the rounds, the algorithm, the win rate, wins, losses, and how many runs hit the turn cap. For the bundled gate at 200 runs the result is a win rate of 0.73, 146 wins, and 54 losses, the same numbers as the apiv2 simulator test.

## Playtest

Save to repo, then start the local API. The API reads the chapter when the process starts, so restart it after a save.

```bash
cd apiv2
npm run dev
```

In another terminal:

```bash
cd site
python3 -m http.server 8080
```

Open `http://localhost:8080/html5Simple/`. Leave any started Chapter I run before starting a new one. A started run keeps the copy it was given at start. See [local_dev.md](../../apiv2/plans/local_dev.md).

## Publish

1. **Save to repo** (or Export and copy over the file). Review the diff.
2. `cd apiv2 && npm test`.
3. Playtest locally, as above.
4. Build, zip, and `terraform apply -target=module.lambda_api2.aws_lambda_function.main`.

The hosted shell at `/editor/` is a separate static publish. It has no Save to repo. Publish it with `./scripts/deploy-editor.sh` from the repo root. See [apiv2/plans/campaign_editor_deploy.md](../../apiv2/plans/campaign_editor_deploy.md).

Bump `rulesetVersion` when anything but the title, the goal, or a label changes. Best score keeps the highest total over all versions.

A change to the built chapter moves the golden definition in `apiv2/src/domain/campaign/__fixtures__/chapter-i.definition.json` and any test that pins a Chapter I number. Update those expectations in the same change. Do not delete or loosen a test to hide the difference.
