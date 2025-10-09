"use client"

export function WhenToStart() {
  return (
    <div className="relative overflow-visible rounded-xl bg-gradient-to-br from-gray-900/70 to-black/70 backdrop-blur-sm border border-gray-700/50 p-6 min-h-[280px] flex items-center justify-center transition-all duration-300 hover:shadow-[0_0_30px_rgba(134,239,172,0.4)] hover:border-green-400/50">
      {/* Glowing "NOW" background watermark - softer green-yellow glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
        <span className="text-[140px] md:text-[160px] lg:text-[180px] font-black text-white/20 select-none drop-shadow-[0_0_60px_rgba(167,243,208,0.4)]" style={{ lineHeight: '1', textShadow: '0 0 80px rgba(253,224,71,0.3), 0 0 40px rgba(134,239,172,0.4)' }}>
          NOW
        </span>
      </div>

      {/* Foreground content */}
      <div className="relative z-10 text-center px-2">
        <h3 className="text-base md:text-lg font-bold leading-relaxed">
          <span className="bg-gradient-to-r from-primary-300 via-secondary-300 to-primary-300 bg-clip-text text-transparent">
            When would it be a good time to
          </span>
          <br />
          <span className="text-white text-xl md:text-2xl font-black mt-2 inline-block drop-shadow-[0_0_10px_rgba(63,191,181,0.8)]">
            GET STARTED
          </span>
          <br />
          <span className="bg-gradient-to-r from-secondary-300 via-primary-300 to-secondary-300 bg-clip-text text-transparent">
            on my journey to
          </span>
          <br />
          <span className="text-white text-xl md:text-2xl font-black mt-2 inline-block drop-shadow-[0_0_10px_rgba(114,194,71,0.8)]">
            FEELING BETTER?!
          </span>
        </h3>
      </div>
    </div>
  )
}
