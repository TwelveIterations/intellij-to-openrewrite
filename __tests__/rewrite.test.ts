/**
 * Unit tests for src/rewrite.ts
 *
 * Tests the conversion of IntelliJ migration maps to OpenRewrite recipes.
 */
import { jest } from '@jest/globals'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'fs/promises'

const { convertMigrationMapsToOpenRewrite } = await import('../src/rewrite.js')

describe('rewrite.ts', () => {
  let tempInputDir: string
  let tempOutputDir: string

  beforeEach(async () => {
    tempInputDir = await mkdtemp(join(tmpdir(), 'rewrite-test-input-'))
    tempOutputDir = await mkdtemp(join(tmpdir(), 'rewrite-test-output-'))
  })

  afterEach(async () => {
    await rm(tempInputDir, { recursive: true, force: true })
    await rm(tempOutputDir, { recursive: true, force: true })
    jest.resetAllMocks()
  })

  describe('convertMigrationMapsToOpenRewrite', () => {
    it('converts a valid migration map XML to OpenRewrite YAML', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<migrationMap>
  <entry oldName="com.example.OldClass" newName="com.example.NewClass" type="class"/>
  <entry oldName="com.example.OldUtil" newName="com.example.NewUtil" type="class"/>
  <name value="Test Migration"/>
</migrationMap>`

      await writeFile(join(tempInputDir, 'test-migration.xml'), xmlContent)

      const count = await convertMigrationMapsToOpenRewrite({
        inputDirectory: tempInputDir,
        outputDirectory: tempOutputDir
      })

      expect(count).toBe(1)

      const outputContent = await readFile(
        join(tempOutputDir, 'Test-Migration.yml'),
        'utf-8'
      )

      expect(outputContent).toContain('type: org.openrewrite.java.Recipe')
      expect(outputContent).toContain('name: com.twelveiterations.Test-Migration')
      expect(outputContent).toContain('displayName: Test-Migration')
      expect(outputContent).toContain('oldFullyQualifiedTypeName: com.example.OldClass')
      expect(outputContent).toContain('newFullyQualifiedTypeName: com.example.NewClass')
      expect(outputContent).toContain('oldFullyQualifiedTypeName: com.example.OldUtil')
      expect(outputContent).toContain('newFullyQualifiedTypeName: com.example.NewUtil')
    })

    it('uses filename as recipe name when no name attribute is present', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<migrationMap>
  <entry oldName="com.example.Old" newName="com.example.New" type="class"/>
</migrationMap>`

      await writeFile(join(tempInputDir, 'my-custom-migration.xml'), xmlContent)

      const count = await convertMigrationMapsToOpenRewrite({
        inputDirectory: tempInputDir,
        outputDirectory: tempOutputDir
      })

      expect(count).toBe(1)

      const outputContent = await readFile(
        join(tempOutputDir, 'my-custom-migration.yml'),
        'utf-8'
      )

      expect(outputContent).toContain('name: com.twelveiterations.my-custom-migration')
    })

    it('skips XML files that are not migration maps', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<someOtherRoot>
  <data>not a migration map</data>
</someOtherRoot>`

      await writeFile(join(tempInputDir, 'not-a-migration.xml'), xmlContent)

      const count = await convertMigrationMapsToOpenRewrite({
        inputDirectory: tempInputDir,
        outputDirectory: tempOutputDir
      })

      expect(count).toBe(0)
    })

    it('skips migration maps with no class type entries', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<migrationMap>
  <entry oldName="com.example.old" newName="com.example.new" type="package"/>
  <entry oldName="com.example.oldMethod" newName="com.example.newMethod" type="method"/>
</migrationMap>`

      await writeFile(join(tempInputDir, 'package-only.xml'), xmlContent)

      const count = await convertMigrationMapsToOpenRewrite({
        inputDirectory: tempInputDir,
        outputDirectory: tempOutputDir
      })

      expect(count).toBe(0)
    })

    it('handles a single entry (non-array) in migration map', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<migrationMap>
  <entry oldName="com.example.Single" newName="com.example.SingleNew" type="class"/>
</migrationMap>`

      await writeFile(join(tempInputDir, 'single-entry.xml'), xmlContent)

      const count = await convertMigrationMapsToOpenRewrite({
        inputDirectory: tempInputDir,
        outputDirectory: tempOutputDir
      })

      expect(count).toBe(1)

      const outputContent = await readFile(
        join(tempOutputDir, 'single-entry.yml'),
        'utf-8'
      )

      expect(outputContent).toContain('oldFullyQualifiedTypeName: com.example.Single')
      expect(outputContent).toContain('newFullyQualifiedTypeName: com.example.SingleNew')
    })

    it('filters out non-class entries from mixed migration maps', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<migrationMap>
  <entry oldName="com.example.ClassEntry" newName="com.example.NewClassEntry" type="class"/>
  <entry oldName="com.example.package" newName="com.example.newpackage" type="package"/>
  <entry oldName="com.example.AnotherClass" newName="com.example.AnotherNewClass" type="class"/>
</migrationMap>`

      await writeFile(join(tempInputDir, 'mixed-types.xml'), xmlContent)

      const count = await convertMigrationMapsToOpenRewrite({
        inputDirectory: tempInputDir,
        outputDirectory: tempOutputDir
      })

      expect(count).toBe(1)

      const outputContent = await readFile(
        join(tempOutputDir, 'mixed-types.yml'),
        'utf-8'
      )

      expect(outputContent).toContain('oldFullyQualifiedTypeName: com.example.ClassEntry')
      expect(outputContent).toContain('oldFullyQualifiedTypeName: com.example.AnotherClass')
      expect(outputContent).not.toContain('com.example.package')
    })

    it('recursively finds XML files in subdirectories', async () => {
      const subDir = join(tempInputDir, 'subdir')
      await mkdir(subDir, { recursive: true })

      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<migrationMap>
  <entry oldName="com.example.Sub" newName="com.example.SubNew" type="class"/>
</migrationMap>`

      await writeFile(join(subDir, 'nested-migration.xml'), xmlContent)

      const count = await convertMigrationMapsToOpenRewrite({
        inputDirectory: tempInputDir,
        outputDirectory: tempOutputDir
      })

      expect(count).toBe(1)
    })

    it('converts multiple XML files', async () => {
      const xml1 = `<?xml version="1.0" encoding="UTF-8"?>
<migrationMap>
  <entry oldName="com.example.First" newName="com.example.FirstNew" type="class"/>
  <name value="First Migration"/>
</migrationMap>`

      const xml2 = `<?xml version="1.0" encoding="UTF-8"?>
<migrationMap>
  <entry oldName="com.example.Second" newName="com.example.SecondNew" type="class"/>
  <name value="Second Migration"/>
</migrationMap>`

      await writeFile(join(tempInputDir, 'first.xml'), xml1)
      await writeFile(join(tempInputDir, 'second.xml'), xml2)

      const count = await convertMigrationMapsToOpenRewrite({
        inputDirectory: tempInputDir,
        outputDirectory: tempOutputDir
      })

      expect(count).toBe(2)
    })

    it('creates output directory if it does not exist', async () => {
      const nonExistentOutput = join(tempOutputDir, 'new-subdir', 'output')

      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<migrationMap>
  <entry oldName="com.example.Test" newName="com.example.TestNew" type="class"/>
</migrationMap>`

      await writeFile(join(tempInputDir, 'test.xml'), xmlContent)

      const count = await convertMigrationMapsToOpenRewrite({
        inputDirectory: tempInputDir,
        outputDirectory: nonExistentOutput
      })

      expect(count).toBe(1)

      const outputContent = await readFile(
        join(nonExistentOutput, 'test.yml'),
        'utf-8'
      )

      expect(outputContent).toContain('com.example.Test')
    })

    it('sanitizes special characters in recipe name', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<migrationMap>
  <entry oldName="com.example.Test" newName="com.example.TestNew" type="class"/>
  <name value="My Special! Migration @v1.0"/>
</migrationMap>`

      await writeFile(join(tempInputDir, 'special.xml'), xmlContent)

      const count = await convertMigrationMapsToOpenRewrite({
        inputDirectory: tempInputDir,
        outputDirectory: tempOutputDir
      })

      expect(count).toBe(1)

      const outputContent = await readFile(
        join(tempOutputDir, 'My-Special--Migration--v1-0.yml'),
        'utf-8'
      )

      expect(outputContent).toContain('name: com.twelveiterations.My-Special--Migration--v1-0')
    })

    it('includes ignoreDefinition: true in recipe entries', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<migrationMap>
  <entry oldName="com.example.Old" newName="com.example.New" type="class"/>
</migrationMap>`

      await writeFile(join(tempInputDir, 'test.xml'), xmlContent)

      await convertMigrationMapsToOpenRewrite({
        inputDirectory: tempInputDir,
        outputDirectory: tempOutputDir
      })

      const outputContent = await readFile(
        join(tempOutputDir, 'test.yml'),
        'utf-8'
      )

      expect(outputContent).toContain('ignoreDefinition: true')
    })

    it('includes correct tags in generated recipe', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<migrationMap>
  <entry oldName="com.example.Old" newName="com.example.New" type="class"/>
</migrationMap>`

      await writeFile(join(tempInputDir, 'test.xml'), xmlContent)

      await convertMigrationMapsToOpenRewrite({
        inputDirectory: tempInputDir,
        outputDirectory: tempOutputDir
      })

      const outputContent = await readFile(
        join(tempOutputDir, 'test.yml'),
        'utf-8'
      )

      expect(outputContent).toContain('tags:')
      expect(outputContent).toContain('- fabric')
      expect(outputContent).toContain('- migration')
    })

    it('converts the fixture file correctly', async () => {
      const fixtureDir = join(process.cwd(), '__fixtures__')

      const count = await convertMigrationMapsToOpenRewrite({
        inputDirectory: fixtureDir,
        outputDirectory: tempOutputDir
      })

      expect(count).toBe(1)

      const outputContent = await readFile(
        join(tempOutputDir, 'Fabric-API-26-1.yml'),
        'utf-8'
      )

      expect(outputContent).toContain('type: org.openrewrite.java.Recipe')
      expect(outputContent).toContain('name: com.twelveiterations.Fabric-API-26-1')
      expect(outputContent).toContain(
        'oldFullyQualifiedTypeName: net.fabricmc.fabric.api.biome.v1.BiomeModificationContext$SpawnSettingsContext'
      )
      expect(outputContent).toContain(
        'newFullyQualifiedTypeName: net.fabricmc.fabric.api.biome.v1.BiomeModificationContext$MobSpawnSettingsContext'
      )
    })

    it('returns 0 when input directory is empty', async () => {
      const count = await convertMigrationMapsToOpenRewrite({
        inputDirectory: tempInputDir,
        outputDirectory: tempOutputDir
      })

      expect(count).toBe(0)
    })

    it('handles migration map with empty entry array', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<migrationMap>
  <name value="Empty Migration"/>
</migrationMap>`

      await writeFile(join(tempInputDir, 'empty.xml'), xmlContent)

      const count = await convertMigrationMapsToOpenRewrite({
        inputDirectory: tempInputDir,
        outputDirectory: tempOutputDir
      })

      expect(count).toBe(0)
    })
  })
})
