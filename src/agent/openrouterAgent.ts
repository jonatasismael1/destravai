import { OpenRouter } from '@openrouter/sdk'
import { stepCountIs } from '@openrouter/sdk/lib/stop-conditions'
import type { StreamableOutputItem } from '@openrouter/sdk/lib/stream-transformers'
import type { StopCondition, Tool } from '@openrouter/sdk/lib/tool-types'
import { EventEmitter } from 'eventemitter3'

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AgentEvents {
  'message:user': (message: Message) => void
  'message:assistant': (message: Message) => void
  'item:update': (item: StreamableOutputItem) => void
  'stream:start': () => void
  'stream:delta': (delta: string, accumulated: string) => void
  'stream:end': (fullText: string) => void
  'tool:call': (name: string, args: unknown) => void
  'tool:result': (callId: string, result: unknown) => void
  'reasoning:update': (text: string) => void
  error: (error: Error) => void
  'thinking:start': () => void
  'thinking:end': () => void
}

export interface AgentConfig {
  apiKey: string
  model?: string
  instructions?: string
  tools?: Tool[]
  maxSteps?: number
}

interface NormalizedAgentConfig {
  apiKey: string
  model: string
  instructions: string
  tools: Tool[]
  maxSteps: number
}

export interface OpenRouterModel {
  id: string
  name: string
  description?: string
  context_length: number
  pricing: {
    prompt: string
    completion: string
  }
  top_provider?: {
    is_moderated: boolean
  }
}

export interface ModelFilter {
  author?: string
  minContext?: number
  maxPromptPrice?: number
}

type InputMessage = {
  role: Message['role']
  content: string
}

function buildInput(messages: Message[]): InputMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }))
}

function getOutputText(item: StreamableOutputItem): string | null {
  if (item.type !== 'message') return null
  const textContent = item.content.find((content) => content.type === 'output_text')
  return textContent && 'text' in textContent ? textContent.text : null
}

function getReasoningText(item: StreamableOutputItem): string | null {
  if (item.type !== 'reasoning') return null
  const textContent = item.content?.find((content) => content.type === 'reasoning_text')
  return textContent && 'text' in textContent ? textContent.text : null
}

function parseToolArguments(args: string): unknown {
  if (!args.trim()) return {}
  try {
    return JSON.parse(args)
  } catch {
    return args
  }
}

export class Agent extends EventEmitter<AgentEvents> {
  private client: OpenRouter
  private messages: Message[] = []
  private config: NormalizedAgentConfig

  constructor(config: AgentConfig) {
    super()
    this.client = new OpenRouter({ apiKey: config.apiKey })
    this.config = {
      apiKey: config.apiKey,
      model: config.model ?? 'openrouter/auto',
      instructions: config.instructions ?? 'You are a helpful assistant.',
      tools: config.tools ?? [],
      maxSteps: config.maxSteps ?? 5,
    }
  }

  getMessages(): Message[] {
    return [...this.messages]
  }

  clearHistory(): void {
    this.messages = []
  }

  setInstructions(instructions: string): void {
    this.config.instructions = instructions
  }

  addTool(newTool: Tool): void {
    this.config.tools.push(newTool)
  }

  async send(content: string): Promise<string> {
    const userMessage: Message = { role: 'user', content }
    this.messages.push(userMessage)
    this.emit('message:user', userMessage)
    this.emit('thinking:start')

    try {
      const result = this.client.callModel({
        model: this.config.model,
        instructions: this.config.instructions,
        input: buildInput(this.messages),
        tools: this.config.tools.length > 0 ? this.config.tools : undefined,
        stopWhen: [stepCountIs(this.config.maxSteps) as StopCondition],
      })

      this.emit('stream:start')
      let fullText = ''

      for await (const item of result.getItemsStream()) {
        this.emit('item:update', item)

        if (item.type === 'message') {
          const newText = getOutputText(item)
          if (newText !== null && newText !== fullText) {
            const delta = newText.slice(fullText.length)
            fullText = newText
            this.emit('stream:delta', delta, fullText)
          }
        }

        if (item.type === 'function_call' && item.status === 'completed') {
          this.emit('tool:call', item.name, parseToolArguments(item.arguments))
        }

        if (item.type === 'function_call_output') {
          this.emit('tool:result', item.callId, item.output)
        }

        if (item.type === 'reasoning') {
          const reasoning = getReasoningText(item)
          if (reasoning !== null) this.emit('reasoning:update', reasoning)
        }
      }

      if (!fullText) {
        fullText = await result.getText()
      }

      this.emit('stream:end', fullText)
      const assistantMessage: Message = { role: 'assistant', content: fullText }
      this.messages.push(assistantMessage)
      this.emit('message:assistant', assistantMessage)
      return fullText
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      this.emit('error', error)
      throw error
    } finally {
      this.emit('thinking:end')
    }
  }

  async sendSync(content: string): Promise<string> {
    const userMessage: Message = { role: 'user', content }
    this.messages.push(userMessage)
    this.emit('message:user', userMessage)

    try {
      const result = this.client.callModel({
        model: this.config.model,
        instructions: this.config.instructions,
        input: buildInput(this.messages),
        tools: this.config.tools.length > 0 ? this.config.tools : undefined,
        stopWhen: [stepCountIs(this.config.maxSteps) as StopCondition],
      })

      const fullText = await result.getText()
      const assistantMessage: Message = { role: 'assistant', content: fullText }
      this.messages.push(assistantMessage)
      this.emit('message:assistant', assistantMessage)
      return fullText
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      this.emit('error', error)
      throw error
    }
  }
}

export function createAgent(config: AgentConfig): Agent {
  return new Agent(config)
}

export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models')
  if (!res.ok) {
    throw new Error(`OpenRouter models request failed with status ${res.status}`)
  }

  const data = (await res.json()) as { data?: OpenRouterModel[] }
  return Array.isArray(data.data) ? data.data : []
}

export async function findOpenRouterModels(filter: ModelFilter): Promise<OpenRouterModel[]> {
  const models = await fetchOpenRouterModels()
  return models.filter((model) => {
    if (filter.author && !model.id.startsWith(`${filter.author}/`)) return false
    if (filter.minContext && model.context_length < filter.minContext) return false
    if (filter.maxPromptPrice !== undefined) {
      const promptPrice = Number.parseFloat(model.pricing.prompt)
      if (Number.isFinite(promptPrice) && promptPrice > filter.maxPromptPrice) return false
    }
    return true
  })
}
