# SDK Publishing Guide

This guide covers the exact release path for publishing Spendline to PyPI and npm.

Current live packages:

- PyPI: `https://pypi.org/project/spendline/0.1.0/`
- npm: `https://www.npmjs.com/package/spendline`

## Package Names

- PyPI: `spendline`
- npm: `spendline`

As of March 23, 2026, both packages have been published successfully at version `0.1.0`.

## Release Order

1. Bump both SDK versions together
2. Run release checks
3. Build and test package artifacts locally
4. Publish Python to TestPyPI
5. Publish npm tarball check locally
6. Publish PyPI
7. Publish npm
8. Install both from the public registries and run one real ingest against production

## Install Commands

```bash
pip install spendline
npm install spendline
```

## Preflight

From the repo root:

```powershell
pnpm typecheck
pnpm --filter spendline test
pnpm --filter spendline build
cd packages\sdk-python
python -m pytest tests
cd ..\..
```

## Python SDK

Location:

- `packages/sdk-python`

### Version Bump

Update:

- `packages/sdk-python/pyproject.toml`

### Build Tools

```powershell
cd packages\sdk-python
python -m pip install --upgrade pip
python -m pip install build twine
```

### Build

```powershell
python -m build
```

Artifacts will be written to `packages/sdk-python/dist/`.

### Verify Artifact

```powershell
python -m twine check dist/*
```

### Publish To TestPyPI First

```powershell
python -m twine upload --repository testpypi dist/*
```

### Publish To PyPI

```powershell
python -m twine upload dist/*
```

### Token Setup

Use a PyPI API token and either:

- set `TWINE_USERNAME=__token__`
- set `TWINE_PASSWORD=<your-pypi-token>`

or authenticate interactively when prompted.

## JavaScript SDK

Location:

- `packages/sdk-js`

### Version Bump

Update:

- `packages/sdk-js/package.json`

### Build And Pack

```powershell
pnpm --filter spendline test
pnpm --filter spendline typecheck
pnpm --filter spendline build
cd packages\sdk-js
npm pack
```

This creates a tarball like `spendline-0.1.0.tgz`.

### Verify Tarball Locally

In a clean test app:

```powershell
npm install ..\spendline\packages\sdk-js\spendline-0.1.0.tgz
```

### Publish To npm

```powershell
npm login
npm publish --access public
```

For automation, use `NPM_TOKEN`.

## Final Verification

After both packages are published:

1. Install `spendline` from PyPI in a clean venv
2. Install `spendline` from npm in a clean Node app
3. Point both at `https://spendlineapi-production.up.railway.app`
4. Send one real tracked request from each SDK
5. Confirm both appear in the Spendline dashboard

## Release Checklist

- Version bumped in both SDKs
- SDK README files reviewed
- License files present
- Tests passed
- Builds passed
- PyPI artifact validated with `twine check`
- npm tarball validated with `npm pack`
- API key ready for live ingest verification
