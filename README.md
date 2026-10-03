# lit-query-codegen

Kapselt das Codegen-Tooling aus Maximus Trading in einem wiederverwendbaren npm-Paket:

```text
OpenAPI 3 JSON → Orval Fetch-Client → Transformation → Lit Query / Mutation Options
```

Generator, CLI, Fetch-Modul, Konfigurationen und Tests sind in TypeScript geschrieben.
Der Build erzeugt ESM-JavaScript und Typdeklarationen in `dist/`.

Pro OpenAPI-Tag entstehen `api.ts`, `models.ts`, `queries.ts`, `mutations.ts` und
`index.ts`. Query- und Mutation-Dateien werden nur erzeugt, wenn entsprechende
Operationen vorhanden sind. Das Root-`index.ts` exportiert die Features als Namespaces.
Modelle werden je Feature erzeugt, auch wenn mehrere Features sie verwenden.

Die Transformation entfernt Orvals URL- und Header-Hilfsfunktionen, kodiert
Pfadparameter mit `encodeURIComponent`, übergibt Query-Parameter an den Fetch-Mutator
und übergibt JSON-Bodies als Objekte an dessen Serializer. Query-Optionen
enthalten stabile Schlüssel und geben das AbortSignal an den Request weiter.
Mutationen erhalten bei mehreren Eingaben ein typisiertes Tupel.

## Installation

Node.js ab **22.18.0**. Orval, TypeScript und Prettier kommen mit dem Paket.
Die Anwendung benötigt `@tanstack/lit-query` und dessen Laufzeitabhängigkeiten.

Solange das Paket noch nicht in einer Registry veröffentlicht ist:

```bash
# Im Paketverzeichnis
npm install
npm pack

# Im Zielprojekt, Pfad zum erzeugten Tarball anpassen
npm install --save-dev /path/to/lit-query-codegen-0.1.0.tgz
npm install @tanstack/lit-query
```

Für die lokale Entwicklung kann stattdessen
`npm install --save-dev /path/to/lit-query-codegen` verwendet werden.
Wenn die Anwendung das mitgelieferte Fetch-Modul nutzt, das Paket als normale
Dependency statt als Dev-Dependency installieren.

## Konfiguration und CLI

`lit-query-codegen.config.ts` im Zielprojekt:

```ts
import { defineConfig } from "lit-query-codegen";

export default defineConfig({
  input: "./openapi.json",
  output: "./src/api/generated",
});
```

Alle Dateipfade werden relativ zur Konfigurationsdatei aufgelöst.
Die Formatierung folgt der Prettier-Konfiguration des Zielprojekts und kann mit
`prettier: { printWidth: 100 }` überschrieben werden.

```tson
{
  "scripts": {
    "api:generate": "lit-query-codegen",
    "api:check": "lit-query-codegen --check"
  }
}
```

```bash
npm run api:generate
npm run api:check
npx lit-query-codegen --config other.config.ts
```

`--check` erzeugt temporär einen Client und meldet fehlende, geänderte oder veraltete
Dateien mit Exit-Code 1. Der bestehende Client wird dabei nicht verändert.
Auch die normale Generierung erfolgt zuerst temporär; erst nach erfolgreicher
Transformation wird das Ausgabeverzeichnis ersetzt. Es muss ein dediziertes
Verzeichnis sein. Dateien ohne Generator-Header und Symlinks verhindern das Ersetzen.
Entfallene Features und Query-/Mutation-Dateien werden beim nächsten Lauf entfernt.

## Fetch-Modul

Standardmäßig verwenden die generierten Clients `lit-query-codegen/runtime`.
Das Modul enthält keine Orval-, Node.js- oder Vite-Abhängigkeiten.

```ts
import { configureApiFetch } from "lit-query-codegen/runtime";

configureApiFetch({ baseUrl: "https://api.example.com" });
```

Ohne Konfiguration werden relative API-Pfade verwendet; Cookies werden mit
`credentials: "include"` gesendet. `headers`, `credentials` und ein eigener
`fetch` können als Defaults konfiguriert werden. `createApiFetch(config)` erstellt
einen unabhängigen Fetch-Mutator für getrennte API-Clients oder serverseitige Nutzung.

