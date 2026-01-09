import * as core from '@actions/core'
import { convertMigrationMapsToOpenRewrite } from './rewrite.js'

export async function run(): Promise<void> {
  try {
    const inputDirectory: string = core.getInput('inputDirectory', {
      required: true
    })
    const outputDirectory: string = core.getInput('outputDirectory', {
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
