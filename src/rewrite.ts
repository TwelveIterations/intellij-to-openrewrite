import { XMLParser } from 'fast-xml-parser'
import { stringify } from 'yaml'
import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { join, extname, basename } from 'path'
import { existsSync } from 'fs'

interface MigrationEntry {
  _oldName: string
  _newName: string
  _type: string
}

interface MigrationMap {
  migrationMap: {
    entry: MigrationEntry[]
    name?: { _value?: string }
    order?: { _value?: string }
  }
}

interface OpenRewriteRecipe {
  type: string
  name: string
  displayName: string
  description: string
  tags?: string[]
  recipeList: Array<{
    type: string
    oldFullyQualifiedTypeName: string
    newFullyQualifiedTypeName: string
  }>
}

export async function convertMigrationMapsToOpenRewrite(options: {
  inputDirectory: string
  outputDirectory: string
}): Promise<number> {
  let convertedCount = 0

  // Ensure output directory exists
  if (!existsSync(options.outputDirectory)) {
    await mkdir(options.outputDirectory, { recursive: true })
  }

  // Find all XML files in input directory
  const xmlFiles = await findXmlFiles(options.inputDirectory)

  for (const xmlFile of xmlFiles) {
    try {
      const converted = await convertXmlFile(xmlFile, options.outputDirectory)
      if (converted) {
        convertedCount++
      }
    } catch (error) {
      console.error(`Error converting ${xmlFile}:`, error)
    }
  }

  return convertedCount
}

async function findXmlFiles(directory: string): Promise<string[]> {
  const xmlFiles: string[] = []
  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      xmlFiles.push(...await findXmlFiles(fullPath))
    } else if (extname(entry.name).toLowerCase() === '.xml') {
      xmlFiles.push(fullPath)
    }
  }

  return xmlFiles
}

async function convertXmlFile(xmlFilePath: string, outputDirectory: string): Promise<boolean> {
  const xmlContent = await readFile(xmlFilePath, 'utf-8')
  
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '_'
  })
  
  const parsed = parser.parse(xmlContent) as MigrationMap
  
  // Check if this is a migrationMap
  if (!parsed.migrationMap || !parsed.migrationMap.entry) {
    return false
  }
  
  const entries = Array.isArray(parsed.migrationMap.entry) 
    ? parsed.migrationMap.entry 
    : [parsed.migrationMap.entry]
  
  // Filter for class type entries
  const classEntries = entries.filter(entry => entry._type === 'class')
  
  if (classEntries.length === 0) {
    return false
  }
  
  const recipeName = generateRecipeName(xmlFilePath, parsed.migrationMap.name?._value)
  const recipe = createOpenRewriteRecipe(recipeName, classEntries)
  
  const yamlContent = stringify(recipe, { indent: 2 })
  const outputPath = join(outputDirectory, `${recipeName}.yml`)
  
  await writeFile(outputPath, yamlContent, 'utf-8')
  console.log(`Converted: ${xmlFilePath} -> ${outputPath}`)
  
  return true
}

function generateRecipeName(xmlFilePath: string, mapName?: string): string {
  if (mapName) {
    return mapName.replace(/[^a-zA-Z0-9-_]/g, '-')
  }
  
  const fileName = basename(xmlFilePath, '.xml')
  return fileName.replace(/[^a-zA-Z0-9-_]/g, '-')
}

function createOpenRewriteRecipe(name: string, entries: MigrationEntry[]): OpenRewriteRecipe {
  return {
    type: 'specs.openrewrite.org/v1beta/recipe',
    name: `com.twelveiterations.${name}`,
    displayName: name,
    description: `Apply package and class name migrations`,
    recipeList: entries.map(entry => ({
      type: 'org.openrewrite.java.ChangeType',
      oldFullyQualifiedTypeName: entry._oldName,
      newFullyQualifiedTypeName: entry._newName,
      ignoreDefinition: true
    }))
  }
}
