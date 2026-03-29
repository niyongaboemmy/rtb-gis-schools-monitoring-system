import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5175,
        strictPort: true,
        proxy: {
            '/file-server': {
                target: 'http://localhost:3002',
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/file-server/, ''); },
            },
        },
    },
});
