/// <reference path="../typings/node/node.d.ts"/>
/// <reference path="../typings/yargs/yargs.d.ts"/>
/// <reference path="../typings/es6-promise/es6-promise.d.ts"/>
/// <reference path="../node_modules/mfgames-culture-js/index.d.ts"/>
/// <reference path="../node_modules/mfgames-culture-node/index.d.ts"/>

import * as yargs from "yargs";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
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

var pipeHelp = "Open a pipe that takes JSON input until closed.";

function getPipeArguments(y: any) {
    y.option("verbose", { alias: "v", type: "boolean" });
    y.option("data", { alias: "d", type: "string" });
    y.help("help");
    y.demand(1);
    y.argv;
}

// Combine everything together for the final option object.
var argv = yargs
    .usage("$0 command")
    .help("help")
    .showHelpOnFail(true, "Specify --help for available options")
    .demand(1)
    .command("convert", convertHelp, getConvertArguments)
    .command("pipe", pipeHelp, getPipeArguments)
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

    case "pipe":
        runPipe(argv._);
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

interface ConvertArguments {
    format?: string;
    input: string;
    culture: string;
}

var cultures: { [id: string]: mfc.Culture; } = { };
var processIndex = 0;
var processedIndex = 0;

function convert(args: ConvertArguments) {
    // We want to handle these in sequential order. We use the processIndex and
    // processedIndex to figure out the order. processedIndex is incremented as
    // part of the innermost function.
    var currentIndex = processIndex++;

    // Start going into the covertTurn which ensures order.
    convertTurn(args, currentIndex);
}

function convertTurn(args: ConvertArguments, currentIndex: number) {
    // See if it is our turn to process. If it isn't, set up a timeout to loop
    // again until we are ready.
    if (currentIndex > processedIndex) {
        setTimeout(function(){convertTurn(args, currentIndex)}, 10);
        return;
    }

    // Grab the culture and figure out if we have already cached it or not.
    var cultureId = args.culture;

    if (cultureId in cultures) {
        // The culture has been already used, so just directly use it.
        if (verbose) { console.error("using cached culture", cultureId); }
        convertCulture(cultures[cultureId], args);
    } else {
        // The culture hasn't been used, so we have to use a promise to load
        // it into memory.
        if (verbose) { console.log("using culture:", cultureId); }
        var culturePromise = cultureProvider.getCulturePromise(cultureId);

        culturePromise.then(function(c) {
            if (verbose) { console.error("loaded culture", cultureId); }
            convertCulture(c, args);

            // Cache the results so we don't have to hit the disk for reuse.
            cultures[cultureId] = c;
        }).catch(function(err) {
            console.log(err);
        });
    }
}

function convertCulture(c: mfc.Culture, args: ConvertArguments) {
    // Grab the input from the arguments.
    var input = args.input;
    var format = args.format;

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
            console.log(JSON.stringify(instant, null, 0));
        } else {
            var output = c.formatInstant(instant, format);
            console.log(output);
        }
    } catch (exception) {
        console.log("Cannot parse ", input + ": " + exception);
        throw new Error(exception);
    } finally {
        processedIndex++;
    }
}

function runConvert(args: string[]): void {
    // The first argument is always the data directory.
    if (!setDataDirectory()) { return; }

    // Pull out the culture from the first.
    var culture = args.splice(0, 1)[0];

    // Loop through the rest of the arguments and parse them as input.
    for (var input of args) {
        // Populate the arguments to request a conversion.
        var cargs: ConvertArguments = {
            format: argv.format ? argv.format : "jdn",
            culture: culture,
            input: input
        };

        // Parse the format.
        convert(cargs);
    }
}

function runPipe(args: string[]): void {
    // The first argument is always the data directory.
    if (!setDataDirectory()) { return; }

    // Get the process and hook to the standard input.
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });

    rl.on('line', function (line: string) {
        // Convert the buffer to a single string.
        if (!line || line === "") { process.exit(); }

        // Try to parse the value.
        var cargs: ConvertArguments;

        try {
            cargs = JSON.parse(line);
        }
        catch (exception) {
            var message: string = exception.toString();
            var err: any = { "error": true, "message": message, "input": line };
            console.log(JSON.stringify(err, null, 0))
            return;
        }

        // Normalize the format.
        if (!cargs.format) { cargs.format = "jdn"; }

        // Convert the output and output the results.
        convert(cargs);
    });
}
