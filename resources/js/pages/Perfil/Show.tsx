// PANTALLA PROVISIONAL: solo comprueba el layout. La pantalla definitiva la reemplaza por completo.
import { CircleUserRound } from 'lucide-react';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Tarjeta } from '@/components/ui/Tarjeta';
import AppLayout from '@/layouts/AppLayout';

export default function PerfilShow() {
    return (
        <AppLayout titulo="Perfil">
            <Tarjeta>
                <EstadoVacio icono={<CircleUserRound className="size-5" />} titulo="Pantalla en construcción" descripcion="Esta sección estará lista muy pronto." />
            </Tarjeta>
        </AppLayout>
    );
}
