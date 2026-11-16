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

    /*
    | Correo de invitación al grupo familiar que recibe cada cliente. Los textos se editan aquí.
    */
    'invitacion' => [
        'producto' => 'Google One Pro',
        'meses' => 12,
        'asunto' => 'Tu invitación a Google One Pro por 12 meses',
        'boton' => 'Adquiere Google One Pro por 12 meses',
        'beneficios' => [
            ['icono' => '☁️', 'titulo' => '2 TB de almacenamiento', 'texto' => 'Gmail, Drive y Fotos sin preocuparte por el espacio.'],
            ['icono' => '✨', 'titulo' => 'Gemini Pro', 'texto' => 'La IA más avanzada de Google para escribir, crear e investigar.'],
            ['icono' => '📧', 'titulo' => 'IA en Gmail y Docs', 'texto' => 'Resume correos, redacta y organiza en segundos.'],
            ['icono' => '🔎', 'titulo' => 'Investigación profunda', 'texto' => 'Informes completos y NotebookLM con más capacidad.'],
            ['icono' => '🎬', 'titulo' => 'Creación con IA', 'texto' => 'Edición avanzada en Fotos y videos generados con IA.'],
            ['icono' => '🔒', 'titulo' => '100 % privado', 'texto' => 'Usas tu propio Gmail: nadie ve tus archivos.'],
        ],
    ],
];
