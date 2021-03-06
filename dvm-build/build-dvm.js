process.env.NODE_ENV = 'production'

var ora = require('ora')
var rm = require('rimraf')
var path = require('path')
var chalk = require('chalk')
var webpack = require('webpack')
var envConfig = require('./build-settings')
var webpackConfig = require('./webpack/webpack.dvm.prod.conf')

var spinner = ora('building for production...')
spinner.start()

var _resolve
const readyPromise = new Promise(resolve => {
  _resolve = resolve
})

rm(path.join(envConfig.build.assetsRoot, envConfig.build.assetsSubDirectory), err =>
{
	if (err) throw err
	webpack(webpackConfig, function(err, stats)
	{
		spinner.stop()
		if (err) throw err
		console.log(stats.toString(
		{
			colors: true,
			modules: false,
			children: false,
			chunks: false,
			chunkModules: false
		}) + '\n\n')

		if (stats.hasErrors())
		{
			console.log(chalk.red('  Build failed with errors.\n'))
			process.exit(1)
		}

		console.log(chalk.cyan('  Build complete.\n'))
		console.log(chalk.yellow(
			'  Tip: built files are meant to be served over an HTTP server.\n' +
			'  Opening index.html over file:// won\'t work.\n'
		))

		_resolve()
	})
})

module.exports = {
	ready: readyPromise
}
