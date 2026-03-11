# Codebase Notes

## Tech Stacks

- **Runtime** - Node.js 24 or later
- **Language** - TypeScript
- **Distribution** - Pure ESM
- **Package Manager** - npm only
- **Compiler** - tsc only
- **Fetch Utility** - ky only
- **Child Process Utility** - execa only
- **Linter** - XO for TypeScript files; Prettier for markdown, JSON, and yaml files

## Conventions

- Respond in English.
- Use regular sentence case for commits, not too long. Never use Conventional Commits formats.
- Write readable code over clever. Only comment when necessary.
- Prefer `node --run` instead of `npm run` for scripts, unless necessary.

## Development

For core abilities, each ability should have a folder, like ASR does. Here is the structure example:

- source
  - asr (ability name)
    - \_cli.ts (CLI command definition and export a `register` function for registering)
    - \_index.ts (export all the public API)
    - ... (main implementation and other helpers)
