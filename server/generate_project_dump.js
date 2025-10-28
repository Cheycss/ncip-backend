import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const projectRoot = path.resolve(__dirname, '..')
const outputFile = path.join(projectRoot, 'gemini_project_dump.txt')

const ignoreDirectories = new Set([
  'node_modules',
  '.git',
  '.idea',
  '.vscode',
  'dist',
  'build'
])

const allowedExtensions = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.json',
  '.md',
  '.html',
  '.css',
  '.scss',
  '.sql',
  '.txt',
  '.bat',
  '.config',
  '.lock',
  '.env',
  '.cjs',
  '.mjs'
])

const collectedSections = []

function isAllowedFile(filePath) {
  return allowedExtensions.has(path.extname(filePath).toLowerCase())
}

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true })
  entries.forEach((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!ignoreDirectories.has(entry.name)) {
        walk(entryPath)
      }
    } else if (entry.isFile() && isAllowedFile(entryPath)) {
      try {
        const content = fs.readFileSync(entryPath, 'utf8')
        const relativePath = path.relative(projectRoot, entryPath)
        collectedSections.push(
          `===== FILE: ${relativePath} =====\n${content}\n\n`
        )
      } catch (error) {
        console.error(`Failed to read ${entryPath}:`, error)
      }
    }
  })
}

function generateDump() {
  walk(projectRoot)
  const header = `# Gemini Project Dump\nGenerated: ${new Date().toISOString()}\nRoot: ${projectRoot}\n\n`
  fs.writeFileSync(outputFile, `${header}${collectedSections.join('')}`, 'utf8')
  console.log(`Project dump written to ${outputFile}`)
}

generateDump()