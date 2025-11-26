export default function (plop) {
  plop.setGenerator('plugin', {
    description: 'Generate a new plugin from template',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Plugin name (e.g., uniswap):',
        validate: (value) => {
          if (!value) return 'Plugin name is required';
          if (!/^[a-z0-9-]+$/.test(value)) {
            return 'Plugin name must contain only lowercase letters, numbers, and hyphens';
          }
          return true;
        },
      },
    ],
    actions: [
      {
        type: 'addMany',
        destination: 'plugins/{{name}}',
        base: 'plugins/_plugin_template',
        templateFiles: 'plugins/_plugin_template/**/*',
        globOptions: {
          dot: true,
          ignore: ['**/node_modules/**', '**/dist/**', '**/.DS_Store'],
        },
      },
      {
        type: 'modify',
        path: 'plugins/{{name}}/package.json',
        pattern: /"name": "@data-provider\/template"/,
        template: '"name": "@data-provider/{{name}}"',
      },
    ],
  });
}
