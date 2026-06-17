import { FileText, Mic, RotateCcw, Send, Square, Video, VideoOff, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import './App.css'

const coachDimensions = [
  {
    name: 'Clarity',
    note: 'Argument structure',
  },
  {
    name: 'Evidence',
    note: 'Support and examples',
  },
  {
    name: 'Debate Strength',
    note: 'Handles objections',
  },
]

const coachRubrics = {
  Clarity: {
    checks: [
      'The main claim is easy to identify.',
      'Reasons connect logically to the conclusion.',
      'The argument avoids confusing leaps or vague wording.',
    ],
    description:
      'Clarity measures whether the listener can quickly understand the position, the reasoning behind it, and the path from claim to conclusion.',
    levels: [
      '5: Clear claim, organized reasoning, and precise wording.',
      '4: Mostly clear with minor gaps or wording that could be sharper.',
      '3: Understandable main idea, but the reasoning path needs stronger structure.',
      '2: Some relevant ideas, but the listener must infer the claim or logic.',
      '1: The position is unclear or difficult to follow.',
    ],
  },
  Evidence: {
    checks: [
      'The argument uses examples, facts, studies, or concrete scenarios.',
      'Evidence directly supports the claim instead of sitting beside it.',
      'The support is specific enough to resist an opponent’s challenge.',
    ],
    description:
      'Evidence measures how well the argument proves its claim with concrete support rather than relying only on assertion or intuition.',
    levels: [
      '5: Specific, relevant, and persuasive evidence is integrated into the reasoning.',
      '4: Good support is present, but it could be more precise or better connected.',
      '3: Some support appears, but it is broad, generic, or underdeveloped.',
      '2: Minimal support; the claim mostly rests on assertion.',
      '1: Little to no evidence is offered.',
    ],
  },
  'Debate Strength': {
    checks: [
      'The argument anticipates likely objections.',
      'It answers the opponent’s strongest alternative or compromise.',
      'It gives the speaker a strong next move for the debate.',
    ],
    description:
      'Debate Strength measures how well the argument survives pressure from an opponent and whether it positions the speaker to win the next exchange.',
    levels: [
      '5: Strongly handles counterarguments and controls the debate direction.',
      '4: Handles obvious objections, with one important pressure point remaining.',
      '3: Has a workable position, but leaves a major rebuttal unanswered.',
      '2: Vulnerable to predictable objections or alternative policies.',
      '1: The opponent can easily redirect or defeat the argument.',
    ],
  },
}

const fillerTerms = [
  'um',
  'uh',
  'er',
  'ah',
  'like',
  'you know',
  'i mean',
  'basically',
  'actually',
  'literally',
  'well',
  'so',
  'right',
  'okay',
  'kind of',
  'sort of',
  'you see',
  'i think i think'
]

const defaultStatus = 'Use the microphone to capture your argument, then review the transcript.'
const unsupportedStatus = 'Speech recognition is not available here. Type or paste your argument below.'

function getSpeechRecognition() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function getSpeechSynthesis() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.speechSynthesis || null
}

function getCameraSupported() {
  if (typeof navigator === 'undefined') {
    return false
  }

  return Boolean(navigator.mediaDevices?.getUserMedia)
}

function createEmptyCoachScores() {
  return coachDimensions.map((dimension) => ({
    ...dimension,
    feedback: '',
    score: null,
  }))
}

function createEmptyCoachDecision() {
  return {
    label: '',
    nextMove: '',
    summary: '',
  }
}

function normalizeCoachSuggestions(suggestions = []) {
  if (!Array.isArray(suggestions)) {
    return []
  }

  return suggestions
    .map((suggestion) => String(suggestion).trim())
    .filter(Boolean)
    .slice(0, 3)
}

function appendTranscript(currentTranscript, spokenText) {
  const cleanText = spokenText.trim()

  if (!cleanText) {
    return currentTranscript
  }

  return [currentTranscript.trim(), cleanText].filter(Boolean).join(' ')
}