Der Mutator serialisiert einfache Objekte, Arrays und `null` als JSON; `FormData`
und andere native Bodies werden durchgereicht. Query-Arrays werden als wiederholte
Parameter gesendet, `undefined` wird ausgelassen und `null` wird als `"null"`
übertragen. Erfolgreiche Antworten geben den Body zurück, leere Antworten
`undefined`. HTTP-Fehler werfen `ApiError` mit `status` und optionalen RFC-9457-
Problem-Details.

Ein vorhandener Mutator kann weiterverwendet werden:

```ts
request: {
  path: "./src/api/request.ts",
  exports: ["ApiError"],
  typeExports: ["ApiProblem", "ApiRequestOptions"],
}
```

Er muss `apiFetch<T>(url, options): Promise<T>` und `ApiRequestOptions` exportieren.
`options` enthält den noch nicht serialisierten `body`, ein `query`-Objekt und Fetch-Optionen.
Standardmäßig exportieren die Feature-Barrels außerdem `ApiError`, `ApiProblem`
und `ApiRequestOptions`; für andere Mutatoren können `exports` und `typeExports`
angepasst oder auf `[]` gesetzt werden.

## Projektspezifische Regeln

- `excludeTags`: Tags auslassen, beispielsweise `system`.
- `mutationOperations`: GET-Operationen als Mutationen behandeln, beispielsweise
  OAuth-Start und Callback. Operation-IDs und generierte Funktionsnamen sind erlaubt.
- `features`: zusätzliche Imports, Request-Optionen, Query-Key-Bestandteile und
  `enabled` je Feature. Ausdrücke sind TypeScript-Code aus der Projektkonfiguration.
- `queryAliases`: zusammengehörige Queries unter einem Objekt mit `allKey` gruppieren.

[examples/maximus-trading.config.ts](examples/maximus-trading.config.ts) enthält
die bisherigen Maximus-Regeln inklusive Admin-Headern, Cache-Scope, OAuth-Ausnahmen
und `adminUsers`. Nach Installation des Pakets kann diese Datei als
`frontend/lit-query-codegen.config.ts` verwendet werden. Dann genügt
`"api:generate": "lit-query-codegen"`; `prepare-api.mjs`, `render-api.mjs`,
`render-queries.mjs` und `orval.config.mjs` werden für diesen Ablauf nicht mehr benötigt.
Der Client-Drift-Check kann `npm --prefix frontend run api:check` aufrufen.
Der Backend-Export und der Spec-Drift-Check bleiben Aufgaben des jeweiligen Projekts.

## JavaScript-API

```ts
import { generate } from "lit-query-codegen";

await generate(
  { input: "openapi.json", output: "src/api/generated" },
  { cwd: process.cwd(), check: false },
);
```

## Voraussetzungen des OpenAPI-Vertrags

Wie im ursprünglichen Tooling braucht jede enthaltene Operation genau einen Tag
im Format `lower-case-with-hyphens` und eine eindeutige explizite `operationId`
in `snake_case` oder `camelCase`. Lokale Parameter-Referenzen werden unterstützt.
Path-Item-Referenzen müssen vorab gebündelt werden. Die Transformation zielt auf
den bisherigen JSON-/Multipart-Fetch-Vertrag; benutzerdefinierte Header- oder
Cookie-Parameter und abweichende OpenAPI-Serialisierungsstile brauchen eine
entsprechende Erweiterung des Mutators und der Transformation.

## Entwicklung

```bash
npm install
npm test
npm run typecheck
npm run format:check
npm run test:package
npm pack
```

`test:package` installiert den Tarball in einem unabhängigen temporären Projekt und
prüft CLI, TypeScript-Konfiguration, Client-Generierung, Drift-Check und Typen.
Der Vergleich mit dem bisherigen Maximus-Client lässt sich separat ausführen:

```bash
node test/maximus-parity.ts /path/to/maximus-trading/frontend
```

Orval ist auf die Version des ursprünglichen Toolings festgelegt, weil die
Transformation dessen generierten TypeScript-AST auswertet. Ein Upgrade sollte
mit den Integrationstests geprüft werden. Das Paket wird mit `UNLICENSED`
ausgeliefert; eine öffentliche Lizenz kann vor einer Veröffentlichung gewählt werden.
