!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var o;"undefined"!=typeof window?o=window:"undefined"!=typeof global?o=global:"undefined"!=typeof self&&(o=self),o.BackbonePouch=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var hasOwn = Object.prototype.hasOwnProperty;
var toString = Object.prototype.toString;
var undefined;

var isPlainObject = function isPlainObject(obj) {
	"use strict";
	if (!obj || toString.call(obj) !== '[object Object]' || obj.nodeType || obj.setInterval) {
		return false;
	}

	var has_own_constructor = hasOwn.call(obj, 'constructor');
	var has_is_property_of_method = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !has_own_constructor && !has_is_property_of_method) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for (key in obj) {}

	return key === undefined || hasOwn.call(obj, key);
};

module.exports = function extend() {
	"use strict";
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0],
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if (typeof target === "boolean") {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	} else if (typeof target !== "object" && typeof target !== "function" || target == undefined) {
			target = {};
	}

	for (; i < length; ++i) {
		// Only deal with non-null/undefined values
		if ((options = arguments[i]) != null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];

				// Prevent never-ending loop
				if (target === copy) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if (deep && copy && (isPlainObject(copy) || (copyIsArray = Array.isArray(copy)))) {
					if (copyIsArray) {
						copyIsArray = false;
						clone = src && Array.isArray(src) ? src : [];
					} else {
						clone = src && isPlainObject(src) ? src : {};
					}

					// Never move original objects, clone them
					target[name] = extend(deep, clone, copy);

				// Don't bring in undefined values
				} else if (copy !== undefined) {
					target[name] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};


},{}],2:[function(require,module,exports){
(function (global){
/*
 * backbone-pouch
 * http://jo.github.io/backbone-pouch/
 *
 * Copyright (c) 2013 Johannes J. Schmidt
 * Licensed under the MIT license.
 */

var extend = require('extend');

module.exports = (function () {

  'use strict';

  // Require Underscore, if we're on the server, and it's not already present.
  var _ = global._;
  if (!_ && (typeof require === 'function')) {
    _ = require('underscore');
  }

  var methodMap = {
    'create': 'post',
    'update': 'put',
    'patch':  'put',
    'delete': 'remove'
  };

  var BackbonePouch = {
    defaults: {
      fetch: 'allDocs',
      listen: false,
      options: {
        post: {},
        put: {},
        get: {},
        remove: {},
        allDocs: {},
        query: {},
        spatial: {},
        changes: {
          continuous: true
        }
      }
    },

    sync: function (defaults) {
      defaults = defaults || {};
      defaults = extend(BackbonePouch.defaults, defaults);

      var adapter = function(method, model, options) {
        options = options || {};
        options = extend(defaults, model && model.pouch || {}, options);

        // This is to get the options (especially options.db)
        // by calling model.sync() without arguments.
        if (typeof method !== 'string') {
          return options;
        }

        // ensure we have a pouch db adapter
        if (!options.db) {
          throw new Error('A "db" property must be specified');
        }

        function callback (err, response) {

          if (err) {
            return options.error && options.error(err);
          }

          if (method === 'create' || method === 'update' || method === 'patch') {
            response = {
              _id: response.id,
              _rev: response.rev
            };
          }

          if (method === 'delete') {
            response = {};
          }

          if (method === 'read') {

            if (options.listen) {
              // TODO:
              // * implement for model
              // * allow overwriding of since.
              options.db.info(function (err, info) {
                // get changes since info.update_seq
                options.db.changes(_.extend({}, options.options.changes, {
                  since: info.update_seq,
                  onChange: function (change) {
                    var todo = model.get(change.id);

                    if (change.deleted) {
                      if (todo) {
                        todo.destroy();
                      }
                    } else {
                      if (todo) {
                        todo.set(change.doc);
                      } else {
                        model.add(change.doc);
                      }
                    }

                    // call original onChange if present
                    if (typeof options.options.changes.onChange === 'function') {
                      options.options.changes.onChange(change);
                    }
                  }
                }));

              });
            }
          }
          return options.success && options.success(response);
        }

        model.trigger('request', model, options.db, options);

        if (method === 'read') {
          // get single model
          if (model.id) {
            return options.db.get(model.id, options.options.get, callback);
          }
          // query view or spatial index
          if (options.fetch === 'query' || options.fetch === 'spatial') {
            if (!options.options[options.fetch].fun) {
              throw new Error('A "' + options.fetch + '.fun" object must be specified');
            }
            return options.db[options.fetch](options.options[options.fetch].fun, options.options[options.fetch], callback);
          }
          // allDocs or spatial query
          options.db[options.fetch](options.options[options.fetch], callback);
        } else {
          options.db[methodMap[method]](model.toJSON(), options.options[methodMap[method]], callback);
        }

        return options;
      };

      adapter.defaults = defaults;

      return adapter;
    },

    attachments: function (defaults) {
      defaults = defaults || {};

      function getPouch (model) {
        if (model.pouch && model.pouch.db) {
          return model.pouch.db;
        }

        if (model.collection && model.collection.pouch && model.collection.pouch.db) {
          return model.collection.pouch.db;
        }

        if (defaults.db) {
          return defaults.db;
        }

        var options = model.sync();

        if (options.db) {
          return options.db;
        }

        // TODO: ask sync adapter

        throw new Error('A "db" property must be specified');
      }

      return {

        attachments: function (filter) {
          var atts = this.get('_attachments') || {};

          if (filter) {
            return _.filter(_.keys(atts), function(key) {
              if (typeof filter === 'function') {
                return filter(key, atts[key]);
              }

              return atts[key].content_type.match(filter);
            });
          }

          return _.keys(atts);
        },

        attachment: function (name, done) {
          // TODO: first look at the _attachments stub,
          // maybe there the data is already there
          var db = getPouch(this);

          return db.getAttachment(this.id, name, done);
        },

        attach: function (blob, name, type, done) {

          if (typeof name === 'function') {
            done = name;
            name = undefined;
            type = undefined;
          }

          if (typeof type === 'function') {
            done = type;
            type = undefined;
          }

          name = name || blob.filename;
          type = type || blob.type;

          var db = getPouch(this);
          var that = this;

          return db.putAttachment(this.id, name, this.get('_rev'), blob, type, function (err, response) {

            if (!err && response.rev) {
              var atts = that.get('_attachments') || {};

              atts[name] = {
                content_type: type,
                stub: true
              };

              that.set({
                _id: response.id,
                _rev: response.rev,
                _attachments: atts
              }, {
                silent: true
              });

            }

            done(err, response);
          });

        }

      };

    }

  };

  return BackbonePouch;

}());


}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"extend":1,"underscore":"underscore"}]},{},[2])(2)
});