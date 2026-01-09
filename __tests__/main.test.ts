/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'
import { convertMigrationMapsToOpenRewrite } from '../__fixtures__/rewrite.js'

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('../src/rewrite.js', () => ({
  convertMigrationMapsToOpenRewrite
}))

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { run } = await import('../src/main.js')

describe('main.ts', () => {
  beforeEach(() => {
    // Set the action's inputs as return values from core.getInput().
    core.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        input_directory: '/input',
        output_directory: '/output'
      }
      return inputs[name] || ''
    })

    // Mock convertMigrationMapsToOpenRewrite to return a count.
    convertMigrationMapsToOpenRewrite.mockImplementation(() =>
      Promise.resolve(5)
    )
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('Sets the count output when migration maps are converted', async () => {
    await run()

    // Verify convertMigrationMapsToOpenRewrite was called with correct parameters.
    expect(convertMigrationMapsToOpenRewrite).toHaveBeenCalledWith({
      inputDirectory: '/input',
      outputDirectory: '/output'
    })

    // Verify the count output was set.
    expect(core.setOutput).toHaveBeenCalledWith('count', 5)
  })

  it('Sets a failed status when no migration maps are found', async () => {
    // Mock convertMigrationMapsToOpenRewrite to return 0.
    convertMigrationMapsToOpenRewrite.mockClear().mockResolvedValueOnce(0)

    await run()

    // Verify that the action was marked as failed.
    expect(core.setFailed).toHaveBeenCalledWith('No matching version found')
  })

  it('Sets a failed status when an error occurs', async () => {
    // Mock convertMigrationMapsToOpenRewrite to throw an error.
    convertMigrationMapsToOpenRewrite
      .mockClear()
      .mockRejectedValueOnce(new Error('Failed to read directory: ENOENT'))

    await run()

    // Verify that the action was marked as failed.
    expect(core.setFailed).toHaveBeenCalledWith(
      'Failed to read directory: ENOENT'
    )
  })
})
