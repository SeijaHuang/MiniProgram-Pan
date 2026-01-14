import http from 'http';
import app from './app';
import { initWebSocket } from './ws';

const PORT = Number(process.env.PORT) || 8080;

const server = http.createServer(app);

initWebSocket(server);

server.listen(PORT, () => {
    console.log(`server listening on ${PORT}`);
});
