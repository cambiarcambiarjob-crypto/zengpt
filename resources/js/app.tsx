import '../css/app.css';
import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';

createInertiaApp({
    title: (title) => (title ? `${title} · ZenGPT` : 'ZenGPT'),
    // Cada pantalla se carga por separado (import dinámico): el login no descarga el panel y viceversa.
    resolve: async (name) => {
        const pages = import.meta.glob('./pages/**/*.tsx');
        const page = pages[`./pages/${name}.tsx`];
        if (!page) throw new Error(`Pantalla no encontrada: ${name}`);
        return (await page()) as never;
    },
    setup({ el, App, props }) {
        createRoot(el).render(<App {...props} />);
    },
    progress: { color: '#8b5cf6' },
});
