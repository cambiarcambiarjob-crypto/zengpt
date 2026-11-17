import GradientText from '@/components/reactbits/GradientText';
import SpotlightCard from '@/components/reactbits/SpotlightCard';
import type { Juego } from './useSerpiente';

/** Menú secreto de juegos (5 clics en el emblema). */
export default function MenuJuegos({ alElegir, alCerrar }: { alElegir: (j: Juego) => void; alCerrar: () => void }) {
    const juegos: { id: Juego; titulo: string; texto: string; color: string }[] = [
        { id: 'snake', titulo: 'SNAKE', texto: 'Neón, 5 zonas, música por nivel.', color: '#ff3dd8' },
        { id: 'zombies', titulo: 'ZOMBIES', texto: 'Shooter en equipo de 2 contra oleadas.', color: '#3dff7a' },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Juegos secretos" onClick={alCerrar}>
            <div className="w-full max-w-lg" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }} onClick={(e) => e.stopPropagation()}>
                <GradientText colors={['#22e5ff', '#ff3dd8', '#3dff7a', '#22e5ff']} animationSpeed={3} glow={1} className="block text-center text-3xl font-bold tracking-[0.3em]">
                    JUEGOS
                </GradientText>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {juegos.map((j) => (
                        <button key={j.id} type="button" onClick={() => alElegir(j.id)} className="text-left">
                            <SpotlightCard theme="dark" spotlightColor={`${j.color}40`} className="!rounded-none p-5" style={{ borderColor: `${j.color}88`, background: 'rgba(5,4,15,0.9)' }}>
                                <p className="text-2xl font-bold tracking-[0.2em]" style={{ color: j.color, textShadow: `0 0 12px ${j.color}` }}>
                                    {j.titulo}
                                </p>
                                <p className="mt-2 text-xs text-white/70">{j.texto}</p>
                            </SpotlightCard>
                        </button>
                    ))}
                </div>
                <button type="button" onClick={alCerrar} className="mx-auto mt-5 block text-xs tracking-widest text-white/50 hover:text-white">
                    CERRAR
                </button>
            </div>
        </div>
    );
}
