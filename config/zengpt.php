<?php

/*
| Reglas del negocio de ZenGPT. Todo el dinero se guarda en centavos.
*/
return [
    // Espacios (clientes) por cuenta.
    'capacidad' => 5,
    // Meses que dura una cuenta (Gmail) desde su fecha de inicio.
    'meses_cuenta' => 3,
    // Precios sugeridos en pesos; además se puede capturar uno personalizado.
    'precios' => [200, 400, 500],
    // Porcentaje del socio (Christian) sobre la ganancia después de publicidad.
    'porcentaje_socio' => 10,
    // Porcentaje del vendedor sobre lo que queda después del socio (el resto es del dueño).
    'porcentaje_vendedor' => 50,
    // Días para avisar que una cuenta está por vencer.
    'dias_aviso' => 14,
    'zona' => 'America/Chihuahua',
];
