import * as core from '@actions/core'
import { convertMigrationMapsToOpenRewrite } from './rewrite.js'

export async function run(): Promise<void> {
  try {
    const inputDirectory: string = core.getInput('input_directory', {
      required: true
    })
    const outputDirectory: string = core.getInput('output_directory', {
      required: true
    })

    const count = await convertMigrationMapsToOpenRewrite({
      inputDirectory,
      outputDirectory
    })
    if (count) {
      core.setOutput('count', count)
    } else {
      core.setFailed('No matching version found')
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
