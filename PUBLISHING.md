# Publishing to NPM

This document outlines the process for publishing `kysely-bun-sql` to the NPM registry.

## Prerequisites

- An NPM account (create one at https://www.npmjs.com/signup)
- Authenticated with NPM locally: `npm login` or `bun npm login`

## Publishing Steps

### 1. Update Version
Update the version in `package.json` following [Semantic Versioning](https://semver.org/):

```json
{
  "version": "X.Y.Z"
}
```

- **MAJOR** (X): Breaking changes
- **MINOR** (Y): New backwards-compatible features
- **PATCH** (Z): Bug fixes

### 2. Build the Package
The `prepublishOnly` script automatically builds and tests before publishing:

```bash
bun run build
```

This will:
- Compile TypeScript to the `dist/` directory
- Generate CommonJS and ES modules
- Create type definitions

### 3. Commit Changes
```bash
git add package.json
git commit -m "chore: bump version to X.Y.Z"
git tag vX.Y.Z
git push origin main --tags
```

### 4. Publish to NPM

Using bun:
```bash
bun npm publish
```

Or using npm:
```bash
npm publish
```

The `prepublishOnly` hook will automatically:
- Build the TypeScript
- Run tests
- Publish only files listed in the `files` field of `package.json`

### 5. Verify Publication
Check that your package is published:

```bash
npm view kysely-bun-sql
```

## Build Output

The build process generates:
- `dist/index.js` - Main entry point
- TypeScript source files are bundled by Bun
- Type definitions are available for TypeScript users

## What Gets Published

The following files/directories are included in the NPM package (defined in `files` field):
- `dist/` - Compiled JavaScript
- `LICENSE` - MIT license
- `README.md` - Documentation

The `.npmignore` file excludes:
- Source files (`src/`, `tests/`)
- Development dependencies
- Configuration files
- Examples

## Notes

- The package is published as an ES module (`"type": "module"`)
- Supports Node.js and Bun runtimes
- Requires `typescript@^5` as a peer dependency
- Built with full TypeScript support

## Troubleshooting

### Authentication Issues
```bash
bun npm login
```

### Version Already Published
Update the version in `package.json` and try again.

### Build Fails
Ensure all tests pass:
```bash
bun test
```

## For More Information
- [NPM Publishing Guide](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages)
- [NPM package.json Documentation](https://docs.npmjs.com/cli/v10/configuring-npm/package-json)
