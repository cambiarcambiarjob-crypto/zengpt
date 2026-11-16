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
            ['titulo' => '2 TB de almacenamiento', 'texto' => 'Espacio de sobra para Gmail, Google Drive y Google Fotos, sin borrar nada.'],
            ['titulo' => 'Gemini con los modelos más avanzados', 'texto' => 'Acceso a la versión Pro de Gemini para escribir, investigar, programar y crear imágenes.'],
            ['titulo' => 'Gemini en Gmail, Docs y más', 'texto' => 'La IA de Google dentro de las apps que ya usas: resume correos, redacta y organiza.'],
            ['titulo' => 'Investigación profunda y NotebookLM', 'texto' => 'Informes completos en minutos y más capacidad para estudiar tus propios documentos.'],
            ['titulo' => 'Herramientas creativas', 'texto' => 'Funciones de edición en Google Fotos y creación de videos con IA.'],
            ['titulo' => 'Tu cuenta sigue siendo tuya', 'texto' => 'Entras al grupo familiar con tu propio Gmail: nadie ve tus archivos ni tus correos.'],
        ],
    ],
];
