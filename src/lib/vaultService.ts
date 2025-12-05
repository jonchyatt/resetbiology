/**
 * Vault Service - RAG-Optimized Context Retrieval
 *
 * Provides intelligent reading and writing to user's Google Drive Vault
 * with recency-aware caching, query intent analysis, and context compression.
 *
 * @see docs/AGENT-VAULT-INTEGRATION.md for full architecture
 */

import { getDriveClient, getSubfolderId } from './google-drive'
import { prisma } from './prisma'
import OpenAI from 'openai'

// ============================================================================
// Types
// ============================================================================

export type VaultPartition =
  | 'Peptides'
  | 'Nutrition'
  | 'Workouts'
  | 'Breath Sessions'
  | 'Vision Training'
  | 'Memory Training'
  | 'Journal'
  | 'Profile'
  | 'Progress Reports'

export type RecencyTier = 'today' | 'week' | 'month' | 'all'

export interface VaultReadOptions {
  folder: VaultPartition
  filePattern?: string
  lastNDays?: number
  lastNRows?: number
  maxChars?: number
  format?: 'raw' | 'summary'
  recencyTier?: RecencyTier
  queryHint?: string
  compress?: boolean
}

export interface VaultReadResult {
  success: boolean
  data: string
  charCount: number
  truncated: boolean
  source: string
  cached: boolean
  compressionRatio?: number
  error?: string
}

export interface VaultWriteOptions {
  folder: VaultPartition
  csvFile?: string
  csvRow?: Record<string, unknown>
  mdFile?: string
  mdContent?: string
  jsonFile?: string
  jsonData?: Record<string, unknown>
  jsonMerge?: boolean
  invalidateCache?: boolean
}

export interface VaultWriteResult {
  success: boolean
  fileId?: string
  error?: string
}

export interface QueryIntent {
  timeScope: 'today' | 'yesterday' | 'week' | 'month' | 'specific_date' | 'trend'
  dataType: 'detail' | 'summary' | 'comparison' | 'recommendation'
  specificItem?: string
}

// ============================================================================
// Cache Layer
// ============================================================================

interface CacheEntry {
  data: string
  timestamp: number
  recencyTier: RecencyTier
  compressed: boolean
}

const vaultCache = new Map<string, CacheEntry>()

const CACHE_TTL: Record<RecencyTier, number> = {
  today: 2 * 60 * 1000,    // 2 minutes - today's data changes frequently
  week: 10 * 60 * 1000,    // 10 minutes - weekly summaries stable
  month: 30 * 60 * 1000,   // 30 minutes - monthly trends very stable
  all: 60 * 60 * 1000,     // 1 hour - full history rarely changes
}

function getCacheKey(userId: string, partition: string, tier: string): string {
  return `${userId}:${partition}:${tier}`
}

/**
 * Invalidate cache entries for a user/partition combination
 */
export function invalidateUserCache(userId: string, partition?: VaultPartition): void {
  for (const key of vaultCache.keys()) {
    if (key.startsWith(userId + ':')) {
      if (!partition || key.includes(`:${partition}:`)) {
        vaultCache.delete(key)
      }
    }
  }
}

// ============================================================================
// Query Intent Analysis
// ============================================================================

/**
 * Analyze user message to optimize vault retrieval
 * Fast, no LLM call - uses pattern matching
 */
