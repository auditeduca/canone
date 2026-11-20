import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {JornadaServidor} from './JornadaServidor';
import '../brand/tokens.css';
import '../brand/base.css';
import '../brand/primitives.css';
import '../brand/layout.css';
createRoot(document.getElementById('root')!).render(<StrictMode><JornadaServidor/></StrictMode>);
