"use client"

export function WhenToStart() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900/50 to-black/50 backdrop-blur-sm border border-gray-700/50 p-8 md:p-12">
      {/* Large "Now?" background watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-[150px] md:text-[200px] lg:text-[250px] font-black text-white/5 select-none">
          Now?
        </span>
      </div>

      {/* Foreground content */}
      <div className="relative z-10 text-center space-y-6">
        <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight">
          <span className="bg-gradient-to-r from-primary-300 via-secondary-300 to-primary-300 bg-clip-text text-transparent">
            When would it be a good time
          </span>
          <br />
          <span className="bg-gradient-to-r from-secondary-300 via-primary-300 to-secondary-300 bg-clip-text text-transparent">
            to get started on my journey to
          </span>
          <br />
          <span className="text-white text-3xl md:text-4xl lg:text-5xl">
            FEELING BETTER?!
          </span>
        </h3>

        {/* Optional subtle animation */}
        <div className="flex justify-center mt-8">
          <div className="w-16 h-1 bg-gradient-to-r from-transparent via-primary-400 to-transparent animate-pulse"></div>
        </div>
      </div>
    </div>
  )
}