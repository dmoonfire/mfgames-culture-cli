/// <reference path="../typings/node/node.d.ts"/>
/// <reference path="../typings/yargs/yargs.d.ts"/>
/// <reference path="../typings/es6-promise/es6-promise.d.ts"/>
/// <reference path="../node_modules/mfgames-culture-js/index.d.ts"/>
/// <reference path="../node_modules/mfgames-culture-node/index.d.ts"/>

import * as yargs from "yargs";
import * as fs from "fs";
import * as path from "path";
import * as mfc from "mfgames-culture-js";
import * as mfcn from "mfgames-culture-node";
import { Promise } from "es6-promise";

// Set up and parse the command line arguments.
var convertHelp = "Convert various text formats into another one.";

function getConvertArguments(y: any) {
    y.option("verbose", { alias: "v", type: "boolean" });
    y.option("format", { alias: "f", type: "string" });
    y.option("data", { alias: "d", type: "string" });
    y.help("help");
    y.demand(3);
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
var verbose = argv.verbose;
var dataProvider: mfc.CultureDataProvider;
var cultureProvider: mfc.CultureProvider;

switch (commandName) {
    case "convert":
        runConvert(argv._);
        break;

    default:
        yargs.showHelp();
        break;
}

function setDataDirectory(): boolean {
    // Set the data directory, if we can.
    var directory = argv.data;

    if (!directory) {
        directory = path.join(__dirname, "..", "node_modules", "mfgames-culture-data", "data");
    }

    // Make sure the directory exists.
    var stats = fs.lstatSync(directory);

    if (!stats.isDirectory) {
        console.log(directory + " is not a directory");
        return false;
    }

    // Create a mapper from this.
    dataProvider = new mfcn.NodeFilesystemCultureDataProvider(directory);
    cultureProvider = new mfc.CultureProvider(dataProvider);

    // We have a successful provider.
    if (verbose) { console.log("data:", directory); }
    return true;
}

function runConvert(args: string[]): void {
    // The first argument is always the data directory.
    if (!setDataDirectory()) { return; }

    // Figure out which format we want.
    var format = argv.format ? argv.format : "jdn";

    // The second is the culture ID which we load as a promise.
    var cultureId = args.splice(0, 1)[0];
    var culturePromise = cultureProvider.getCulturePromise(cultureId);

    if (verbose) { console.log("culture:", cultureId); }

    culturePromise.then(function(c) {
        // We have a culture, so loop through the remaining elements.
        for (var input of args) {
            // Get the instant from parsing the input.
            if (verbose) { console.log("input: " + input + " (" + format + ")"); }

            try {
                var instant = c.parseInstant(input);

                // Figure out how we are going to format.
                var lowerFormat = format.toLowerCase();

                if (lowerFormat === "jdn" || lowerFormat === "julian") {
                    console.log(instant.julian);
                }
                else if (lowerFormat === "json") {
                    console.log(instant);
                } else {
                    var output = c.formatInstant(instant, format);
                    console.log(output);
                }
            } catch (exception) {
                console.log("Cannot parse", input + ": " + exception);
                throw new Error(exception);
            }
        }
    }).catch(function(err) {
        console.log(err);
    });
}
