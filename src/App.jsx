import { useState, useRef } from 'react'
import CoinGame from './components/CoinGame'
import UI from './components/UI'
import LoadingScreen from './components/LoadingScreen'

function App() {
  const [loading, setLoading] = useState(true)
  const [coinCount, setCoinCount] = useState(1)
  const [result, setResult] = useState({ main: '', detail: '', show: false })
  const [musicPlaying, setMusicPlaying] = useState(false)
  const [power, setPower] = useState(-1)
  const [language, setLanguage] = useState('ja') // ja, en, th
  const audioRef = useRef(null)

  const toggleMusic = async () => {
    if (musicPlaying && audioRef.current) {
      audioRef.current.pause()
      setMusicPlaying(false)
    } else {
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio('/Yume To Hazakura ヲタみん  Wotamin Cover Original song by_ 青木月光  Aoki Gekkoh.mp3')
          audioRef.current.loop = true
          audioRef.current.volume = 0.4
        }
        await audioRef.current.play()
        setMusicPlaying(true)
      } catch (e) {
        console.error('Play failed:', e)
      }
    }
  }

  if (loading) {
    return <LoadingScreen onComplete={() => setLoading(false)} language={language} />
  }

  return (
    <>
      <CoinGame 
        coinCount={coinCount} 
        onResult={setResult}
        onPowerChange={setPower}
        language={language}
      />
      <UI 
        coinCount={coinCount}
        onCoinCountChange={setCoinCount}
        result={result}
        musicPlaying={musicPlaying}
        onToggleMusic={toggleMusic}
        power={power}
        language={language}
        onLanguageChange={setLanguage}
      />
    </>
  )
}

export default App
