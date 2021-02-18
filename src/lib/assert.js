export default function assert(test, message = 'Assertion failed') {
  if (!test) {
    throw new Error(message);
  }
}

export function assertVar(name) {
  assert(name, 'empty name param to assertVar function');
  assert(process.env[name], `${name} environment variable must be set`);
}
