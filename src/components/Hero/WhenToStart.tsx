"use client"

export function WhenToStart() {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900/50 to-black/50 backdrop-blur-sm border border-gray-700/50 p-4">
      {/* Smaller "Now?" background watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-[80px] md:text-[100px] font-black text-white/5 select-none">
          Now?
        </span>
      </div>

      {/* Foreground content */}
      <div className="relative z-10 text-center">
        <h3 className="text-sm md:text-base font-bold leading-tight">
          <span className="bg-gradient-to-r from-primary-300 via-secondary-300 to-primary-300 bg-clip-text text-transparent">
            When would it be a good time
          </span>
          <br />
          <span className="bg-gradient-to-r from-secondary-300 via-primary-300 to-secondary-300 bg-clip-text text-transparent">
            to get started on my journey to
          </span>
          <br />
          <span className="text-white text-base md:text-lg font-extrabold mt-1 inline-block">
            FEELING BETTER?!
          </span>
        </h3>
      </div>
    </div>
  )
}