export function analyzeQueryIntent(message: string): QueryIntent {
  const lower = message.toLowerCase()

  // Time scope detection
  let timeScope: QueryIntent['timeScope'] = 'week'
  if (lower.includes('today') || lower.includes('this morning') || lower.includes('just now')) {
    timeScope = 'today'
  } else if (lower.includes('yesterday')) {
    timeScope = 'yesterday'
  } else if (lower.includes('trend') || lower.includes('progress') || lower.includes('over time')) {
    timeScope = 'trend'
  } else if (lower.includes('last week') || lower.includes('this week')) {
    timeScope = 'week'
  } else if (lower.includes('last month') || lower.includes('this month')) {
    timeScope = 'month'
  }

  // Data type detection
  let dataType: QueryIntent['dataType'] = 'detail'
  if (lower.includes('trend') || lower.includes('average') || lower.includes('overall') || lower.includes('summary')) {
    dataType = 'summary'
  } else if (lower.includes('compare') || lower.includes('vs') || lower.includes('better') || lower.includes('worse')) {
    dataType = 'comparison'
  } else if (lower.includes('should') || lower.includes('recommend') || lower.includes('help') || lower.includes('what to')) {
    dataType = 'recommendation'
  }

  // Specific item detection (peptides)
  let specificItem: string | undefined
  const peptidePatterns = [
    /\b(bpc[-\s]?157)\b/i,
    /\b(tb[-\s]?500)\b/i,
    /\b(semaglutide|sema|ozempic|wegovy)\b/i,
    /\b(ipamorelin|ipa)\b/i,
    /\b(cjc[-\s]?1295)\b/i,
    /\b(ghk[-\s]?cu)\b/i,
    /\b(pt[-\s]?141)\b/i,
    /\b(thymosin)\b/i,
  ]
  for (const pattern of peptidePatterns) {
    const match = lower.match(pattern)
    if (match) {
      specificItem = match[1]
      break
    }
  }

  return { timeScope, dataType, specificItem }
}

/**
 * Map query intent to optimal recency tier
 */
export function intentToRecencyTier(intent: QueryIntent): RecencyTier {
  switch (intent.timeScope) {
    case 'today':
    case 'yesterday':
      return 'today'
    case 'week':
      return 'week'
    case 'month':
    case 'trend':
      return 'month'
    default:
      return 'week'
  }
}

// ============================================================================
// Context Compression
// ============================================================================

let openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return openai
}

/**
 * Compress verbose data using fast LLM call
 * Only called when data exceeds threshold
 */
export async function compressContext(rawData: string, targetChars: number = 500): Promise<string> {
  if (rawData.length <= targetChars) return rawData

  try {
    const client = getOpenAI()
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: `Compress this health/fitness data to ~${targetChars} characters.
Keep: dates, specific numbers, key events, patterns.
Remove: redundancy, verbose descriptions.
Format: Concise bullet points or short prose.`
      }, {
        role: 'user',
        content: rawData
      }],
      max_tokens: Math.ceil(targetChars / 2.5),
      temperature: 0
    })

    return response.choices[0].message?.content || rawData.slice(0, targetChars)
  } catch (error) {
    console.error('[vaultService] Compression failed:', error)
    // Fallback: simple truncation with ellipsis at sentence boundary
    const truncated = rawData.slice(0, targetChars)
    const lastPeriod = truncated.lastIndexOf('.')
    return lastPeriod > targetChars * 0.7 ? truncated.slice(0, lastPeriod + 1) : truncated + '...'
  }
}

// ============================================================================
// Vault Reading
// ============================================================================

/**
 * Check if user has Google Drive connected
 */
export async function isVaultConnected(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleDriveRefreshToken: true, driveFolder: true }
  })
  return !!(user?.googleDriveRefreshToken && user?.driveFolder)
}

/**
 * Read file content from Google Drive
 */
async function readDriveFile(driveClient: any, fileId: string): Promise<string> {
  try {
    const response = await driveClient.files.get({
      fileId,
      alt: 'media'
    })
    return typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
  } catch (error) {
    console.error('[vaultService] Failed to read file:', error)
    return ''
  }
}

/**
 * List files in a Drive folder matching a pattern
 */
async function listDriveFiles(
  driveClient: any,
  folderId: string,
  pattern?: string
): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
  try {
    let query = `'${folderId}' in parents and trashed=false`
    if (pattern) {
      // Convert glob to Drive query (simplified)
      if (pattern.endsWith('.csv')) {
        query += ` and mimeType='text/csv'`
      } else if (pattern.endsWith('.md')) {
        query += ` and (mimeType='text/markdown' or name contains '.md')`
      } else if (pattern.endsWith('.json')) {
        query += ` and mimeType='application/json'`
      }
    }

    const response = await driveClient.files.list({
      q: query,
      fields: 'files(id, name, modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 50
    })

    return response.data.files || []
  } catch (error) {
    console.error('[vaultService] Failed to list files:', error)
    return []
  }
}

