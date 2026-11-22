# TechOps UI

The workspace uses compact tables, restrained status colors, 4–8px radii and borders instead of shadows. Pages share a 46px application bar, collapsible navigation and contextual page actions.

## Rebranding

Change `src/styles/theme.css`. It defines semantic colors, typography, spacing and radii; components consume these variables. The same colors are exposed to Tailwind through `@theme inline`. Avoid hardcoded brand colors in page components.

## Components

- `Button` / `ButtonLink`: `variant="primary|secondary|danger|ghost"`, `size="default|small|icon"`. Use one primary action per context.
- `StatusBadge`: text and dot, with neutral, primary, success, warning and danger tones. Labels convey status independently of color.
- `PageHeader`: breadcrumb, title, description and page actions.
- `DataTable`: column configuration, numeric alignment, cell rendering and optional row actions. Wide tables scroll within the workspace.
- `Field`: consistent label, required marker and optional help text.
- `FormPanel`: compact heading and bordered workflow container.

Shared layout and component styles live in `src/styles/workspace.css`. Authentication styles and resets live in `src/index.css`. Existing workflows use compatibility classes backed by the same tokens; new code should use the components above.

## Data scope

Dashboard summaries come from the reports API. The work queue combines loaded sales, repair and purchase records and links to individual records. Stock availability distinguishes fully reserved stock from physical stock shortages. Inventory search and dropdown filters apply to the loaded page; product search is performed by the API, while product dropdown filters apply to the loaded page. The UI states these limits explicitly.

## Visual review

Start Vite on `localhost:5174`, then run `node scripts/visual-review.mjs dashboard desktop`, `inventory mobile --form`, or `products desktop --form`. Add `--check` to verify navigation, filters, record links and form submissions against isolated fixtures. The script checks for browser exceptions and page overflow and uses a temporary Chrome profile, never database writes. Screenshots are stored in the system temporary folder. Sample data is used only by this script, never by the application.
