/**
 * ConfigSource implementation for IntelliJ SFCC plugin configuration.
 *
 * This source reads B2C instance configuration from the IntelliJ SFCC plugin's
 * connection settings stored in `.idea/misc.xml` and optionally decrypts
 * credentials from the plugin's encrypted credentials file.
 *
 * ## Environment Variables
 *
 * - `SFCC_INTELLIJ_PROJECT_FILE` - Path to misc.xml (default: `./.idea/misc.xml`)
 * - `SFCC_INTELLIJ_CREDENTIALS_FILE` - Path to encrypted credentials file
 * - `SFCC_INTELLIJ_CREDENTIALS_KEY` - Decryption key for credentials
 * - `SFCC_INTELLIJ_ALGORITHM` - Encryption algorithm (default: `aes-192-ecb`)
 */
import {existsSync, readFileSync} from 'node:fs';
import {createDecipheriv} from 'node:crypto';
import {join} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import type {ConfigSource, NormalizedConfig, ResolveConfigOptions} from '@salesforce/b2c-tooling-sdk/config';

const DEFAULT_PROJECT_FILE = './.idea/misc.xml';
const DEFAULT_ALGORITHM = 'aes-192-ecb';

/**
 * Structure of an IntelliJ SFCC connection.
 */
interface IntellijConnection {
  name?: string;
  hostname?: string;
  secureHostname?: string;
  username?: string;
  'code-version'?: string;
  clientId?: string;
  shortCode?: string;
  useOcapi?: boolean;
  active?: boolean;
  isGroup?: boolean;
  configs?: IntellijConnection[];
}

/**
 * Structure of the connection settings JSON.
 */
interface ConnectionSettings {
  source: IntellijConnection[];
}

/**
 * Structure of the encrypted credentials file.
 */
interface Credentials {
  accounts: Array<{
    username: string;
    password?: string;
    hidePassword?: boolean;
    accessKeys?: Array<{
      username: string;
      keys: Record<string, Record<string, string>>;
    }>;
  }>;
  ocapiKeys: Array<{
    clientId: string;
    clientSecret: string;
  }>;
}

/**
 * Parse the IntelliJ SFCC connection settings from misc.xml.
 *
 * The settings are stored as a JSON string in the `IntellijSFCCConnectionSettings`
 * component's `json` option.
 */
function getConnectionSettings(filename: string): ConnectionSettings | undefined {
  if (!existsSync(filename)) {
    return undefined;
  }

  const content = readFileSync(filename, 'utf-8');

  const parser = new XMLParser({
    attributeNamePrefix: '',
    ignoreAttributes: false,
    processEntities: true,
    allowBooleanAttributes: true,
    preserveOrder: true,
    textNodeName: '_',
  });

  // Add entity for newlines that IntelliJ uses
  parser.addEntity('#xA', '\n');
  parser.addEntity('#10', '\n');

  const xml = parser.parse(content) as Array<{
    project?: Array<{
      component?: Array<{':@'?: {name?: string; value?: string}}>;
      ':@'?: {name?: string};
    }>;
  }>;

  // Find the project element (usually index 1, after XML declaration)
  const projectEl = xml.find((el) => el.project);
  if (!projectEl?.project) {
    return undefined;
  }

  // Find the IntellijSFCCConnectionSettings component
  const connectionSettingsComponent = projectEl.project.find(
    (el) => el.component && el[':@']?.name === 'IntellijSFCCConnectionSettings',
  );

  if (!connectionSettingsComponent?.component) {
    return undefined;
  }

  // Find the "json" option
  const jsonOption = connectionSettingsComponent.component.find(
    (opt: {':@'?: {name?: string; value?: string}}) => opt[':@']?.name === 'json',
  );

  const jsonValue = jsonOption?.[':@']?.value;
  if (!jsonValue) {
    return undefined;
  }

  try {
    return JSON.parse(jsonValue) as ConnectionSettings;
  } catch {
    return undefined;
  }
}

/**
 * Decrypt the credentials file.
 *
 * @param cipherText - Base64-encoded encrypted content
 * @param key - Decryption key
 * @param algorithm - Cipher algorithm (default: aes-192-ecb)
 * @returns Decrypted credentials object
 */
