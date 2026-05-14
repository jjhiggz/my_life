# Domain docs

How the Matt Pocock engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- `CONTEXT.md` at the repo root, if present.
- `CONTEXT-MAP.md` at the repo root, if present. It points at one `CONTEXT.md` per context.
- `docs/adr/`, if present. Read ADRs that touch the area you're about to work in.

If any of these files do not exist, proceed silently. Do not flag their absence or suggest creating them upfront. Producer skills such as `/grill-with-docs` can create them lazily when terms or decisions get resolved.

## Layout

This is a single-context repo.

Expected structure:

```text
/
├── CONTEXT.md
├── docs/adr/
└── app/
```

## Use the glossary's vocabulary

When your output names a domain concept, use the term as defined in `CONTEXT.md`. Do not drift to synonyms the glossary explicitly avoids.

If the concept you need is not in the glossary yet, either reconsider the language or note the gap for `/grill-with-docs`.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding it.
