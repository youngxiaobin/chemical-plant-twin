import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function ver(name) {
  const json = JSON.parse(readFileSync(new URL(`../node_modules/${name}/package.json`, import.meta.url), 'utf8'));
  return json.version;
}

const report = {
  node: process.version,
  npm: process.env.npm_config_user_agent ?? null,
  declared: {
    react: pkg.dependencies.react,
    three: pkg.dependencies.three,
    vite: pkg.devDependencies.vite,
    typescript: pkg.devDependencies.typescript,
  },
  installed: {
    react: ver('react'),
    'react-dom': ver('react-dom'),
    three: ver('three'),
    vite: ver('vite'),
    typescript: ver('typescript'),
    '@vitejs/plugin-react': ver('@vitejs/plugin-react'),
  },
};

console.log(JSON.stringify(report, null, 2));
