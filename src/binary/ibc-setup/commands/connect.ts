import fs from 'fs';
import path from 'path';

import yaml from 'js-yaml';

import { Link } from '../../../lib/link';
import { appFile, registryFile } from '../../constants';
import { AppConfig } from '../../types';
import { loadAndValidateApp } from '../../utils/load-and-validate-app';
import { loadAndValidateRegistry } from '../../utils/load-and-validate-registry';
import { resolveRequiredOption } from '../../utils/options/resolve-required-option';
import { resolveHomeOption } from '../../utils/options/shared/resolve-home-option';
import { resolveKeyFileOption } from '../../utils/options/shared/resolve-key-file-option';
import { resolveMnemonicOption } from '../../utils/options/shared/resolve-mnemonic-option';
import { signingClient } from '../../utils/signing-client';

export type Flags = {
  readonly interactive: boolean;
  readonly home?: string;
  readonly keyFile?: string;
  readonly mnemonic?: string;
  readonly src?: string;
  readonly dest?: string;
};

export type Options = {
  readonly home: string;
  readonly mnemonic: string;
  readonly src: string;
  readonly dest: string;
};

export async function connect(flags: Flags) {
  const home = resolveHomeOption({ homeFlag: flags.home });
  const app = loadAndValidateApp(home);
  if (!app) {
    throw new Error(`${appFile} not found at ${home}`);
  }

  const keyFile = resolveKeyFileOption({ keyFileFlag: flags.keyFile, app });
  const mnemonic = await resolveMnemonicOption({
    interactiveFlag: flags.interactive,
    mnemonicFlag: flags.mnemonic,
    keyFile: keyFile,
    app,
  });
  const src = resolveRequiredOption('src')(
    flags.src,
    app?.src,
    process.env.RELAYER_SRC
  );
  const dest = resolveRequiredOption('dest')(
    flags.dest,
    app?.dest,
    process.env.RELAYER_DEST
  );

  const options: Options = {
    home,
    mnemonic,
    src,
    dest,
  };

  await run(options, app);
}

export async function run(options: Options, app: AppConfig) {
  const registryFilePath = path.join(options.home, registryFile);
  const registry = loadAndValidateRegistry(registryFilePath);
  const srcChain = registry.chains[options.src];
  if (!srcChain) {
    throw new Error(`src channel  "${options.src}" not found in registry`);
  }
  const destChain = registry.chains[options.dest];
  if (!destChain) {
    throw new Error(`dest channel  "${options.dest}" not found in registry`);
  }

  const nodeA = await signingClient(srcChain, options.mnemonic);
  const nodeB = await signingClient(destChain, options.mnemonic);
  const link = await Link.createWithNewConnections(nodeA, nodeB);

  const appYaml = yaml.dump(
    {
      ...app,
      srcConnection: link.endA.connectionID,
      destConnection: link.endB.connectionID,
    },
    {
      lineWidth: 1000,
    }
  );

  fs.writeFileSync(path.join(options.home, appFile), appYaml, {
    encoding: 'utf-8',
  });

  console.log(
    `Created connections ${link.endA.connectionID} (${link.endA.clientID}) <=> ${link.endB.connectionID} (${link.endB.clientID})`
  );
}
