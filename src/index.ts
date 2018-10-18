#!/usr/bin/env node

import {
    BreakingChange,
    buildSchema,
    findBreakingChanges,
    GraphQLSchema,
} from "graphql"

import * as chalk from "chalk"
import * as fs from "fs"
import * as minimist from "minimist"
import * as glob from "glob-promise";

import {transformChangeDescription} from "./utils/transformChangeDescription"
import {transformChangeType} from "./utils/transformChangeType"

import * as CliTable2 from "cli-table3"

const usage = `
  ${chalk.bold(
    "Check if new_schema_file is backwards compatible with current_schema_file (ie. introduces no breaking changes)",
)}

  Usage: graphql-contract-test current_schema_file new_schema_file

  Options:
    --ignore-directives  Exclude directive changes from the comparison
`

const intro = `  GraphQL Contract Test
`

async function main(): Promise<void> {
    console.log(intro)

    const argv = minimist(process.argv.slice(2))

    if (argv._.length < 2) {
        console.log(usage)
        process.exit(1)
    }

    const newSchemaFile = argv._[0]
    const currentSchemaFile = argv._[1]

    const currentSchema = await loadSchema(currentSchemaFile)
    const newSchema = await loadSchema(newSchemaFile)

    let breakingChanges = findBreakingChanges(newSchema, currentSchema)

    if (argv["ignore-directives"]) {
        console.log("  ❗️  Ignoring directive differences")
        breakingChanges = breakingChanges.filter((breakingChange) => breakingChange.type !== "DIRECTIVE_REMOVED")
    }

    if (breakingChanges.length === 0) {
        console.log(chalk.bold.green("  ✨  The new schema does not introduce any breaking changes"))
        process.exit(0)
    }

    console.log(`  💩  ${chalk.bold.red("Breaking changes were detected\n")}`)

    const table = buildResultsTable(breakingChanges)
    console.log(table.toString())

    process.exit(1)
}

function buildResultsTable(breakingChanges: BreakingChange[]) {
    const table = new CliTable2({
        head: ["Issue", "Description"],
    })

    breakingChanges.forEach((change) => {
        table.push([transformChangeType(change.type), transformChangeDescription(change.description)])
    })

    return table
}

async function loadSchema(schemaFile: string): Promise<GraphQLSchema> {
    const files = await glob(schemaFile);
    const data = files
        .map((filename) => fs.readFileSync(filename, "utf8"))
        .join("\n\n");

    return buildSchema(data);
}

main().catch((e) => {
    console.log(`${chalk.bold.red(e.message)}`)
    process.exit(1)
})