function decryptCredentials(cipherText: string, key: string, algorithm: string): Credentials | undefined {
  try {
    const buffer = Buffer.from(cipherText, 'base64');
    const decipher = createDecipheriv(algorithm, key, null);
    const decrypted = Buffer.concat([decipher.update(buffer), decipher.final()]);
    return JSON.parse(decrypted.toString('utf-8')) as Credentials;
  } catch {
    return undefined;
  }
}

/**
 * Look up password/access key from credentials.
 */
function findPassword(credentials: Credentials, username: string, hostname: string): string | undefined {
  const account = credentials.accounts.find((a) => a.username === username);
  if (!account) {
    return undefined;
  }

  // First try to find WebDAV access key for this host
  const accessKeySet = account.accessKeys?.find((ak) => ak.username === username);
  if (accessKeySet?.keys) {
    const hostKeys = accessKeySet.keys[hostname];
    if (hostKeys?.WebDAV) {
      return hostKeys.WebDAV;
    }
  }

  // Fall back to account password
  return account.password;
}

/**
 * Look up client secret from credentials.
 */
function findClientSecret(credentials: Credentials, clientId: string): string | undefined {
  const ocapiKey = credentials.ocapiKeys.find((k) => k.clientId === clientId);
  return ocapiKey?.clientSecret;
}

/**
 * ConfigSource implementation for IntelliJ SFCC plugin.
 */
export class IntelliJSource implements ConfigSource {
  readonly name = 'intellij-sfcc';

  private projectFilePath?: string;

  /**
   * Load configuration from IntelliJ SFCC plugin settings.
   */
  load(options: ResolveConfigOptions): NormalizedConfig | undefined {
    // Get project file path from env var or default
    const projectFile = process.env.SFCC_INTELLIJ_PROJECT_FILE ?? join(process.cwd(), DEFAULT_PROJECT_FILE);
    this.projectFilePath = projectFile;

    // Parse connection settings
    const connectionSettings = getConnectionSettings(projectFile);
    if (!connectionSettings?.source?.length) {
      return undefined;
    }

    // Flatten groups and find the target connection
    const allConnections = connectionSettings.source.flatMap((source) =>
      source.isGroup && source.configs ? source.configs : [source],
    );

    // Find connection by instance name or active flag
    let connection: IntellijConnection | undefined;
    if (options.instance) {
      connection = allConnections.find((c) => c.name === options.instance);
    } else {
      connection = allConnections.find((c) => c.active);
    }

    if (!connection) {
      return undefined;
    }

    // Build base config from connection
    const config: NormalizedConfig = {
      hostname: connection.hostname,
      webdavHostname: connection.secureHostname,
      username: connection.username,
      codeVersion: connection['code-version'],
      shortCode: connection.shortCode,
    };

    // Only set clientId if useOcapi is enabled
    if (connection.useOcapi && connection.clientId) {
      config.clientId = connection.clientId;
    }

    // Try to load credentials if file and key are provided
    const credentialsFile = process.env.SFCC_INTELLIJ_CREDENTIALS_FILE;
    const credentialsKey = process.env.SFCC_INTELLIJ_CREDENTIALS_KEY;
    const algorithm = process.env.SFCC_INTELLIJ_ALGORITHM ?? DEFAULT_ALGORITHM;

    if (credentialsFile && credentialsKey && existsSync(credentialsFile)) {
      const cipherText = readFileSync(credentialsFile, 'utf-8');
      const credentials = decryptCredentials(cipherText, credentialsKey, algorithm);

      if (credentials) {
        // Look up password
        if (connection.username && connection.hostname) {
          const password = findPassword(credentials, connection.username, connection.hostname);
          if (password) {
            config.password = password;
          }
        }

        // Look up client secret
        if (config.clientId) {
          const clientSecret = findClientSecret(credentials, config.clientId);
          if (clientSecret) {
            config.clientSecret = clientSecret;
          }
        }
      }
    }

    return config;
  }

  /**
   * Get the path to the project file for diagnostics.
   */
  getPath(): string | undefined {
    return this.projectFilePath;
  }
}
