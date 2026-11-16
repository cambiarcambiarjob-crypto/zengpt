<?php

return [
    'required' => 'El campo :attribute es obligatorio.',
    'email' => 'El campo :attribute debe ser un correo válido.',
    'unique' => 'Ese valor de :attribute ya está registrado.',
    'date_format' => 'El campo :attribute no tiene una fecha válida.',
    'before_or_equal' => 'El campo :attribute no puede ser posterior a :date.',
    'after_or_equal' => 'El campo :attribute no puede ser anterior a :date.',
    'string' => 'El campo :attribute debe ser texto.',
    'integer' => 'El campo :attribute debe ser un número entero.',
    'numeric' => 'El campo :attribute debe ser un número.',
    'boolean' => 'El campo :attribute debe ser sí o no.',
    'array' => 'El campo :attribute no es válido.',
    'exists' => 'El :attribute seleccionado no es válido.',
    'confirmed' => 'La confirmación de :attribute no coincide.',
    'current_password' => 'La contraseña actual no coincide.',
    'regex' => 'El formato de :attribute no es válido.',
    'max' => [
        'numeric' => 'El campo :attribute no puede ser mayor que :max.',
        'string' => 'El campo :attribute no puede tener más de :max caracteres.',
        'array' => 'El campo :attribute no puede tener más de :max elementos.',
    ],
    'min' => [
        'numeric' => 'El campo :attribute debe ser al menos :min.',
        'string' => 'El campo :attribute debe tener al menos :min caracteres.',
        'array' => 'El campo :attribute debe tener al menos :min elementos.',
    ],
    'password' => [
        'letters' => 'La :attribute debe tener al menos una letra.',
        'mixed' => 'La :attribute debe tener mayúsculas y minúsculas.',
        'numbers' => 'La :attribute debe tener al menos un número.',
        'symbols' => 'La :attribute debe tener al menos un símbolo.',
        'uncompromised' => 'Esa :attribute apareció en una filtración de datos; elige otra.',
    ],
    'attributes' => [],
];
