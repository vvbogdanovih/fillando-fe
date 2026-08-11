// Side-effect module — import it alongside every `import * as z from 'zod'`.
//
// `import { z } from 'zod'` pulls in zod's namespace object, which no bundler can
// tree-shake: all 53 locales and the JSON-Schema converter ship on every page.
// `import * as z` lets Turbopack shake it, but that also drops the `config(en())`
// call in zod's `external.js`, leaving `config.localeError` undefined and
// degrading every default message to the literal "Invalid input". Setting the
// Ukrainian locale here restores them — and localises them.
import { config } from 'zod'
import uk from 'zod/v4/locales/uk.js'

config(uk())
