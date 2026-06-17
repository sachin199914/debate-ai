import react from '@vitejs/plugin-react'
import { cwd } from 'node:process'
import { defineConfig, loadEnv } from 'vite'

const groqUrl = 'https://api.groq.com/openai/v1/chat/completions'
const defaultModel = 'qwen/qwen3-32b'

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(payload))
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk

      if (body.length > 1_000_000) {
        reject(new Error('Request body is too large.'))
        request.destroy()
      }
    })

    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}

function extractJson(text) {
  const cleanText = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  return JSON.parse(cleanText)
}

function createDemoResponse(action, topic, argument) {
  if (action === 'coach') {
    return {
      coach: {
        decision: {
          label: 'Revise before next round',
          nextMove: 'Add evidence, then answer the compromise argument in one sentence.',
          summary:
            'The argument has a clear direction, but it is not ready for a stronger follow-up until it handles the opponent’s best alternative.',
        },
        feedback:
          'Your argument is easy to understand, but it stops at a broad claim. The opponent can pressure you by asking why a full limit is better than a narrower classroom rule.',
        overallTip:
          'Before your next turn, add one concrete example and answer the strongest compromise position.',
        scores: [
          {
            feedback: 'Your main claim is understandable, but the reasoning would land harder with a clearer because-chain.',
            name: 'Clarity',
            rationale:
              'The claim can be followed, yet the argument needs a more explicit chain from problem to policy to outcome.',
            score: 4,
          },
          {
            feedback: 'You need a specific example, study, or classroom scenario to support the claim.',
            name: 'Evidence',
            rationale:
              'The argument relies on a plausible general claim but does not yet include concrete support that would be hard for an opponent to dismiss.',
            score: 3,
          },
          {
            feedback: 'The rebuttal exposed a compromise you did not address, so your next turn should answer it directly.',
            name: 'Debate Strength',
            rationale:
              'The position is debatable, but it needs a direct answer to the strongest alternative policy before it is ready for a sharper next round.',
            score: 3,
          },
        ],
        suggestions: [
          'Use one concrete classroom example or statistic to show the distraction cost.',
          'Name the best counterargument: phones can help with emergencies or learning tasks.',
          'Offer a sharper policy line, such as phone-free instruction time with limited exceptions.',
        ],
      },
      mode: 'demo',
    }
  }

  const shortArgument = argument.length > 160 ? `${argument.slice(0, 157)}...` : argument

  return {
    mode: 'demo',
    opponentReply: `I understand your position on "${topic}", but your argument leans heavily on assertion. You said: "${shortArgument}" The weak point is that you have not shown why your preferred rule is better than a narrower compromise. A strong opponent could argue that the problem is not the tool itself, but poor classroom norms and uneven enforcement. If smartphones are distracting, schools could require phone-free periods during instruction while still allowing access for emergencies, accessibility needs, or supervised learning tasks. To win this debate, you need evidence that a broad ban improves learning outcomes more than targeted restrictions.`,
  }
}

function buildRebuttalPrompt(topic, argument) {
  return `You are "The Socratic Challenger", a calm but sharp debate opponent.

Topic: ${topic}

User argument:
${argument}

Task:
Write a respectful opponent rebuttal in 150-220 words.

Return only valid JSON with this exact shape:
{
  "opponentReply": "150-220 word respectful rebuttal"
}
`
}

function buildCoachPrompt(topic, argument, opponentReply) {
  return `You are a debate coach.

Topic: ${topic}

User argument:
${argument}

Opponent rebuttal:
${opponentReply}

Task:
Act as a debate coach and score the user's argument in context of the opponent's rebuttal.

Return only valid JSON with this exact shape:
{
  "coach": {
    "decision": {
      "label": "Ready for next round | Revise before next round | Add evidence first",
      "summary": "one sentence verdict on whether the user should continue or revise",
      "nextMove": "one concrete action for the user's next turn"
    },
    "feedback": "2-3 sentence coach feedback diagnosing the user's argument",
    "scores": [
      {
        "name": "Clarity",
        "score": 1,
        "feedback": "short feedback",
        "rationale": "detailed explanation of why this score was earned"
      },
      {
        "name": "Evidence",
        "score": 1,
        "feedback": "short feedback",
        "rationale": "detailed explanation of why this score was earned"
      },
      {
        "name": "Debate Strength",
        "score": 1,
        "feedback": "short feedback",
        "rationale": "detailed explanation of why this score was earned"
      }
    ],
    "suggestions": [
      "specific suggestion 1",
      "specific suggestion 2",
      "specific suggestion 3"
    ],
    "overallTip": "1 sentence overall improvement tip"
  }
}
`
}

function readGroqMessageContent(message = {}) {
  if (typeof message.content === 'string') {
    return message.content
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (typeof part === 'string') {
          return part
        }

        return part?.text || ''
      })
      .join('')
  }

  return ''
}

async function requestGroqResponse(env, prompt) {
  const response = await fetch(groqUrl, {
    body: JSON.stringify({
      messages: [
        {
          content: prompt,
          role: 'user',
        },
      ],
      model: env.GROQ_MODEL || defaultModel,
      response_format: {
        type: 'json_object',
      },
    }),
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || 'Groq request failed.')
  }

  const rawText = readGroqMessageContent(data?.choices?.[0]?.message)

  if (!rawText) {
    throw new Error('Groq returned an empty response.')
  }

  return rawText
}

function debateApiPlugin(env) {
  return {
    configureServer(server) {
      server.middlewares.use('/api/debate', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Use POST for debate requests.' })
          return
        }

        try {
          const rawBody = await readBody(request)
          const { action = 'rebuttal', argument = '', topic = 'Open debate topic', opponentReply = '' } = JSON.parse(rawBody || '{}')
          const cleanArgument = String(argument).trim()
          const cleanTopic = String(topic).trim() || 'Open debate topic'

          if (!cleanArgument) {
            sendJson(response, 400, { error: 'Argument transcript is required.' })
            return
          }

          if (!env.GROQ_API_KEY) {
            sendJson(response, 200, createDemoResponse(action, cleanTopic, cleanArgument))
            return
          }

          const prompt = action === 'coach'
            ? buildCoachPrompt(cleanTopic, cleanArgument, opponentReply)
            : buildRebuttalPrompt(cleanTopic, cleanArgument)

          const rawText = await requestGroqResponse(
            env,
            prompt,
          )
          const parsed = extractJson(rawText || '')

          sendJson(response, 200, {
            ...parsed,
            mode: 'live',
          })
        } catch (error) {
          sendJson(response, 500, {
            error: error.message || 'The debate opponent could not respond.',
          })
        }
      })
    },
    name: 'debate-api',
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, cwd(), '')

  return {
    plugins: [react(), debateApiPlugin(env)],
  }
})
