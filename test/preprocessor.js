const ts = require('typescript');
const config = require('../tsconfig.json');
const { options } = ts.convertCompilerOptionsFromJson(config.compilerOptions, __dirname);

module.exports = {
  process(source, filename) {
    const result = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: { ...options, module: ts.ModuleKind.CommonJS, sourceMap: false },
    });
    return { code: result.outputText };
  },
};
