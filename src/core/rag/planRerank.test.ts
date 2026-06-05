import { App, TFile } from 'obsidian'

import { getChatModelClient } from '../llm/manager'

import { processQueryWithPlanRerank } from './planRerank'

jest.mock('../llm/manager', () => ({
  getChatModelClient: jest.fn(),
}))

const mockedGetChatModelClient = getChatModelClient as jest.MockedFunction<
  typeof getChatModelClient
>

function createFile(path: string, mtime: number): TFile {
  return {
    path,
    name: path.split('/').at(-1) ?? path,
    extension: 'md',
    stat: {
      ctime: mtime,
      mtime,
      size: 1,
    },
  } as TFile
}

describe('processQueryWithPlanRerank', () => {
  let consoleWarnSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  it('falls back to local ranking when the rerank model returns invalid JSON', async () => {
    const appleFile = createFile('notes/apple.md', 1)
    const bananaFile = createFile('notes/banana.md', 2)
    const app = {
      vault: {
        cachedRead: jest.fn(async (file: TFile) =>
          file.path.includes('banana')
            ? 'banana banana project note'
            : 'apple project note',
        ),
      },
    } as unknown as App
    mockedGetChatModelClient.mockReturnValue({
      model: {
        providerType: 'anthropic-plan',
        providerId: 'anthropic-plan',
        id: 'claude-sonnet-4.6 (plan)',
        model: 'claude-sonnet-4-6',
      },
      providerClient: {
        generateResponse: jest.fn().mockResolvedValue({
          id: 'response-id',
          model: 'claude-sonnet-4-6',
          object: 'chat.completion',
          choices: [
            {
              finish_reason: 'stop',
              message: {
                role: 'assistant',
                content: 'not json',
              },
            },
          ],
        }),
      },
    } as unknown as ReturnType<typeof getChatModelClient>)

    const { results, retrievalMetadata } = await processQueryWithPlanRerank({
      app,
      settings: {
        version: 18,
        providers: [],
        chatModels: [],
        embeddingModels: [],
        chatModelId: 'claude-sonnet-4.6 (plan)',
        applyModelId: 'gpt-4.1-mini',
        embeddingModelId: 'openai/text-embedding-3-small',
        systemPrompt: '',
        ragOptions: {
          retrievalMode: 'plan-rerank',
          folderReadMode: 'auto',
          chunkSize: 1000,
          thresholdTokens: 1,
          exhaustiveDirectTokenLimit: 60000,
          minSimilarity: 0,
          limit: 1,
          planRerankCandidateLimit: 2,
          excludePatterns: [],
          includePatterns: [],
        },
        mcp: { servers: [] },
        chatOptions: {
          includeCurrentFileContent: true,
          enableTools: true,
          maxAutoIterations: 1,
        },
      },
      query: 'banana',
      files: [appleFile, bananaFile],
      scopeType: 'folders',
    })

    expect(results).toHaveLength(1)
    expect(results[0].path).toBe('notes/banana.md')
    expect(results[0].model).toBe('plan-rerank')
    expect(retrievalMetadata).toMatchObject({
      retrievalMode: 'plan-rerank',
      scopeType: 'folders',
      totalFilesRead: 2,
      exhaustive: false,
    })
  })
})
