<?php

namespace App\Exceptions;

use RuntimeException;

/** Todas las pantallas del visor están en uso por otras cuentas (cada visor abierto ocupa una). */
class VisorOcupado extends RuntimeException
{
    /** @param  list<string>  $ocupadas  correos de las cuentas que tienen su visor abierto */
    public function __construct(public readonly array $ocupadas = [])
    {
        $lista = $ocupadas !== [] ? ' ('.implode(', ', $ocupadas).')' : '';

        $cuantas = count($ocupadas) === 1 ? 'La pantalla del visor está' : 'Las '.(count($ocupadas) ?: '').' pantallas del visor están';

        parent::__construct(str_replace('  ', ' ', $cuantas).' en uso'.$lista.': cierra alguno de esos visores y vuelve a intentar.');
    }
}
