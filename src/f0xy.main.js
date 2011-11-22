
/**

@fileOverview

<h4>f0xy - AMD inspired Classy JavaScript</h4>

<p>Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:</p>

<p>The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.</p>

<p>THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.</p>
*/


/**
*	Global Static f0xy Class with static methods.
*	
*	@namespace
*/

var f0xy = (function(root){

	"use strict";

	// If Array.indexOf is not defined, let's define it.
    Array.prototype.indexOf = Array.prototype.indexOf || function(o,i){for(var j=this.length,i=i<0?i+j<0?0:i+j:i||0;i<j&&this[i]!==o;i++);return j<=i?-1:i}

	// If Function.bind is not defined, let's define it.
	Function.prototype.bind = Function.prototype.bind || function(){
		var __method = this, args = Array.prototype.slice.call(arguments), object = args.shift();
		return function(){
			var local_args = args.concat(Array.prototype.slice.call(arguments));
			if (this !== _root) local_args.push(this);
			return __method.apply(object, local_args);
		}
	}

	var _classMappings = [];

	var _separator = ".";
	var _class_path = "";

	var _root = root;
	var _origRootNS = {};
	var _initialized = false;

	var _loadQueues = [];
	var _extendQueue = [];

	var _waitID = null;
	var _waitingForLoad = [];
	var _requestedFiles = [];
	var _loadedClasses = [];
	
	/************* HELPER METHODS ***************/

	var isArray = Array.isArray || function(obj){
		return toString.call( obj ) == '[object Array]';
	}

	var isObject = function(obj){
		return Object(obj) === obj;
	}

	var isString = function(s) {
		return typeof s == 'string';
	}

	var isFunction = function(fn){
		return toString.call(fn) == '[object Function]';
	}

	var strToArray = function(s){
		return (isString(s)) ? [s] : s;
	}

	var concatArray = function(a, b){
		b = b || [];
		return ((a) ? a : []).concat(b);		
	}

	/** @private */
	var _checkExtendQueue = function(){
		
		var extendHappened = false;

		for(var i = _extendQueue.length - 1; i >= 0; i --){
			
			var packageArray = _extendQueue[i].split(_separator);
			var className	= packageArray.splice(packageArray.length-1, 1);
			var namespace = packageArray.join(_separator);
			
			var packageObj = _f0xy.get(namespace, false);
			var obj = packageObj[className];

			if(obj.toExtend){
				var superClass = _f0xy.get(obj.extendedFrom, false);
				if(superClass.isClass){
					
					var dependencies = obj.dependencies;
					var scID = obj.extendedFrom;

					obj.toExtend = false;
					delete obj.toExtend;
					
					packageObj[className] = superClass.extend(obj);

					extendHappened = true;

					_extendQueue.splice(i, 1);

				}
			}
		}
		if(extendHappened && _extendQueue.length > 0){
			_checkExtendQueue();
		}
	}

	/** @private */
	var _checkLoadQueues = function(){
		for(var i = _loadQueues.length -1; i >= 0; i --){
			var queue = _loadQueues[i];
			var dependenciesLoaded = true;
			
			for(var j = 0; j < _loadQueues[i].classes.length; j ++){

				var obj = _f0xy.get(_loadQueues[i].classes[j], false);

				if(!obj.isClass){dependenciesLoaded = false;}				
				else if(obj.dependencies){
					for(var k = 0; k < obj.dependencies.length; k ++){
						if(_loadedClasses.indexOf(obj.dependencies[k]) === -1){
							dependenciesLoaded = false;
							break;
						}
					}
				}
				if(!dependenciesLoaded){break;}
			}

			if(dependenciesLoaded){				
				if(queue.callback){
					// 0 ms delay to make sure queue.callback does not get called prematurely, in some instances.
					setTimeout(queue.callback, 0);
				}
				_loadQueues.splice(i, 1);
			}
		}
	}

	var _checkWaitQueue = function(){
		if(_waitID){clearTimeout(_waitID);}
		
		for(var i = 0; i < _waitingForLoad.length; i ++){
			var obj = _waitingForLoad[i];
			obj.elapsed += 50;

			if(_f0xy.isClass(obj.class)){
				obj.script.onload();
			}
			else if(obj.elapsed >= _f0xy.errorTimeout){
				obj.script.onerror();
			}
		}

		if(_waitingForLoad.length > 0){
			_waitID = setTimeout(_checkWaitQueue, 50);
		}
	}

	/**
	* Does all the loading of JS files
	*
	* @param		files 		String or array of the files to be loaded.
	* @param		classes 		The classes that match up to the files to be loaded.
	* @param		callback 	Callback function to call once all files have been loaded
	* @private 
	*/
	
	var _load = function(files, classes, callback){

		// Loaded Count
		var lc = 0;
		var doc = document;
		var body = "body";

		// If files is a String, create an array
		files = strToArray(files);

		function inject(f, c){
			if(_requestedFiles.indexOf(f) === -1){

				if(!doc[body]){return setTimeout(inject, 0, f, c);}
				
				var injectObj = {};
				injectObj.file = f;
				injectObj.class = c;
				injectObj.elapsed = 0;

				_requestedFiles.push(f);			
				_waitingForLoad.push(injectObj);

				var script = doc.createElement("script");
		     	script.async = "async";
		      script.src = f;

				injectObj.script = script;

		      script.onreadystatechange = script.onload = function(e){

		      	if(_f0xy.isClass(c)){
						_loadedClasses.push(injectObj.class);
						lc++;
			          if(lc >= files.length && callback){
			          	_checkExtendQueue();
			          	_checkLoadQueues();
			         	setTimeout(callback, 50);
			          }

			        injectObj.script.onload = script.onreadystatechange = null;
			        _waitingForLoad.splice(_waitingForLoad.indexOf(injectObj), 1);
			   	}
		      };

		      script.onerror = function(e){
		      	lc++;
					_waitingForLoad.splice(i,1);
					throw new Error(injectObj.class + " failed to load. Attempted to load from file: " + injectObj.file);
		        injectObj.script.onerror = null;
		        _waitingForLoad.splice(_waitingForLoad.indexOf(injectObj), 1);	
		      }
		      
		      // Append the script to the document body
		   	doc[body].appendChild(script);
			}
		}

		for(var i = 0; i < files.length; i ++){
			inject(files[i], classes[i]);
		}

		_waitID = setTimeout(_checkWaitQueue, 50);
	}

	/**
	* Used by f0xy.get() and f0xy.define(). 
	* Get the namespace/Class, or creates it if it does not exist. Also optionally creates Objects in the specified namepsace.
	*
	* @public
	* @param			{String|Object}	identifier			The fully qualified namespace.
	* @param			{Boolean}			autoCreate			Whether or not to create a blank object if the namespace does not yet exist.
	* @param			{Object}				[classes]			An object of class definitions which will be added to the namespace.
	* @returns		{Object}										The object that represents the fully qualified namespace passed in as the first argument.
	* @private
	*/

	var _namespace = function(identifier, autoCreate, classes){

		classes = classes || false;
		var ns = _f0xy.ns;
		if(identifier != '' && !isObject(identifier) && !isFunction(identifier)){
			var parts = identifier.split(_separator);

			if(parts[0] === "f0xy"){
				ns = _f0xy;
				parts.splice(0,1);
			}

			for (var i = 0; i < parts.length; i++) {
				if(!ns[parts[i]]){
					if(autoCreate){
						ns[parts[i]] = {};
					}
					else{
						return false;
					}
				}
				ns = ns[parts[i]];
			}
		}
		else if(identifier != ""){ns = identifier;}

		if(classes !== false){

			if(!classes.require){classes.require = [];}
			
			for(var className in classes){				
				
				var qualifiedName = identifier + _separator + className;

				if(classes[className].extendedFrom){
					classes.require.push(classes[className].extendedFrom);
				}

				if(classes[className].toExtend){					
					if(_extendQueue.indexOf(qualifiedName) === -1){
						_extendQueue.push(qualifiedName);
					}
				}

				if(className !== "require"){
					
					var c = classes[className];

					c.nsID = identifier;
					c.ns = ns;
					c.className = className;

					if("require" in classes && classes.require.length > 0){
						c.dependencies = concatArray(c.dependencies, classes.require);
						_f0xy.require(classes.require);
					}

					if(_f0xy.isClass(c) && c.prototype){
						c.prototype.nsID = identifier;
						c.prototype.ns = ns;
						c.prototype.className = className;

						if("require" in classes && classes.require.length > 0){
							c.prototype.dependencies = concatArray(c.prototype.dependencies, classes.require);
						}
					}

					ns[className] = c;
				}
			}
		}

		return ns;
	}		

	/************* END HELPER METHODS ***************/	


	/**
	* @exports _f0xy as f0xy 
	* @class
	*/
	var _f0xy = {};

	// Set the root namespace
	_f0xy.ns = {};

	// Set the default error timeout to 10 seconds.
	_f0xy.errorTimeout = 1e4;

	/**
	* Configure f0xy. Call to update the base class path, or to change the default separator (".").
	* 
	* @public
	* @param		 {String}			[separator="."]		Namespace separator
	* @param		 {String}			[class_path="js/"]	The root path of all your classes. Can be absolute or relative.
	*/

	_f0xy.configure = function(class_path, separator, useRootNS){
		_class_path = class_path || _class_path;
		_separator = separator || _separator;
		_class_path = (_class_path.lastIndexOf("/") === _class_path.length-1) ? _class_path : _class_path + "/";

		if(!_initialized){
			if(useRootNS !== false){
				for(var i in _f0xy.ns){
					if(!_root[i]){
						_root[i] = _f0xy.ns[i];
					}
				}
				_f0xy.ns = _root;
			}
			_initialized = true;
		}
	}

	/**
	* Gets the object by it's fully qualified identifier.
	*
	* @public
	* @param			{String}				identifier			The identifier to get
	* @returns		{Object|Boolean}							The object that represents the identifier or False if it has not yet been defined.
	*/

	_f0xy.get = function(identifier){
		return _namespace(identifier, false);
	}

	/**
	* Defines Classes under the given namespace.
	*
	* @public
	* @param			{String}				identifier			The namespace to define the Classes under.
	* @param			{Object}				[classes]			An object of class definitions which will be added to the namespace
	* @returns		{Object}										The object that represents the namespace passed in as the first argument.
	*/
	_f0xy.define = function(identifier, classes){
		var r = _namespace(identifier, true, classes);
		_checkExtendQueue();
		_checkLoadQueues();
		return r;
	}

	/**
	* Gets the URL for a given identifier.
	*
	* @public
	* @param		 	{String}			identifier			The fully qualified name to look up.
	* @returns		{String}									The URL of the file that maps to the fully qualified name.
	*/

	_f0xy.getURL = function(identifier) {
		
		if(_classMappings[identifier]){
			return _classMappings[identifier];
		}
		var regexp = new RegExp('\\' + _separator, 'g');
		return _class_path + identifier.replace(regexp, '/') + '.js';
	}

	/**
	* Checks to see whether the given fully qualified name or Object is a f0xy class. (Checks for .isClass)<br>
	* NOTE: Classes that have not yet loaded all of their dependencies, will return FALSE for this check.
	*
	* @public
	* @param			{String|Object}		identifier			The fully qualfied class name, or an Object.
	* @returns		{Boolean}										Whether or not this is a Class.
	*/

	_f0xy.isClass = function(identifier){
		identifier = (!isObject(identifier) && !isFunction(identifier)) ? _namespace(identifier, false) : identifier;
		return (identifier) ? identifier.isClass : false;
	}

	/**
	* Extends a given class asynchronously.
	*
	* @public
	* @param			{String}			identifier			The fully qualified name of the Class you want to extend.
	* @param			{Object}			obj					A new Class Object
	* @returns		{Object}									The extended Class, or, if still waiting on dependencies, the original Object with a few more properties for internal f0xy use.
	*/ 

	_f0xy.extend = function(identifier, obj){
		
		// If the Class exists and is a f0xy class, then return the extended object.
		if(_f0xy.isClass(identifier)){
			obj = _f0xy.get(identifier).extend(obj);			
		}
		else{
			obj.toExtend = true;
		}

		obj.extendedFrom = identifier;

		return obj;
	}

	/**
	* Imports properties from the specified namespace to the global space (ie. under _f0xy.ns, or _root)
	* This is only meant to be used as a utility, and for temporary purposes. Please clean up with f0xy.unuse()
	* You are responsible for not polluting the global namespace.
	*
	* By calling f0xy.use("com.test.Example"), you will be able to refer to com.test.Example as just Example.
	* By calling f0xy.use("com.test"), you will be able to refer to com.test.Example as just test.Example.
	* 
	* Identifiers can contain the* wildcard character as its last segment (eg: com.test.*) 
	* which will import all Classes under the given namespace.
	*
	* @see 		f0xy.unuse
	* @public
	* @param	 	{String|Array}		identifiers		The fully qualfiied name(s) to import into the global namespace.
	*/
	 
	_f0xy.use = function(identifiers){
		
		f0xy.unuse(identifiers);

		identifiers = strToArray(identifiers);

		for (var i = 0; i < identifiers.length; i++) {
			
			var identifier = identifiers[i];	
			
			var parts = identifier.split(_separator);
			var target = parts.pop();
			var ns = _f0xy.get(parts.join(_separator), false);
			
			if (target === '*') {
				// imports all Classes/namespaces under the given namespace
				for(var objectName in ns){
					_origRootNS[objectName] = (_f0xy.ns[objectName]) ? _f0xy.ns[objectName] : null;
					_f0xy.ns[objectName] = ns[objectName];
				}
			}
			else{
				// imports only the specified Class/namespace
				if(ns[target]){
					_origRootNS[target] = (_f0xy.ns[target]) ? _f0xy.ns[target] : null;
					_f0xy.ns[target] = ns[target];
				}
			}
		}
	}


	/**
	* Clears all temporary global namespacing mappings created by f0xy.use(). This method has no arguments, it clears all
	* temporary namespaces.
	* 
	* @see f0xy.use
	*
	* @public
	*/

	_f0xy.unuse = function(){

		for(var prop in _origRootNS){
			_f0xy.ns[prop] = _origRootNS[prop];
			if(_f0xy.ns[prop] === null){
				delete _f0xy.ns[prop];
			}
		}
	}
	

	/**
	* Tells f0xy that filePath provides the class definitions for these classes.
	* Useful in cases where you group specific things into minfiied js files.
	*
	* f0xy.provides can load the file right away, by passing doLoad as true, and a callback function.
	* Otherwise, it just maps the classes to the specified filePath for any subsequent calls to f0xy.require()
	*
	* @public
	* @param		{String}					file					The path of a JS file.
	* @param	 	{String|Array}			classes				Fully qualfiied name(s) of class(es)
	* @param		{Boolean}				[doLoad=false]		Whether or not to subsequently call f0xy.require()
	* @param 	{Function}				[callback=null]	If doLoad=true, the callback function to call once the file has been loaded.
	*/

	_f0xy.provides = function(file, classes, doLoad, callback){

		// If classes is a String, create an array
		classes = strToArray(classes);

		// If the file is not absolute, prepend the class_path
		file = (!new RegExp("(http://|/)[^ :]+").test(file)) ? _class_path + file : file;

		for(var i = 0; i < classes.length; i ++){
			_classMappings[classes[i]] = file;
		}

		if(doLoad){
			_f0xy.require(classes, callback);
		}
	}

	/**
	* Asyncrhonously loads in js files for the classes specified.
	* If the classes have already been loaded, or are already defined, the callback function is invoked immediately.
	*
	* @public
	* @param	 {String|Array}		classes					The fully qualified names of the class(es) to load.
	* @param	 {Function}				callback			The function to call once all classes (and their dependencies) have been loaded.
	*/

	_f0xy.require = function(identifiers, callback){

		if(!_initialized){f0xy.configure();}

		identifiers = strToArray(identifiers);
		
		var files = [];
		var classes = [];

		for(var i = 0; i < identifiers.length; i ++){

			var identifier = identifiers[i];
			var file = _f0xy.getURL(identifier);

			if((_requestedFiles.indexOf(file) === -1) && !_f0xy.get(identifier)){	
				files.push(_f0xy.getURL(identifier));
				classes.push(identifier);
			}
		}

		if(files.length > 0){	
			
			_loadQueues.push({
				classes: classes,
				callback: callback
			});

			_load(files, classes, function(){					
					_checkExtendQueue();
					_checkLoadQueues();
			});
		}

		else{

			for(var i = 0; i < identifiers.length; i ++){
				var identifier = identifiers[i];

				if(_f0xy.get(identifier)){
					if(_loadedClasses.indexOf(identifier) === -1){
						_loadedClasses.push(identifier);
					}
				}
			}
			
			if(callback){
				callback.call();
			}
		}
	}

	return _f0xy;

})(this);
