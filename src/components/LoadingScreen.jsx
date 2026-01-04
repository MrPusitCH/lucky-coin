import { useState, useEffect } from 'react'

function LoadingScreen({ onComplete }) {
  const [progress, setProgress] = useState(0)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setTimeout(() => setFadeOut(true), 500)
          setTimeout(() => onComplete(), 1200)
          return 100
        }
        return prev + Math.random() * 15 + 5
      })
    }, 150)

    return () => clearInterval(interval)
  }, [onComplete])

  return (
    <div className={`loading-screen ${fadeOut ? 'fade-out' : ''}`}>
      <div className="loading-content">
        <div className="loading-coin">🪙</div>
        <h1 className="loading-title">占いコイン</h1>
        <p className="loading-subtitle">Fortune Coin</p>
        
        <div className="loading-bar-container">
          <div className="loading-bar">
            <div 
              className="loading-fill" 
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <span className="loading-percent">{Math.min(Math.floor(progress), 100)}%</span>
        </div>

        <div className="loading-dots">
          <span>.</span><span>.</span><span>.</span>
        </div>

        <p className="loading-credit">Created by ぴーまーちゃん</p>
      </div>

      <div className="sakura-container">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="sakura" style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${3 + Math.random() * 2}s`
          }}>🌸</div>
        ))}
      </div>
    </div>
  )
}

export default LoadingScreen
