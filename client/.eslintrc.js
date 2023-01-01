module.exports = {
  env: {
    browser: true,
    es2022: true,
    node: true
  },

  parserOptions: {
    tsconfigRootDir: __dirname,
    sourceType: 'module',
    project: 'tsconfig.eslint.json',
    parser: '@typescript-eslint/parser'
  },

  extends: ['@nuxt/eslint-config', 'prettier'],

  rules: {
    'import/named': 'off',
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'space-before-function-paren': 'off',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }
    ],
    'no-useless-constructor': 'off',
    'vue/singleline-html-element-content-newline': 'off',
    'vue/multiline-html-element-content-newline': 'off',
    'vue/multi-word-component-names': 'off',
    'vue/require-default-prop': 'off',
    'vue/attribute-hyphenation': ['off', { ignore: ['custom-prop'] }],
    'vue/no-v-html': 'off',
    'vue/script-setup-uses-vars': 'off',
    'import/order': 'off',
    'import/namespace': 'off',
    'vue/html-self-closing': [
      'error',
      {
        html: {
          void: 'any'
        }
      }
    ]
  }
};
