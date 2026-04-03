'use client'

interface GameHUDProps {
  score: number
  combo: number
  wave: number
  worldName: string
  worldColor: string
  cityHealth: number
  maxCityHealth: number
  showScorePop: boolean
}

export default function GameHUD({
  score, combo, wave, worldName, worldColor,
  cityHealth, maxCityHealth, showScorePop,
}: GameHUDProps) {
  const comboMultiplier = combo >= 20 ? 4 : combo >= 10 ? 3 : combo >= 5 ? 2 : 1

  return (
    <div className="absolute top-0 left-0 right-0 z-30 px-4 pt-3 pb-2">
      <div className="flex items-start justify-between max-w-lg mx-auto">
        {/* Score */}
        <div className="text-left">
          <div
            className="text-2xl font-bold text-white tabular-nums"
            style={{
              textShadow: '0 0 10px rgba(255,255,255,0.3)',
              animation: showScorePop ? 'scorePop 0.3s ease-out' : undefined,
            }}
          >
            {score.toLocaleString()}
          </div>
          {combo >= 3 && (
            <div
              className="text-sm font-bold"
              style={{
                color: comboMultiplier >= 4 ? '#ff4060' : comboMultiplier >= 3 ? '#e8a838' : '#72C247',
                animation: 'comboFlash 1s ease-in-out infinite',
              }}
            >
              {combo} COMBO {comboMultiplier > 1 ? `\u00d7${comboMultiplier}` : ''}
            </div>
          )}
        </div>

        {/* Wave */}
        <div className="text-center">
          <div className="text-xs font-medium uppercase tracking-widest" style={{ color: worldColor }}>
            {worldName}
          </div>
          <div className="text-lg font-bold text-white">
            Wave {wave}
          </div>
        </div>

        {/* City Health */}
        <div className="text-right">
          <div className="flex gap-1 justify-end">
            {Array.from({ length: maxCityHealth }).map((_, i) => (
              <div
                key={i}
                className="transition-all duration-300"
                style={{
                  width: 12, height: 12,
                  borderRadius: '50%',
                  background: i < cityHealth
                    ? 'linear-gradient(135deg, #4ade80, #22c55e)'
                    : 'rgba(60, 60, 80, 0.4)',
                  boxShadow: i < cityHealth
                    ? '0 0 6px #22c55e80'
                    : 'none',
                  border: i < cityHealth
                    ? '1px solid #4ade80'
                    : '1px solid rgba(80, 80, 100, 0.3)',
                }}
              />
            ))}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            SHIELDS
          </div>
        </div>
      </div>
    </div>
  )
}
