import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { FondoHilos } from '@/components/fondos/FondoHilos';
import Magnet from '@/components/reactbits/Magnet';
import StarBorder from '@/components/reactbits/StarBorder';
import { Emblema } from '@/components/ui/Marca';

export interface InvitacionCuentaProps {
    titulo: string;
    descripcion: ReactNode;
    alCrear: () => void;
    /** Enlace o botón secundario bajo la acción principal («Ver las vencidas»). */
    secundaria?: ReactNode;
}

/**
 * Estado vacío con invitación a crear una cuenta: hilos de fondo (Threads), botón con luz en el borde (StarBorder)
 * que sigue un poco al cursor (Magnet). Todo React Bits y todo decorativo: por eso este archivo se carga con `lazy()`
 * solo cuando la lista está vacía y no pesa en el uso diario de la pantalla.
 */
export default function InvitacionCuenta({ titulo, descripcion, alCrear, secundaria }: InvitacionCuentaProps) {
    return (
        <>
            <div className="fondo-rejilla pointer-events-none absolute inset-0 [mask-image:radial-gradient(60%_70%_at_50%_45%,black,transparent)]" aria-hidden="true" />
            <FondoHilos opacidad={0.4} hilos={18} className="[mask-image:linear-gradient(to_bottom,transparent,black_35%,black_70%,transparent)]" />

            <div className="relative flex animate-entrada flex-col items-center px-6 py-14 text-center">
                <Emblema className="size-12" />
                <p className="mt-5 font-titulo text-lg font-semibold text-texto">{titulo}</p>
                <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-balance text-suave">{descripcion}</p>

                <div className="mt-6 flex flex-col items-center gap-3">
                    <Magnet padding={50} magnetStrength={4} maxOffset={8}>
                        <StarBorder
                            type="button"
                            onClick={alCrear}
                            color="#34d8a6"
                            radius={10}
                            duration={6}
                            backgroundColor="#151b19"
                            textColor="#e8eeeb"
                            borderColor="rgb(255 255 255 / 0.09)"
                            className="h-11 px-5! py-0! text-sm font-semibold"
                        >
                            <Plus className="size-4 text-acento" aria-hidden="true" />
                            Nueva cuenta
                        </StarBorder>
                    </Magnet>
                    {secundaria}
                </div>
            </div>
        </>
    );
}
