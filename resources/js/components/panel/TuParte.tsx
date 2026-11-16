import { Wallet } from 'lucide-react';
import StarBorder from '@/components/reactbits/StarBorder';
import { Cifra } from '@/components/ui/Cifra';
import { Insignia } from '@/components/ui/Insignia';
import { cn } from '@/lib/cn';
import { dinero, mesLargo } from '@/lib/formato';
import type { DashboardProps } from '@/types';
import { porciento } from './texto';

export interface TuParteProps {
    /** true = dueño (su parte es `dueno`); false = socio (su parte es `socio`, el porcentaje del neto). */
    esAdmin: boolean;
    /** Porcentaje del socio sobre el neto (props.negocio.porcentaje_socio). */
    porcentajeSocio: number;
    hoy: DashboardProps['hoy'];
    mes: DashboardProps['mes'];
    historico: DashboardProps['historico'];
    className?: string;
}

/**
 * «Tu parte»: lo que le toca a quien mira el panel, hoy, en el mes y desde el inicio. Es la única tarjeta con la luz de
 * StarBorder (React Bits) recorriendo el borde: una sola llamada de atención por pantalla.
 */
export function TuParte({ esAdmin, porcentajeSocio, hoy, mes, historico, className }: TuParteProps) {
    const clave = esAdmin ? 'dueno' : 'socio';
    const titulo = esAdmin ? 'Tu parte' : `Tu parte (${porciento(porcentajeSocio)})`;
    const periodos = [
        { etiqueta: 'Este mes', detalle: mesLargo(mes.hasta), valor: mes[clave] },
        { etiqueta: 'Histórico', detalle: 'Desde el inicio', valor: historico[clave] },
    ];

    return (
        // La luz de StarBorder se dibuja 48 px por fuera de la tarjeta: este marco la recorta a 16 px para que en
        // celular (tarjeta a 16 px de la orilla) no ensanche la página.
        <div className={cn('-m-4 h-[calc(100%+2rem)] overflow-hidden p-4', className)}>
            <StarBorder
                as="section"
                aria-labelledby="titulo-tu-parte"
                color="#34d8a6"
                duration={8}
                radius={16}
                trailLength={0.3}
                glow={0.45}
                hover="none"
                clickPulse={false}
                backgroundColor="#0f1413"
                textColor="#e8eeeb"
                borderColor="rgb(52 216 166 / 0.22)"
                // «!» pisa el diseño de botón que trae StarBorder: aquí envuelve una tarjeta.
                className="block! h-full w-full min-w-0 p-0! text-left! font-normal! shadow-tarjeta"
            >
                <div className="flex h-full flex-col p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                        <h2 id="titulo-tu-parte" className="flex items-center gap-2 text-base leading-snug font-semibold text-texto">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-campo border border-acento/30 bg-acento/10 text-acento" aria-hidden="true">
                                <Wallet className="size-4" />
                            </span>
                            {titulo}
                        </h2>
                        <Insignia estado="acento" sinPunto>
                            {esAdmin ? 'Dueño' : 'Socio'}
                        </Insignia>
                    </div>

                    <Cifra className="mt-6" etiqueta="Hoy" valor={hoy[clave]} tamano="lg" tono="acento" negativoEnRojo />
                    <p className="mt-2 text-[13px] leading-snug text-tenue">
                        {esAdmin ? 'Lo que te queda después de la publicidad, el socio y los vendedores.' : `El ${porciento(porcentajeSocio)} de la ganancia neta de todas las ventas.`}
                    </p>

                    <dl className="mt-auto pt-5">
                        {periodos.map((periodo) => (
                            <div key={periodo.etiqueta} className="flex items-baseline justify-between gap-4 border-t border-borde/70 py-3 last:pb-0">
                                <dt className="min-w-0">
                                    <span className="block text-sm font-medium text-texto">{periodo.etiqueta}</span>
                                    <span className="block truncate text-xs text-tenue first-letter:uppercase">{periodo.detalle}</span>
                                </dt>
                                <dd className={cn('cifras font-titulo text-lg font-semibold whitespace-nowrap', periodo.valor < 0 ? 'text-peligro' : 'text-texto')}>{dinero(periodo.valor)}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </StarBorder>
        </div>
    );
}
