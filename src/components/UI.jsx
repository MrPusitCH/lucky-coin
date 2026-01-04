const translations = {
  ja: {
    coins: '枚数',
    coinNumbers: ['一', '二', '三', '四', '五'],
    power: '力',
    hint: '長押しで力を溜めて離す',
    tryAgain: '再挑戦',
    success: '枚成功',
  },
  en: {
    coins: 'Coins',
    coinNumbers: ['1', '2', '3', '4', '5'],
    power: 'Power',
    hint: 'Hold to charge, release to toss',
    tryAgain: 'Try Again',
    success: ' landed',
  },
  th: {
    coins: 'เหรียญ',
    coinNumbers: ['๑', '๒', '๓', '๔', '๕'],
    power: 'พลัง',
    hint: 'กดค้างเพื่อชาร์จ ปล่อยเพื่อโยน',
    tryAgain: 'ลองอีกครั้ง',
    success: ' เหรียญสำเร็จ',
  }
}

const fortuneMeanings = {
  ja: {
    '大吉': '大吉',
    '吉': '吉',
    '中吉': '中吉',
    '小吉': '小吉',
    '末吉': '末吉',
    '福': '福',
    '幸': '幸',
    '愛': '愛',
    '運': '運',
    '夢': '夢',
  },
  en: {
    '大吉': 'Great Blessing',
    '吉': 'Good Fortune',
    '中吉': 'Middle Blessing',
    '小吉': 'Small Blessing',
    '末吉': 'Future Blessing',
    '福': 'Happiness',
    '幸': 'Joy',
    '愛': 'Love',
    '運': 'Luck',
    '夢': 'Dreams',
  },
  th: {
    '大吉': 'โชคดีมาก',
    '吉': 'โชคดี',
    '中吉': 'โชคปานกลาง',
    '小吉': 'โชคเล็กน้อย',
    '末吉': 'โชคในอนาคต',
    '福': 'ความสุข',
    '幸': 'ความยินดี',
    '愛': 'ความรัก',
    '運': 'โชคลาภ',
    '夢': 'ความฝัน',
  }
}

function UI({ coinCount, onCoinCountChange, result, musicPlaying, onToggleMusic, power, language, onLanguageChange }) {
  const t = translations[language]
  
  // Translate result
  const getTranslatedResult = () => {
    if (!result.main) return { main: '', detail: '' }
    
    if (result.main === '再挑戦') {
      return { main: t.tryAgain, detail: '' }
    }
    
    if (result.main.includes('枚成功')) {
      const count = result.main.replace('枚成功', '')
      // Translate each fortune in detail
      const fortunes = result.detail.split(' • ')
      const translatedFortunes = fortunes.map(f => fortuneMeanings[language][f] || f).join(' • ')
      return { 
        main: language === 'ja' ? result.main : `${count}${t.success}`,
        detail: translatedFortunes
      }
    }
    
    // Single coin result - main is kanji, detail is meaning
    const meaning = fortuneMeanings[language][result.main] || result.detail
    return { main: result.main, detail: meaning }
  }
  
  const translatedResult = getTranslatedResult()

  return (
    <div id="ui-container">
      <div className="top-bar">
        <p className="bar-text">{t.coins}</p>
        <select 
          value={coinCount} 
          onChange={(e) => onCoinCountChange(parseInt(e.target.value))}
        >
          {[1, 2, 3, 4, 5].map((num, i) => (
            <option key={num} value={num}>{t.coinNumbers[i]}</option>
          ))}
        </select>
        
        <div className="music-toggle">
          <span className="music-label">♪</span>
          <label className="switch">
            <input 
              type="checkbox" 
              checked={musicPlaying} 
              onChange={onToggleMusic}
            />
            <span className="slider"></span>
          </label>
        </div>

        <select 
          className="lang-select"
          value={language} 
          onChange={(e) => onLanguageChange(e.target.value)}
        >
          <option value="ja">日本語</option>
          <option value="en">English</option>
          <option value="th">ไทย</option>
        </select>
      </div>

      {power >= 0 && (
        <div className="power-bar-container">
          <div className="power-bar">
            <div 
              className="power-fill" 
              style={{ width: `${power * 100}%` }}
            />
          </div>
          <span className="power-label">{t.power}</span>
        </div>
      )}

      <div id="result-board" className={result.show ? 'show' : ''}>
        <span id="main-result">{translatedResult.main}</span>
        {translatedResult.detail && (
          <span className="sub-text" id="detail-result">{translatedResult.detail}</span>
        )}
        {result.show && (
          <div className="sparkles">
            {[...Array(6)].map((_, i) => (
              <span key={i} className="sparkle" style={{ animationDelay: `${i * 0.2}s` }}>✨</span>
            ))}
          </div>
        )}
      </div>

      <div className="hint">{t.hint}</div>
    </div>
  )
}

export default UI
