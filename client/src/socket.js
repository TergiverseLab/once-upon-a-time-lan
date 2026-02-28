import { io } from 'socket.io-client';

// In dev: Vite proxy handles /socket.io → localhost:3000
// In production: same origin (served by Express)
const URL = import.meta.env.DEV ? undefined : window.location.origin;

const socket = io(URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

export default socket;
