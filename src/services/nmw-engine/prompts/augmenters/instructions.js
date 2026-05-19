/**
 * Augmenter parametrizable de "instrucciones" — la sección del prompt
 * que le dice al agente QUÉ debe hacer en este mode. Cada mode pasa su
 * propio texto al `factory()` y obtiene una función augmenter lista para
 * apilar en su array de prompt.
 *
 * Esto centraliza el patrón "bloque de instrucciones por mode" sin que
 * cada mode tenga que inventar su propio mini-augmenter.
 */
module.exports = function factory(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('instructions augmenter requires a non-empty string');
  }
  return function instructions() {
    return text;
  };
};
