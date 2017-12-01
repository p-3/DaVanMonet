const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const dvmConfig = require('../utils/load-config').dvmConfig();

module.exports = function(chunks)
{
    console.log(chalk.magenta(">> Creating target index file"));
    
    let targetIndex = { items: [] };
    Object.keys(chunks).forEach(target => targetIndex.items.push(path.posix.join(dvmConfig.directories.css_subDir, target)));
    // Save index to file
    fs.writeJsonSync(path.resolve(process.cwd(), dvmConfig.directories.dist_web + '/' + dvmConfig.indexing.targetIndexOutput), targetIndex);
}
