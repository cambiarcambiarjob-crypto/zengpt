import type { ReactNode } from 'react';
import { Boton } from './Boton';
import { Modal } from './Modal';

export interface ConfirmarProps {
    abierto: boolean;
    titulo: ReactNode;
    /** Explica la consecuencia («Se liberará el espacio de ana@gmail.com y se perderá su venta.»). */
    children?: ReactNode;
    textoConfirmar?: string;
    textoCancelar?: string;
    /** 'peligro' (por defecto) para borrar; 'primario' para confirmaciones que no destruyen nada. */
    variante?: 'peligro' | 'primario';
    /** Mientras la petición está en curso: deshabilita y muestra el indicador en el botón de confirmar. */
    cargando?: boolean;
    alConfirmar: () => void;
    alCancelar: () => void;
}

/**
 * Diálogo de confirmación. Úsalo SIEMPRE antes de borrar.
 *
 *   const [porBorrar, setPorBorrar] = useState<Cuenta | null>(null);
 *   const [borrando, setBorrando] = useState(false);
 *   <Confirmar abierto={porBorrar !== null} titulo="¿Eliminar la cuenta?" cargando={borrando}
 *       alCancelar={() => setPorBorrar(null)}
 *       alConfirmar={() => router.delete(`/cuentas/${porBorrar!.id}`, {
 *           preserveScroll: true, onStart: () => setBorrando(true), onFinish: () => { setBorrando(false); setPorBorrar(null); } })}>
 *       Se eliminará {porBorrar?.email} con todos sus clientes.
 *   </Confirmar>
 */
export function Confirmar({ abierto, titulo, children, textoConfirmar = 'Eliminar', textoCancelar = 'Cancelar', variante = 'peligro', cargando = false, alConfirmar, alCancelar }: ConfirmarProps) {
    return (
        <Modal
            abierto={abierto}
            alCerrar={alCancelar}
            titulo={titulo}
            descripcion={children}
            tamano="sm"
            rol="alertdialog"
            bloqueado={cargando}
            pie={
                <>
                    <Boton variante="fantasma" onClick={alCancelar} disabled={cargando} data-autofocus>
                        {textoCancelar}
                    </Boton>
                    <Boton variante={variante} onClick={alConfirmar} cargando={cargando}>
                        {textoConfirmar}
                    </Boton>
                </>
            }
        />
    );
}
