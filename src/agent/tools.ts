import { tool } from '@openrouter/sdk/lib/tool'
import { z } from 'zod'

export const timeTool = tool({
  name: 'get_current_time',
  description: 'Get the current date and time for a timezone.',
  inputSchema: z.object({
    timezone: z.string().optional().describe('IANA timezone, for example UTC or America/Sao_Paulo.'),
  }),
  execute: async ({ timezone }) => {
    const resolvedTimezone = timezone || 'UTC'
    return {
      time: new Date().toLocaleString('en-US', { timeZone: resolvedTimezone }),
      timezone: resolvedTimezone,
    }
  },
})

export const calculatorTool = tool({
  name: 'calculate',
  description: 'Perform a basic arithmetic calculation using numbers, parentheses, and + - * / operators.',
  inputSchema: z.object({
    expression: z.string().describe('Arithmetic expression, for example: (2 + 2) * 3.'),
  }),
  execute: async ({ expression }) => {
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '')
    if (!sanitized.trim()) {
      throw new Error('Expression did not contain a supported arithmetic calculation.')
    }

    const result = Function(`"use strict"; return (${sanitized})`)() as unknown
    if (typeof result !== 'number' || !Number.isFinite(result)) {
      throw new Error('Calculation did not produce a finite number.')
    }

    return { expression, result }
  },
})

export const defaultTools = [timeTool, calculatorTool] as const
