'use client';

export default function DashboardLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 animate-fade-in">
      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface p-5">
            <div className="skeleton h-3 w-20 mb-3" />
            <div className="skeleton h-7 w-28 mb-2" />
            <div className="skeleton h-2 w-16" />
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Large Card */}
        <div className="surface p-5 lg:col-span-2">
          <div className="skeleton h-4 w-32 mb-6" />
          <div className="skeleton h-48 w-full" />
        </div>

        {/* Side Cards */}
        <div className="flex flex-col gap-4">
          <div className="surface p-5">
            <div className="skeleton h-4 w-24 mb-4" />
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton h-8 w-8 rounded-full" />
                  <div className="flex-1">
                    <div className="skeleton h-3 w-full mb-1.5" />
                    <div className="skeleton h-2 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="surface p-5">
            <div className="skeleton h-4 w-28 mb-4" />
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-10 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
