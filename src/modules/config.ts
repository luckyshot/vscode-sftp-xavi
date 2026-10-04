import * as vscode from 'vscode';
import * as fse from 'fs-extra';
import * as path from 'path';
import Joi from 'joi';
import { parse, printParseErrorCode, ParseError } from 'jsonc-parser';
import { CONFIG_PATH } from '../constants';
import { reportError } from '../helper';
import { showTextDocument } from '../host';

const nullable = schema => schema.optional().allow(null);

const configScheme = {
  name: Joi.string(),

  context: Joi.string(),
  protocol: Joi.any().valid('sftp', 'ftp', 'local'),

  host: Joi.string().required(),
  port: Joi.number().integer(),
  connectTimeout: Joi.number().integer(),
  username: Joi.string().required(),
  password: nullable(Joi.string()),

  agent: nullable(Joi.string()),
  privateKeyPath: nullable(Joi.string()),
  passphrase: nullable(Joi.string().allow(true)),
  interactiveAuth: Joi.alternatives().try(
    Joi.boolean(),
    Joi.array()
      .items(Joi.string()),
  ).optional(),
  algorithms: Joi.any(),
  hostFingerprint: Joi.string().pattern(/^SHA256:[A-Za-z0-9+/]{43}$/),
  sshConfigPath: Joi.string(),
  sshCustomParams: Joi.string(),

  secure: Joi.any().valid(true, false, 'control', 'implicit'),
  secureOptions: nullable(Joi.object()),
  passive: Joi.boolean(),

  remotePath: Joi.string().required(),
  uploadOnSave: Joi.boolean(),
  useTempFile: Joi.boolean(),
  openSsh: Joi.boolean(),
  downloadOnOpen: Joi.boolean().allow('confirm'),

  ignore: Joi.array()
    .min(0)
    .items(Joi.string()),
  ignoreFile: Joi.string(),
  watcher: {
    files: Joi.string().allow(false, null),
    autoUpload: Joi.boolean(),
    autoDelete: Joi.boolean(),
  },
  concurrency: Joi.number().integer().min(1),
  limitOpenFilesOnRemote: Joi.alternatives().try(Joi.boolean(), Joi.number().integer().min(1)),

  syncOption: {
    delete: Joi.boolean(),
    skipCreate: Joi.boolean(),
    ignoreExisting: Joi.boolean(),
    update: Joi.boolean(),
  },
  remoteTimeOffsetInHours: Joi.number(),

  remoteExplorer: {
    filesExclude: Joi.array()
      .min(0)
      .items(Joi.string()),
    order: Joi.number(),
  },
};

const defaultConfig = {
  // common
  // name: undefined,
  remotePath: './',
  uploadOnSave: false,
  useTempFile: false,
  openSsh: false,
  downloadOnOpen: false,
  ignore: [],
  // ignoreFile: undefined,
  // watcher: {
  //   files: false,
  //   autoUpload: false,
  //   autoDelete: false,
  // },
  concurrency: 4,
  // limitOpenFilesOnRemote: false

  protocol: 'sftp',

  // server common
  // host,
  // port,
  // username,
  // password,
  connectTimeout: 10 * 1000,

  // sftp
  // agent,
  // privateKeyPath,
  // passphrase,
  interactiveAuth: false,
  // algorithms,

  // ftp
  secure: false,
  // secureOptions,
  // passive: false,
  remoteTimeOffsetInHours: 0,

  remoteExplorer: {
    order: 0,
  },
};

function mergedDefault(config) {
  return {
    ...defaultConfig,
    ...config,
  };
}

function getConfigPath(basePath) {
  return path.join(basePath, CONFIG_PATH);
}

const configSchema = Joi.object(configScheme);

export function validateConfig(config) {
  const { error } = configSchema.validate(config, {
    allowUnknown: true,
    convert: false,
  });
  return error;
}

// sftp.json accepts comments and trailing commas (JSONC), like other .vscode files.
export function parseConfigText(text: string, configPath = CONFIG_PATH) {
  const errors: ParseError[] = [];
  const config = parse(text, errors, { allowTrailingComma: true });
  if (errors.length > 0) {
    const { error, offset } = errors[0];
    const line = text.slice(0, offset).split('\n').length;
    throw new SyntaxError(`${configPath}: ${printParseErrorCode(error)} at line ${line}`);
  }
  return config;
}

export function readConfigsFromFile(configPath): Promise<any[]> {
  return fse.readFile(configPath, 'utf8').then(text => {
    const config = parseConfigText(text.replace(/^\uFEFF/, ''), configPath);
    const configs = Array.isArray(config) ? config : [config];
    return configs.map(mergedDefault);
  });
}

export function tryLoadConfigs(workspace): Promise<any[]> {
  const configPath = getConfigPath(workspace);
  return fse.pathExists(configPath).then(
    exist => {
      if (exist) {
        return readConfigsFromFile(configPath);
      }
      return [];
    },
    _ => []
  );
}

// export function getConfig(activityPath: string) {
//   const config = configTrie.findPrefix(normalizePath(activityPath));
//   if (!config) {
//     throw new Error(`(${activityPath}) config file not found`);
//   }

//   return normalizeConfig(config);
// }

const CONFIG_TEMPLATE = `{
    // Name shown in the Remote Explorer and profile picker.
    "name": "My Server",

    // Connection. protocol: "sftp", "ftp" or "local".
    "protocol": "sftp",
    "host": "localhost",
    "port": 22,
    "username": "username",
    // Omit "password" to be prompted. Or authenticate with a key instead:
    // "privateKeyPath": "~/.ssh/id_rsa",
    // Do not commit passwords: .vscode/sftp.json is often tracked by git.

    // Remote folder that maps to this project's root.
    "remotePath": "/",

    // Upload files automatically when you save them.
    "uploadOnSave": false,
    "useTempFile": false,
    "openSsh": false

    // More options (ignore, watcher, profiles, ...):
    // https://github.com/luckyshot/vscode-sftp-xavi/blob/develop/docs/configuration.md
}
`;

export function newConfig(basePath) {
  const configPath = getConfigPath(basePath);

  return fse
    .pathExists(configPath)
    .then(exist => {
      if (exist) {
        return showTextDocument(vscode.Uri.file(configPath));
      }

      return fse
        .outputFile(configPath, CONFIG_TEMPLATE)
        .then(() => showTextDocument(vscode.Uri.file(configPath)));
    })
    .catch(reportError);
}