/**
 * Filter CSV rows by date range
 */
function filterCSVByDate(csvContent: string, lastNDays: number): string {
  const lines = csvContent.split('\n')
  if (lines.length < 2) return csvContent

  const header = lines[0]
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - lastNDays)

  const filteredRows = lines.slice(1).filter(line => {
    if (!line.trim()) return false
    // Try to find a date in the row (assumes ISO format or common date patterns)
    const dateMatch = line.match(/(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{4})/)
    if (!dateMatch) return true // Keep rows without dates
    const rowDate = new Date(dateMatch[0])
    return rowDate >= cutoffDate
  })

  return [header, ...filteredRows].join('\n')
}

/**
 * Format vault data for agent consumption
 */
function formatForAgent(partition: VaultPartition, rawData: string, format: 'raw' | 'summary'): string {
  if (format === 'raw') return rawData

  // Create human-readable summaries per partition type
  const lines = rawData.split('\n').filter(l => l.trim())

  switch (partition) {
    case 'Peptides':
      return `Recent peptide doses:\n${lines.slice(0, 10).map(l => `• ${l}`).join('\n')}`
    case 'Nutrition':
      return `Recent nutrition entries:\n${lines.slice(0, 15).map(l => `• ${l}`).join('\n')}`
    case 'Workouts':
      return `Recent workouts:\n${lines.slice(0, 8).map(l => `• ${l}`).join('\n')}`
    default:
      return lines.slice(0, 20).join('\n')
  }
}

/**
 * Main vault read function with RAG optimizations
 */
