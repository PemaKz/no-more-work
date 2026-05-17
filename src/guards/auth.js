const { Guard } = require('zyket');

/**
 * Guard para event handlers (no para connection — el connection handler
 * hace su propia auth inline porque zyket no await los guards de conexión).
 *
 * Asume que el connection handler ya rellenó socket.data.user. Si falta,
 * bloquea el evento.
 *
 * Uso en un handler:
 *   class MyHandler extends Handler {
 *     guards = ['auth'];
 *     // ...
 *   }
 */
module.exports = class AuthGuard extends Guard {
  async handle({ socket }) {
    if (!socket?.data?.user) {
      throw new Error('Not authenticated');
    }
  }
};
