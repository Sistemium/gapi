export default function assert(test, message = 'Assertion failed') {
  if (!test) {
    throw new Error(message);
  }
}