function normalizeCoachScores(scores = []) {
  return coachDimensions.map((dimension) => {
    const match = scores.find((score) => score.name === dimension.name)
    const numericScore = Number(match?.score)

    return {
      ...dimension,
      feedback: match?.feedback || '',
      rationale: match?.rationale || '',
      score: Number.isFinite(numericScore) ? Math.min(5, Math.max(1, numericScore)) : null,
    }
  })
}

function normalizeCoachDecision(decision = {}) {
  return {
    label: decision.label || '',
    nextMove: decision.nextMove || '',
    summary: decision.summary || '',
  }
}

function buildCoachSpeech(coachScores, overallTip, coachDecision, coachFeedback, coachSuggestions) {
  const scoreSummary = coachScores
    .filter((score) => score.score)
    .map((score) => `${score.name}: ${score.score} out of 5. ${score.feedback}`)
    .join(' ')
  const decisionSummary = coachDecision.label
    ? `Coach decision: ${coachDecision.label}. ${coachDecision.summary} ${coachDecision.nextMove}`
    : ''
  const feedbackSummary = coachFeedback ? `Coach feedback: ${coachFeedback}` : ''
  const suggestionSummary = coachSuggestions.length
    ? `Suggestions: ${coachSuggestions.join(' ')}`
    : ''

  return [
    decisionSummary,
    feedbackSummary,
    suggestionSummary,
    scoreSummary,
    overallTip ? `Overall tip: ${overallTip}` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function getOverallCoachScore(coachScores) {
  const scores = coachScores.map((score) => score.score).filter(Boolean)

  if (!scores.length) {
    return null
  }

  return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function getScoreLabel(score) {
  if (score >= 5) {
    return 'Excellent'
  }

  if (score >= 4) {
    return 'Strong'
  }

  if (score >= 3) {
    return 'Developing'
  }

  if (score >= 2) {
    return 'Needs work'
  }

  return 'Missing or unclear'
}

function buildFallbackRationale(dimension, score) {
  const label = getScoreLabel(score || 0).toLowerCase()
  const rubric = coachRubrics[dimension.name]

  return `This score is ${label} because the response was evaluated against this rubric area: ${rubric.description} Use the checklist below to see what must improve for a higher score.`
}

function shortenForSummary(value, fallback) {
  const cleanText = String(value || '').trim().replace(/\s+/g, ' ')

  if (!cleanText) {
    return fallback
  }

  return cleanText.length > 170 ? `${cleanText.slice(0, 167).trim()}...` : cleanText
}

function buildDebateSummary(topic, transcript, opponentReply) {
  return [
    `The debate focused on ${shortenForSummary(topic, 'the selected topic')}.`,
    `The speaker argued that ${shortenForSummary(transcript, 'their position needs more detail before the next round')}.`,
    `The opponent challenged the argument by emphasizing ${shortenForSummary(opponentReply, 'the strongest unresolved counterpoint')}.`,
  ]
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function countFillerWords(transcript) {
  const cleanTranscript = String(transcript || '').toLowerCase()

  const breakdown = fillerTerms
    .map((term) => {
      const escapedTerm = term.split(/\s+/).map(escapeRegExp).join('\\s+')
      const pattern = new RegExp(`\\b${escapedTerm}\\b`, 'g')
      const count = cleanTranscript.match(pattern)?.length || 0

      return {
        count,
        term,
      }
    })
    .filter((item) => item.count > 0)

  return {
    breakdown,
    total: breakdown.reduce((sum, item) => sum + item.count, 0),
  }
}

function buildReportHtml({
  coachDecision,
  coachFeedback,
  coachScores,
  coachSuggestions,
  opponentReply,
  overallCoachScore,
  overallTip,
  topic,
  transcript,
}) {
  const reportDate = new Date().toLocaleString()
  const escapedTopic = escapeHtml(topic || 'Open debate topic')
  const escapedDecision = escapeHtml(coachDecision.label || 'Awaiting decision')
  const escapedSummary = escapeHtml(coachDecision.summary || 'No decision summary available.')
  const escapedNextMove = escapeHtml(coachDecision.nextMove || 'No next move provided.')
  const escapedFeedback = escapeHtml(coachFeedback || 'No coach feedback available.')
  const escapedTip = escapeHtml(overallTip || 'No overall tip available.')
  const debateSummary = buildDebateSummary(topic, transcript, opponentReply)
    .map((sentence) => `<p>${escapeHtml(sentence)}</p>`)
    .join('')
  const fillerReport = countFillerWords(transcript)
  const fillerBreakdown = fillerReport.breakdown.length
    ? fillerReport.breakdown
      .map((item) => `<li>${escapeHtml(item.term)}: ${escapeHtml(item.count)}</li>`)
      .join('')
    : '<li>No tracked filler words were detected.</li>'

  const scoreSections = coachScores
    .map((dimension) => {
      const rubric = coachRubrics[dimension.name]
      const score = dimension.score || 0
      const rationale = dimension.rationale || buildFallbackRationale(dimension, score)
      const checklist = rubric.checks.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
      const levels = rubric.levels.map((item) => `<li>${escapeHtml(item)}</li>`).join('')

      return `
        <section class="score-section">
          <div class="score-heading">
            <div>
              <p class="section-kicker">${escapeHtml(dimension.name)}</p>
              <h2>${escapeHtml(getScoreLabel(score))}</h2>
            </div>
            <strong>${score || '-'}/5</strong>
          </div>
          <p class="rubric-description">${escapeHtml(rubric.description)}</p>
          <h3>Why This Score</h3>
          <p>${escapeHtml(rationale)}</p>
          <h3>Coach Feedback</h3>
          <p>${escapeHtml(dimension.feedback || 'No dimension feedback available.')}</p>
          <div class="rubric-grid">
            <div>
              <h3>Rubric Checklist</h3>
              <ul>${checklist}</ul>
            </div>
            <div>
              <h3>Score Guide</h3>
              <ul>${levels}</ul>
            </div>
          </div>
        </section>
      `
    })
    .join('')

  const suggestions = coachSuggestions.length
    ? coachSuggestions.map((suggestion) => `<li>${escapeHtml(suggestion)}</li>`).join('')
    : '<li>No specific suggestions were returned.</li>'

  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Debate Coach Report</title>
        <style>
          :root {
            color: #111827;
            background: #eef2f7;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            color: #111827;
            background: #eef2f7;
          }

          .page {
            width: min(980px, calc(100% - 32px));
            margin: 24px auto;
            padding: 40px;
            border: 1px solid #d7dce2;
            border-radius: 8px;
            background: #ffffff;
            box-shadow: 0 20px 70px rgba(15, 23, 42, 0.12);
          }

          .toolbar {
            width: min(980px, calc(100% - 32px));
            margin: 20px auto 0;
            display: flex;
            justify-content: flex-end;
          }

          button {
            min-height: 42px;
            padding: 0 16px;
            border: 0;
            border-radius: 8px;
            background: #0f766e;
            color: #ffffff;
            font: inherit;
            font-weight: 800;
            cursor: pointer;
          }

          header {
            display: grid;
            gap: 16px;
            padding-bottom: 24px;
            border-bottom: 2px solid #14313b;
          }

          .eyebrow,
          .section-kicker {
            margin: 0;
            color: #0f766e;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }

          h1 {
            margin: 0;
            color: #111827;
            font-size: 34px;
            line-height: 1;
          }

          h2 {
            margin: 4px 0 0;
            color: #111827;
            font-size: 22px;
            line-height: 1.1;
          }

          h3 {
            margin: 18px 0 6px;
            color: #14313b;
            font-size: 14px;
            text-transform: uppercase;
          }

          p,
          li {
            color: #334155;
            font-size: 14px;
            line-height: 1.55;
          }

          ul {
            margin: 0;
            padding-left: 19px;
          }

          .meta-grid,
          .rubric-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
          }

          .summary-card,
          .text-card,
          .score-section {
            margin-top: 18px;
            padding: 18px;
            border: 1px solid #d7dce2;
            border-radius: 8px;
            background: #fbfcfe;
          }

          .summary-card {
            background: #ecfdf5;
            border-color: rgba(15, 118, 110, 0.22);
          }

          .summary-card strong {
            color: #111827;
            font-size: 28px;
          }

          .metric-card {
            margin-top: 18px;
            padding: 18px;
            border: 1px solid rgba(20, 49, 59, 0.18);
            border-radius: 8px;
            background: #f8fafc;
          }

          .metric-card strong {
            display: inline-grid;
            width: 58px;
            height: 44px;
            margin-right: 10px;
            place-items: center;
            border-radius: 8px;
            background: #14313b;
            color: #ffffff;
            font-size: 20px;
          }

          .score-heading {
            display: flex;
            justify-content: space-between;
            gap: 18px;
            align-items: flex-start;
            padding-bottom: 12px;
            border-bottom: 1px solid #d7dce2;
          }

          .score-heading strong {
            width: 68px;
            min-height: 52px;
            border-radius: 8px;
            display: grid;
            place-items: center;
            background: #14313b;
            color: #ffffff;
            font-size: 18px;
          }

          .rubric-description {
            padding: 12px;
            border-radius: 8px;
            background: #f1f5f9;
          }

          .excerpt {
            white-space: pre-wrap;
          }

          @media print {
            body {
              background: #ffffff;
            }

            .toolbar {
              display: none;
            }

            .page {
              width: 100%;
              margin: 0;
              padding: 0;
              border: 0;
              box-shadow: none;
            }

            .score-section {
              break-inside: avoid;
            }
          }

          @media (max-width: 720px) {
            .page {
              padding: 24px;
            }

            .meta-grid,
            .rubric-grid {
              grid-template-columns: 1fr;
            }
          }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <button type="button" onclick="window.print()">Save as PDF</button>
        </div>
        <main class="page">
          <header>
            <p class="eyebrow">Debate Practice Coach Report</p>
            <h1>${escapedTopic}</h1>
            <div class="meta-grid">
              <p><strong>Generated:</strong> ${escapeHtml(reportDate)}</p>
              <p><strong>Overall Score:</strong> ${escapeHtml(overallCoachScore || '-')}/5</p>
            </div>
          </header>

          <section class="summary-card">
            <p class="section-kicker">Coach Verdict</p>
            <h2>${escapedDecision}</h2>
            <p>${escapedSummary}</p>
            <p><strong>Next move:</strong> ${escapedNextMove}</p>
            <p><strong>Overall tip:</strong> ${escapedTip}</p>
          </section>

          <section class="text-card">
            <p class="section-kicker">Coach Diagnosis</p>
            <p>${escapedFeedback}</p>
            <h3>Recommended Improvements</h3>
            <ul>${suggestions}</ul>
          </section>

          <section class="metric-card">
            <p class="section-kicker">Delivery Metric</p>
            <h2><strong>${escapeHtml(fillerReport.total)}</strong> Filler Words Detected</h2>
            <p>This count is calculated from the transcript for reporting only; the transcript text is not edited or cleaned.</p>
            <h3>Tracked Filler Breakdown</h3>
            <ul>${fillerBreakdown}</ul>
          </section>

          ${scoreSections}

          <section class="text-card">
            <p class="section-kicker">Debate Summary</p>
            ${debateSummary}
          </section>
        </main>
      </body>
    </html>`
}

function App() {
  const [topic, setTopic] = useState('Should schools ban smartphones during class?')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [statusMessage, setStatusMessage] = useState(() =>
    getSpeechRecognition() ? defaultStatus : unsupportedStatus,
  )
  const [audioError, setAudioError] = useState('')
  const [opponentReply, setOpponentReply] = useState('')
  const [coachScores, setCoachScores] = useState(createEmptyCoachScores)
  const [coachDecision, setCoachDecision] = useState(createEmptyCoachDecision)
  const [coachFeedback, setCoachFeedback] = useState('')
  const [coachSuggestions, setCoachSuggestions] = useState([])
  const [overallTip, setOverallTip] = useState('')
  const [debateError, setDebateError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCoaching, setIsCoaching] = useState(false)
  const [responseNote, setResponseNote] = useState('')
  const [speakingTarget, setSpeakingTarget] = useState('')
  const [speechError, setSpeechError] = useState('')
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const recognitionRef = useRef(null)
  const utteranceRef = useRef(null)
  const videoRef = useRef(null)
  const cameraStreamRef = useRef(null)

  const hasTranscript = transcript.trim().length > 0
  const recognitionSupported = Boolean(getSpeechRecognition())
  const speechSupported = Boolean(getSpeechSynthesis())
  const cameraSupported = getCameraSupported()
  const canStartRecording = recognitionSupported && !isRecording
  const coachSpeechText = buildCoachSpeech(
    coachScores,
    overallTip,
    coachDecision,
    coachFeedback,
    coachSuggestions,
  )
  const overallCoachScore = getOverallCoachScore(coachScores)
  const coachStatus = overallCoachScore
    ? 'Coach feedback ready.'
    : isCoaching
      ? 'Coach is scoring the exchange...'
      : opponentReply
        ? 'Ready to get coach feedback.'
        : isSubmitting
          ? 'Opponent is preparing a rebuttal...'
          : 'Coach scores appear after you request them.'
  const coachDecisionLabel = coachDecision.label || 'Awaiting decision'
  const coachDecisionSummary =
    coachDecision.summary || 'Coach decision appears after the exchange is scored.'
  const coachFeedbackText = coachFeedback || 'Coach feedback appears after the exchange is scored.'

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null
        recognitionRef.current.stop()
      }

      getSpeechSynthesis()?.cancel()
      stopCamera()
    }
  }, [])

  function stopCamera() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setIsCameraOn(false)
  }

  async function startCamera() {
    if (!cameraSupported) {
      setCameraError('Camera preview is not supported in this browser.')
      return
    }

    setCameraError('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
        },
      })

      cameraStreamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      setIsCameraOn(true)
    } catch {
      setCameraError('Camera permission was blocked or no camera was found.')
      stopCamera()
    }
  }

  function cancelSpeech() {
    getSpeechSynthesis()?.cancel()
    utteranceRef.current = null
    setSpeakingTarget('')
  }

  function speakText(text, target) {
    const synthesis = getSpeechSynthesis()
    const cleanText = text.trim()

    if (!cleanText) {
      return
    }

    if (!synthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      setSpeechError('Text-to-speech is not supported in this browser.')
      return
    }

    cancelSpeech()

    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.rate = target === 'opponent' ? 0.96 : 1
    utterance.pitch = target === 'opponent' ? 0.9 : 1

    utterance.onstart = () => {
      setSpeechError('')
      setSpeakingTarget(target)
    }

    utterance.onend = () => {
      setSpeakingTarget('')
      utteranceRef.current = null
    }

    utterance.onerror = () => {
      setSpeechError('Speech playback stopped. Try the play button again.')
      setSpeakingTarget('')
      utteranceRef.current = null
    }

    utteranceRef.current = utterance
    synthesis.speak(utterance)
  }

  function stopRecording() {
    if (!recognitionRef.current) {
      setIsRecording(false)
      setInterimTranscript('')
      return
    }

    recognitionRef.current.stop()
  }

  function startRecording() {
    const SpeechRecognition = getSpeechRecognition()

    if (!SpeechRecognition) {
      setAudioError('Speech recognition is not supported in this browser.')
      setStatusMessage('Type your argument into the transcript box instead.')
      return
    }

    if (recognitionRef.current) {
      stopRecording()
    }

    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsRecording(true)
      setAudioError('')
      setInterimTranscript('')
      setStatusMessage('Listening now. Your speech will appear in the transcript.')
    }

    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const spokenText = result[0].transcript

        if (result.isFinal) {
          finalText += `${spokenText} `
        } else {
          interimText += spokenText
        }
      }

      if (finalText) {
        setTranscript((currentTranscript) => appendTranscript(currentTranscript, finalText))
      }

      setInterimTranscript(interimText.trim())
    }

    recognition.onerror = (event) => {
      const message =
        event.error === 'not-allowed'
          ? 'Microphone permission was blocked. Allow microphone access or type the transcript.'
          : 'Audio capture stopped before a transcript was completed.'

      setAudioError(message)
      setStatusMessage('You can try recording again or type directly into the transcript box.')
      setIsRecording(false)
      setInterimTranscript('')
    }

    recognition.onend = () => {
      setIsRecording(false)
      setInterimTranscript('')
      setStatusMessage('Recording stopped. Review the transcript before sending it.')
      recognitionRef.current = null
    }

    try {
      recognition.start()
    } catch {
      setAudioError('Recording could not start. Try again or type your argument.')
      setStatusMessage('Type directly into the transcript box if recording is unavailable.')
      recognitionRef.current = null
      setIsRecording(false)
    }
  }

  async function submitArgument() {
    const cleanArgument = transcript.trim()

    if (!cleanArgument) {
      return
    }

    cancelSpeech()
    setIsSubmitting(true)
    setDebateError('')
    setSpeechError('')
    setOpponentReply('')
    setCoachScores(createEmptyCoachScores())
    setCoachDecision(createEmptyCoachDecision())
    setCoachFeedback('')
    setCoachSuggestions([])
    setOverallTip('')
    setResponseNote('')

    try {
      const response = await fetch('/api/debate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'rebuttal',
          argument: cleanArgument,
          topic: topic.trim() || 'Open debate topic',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'The debate opponent could not respond.')
      }

      const nextOpponentReply = data.opponentReply || ''

      setOpponentReply(nextOpponentReply)
      setResponseNote(
        data.mode === 'demo'
          ? 'Demo response shown. Add GROQ_API_KEY in .env for live AI.'
          : 'Live AI response.',
      )

      if (autoSpeak) {
        speakText(nextOpponentReply, 'opponent')
      }
    } catch (error) {
      setDebateError(error.message || 'Something went wrong.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function getCoachFeedback() {
    setIsCoaching(true)
    setDebateError('')

    try {
      const response = await fetch('/api/debate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'coach',
          argument: transcript.trim(),
          topic: topic.trim() || 'Open debate topic',
          opponentReply,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'The coach could not respond.')
      }

      const nextCoachScores = normalizeCoachScores(data.coach?.scores)
      const nextCoachDecision = normalizeCoachDecision(data.coach?.decision)
      const nextCoachFeedback = data.coach?.feedback || ''
      const nextCoachSuggestions = normalizeCoachSuggestions(data.coach?.suggestions)
      const nextOverallTip = data.coach?.overallTip || ''

      setCoachScores(nextCoachScores)
      setCoachDecision(nextCoachDecision)
      setCoachFeedback(nextCoachFeedback)
      setCoachSuggestions(nextCoachSuggestions)
      setOverallTip(nextOverallTip)
    } catch (error) {
      setDebateError(error.message || 'Something went wrong while getting coach feedback.')
    } finally {
      setIsCoaching(false)
    }
  }

  function openCoachReport() {
    if (!overallCoachScore) {
      setDebateError('Get coach feedback before creating a PDF report.')
      return
    }

    const reportWindow = window.open('', '_blank')

    if (!reportWindow) {
      setDebateError('Pop-up blocked. Allow pop-ups to open the coach PDF report.')
      return
    }

    const reportHtml = buildReportHtml({
      coachDecision,
      coachFeedback,
      coachScores,
      coachSuggestions,
      opponentReply,
      overallCoachScore,
      overallTip,
      topic,
      transcript,
    })

    reportWindow.document.open()
    reportWindow.document.write(reportHtml)
    reportWindow.document.close()
    reportWindow.focus()
  }

  function resetDraft() {
    if (recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
    }

    cancelSpeech()
    stopCamera()
    setTopic('')
    setTranscript('')
    setInterimTranscript('')
    setIsRecording(false)
    setAudioError('')
    setOpponentReply('')
    setCoachScores(createEmptyCoachScores())
    setCoachDecision(createEmptyCoachDecision())
    setCoachFeedback('')
    setCoachSuggestions([])
    setOverallTip('')
    setDebateError('')
    setResponseNote('')
    setSpeechError('')
    setStatusMessage(getSpeechRecognition() ? defaultStatus : unsupportedStatus)
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Debate Practice</p>
          <h1>Speak your argument.</h1>
        </div>
        <button className="ghost-button" type="button" onClick={resetDraft}>
          <RotateCcw aria-hidden="true" size={18} />
          Reset
        </button>
      </header>

      <div className="workspace">
        <section className="panel input-panel" aria-labelledby="argument-title">
          <div className="panel-heading">
            <div>
              <p className="section-label">Your Side</p>
              <h2 id="argument-title">Argument</h2>
            </div>
          </div>

          <label className="field">
            <span>Topic</span>
            <input
              type="text"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Enter a debate topic"
            />
          </label>

          <div className="camera-preview" aria-label="Camera preview">
            <div className={isCameraOn ? 'camera-frame active' : 'camera-frame'}>
              <video ref={videoRef} autoPlay muted playsInline />
              {!isCameraOn ? (
                <div className="camera-placeholder">
                  <VideoOff aria-hidden="true" size={28} />
                  <span>Camera preview is off.</span>
                </div>
              ) : null}
            </div>
            <div className="camera-controls">
              <button
                className="secondary-button"
                type="button"
                disabled={!cameraSupported || isCameraOn}
                onClick={startCamera}
              >
                <Video aria-hidden="true" size={18} />
                Start Camera
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={!isCameraOn}
                onClick={stopCamera}
              >
                <VideoOff aria-hidden="true" size={18} />
                Stop Camera
              </button>
            </div>
            {cameraError ? <p className="audio-error">{cameraError}</p> : null}
          </div>

          <div className="recording-controls" aria-label="Recording controls">
            <button
              className="primary-button"
              type="button"
              disabled={!canStartRecording}
              onClick={startRecording}
            >
              <Mic aria-hidden="true" size={18} />
              {isRecording ? 'Recording' : 'Start Recording'}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={!isRecording}
              onClick={stopRecording}
            >
              <Square aria-hidden="true" size={17} />
              Stop
            </button>
          </div>

          <p className={isRecording ? 'status-pill recording' : 'status-pill'}>{statusMessage}</p>

          {audioError ? <p className="audio-error">{audioError}</p> : null}

          <label className="field transcript-field">
            <span>Transcript</span>
            <textarea
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder="Audio transcript will appear here."
            />
          </label>

          {interimTranscript ? (
            <div className="live-transcript" aria-live="polite">
              <span>Live text</span>
              <p>{interimTranscript}</p>
            </div>
          ) : null}

          <button
            className="submit-button"
            type="button"
            disabled={!hasTranscript || isSubmitting}
            onClick={submitArgument}
          >
            <Send aria-hidden="true" size={18} />
            {isSubmitting ? 'Opponent is thinking' : 'Send to Opponent'}
          </button>
        </section>

        <section className="output-stack" aria-label="Debate feedback">
          <article className="panel response-panel">
            <div className="panel-heading">
              <div>
                <p className="section-label">Opponent</p>
                <h2>Rebuttal</h2>
              </div>
              <div className="header-actions">
                <label className="voice-toggle">
                  <input
                    type="checkbox"
                    checked={autoSpeak}
                    onChange={(event) => setAutoSpeak(event.target.checked)}
                  />
                  <span>Auto-read</span>
                </label>
                <button
                  className={speakingTarget === 'opponent' ? 'icon-button active' : 'icon-button'}
                  type="button"
                  aria-label={speakingTarget === 'opponent' ? 'Stop rebuttal audio' : 'Play rebuttal'}
                  disabled={!opponentReply || !speechSupported}
                  onClick={() =>
                    speakingTarget === 'opponent' ? cancelSpeech() : speakText(opponentReply, 'opponent')
                  }
                >
                  {speakingTarget === 'opponent' ? (
                    <Square aria-hidden="true" size={17} />
                  ) : (
                    <Volume2 aria-hidden="true" size={18} />
                  )}
                </button>
              </div>
            </div>
            {opponentReply ? (
              <div className="response-copy">
                <p>{opponentReply}</p>
                {responseNote ? <span>{responseNote}</span> : null}
              </div>
            ) : (
              <div className="empty-state">
                <p>{isSubmitting ? 'Preparing a rebuttal.' : 'Waiting for your argument.'}</p>
              </div>
            )}
          </article>

          <article className="panel coach-panel">
            <div className="panel-heading">
              <div>
                <p className="section-label">Coach</p>
                <h2>Scorecard</h2>
              </div>
              <button
                className={speakingTarget === 'coach' ? 'icon-button active' : 'icon-button'}
                type="button"
                aria-label={speakingTarget === 'coach' ? 'Stop coach feedback audio' : 'Play coach feedback'}
                disabled={!coachSpeechText || !speechSupported}
                onClick={() => (speakingTarget === 'coach' ? cancelSpeech() : speakText(coachSpeechText, 'coach'))}
              >
                {speakingTarget === 'coach' ? (
                  <Square aria-hidden="true" size={17} />
                ) : (
                  <Volume2 aria-hidden="true" size={18} />
                )}
              </button>
            </div>

            <div className="coach-summary">
              <div>
                <span>Overall</span>
                <strong>{overallCoachScore ? `${overallCoachScore}/5` : '-'}</strong>
              </div>
              <p>{coachStatus}</p>
            </div>

            {opponentReply && !overallCoachScore ? (
              <div className="coach-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={getCoachFeedback}
                  disabled={isCoaching || isSubmitting}
                >
                  {isCoaching ? 'Coach is analyzing...' : 'Get Coach Feedback'}
                </button>
              </div>
            ) : null}

            <div className={coachDecision.label ? 'coach-decision ready' : 'coach-decision'}>
              <span>Decision</span>
              <strong>{coachDecisionLabel}</strong>
              <p>{coachDecisionSummary}</p>
              {coachDecision.nextMove ? <em>{coachDecision.nextMove}</em> : null}
            </div>

            <div className={coachFeedback ? 'coach-feedback ready' : 'coach-feedback'}>
              <span>Feedback</span>
              <p>{coachFeedbackText}</p>
            </div>

            {coachSuggestions.length ? (
              <div className="coach-suggestions">
                <span>Suggestions</span>
                <ul>
                  {coachSuggestions.map((suggestion) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="score-grid">
              {coachScores.map((dimension) => (
                <div className="score-card" key={dimension.name}>
                  <div className="score-copy">
                    <h3>{dimension.name}</h3>
                    <p>{dimension.feedback || dimension.note}</p>
                    <div className="score-meter" aria-hidden="true">
                      <span style={{ width: `${((dimension.score || 0) / 5) * 100}%` }} />
                    </div>
                  </div>
                  <span className="score-value">{dimension.score ? `${dimension.score}/5` : '-'}</span>
                </div>
              ))}
            </div>

            {overallTip ? <p className="overall-tip">{overallTip}</p> : null}

            {overallCoachScore ? (
              <div className="report-actions">
                <button className="secondary-button" type="button" onClick={openCoachReport}>
                  <FileText aria-hidden="true" size={18} />
                  Open PDF Report
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={resetDraft}
                >
                  Start New Debate
                </button>
              </div>
            ) : null}
          </article>

          {debateError ? <p className="panel-message error">{debateError}</p> : null}
          {speechError ? <p className="panel-message error">{speechError}</p> : null}
        </section>
      </div>
    </main>
  )
}

export default App
