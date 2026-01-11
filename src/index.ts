/**
 * B2C CLI plugin for IntelliJ SFCC plugin configuration.
 *
 * This plugin provides a ConfigSource that reads B2C instance configuration
 * from the IntelliJ SFCC plugin's connection settings and credentials.
 *
 * ## Installation
 *
 * ```bash
 * b2c plugins link ~/code/b2c-plugin-intellij-sfcc-config
 * ```
 *
 * ## Usage
 *
 * The plugin automatically loads configuration from `.idea/misc.xml` in the
 * current directory. For credentials decryption, set environment variables:
 *
 * ```bash
 * export SFCC_INTELLIJ_CREDENTIALS_FILE=~/.intellij-sfcc-credentials
 * export SFCC_INTELLIJ_CREDENTIALS_KEY="your-24-byte-key"
 * b2c code deploy
 * ```
 *
 * @module b2c-plugin-intellij-sfcc-config
 */
export {IntelliJSource} from './sources/intellij-source.js';
export type {ConfigSource, NormalizedConfig, ResolveConfigOptions} from './types.js';
