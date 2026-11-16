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
    // Lo que cuesta cada cuenta (pesos). A cada espacio vendido se le carga la parte proporcional (costo ÷ capacidad)
    // y se descuenta del neto del vendedor, igual que la publicidad.
    'costo_cuenta' => 117,
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
            ['titulo' => 'Gemini 4 Argon', 'texto' => 'El modelo más potente de Google para ideas, creación, análisis y respuestas.'],
            ['titulo' => '5 TB en Drive y Gmail', 'texto' => 'Espacio de sobra para tus archivos, fotos y correos.'],
            ['titulo' => 'Imágenes ilimitadas', 'texto' => 'Genera y edita imágenes con IA sin límite.'],
            ['titulo' => 'Generación de videos', 'texto' => 'Crea videos a partir de una idea o una foto.'],
            ['titulo' => 'Análisis inteligente de datos', 'texto' => 'Sube hojas de cálculo y documentos y obtén respuestas al instante.'],
            ['titulo' => 'Tu propio espacio', 'texto' => 'Entras con tu Gmail: nadie ve tus archivos ni tus conversaciones.'],
        ],
    ],
];
