module.exports = function(_gruntbase_) {

	let mainconfig = _gruntbase_.mainconfig;

	return {
		options: {
			// Override defaults here 
		},
		onsitepreview: {
			options: {
			script: mainconfig.directories.onsitepreview + '/server.js'
			}
		}
	};
}