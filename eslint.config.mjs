// eslint-config-next 16 ships native flat configs, so no FlatCompat bridge.
import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'design/**', 'docs/**', 'next-env.d.ts'] },
  ...coreWebVitals,
  ...typescript,
];

export default config;
