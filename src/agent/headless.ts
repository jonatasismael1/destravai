import readline from 'node:readline'
import { createAgent } from './openrouterAgent'
import { defaultTools } from './tools'

const apiKey = process.env.OPENROUTER_API_KEY

if (!apiKey) {
  console.error('Missing OPENROUTER_API_KEY. Create a key at https://openrouter.ai/settings/keys and set it in your shell.')
  process.exit(1)
}

const agent = createAgent({
  apiKey,
  model: process.env.OPENROUTER_MODEL || 'openrouter/auto',
  instructions: process.env.OPENROUTER_AGENT_INSTRUCTIONS || 'You are a concise, practical assistant with access to tools.',
  tools: [...defaultTools],
})

agent.on('thinking:start', () => {
  process.stdout.write('\nThinking...\n')
})

agent.on('tool:call', (name, args) => {
  process.stdout.write(`\nUsing ${name}: ${JSON.stringify(args)}\n`)
})

agent.on('stream:delta', (delta) => {
  process.stdout.write(delta)
})

agent.on('stream:end', () => {
  process.stdout.write('\n\n')
})

agent.on('error', (err) => {
  console.error(`Agent error: ${err.message}`)
})

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function prompt(): void {
  rl.question('You: ', (input) => {
    const text = input.trim()
    if (!text) {
      prompt()
      return
    }

    agent.send(text)
      .catch(() => undefined)
      .finally(prompt)
  })
}

console.log('OpenRouter agent ready. Type a message, or press Ctrl+C to exit.\n')
prompt()
