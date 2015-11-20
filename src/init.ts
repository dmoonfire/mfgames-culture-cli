/// <reference path="../typings/node/node.d.ts"/>
/// <reference path="../typings/yargs/yargs.d.ts"/>
/// <reference path="../typings/es6-promise/es6-promise.d.ts"/>
/// <reference path="../node_modules/mfgames-culture-es6/package.d.ts"/>
/// <reference path="../node_modules/mfgames-culture-node/package.d.ts"/>

import * as yargs from "yargs";
import * as fs from "fs";
import * as path from "path";
import * as mfc from "mfgames-culture";
import * as mfcn from "mfgames-culture-node";
import { Promise } from "es6-promise";

// Set up and parse the command line arguments.
var convertHelp = "Convert various text formats into another one.";

function getConvertArguments(y: any) {
    y.help("help");
    y.demand(4)
    y.argv;
}
// Combine everything together for the final option object.
var argv = yargs
    .usage("$0 command")
    .help("help")
    .showHelpOnFail(true, "Specify --help for available options")
    .demand(1)
    .command("convert", convertHelp, getConvertArguments)
    .argv;

// Grab the first elements in the argv, that will be the virtual command we are
// running. Once we have that, pass it into the appropriate function.
var commandName = argv._.splice(0, 1)[0];

switch (commandName) {
    case "convert":
		runConvert(argv._);
        break;

    default:
        yargs.showHelp();
        break;
}

function verifyDataDirectory(directory: string): boolean {
	// Make sure the directory exists.
	var stats = fs.lstatSync(directory);

	if (!stats.isDirectory) {
		console.log(directory + " is not a directory");
		return false;
	}

	// Create a mapper from this.
    var dataProvider = new mfcn.NodeFilesystemCultureDataProvider(directory);
    var provider = new mfc.CultureProvider(dataProvider);
	return false;
}

function runConvert(args: string[]): void {
	// The first argument is always the data directory.
	var dataDirectory = args.splice(0, 1)[0];
	if (!verifyDataDirectory(dataDirectory)) { return; }

	console.log("convert_run", argv);
}
