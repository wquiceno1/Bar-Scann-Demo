# Skill Registry — Bar-Scann-Demo

## Project Conventions (from AGENTS.md / CLAUDE.md)

- **Expo v54**: read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any Expo-related code — the API surface changed vs older Expo versions.

## Compact Rules (inject into sub-agent prompts touching this project)

- Stack: Expo Router (~6.0.24) + React Native 0.81.5 + TypeScript (strict) + expo-sqlite (local DB) + Firebase (sync/backup). No ESLint/Prettier/test-runner config detected in the repo.
- Money fields are always integer COP (Colombian pesos) — see `db/types.ts:1` comment. Never use floats for money.
- Dates are ISO 8601 local strings (`YYYY-MM-DDTHH:mm:ss`), not Date objects, in stored records.
- Before writing Expo API code, verify against https://docs.expo.dev/versions/v54.0.0/ — do not assume older Expo behavior.

## User Skills (trigger table)

| Skill | Trigger |
|---|---|
| go-testing | Writing Go tests, using teatest, or adding test coverage (not applicable to this TS/RN project). |
| judgment-day | User says "judgment day", "dual review", "juzgar", "que lo juzguen". |
| skill-creator | User asks to create a new skill or document agent instructions/patterns. |

(sdd-* skills and skill-registry itself excluded per registry-building rules.)
