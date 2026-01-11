# b2c-plugin-intellij-sfcc-config

A plugin for the [B2C CLI](https://github.com/SalesforceCommerceCloud/b2c-developer-tooling) that loads configuration from the [IntelliJ SFCC plugin](https://plugins.jetbrains.com/plugin/13668-salesforce-b2c-commerce-sfcc-) settings.

This allows you to share B2C instance configuration between your IDE and the B2C CLI without duplicating settings in multiple places.

## Prerequisites

- [B2C CLI](https://github.com/SalesforceCommerceCloud/b2c-developer-tooling) installed
- [IntelliJ SFCC plugin](https://plugins.jetbrains.com/plugin/13668-salesforce-b2c-commerce-sfcc-) version 2022.3 or later

## Installation

> **Note:** The B2C CLI packages are not yet published to npm. Until they are published, you must use the [Development Installation](#development-installation) method below.

Install directly from GitHub (requires published npm packages):

```bash
b2c plugins install sfcc-solutions-share/b2c-plugin-intellij-sfcc-config

# Verify installation
b2c plugins
```

### Development Installation

For local development (required until B2C CLI packages are published to npm):

```bash
# Clone the repository
git clone https://github.com/sfcc-solutions-share/b2c-plugin-intellij-sfcc-config.git
cd b2c-plugin-intellij-sfcc-config

# Update package.json to use local SDK path
# Change @salesforce/b2c-tooling-sdk in devDependencies to:
#   "file:/path/to/b2c-developer-tooling/packages/b2c-tooling-sdk"

# Install dependencies and build
npm install
npm run build

# Link to B2C CLI (from the b2c-developer-tooling directory)
cd /path/to/b2c-developer-tooling
./packages/b2c-cli/bin/dev.js plugins link /path/to/b2c-plugin-intellij-sfcc-config

# Verify installation
./packages/b2c-cli/bin/dev.js plugins
```

## Usage

### Basic Usage (Connections Only)

If you have an IntelliJ project with SFCC connections configured, the plugin automatically reads from `.idea/misc.xml`:

```bash
cd /path/to/your/intellij-project
b2c code list
```

### Select a Specific Instance

Use the `--instance` flag to select a connection by name:

```bash
b2c code list --instance staging
```

### With Credentials Decryption

To also load passwords and client secrets from the IntelliJ encrypted credentials file:

```bash
export SFCC_INTELLIJ_CREDENTIALS_FILE=~/.intellij-sfcc-credentials
export SFCC_INTELLIJ_CREDENTIALS_KEY="your-24-byte-decryption-key"
b2c code deploy
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SFCC_INTELLIJ_PROJECT_FILE` | Path to `.idea/misc.xml` | `./.idea/misc.xml` |
| `SFCC_INTELLIJ_CREDENTIALS_FILE` | Path to encrypted credentials file | (none) |
| `SFCC_INTELLIJ_CREDENTIALS_KEY` | Decryption key for credentials file | (none) |
| `SFCC_INTELLIJ_ALGORITHM` | Encryption algorithm | `aes-192-ecb` |

## How It Works

The IntelliJ SFCC plugin (version 2022.3+) stores configuration in two places:

1. **Connections** - `.idea/misc.xml`
   - Contains hostname, username, code version, client ID, etc.
   - Stored as JSON in the `IntellijSFCCConnectionSettings` component

2. **Credentials** - Encrypted file (location configurable in plugin settings)
   - Contains passwords, WebDAV access keys, and OAuth client secrets
   - Encrypted with AES-192-ECB using a user-provided key

This plugin reads both sources and provides them to the B2C CLI configuration system.

## Configuration Priority

When this plugin is installed, configuration is resolved in this order:

1. CLI flags and environment variables (highest priority)
2. **IntelliJ SFCC plugin settings** (this plugin)
3. `dw.json` file
4. `~/.mobify` file (lowest priority)

## Field Mapping

| IntelliJ Field | B2C CLI Config |
|----------------|----------------|
| `hostname` | `hostname` |
| `secureHostname` | `webdavHostname` |
| `username` | `username` |
| `code-version` | `codeVersion` |
| `clientId` | `clientId` |
| `shortCode` | `shortCode` |
| (from credentials) | `password` |
| (from credentials) | `clientSecret` |

## Troubleshooting

### Enable Debug Logging

```bash
DEBUG='oclif:*' b2c code list
```

### Verify Plugin is Loaded

```bash
b2c plugins
```

You should see `b2c-plugin-intellij-sfcc-config` in the list.

### Check Connection Settings

Verify your `.idea/misc.xml` contains the `IntellijSFCCConnectionSettings` component with valid connection data.

## Related

- [B2C CLI Documentation](https://salesforcecommercecloud.github.io/b2c-developer-tooling/)
- [IntelliJ SFCC Plugin](https://plugins.jetbrains.com/plugin/13668-salesforce-b2c-commerce-sfcc-)
- [Creating Custom Plugins](https://salesforcecommercecloud.github.io/b2c-developer-tooling/guide/extending.html)

## License

MIT
