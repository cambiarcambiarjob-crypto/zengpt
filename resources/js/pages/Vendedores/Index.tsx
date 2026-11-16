// PANTALLA PROVISIONAL: solo comprueba el layout. La pantalla definitiva la reemplaza por completo.
import { Users } from 'lucide-react';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Tarjeta } from '@/components/ui/Tarjeta';
import AppLayout from '@/layouts/AppLayout';

export default function VendedoresIndex() {
    return (
        <AppLayout titulo="Vendedores">
            <Tarjeta>
                <EstadoVacio icono={<Users className="size-5" />} titulo="Pantalla en construcción" descripcion="Esta sección estará lista muy pronto." />
            </Tarjeta>
        </AppLayout>
    );
}
