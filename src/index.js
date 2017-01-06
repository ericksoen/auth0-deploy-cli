#! /usr/bin/env node

import Context from './context';
import Storage from './storage';
import logger from './logger';

/**
 * Created by mostekcm on 11/2/16.
 */

var program = require('commander');
var tools = require('auth0-source-control-extension-tools');
var fs = require('fs');
const managementApi = require('auth0-extension-tools').managementApi;

/**
 * Simple function for dumping help info
 * @param error An error to print after dumping help
 */
function printHelpAndExit(error) {
  program.outputHelp();
  if (error) {
    process.stderr.write('ERROR: ' + error + '\n');
  }
  process.exit(2);
}

/**
 * Validate that the argument is actually a file that we can read.
 * @param fileName The name of the file to check
 * @returns {*}
 */
function checkFileExists(fileName) {
  try {
    fs.accessSync(fileName, fs.F_OK);
    return fileName;
  } catch (e) {
    printHelpAndExit(fileName + ': Must be a valid file\n');
    return false;
  }
}

/* Setup our options */
program
  .option('-v,--verbose', 'Dump extra debug information.')
  .option('-i,--input_file <input file>', 'The updates to deploy.  Either a JSON file, or directory that contains' +
    ' the correct file layout.  See README and online for more info.', checkFileExists)
  .option('-c,--config_file <config file>', 'The JSON configuration file.', checkFileExists)
  .option('-s,--state_file <state file>', 'A file for persisting state between runs.  Default: ./local/state', checkFileExists);

/* Add extra help for JSON */
program.on('--help', function() {
  logger.info('See README (https://github.com/auth0/auth0-deploy-cli) for more in-depth information on configuration' +
    ' and setup.');
});

/* Process arguments */
program.parse(process.argv);

if (program.verbose) logger.transports.console.level = 'debug';

/* Make sure we have the input file and config file specified. */
if (!program.input_file) {
  printHelpAndExit('Must set the input file');
}
if (!program.config_file) {
  printHelpAndExit('Must set the config file');
}

const stateFileName = program.state_file ? program.state_file : './local/state';

logger.info('input_file: %s', JSON.stringify(program.input_file));
logger.info('config_file: %s', JSON.stringify(program.config_file));
logger.info('state_file: %s', JSON.stringify(program.state_file));

/* Grab data from file */
const context = new Context(program.input_file);

logger.info('input_file: %s', JSON.stringify(context));

/* Validate the JSON */

/* Prepare configuration by initializing nconf, then passing that as the provider to the config object */
const nconf = require('nconf');

nconf.file(program.config_file);

const config = require('auth0-extension-tools').config();

config.setProvider(key => nconf.get(key));

/* Execute the deploy */
const progress = {
  id: 'someid',
  user: 'someuser',
  sha: 'some sha',
  branch: 'some branch',
  repository: 'some repo'
};

managementApi.getClient({
  domain: config('AUTH0_DOMAIN'),
  clientId: config('AUTH0_CLIENT_ID'),
  clientSecret: config('AUTH0_CLIENT_SECRET')
}).then(function(auth0) {
  tools.deploy(progress, context, auth0, new Storage(stateFileName), config, {});
}).catch(function(err) {
  logger.error('Got this error: ' + JSON.stringify(err) + ', message: ' + err.message);
  logger.error('stack: ' + err.stack);
});