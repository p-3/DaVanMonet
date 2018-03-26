var md = require('markdown-it')();
import Loader from '@/src/modules/loader';
import DataStructureParser from '@/src/modules/dataStructureParser';

// IE Polyfills for fetch and promise APIs
import "isomorphic-fetch";
import promise from 'es6-promise';
promise.polyfill();

export default class PageLoader
{
	constructor(configuration = {})
	{
		this._state =
		{
			dataLoaded : false
		};
		this._projectConfig = {};
		this._contentindex = {};
		this._navigation = [];
		this._indexLookup = {};
		this._navigationLookup = {};
		this._targetindex = {};
		this._pageDataSchema = {};
		this.dataStructureParser = new DataStructureParser();
		
		this._configuration = {
			"sourceDirectory" : "",
			"groupNavigationalItemsByKey":""
		};
		Object.assign(this._configuration, configuration);
	}

	isType(val, type)
	{
		return (typeof val === type && (type !== "string" || (type === "string" && val.length > 0)));
	}

	async loadData()
	{
		
		if(this._state.dataLoaded === false)
		{
			await Loader.LoadData();
			
			
			this._projectConfig = Loader.ProjectConfig;
			this._contentindex = Loader.ContentIndex;
			this._targetindex = Loader.TargetIndex;
			
			this._indexLookup = await this.dataStructureParser.createIndexLookup();
			this._navigationLookup = await this.dataStructureParser.createIndexNavigationLookup();
			
			this._pageDataSchema = require('../../../dvm-build/schema/pagedata-schema-' + this._projectConfig.project_info.pagedata_schemaversion);
			if(typeof this._pageDataSchema !== "function")
			{
				console.error("Unable to load Page Data schema for version " + this._projectConfig.project_info.pagedata_schemaversion);
			}
			this._state.dataLoaded = true;
		}
	}

	async getPage(href)
	{
		var base = this;
		await this.loadData();
		if(href.indexOf('/') === 0)
		{
			href = href.substr(1);
		}
		href = decodeURI(href);
		let pageData =
		{
			"id":"",
			"Title":"",
			"Preamble":"",
			"ComponentItems":[],
		};
		let indexData = this._indexLookup[href];
		let navigationalData = this._navigationLookup[href];


		if(typeof indexData !== "undefined")
		{
			var variants = [];
			// Structure only contains one file.
			if(indexData["type"] === "file")
			{
				variants.push(indexData);
			}
			else if(typeof navigationalData["variants"] === "object" && navigationalData["variants"].length > 0)
			{
				let matchOnKey = "guid";
				let variantIds = navigationalData["variants"].map(x => x[matchOnKey]);
				variants = indexData["items"].filter(x => variantIds.indexOf(x[matchOnKey]) !== -1);
			}
			//This variable is what we use to match a the MD files with what is contained in the navigational structure
			pageData.id = navigationalData["guid"];
			if(pageData.id === null && typeof navigationalData["componentid"] === "string")
			{
				pageData.id = navigationalData["componentid"];
			}

			pageData.Title = navigationalData["title"];
			
			await variants.forEach(async (variant, i) =>
			{
				
				let variantContent =
				{
					"id":variant["guid"],
					"componentid":variant["componentid"],
					"variantid":variant["variantid"],
					"Title":variant["title"],
					"private":variant["private"] === true,
					"Content":"",
					"States":[],
					"requirejs":""
				};
				let filepath = variant["shortpath"];
				
				// Load .md file contents
				let markdownContent = await base.loadMDFile(filepath);
				let cleanedMarkdown = "";

				//Extract code snipplets from markdown
				if(this._projectConfig.project_info.pagedata_schemaversion === "1.0")
				{
					let snipplets = base.dataStructureParser.getCodeSnipplets(markdownContent, variant);
					if(snipplets.length > 0)
					{
						//Add additional information to each state (Set by the indexing metadata)
						if(typeof variant["requirejs"] === "string")
						{
							snipplets.forEach(snipplet => snipplet["requirejs"] = variant["requirejs"])
						}
						
						variantContent.States = variantContent.States.concat(snipplets);
					}

					// Clean from metadata, (states?) etc.
					cleanedMarkdown = base.dataStructureParser.cleanMarkdown(markdownContent, { removeMetadata : true, removeSnipplets : true });
				}
				if(this._projectConfig.project_info.pagedata_schemaversion === "2.0")
				{
					cleanedMarkdown = base.dataStructureParser.cleanMarkdown(markdownContent, { removeMetadata : true});
				}
				// Parse what's left from the markdown files
				let parsedMarkdown = md.render(cleanedMarkdown);

				//Removes H1 etc.
				let adjustedContent = base.dataStructureParser.adjustMarkdownMarkup(parsedMarkdown);
				variantContent.Content = adjustedContent;
				
				pageData["ComponentItems"].push(variantContent);
			});
			//console.log('Page rendered at ' + (new Date()).toString(),pageData)
		}
		const validatedPageData = new this._pageDataSchema(pageData);

		if(validatedPageData.isErrors())
        {
            console.error("Configuration Schema errors: ")
            
            validatedPageData.getErrors().forEach(e =>
                console.error(e.fieldSchema.name + ": " + e.errorMessage));

            throw new Error("Configuration Schema Error");
        }
		return pageData;
		
	}



	async loadMDFile(filepath)
	{
		await this.loadData();
		const requestbase = "//" + window.location.host + "/";
		const fullpath = requestbase + this._projectConfig.directories.src + "/" + filepath + '.md';
		const filereq = await fetch(fullpath);
		const filecontent = await filereq.text();
		return filecontent;
	}

	async getNavigation()
	{
		this._navigation = await this.dataStructureParser.getNavigation();
		return this._navigation;
	}
}
