//* @ignore */
f0xy.define("f0xy", {

	/**
	* The f0xy Base Class
	* Classical JavaScript Inheritance (or an attempt thereof)
	* f0xy.Class is the ONLY Class to extend this directly, do not directly extend this Class.
	* Largely taken from: http://ejohn.org/blog/simple-javascript-inheritance/
	* @ignore */

	__BaseClass__ : (function() {

		/*
			Attempts to shallow copy objects, so as to not have a bunch of references lying around in object instances
			Otherwise, it is bad news bears doing something like this.nArray.push() in a Class method
			because it modifies nArray on prototype, and thus any other instances of said Class
		*/
		var _copy = function (obj) {
			var i, attr, c;

			// Null, undefined, number, boolean, string, function all get returned immediately, no need to copy them.
			if (!obj || typeof obj !== "object") {
				return obj;
			}

			if (obj instanceof Date) {
				return new Date().setTime(obj.getTime());
			}

			if (obj instanceof Array) {
				return obj.concat();
			}

			if (typeof obj === "object") {
				c = {};
				for (attr in obj) {
					if (obj.hasOwnProperty(attr)) {
						c[attr] = obj[attr];
					}
				}
				return c;
			}
			// If it fails, just return the original object.
			return obj;
		};

		// Checks the function contents to see if it has a reference to __super
		var _doesCallSuper = /xyz/.test(function(){xyz;}) ? /\b__super\b/ : /.*/;

		/** @ignore */
		var _baseClass = function(){;}

		_baseClass.__isDefined = true;

		/** @ignore */
		_baseClass.__extend = function(obj) {

			// By passing "__no_init__" as the first argument, we skip calling the constructor and other initialization;
			var _proto = new this("__no_init__");
			var _perInstanceProps = {};
			var _this = this;

			// Copy the object's properties onto the prototype
			for(var name in obj) {

				// If we're overwriting an existing function that calls this.__super, do a little super magic.
				if(typeof obj[name] == "function" && typeof _this.prototype[name] == "function" && _doesCallSuper.test(obj[name])){
					_proto[name] = (function(name, fn){
						return function() {
							var tmp = this.__super;

							// Reference the prototypes method, as super temporarily
							this.__super = _this.prototype[name];

							var ret = fn.apply(this, arguments);

							// Reset this.__super
							this.__super = tmp;

							return ret;
						};
					})(name, obj[name]);
				}
				else{
					_proto[name] = obj[name];
				}

				/*
					If it's an array or an object, we need to make a per instance copy of these values, so as to not affect other
					instances when dealing with Arrays or Objects.
				*/
				if (typeof obj[name] === "object" && name.indexOf("__") !== 0) {
					_perInstanceProps[name] = obj[name];
				}
			};

			var _class = function() {
				
				if(arguments[0] !== "__no_init__"){

					/*
						Handy for referencing dependencies. If a Class requires com.example.Test, then you can reference said class
						in any method by this.__imports.Test;

						This method is preferred over this.use_dependencies(), as you have to explicitly call this.unuse_dependencies()
						to be responsible, at the end of every method.
					*/
					if(!_class.prototype.hasOwnProperty("__imports")){
						this.__imports = f0xy.use(this.__dependencies, {});
					}

					if(!obj.__isSingleton){

						for(var attr in _perInstanceProps) {
							this[attr] = _copy(_perInstanceProps[attr]);
						};
					}

					// All real construction is actually done in the init method
					return this.init.apply(this, arguments);
				}
			};

			// Set the prototype and Constructor accordingly.
			_class.prototype = _proto;
			//* @ignore */
			_class.constructor = _class;

			// Expose the extend method
			//* @ignore */
			_class.__extend = _baseClass.__extend;

			/*
				Custom f0xy properties, anything beginning with an __ on a Class or instance, is populated and used by f0xy.
				The "__" prefix is used to avoid naming conflictions with developers, and allows
				us to not have to impose a list of reserved words on developers.
			*/
			_class.__isDefined = true;

			if(obj.__isSingleton) {
				_class.__isSingleton = obj.__isSingleton;
			}

			if(obj.__ns) {
				_class.__ns = obj.__ns;
			};
			
			if(obj.__nsID) {
				_class.__nsID = obj.__nsID;
			};
			
			if(obj._class) {
				_class._class = obj._class;
			};

			if(obj.__dependencies) {
				_class.__dependencies = obj.__dependencies;
			};

			return _class;
		};
		
		return _baseClass;

	})()
});