export async function readFromVault(userId: string, options: VaultReadOptions): Promise<VaultReadResult> {
  const {
    folder,
    filePattern,
    lastNDays = 7,
    lastNRows = 50,
    maxChars = 2000,
    format = 'summary',
    recencyTier = 'week',
    queryHint,
    compress = true
  } = options

  // Check cache first
  const cacheKey = getCacheKey(userId, folder, recencyTier)
  const cached = vaultCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL[recencyTier]) {
    return {
      success: true,
      data: cached.data,
      charCount: cached.data.length,
      truncated: false,
      source: 'cache',
      cached: true
    }
  }

  // Get Drive client
  const driveClient = await getDriveClient(userId)
  if (!driveClient) {
    return {
      success: false,
      data: '',
      charCount: 0,
      truncated: false,
      source: 'none',
      cached: false,
      error: 'Google Drive not connected'
    }
  }

  // Get user's root folder
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { driveFolder: true }
  })

  if (!user?.driveFolder) {
    return {
      success: false,
      data: '',
      charCount: 0,
      truncated: false,
      source: 'none',
      cached: false,
      error: 'No vault folder configured'
    }
  }

  try {
    // Get partition folder
    const folderId = await getSubfolderId(driveClient, user.driveFolder, folder)
    if (!folderId) {
      return {
        success: true,
        data: '',
        charCount: 0,
        truncated: false,
        source: folder,
        cached: false
      }
    }

    // List and read files
    const files = await listDriveFiles(driveClient, folderId, filePattern)
    if (files.length === 0) {
      return {
        success: true,
        data: '',
        charCount: 0,
        truncated: false,
        source: folder,
        cached: false
      }
    }

    // Determine how many days to load based on recency tier
    const daysToLoad = recencyTier === 'today' ? 1 : recencyTier === 'week' ? 7 : recencyTier === 'month' ? 30 : lastNDays

    // Read and combine file contents
    let combinedData = ''
    const sourcesRead: string[] = []

    for (const file of files.slice(0, 10)) { // Max 10 files
      const content = await readDriveFile(driveClient, file.id)
      if (!content) continue

      // Filter CSV files by date
      const processedContent = file.name.endsWith('.csv')
        ? filterCSVByDate(content, daysToLoad)
        : content

      combinedData += processedContent + '\n\n'
      sourcesRead.push(file.name)

      // Stop if we have enough data
      if (combinedData.length > maxChars * 2) break
    }

    // Format for agent consumption
    let formattedData = formatForAgent(folder, combinedData.trim(), format)

    // Compress if needed
    let compressionRatio: number | undefined
    const originalLength = formattedData.length
    if (compress && formattedData.length > maxChars) {
      formattedData = await compressContext(formattedData, maxChars)
      compressionRatio = originalLength / formattedData.length
    }

    // Truncate if still too long
    const truncated = formattedData.length > maxChars
    if (truncated) {
      formattedData = formattedData.slice(0, maxChars) + '...'
    }

    // Cache the result
    vaultCache.set(cacheKey, {
      data: formattedData,
      timestamp: Date.now(),
      recencyTier,
      compressed: !!compressionRatio
    })

    return {
      success: true,
      data: formattedData,
      charCount: formattedData.length,
      truncated,
      source: sourcesRead.join(', '),
      cached: false,
      compressionRatio
    }
  } catch (error) {
    console.error('[vaultService] Read error:', error)
    return {
      success: false,
      data: '',
      charCount: 0,
      truncated: false,
      source: folder,
      cached: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Read from vault with caching (convenience wrapper)
 */
export async function readFromVaultCached(userId: string, options: VaultReadOptions): Promise<VaultReadResult> {
  return readFromVault(userId, options)
}

// ============================================================================
// Vault Writing
// ============================================================================

/**
 * Append a row to a CSV file in the vault
 */
async function appendToCSV(
  driveClient: any,
  folderId: string,
  fileName: string,
  row: Record<string, unknown>
): Promise<string | null> {
  try {
    // Check if file exists
    const existingFiles = await driveClient.files.list({
      q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id)',
    })

    const headers = Object.keys(row)
    const values = headers.map(h => {
      const val = row[h]
      if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return String(val ?? '')
    })
    const newRow = values.join(',')

    if (existingFiles.data.files && existingFiles.data.files.length > 0) {
      // Append to existing file
      const fileId = existingFiles.data.files[0].id
      const existingContent = await readDriveFile(driveClient, fileId)
      const updatedContent = existingContent.trim() + '\n' + newRow

      await driveClient.files.update({
        fileId,
        media: {
          mimeType: 'text/csv',
          body: updatedContent,
        },
      })
      return fileId
    } else {
      // Create new file with header
      const content = headers.join(',') + '\n' + newRow

      const response = await driveClient.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId],
          mimeType: 'text/csv',
        },
        media: {
          mimeType: 'text/csv',
          body: content,
        },
        fields: 'id',
      })
      return response.data.id || null
    }
  } catch (error) {
    console.error('[vaultService] CSV append error:', error)
    return null
  }
}

/**
 * Write to vault with support for CSV, MD, and JSON
 */
