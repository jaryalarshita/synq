# Synq — Serverless Synthetic Data Engine & API Mocker

[![CI](https://github.com/jaryalarshita/synq/actions/workflows/ci.yml/badge.svg)](https://github.com/jaryalarshita/synq/actions/workflows/ci.yml)

**Synq** is a high-performance, serverless developer tool that runs entirely in the browser. It lets you visually define relational database schemas, generate thousands of realistic synthetic records with cascading foreign-key integrity and statistical distributions, preview and filter data inside an interactive grid, export schemas/datasets in multiple formats, and exercise a mock REST API — complete with fault injection and live traffic telemetry — all without any backend server.

Built with **React, Vite, and Zustand**, Synq features a premium dark-mode, glassmorphic layout optimized for technical developer workflows.

---

## 🚀 Features

### 1. Visual Schema Builder
* **Entity Management**: Visually construct tables (entities) and define custom columns.
* **Inline Renaming**: Double-click table headers to dynamically edit names with alphanumeric validation.
* **Relations Mapping**: Model 1-to-many relationships by setting fields to `Foreign Key` targets referencing other tables.
* **Supported Column Types**: `UUID`, `String`, `Email`, `Number`, `Currency`, `Date`, `Boolean`, `Enum` (comma-separated entries), and `Foreign Key`.

### 2. Relational Synthetic Data Engine
* **Topological Sort**: Evaluates database schema dependency hierarchies to generate parent records before children, preventing foreign-key constraints violations.
* **Cycle Detection**: Identifies circular references (loops) and alerts the user with descriptive warnings.
* **Smart Data Generator**: Leverages `@faker-js/faker` combined with smart name-matching filters (e.g. fields named "email" produce email templates; "age" yields numbers between 18-80) to produce highly realistic data mockups.

### 3. Interactive Data Grid & Exporters
* **Filter & Search**: Query records across columns inside a paginated (25 items per page) grid.
* **Column Sorting**: Click table headers to toggle sorting directions (ascending/descending arrow indicators).
* **Format Exporters**:
  * **JSON**: Pretty-printed file download of datasets.
  * **CSV**: Generates escaped flat CSV files (seperate files triggered sequentially for multi-table scopes).
  * **SQL**: Downloader for SQL `INSERT INTO` statements chunked by 500 lines, keeping insertions topologically sorted.

### 4. REST API Mock Sandbox
* **Routing Interceptor**: Dispatch simulated HTTP queries against generated datasets inside the browser using standard routes:
  * `GET /api/[entity]` (supports pagination: `?limit=10&page=2`, global searches `?search=john`, and exact column filters `?role=admin`)
  * `GET /api/[entity]/:id` (record primary-key lookups)
  * `POST /api/[entity]` (validates JSON payload format/types, injects new UUID, appends records to local state, and returns `201 Created`)
* **Timing & Latency**: Simulates network response times (80ms - 240ms delay) using performance timers.
* **Code Generator**: Outputs ready-to-adapt client snippets for the selected endpoint — see *Multi-Language Code Export* below.

### 5. Network Chaos & Fault Injection Studio
* **Latency Matrix**: Dial simulated response times anywhere from `0ms` to `5000ms` with paired sliders and typed entry.
* **Error Rate Injector**: Set independent probabilities for `500`, `429`, and `404` responses; rates are laid end to end, so 10/5/0 means 10% server errors, 5% rate limits, and 85% success.
* **Safe by design**: Injected faults short-circuit *before* routing, so a simulated failure never mutates generated data.
* **Deterministic under test**: The engine accepts an injectable RNG, making every chaos path reproducible.

### 6. Advanced Data Distributions
* **Statistical curves**: `Uniform` for even spread, or `Normal` (Box–Muller) to cluster values around a mean with optional clamps — no external dependency.
* **Weighted Enums**: Assign relative weights per option (e.g. `95, 5`) so generated data mirrors real-world skew.
* **Regex Strings**: Constrain string fields to a pattern such as `[A-Z]{3}-[0-9]{4}`, validated before generation.

### 7. Live Traffic & Observability Dashboard
* **Headline metrics**: Request count, success rate, average/min/max latency, p95, and chaos-injected totals.
* **Hand-rolled SVG charts**: Throughput over time, a fixed-band latency histogram, and a status-family breakdown — written directly rather than pulling in a charting library, keeping the initial bundle under 210 kB.
* **Capped telemetry**: The request log is FIFO-limited so persisted state cannot grow without bound.

### 8. Multi-Language Code Export
* **Five client snippets**: `cURL`, JavaScript `fetch()`, `Axios`, Python (`requests`), and Rust (`reqwest`), each reflecting the selected route and payload. They target the reserved placeholder host `api.example.com` and are labelled as templates, since the mock server runs in the browser rather than at a network address.
* **TypeScript Interfaces**: Export the schema as typed definitions — enum options become union literals, foreign keys are annotated, and interfaces are emitted in dependency order.

### 9. Workspace Persistence & Responsive UI
* **Session Persistence**: Schemas, generated datasets, chaos settings, telemetry, and your active tab are saved to `localStorage`, so a refresh restores your workspace exactly.
* **Responsive Layout**: Breakpoints collapse the side-by-side panes into stacked columns on tablets, and reduce the navigation to icons on small screens.
* **Deferred Loading**: The Faker engine is code-split into its own chunk and fetched only when you generate data, keeping the initial bundle around 208 kB.

---

## 🛠️ Tech Stack

* **Core**: React 18, TypeScript, Vite
* **State Management**: Zustand
* **Icons**: Lucide React
* **Synthetic Engine**: @faker-js/faker
* **Styling**: Vanilla CSS (custom properties, glassmorphism, responsive grid layouts)
* **Charts**: Hand-authored SVG — no charting dependency
* **Testing**: Vitest + React Testing Library (239 tests), linted and built in CI

---

## 🧠 Design Notes

The interesting parts of this project are the constraints, not the feature list.

### Generating relational data requires solving dependency order first
If `Orders.userId` must reference a real `Users.id`, users have to be generated before
orders — and with arbitrary user-defined schemas, that ordering isn't known ahead of time.
The generator builds a dependency graph from the foreign-key fields and runs a
**topological sort** over it, so every parent is always materialised before its children.
The same traversal detects **circular references** (`A → B → A`) and surfaces the cycle by
name rather than hanging or producing orphans. That ordering is reused by the SQL exporter,
where `INSERT` statements must satisfy the same constraint to be valid.

### Realistic data means controlling distribution, not just randomness
Uniformly random numbers don't look like real data: ages cluster, roles skew heavily toward
ordinary users, and product codes follow a format. The engine supports **uniform** and
**normal** distributions, weighted enum selection, and regex-constrained strings. The
Gaussian sampling uses the **Box–Muller transform** — two uniform draws become one
standard-normal value — which meant no statistics dependency was needed. Normal samples are
unbounded by nature, so optional clamps keep an "age" column from going negative.

### Faults must be simulatable without being destructive
The chaos engine injects latency and HTTP failures, but it does so **before routing** — an
injected `500` short-circuits the request rather than half-applying it, so a simulated
failure can never mutate generated data. Error rates are laid end to end on a 0–100 line, so
`10/5/0` reads as "10% server errors, 5% rate limits, 85% success" rather than three
independent rolls that interact confusingly.

### Randomness is injectable, so chaos is testable
Anything driven by `Math.random` is untestable by default. The mock server and the sampling
helpers accept an optional RNG, defaulting to `Math.random` in production and taking a fixed
sequence under test. That's what makes assertions like "a 100% error rate always injects"
and "these weights produce this distribution" possible at all.

### Deferring one module cut the initial bundle by two thirds
Faker accounted for most of the initial bundle, despite only being needed when the user
actually clicks *Generate Data*. Moving it behind a **dynamic import** took the entry chunk
from 601 kB to 185 kB at the time; it sits around 208 kB today after three further
milestones, with Faker's ~420 kB still loaded only on demand. The split required extracting
the faker-free dependency-graph logic into its own module first — otherwise the SQL exporter,
which only needs the topological sort, would have dragged the entire data library back into
the main chunk.

### Three charts did not justify a charting library
The observability dashboard needs a line chart, a histogram, and a proportion bar. A charting
dependency would have added roughly 100 kB — more than half the size of the rest of the app —
so the charts are **hand-authored SVG and CSS**, costing about 8 kB. The aggregation logic
(bucketing, percentiles, throughput windows) lives in a separate module from the components,
so the maths is unit-tested directly rather than through the DOM.

### State that resets on prop change doesn't need an effect
Several components originally synced state inside `useEffect`, which triggers a second render
pass and is flagged by React's own lint rules. They now use **key-based remounts** or
adjust state during render, following React's documented alternatives. CI enforces
`--max-warnings=0`, so this class of pattern can't quietly return.

### Zero backend is a product decision, not a limitation
Everything runs client-side and persists to `localStorage`. That's what allows the tool to
start instantly with no account, and it means synthetic data — and any schema modelled on
something real — never leaves the machine. Adding a server would trade that away for
capabilities this version doesn't need.

---

## 🏁 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* npm (v9 or higher)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/jaryalarshita/synq.git
   cd synq
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the local development server:
   ```bash
   npm run dev
   ```
4. Build the production bundle:
   ```bash
   npm run build
   ```

### Testing & Linting
```bash
npm test        # Run the Vitest suite once
npm run test:watch
npm run lint
```
The suite covers the generator engine (topological ordering, cycle detection, FK
integrity), the mock API server, the exporters, the Zustand store, and the
Schema Builder / Data Grid / API Sandbox UI.

---

## 📂 Project Structure

```
synq/
├── src/
│   ├── main.tsx         # React mounting entry point
│   ├── App.tsx          # Router layout shell, Navbar, tab panes
│   ├── index.css        # Reset styles and utility variables
│   ├── style.css        # Monochromatic design system & responsive theme
│   ├── components/
│   │   ├── SchemaBuilder/
│   │   │   ├── SchemaCanvas.tsx
│   │   │   ├── EntityCard.tsx
│   │   │   └── FieldModal.tsx
│   │   ├── DataPreview/
│   │   │   ├── DataGrid.tsx
│   │   │   └── ExportModal.tsx
│   │   ├── APIMockSandbox/
│   │   │   ├── EndpointRunner.tsx
│   │   │   ├── ChaosPanel.tsx
│   │   │   └── CodeSnippet.tsx
│   │   └── Observability/
│   │       ├── TrafficDashboard.tsx
│   │       ├── ThroughputChart.tsx
│   │       ├── LatencyHistogram.tsx
│   │       └── StatusBreakdown.tsx
│   ├── engine/
│   │   ├── schemaGraph.ts      # Foreign-key topological sort & cycle detection
│   │   ├── dataGenerator.ts    # Faker-backed record engine (lazy-loaded)
│   │   ├── distributions.ts    # Gaussian/uniform sampling & weighted picks
│   │   ├── mockApiServer.ts    # REST routing, validation & chaos injection
│   │   ├── telemetry.ts        # Histogram, throughput & percentile aggregation
│   │   ├── exporters.ts        # CSV, JSON, SQL file download builders
│   │   ├── typeExporter.ts     # TypeScript interface generation
│   │   └── codeGenerators.ts   # cURL / fetch / axios / python / rust snippets
│   └── store/
│       └── useSynqStore.ts     # Central Zustand state store (localStorage-persisted)
├── index.html           # Document wrapper root
├── tsconfig.json        # Compiler parameters
├── vite.config.ts       # Bundler definitions
└── README.md            # Documentation
```

---

## 🗺️ Roadmap

* **v1.0 — Shipped**: Visual schema builder, relational synthetic data engine, data grid with JSON/CSV/SQL export, and the mock REST sandbox.
* **v2.0 — Shipped**: Chaos & fault injection studio, statistical distributions, live observability dashboard, and multi-language exporters.
* **v3.0 — Planned**: Drag-and-drop visual node canvas, AI natural-language schema generation, schema preset library, and a mock WebSocket/SSE event simulator.

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
