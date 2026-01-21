import CursorRing from '@/components/CursorRing';

export default function RingDemo() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50">
            {/* Full-screen cursor ring */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="w-full h-full pointer-events-auto">
                    <CursorRing />
                </div>
            </div>

            {/* Content overlay */}
            <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8 text-center">
                <h1 className="text-5xl font-serif text-gray-800 mb-4">
                    Wedding Ring Demo
                </h1>
                <p className="text-xl text-gray-600 max-w-2xl">
                    Move your cursor around to see the 3D wedding ring follow it!
                </p>
                <p className="text-sm text-gray-500 mt-4">
                    The ring smoothly tracks your mouse movement with realistic 3D rendering.
                </p>
            </div>
        </div>
    );
}