export async function writeToVault(userId: string, options: VaultWriteOptions): Promise<VaultWriteResult> {
  const { folder, csvFile, csvRow, mdFile, mdContent, jsonFile, jsonData, jsonMerge, invalidateCache: shouldInvalidate = true } = options

  // Get Drive client
  const driveClient = await getDriveClient(userId)
  if (!driveClient) {
    return { success: false, error: 'Google Drive not connected' }
  }

  // Get user's root folder
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { driveFolder: true }
  })

  if (!user?.driveFolder) {
    return { success: false, error: 'No vault folder configured' }
  }

  try {
    // Get or create partition folder
    const folderId = await getSubfolderId(driveClient, user.driveFolder, folder)
    if (!folderId) {
      return { success: false, error: 'Could not create partition folder' }
    }

    let fileId: string | null = null

    // Handle CSV append
    if (csvFile && csvRow) {
      fileId = await appendToCSV(driveClient, folderId, csvFile, csvRow)
    }

    // Handle MD file
    if (mdFile && mdContent) {
      // Check if file exists
      const existingFiles = await driveClient.files.list({
        q: `name='${mdFile}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id)',
      })

      const existingFileId = existingFiles.data.files?.[0]?.id
      if (existingFileId) {
        fileId = existingFileId
        await driveClient.files.update({
          fileId: existingFileId,
          media: {
            mimeType: 'text/markdown',
            body: mdContent,
          },
        })
      } else {
        const response = await driveClient.files.create({
          requestBody: {
            name: mdFile,
            parents: [folderId],
            mimeType: 'text/markdown',
          },
          media: {
            mimeType: 'text/markdown',
            body: mdContent,
          },
          fields: 'id',
        })
        fileId = response.data.id ?? null
      }
    }

    // Handle JSON file
    if (jsonFile && jsonData) {
      const existingFiles = await driveClient.files.list({
        q: `name='${jsonFile}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id)',
      })

      let finalData = jsonData
      const existingJsonFileId = existingFiles.data.files?.[0]?.id

      if (jsonMerge && existingJsonFileId) {
        // Merge with existing data
        const existingContent = await readDriveFile(driveClient, existingJsonFileId)
        try {
          const existingData = JSON.parse(existingContent)
          finalData = { ...existingData, ...jsonData }
        } catch {
          // If parse fails, just use new data
        }
      }

      const content = JSON.stringify(finalData, null, 2)

      if (existingJsonFileId) {
        fileId = existingJsonFileId
        await driveClient.files.update({
          fileId: existingJsonFileId,
          media: {
            mimeType: 'application/json',
            body: content,
          },
        })
      } else {
        const response = await driveClient.files.create({
          requestBody: {
            name: jsonFile,
            parents: [folderId],
            mimeType: 'application/json',
          },
          media: {
            mimeType: 'application/json',
            body: content,
          },
          fields: 'id',
        })
        fileId = response.data.id ?? null
      }
    }

    // Invalidate cache for this partition
    if (shouldInvalidate) {
      invalidateUserCache(userId, folder)
    }

    return {
      success: true,
      fileId: fileId || undefined
    }
  } catch (error) {
    console.error('[vaultService] Write error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// ============================================================================
// Cross-Partition Loading (for Concierge)
// ============================================================================

/**
 * Load context from multiple partitions in parallel
 * Used by Concierge agent to get full picture
 */
export async function loadCrossPartitionContext(
  userId: string,
  partitions: VaultPartition[]
): Promise<Record<string, string>> {
  const results = await Promise.all(
    partitions.map(async (partition) => {
      const result = await readFromVaultCached(userId, {
        folder: partition,
        recencyTier: 'today',
        maxChars: 300,
        compress: true
      })
      return [partition, result.success ? result.data : ''] as const
    })
  )

  return Object.fromEntries(results)
}

// ============================================================================
// Agent Context Builder
// ============================================================================

/**
 * Build context string for injection into agent prompts
 * This is the main function agents should use
 */
export async function buildAgentContext(
  userId: string,
  partition: VaultPartition,
  userMessage: string
): Promise<string> {
  // Check if vault is connected
  const connected = await isVaultConnected(userId)
  if (!connected) {
    return '' // Graceful degradation - agent works without vault
  }

  // Analyze query intent to optimize retrieval
  const intent = analyzeQueryIntent(userMessage)
  const recencyTier = intentToRecencyTier(intent)

  // Read from vault with optimizations
  const result = await readFromVaultCached(userId, {
    folder: partition,
    recencyTier,
    queryHint: userMessage,
    maxChars: 1500,
    format: 'summary',
    compress: true
  })

  if (!result.success || !result.data) {
    return ''
  }

  // Format as agent context block
  return `
### USER'S RECENT ${partition.toUpperCase()} HISTORY
${result.data}
`
}
