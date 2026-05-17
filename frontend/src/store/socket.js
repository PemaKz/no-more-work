import { io } from "socket.io-client";

const URL = import.meta.env.VITE_API_BASE || "http://localhost:3000";

let socketInstance = null;
let currentToken = null;
const subscribers = new Set();

function notify(value) {
  subscribers.forEach((fn) => fn(value));
}

/**
 * Conecta con el token de sesión actual. Si ya hay un socket con el mismo
 * token, devuelve la instancia existente (idempotente). Si el token cambió,
 * desconecta el anterior y crea uno nuevo.
 */
export function connectSocket(token) {
  if (!token) return null;
  if (socketInstance && currentToken === token) return socketInstance;
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
  currentToken = token;
  socketInstance = io(URL, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  notify(socketInstance);
  return socketInstance;
}

export function disconnectSocket() {
  if (!socketInstance) return;
  socketInstance.disconnect();
  socketInstance = null;
  currentToken = null;
  notify(null);
}

export function getSocket() {
  return socketInstance;
}

/**
 * Subscribe a cambios de la instancia del socket (creación / cambio de
 * token / disconnect). Notifica inmediatamente con el valor actual.
 * Devuelve una función para desuscribir.
 */
export function subscribeSocket(fn) {
  subscribers.add(fn);
  fn(socketInstance);
  return () => {
    subscribers.delete(fn);
  };
}
