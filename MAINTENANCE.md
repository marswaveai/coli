# Maintenance

## Development

```shell
# Spawn the TypeScript compiler in watch mode
npm run dev

# Happy hacking
npx coli
npx coli asr --help
```

## Release

We use [`np`](https://github.com/sindresorhus/np) for version management.

```shell
npm i -g np
```

1. Submit all content that needs to be published via commits, don't manually change the version, and keep Git status clean
2. Run `np` and publish the package with the interactive UI
3. Review and publish the release from the browser popup page
4. Done
