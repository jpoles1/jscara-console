module.exports = {
  transpileDependencies: [
    "vuetify"
  ],
  configureWebpack: {
    
  },
  outputDir: "docs",
  publicPath: process.env.NODE_ENV === 'production'  ? '/jscara-console/' : '/'
}