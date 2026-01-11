/**
 * Hook implementation for b2c:config-sources.
 *
 * This hook provides the IntelliJ SFCC plugin configuration source
 * to the B2C CLI configuration resolution system.
 */
// TODO: Import from @salesforce/b2c-tooling-sdk/cli once published to npm
import type {ConfigSourcesHook} from '../types.js';
import {IntelliJSource} from '../sources/intellij-source.js';

/**
 * The b2c:config-sources hook handler.
 *
 * Returns the IntelliJ SFCC plugin configuration source with 'before' priority,
 * meaning it will override values from dw.json if both are present.
 */
const hook: ConfigSourcesHook = async function (options) {
  this.debug(`b2c:config-sources hook called with instance: ${options.instance}`);

  return {
    sources: [new IntelliJSource()],
    // 'before' = override dw.json/~/.mobify (higher priority)
    priority: 'before',
  };
};

export default hook;
