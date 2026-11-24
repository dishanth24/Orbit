let voices = []
let voicesLoaded = false

function loadVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      voices = window.speechSynthesis.getVoices()
      voicesLoaded = true
    }
  } else {
    voicesLoaded = true
  }
}

loadVoices()

export function useVoice() {
  const speak = (text, settings = {}) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    if (settings.voice_enabled === false) return

    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.0
      utterance.pitch = 1.0
      utterance.volume = 1.0
      utterance.lang = 'en-US'

      if (voicesLoaded && voices.length > 0) {
        const preferred = voices.find(v => v.lang.startsWith('en') && v.localService)
        if (preferred) utterance.voice = preferred
      }

      window.speechSynthesis.speak(utterance)
    } catch (err) {
      console.warn('Speech synthesis failed:', err)
    }
  }

  const stop = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  }

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  return { speak, stop, isSupported }
}
