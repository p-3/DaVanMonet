require('./check-versions')()

const envConfig = require('./build-settings')
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = JSON.parse(envConfig.dev.env.NODE_ENV)
}

const opn = require('opn')
const path = require('path')
const express = require('express')
const webpack = require('webpack')
const merge = require('webpack-merge');
const proxyMiddleware = require('http-proxy-middleware')
const webpackConfigDvm = require('./webpack/webpack.dvm.dev.conf')
const webpackConfigPL = require('./webpack/webpack.patternlibrary.dev.conf')
const webpackConfigProjectPL = require('./utils/load-config').getProjectPLConfig();
const dvm_config = require('./utils/load-config').dvmConfig();
const webpackConfig = [webpackConfigDvm, merge(webpackConfigPL,webpackConfigProjectPL)];

const dvmConfig = require('./utils/load-config').dvmConfig();

// Generate fresh contentindex.json
require('./utils/create-content-index')(dvm_config);

// default port where dev server listens for incoming traffic
const port = dvmConfig.env.devSitePort

// automatically open browser, if not set will be false
const autoOpenBrowser = !!dvmConfig.env.launchBrowser

// Define HTTP proxies to your custom API backend
// https://github.com/chimurai/http-proxy-middleware
const proxyTable = envConfig.dev.proxyTable

const app = express()
const compiler = webpack(webpackConfig)

const devMiddleware = require('webpack-dev-middleware')(compiler, {
  publicPath: "/",
  quiet: true
})

const hotMiddleware = require('webpack-hot-middleware')(compiler, {
  log: false,
  heartbeat: 2000
})

// force page reload when html-webpack-plugin template changes
compiler.plugin('compilation', function (compilation) {
  compilation.plugin('html-webpack-plugin-after-emit', function (data, cb) {
    hotMiddleware.publish({ action: 'reload' })
    cb()
  })
})

// proxy api requests
Object.keys(proxyTable).forEach(function (context) {
  var options = proxyTable[context]
  if (typeof options === 'string') {
    options = { target: options }
  }
  app.use(proxyMiddleware(options.filter || context, options))
})

// handle fallback for HTML5 history API
app.use(require('connect-history-api-fallback')())

// serve webpack bundle output
app.use(devMiddleware)

// enable hot-reload and state-preserving
// compilation error display
app.use(hotMiddleware)

// serve pure static assets
var staticPath = path.posix.join(envConfig.dev.assetsPublicPath, envConfig.dev.assetsSubDirectory)
app.use(staticPath, express.static('./dvm-app/static'))
app.use('/' + dvmConfig.directories.src, express.static(dvmConfig.directories.src_abs()))

// Add asset paths that are configured for dev access
dvmConfig.assets.toArray().filter(a => a.dev_access && typeof a.dev_access == "string").forEach( asset =>
{
  console.log('>> Setting up access path: ' + asset.dev_access + ' -> ' + path.resolve(process.cwd(), asset.src));
  app.use(asset.dev_access, express.static(path.resolve(process.cwd(), asset.src)));
});

const uri = 'http://localhost:' + port

var _resolve
const readyPromise = new Promise(resolve => {
  _resolve = resolve
})

// Start On Site Preview if enabled in config
if (dvmConfig.env.enableOnSitePreview)
{
  const ospServer = require('./onsitepreview');
  ospServer.startServer(app);
}

console.log('> Starting dev server...')
devMiddleware.waitUntilValid(() => {
  console.log('>> Listening at ' + uri + '\n')
  // when env is testing, don't need open it
  if (autoOpenBrowser && process.env.NODE_ENV !== 'testing') {
    opn(uri)
  }
  _resolve()
})

const server = app.listen(port)

module.exports = {
  ready: readyPromise,
  close: () => {
    console.log("Close server");
    server.close(function() { app = null; })
  }
}
