const WorkerPlugin = require('worker-plugin');

module.exports = {
  transpileDependencies: [
    "vuetify"
  ],
  configureWebpack: {
    plugins: [
      new WorkerPlugin()
    ]
  },
  outputDir: "docs",
  publicPath: process.env.NODE_ENV === 'production'  ? '/jscara-console/' : '/'
}