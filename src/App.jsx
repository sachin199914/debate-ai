import { Mic, RotateCcw, Send, Square, Volume2 } from 'lucide-react'
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
  const recognitionRef = useRef(null)
  const utteranceRef = useRef(null)

  const hasTranscript = transcript.trim().length > 0
  const recognitionSupported = Boolean(getSpeechRecognition())
  const speechSupported = Boolean(getSpeechSynthesis())
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
    }
  }, [])

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

  function resetDraft() {
    if (recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
    }

    cancelSpeech()
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

            {opponentReply && !overallCoachScore && (
              <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                <button
                  className="primary-button"
                  type="button"
                  onClick={getCoachFeedback}
                  disabled={isCoaching || isSubmitting}
                >
                  {isCoaching ? 'Coach is analyzing...' : 'Get Coach Feedback'}
                </button>
              </div>
            )}

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

            {overallCoachScore && (
              <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                <button
                  className="primary-button"
                  type="button"
                  onClick={resetDraft}
                >
                  Start New Debate
                </button>
              </div>
            )}
          </article>

          {debateError ? <p className="panel-message error">{debateError}</p> : null}
          {speechError ? <p className="panel-message error">{speechError}</p> : null}
        </section>
      </div>
    </main>
  )
}

export default App
