// PANTALLA PROVISIONAL: solo comprueba el layout. La pantalla definitiva la reemplaza por completo.
import { CalendarDays } from 'lucide-react';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Tarjeta } from '@/components/ui/Tarjeta';
import AppLayout from '@/layouts/AppLayout';

export default function DiaShow() {
    return (
        <AppLayout titulo="Día">
            <Tarjeta>
                <EstadoVacio icono={<CalendarDays className="size-5" />} titulo="Pantalla en construcción" descripcion="Esta sección estará lista muy pronto." />
            </Tarjeta>
        </AppLayout>
    );
}
