"use client"

export function WhenToStart() {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900/70 to-black/70 backdrop-blur-sm border border-gray-700/50 p-6">
      {/* Glowing "Now?" background watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-[100px] md:text-[120px] font-black text-white/10 select-none drop-shadow-[0_0_30px_rgba(63,191,181,0.3)]">
          Now?
        </span>
      </div>

      {/* Foreground content */}
      <div className="relative z-10 text-center">
        <h3 className="text-base md:text-lg font-bold leading-tight">
          <span className="bg-gradient-to-r from-primary-300 via-secondary-300 to-primary-300 bg-clip-text text-transparent">
            When would it be a good time
          </span>
          <br />
          <span className="bg-gradient-to-r from-secondary-300 via-primary-300 to-secondary-300 bg-clip-text text-transparent">
            to get started on my journey to
          </span>
          <br />
          <span className="text-white text-lg md:text-xl font-extrabold mt-2 inline-block drop-shadow-lg">
            FEELING BETTER?!
          </span>
        </h3>
      </div>
    </div>
  )
}
