// @ts-check
import fs from 'node:fs';
import { DmnModdle } from 'dmn-moddle';
import Debug from 'debug';

import { Context, Environment } from 'dmn-elements';
import { dmn, alignDmnNamespaces } from 'dmn-elements/dmn-moddle';

/**
 * Parse DMN XML source with dmn-moddle carrying the extended DMN package —
 * the whole suite then proves the DMN 1.4 grammar additions are inert for 1.3 documents
 * @param {string | Buffer} source DMN XML
 * @returns {Promise<any>} dmn-moddle definitions
 */
export async function moddleContext(source) {
  const moddle = new DmnModdle({ dmn });
  const { rootElement } = await moddle.fromXML(alignDmnNamespaces(source));
  return rootElement;
}

/**
 * Build an evaluation context from DMN XML source
 * @param {string | Buffer} source DMN XML
 * @param {import('#types').EnvironmentOptions} [options] environment options
 */
export async function context(source, options) {
  const definitions = await moddleContext(source);
  return new Context(definitions, new Environment({ Logger, ...options }));
}

/**
 * Read DMN resource from test/resources
 * @param {string} name file name
 */
export function resource(name) {
  return fs.readFileSync(new URL(`../resources/${name}`, import.meta.url));
}

/** @param {string} scope */
export function Logger(scope) {
  return {
    debug: Debug(`dmn-elements:${scope}`),
    error: Debug(`dmn-elements:error:${scope}`),
    warn: Debug(`dmn-elements:warn:${scope}`),
  };
}
