/*!
 * @licence Echo Web Application Framework, version 3.0
 * Copyright (C) 2002-2009 NextApp, Inc.
 * License: MPL, GPL
 * http://echo.nextapp.com/site/echo3/
 */
/**
 * @fileoverview
 * Provides low-level core functionality.  Requires nothing.
 * <p>
 * Provides core APIs for creating object-oriented and event-driven JavaScript code.  Features include:
 * <ul>
 *  <li>Provides API for declaring JavaScript classes which includes support for
 *   specifying abstract and virtual properties and validating subtypes to such
 *   specification.</li>
 *  <li>Provides a "Method Wrapper" function (Core.method()) to create a function which will invoke 
 *    a member function of a specific object instance (enabling invocation with the "this pointer" set
 *    appropriately).</li>
 *  <li>Provides event/listener management framework.  Event-listeners which invoke
 *    methods of an object instance may be created using the Core.method() function.</li>
 *  <li>Provides a "Large Map" useful for managing an associative array that is frequently modified
 *    and will exist for a long period of time.  This object is unfortunately necessary due to
 *    issues present in certain clients (Internet Explorer 6 memory leak / performance degradation).</li>
 *  <li>Provides array manipulation utilities.<li>
 *  <li>Provides some simple debugging utilities, e.g., a pseudo-console output.</li>
 *  <li>Does not provide any web-specific functionality.</li>
 * </ul>
 */

/**
 * Namespace for core functionality.
 * @namespace
 */
Core = {

    /**
     * Creates a duplicate copy of a function by wrapping the original in a closure.
     *
     * @param f the function
     * @return an effectively identical copy
     */
    _copyFunction: function(f) {
        return function() {
            f.apply(this, arguments);
        };
    },
    
    /**
     * Creates an empty function.
     */
    _createFunction: function() {
        return function() { };
    },
    
    /**
     * Creates a new class, optionally extending an existing class.
     * This method may be called with one or two parameters as follows:
     * <p>
     * <code>Core.extend(definition)</code>
     * <code>Core.extend(baseClass, definition)</code>
     * <p>
     * Each property of the definition object will be added to the prototype of the returned defined class.
     * Properties that begin with a dollar-sign (<code>$</code>) will be processed specially:
     * <p>
     * <ul>
     * <li>The <code>$construct</code> property, which must be a function, will be used as the constructor.
     * The <code>$load</code> property, which must be a function, f provided, will be used as a static initializer,
     * executed once when the class is *defined*.  The this pointer will be set to the class when
     * this method is executed.</li>
     * <li>The <code>$static</code> property, an object, if provided, will have its properties installed as class variables.</li>
     * <li>The <code>$abstract</code> property, an object or <code>true</code>, if provided, will define methods that
     * must be implemented by derivative classes.  If the value is simply <code>true</code>, the object will be marked as
     * abstract (such that it does not necessarily need to provide implementations of abstract methods defined in its 
     * base class.)</li>
     * <li>The <code>$virtual</code> property, an object, if provided, defines methods that will be placed into the prototype
     * that may be overridden by subclasses.  Attempting to override a property/method of the superclass that
     * is not defined in the virtual block will result in an exception.  Having the default behavior NOT allow
     * for overriding ensures that namespacing between super- and sub-types if all internal variables are instance
     * during <code>Core.extend()</code>.</li>
     * </ul>
     * <p>
     * Use of this method enables a class to be derived WITHOUT executing the constructor of the base class
     * in order to create a prototype for the derived class.  This method uses a "shared prototype" architecture,
     * where two objects are created, a "prototype class" and a "constructor class".  These two objects share
     * the same prototype, but the "prototype class" has an empty constructor.  When a class created with
     * this method is derived, the "prototype class" is used to create a prototype for the derivative.
     * <p>
     * This method will return the constructor class, which contains an internal reference to the 
     * prototype class that will be used if the returned class is later derived by this method.
     * 
     * @param {Function} baseClass the base class
     * @param {Object} definition an associative array containing methods and properties of the class
     * @return the constructor class
     */
    extend: function() {
        // Configure baseClass/definition arguments.
        var baseClass = arguments.length == 1 ? null : arguments[0];
        var definition = arguments.length == 1 ? arguments[0] : arguments[1];
        
        var x, name;
        
        // Perform argument error checking.
        if (arguments.length == 2) {
            if (typeof(baseClass) != "function") {
                throw new Error("Base class is not a function, cannot derive.");
            }
        }
        if (!definition) {
            throw new Error("Object definition not provided.");
        }
        
        // Create the constructor class.
        var constructorClass;
        if (definition.$construct) {
            // Definition provides constructor, provided constructor function will be used as object.
            constructorClass = definition.$construct;
            
            // Remove property such that it will not later be added to the object prototype.
            delete definition.$construct;
        } else {
            // Definition does not provide constructor.
            if (baseClass) {
                // Base class available: copy constructor function from base class.
                // Note: should function copying not be supported by a future client,
                // it is possible to simply create a new constructor which invokes the base
                // class constructor (using closures and Function.apply()) to achieve the
                // same effect (with a slight performance penalty).
                constructorClass = Core._copyFunction(baseClass);
            } else {
                // No base class: constructor is an empty function.
                constructorClass = Core._createFunction();
            }
        }
        
        // Create virtual property storage.
        constructorClass.$virtual = {};
        
        // Store reference to base class in constructor class.
        constructorClass.$super = baseClass;

        if (baseClass) {
            // Create class with empty constructor that shares prototype of base class.
            var prototypeClass = Core._createFunction();
            prototypeClass.prototype = baseClass.prototype;
            
            // Create new instance of constructor-less prototype for use as prototype of new class.
            constructorClass.prototype = new prototypeClass();
        }
        
        // Assign constructor correctly.
        constructorClass.prototype.constructor = constructorClass;

        // Add abstract properties.
        if (definition.$abstract) {
            constructorClass.$abstract = {};
            if (baseClass && baseClass.$abstract) {
                // Copy abstract properties from base class.
                for (x in baseClass.$abstract) {
                    constructorClass.$abstract[x] = baseClass.$abstract[x];
                }
            }

            if (definition.$abstract instanceof Object) {
                // Add abstract properties from definition.
                for (x in definition.$abstract) {
                    constructorClass.$abstract[x] = true;
                    constructorClass.$virtual[x] = true;
                }
            }
            
            // Remove property such that it will not later be added to the object prototype.
            delete definition.$abstract;
        }
        
        // Copy virtual property flags from base class to shared prototype.
        if (baseClass) {
            for (name in baseClass.$virtual) {
                constructorClass.$virtual[name] = baseClass.$virtual[name];
            }
        }
        
        // Add virtual instance properties from definition to shared prototype.
        if (definition.$virtual) {
            Core._inherit(constructorClass.prototype, definition.$virtual, constructorClass.$virtual);
            for (name in definition.$virtual) {
                constructorClass.$virtual[name] = true;
            }

            // Remove property such that it will not later be added to the object prototype.
            delete definition.$virtual;
        }
        
        // Add toString and valueOf manually, as they will not be iterated
        // by for-in iteration in Internet Explorer.
        if (definition.hasOwnProperty("toString")) {
            constructorClass.prototype.toString = definition.toString;
        }
        if (definition.hasOwnProperty("valueOf")) {
            constructorClass.prototype.valueOf = definition.valueOf;
        }

        // Remove properties such that they will not later be added to the object prototype.
        delete definition.toString;
        delete definition.valueOf;

        // Add Mixins.
        if (definition.$include) {
            // Reverse order of mixins, such that later-defined mixins will override earlier ones.
            // (Mixins will only be added if they will NOT override an existing method.)
            var mixins = definition.$include.reverse();
            Core._processMixins(constructorClass, mixins);
            
            // Remove property such that it will not later be added to the object prototype.
            delete definition.$include;
        }

        // Store $load static initializer and remove from definition so it is not inherited in static processing.
        var loadMethod = null;
        if (definition.$load) {
            loadMethod = definition.$load;

            // Remove property such that it will not later be added to the object prototype.
            delete definition.$load;
        }
        
        // Process static properties and methods defined in the '$static' object.
        if (definition.$static) {
            Core._inherit(constructorClass, definition.$static);

            // Remove property such that it will not later be added to the object prototype.
            delete definition.$static;
        }

        // Process instance properties and methods.
        Core._inherit(constructorClass.prototype, definition, constructorClass.$virtual);
        
        // If class is concrete, verify all abstract methods are provided.
        if (!constructorClass.$abstract) {
            this._verifyAbstractImpl(constructorClass);
        }
        
        // Invoke static constructors.
        if (loadMethod) {
            // Invoke $load() function with "this" pointer set to class.
            loadMethod.call(constructorClass);
        }
        
        return constructorClass;
    },
    
    /**
     * Retrieves a value from an object hierarchy.
     *
     * Examples: 
     * Given the following object 'o': <code>{ a: { b: 4, c: 2 }}</code>
     * <ul>
     * <li><code>Core.get(o, ["a", "b"]) will return <code>4</code>.</li>
     * <li><code>Core.get(o, ["a", "c"]) will return <code>2</code>.</li>
     * <li><code>Core.get(o, ["a", "d"]) will return <code>null</code>.</li>
     * <li><code>Core.get(o, ["a"]) will return <code>{ b: 4, c: 2 }</code>.</li>
     * <li><code>Core.get(o, ["b"]) will return <code>null</code>.</li>
     * <li><code>Core.get(o, ["d"]) will return <code>null</code>.</li>
     * </ul>
     *
     * @param object an arbitrary object from which the value should be retrieved
     * @param {Array} path an array of object property names describing the path to retrieve
     * @return the value, if found, or null if it does not exist
     */
    get: function(object, path) {
        for (var i = 0; i < path.length; ++i) {
            object = object[path[i]];
            if (!object) {
                return null;
            }
        }

        return object;
    },
    
    /**
     * Determines if the specified propertyName of the specified object is a virtual
     * property, i.e., that it can be overridden by subclasses.
     */
    _isVirtual: function(virtualProperties, propertyName) {
        switch (propertyName) {
        case "toString":
        case "valueOf":
            return true;
        }
        
        return virtualProperties[propertyName];
    },
    
    /**
     * Installs properties from source object into destination object.
     * <p>
     * In the case where the destination object already has a property defined
     * and the "virtualProperties" argument is provided, the "virtualProperties"
     * collection will be checked to ensure that property is allowed to be
     * overridden.  If "virtualProperties" is omitted, any property may be
     * overridden.
     *
     * @param destination the destination object
     * @param soruce the source object
     * @param virtualProperties (optional) collection of virtual properties from base class.
     */
    _inherit: function(destination, source, virtualProperties) {
        for (var name in source) {
            if (virtualProperties && destination[name] !== undefined && !this._isVirtual(virtualProperties, name)) {
                // Property exists in destination as is not marked as virtual.
                throw new Error("Cannot override non-virtual property \"" + name + "\".");
            } else {
                destination[name] = source[name];
            }
        }
    },
    
    /**
     * Creates a new function which executes a specific method of an object instance.
     * Any arguments passed to the returned function will be passed to the method.
     * The return value of the method will be returned by the function.
     *
     * CAUTION: When adding and removing methods as listeners, note that two separately
     * constructed methods will not be treated as equal, even if their instance and method
     * properties are the same.  Failing to heed this warning can result in a memory leak,
     * as listeners would never be removed.
     *
     * @param instance the object instance
     * @param {Function} method the method to be invoked on the instance
     * @return the return value provided by the method
     */
    method: function(instance, method) {
        return function() {
            return method.apply(instance, arguments);
        };
    },
    
    /**
     * Add properties of mixin objects to destination object.
     * Mixins will be added in order, and any property which is already
     * present in the destination object will not be overridden.
     *
     * @param destination the destination object
     * @param {Array} mixins the mixin objects to add 
     */
    _processMixins: function(destination, mixins) {
        for (var i = 0; i < mixins.length; ++i) {
            for (var mixinProperty in mixins[i]) {
                if (destination.prototype[mixinProperty]) { 
                    // Ignore mixin properties that already exist.
                    continue;
                }
                destination.prototype[mixinProperty] = mixins[i][mixinProperty];
            }
        }
    },
    
    /**
     * Sets a value in an object hierarchy.
     *
     * Examples: 
     * Given the following object 'o': <code>{ a: { b: 4, c: 2 } }</code>
     * <ul>
     * <li><code>Core.set(o, ["a", "b"], 5)</code> will update the value of 'o' to be: <code>{ a: { b: 5, c: 2 } }</code></li>
     * <li><code>Core.set(o, ["a", "d"], 7)</code> will update the value of 'o' to be:
     * <code>{ a: { b: 4, c: 2, d: 7 } }</code></li>
     * <li><code>Core.set(o, ["e"], 9)</code> will update the value of 'o' to be: <code>{ a: { b: 4, c: 2 }, e: 9 }</code></li>
     * <li><code>Core.set(o, ["f", "g"], 8)</code> will update the value of 'o' to be: 
     * <code>{ a: { b: 4, c: 2 }, f: { g: 8 } }</code></li>
     * <li><code>Core.set(o, ["a"], 10)</code> will update the value of 'o' to be: <code>{ a: 10 }</code></li>
     * </ul>
     *
     * @param object an arbitrary object from which the value should be retrieved
     * @param {Array} path an array of object property names describing the path to retrieve
     * @return the value, if found, or null if it does not exist
     */
    set: function(object, path, value) {
        var parentObject = null;
        
        // Find or create container object.
        for (var i = 0; i < path.length - 1; ++i) {
            parentObject = object; 
            object = object[path[i]];
            if (!object) {
                object = {};
                parentObject[path[i]] = object;
            }
        }
        
        // Assign value.
        object[path[path.length - 1]] = value;
    },
    
    /**
     * Verifies that a concrete derivative of an abstract class implements
     * abstract properties present in the base class.
     *
     * @param constructorClass the class to verify
     */
    _verifyAbstractImpl: function(constructorClass) {
         var baseClass = constructorClass.$super;
         if (!baseClass || !baseClass.$abstract || baseClass.$abstract === true) {
             return;
         }
         
         for (var x in baseClass.$abstract) {
             if (constructorClass.prototype[x] == null) {
                 throw new Error("Concrete class does not provide implementation of abstract method \"" + x + "\".");
             }
         }
    }
};

/**
 * Namespace for debugging related utilities.
 * @class
 */
Core.Debug = { 

    /**
     * The DOM element to which console output should be written.
     * @type HTMLElement
     */
    consoleElement: null,
    
    /**
    * Flag indicating whether console output should be displayed as alerts.
    * Enabling is generally not recommended.
    * @type Boolean
    */
    useAlertDialog: false,
    
    /**
     * Writes a message to the debug console.
     * 
     * @param {String} text the message
     */
    consoleWrite: function(text) {
        if (Core.Debug.consoleElement) {
            var entryElement = document.createElement("div");
            entryElement.appendChild(document.createTextNode(text));
            if (Core.Debug.consoleElement.childNodes.length === 0) {
                Core.Debug.consoleElement.appendChild(entryElement);
            } else {
                Core.Debug.consoleElement.insertBefore(entryElement, Core.Debug.consoleElement.firstChild);
            }
        } else if (Core.Debug.useAlertDialog) {
            alert("DEBUG:" + text);
        }
    },
    
    /**
     * Creates a string representation of the state of an object's instance variables.
     *
     * @param object the object to convert to a string
     * @return the string
     * @type String
     */
    toString: function(object) {
        var s = "";
        for (var x in object) {
            if (typeof object[x] != "function") { 
                s += x + ":" + object[x] + "\n";
            }
        }
        return s;
    }
};

/**
 * Arrays namespace.
 */
Core.Arrays = {

    /**
     * Returns <tt>true</tt> if the first array contains all of the elements
     * in the second array.
     *
     * @param {Array} array1 the array to be analyzed
     * @param {Array} array2 an array whose elements must all be present in <code>array1</code>
     *        for this method to return <code>true</code>
     * @param {Boolean} unique optional flag indicating that all elements in array2 are unique
     * @return <tt>true</tt> if the first array contains all of the elements
     *         in the second array
     * @type Boolean
     */
    containsAll: function(array1, array2, unique) {
        if (unique && array1.length < array2.length) {
            return false;
        }
        if (array2.length === 0) {
            return true;
        }
        var found, item;
        for (var i = 0; i < array2.length; ++i) {
            found = false;
            item = array2[i];
            for (var j = 0; j < array1.length; ++j) {
                if (item == array1[j]) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                return false;
            }
        }
        return true;
    },

    /**
     * Returns the index of the specified item within the array, or -1 if it 
     * is not contained in the array.  
     * 
     * @param item the item
     * @return the index of the item, or -1 if it is not present in the array
     * @type Number
     */
    indexOf: function(array, item) {
        for (var i = 0; i < array.length; ++i) {
            if (item == array[i]) {
                return i;
            }
        }
        return -1;
    },
    
    /**
     * Removes the first instance of the specified item from an array.
     * If the item does not exist in the array, no action is taken.
     * Equality is determined using the '==' operator.
     * 
     * @param array the array from which the item should be removed
     * @param item the item to remove
     */
    remove: function(array, item) {
        for (var i = 0; i < array.length; ++i) {
            if (item == array[i]) {
                array.splice(i, 1);
                return;
            }
        }
    },
    
    /**
     * Removes duplicate items from an array.
     * Items retained in the array may not appear in the previous order.
     * 
     * @param array the array from which duplicates are to be removed.
     */
    removeDuplicates: function(array) {
        array.sort();
        var removeCount = 0;
        // Iterate from last element to second element.
        for (var i = array.length - 1; i > 0; --i) {
            // Determine if element is equivalent to previous element.
            if (array[i] == array[i - 1]) {
                // If duplicate, copy last element in array over current element.
                array[i] = array[array.length - 1 - removeCount];
                
                // Increment removeCount (indicating how much the length of the array should be decremented)
                ++removeCount;
            }
        }
        
        if (removeCount > 0) {
            array.length = array.length - removeCount;
        }
    }
};

/**
 * Associative array wrapper which periodically recreates the associative array
 * in order to avoid memory leakage and performance problems on certain browser
 * platforms, i.e., Internet Explorer 6.
 * Null values are not permitted as keys.  Setting a key to a null value
 * will result in the key being removed.
 */
Core.Arrays.LargeMap = Core.extend({
    
    $static: {
    
        /** 
         * Flag indicating whether forced garbage collection should be enabled.
         * This flag should be manually set in environments where it is required.
         * (The web module does this automatically for IE6.)
         */
        garbageCollectEnabled: false
    },
    
    /**
     * Number of removes since last associative array re-creation.
     * @type Number
     */
    _removeCount: 0,
    
    /**
     * Number (integer) of removes between associative array re-creation.
     * @type Number
     */
    garbageCollectionInterval: 250,
    
    /**
     * Associative mapping.
     */
    map: null, 
    
    /**
     * Creates a new LargeMap.
     */
    $construct: function() {
        this.map = {};
    },
    
    /**
     * Performs 'garbage-collection' operations, recreating the array.
     * This operation is necessary due to Internet Explorer memory leak
     * issues.
     */
    _garbageCollect: function() {
        this._removeCount = 0;
        var newMap = {};
        for (var key in this.map) {
            newMap[key] = this.map[key];
        }
        this.map = newMap;
    },
    
    /**
     * Removes the value referenced by the specified key.
     *
     * @param key the key
     */
    remove: function(key) {
        delete this.map[key];
        if (Core.Arrays.LargeMap.garbageCollectEnabled) {
            ++this._removeCount;
            if (this._removeCount >= this.garbageCollectionInterval) {
                this._garbageCollect();
            }
        }
    },
    
    /**
     * Returns a string representation, for debugging purposes only.
     * 
     * @return a string representation of the map
     * @type String
     */
    toString: function() {
        return Core.Debug.toString(this.map);
    }
});

/**
 * A collection of event listeners.  Provides capability to manage listeners
 * of multiple types, and fire events to listeners based on type.
 */
Core.ListenerList = Core.extend({

    /**
     * Array containing event types and event listeners.  
     * Even indexes contain event types, and the subsequent odd
     * index contain Functions to invoke.
     * @type Array
     */
    _data: null,
   
    /**
     * Creates a new listener list.
     * 
     * @constructor
     */
    $construct: function() {
        this._data = [];
    },

    /**
     * Adds an event listener.
     * 
     * @param {String} eventType the event type
     * @param {Function} eventTarget the event target
     */
    addListener: function(eventType, eventTarget) {
        this._data.push(eventType, eventTarget);
    },
    
    /**
     * Fires an event.
     * 
     * @param event the event to fire
     * @return true if all event listeners returned values that evaluate to true, 
     *         or false if any event listeners returned values that evaluate to 
     *         false
     * @type Boolean
     */
    fireEvent: function(event) {
        if (event.type == null) {
            throw new Error("Cannot fire event, type property not set.");
        }
        
        var i, returnValue = true, listeners = [];
        
        for (i = 0; i < this._data.length; i += 2) {
            if (this._data[i] == event.type) {
                listeners.push(this._data[i + 1]);
            }
        }
        
        for (i = 0; i < listeners.length; ++i) {
            returnValue = listeners[i](event) && returnValue; 
        }
        return returnValue;
    },
    
    /**
     * Returns an array containing the types of all listeners
     * in the list.
     * 
     * @return the event types
     * @type Array
     */
    getListenerTypes: function() {
        var types = [];
        for (var i = 0; i < this._data.length; i += 2) {
            types.push(this._data[i]);
        }
        Core.Arrays.removeDuplicates(types);
        return types;
    },
    
    /**
     * Returns an array of all listeners for a specific event type.
     * 
     * @param {String} eventType the event type
     * @return the listeners
     * @type Array
     */
    getListeners: function(eventType) {
        var listeners = [];
        for (var i = 0; i < this._data.length; i += 2) {
            if (this._data[i] == eventType) {
                listeners.push(this._data[i + 1]);
            }
        }
        return listeners;
    },
    
    /**
     * Determines the number of listeners for a specific event type.
     * 
     * @param {String} eventType the event type
     * @return the listener count
     * @type Number
     */
    getListenerCount: function(eventType) {
        var count = 0;
        for (var i = 0; i < this._data.length; i += 2) {
            if (this._data[i] == eventType) {
                ++count;
            }
        }
        return count;
    },
    
    /**
     * Determines if the listeners list has any listeners of a specific type.
     * 
     * @param {String} eventType the event type
     * @return true if any listeners exist
     * @type Boolean
     */
    hasListeners: function(eventType) {
        for (var i = 0; i < this._data.length; i += 2) {
            if (this._data[i] == eventType) {
                return true;
            }
        }
        return false;
    },
    
    /**
     * Determines if any number of listeners are registered to the list.
     * 
     * @return true if the listener list is empty
     * @type Boolean
     */
    isEmpty: function() {
        return this._data.length === 0;
    },
    
    /**
     * Removes an event listener.
     * 
     * CAUTION: If you are unregistering an event listener created with Core.method(), please see the documentation for
     * Core.method() and note that a new closure-wrapped method is returned each time Core.method() is invoked.
     * Thus calling removeListener(Core.method(this, this,_someListener)) will NOT remove an existing listener.
     * The solution to this issue is to retain a reference to Core.method() wrapped listeners within the object
     * that will register and unregister them.
     * 
     * 
     * @param {String} eventType the event type
     * @param {Function} eventTarget the event target
     */
    removeListener: function(eventType, eventTarget) {
        for (var i = 0; i < this._data.length; i += 2) {
            if (this._data[i] == eventType && eventTarget == this._data[i + 1]) {
                var oldLength = this._data.length;
                this._data.splice(i, 2);
                return;
            }
        }
    },
    
    /** @see Object#toString */
    toString: function() {
        var out = "";
        for (var i = 0; i < this._data.length; i += 2) {
            if (i > 0) {
                out += ", ";
            }
            out += this._data[i] + ":" + this._data[i + 1];
        }
        return out;
    }
});

/**
 * Provides locale-specific resources for multiple localizations.
 * A default resource map and locale-specific resource maps may be added to a resource bundle.
 * The resource bundle may then be queried to return a complete resource map for a specific locale.
 * When a locale-specific map is requested, any entries not available specifically in that map will be provided
 * by more generic resource maps that have been added to the bundle.
 */
Core.ResourceBundle = Core.extend({

    $static: {
    
        /**
         * Generates a less specific version of the specified language code.
         * Returns null if no "parent" language code can be determined.
         * This operation is implemented  by removing the sub-tag (if found)
         * from the specified RFC 1766 language code.  If the language
         * code does not have a sub-tag, null is returned.
         *
         * @param {String} languageCode an RFC 1766 language code
         * @return a less specific version of the specified language code,
         *         or null if none can be determined
         * @type String 
         */
        getParentLanguageCode: function(languageCode) {
            if (languageCode.indexOf("-") == -1) {
                return null;
            } else {
                return languageCode.substring(0, languageCode.indexOf("-"));
            }
        }
    },

    /**
     * Association between RFC 1766 language codes and resource maps.
     * These are the maps which have been added using the <code>set()</code> method.
     * The contents of these maps may not be modified.
     */
    _sourceMaps: null,
    
    /**
     * Cache of generated resource maps which fill omissions in more-specific resource maps
     * with those from less-specific resource maps.  A generated map is returned
     * when the user requests a locale-specific map.
     */
    _generatedMaps: null,
    
    /**
     * The default resource map that should be used in the event that a
     * locale-specific map is not available for a particular language code.
     */
    _defaultMap: null,

    /**
     * Creates a new <code>ResourceBundle</code>.
     * 
     * @param defaultMap the default resource map
     */
    $construct: function(defaultMap) {
        this._sourceMaps = {};
        this._generatedMaps = {};
        this._defaultMap = defaultMap;
    },
    
    /**
     * Returns a locale-specific resource map.  The returned map will contain entries from less-specific and/or the default map
     * if they are not available from the map for the specified language code. 
     * 
     * @param {String} languageCode an RFC 1766 language code, or null to return the default map
     * @return a locale-specific map for the language code
     */
    get: function(languageCode) {
        var map = languageCode ? this._generatedMaps[languageCode] : this._defaultMap;
        if (map) {
            return map;
        }
    
        map = {};
        var x;

        // Copy items from exact language resource map into generated resource map.
        var sourceMap = this._sourceMaps[languageCode];
        if (sourceMap) {
            for (x in sourceMap) {
                map[x] = sourceMap[x];
            }
        }

        // Copy any missing items found in parent language resource map (if it exists) into new resource map.
        var parentLanguageCode = Core.ResourceBundle.getParentLanguageCode(languageCode);
        if (parentLanguageCode) {
            sourceMap = this._sourceMaps[parentLanguageCode];
            if (sourceMap) {
                for (x in sourceMap) {
                    if (map[x] === undefined) {
                        map[x] = sourceMap[x];
                    }
                }
            }
        }

        // Copy any missing items found in default resource map into new resource map.
        for (x in this._defaultMap) {
            if (map[x] === undefined) {
                map[x] = this._defaultMap[x];
            }
        }
        
        this._generatedMaps[languageCode] = map;
        return map;
    },

    /**
     * Adds a new locale-specific map to the bundle.
     * 
     *  @param languageCode the language code
     *  @param map the key-value resource map for the language code
     */
    set: function(languageCode, map) {
        this._generatedMaps = {};
        this._sourceMaps[languageCode] = map;
    },
    
    /** @see Object#toString */
    toString: function() {
        var out = "ResourceBundle: ";
        for (var x in this._sourceMaps) {
            out += " " + x;
        }
        return out;
    }
});
/**
 * @fileoverview
 * Provides low-level web-client-related APIs.  Features include:
 * <ul>
 *  <li>Provides cross-platform API for accessing web client features that have
 *   inconsistent implementations on various browser platforms.</li>
 *  <li>Provides HTTP Connection object (wrapper for XMLHttpRequest).</li>
 *  <li>Provides HTML DOM manipulation capabilities.</li>
 *  <li>Provides DOM event management facility, enabling capturing/bubbling phases
 *   on all browsers, including Internet Explorer 6.</li>
 *  <li>Provides "virtual positioning" capability for Internet Explorer 6 to
 *   render proper top/left/right/bottom CSS positioning.</li>
 *  <li>Provides facilities to convert dimensions (e.g., in/cm/pc) to pixels.</li>
 *  <li>Provides capabilities to measure rendered size of DOM fragments.</li>
 *  <li> Provides capabilities to asynchronously load and install JavaScript modules.</li>
 * </ul>
 * Requires Core.
 */

/**
 * Namespace for Web Core.
 * @namespace
 */
Core.Web = {

    /**
     * Flag indicating that a drag-and-drop operation is in process.
     * Setting this flag will prevent text selections within the browser.
     * It must be un-set when the drag operation completes.
     * 
     * @type Boolean
     */
    dragInProgress: false,
    
    /**
     * Initializes the Web Core.  This method must be executed prior to using any Web Core capabilities.
     */
    init: function() {
        if (Core.Web.initialized) {
            // Already initialized.
            return;
        }
    
        Core.Web.Env._init();
        Core.Web.Measure._calculateExtentSizes();
        Core.Web.Measure.Bounds._initMeasureContainer();
        if (Core.Web.Env.QUIRK_CSS_POSITIONING_ONE_SIDE_ONLY) {
            // Enable virtual positioning.
            Core.Web.VirtualPosition._init();
        }
    
        if (Core.Web.Env.ENGINE_MSHTML) {
            Core.Web.DOM.addEventListener(document, "selectstart", Core.Web._selectStartListener, false);
            Core.Web.DOM.addEventListener(document, "dragstart", Core.Web._selectStartListener, false);
        }
        
        Core.Web.initialized = true;
    },
    
    /**
     * Internet Explorer-specific event listener to deny selection.
     * 
     * @param {Event} e the selection event
     */
    _selectStartListener: function(e) {
        e = e ? e : window.event;
        if (Core.Web.dragInProgress) {
            Core.Web.DOM.preventEventDefault(e);
        }
    }
};

/**
 * DOM manipulation utility method namespace.
 * @class
 */
Core.Web.DOM = {

    /**
     * Temporary storage for the element about to be focused (for clients that require 'delayed' focusing).
     */
    _focusPendingElement: null,

    /**
     * Runnable to invoke focus implementation (lazily created).
     * @type Core.Web.Scheduler.Runnable
     */
    _focusRunnable: null,

    /**
     * Adds an event listener to an object, using the client's supported event 
     * model.  This method does NOT support method references. 
     *
     * @param {Element} eventSource the event source
     * @param {String} eventType the type of event (the 'on' prefix should NOT be included
     *        in the event type, i.e., for mouse rollover events, "mouseover" would
     *        be specified instead of "onmouseover")
     * @param {Function} eventListener the event listener to be invoked when the event occurs
     * @param {Boolean} useCapture a flag indicating whether the event listener should capture
     *        events in the final phase of propagation (only supported by 
     *        DOM Level 2 event model, not available on Internet Explorer)
     */
    addEventListener: function(eventSource, eventType, eventListener, useCapture) {
        if (eventSource.addEventListener) {
            eventSource.addEventListener(eventType, eventListener, useCapture);
        } else if (eventSource.attachEvent) {
            eventSource.attachEvent("on" + eventType, eventListener);
        }
    },
    
    /**
     * Creates a new XML DOM.
     *
     * @param {String} namespaceUri the unique URI of the namespace of the root element in 
     *        the created document (not supported for
     *        Internet Explorer 6 clients, null may be specified for all clients)
     * @param {String} qualifiedName the name of the root element of the new document (this
     *        element will be created automatically)
     * @type Document
     * @return the created DOM
     */
    createDocument: function(namespaceUri, qualifiedName) {
        if (document.implementation && document.implementation.createDocument) {
            // DOM Level 2 Browsers
            var dom;
            if (Core.Web.Env.BROWSER_FIREFOX && Core.Web.Env.BROWSER_VERSION_MAJOR == 3 &&
                    Core.Web.Env.BROWSER_VERSION_MINOR === 0) {
                // https://bugzilla.mozilla.org/show_bug.cgi?id=431701
                dom = new DOMParser().parseFromString("<?xml version='1.0' encoding='UTF-8'?><" + qualifiedName + "/>",
                        "application/xml");
            } else {
                dom = document.implementation.createDocument(namespaceUri, qualifiedName, null);
                try {
                    // Advises the IE9 to sent posts back in UTF-8 as expected. See http://echo.nextapp.com/site/node/6658
                    dom.charset = "utf-8";
                } catch(e) {} // ignore potential errors. It works without all other browsers.
            }
            if (!dom.documentElement) {
                dom.appendChild(dom.createElement(qualifiedName));
            }
            return dom;
        } else if (window.ActiveXObject) {
            // Internet Explorer
            var createdDocument = new ActiveXObject("Microsoft.XMLDOM");
            var documentElement = createdDocument.createElement(qualifiedName);
            createdDocument.appendChild(documentElement);
            return createdDocument;
        } else {
            throw new Error("XML DOM creation not supported by browser environment.");
        }
    },
    
    /**
     * Focuses the given DOM element.
     * The focus operation may be placed in the scheduler if the browser requires the focus
     * operation to be performed outside of current JavaScript context (i.e., in the case
     * where the element to be focused was just rendered in this context).
     * Passing a null element argument will cancel any scheduler runnable attempting to 
     * set the focus.
     * 
     * @param {Element} element the DOM element to focus
     */
    focusElement: function(element) {
        if (!this._focusRunnable) {
            this._focusRunnable = new (Core.extend(Core.Web.Scheduler.Runnable, {
                
                repeat: true,
                
                attempt: 0,
                
                timeInterval: 25,
            
                run: function() {
                    element = Core.Web.DOM._focusPendingElement;
                    Core.Debug.consoleWrite("Focus:" + element + "/" + element.id + "/" + Core.Web.DOM.isDisplayed(element));
                    
                    var done = false;
                    if (Core.Web.DOM.isDisplayed(element)) {
                        done = true;
                        try {
                            element.focus();
                        } catch (ex) {
                            // Silently digest IE focus exceptions.
                        }
                    }
                    
                    done |= this.attempt > 25;
                    
                    ++this.attempt;
                    
                    if (done) {
                        Core.Web.DOM._focusPendingElement = null;
                        Core.Web.Scheduler.remove(this);
                    }
                }
            }))();
        }

        if (!(element && element.focus && Core.Web.DOM.isAncestorOf(document.body, element))) {
            // Cancel and return.
            Core.Web.DOM._focusPendingElement = null;
            Core.Web.Scheduler.remove(this._focusRunnable);
            return;
        }
        
        this._focusPendingElement = element;
        
        this._focusRunnable.attempt = 0;
        Core.Web.Scheduler.add(this._focusRunnable);
    },
    
    /**
     * Returns the first immediate child element of parentElement with the specified tag name.
     * 
     * @param {Element} parentElement the parent element
     * @param tagName the tag name
     * @return the first child element of parentElement with the specified tag name,
     *         or null if no elements match
     * @type Element
     */
    getChildElementByTagName: function(parentElement, tagName) {
        var element = parentElement.firstChild;
        while (element) {
            if (element.nodeType == 1 && element.nodeName == tagName) {
                return element;
            }
            element = element.nextSibling;
        }
        return null;
    },
    
    /**
     * Returns an array containing all immediate child element of parentElement with the specified tag name.
     * 
     * @param {Element} parentElement the parent element
     * @param tagName the tag name
     * @return the child elements
     * @type Array
     */
    getChildElementsByTagName: function(parentElement, tagName) {
        var elements = [];
        var element = parentElement.firstChild;
        while (element) {
            if (element.nodeType == 1 && element.nodeName == tagName) {
                elements.push(element);
            }
            element = element.nextSibling;
        }
        return elements;
    },
    
    /**
     * Returns x/y coordinates of mouse relative to the element which fired an event.
     * 
     * @param {Event} e the event
     * @return object containing 'x' and 'y' properties specifying the numeric pixel
     *         coordinates of the mouse relative to the element, with {x: 0, y: 0}
     *         indicating its upper-left corner
     */
    getEventOffset: function(e) {
        if (typeof e.offsetX == "number") {
            return { x: e.offsetX, y: e.offsetY };
        } else {
            var bounds = new Core.Web.Measure.Bounds(this.getEventTarget(e));
            return { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
        }
    },
    
    /**
     * Returns the target of an event, using the client's supported event model.
     * On clients which support the W3C DOM Level 2 event specification,
     * the <code>target</code> property of the event is returned.
     * On clients which support only the Internet Explorer event model,
     * the <code>srcElement</code> property of the event is returned.
     *
     * @param {Event} e the event
     * @return the target
     * @type Element
     */
    getEventTarget: function(e) {
        return e.target ? e.target : e.srcElement;
    },
    
    /**
     * Returns the related target of an event, using the client's supported event model.
     * On clients which support the W3C DOM Level 2 event specification,
     * the <code>relatedTarget</code> property of the event is returned.
     * On clients which support only the Internet Explorer event model,
     * the <code>toElement</code> property of the event is returned.
     *
     * @param {Event} e the event
     * @return the target
     * @type Element
     */
    getEventRelatedTarget: function(e) {
        return e.relatedTarget ? e.relatedTarget : e.toElement;
    },
    
    /**
     * Determines if <code>ancestorNode</code> is or is an ancestor of
     * <code>descendantNode</code>.
     *
     * @param {Node} ancestorNode the potential ancestor node
     * @param {Node} descendantNode the potential descendant node
     * @return true if <code>ancestorNode</code> is or is an ancestor of
     *         <code>descendantNode</code>
     * @type Boolean
     */
    isAncestorOf: function(ancestorNode, descendantNode) {
        var testNode = descendantNode;
        while (testNode != null) {
            if (testNode == ancestorNode) {
                return true;
            }
            testNode = testNode.parentNode;
        }
        return false;
    },
    
    /**
     * Determines if the given node is theoretically dispalyed within the document.
     * The following conditions are verified:
     * <ul>
     *  <li><code>node</code> must be a descendant of <code>document.body</code></li>
     *  <li><code>node</code>'s element ancestry must not contain a element whose CSS <code>visibility</code> state is 
     *    <code>hidden</code></li>
     *  <li><code>node</code>'s element ancestry must not contain a element whose CSS <code>display</code> state is 
     *    <code>none</code></li>
     * </ul>
     * 
     * @param {Node} node to analyze
     * @return true if the node is displayed 
     */
    isDisplayed: function(node) {
        while (node != null) {
            if (node.nodeType == 1) {
                if (node.style) {
                    if (node.style.visibility == "hidden") {
                        return false;
                    }
                    if (node.style.display == "none") {
                        return false;
                    }
                }
            }
            
            if (node == document.body) {
                return true;
            }
            node = node.parentNode;
        }
        return false;
    },

    /**
     * Prevents the default action of an event from occurring, using the
     * client's supported event model.
     * On clients which support the W3C DOM Level 2 event specification,
     * the preventDefault() method of the event is invoked.
     * On clients which support only the Internet Explorer event model,
     * the 'returnValue' property of the event is set to false.
     *
     * @param {Event} e the event
     */
    preventEventDefault: function(e) {
        if (e.preventDefault) {
            e.preventDefault();
        } else {
            e.returnValue = false;
        }
    },
    
    /**
     * Removes all child nodes from the specified DOM node.
     *
     * @param {Node} node the parent node whose children should be deleted
     */
    removeAllChildren: function(node) {
        while (node.firstChild) {
            node.removeChild(node.firstChild);
        }
    },
    
    /**
     * Removes an event listener from an object, using the client's supported event 
     * model.  This method does NOT support method references.
     *
     * @param {Element} eventSource the event source
     * @param {String} eventType the type of event (the 'on' prefix should NOT be included
     *        in the event type, i.e., for mouse rollover events, "mouseover" would
     *        be specified instead of "onmouseover")
     * @param {Function} eventListener the event listener to be invoked when the event occurs
     * @param {Boolean}useCapture a flag indicating whether the event listener should capture
     *        events in the final phase of propagation (only supported by 
     *        DOM Level 2 event model, not available on Internet Explorer)
     */
    removeEventListener: function(eventSource, eventType, eventListener, useCapture) {
        if (eventSource.removeEventListener) {
            eventSource.removeEventListener(eventType, eventListener, useCapture);
        } else if (eventSource.detachEvent) {
            eventSource.detachEvent("on" + eventType, eventListener);
        }
    },
    
    /**
     * Removes the specified DOM node from the DOM tree. This method employs a workaround for the
     * <code>QUIRK_PERFORMANCE_LARGE_DOM_REMOVE</code> quirk.
     *
     * @param {Node} node the node which should be deleted
     */
    removeNode: function(node) {
        var parentNode = node.parentNode;
        if (!parentNode) {
            // not in DOM tree
            return;
        }
        if (Core.Web.Env.QUIRK_PERFORMANCE_LARGE_DOM_REMOVE) {
            this._removeNodeRecursive(node);
        } else {
            parentNode.removeChild(node);
        }
    },
    
    /**
     * Removes the specified DOM node from the DOM tree in a recursive manner, i.e. all descendants
     * of the given node are removed individually. This alleviates slow performance when removing large
     * DOM trees.
     *
     * @param {Node} node the node which should be deleted
    */
    _removeNodeRecursive: function(node) {
        var childNode = node.firstChild;
        while (childNode) {
            var nextChildNode = childNode.nextSibling;
            this._removeNodeRecursive(childNode);
            childNode = nextChildNode;
        }
        node.parentNode.removeChild(node);
    },
    
    /**
     * Stops an event from propagating ("bubbling") to parent nodes in the DOM, 
     * using the client's supported event model.
     * On clients which support the W3C DOM Level 2 event specification,
     * the stopPropagation() method of the event is invoked.
     * On clients which support only the Internet Explorer event model,
     * the 'cancelBubble' property of the event is set to true.
     *
     * @param {Event} e the event
     */
    stopEventPropagation: function(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        } else {
            e.cancelBubble = true;
        }
    }
};

/**
 * Provides information about the web browser environment.
 * @class
 */
Core.Web.Env = {

    /**
     * Flag indicating the Presto rendering engine is being used (Opera).
     */
    ENGINE_PRESTO: null,

    /**
     * Flag indicating the WebKit rendering engine is being used (Safari,
     * Chrome). Derivative of KHTML.
     */
    ENGINE_WEBKIT: null,

    /**
     * Flag indicating the KHTML rendering engine is being used (Konqueror).
     */
    ENGINE_KHTML: null,

    /**
     * Flag indicating the MSHTML/Trident rendering engine is being used
     * (Internet Explorer).
     */
    ENGINE_MSHTML: null,

    /**
     * Flag indicating the Gecko rendering engine is being used (Mozilla,
     * Firefox).
     */
    ENGINE_GECKO: null,

    /**
     * Flag indicating a Mozilla client or Mozilla-based client.
     */
    BROWSER_MOZILLA: null,

    /**
     * Flag indicating an Opera client.
     */
    BROWSER_OPERA: null,

    /**
     * Flag indicating an Konqueror client.
     */
    BROWSER_KONQUEROR: null,

    /**
     * Flag indicating a Mozilla Firefox client.
     */
    BROWSER_FIREFOX: null,

    /**
     * Flag indicating a Microsoft Internet Explorer client.
     */
    BROWSER_INTERNET_EXPLORER: null,

    /**
     * Flag indicating a Google Chrome client.
     */
    BROWSER_CHROME: null,

    /**
     * The major browser version. For Firefox 3.0.6 this would be 3.
     * 
     * @type Number
     */
    BROWSER_VERSION_MAJOR: null,

    /**
     * The minor browser version. For Firefox 3.0.6, this would be 0.
     * 
     * @type Number
     */
    BROWSER_VERSION_MINOR: null,

    /**
     * The major engine version. For Firefox 3.0.6, which uses the Gecko 1.9,
     * this would be 1.
     * 
     * @type Number
     */
    ENGINE_VERSION_MAJOR: null,

    /**
     * The minor engine version. For Firefox 3.0.6, which uses the Gecko 1.9,
     * this would be 9.
     * 
     * @type Number
     */
    ENGINE_VERSION_MINOR: null,

    /**
     * Flag indicating whether the user-agent string contains deceptive
     * information. This is true in the case of Opera, which contains MSIE info
     * in its version string.
     */
    DECEPTIVE_USER_AGENT: null,


    /**
     * Attribute name for CSS float attribute. Varies by browser.
     * @type String
     */
    CSS_FLOAT: "cssFloat",

    /**
     * Flag indicating that offset measurements do not take into account CSS
     * borders around elements.
     * @type Boolean
     */
    MEASURE_OFFSET_EXCLUDES_BORDER: null,

    /**
     * Flag indicating that the CSS "opacity" attribute is not supported.
     * @type Boolean
     */
    NOT_SUPPORTED_CSS_OPACITY: null,
    
    /**
     * Flag indicating that relative table column widths are not supported, 
     * e.g., "*" or "2*".
     * @type Boolean
     */
    NOT_SUPPORTED_RELATIVE_COLUMN_WIDTHS: null,
    
    /**
     * Flag indicating that selectionStart/selectionEnd/setSelectionRange() are not
     * supported on text field INPUT elements and TEXTAREA elements.
     * @type Boolean
     */
    NOT_SUPPORTED_INPUT_SELECTION: null,
    
    /**
     * Flag indicating complete lack of support for W3C DOM range API. 
     * @type Boolean
     */
    NOT_SUPPORTED_RANGE: null,

    /**
     * Flag indicating support for "mouseenter" and "mouseleave" events. This is
     * a proprietary IE event, but is necessary to use to control flicker in
     * rollover effects on high-level elements in this browser.
     * @type Boolean
     */
    PROPRIETARY_EVENT_MOUSE_ENTER_LEAVE_SUPPORTED: null,

    /**
     * Flag indicating support for "selectstart" events.
     * @type Boolean
     */
    PROPRIETARY_EVENT_SELECT_START_SUPPORTED: null,

    /**
     * Flag indicating a DirectX filter is required to render elements with
     * reduced opacity.
     * @type Boolean
     */
    PROPRIETARY_IE_OPACITY_FILTER_REQUIRED: null,

    /**
     * Flag indicating PNG alpha channel effects require the use of a DirectX
     * filter. This filter is dangerous to use, as it can interfere with event
     * handlers registered on the DOM element.
     * @type Boolean
     */
    PROPRIETARY_IE_PNG_ALPHA_FILTER_REQUIRED: null,
    
    /**
     * Flag indicating support for the IE text range API.
     * @type Boolean
     */
    PROPRIETARY_IE_RANGE: null,
    
    /**
     * Flag indicating that keypress events will place charCode value in keyCode property.
     * @type Boolean
     */
    QUIRK_KEY_CODE_IS_CHAR_CODE: null,
    
    /**
     * Flag indicating that keypress events are fired for special keys.
     * @type Boolean
     */
    QUIRK_KEY_PRESS_FIRED_FOR_SPECIAL_KEYS: null,
    
    /**
     * Flag indicating that keypress events are fired for special keys.
     * @type Boolean
     */
    QUIRK_KEY_DOWN_NOT_FIRED_FOR_SPECIAL_KEYS: null,
    
    /**
     * Flag indicating collapsed borders appear inside a table's rendered rather
     * than around it. For example, a proper rendering for a 2px collapsed
     * border is that one pixel appear inside the table's are and one pixel
     * appear outside of it. The IE browser, for example, simply renders both
     * pixels of the border inside.
     * @type Boolean
     */
    QUIRK_CSS_BORDER_COLLAPSE_INSIDE: null,

    /**
     * Flag indicating that top and bottom or left and right CSS absolute
     * positioning properties may not be used on the same attribute. Virtual
     * positioning should be used in such cases.
     * @type Boolean
     */
    QUIRK_CSS_POSITIONING_ONE_SIDE_ONLY: null,

    /**
     * Flag indicating that setting focus is more reliably accomplished by
     * performing the operation in a separate JavaScript execution context.
     * @type Boolean
     */
    QUIRK_DELAYED_FOCUS_REQUIRED: null,
    
    /**
     * Flag indicating peculiar behavior in Internet Explorer where screen suddenly appears blank after
     * DOM manipulations have been performed.  This is commonly seen when many JavaScript execution contexts
     * are being invoked and possibly performing DOM manipulations.  The exact criteria to trigger this bug
     * has not yet been determined.  It does appear that IE's rendering engine somehow collapses as a result
     * and simply blanks the screen.  Resizing the window and certain DOM modifications will cause the screen's
     * image to be restored.
     * @type Boolean
     */
    QUIRK_IE_BLANK_SCREEN: null,
    
    /**
     * Flag indicating a fundamental issue in Internet Explorer's rendering engine wherein the browser is incapable of correctly
     * sizing/positioning elements unless certain CSS attributes (which should not be necessary) are present.
     * Setting the proprietary "zoom" attribute to a value of '1' can force this browser to properly layout an an element that 
     * sufferes this quirk.
     * See http://msdn.microsoft.com/en-us/library/bb250481.aspx 
     */
    QUIRK_IE_HAS_LAYOUT: null,

    /**
     * Flag indicating DOM updates to SELECT elements may result in their
     * appearance being changed, i.e., listboxes will become select fields.
     * @type Boolean
     */
    QUIRK_IE_SELECT_LIST_DOM_UPDATE: null,

    /**
     * Flag indicating that setting percent widths on SELECT elements may result
     * in undesired behavior, e.g., zero-width rendering.
     * @type Boolean
     */
    QUIRK_IE_SELECT_PERCENT_WIDTH: null,

    /**
     * Flag indicating that SELECT elements do not respect z-index settings.
     * @type Boolean
     */
    QUIRK_IE_SELECT_Z_INDEX: null,
    
    /**
     * Flag indicating an IE browser that incorrectly displays the security warning,
     * "This page contains both secure and nonsecure items. Do you want to display the nonsecure items?".
     * See http://support.microsoft.com/kb/925014
     * @type Boolean
     */
    QUIRK_IE_SECURE_ITEMS: null,

    /**
     * Flag indicating that IE browser does not properly render tables whose
     * widths are set to percent values when scrollbars are present. The
     * scrollbar is not included in the calculation of the container size, thus
     * a 100% wide table will not fit in its container when a vertical scrollbar
     * is present, and will trigger a horizontal scroll bar.
     * @type Boolean
     */
    QUIRK_IE_TABLE_PERCENT_WIDTH_SCROLLBAR_ERROR: null,

    /**
     * Quirk flag indicating that offset measurements on elements whose overflow setting is hidden
     * will be incorrectly reduced by the border size.  Used internally in measuring algorithms.
     * @type Boolean
     */
    QUIRK_MEASURE_OFFSET_HIDDEN_BORDER: null,

    /**
     * Flag indicating a bug in the Opera browser where absolute CSS positioning
     * and offset calculations are incorrectly performed. See
     * http://my.opera.com/community/forums/topic.dml?id=250572
     * @type Boolean
     */
    QUIRK_OPERA_CSS_POSITIONING: null,

    /**
     * Quirk indicating that removing large element hierarchies from the DOM
     * using a single removeChild invocation at the root results in poor
     * performance. Workaround is to iteratively remove smaller hierarchies.
     * @type Boolean
     */
    QUIRK_PERFORMANCE_LARGE_DOM_REMOVE: null,

    /**
     * Flag indicating XML documents being sent via XMLHttpRequest must have
     * text content manually escaped due to bugs in the Webkit render engine.
     * @type Boolean
     */
    QUIRK_WEBKIT_DOM_TEXT_ESCAPE: null,

    /**
     * Flag indicating that table cell widths do not include padding value.
     * @type Boolean
     */
    QUIRK_TABLE_CELL_WIDTH_EXCLUDES_PADDING: null,

    /**
     * Flag indicating that images which not yet been loaded will have size
     * information (width/height values).
     * @type Boolean
     */
    QUIRK_UNLOADED_IMAGE_HAS_SIZE: null,

    /**
     * Flag indicating if xml-documents should be serialized before
     * sending them through a xmlHttp request.
     * @type Boolean
     */
    QUIRK_SERIALIZE_XML_BEFORE_XML_HTTP_REQ: null,

    /**
     * User-agent string, in lowercase.
     */
    _ua: null,

    /**
     * The user agent string with all non-alpha character sequences replaced
     * with single slashes and with leading/trailing slashes appended. This
     * string can be searched for whole words using indexOf("/example/")
     */
    _uaAlpha: null,
    
    /**
     * Performs initial analysis of environment. Automatically invoked when
     * Core.Web module is initialized.
     */
    _init: function() {
        var browserVersion = null, 
            engineVersion = null, 
            engineId = false;

        this._ua = navigator.userAgent.toLowerCase();
        this._uaAlpha = "/" + this._ua.replace(/[^a-z]+/g, "/") + "/";
        
        // Parse version string for known major browsers, in reverse order of which they are imitated,
        // i.e., Chrome imitates Safari and Gecko, while Mozilla imitates nothing.
        if (this._testUAString("opera")) {
            this.BROWSER_OPERA = engineId = this.ENGINE_PRESTO = true;
            browserVersion = this._parseVersionInfo("opera/");
        } else if (this._testUAString("chrome")) {
            this.BROWSER_CHROME = engineId = this.ENGINE_WEBKIT = true;
            browserVersion = this._parseVersionInfo("chrome/");
        } else if (this._testUAString("safari")) {
            this.BROWSER_SAFARI = engineId = this.ENGINE_WEBKIT = true;
            browserVersion = this._parseVersionInfo("version/");
        } else if (this._testUAString("konqueror")) {
            this.BROWSER_KONQUEROR = engineId = this.ENGINE_KHTML = true;
            browserVersion = this._parseVersionInfo("konqueror/");
        } else if (this._testUAString("firefox")) {
            this.BROWSER_FIREFOX = this.BROWSER_MOZILLA = engineId = this.ENGINE_GECKO = true;
            browserVersion = this._parseVersionInfo("firefox/");
        } else if (this._testUAString("msie")) {
            this.BROWSER_INTERNET_EXPLORER = engineId = this.ENGINE_MSHTML = true;
            // Set engine version to browser version for MSIE/MSHTML.  Unfortunately "Trident" versioning
            // is unpredictable, with the MSIE8 UA string reporting "Trident/4.0" but MSIE6 supposedly using "Trident IV"
            // and MSIE7 supposedly using "Trident V".  We thus go by the suspected MSHTML DLL version, which is equivalent to
            // the IE version.
            engineVersion = browserVersion = this._parseVersionInfo("msie ");
        }
        
        if (!engineId) {
            // Browser/engine not yet identified, attempt to identify by engine.
            if (this._testUAString("presto")) {
                this.ENGINE_PRESTO = true;
            } else if (this._testUAString("webkit")) {
                this.ENGINE_WEBKIT = true;
            } else if (this._testUAString("khtml")) {
                this.ENGINE_KHTML = true;
            } else if (this._testUAString("trident")) {
                this.ENGINE_MSHTML = true;
            } else if (this._testUAString("gecko")) {
                this.BROWSER_MOZILLA = this.ENGINE_GECKO = true;
            }
        }
        
        if (!engineVersion) {
            if (this.ENGINE_PRESTO) {
                engineVersion = this._parseVersionInfo("presto/");
            } else if (this.ENGINE_WEBKIT) {
                engineVersion = this._parseVersionInfo("webkit/");
            } else if (this.ENGINE_GECKO) {
                engineVersion = this._parseVersionInfo("rv:");
                if (!browserVersion) {
                    browserVersion = engineVersion;
                }
            }
        }
        
        if (browserVersion) {
            this.BROWSER_VERSION_MAJOR = browserVersion.major;
            this.BROWSER_VERSION_MINOR = browserVersion.minor;
        }
        if (engineVersion) {
            this.ENGINE_VERSION_MAJOR = engineVersion.major;
            this.ENGINE_VERSION_MINOR = engineVersion.minor;
        }
        
        // Note deceptive user agent fields:
        // - Konqueror and Safari UA fields contain "like Gecko"
        // - Opera UA field typically contains "MSIE"
        // If this flag is set, browser is not GECKO/MSHTML
        this.DECEPTIVE_USER_AGENT = this.BROWSER_OPERA || this.BROWSER_SAFARI || this.BROWSER_CHROME || this.BROWSER_KONQUEROR;
        
        this.MEASURE_OFFSET_EXCLUDES_BORDER = false;
                
        // Set IE Quirk Flags
        if (this.BROWSER_INTERNET_EXPLORER) {
            // Internet Explorer Flags (all versions).
            this.CSS_FLOAT = "styleFloat";
            this.QUIRK_KEY_CODE_IS_CHAR_CODE = true;
            this.QUIRK_IE_SECURE_ITEMS = true;
            this.NOT_SUPPORTED_RANGE = true;
            this.NOT_SUPPORTED_INPUT_SELECTION = true;
            this.PROPRIETARY_IE_RANGE = true;
            this.PROPRIETARY_EVENT_MOUSE_ENTER_LEAVE_SUPPORTED = true;
            this.PROPRIETARY_EVENT_SELECT_START_SUPPORTED = true;
            this.QUIRK_DELAYED_FOCUS_REQUIRED = true;
            this.QUIRK_UNLOADED_IMAGE_HAS_SIZE = true;
            this.MEASURE_OFFSET_EXCLUDES_BORDER = true;
            this.QUIRK_IE_HAS_LAYOUT = true;
            this.NOT_SUPPORTED_CSS_OPACITY = true;
            this.PROPRIETARY_IE_OPACITY_FILTER_REQUIRED = true;
            
            if (this.BROWSER_VERSION_MAJOR < 9) {
                this.QUIRK_IE_BLANK_SCREEN = true;
            }
            if (this.BROWSER_VERSION_MAJOR < 8) {
                // Internet Explorer 6 and 7 Flags.
                this.QUIRK_TABLE_CELL_WIDTH_EXCLUDES_PADDING = true;
                this.NOT_SUPPORTED_RELATIVE_COLUMN_WIDTHS = true;
                this.QUIRK_CSS_BORDER_COLLAPSE_INSIDE = true;
                this.QUIRK_IE_TABLE_PERCENT_WIDTH_SCROLLBAR_ERROR = true;
                this.QUIRK_IE_SELECT_PERCENT_WIDTH = true;
                
                if (this.BROWSER_VERSION_MAJOR < 7) {
                    // Internet Explorer 6 Flags.
                    this.QUIRK_IE_SELECT_LIST_DOM_UPDATE = true;
                    this.QUIRK_CSS_POSITIONING_ONE_SIDE_ONLY = true;
                    this.PROPRIETARY_IE_PNG_ALPHA_FILTER_REQUIRED = true;
                    this.QUIRK_IE_SELECT_Z_INDEX = true;
                    // Enable 'garbage collection' on large associative arrays to avoid memory leak.
                    Core.Arrays.LargeMap.garbageCollectEnabled = true;
                }
            }
            if(this.BROWSER_VERSION_MAJOR == 9) {
                // Internet Explorer 9 Flags
                // if false ie9 will re-format your xml by adding and removing linebreaks
                this.QUIRK_SERIALIZE_XML_BEFORE_XML_HTTP_REQ = true;
            }
        } else if (this.ENGINE_GECKO) {
            this.QUIRK_KEY_PRESS_FIRED_FOR_SPECIAL_KEYS = true;
            this.MEASURE_OFFSET_EXCLUDES_BORDER = true;
            this.QUIRK_MEASURE_OFFSET_HIDDEN_BORDER = true;
            if (this.BROWSER_FIREFOX) {
                if (this.BROWSER_VERSION_MAJOR < 2) {
                    this.QUIRK_DELAYED_FOCUS_REQUIRED = true;
                }
            } else {
                this.QUIRK_PERFORMANCE_LARGE_DOM_REMOVE = true;
                this.QUIRK_DELAYED_FOCUS_REQUIRED = true;
            }
        } else if (this.ENGINE_PRESTO) {
            this.QUIRK_KEY_CODE_IS_CHAR_CODE = true;
            this.QUIRK_TABLE_CELL_WIDTH_EXCLUDES_PADDING = true;
            if (this.BROWSER_VERSION_MAJOR == 9 && this.BROWSER_VERSION_MINOR >= 50) {
                this.QUIRK_OPERA_CSS_POSITIONING = true;
            }
            this.NOT_SUPPORTED_RELATIVE_COLUMN_WIDTHS = true;
        } else if (this.ENGINE_WEBKIT) {
            this.MEASURE_OFFSET_EXCLUDES_BORDER = true;
            if (this.ENGINE_VERSION_MAJOR < 526 || (this.ENGINE_VERSION_MAJOR == 526 && this.ENGINE_VERSION_MINOR < 8)) {
                this.QUIRK_WEBKIT_DOM_TEXT_ESCAPE = true; //https://bugs.webkit.org/show_bug.cgi?id=18421, fixed in 526.8
            }
        }
    },
    
    /**
     * Parses version information from user agent string. The text argument specifies
     * the string that prefixes the version info in the ua string (ie 'version/' for Safari for example).
     * <p>
     * The major version is retrieved by getting the int between text and the first dot. The minor version
     * is retrieved by getting the int between the first dot and the first non-numeric character that appears
     * after the dot, or the end of the ua string (whichever comes first).
     * If the ua string does not supply a minor version, the minor version is assumed to be 0.
     *
     * @param ua the lower cased user agent string
     * @param searchString the text that prefixes the version info (version info must be the first appearance of 
     *          this text in the ua string)
     */
    _parseVersionInfo: function(searchString) {
        var version = { };
        
        var ix1 = this._ua.indexOf(searchString);
        if (ix1 == -1) {
            return;
        }
        
        var ix2 = this._ua.indexOf(".", ix1);
        var ix3 = this._ua.length;
        
        if (ix2 == -1) {
            ix2 = this._ua.length;
        } else {
            // search for the first non-number character after the dot
            for (var i = ix2 + 1; i < this._ua.length; i++) {
                var c = this._ua.charAt(i);
                if (isNaN(c)) {
                    ix3 = i;
                    break;
                }
            }
        }
        
        version.major = parseInt(this._ua.substring(ix1 + searchString.length, ix2), 10);
        if (ix2 == this._ua.length) {
            version.minor = 0;
        } else {
            version.minor = parseInt(this._ua.substring(ix2 + 1, ix3), 10);
        }
        
        return version;
    },
    
    _testUAString: function(browser) {
        return this._uaAlpha.indexOf("/" + browser + "/") != -1;
    }
};

/**
 * Event Processing System namespace. The static methods in this object provide
 * a standard framework for handling DOM events across often-incompatible
 * browser platforms.
 * <p>
 * <b>Event Propagation:</b> Capturing listeners are notified of events first,
 * followed by bubbling listeners. During the capturing phase of event firing,
 * listeners on higher-level DOM elements are notified before the lower-level
 * DOM elements. During the bubbling phase of event firing, lower-level DOM
 * elements are notified before higher-level DOM elements.
 * <p>
 * For example, given the DOM hierarchy
 * <code>&lt;body&gt;&lt;div&gt;&lt;span&gt;&lt;/span&gt;&lt;/div&gt;&lt;/body&gt;</code>,
 * with click listeners registered for both capturing and bubbling phases on all
 * elements, the listener notification order for a click on the
 * <code>&lt;span&gt;</code> element would be as folows:
 * <ol>
 * <li>Notify capturing listener of <code>&lt;body&gt;</code> element.</li>
 * <li>Notify capturing listener of <code>&lt;div&gt;</code> element.</li>
 * <li>Notify capturing listener of <code>&lt;span&gt;</code> element.</li>
 * <li>Notify bubbling listener of <code>&lt;span&gt;</code> element.</li>
 * <li>Notify bubbling listener of <code>&lt;div&gt;</code> element.</li>
 * <li>Notify bubbling listener of <code>&lt;body&gt;</code> element.</li>
 * </ol>
 * <b>Listener Return Values:</b> Listeners should return a value of true if
 * they wish to continue to allow propogation of an event, and false if they do
 * not.
 * <p>
 * <b>Capturing/Bubbling Listeners:</b> This implementation allows for the
 * registration of both capturing and bubbling event listeners on all browser
 * platforms, including Internet Explorer, even though Internet Explorer does
 * not inhererntly support such listeners. This is accomplished by the Event
 * system adding a layer of abstraction between event registration and the
 * browser, and then invoking event listeners itself.
 * <p>
 * This implementation relies on the fact that all event listeners will be 
 * registered through it.  The implementation is in fact internally registering only
 * bubbling-phase event listeners on the DOM.  Thus, if other event listeners are 
 * registered directly on the DOM, scenarios may occur such as a direct-registered
 * bubbling listener receiving an event before a Core.Web.Event-registered capturing
 * listener.  This is not necessarily a critical issue, but the developer should
 * be aware of it. 
 * 
 * @class
 */
Core.Web.Event = {
    
    /**
     * Provides utilities for restricting selection of DOM elements.  These are necessary as double click and drag
     * events will cause/begin undesired selections.
     */
    Selection: {

        /**
         * Adds a listener to an element that will prevent text selection / highlighting as a result of mouse clicks.
         * The disable() method should be invoked when the element is to be disposed.
         * The event is registered using the event processor, so invoking Core.Web.Event.removeAll() on its
         * element will also dispose it.
         *
         * @param {Element} element the element on which to forbid text selection
         * @see Core.Web.Event.Selection#enable
         */
        disable: function(element) {
            Core.Web.Event.add(element, "mousedown", Core.Web.Event.Selection._disposeEvent, false);
            if (Core.Web.Env.PROPRIETARY_EVENT_SELECT_START_SUPPORTED) {
                Core.Web.Event.add(element, "selectstart", Core.Web.Event.Selection._disposeEvent, false);
            }
        },
        
        /**
         * Selection denial listener implementation.
         * 
         * @param e the selection/click event
         */
        _disposeEvent: function(e) {
            Core.Web.DOM.preventEventDefault(e);
        },
    
        /**
         * Removes a selection denial listener.
         * 
         * @param element the element from which to remove the selection denial listener
         * @see Core.Web.Event.Selection#enable
         */
        enable: function(element) {
            Core.Web.Event.remove(element, "mousedown", Core.Web.Event.Selection._disposeEvent, false);
            if (Core.Web.Env.PROPRIETARY_EVENT_SELECT_START_SUPPORTED) {
                Core.Web.Event.remove(element, "selectstart", Core.Web.Event.Selection._disposeEvent, false);
            }
        }
    },
    
    /**
     * Next available sequentially assigned element identifier.
     * Elements are assigned unique identifiers to enable mapping between 
     * elements and lists of registered event listeners.
     *
     * @type Integer
     */
    _nextId: 0,
    
    /**
     * Current listener count.
     */
    _listenerCount: 0,
    
    /**
     * Flag to display listener count every time an event is fired.  Enable this flag to check for listener leaks.
     */
    debugListenerCount: false,
    
    /**
     * Mapping between element ids and ListenerLists containing listeners to invoke during capturing phase.
     * @type Core.Arrays.LargeMap
     */
    _capturingListenerMap: new Core.Arrays.LargeMap(),
    
    /**
     * Mapping between element ids and ListenerLists containing listeners to invoke during bubbling phase.
     * @type Core.Arrays.LargeMap
     */
    _bubblingListenerMap: new Core.Arrays.LargeMap(),
    
    /**
     * Registers an event handler.
     *
     * @param {Element} element the DOM element on which to add the event handler
     * @param {String} eventType the DOM event type
     * @param {Function} eventTarget the event handler to invoke when the event is fired
     * @param {Boolean} capture true to fire the event during the capturing phase, false to fire the event during
     *        the bubbling phase
     */
    add: function(element, eventType, eventTarget, capture) {
        // Assign event processor element id to element if not present.
        if (!element.__eventProcessorId) {
            element.__eventProcessorId = ++Core.Web.Event._nextId;
        }
    
        var listenerList;
        
        // Determine the Core.ListenerList to which the listener should be added.
        if (element.__eventProcessorId == Core.Web.Event._lastId && 
                capture == Core.Web.Event._lastCapture) {
            // If the 'element' and 'capture' properties are identical to those specified on the prior invocation
            // of this method, the correct listener list is stored in the '_lastListenerList' property. 
            listenerList = Core.Web.Event._lastListenerList; 
        } else {
            // Obtain correct id->ListenerList mapping based on capture parameter.
            var listenerMap = capture ? Core.Web.Event._capturingListenerMap : Core.Web.Event._bubblingListenerMap;
            
            // Obtain ListenerList based on element id.                              
            listenerList = listenerMap.map[element.__eventProcessorId];
            if (!listenerList) {
                // Create new ListenerList if none exists.
                listenerList = new Core.ListenerList();
                listenerMap.map[element.__eventProcessorId] = listenerList;
            }
            
            // Cache element's event processor id, capture parameter value, and listener list.
            // If the same element/capture properties are provided in the next call (which commonly occurs),
            // the lookup operation will be unnecessary.
            Core.Web.Event._lastId = element.__eventProcessorId;
            Core.Web.Event._lastCapture = capture;
            Core.Web.Event._lastListenerList = listenerList;
        }
    
        // Register event listener on DOM element.
        if (!listenerList.hasListeners(eventType)) {
            Core.Web.DOM.addEventListener(element, eventType, Core.Web.Event._processEvent, false);
            ++Core.Web.Event._listenerCount;
        }

        // Add event handler to the ListenerList.
        listenerList.addListener(eventType, eventTarget);
    },
    
    /**
     * Listener method which is invoked when ANY event registered with the event processor occurs.
     * 
     * @param {Event} e 
     */
    _processEvent: function(e) {
        if (Core.Web.Event.debugListenerCount) {
            Core.Debug.consoleWrite("Core.Web.Event listener count: " + Core.Web.Event._listenerCount);        
        }

        e = e ? e : window.event;
        
        if (!e.target && e.srcElement) {
            // The Internet Explorer event model stores the target element in the 'srcElement' property of an event.
            // Modify the event such the target is retrievable using the W3C DOM Level 2 specified property 'target'.
            e.target = e.srcElement;
        }

        // Establish array containing elements ancestry, with index 0 containing 
        // the element and the last index containing its most distant ancestor.  
        // Only record elements that have ids.
        var elementAncestry = [];
        var targetElement = e.target;
        while (targetElement) {
            if (targetElement.__eventProcessorId) { // Element Node with identifier.
                elementAncestry.push(targetElement);
            }
            targetElement = targetElement.parentNode;
        }

        var listenerList, i, propagate = true;

        // Fire event to capturing listeners.
        for (i = elementAncestry.length - 1; i >= 0; --i) {
            listenerList = Core.Web.Event._capturingListenerMap.map[elementAncestry[i].__eventProcessorId];
            if (listenerList) {
                // Set registered target on event.
                e.registeredTarget = elementAncestry[i];
                if (!listenerList.fireEvent(e)) {
                    // Stop propagation if requested.
                    propagate = false;
                    break;
                }
            }
        }

        if (propagate) {
            // Fire event to bubbling listeners.
            for (i = 0; i < elementAncestry.length; ++i) {
                listenerList = Core.Web.Event._bubblingListenerMap.map[elementAncestry[i].__eventProcessorId];
                if (listenerList) {
                    // Set registered target on event.
                    e.registeredTarget = elementAncestry[i];
                    if (!listenerList.fireEvent(e)) {
                        // Stop propagation if requested.
                        break;
                    }
                }
            }
        }

        // Inform DOM to stop propagation of event, in all cases.
        // Event will otherwise be re-processed by higher-level elements registered with the event processor.
        Core.Web.DOM.stopEventPropagation(e);
    },
    
    /**
     * Unregisters an event handler.
     * 
     * CAUTION: If you are unregistering an event listener created with Core.method(), please see the documentation for
     * Core.method() and note that a new closure-wrapped method is returned each time Core.method() is invoked.
     * Thus calling removeListener(Core.method(this, this,_someListener)) will NOT remove an existing listener.
     * The solution to this issue is to retain a reference to Core.method() wrapped listeners within the object
     * that will register and unregister them.
     * 
     * If you are removing all listeners registered for a particular element (e.g., one which is being disposed)
     * it is more efficient to simply invoke removeAll().
     *
     * @param {Element} element the DOM element on which to add the event handler
     * @param {String} eventType the DOM event type
     * @param {Function} eventTarget the function to invoke when the event is fired
     * @param {Boolean} capture true to fire the event during the capturing phase, false to fire the event during
     *        the bubbling phase
     */
    remove: function(element, eventType, eventTarget, capture) {
        Core.Web.Event._lastId = null;
        
        if (!element.__eventProcessorId) {
            return;
        }
    
        // Obtain correct id->ListenerList mapping based on capture parameter.
        var listenerMap = capture ? Core.Web.Event._capturingListenerMap : Core.Web.Event._bubblingListenerMap;
    
        // Obtain ListenerList based on element id.                              
        var listenerList = listenerMap.map[element.__eventProcessorId];
        if (listenerList) {
            // Remove event handler from the ListenerList.
            listenerList.removeListener(eventType, eventTarget);
            
            if (listenerList.isEmpty()) {
                listenerMap.remove(element.__eventProcessorId);
            }

            // Unregister event listener on DOM element if all listeners have been removed.
            if (!listenerList.hasListeners(eventType)) {
                Core.Web.DOM.removeEventListener(element, eventType, Core.Web.Event._processEvent, false);
                --Core.Web.Event._listenerCount;
            }
        }
    },
    
    /**
     * Unregister all event handlers from a specific element.
     * Use of this operation is recommended when disposing of components, it is
     * more efficient than removing listeners individually and guarantees proper clean-up.
     * 
     * @param {Element} element the element
     */
    removeAll: function(element) {
        Core.Web.Event._lastId = null;
        if (!element.__eventProcessorId) {
            return;
        }
        Core.Web.Event._removeAllImpl(element, Core.Web.Event._capturingListenerMap);
        Core.Web.Event._removeAllImpl(element, Core.Web.Event._bubblingListenerMap);
    },
    
    /**
     * Implementation method for removeAll().
     * Removes all capturing or bubbling listeners from a specific element
     * 
     * @param {Element} element the element
     * @param {Core.Arrays.LargeMap} listenerMap the map from which the listeners should be removed, either
     *        Core.Web.Event._capturingListenerMap or Core.Web.Event._bubblingListenerMap
     */
    _removeAllImpl: function(element, listenerMap) {
        var listenerList = listenerMap.map[element.__eventProcessorId];
        if (!listenerList) {
            return;
        }
    
        var types = listenerList.getListenerTypes();
        for (var i = 0; i < types.length; ++i) {
            Core.Web.DOM.removeEventListener(element, types[i], Core.Web.Event._processEvent, false);
            --Core.Web.Event._listenerCount;
        }
        
        listenerMap.remove(element.__eventProcessorId);
    },
    
    /**
     * toString() implementation for debugging purposes.
     * Displays contents of capturing and bubbling listener maps.
     * 
     * @return string representation of listener maps
     * @type String
     */
    toString: function() {
        return "Capturing: " + Core.Web.Event._capturingListenerMap + "\n" + "Bubbling: " + Core.Web.Event._bubblingListenerMap;
    }
};

/**
 * An HTTP connection to the hosting server.  This method provides a cross
 * platform wrapper for XMLHttpRequest and additionally allows method
 * reference-based listener registration.  
 */
Core.Web.HttpConnection = Core.extend({

    /** The URL. */
    _url: null,
    
    /** The request content type. */
    _contentType: null,
    
    /** The request method. */
    _method: null,
    
    /** The message content object. */
    _messageObject: null,
    
    /** Listener storage facility. */
    _listenerList: null,
    
    /** Disposed state. */
    _disposed: false,
    
    /** Browser XMLHttpRequest object. */
    _xmlHttpRequest: null,
    
    /** Request header value map. */
    _requestHeaders: null,

    /**
     * Creates a new <code>HttpConnection</code>.
     * This method simply configures the connection, the connection
     * will not be opened until <code>connect()</code> is invoked.
     *
     * @param {String} url the target URL
     * @param {String} method the connection method, i.e., GET or POST
     * @param messageObject the message to send (may be a String or XML DOM)
     * @param {String} contentType the request content-type
     * @constructor
     */
    $construct: function(url, method, messageObject, contentType) {
        this._url = url;
        this._contentType = contentType;
        this._method = method;
        if (Core.Web.Env.QUIRK_WEBKIT_DOM_TEXT_ESCAPE && messageObject instanceof Document) {
            this._preprocessWebkitDOM(messageObject.documentElement);
        }
        
        this._messageObject = messageObject;
        this._listenerList = new Core.ListenerList();
    },
    
    /**
     * Preprocesses outgoing requests to Webkit (invoked when appropriate quirk is detected).
     * All less than, greater than, and ampersands are replaced with escaped values, as this render engine
     * is broken in this regard and will otherwise fail. Recursively invoked on nodes, starting with
     * document element.
     * 
     * @param {Node} node the node to process
     */
    _preprocessWebkitDOM: function(node) {
        if (node.nodeType == 3) {
            var value = node.data;
            value = value.replace(/&/g, "&amp;");
            value = value.replace(/</g, "&lt;");
            value = value.replace(/>/g, "&gt;");
            node.data = value;
        } else {
            var child = node.firstChild;
            while (child) {
                this._preprocessWebkitDOM(child);
                child = child.nextSibling;
            }
        }
    },
    
    /**
     * Adds a response listener to be notified when a response is received from the connection.
     * 
     * @param {Function} l the listener to add
     */
    addResponseListener: function(l) {
        this._listenerList.addListener("response", l);
    },
    
    /**
     * Executes the HTTP connection.
     * This method will return before the HTTP connection has received a response.
     */
    connect: function() {
        var usingActiveXObject = false;
        if (window.XMLHttpRequest) {
            this._xmlHttpRequest = new XMLHttpRequest();
        } else if (window.ActiveXObject) {
            usingActiveXObject = true;
            this._xmlHttpRequest = new ActiveXObject("Microsoft.XMLHTTP");
        } else {
            throw "Connect failed: Cannot create XMLHttpRequest.";
        }
    
        var instance = this;
        
        // Create closure around instance.
        this._xmlHttpRequest.onreadystatechange = function() { 
            if (!instance) {
                return;
            }
            try {
                instance._processReadyStateChange();
            } finally {
                if (instance._disposed) {
                    // Release instance reference to allow garbage collection.
                    instance = null;
                }
            }
        };
        
        this._xmlHttpRequest.open(this._method, this._url, true);

        // Set headers.
        if (this._requestHeaders && (usingActiveXObject || this._xmlHttpRequest.setRequestHeader)) {
            for(var h in this._requestHeaders) {
                try {
                    this._xmlHttpRequest.setRequestHeader(h, this._requestHeaders[h]);
                } catch (e) {
                    throw new Error("Failed to set header \"" + h + "\"");
                }
            }
        }
        
        // Set Content-Type, if supplied.
        if (this._contentType && (usingActiveXObject || this._xmlHttpRequest.setRequestHeader)) {
            this._xmlHttpRequest.setRequestHeader("Content-Type", this._contentType);
        }

        // Execute request.
        if (Core.Web.Env.QUIRK_SERIALIZE_XML_BEFORE_XML_HTTP_REQ) {
            // serialize before sending
            this._xmlHttpRequest.send(this._messageObject ? new XMLSerializer().serializeToString(this._messageObject) : null);
        } else {
            this._xmlHttpRequest.send(this._messageObject ? this._messageObject : null);
        }
    },
    
    /**
     * Disposes of the connection.  This method must be invoked when the connection 
     * will no longer be used/processed.
     */
    dispose: function() {
        this._listenerList = null;
        this._messageObject = null;
        this._xmlHttpRequest = null;
        this._disposed = true;
        this._requestHeaders = null;
    },
    
    /**
     * Returns a header from the received response.
     * @param {String} header the header to retrieve
     */
    getResponseHeader: function(header) {
        return this._xmlHttpRequest ? this._xmlHttpRequest.getResponseHeader(header) : null;
    },
    
    /**
     * Returns all the headers of the response.
     * @param {String} header the header to retrieve
     */
    getAllResponseHeaders: function() {
        return this._xmlHttpRequest ? this._xmlHttpRequest.getAllResponseHeaders() : null;
    },
    
    /**
     * Returns the response status code of the HTTP connection, if available.
     * 
     * @return the response status code
     * @type Integer
     */
    getStatus: function() {
        return this._xmlHttpRequest ? this._xmlHttpRequest.status : null;
    },
    
    /**
     * Returns the response as text.
     * This method may only be invoked from a response handler.
     *
     * @return the response, as text
     * @type String
     */
    getResponseText: function() {
        return this._xmlHttpRequest ? this._xmlHttpRequest.responseText : null;
    },
    
    /**
     * Returns the response as an XML DOM.
     * This method may only be invoked from a response handler.
     *
     * @return the response, as an XML DOM
     * @type Document
     */
    getResponseXml: function() {
        return this._xmlHttpRequest ? this._xmlHttpRequest.responseXML : null;
    },
    
    /**
     * Event listener for <code>readystatechange</code> events received from
     * the <code>XMLHttpRequest</code>.
     */
    _processReadyStateChange: function() {
        if (this._disposed) {
            return;
        }
        
        if (this._xmlHttpRequest.readyState == 4) {
            var responseEvent;
            try {
                // 0 included as a valid response code for non-served applications.
                var valid = !this._xmlHttpRequest.status ||  
                        (this._xmlHttpRequest.status >= 200 && this._xmlHttpRequest.status <= 299);
                responseEvent = {type: "response", source: this, valid: valid};
            } catch (ex) {
                responseEvent = {type: "response", source: this, valid: false, exception: ex};
            }
            
            Core.Web.Scheduler.run(Core.method(this, function() {
                this._listenerList.fireEvent(responseEvent);
                this.dispose();
            }));
        }
    },
    
    /**
     * Removes a response listener to be notified when a response is received from the connection.
     * 
     * @param {Function} l the listener to remove
     */
    removeResponseListener: function(l) {
        this._listenerList.removeListener("response", l);
    },
    
    /**
     * Sets a header in the request.
     * 
     * @param {String} header the header to retrieve
     * @param {String} value the value of the header
     */
    setRequestHeader: function(header, value) {
        if (!this._requestHeaders) {
            this._requestHeaders = { };
        } 
        this._requestHeaders[header] = value;
    }
});

/**
 * Image-related utilities.
 * @class
 */
Core.Web.Image = {
    
    /**
     * Expiration time, after which an image monitor will give up.
     */
    _EXPIRE_TIME: 5000,
    
    /**
     * Work object for monitorImageLoading() method.
     */
    _Monitor: Core.extend({

        /** Reference to _processImageLoad method. */
        _processImageLoadRef: null,
        
        /** Currently enqueued runnable. */
        _runnable: null,
        
        /** Listener to notify of successful image loadings. */
        _listener: null,
        
        /** Images with remaining load listeners. */
        _images: null,
        
        /** The number of images to be loaded. */
        _count: 0,
        
        /** Expiration time.  When system time is greater than this value, monitor will give up. */
        _expiration: null,
        
        /** Flag indicating whether one or more images have been loaded since last update. */ 
        _imagesLoadedSinceUpdate: false,
        
        /**
         * Creates a new image monitor.
         * 
         * @param {Element} element the root element which may (or may not) contain IMG elements
         * @param {Function} listener the method to invoke when images are loaded
         * @param {Number} interval the minimum time interval at which to notify the listener of successfully loaded images
         */
        $construct: function(element, listener, interval) {
            this._listener = listener;
            this._processImageLoadRef = Core.method(this, this._processImageLoad);
            
            this._runnable = new Core.Web.Scheduler.MethodRunnable(Core.method(this, this._updateProgress), interval || 250, true);
            
            // Find all images beneath element, register load listeners on all which are not yet loaded.
            var nodeList = element.getElementsByTagName("img");
            this._images = [];
            for (var i = 0; i < nodeList.length; ++i) {
                if (!nodeList[i].complete && (Core.Web.Env.QUIRK_UNLOADED_IMAGE_HAS_SIZE || 
                        (!nodeList[i].height && !nodeList[i].style.height))) {
                    this._images.push(nodeList[i]);
                    Core.Web.Event.add(nodeList[i], "load", this._processImageLoadRef, false);
                }
            }
            
            this._count = this._images.length;
            if (this._count > 0) {
                this._expiration = new Date().getTime() + Core.Web.Image._EXPIRE_TIME;
                Core.Web.Scheduler.add(this._runnable);
            }
        },
        
        /**
         * Process an image loading event.
         * 
         * @param e the event object
         */
        _processImageLoad: function(e) {
            e = e ? e : window.event;
            var image = Core.Web.DOM.getEventTarget(e);
            
            this._imagesLoadedSinceUpdate = true;
            
            // Remove listener.
            Core.Web.Event.remove(image, "load", this._processImageLoadRef, false);
            
            // Remove image from list of images to be loaded.
            Core.Arrays.remove(this._images, image);
            
            // Decrement remaining image count.
            --this._count;
            
            // If runnable is enqueued and no more images now remain to be loaded,
            // remove the enqueued runnable, perform immediate notification.
            if (this._count === 0) {
                this._stop();
                this._notify();
            }
        },
        
        /**
         * Notifies the listener of images having been loaded or expiration of the monitor. 
         */
        _notify: function() {
            Core.Web.Scheduler.run(Core.method(this, function() {
                this._listener({
                    source: this,
                    type: "imageLoad",
                    expired: this._expired,
                    complete: this._expired || this._count === 0
                });
            }));
        },
        
        /**
         * Stops monitoring.
         */
        _stop: function() {
            // Remove runnable.
            Core.Web.Scheduler.remove(this._runnable);
            this._runnable = null;
            
            // Disconnect listeners from images.
            for (var i = 0; i < this._images.length; ++i) {
                Core.Web.Event.remove(this._images[i], "load", this._processImageLoadRef, false);
            }
        },
        
        /**
         * Scheduled method invoked at intervals to monitor progress.
         */
        _updateProgress: function() {
            // Stop if beyond expiration time.
            if (new Date().getTime() > this._expiration) {
                this._expired = true;
                this._stop();
                this._notify();
                return;
            }
            
            // Perform notification if new images have loaded.
            if (this._imagesLoadedSinceUpdate) {
                this._imagesLoadedSinceUpdate = false;
                this._notify();
            }
        }
    }),
    
    /**
     * Registers a listener to receive notifications as image size information becomes available.
     * Registers "load" listeners on images which are children of the specified element, invoking the specified listener
     * zero or more times as the images load.  If all images are already loaded (e.g., they were cached) or have specified 
     * sizes, the listener may never be invoked.  If the images take some time to load, the listener may be invoked multiple times.
     * 
     * @param {Element} element the root element which may (or may not) contain IMG elements
     * @param {Function} l the method to invoke when images are loaded.
     * @param {Number} interval the maximum time interval at which the listener should be invoked (default value is 50ms, 
     *        the listener will be invoked immediately once all images have loaded)
     * @return true if images are waiting to be loaded
     */
    monitor: function(element, l, interval) {
        var monitor = new Core.Web.Image._Monitor(element, l, interval);
        return monitor._count > 0;
    }
};

Core.Web.Key = {
    
    _KEY_TABLES: {
        
        GECKO: { 
            59: 186, 
            61: 187,
            109: 189
        },
        
        MAC_GECKO: {
        },
        
        PRESTO: {
            59: 186,
            61: 187,
            44: 188,
            45: 189,
            46: 190,
            47: 191,
            96: 192,
            91: 219,
            92: 220,
            93: 221,
            39: 222
        },
        
        WEBKIT: {
        }
    },
    
    _keyTable: null,
    
    _loadKeyTable: function() {
        if (Core.Web.Env.ENGINE_GECKO) {
            this._keyTable = this._KEY_TABLES.GECKO;
        } else if(Core.Web.Env.ENGINE_PRESTO) {
            this._keyTable = this._KEY_TABLES.PRESTO;
        } else {
            this._keyTable = { };
        }
    },

    translateKeyCode: function(keyCode) {
        if (!this._keyTable) {
            this._loadKeyTable();
        }
        return this._keyTable[keyCode] || keyCode;
    }
};

/**
 * Utilities for dynamically loading additional script libraries.
 * @class
 */
Core.Web.Library = {

    /**
     * Set of loaded libraries (keys are library urls, value is true when library has been loaded).
     */
    _loadedLibraries: { },
    
    /**
     * Determined source code line number of eval() library load statement (useful for debugging on browsers which do not 
     * properly report line numbers for evaluated scripts).
     * @type Number
     */
    evalLine: null,
    
    /**
     * A representation of a group of libraries to be loaded at the same time.
     * Libraries will be retrieved asynchronously, and then installed once ALL the libraries have
     * been retrieved.  Installation will be done in the order in which the add() method was
     * invoked to add libraries to the group (without regard for the order in which the 
     * HTTP server returns the library code).
     * 
     * A "load" event will be fired (listeners registered via <code>addLoadListener()</code>) when the group
     * has completed loading and the libraries have been installed.  The "success" property of the fired event
     * will be set to true in the event that all libraries were successfully loaded, and false otherwise.
     * In the event of a library loading failure, the following properties will be available in the event:
     * <ul>
     *  <li><code>url</code>: the URL of the failed library.</li>
     *  <li><code>ex</code>: the exception which occurred when attempting to load the library.</li>
     *  <li><code>cancel</code>: a boolean flag, initially set to false, which may be set to true to avoid
     *   having the library loader throw an exception for the failure.  If unset, the exception will be thrown.</li>
     * </ul>
     */
    Group: Core.extend({
    
        /** Listener storage. */
        _listenerList: null,
        
        /**
         * Array of libraries to be loaded.
         * @type Array
         */
        _libraries: null,
        
        /** Number of libraries which have been loaded. */
        _loadedCount: 0,
        
        /** Number of libraries to load. */
        _totalCount: 0,
    
        /**
         * Creates a new library group.
         * @constructor 
         */
        $construct: function() {
            this._listenerList = new Core.ListenerList();
            this._libraries = [];
        },
        
        /**
         * Adds a library to the library group.
         * Libraries which have previously been loaded will not be loaded again.
         *
         * @param {String} libraryUrl the URL from which to retrieve the library.
         */
        add: function(libraryUrl) {
            if (Core.Web.Library._loadedLibraries[libraryUrl]) {
                // Library already loaded: ignore.
                return;
            }
            
            var libraryItem = new Core.Web.Library._Item(this, libraryUrl);
            this._libraries.push(libraryItem);
        },
        
        /**
         * Adds a listener to be notified when all libraries in the group have been loaded.
         *
         * @param {Function} l the listener to add
         */
        addLoadListener: function(l) {
            this._listenerList.addListener("load", l);
        },
        
        /**
         * Determines if this library group contains any new (not previously loaded)
         * libraries.
         * 
         * @return true if any new libraries exist
         * @type Boolean
         */
        hasNewLibraries: function() {
            return this._libraries.length > 0;
        },
        
        /**
         * Installs all libraries in the group.
         * This method is invoked once all libraries have been successfully
         * retrieved.  It will invoke any registered load listeners
         * once the libraries have been installed.
         */
        _install: function() {
            for (var i = 0; i < this._libraries.length; ++i) {
                try {
                    this._libraries[i]._install();
                } catch (ex) {
                    var e = {
                        type: "load", 
                        source: this, 
                        success: false, 
                        ex: ex, 
                        url: this._libraries[i]._url,
                        cancel: false
                    };
                    try {
                        this._listenerList.fireEvent(e);
                    } finally {
                        if (!e.cancel) {
                            throw new Error("Exception installing library \"" + this._libraries[i]._url + "\"; " + ex);
                        }
                    }
                }
            }
            this._listenerList.fireEvent({type: "load", source: this, success: true});
        },
        
        /**
         * Event listener invoked when a single library has been successfully retrieved.
         * When all libraries have been retrieved, this method will invoke _install().
         */
        _notifyRetrieved: function() {
            ++this._loadedCount;
            if (this._loadedCount == this._totalCount) {
                this._install();
            }
        },
        
        /**
         * Initializes library loading.  When this method is invoked
         * the libraries will be asynchronously loaded.  This method
         * will return before the libraries have been loaded.
         * Once this method has been invoked, add() may no longer
         * be invoked.
         */
        load: function() {
            this._totalCount = this._libraries.length;
            for (var i = 0; i < this._libraries.length; ++i) {
                this._libraries[i]._retrieve();
            }
        },
        
        /**
         * Removes a listener from being notified when all libraries in the group have been loaded.
         *
         * @param {Function} l the listener to remove
         */
        removeLoadListener: function(l) {
            this._listenerList.removeListener("load", l);
        }
    }),

    /**
     * Representation of a single library to be loaded within a group
     */    
    _Item: Core.extend({
    
        /** URL Of library to load. */
        _url: null,
        
        /** Containing library group. */
        _group: null,
        
        /** 
         * Loaded library content (set when retrieved). 
         * @type String
         */
        _content: null,
    
        /**
         * Creates a new library item.
         * 
         * @param {Core.Web.Library.Group} group the library group in which the item is contained
         * @param {String} url the URL from which the library may be retrieved
         * @constructor
         */
        $construct: function(group, url) {
            this._url = url;
            this._group = group;
        },
        
        /**
         * Event listener for response from the HttpConnection used to retrieve the library.
         * 
         * @param e the event
         */
        _retrieveListener: function(e) {
            if (!e.valid) {
                throw new Error("Invalid HTTP response retrieving library \"" + this._url + 
                        "\", received status: " + e.source.getStatus());
            }
            this._content = e.source.getResponseText();
            this._group._notifyRetrieved();
        },
        
        /**
         * Installs the library.
         * The library must have been loaded before invoking this method.
         */
        _install: function() {
            if (Core.Web.Library._loadedLibraries[this._url]) {
                // If library was already loaded by another invocation, do not load it again.
                return;
            }
            Core.Web.Library._loadedLibraries[this._url] = true;
            if (this._content == null) {
                throw new Error("Attempt to install library when no content has been loaded.");
            }
            
            // Execute content to install library.
            Core.Web.Library.evalLine = new Error().lineNumber + 1;
            eval(this._content);
        },
        
        /**
         * Asynchronously retrieves the library.
         * This method will invoke the retrieve listener when the library has been completed,
         * it will return before the library has been retrieved.
         */
        _retrieve: function() {
            var conn = new Core.Web.HttpConnection(this._url, "GET");
            conn.addResponseListener(Core.method(this, this._retrieveListener));
            conn.connect();
        }
    }),
    
    /**
     * Loads required libraries and then executes a function.
     * This is a convenience method for use by applications that
     * automatically creates a Group and invokes the specified function
     * once the libraries have loaded.
     * This operation is asynchronous, this method will return before the specified function has been invoked.
     * Any libraries which have already been loaded will NOT be re-loaded.
     *
     * @param {Array} requiredLibraries the URLs of the libraries which must be loaded before the function can execute
     * @param {Function} f the function to execute
     */
    exec: function(requiredLibraries, f) {
        var group = null;
        for (var i = 0; i < requiredLibraries.length; ++i) {
            if (!Core.Web.Library._loadedLibraries[requiredLibraries[i]]) {
                if (group == null) {
                    group = new Core.Web.Library.Group();
                }
                group.add(requiredLibraries[i]);
            }
        }
        
        if (group == null) {
            Core.Web.Scheduler.run(f);
            return;
        }
        
        group.addLoadListener(f);
        group.load();
    }
};

/**
 * Namespace for measuring-related operations.
 * @class
 */
Core.Web.Measure = {

    _scrollElements: ["div", "body"],

    /** Size of one inch in horizontal pixels. */
    _hInch: 96,
    
    /** Size of one inch in vertical pixels. */
    _vInch: 96,
    
    /** Size of one 'ex' in horizontal pixels. */
    _hEx: 7,
    
    /** Size of one 'ex' in vertical pixels. */
    _vEx: 7,
    
    /** Size of one 'em' in horizontal pixels. */
    _hEm: 13.3333,
    
    /** Size of one 'em' in vertical pixels. */
    _vEm: 13.3333,
    
    /** Estimated scroll bar width. */
    SCROLL_WIDTH: 17,
    
    /** Estimated scroll bar height. */
    SCROLL_HEIGHT: 17,
    
    _PARSER: /^(-?\d+(?:\.\d+)?)(.+)?$/,

    /**
     * Converts any non-relative extent value to pixels.  Returns null in the case of a percentage extent.
     * 
     * @param {String} value a unitized extent value, e.g., "2px", "5em", etc.
     * @param {Boolean} horizontal a flag indicating whether the extent is horizontal (true) or vertical (false)
     * @return the pixel value (may have a fractional part)
     * @type Number
     */
    extentToPixels: function(extent, horizontal) {
        var parts = this._PARSER.exec(extent);
        if (!parts) {
            throw new Error("Invalid Extent: " + extent);
        }
        var value = parseFloat(parts[1]);
        var units = parts[2] ? parts[2] : "px";

        if (!units || units == "px") {
            return value;
        }
        var dpi = horizontal ? Core.Web.Measure._hInch : Core.Web.Measure._vInch;
        switch (units) {
        case "%":  return null;
        case "in": return value * (horizontal ? Core.Web.Measure._hInch : Core.Web.Measure._vInch);
        case "cm": return value * (horizontal ? Core.Web.Measure._hInch : Core.Web.Measure._vInch) / 2.54;
        case "mm": return value * (horizontal ? Core.Web.Measure._hInch : Core.Web.Measure._vInch) / 25.4;
        case "pt": return value * (horizontal ? Core.Web.Measure._hInch : Core.Web.Measure._vInch) / 72;
        case "pc": return value * (horizontal ? Core.Web.Measure._hInch : Core.Web.Measure._vInch) / 6;
        case "em": return value * (horizontal ? Core.Web.Measure._hEm   : Core.Web.Measure._vEm);
        case "ex": return value * (horizontal ? Core.Web.Measure._hEx   : Core.Web.Measure._vEx);
        }
    },

    /**
     * Updates internal measures used in converting length units 
     * (e.g., in, mm, ex, and em) to pixels.
     * Automatically invoked when Core.Web module is initialized.
     */
    _calculateExtentSizes: function() {
        var containerElement = document.getElementsByTagName("body")[0];
    
        var inchDiv4 = document.createElement("div");
        inchDiv4.style.width = "4in";
        inchDiv4.style.height = "4in";
        containerElement.appendChild(inchDiv4);
        Core.Web.Measure._hInch = inchDiv4.offsetWidth / 4;
        Core.Web.Measure._vInch = inchDiv4.offsetHeight / 4;
        containerElement.removeChild(inchDiv4);
        
        var emDiv24 = document.createElement("div");
        emDiv24.style.width = "24em";
        emDiv24.style.height = "24em";
        containerElement.appendChild(emDiv24);
        Core.Web.Measure._hEm = emDiv24.offsetWidth / 24;
        Core.Web.Measure._vEm = emDiv24.offsetHeight / 24;
        containerElement.removeChild(emDiv24);
        
        var exDiv24 = document.createElement("div");
        exDiv24.style.width = "24ex";
        exDiv24.style.height = "24ex";
        containerElement.appendChild(exDiv24);
        Core.Web.Measure._hEx = exDiv24.offsetWidth / 24;
        Core.Web.Measure._vEx = exDiv24.offsetHeight / 24;
        containerElement.removeChild(exDiv24);
        
        var scrollDiv = document.createElement("div");
        scrollDiv.style.cssText = "width:500px;height:100px;overflow:auto;";
        var largeDiv = document.createElement("div");
        largeDiv.style.cssText = "width:100px;height:200px;";
        scrollDiv.appendChild(largeDiv);
        var testDiv = document.createElement("div");
        testDiv.style.cssText = "width:100%;height:10px;";
        scrollDiv.appendChild(testDiv);
        containerElement.appendChild(scrollDiv);
        var measuredWidth = 500 - testDiv.offsetWidth;
        if (measuredWidth) {
            Core.Web.Measure.SCROLL_WIDTH = Core.Web.Measure.SCROLL_HEIGHT = measuredWidth;
        }
        containerElement.removeChild(scrollDiv);
    },
    
    /**
     * Measures the scrollbar offset of an element, including any
     * scroll-bar related offsets of its ancestors.
     * 
     * @param element the element to measure
     * @return the offset data, with 'left' and 'top' properties specifying the offset amounts
     * @type Object
     */
    _getScrollOffset: function(element) {
        var valueT = 0, valueL = 0;
        do {
            if (element.scrollLeft || element.scrollTop) {
                valueT += element.scrollTop  || 0;
                valueL += element.scrollLeft || 0; 
            }
            element = element.offsetParent;
        } while (element);
        return { left: valueL, top: valueT };
    },
    
    /**
     * Measures the cumulative offset of an element.
     * 
     * @param element the element to measure
     * @return the offset data, with 'left' and 'top' properties specifying the offset amounts
     * @type Object
     */
    _getCumulativeOffset: function(element) {
        var valueT = 0, 
            valueL = 0,
            init = true;
        do {
            valueT += element.offsetTop  || 0;
            valueL += element.offsetLeft || 0;
            if (!init && Core.Web.Env.MEASURE_OFFSET_EXCLUDES_BORDER) {
                if (element.style.borderLeftWidth && element.style.borderLeftStyle != "none") {
                    var borderLeft = Core.Web.Measure.extentToPixels(element.style.borderLeftWidth, true);
                    valueL += borderLeft;
                    if (Core.Web.Env.QUIRK_MEASURE_OFFSET_HIDDEN_BORDER && element.style.overflow == "hidden") {
                        valueL += borderLeft;
                    }
                }
                if (element.style.borderTopWidth && element.style.borderTopStyle != "none") {
                    var borderTop = Core.Web.Measure.extentToPixels(element.style.borderTopWidth, false);
                    valueT += borderTop;
                    if (Core.Web.Env.QUIRK_MEASURE_OFFSET_HIDDEN_BORDER && element.style.overflow == "hidden") {
                        valueT += borderTop;
                    }
                }
            }
            init = false;
            element = element.offsetParent;
        } while (element);
        return { left: valueL, top: valueT };
    },

    /**
     * Measures the boundaries of an element,i.e., its left and top position and/or
     * width and height.  If the element is not attached to the rendered DOM hierarchy,
     * the element will be temporarily removed from its hierarchy and placed in an
     * off-screen buffer for measuring.
     */
    Bounds: Core.extend({

        $static: {
            /**
             * Flag indicating that the dimension of elements should be calculated.
             */
            FLAG_MEASURE_DIMENSION: 0x1,
            
            /**
             * Flag indicating that the position of elements should be calculated.
             */
            FLAG_MEASURE_POSITION: 0x2,
            
            _initMeasureContainer: function() {
                // Create off-screen div element for evaluating sizes.
                this._offscreenDiv = document.createElement("div");
                this._offscreenDiv.style.cssText = 
                        "position: absolute; top: -1300px; left: -1700px; width: 1600px; height: 1200px;";
                document.body.appendChild(this._offscreenDiv);
            }
        },

        /**
         * The width of the element, in pixels.
         * @type Integer
         */
        width: null,
        
        /**
         * The height of the element, in pixels.
         * @type Integer
         */
        height: null,
        
        /**
         * The top coordinate of the element, in pixels relative to the upper-left corner of the interior of the window.
         * @type Integer
         */
        top: null,
         
        /**
         * The left coordinate of the element, in pixels relative to the upper-left corner of the interior of the window.
         * @type Integer
         */
        left: null,

        /**
         * Creates a new Bounds object to calculate the size and/or position of an element.
         * 
         * @param element the element to measure.
         * @param constraints an object containing width and or height properties specifying size of region in which to measure
         *        the element
         * @constructor
         */    
        $construct: function(element, constraints) {
            var flags = (constraints && constraints.flags) || 
                    (Core.Web.Measure.Bounds.FLAG_MEASURE_DIMENSION | Core.Web.Measure.Bounds.FLAG_MEASURE_POSITION);

            if (element === document.body) {
                return { 
                    x: 0,
                    y: 0,
                    height: window.innerHeight || document.documentElement.clientHeight,
                    width: window.innerWidth || document.documentElement.clientWidth
                };
            }
            
            var testElement = element;
            while (testElement && testElement != document) {
                testElement = testElement.parentNode;
            }
            var rendered = testElement == document;
            
            var parentNode, nextSibling;
            
            if (flags & Core.Web.Measure.Bounds.FLAG_MEASURE_DIMENSION) {
                if (!rendered) {
                    // Element must be added to off-screen element for measuring.
                    
                    // Store parent node and next sibling such that element may be replaced into proper position
                    // once off-screen measurement has been completed.
                    parentNode = element.parentNode;
                    nextSibling = element.nextSibling;
            
                    // Remove element from parent.
                    if (parentNode) {
                        parentNode.removeChild(element);
                    }
                    
                    if (constraints) {
                        if (constraints.width) {
                            Core.Web.Measure.Bounds._offscreenDiv.width = constraints.width;
                        }
                        if (constraints.height) {
                            Core.Web.Measure.Bounds._offscreenDiv.height = constraints.height;
                        }
                    }
                    
                    // Append element to measuring container DIV.
                    Core.Web.Measure.Bounds._offscreenDiv.appendChild(element);
                    
                    if (constraints) {
                        Core.Web.Measure.Bounds._offscreenDiv.width = "1600px";
                        Core.Web.Measure.Bounds._offscreenDiv.height = "1200px";
                    }
                }
                
                // Store width and height of element.
                this.width = element.offsetWidth;
                this.height = element.offsetHeight;
                
                if (!rendered) {
                    // Replace off-screen measured element in previous location.
                    Core.Web.Measure.Bounds._offscreenDiv.removeChild(element);
                    if (parentNode) {
                        parentNode.insertBefore(element, nextSibling);
                    }
                }
            }

            // Determine top and left positions of element if rendered on-screen.
            if (rendered && (flags & Core.Web.Measure.Bounds.FLAG_MEASURE_POSITION)) {
                var cumulativeOffset = Core.Web.Measure._getCumulativeOffset(element);
                var scrollOffset = Core.Web.Measure._getScrollOffset(element);
        
                this.top = cumulativeOffset.top - scrollOffset.top;
                this.left = cumulativeOffset.left - scrollOffset.left;
            }
        },
        
        /**
         * toString() implementation for debug purposes.
         * 
         * @return a string representation of the object
         * @type String
         */
        toString: function() {
            return (this.left != null ? (this.left + "," + this.top + " : ") : "") + 
                    (this.width != null ? ("[" + this.width + "x" + this.height + "]") : "");
        }
    })
};

/**
 * Scheduler namespace.
 * Provides capability to invoke code at regular intervals, after a delay, 
 * or after the current JavaScript execution context has completed.
 * Provides an object-oriented means of accomplishing this task.
 */
Core.Web.Scheduler = {
    
    /**
     * Collection of runnables to execute.
     */
    _runnables: [],
    
    /**
     * The thread handle returned by setTimeout().
     */ 
    _threadHandle: null,
    
    /**
     * Time at which next execution of the scheduler should occur.
     * When this field is not null, the _threadHandle field contains a
     * timeout scheduled to occur at this time.
     */
    _nextExecution: null,
    
    /**
     * Enqueues a Runnable to be executed by the scheduler.
     * If the runnable is currently enqueued, it will be removed and re-enqueued.  It will be next be invoked
     * after its specified time interval.
     * 
     * @param {Core.Web.Scheduler.Runnable} runnable the runnable to enqueue
     */
    add: function(runnable) {
        Core.Arrays.remove(Core.Web.Scheduler._runnables, runnable);
        runnable._nextExecution = new Date().getTime() + (runnable.timeInterval ? runnable.timeInterval : 0);
        Core.Web.Scheduler._runnables.push(runnable);
        Core.Web.Scheduler._setTimeout(runnable._nextExecution);
    },

    /**
     * Executes the scheduler, running any runnables that are due.
     * DESIGN NOTE: this method MUST ONLY be invoked by the timeout handle Core.Web.Scheduler._threadHandle.
     */
    _execute: function() {
        // Mark now-defunct timeout thread handle as null, because this method was invoked by it.
        Core.Web.Scheduler._threadHandle = null;
        
        var currentTime = new Date().getTime();
        var nextInterval = Number.MAX_VALUE;
        var i, runnable;
        
        // Execute pending runnables.
        for (i = 0; i < Core.Web.Scheduler._runnables.length; ++i) {
            runnable = Core.Web.Scheduler._runnables[i];
            if (runnable && runnable._nextExecution && runnable._nextExecution <= currentTime) {
                runnable._nextExecution = null;
                try {
                    runnable.run();
                } catch (ex) {
                    throw(ex);
                }
            }
        }

        var newRunnables = [];
        for (i = 0; i < Core.Web.Scheduler._runnables.length; ++i) {
            runnable = Core.Web.Scheduler._runnables[i];
            if (runnable == null) {
                continue;
            }

            if (runnable._nextExecution) {
                // Runnable is scheduled for execution: add it to new queue.
                newRunnables.push(runnable);
                
                // Determine time interval of this runnable, if it is the soonest to be executed, use its execution time
                // as the setTimeout delay.
                var interval = runnable._nextExecution - currentTime;
                if (interval < nextInterval) {
                    nextInterval = interval;
                }
                
                // Done processing this runnable.
                continue;
            }
            
            if (runnable.timeInterval != null && runnable.repeat) {
                // Runnable is executed at a repeating interval but is not scheduled: schedule it for execution.
                runnable._nextExecution = currentTime + runnable.timeInterval;
                newRunnables.push(runnable);
                
                // If this is the next runnable to be executed, use its execution time as the setTimeout delay.
                if (runnable.timeInterval < nextInterval) {
                    nextInterval = runnable.timeInterval;
                }
            }
        }
    
        // Store new runnable queue.
        Core.Web.Scheduler._runnables = newRunnables;
        
        if (nextInterval < Number.MAX_VALUE) {
            Core.Web.Scheduler._setTimeout(currentTime + nextInterval);
        }
    },
    
    /**
     * Dequeues a Runnable so it will no longer be executed by the scheduler.
     * 
     * @param {Core.Web.Scheduler.Runnable} runnable the runnable to dequeue
     */
    remove: function(runnable) {
        var index = Core.Arrays.indexOf(Core.Web.Scheduler._runnables, runnable);
        Core.Web.Scheduler._runnables[index] = null;
    },
    
    /**
     * Creates a new Runnable that executes the specified method and enqueues it into the scheduler.
     * 
     * @param {Number} time the time interval, in milliseconds, after which the Runnable should be executed
     *        (may be null/undefined to execute task immediately, in such cases repeat must be false)
     * @param {Boolean} repeat a flag indicating whether the task should be repeated
     * @param f a function to invoke, may be null/undefined
     * @return the created Runnable.
     * @type Core.Web.Scheduler.Runnable 
     */
    run: function(f, timeInterval, repeat) {
        var runnable = new Core.Web.Scheduler.MethodRunnable(f, timeInterval, repeat);
        Core.Web.Scheduler.add(runnable);
        return runnable;
    },
    
    /**
     * Starts the scheduler "thread", to execute at the specified time.
     * If the specified time is in the past, it will execute with a delay of 0.
     * 
     * @param {Number} nextExecution next execution time (milliseconds since epoch)
     */
    _setTimeout: function(nextExecution) {
        if (Core.Web.Scheduler._threadHandle != null && Core.Web.Scheduler._nextExecution < nextExecution) {
            // The current timeout will fire before nextExecution, thus no work needs to be done here.
            return;
        }
        
        if (Core.Web.Scheduler._threadHandle != null) {
            // Clear any existing timeout.
            window.clearTimeout(Core.Web.Scheduler._threadHandle);
        }
        
        var currentTime = new Date().getTime();
        Core.Web.Scheduler._nextExecution = nextExecution;
        var timeout = nextExecution - currentTime > 0 ? nextExecution - currentTime : 0;
        Core.Web.Scheduler._threadHandle = window.setTimeout(Core.Web.Scheduler._execute, timeout);
    },
    
    /**
     * Updates a previously added runnable to be executed based on its <code>timeInterval</code> setting.
     * Performs no action if specified runnable is not currently enqueued.
     * 
     * @param {Core.Web.Scheduler.Runnable} runnable the runnable to update
     */
    update: function(runnable) {
        if (Core.Arrays.indexOf(Core.Web.Scheduler._runnables, runnable) == -1) {
            return;
        }
        var currentTime = new Date().getTime();
        var timeInterval = runnable.timeInterval ? runnable.timeInterval : 0;
        runnable._nextExecution = currentTime + timeInterval;
        Core.Web.Scheduler._setTimeout(runnable._nextExecution);
    }
};

/**
 * A runnable task that may be scheduled with the Scheduler.
 */
Core.Web.Scheduler.Runnable = Core.extend({
    
    /** Next execution time (milliseconds since epoch) */
    _nextExecution: null,
    
    $virtual: {

        /** 
         * Time interval, in milliseconds after which the Runnable should be executed.
         * @type Number
         */
        timeInterval: null,
        
        /**
         * Flag indicating whether task should be repeated.
         * @type Boolean
         */
        repeat: false
    },

    $abstract: {
        
        /** Performs work, provided by derived object. */
        run: function() { }
    }
});

/**
 * A runnable task implementation that invokes a function at regular intervals.
 */
Core.Web.Scheduler.MethodRunnable = Core.extend(Core.Web.Scheduler.Runnable, {

    /**
     * The function to invoke.
     * @type Function
     */
    f: null,

    /**
     * Creates a new Runnable.
     *
     * @constructor
     * @param {Number} time the time interval, in milliseconds, after which the Runnable should be executed
     *        (may be null/undefined to execute task immediately, in such cases repeat must be false)
     * @param {Boolean} repeat a flag indicating whether the task should be repeated
     * @param {Function} f a function to invoke, may be null/undefined
     */
    $construct: function(f, timeInterval, repeat) {
        if (!timeInterval && repeat) {
            throw new Error("Cannot create repeating runnable without time delay:" + f);
        }
        this.f = f;
        this.timeInterval = timeInterval;
        this.repeat = !!repeat;
    },

    $virtual: {
        
        /**
         * Default run() implementation. Should be overridden by subclasses.
         */
        run: function() {
            this.f();
        }
    }
});

/**
 * Static object/namespace which provides cross-platform CSS positioning 
 * capabilities. Do not instantiate.
 * <p>
 * Internet Explorer 6 is ordinarily handicapped by its lack
 * of support for setting 'left' and 'right' or 'top' and 'bottom' positions
 * simultaneously on a single document element.
 * <p> 
 * To use virtual positioning, simply set the left/right/top/bottom
 * coordinates of an element and invoke redraw().  The redraw() method
 * must be invoked whenever the size of the element should be redrawn,
 * e.g., when the screen or its containing element resizes.
 * @class
 */
Core.Web.VirtualPosition = {

    /** Array containing vertical offset attributes to be added to calculation. */ 
    _OFFSETS_VERTICAL: ["paddingTop", "paddingBottom", "marginTop", "marginBottom", "borderTopWidth", "borderBottomWidth"],
            
    /** Array containing horizontal offset attributes to be added to calculation. */ 
    _OFFSETS_HORIZONTAL: ["paddingLeft", "paddingRight", "marginLeft", "marginRight", "borderLeftWidth", "borderRightWidth"],
    
    /** Flag indicating whether virtual positioning is required/enabled. */
    enabled: false,
    
    /**
     * Calculates horizontal or vertical padding, border, and margin offsets for a particular style.
     *
     * @param offsetNames the names of the offsets styles to calculate, either
     *        _OFFSETS_VERTICAL or _OFFSETS_HORIZONTAL.
     * @param style the style whose offsets should be calculated
     * @return the pixel size of the offsets, or -1 if they cannot be calculated
     */
    _calculateOffsets: function(offsetNames, style) {
        var offsets = 0;
        for (var i = 0; i < offsetNames.length; ++i) {
            var value = style[offsetNames[i]];
            if (value) {
                if (value.toString().indexOf("px") == -1) {
                    return -1;
                }
                offsets += parseInt(value, 10);
            }
        }
        return offsets;
    },
    
    /**
     * Enables and initializes the virtual positioning system.
     */
    _init: function() {
        this.enabled = true;
    },
    
    /**
     * Redraws elements registered with the virtual positioning system.
     * Adjusts the style.height and style.width attributes of an element to 
     * simulate its specified top, bottom, left, and right CSS position settings
     * The calculation makes allowances for padding, margin, and border width.
     *
     * @param element the element to redraw
     */
    redraw: function(element) {
        if (!this.enabled) {
            return;
        }
    
        if (!element || !element.parentNode) {
            return;
        }
        
        var offsets;
    
        // Adjust 'height' property if 'top' and 'bottom' properties are set, 
        // and if all padding/margin/borders are 0 or set in pixel units.
        if (this._verifyPixelValue(element.style.top) && this._verifyPixelValue(element.style.bottom)) {
            // Verify that offsetHeight is valid, and do nothing if it cannot be calculated.
            // Such a do-nothing scenario is due to a not-up-to-date element cache,  where
            // the element is no longer hierarchy.
            var offsetHeight = element.parentNode.offsetHeight;
            if (!isNaN(offsetHeight)) {
                offsets = this._calculateOffsets(this._OFFSETS_VERTICAL, element.style);
                if (offsets != -1) {
                    var calculatedHeight = offsetHeight - parseInt(element.style.top, 10) - 
                            parseInt(element.style.bottom, 10) - offsets;
                    if (calculatedHeight <= 0) {
                        element.style.height = 0;
                    } else {
                        if (element.style.height != calculatedHeight + "px") {
                            element.style.height = calculatedHeight + "px";
                        }
                    }
                }
            }
        }
        
        // Adjust 'width' property if 'left' and 'right' properties are set, 
        // and if all padding/margin/borders are 0 or set in pixel units.
        if (this._verifyPixelValue(element.style.left) && this._verifyPixelValue(element.style.right)) {
            // Verify that offsetHeight is valid, and do nothing if it cannot be calculated.
            // Such a do-nothing scenario is due to a not-up-to-date element cache,  where
            // the element is no longer hierarchy.
            var offsetWidth = element.parentNode.offsetWidth;
            if (!isNaN(offsetWidth)) {
                offsets = this._calculateOffsets(this._OFFSETS_HORIZONTAL, element.style);
                if (offsets != -1) {
                    var calculatedWidth = offsetWidth - parseInt(element.style.left, 10) - 
                            parseInt(element.style.right, 10) - offsets;
                    if (calculatedWidth <= 0) {
                        element.style.width = 0;
                    } else {
                        if (element.style.width != calculatedWidth + "px") {
                            element.style.width = calculatedWidth + "px";
                        }
                    }
                }
            }
        }
    },
    
    /** 
     * Determines if the specified value contains a pixel dimension, e.g., "20px"
     * Returns false if the value is null/whitespace/undefined.
     *
     * @param value the value to evaluate
     * @return true if the value is a pixel dimension, false if it is not
     */
    _verifyPixelValue: function(value) {
        if (value == null || value === "") {
            return false;
        }
        var valueString = value.toString();
        return valueString == "0" || valueString.indexOf("px") != -1;
    }
};
/**
 * @fileoverview
 * Application framework main module.
 * Requires Core.
 */

/**
 * Main namespace of Echo framework.
 * @namespace
 */
Echo = { };

/**
 * Representation of a single application instance.
 * Derived objects must invoke constructor with root component id.
 * 
 * @event componentUpdate An event fired when any component within the application is updated.
 *        Listening for this event may degrade the performance of an application, due to the
 *        frequency with which it will be fired.
 * @event focus An event fired when the focused component of the application changes.
 * @event modal An event fired when the modal state of the application changes.
 */
Echo.Application = Core.extend({
    
    $static: {

        /**
         * Next unique identifier.
         */
        _nextUid: 1,
    
        /**
         * Generates a unique identifier.  Identifiers are unique for the duration of the existence of this namespace.
         */
        generateUid: function() {
            return this._nextUid++;
        }
    },
    
    $abstract: true,
    
    $virtual: {
    
        /**
         * Performs application initialization operations.  This method should be provided by an application implementation
         * if required.  The superclass' <code>init()</code> method should always be invoked out of convention.
         * The <code>client</code> property will be available. 
         */
        init: function() { },
        
        /**
         * Performs application disposal/resource cleanup operations. This method should be provided by an application
         * implementation if required. The superclass' <code>dispose()</code> method should always be invoked out of convention.
         * The <code>client</code> property will be available.
         */
        dispose: function() { },
        
        /**
         * Returns the active state of the application.
         * 
         * @return the active state of the application, a value of 
         *         true indicating the application is ready for user
         *         input, a value of false indicating otherwise
         * @type Boolean
         */
        isActive: function() {
            return true;
        }
    },
    
    /**
     * The client engine hosting the application.  
     * This property is provided solely for use by the application itself, it is not (and may not be) used internally for any
     * purpose. 
     * @type Object
     */
    client: null,

    /** 
     * Mapping between component ids and component instances.
     * @type Core.Arrays.LargeMap
     */
    _idToComponentMap: null,

    /** 
     * ListenerList instance for application-level events.
     * @type Core.ListenerList 
     */
    _listenerList: null,
    
    /** 
     * Default application locale.
     * @type String
     */
    _locale: null,
        
    /** 
     * Array of modal components.
     * This value is read-only.
     * @type Array 
     */
    _modalComponents: null,

    /** 
     * Displayed style sheet.
     * 
     * @type Echo.StyleSheet
     */
    _styleSheet: null,
    
    /** 
     * Currently focused component.
     * @type Echo.Component
     */
    _focusedComponent: null,
    
    /** 
     * Root component instance.
     * This value is read-only.
     * @type Echo.Component 
     */
    rootComponent: null,
    
    /** 
     * UpdateManager instance monitoring changes to the application for redraws. 
     * @type Echo.Update.Manager
     */
    updateManager: null,
    
    /**
     * FocusManager instance handling application focus behavior.
     * @type Echo.FocusManager
     */
    focusManager: null,
    
    /**
     * Creates a new application instance.  
     * @constructor
     */
    $construct: function() {
        this._idToComponentMap = new Core.Arrays.LargeMap();
        this._listenerList = new Core.ListenerList();
        this.rootComponent = new Echo.Component();
        this.rootComponent.componentType = "Root";
        this.rootComponent.register(this);
        this._modalComponents = [];
        this.updateManager = new Echo.Update.Manager(this);
        this.focusManager = new Echo.FocusManager(this);
    },

    /**
     * Adds an arbitrary event listener.
     * 
     * @param {String} eventType the event type name
     * @param {Function} eventTarget the method to invoke when the event occurs 
     *        (the event will be passed as the single argument)
     */
    addListener: function(eventType, eventTarget) {
        this._listenerList.addListener(eventType, eventTarget);
    },
    
    /**
     * Invoked by application container to dispose of the application.
     * Invokes application-overridable <code>dispose()</code> method.
     * Once invoked, the application will no longer function and cannot be used again.
     * This method will free any resources allocated by the application.
     */ 
    doDispose: function() {
        this.updateManager.dispose();
        this.dispose();
    },
    
    /**
     * Invoked by application container to initialize of the application.
     * Invokes application-overridable <code>init()</code> method.
     */ 
    doInit: function() {
        this.init();
    },
    
    /**
     * Recursively determines the current root component of the modal context.
     *
     * @param {Echo.Component} searchComponent (optional) the component from which to search
     *        (this parameter is provided when recursively searching, if omitted the sear
     *        will begin at the root component of the application).
     * @return the current modal context root component
     */
    _findModalContextRoot: function(searchComponent) {
        searchComponent = searchComponent ? searchComponent : this.rootComponent;
        for (var i = searchComponent.children.length - 1; i >= 0; --i) {
            var foundComponent = this._findModalContextRoot(searchComponent.children[i]);
            if (foundComponent) {
                return foundComponent;
            }
        }
        
        if (searchComponent.modalSupport && searchComponent.get("modal")) {
            return searchComponent;
        }
        
        return null;
    },

    /**
     * Provides notification of an arbitrary event.
     * Listeners will be notified based on the event's type property.
     * 
     * @param event the event to fire
     */
    fireEvent: function(event) {
        if (this._listenerList == null) {
            return;
        }
        this._listenerList.fireEvent(event);
    },

    /**
     * Focuses the previous/next component based on the currently focused component.
     * 
     * @param {Boolean} reverse false to focus the next component, true to focus the
     *        previous component
     */
    focusNext: function(reverse) {
        var focusedComponent = this.focusManager.find(null, reverse);
        if (focusedComponent != null) {
            this.setFocusedComponent(focusedComponent);
        }
    },
    
    /**
     * Retrieves the registered component with the specified render id.
     * 
     * @param {String} renderId the render id
     * @return the component
     * @type Echo.Component 
     */
    getComponentByRenderId: function(renderId) {
        return this._idToComponentMap.map[renderId];
    },
    
    /**
     * Returns the focused component.
     * 
     * @return the focused component
     * @type Echo.Component
     */
    getFocusedComponent: function() {
        return this._focusedComponent;
    },
    
    /**
     * Returns the default layout direction of the application.
     *
     * @return the default layout direction
     * @type Echo.LayoutDirection 
     */
    getLayoutDirection: function() {
        return this._layoutDirection ? this._layoutDirection : Echo.LayoutDirection.LTR;
    },
        
    /**
     * Returns the default locale of the application.
     *
     * @return the default locale
     * @type String 
     */
    getLocale: function() {
        return this._locale;
    },
        
    /**
     * Returns the root component of the modal context.
     *
     * @return the root component of the modal context
     * @type Echo.Component
     */
    getModalContextRoot: function() {
        if (this._modalComponents.length === 0) {
            return null;
        } else if (this._modalComponents.length == 1) {
            return this._modalComponents[0];
        }
        
        return this._findModalContextRoot();
    },
    
    /**
     * Returns the application style sheet.
     * 
     * @return the application style sheet
     * @type Echo.StyleSheet
     */
    getStyleSheet: function() {
        return this._styleSheet;
    },
    
    /**
     * Notifies the application of an update to a component.
     * Fires a <code>componentUpdate</code> event.
     * 
     * @param {Echo.Component} parent the parent component
     * @param {String} propertyName the updated property
     * @param oldValue the previous property value
     * @param newValue the new property value
     * @param rendered optional flag indicating whether the update has already been rendered by the containing client; 
     *        if enabled, the property update will not be sent to the update manager
     */
    notifyComponentUpdate: function(parent, propertyName, oldValue, newValue, rendered) {
        if (parent.modalSupport && propertyName == "modal") {
            this._setModal(parent, newValue);
        }
        if (this._listenerList.hasListeners("componentUpdate")) {
            this._listenerList.fireEvent({type: "componentUpdate", parent: parent, propertyName: propertyName, 
                    oldValue: oldValue, newValue: newValue});
        }
        if (!rendered) {
            this.updateManager._processComponentUpdate(parent, propertyName, oldValue, newValue);
        }
    },
    
    /**
     * Registers a component with the application.
     * Invoked when a component is added to a hierarchy of 
     * components that is registered with the application.
     * 
     * @param {Echo.Component} component the component to register
     */
    _registerComponent: function(component) {
        if (this._idToComponentMap.map[component.renderId]) {
            throw new Error("Component already exists with id: " + component.renderId);
        }
        this._idToComponentMap.map[component.renderId] = component;
        if (component.modalSupport && component.get("modal")) {
            this._setModal(component, true);
        }
    },
    
    /**
     * Removes an arbitrary event listener.
     * 
     * @param {String} eventType the event type name
     * @param {Function} eventTarget the method to invoke when the event occurs 
     *        (the event will be passed as the single argument)
     */
    removeListener: function(eventType, eventTarget) {
        this._listenerList.removeListener(eventType, eventTarget);
    },

    /**
     * Sets the focused component.
     * A "focus" event is fired to application listeners to inform them of the change.
     * 
     * @param {Echo.Component} newValue the new focused component
     */
    setFocusedComponent: function(newValue) {
        var oldValue = this._focusedComponent;
        
        // If required, find focusable parent containing 'newValue'.
        while (newValue != null && !newValue.focusable) {
            newValue = newValue.parent;
        }
        
        // Verify new focused component is within modal context.
        if (this._modalComponents.length > 0) {
            var modalContextRoot = this.getModalContextRoot();
            if (!modalContextRoot.isAncestorOf(newValue)) {
                // Reject request to focus component outside of modal context.
                return;
            }
        }
        
        if (this._focusedComponent == newValue) {
            return;
        }
        
        this._focusedComponent = newValue;
        this._listenerList.fireEvent({type: "focus", source: this, oldValue: oldValue, newValue: newValue });
    },
    
    /**
     * Sets the application default layout direction.
     * 
     * @param {Echo.LayoutDirection} newValue the new layout direction
     */
    setLayoutDirection: function(newValue) {
        this._layoutDirection = newValue;
        this.updateManager._processFullRefresh();
    },
    
    /**
     * Sets the application default locale.
     * 
     * @param {String} newValue the new locale
     */
    setLocale: function(newValue) {
        this._locale = newValue;
        this.updateManager._processFullRefresh();
    },
    
    /**
     * Informs the application of the modal state of a specific component.
     * When modal components are unregistered, this method must be executed
     * in order to avoid a memory leak.
     * 
     * @param component the component
     * @param modal the modal state
     */
    _setModal: function(component, modal) {
        Core.Arrays.remove(this._modalComponents, component);
        if (modal) {
            this._modalComponents.push(component);
        }
        
        // Auto-focus first component in modal context if component is currently focused component is not within modal context.
        if (this._modalComponents.length > 0 && this._focusedComponent) {
            var modalContextRoot = this.getModalContextRoot();
            if (!modalContextRoot.isAncestorOf(this._focusedComponent)) {
                if (modalContextRoot.focusable) {
                    this.setFocusedComponent(modalContextRoot);
                } else {
                    this.setFocusedComponent(this.focusManager.findInParent(modalContextRoot, false));
                }
            }
        }
        
        this.fireEvent({ source: this, type: "modal", modal: this._modalComponents.length > 0 });
    },
    
    /**
     * Sets the application style sheet.
     * 
     * @param {Echo.StyleSheet} newValue the new style sheet
     */
    setStyleSheet: function(newValue) {
        this._styleSheet = newValue;
        this.updateManager._processFullRefresh();
    },
    
    /**
     * Unregisters a component from the application.
     * This method is invoked when a component is removed from a hierarchy of 
     * components registered with the application.
     * 
     * @param {Echo.Component} component the component to remove
     */
    _unregisterComponent: function(component) {
        this._idToComponentMap.remove(component.renderId);
        if (component.modalSupport) {
            this._setModal(component, false);
        }
    }
});

/**
 * Factory to create new instances of arbitrary components.  This object is 
 * used to instantiate new components during XML de-serialization.
 * @class
 */
Echo.ComponentFactory = {
    
    /**
     * Mapping between type names and object constructors.
     */
    _typeToConstructorMap: {},
    
    /**
     * Creates a new instance of an arbitrary component.
     * 
     * @param {String} typeName the type name of the component
     * @param {String} renderId the component render id
     * @return a newly instantiated component
     * @type Echo.Component
     */
    newInstance: function(typeName, renderId) {
        var typeConstructor = this._typeToConstructorMap[typeName];
        if (!typeConstructor) {
            throw new Error("Type not registered with ComponentFactory: " + typeName);
        }
        var component = new typeConstructor();
        component.renderId = renderId;
        return component;
    },
    
    /**
     * Returns the component constructor for the specified type.
     *
     * @param {String} typeName the type name
     * @return the component constructor
     * @type Function
     */
    getConstructor: function(typeName) {
        return this._typeToConstructorMap[typeName];
    },
    
    /**
     * Determines the super type of a component, based on the type name of the component.
     *
     * @param {String} typeName the component type
     * @return the parent component type
     * @type String
     */
    getSuperType: function(typeName) {
        var typeConstructor = this._typeToConstructorMap[typeName];
        if (!typeConstructor) {
            // Type not registered, return Component base class name.
            return "Component";
        }
        if (typeConstructor.$super) {
            return typeConstructor.$super.prototype.componentType;
        } else {
            return null;
        }
    },
    
    /**
     * Registers a type name to a specific constructor.
     * 
     * @param typeName the type name
     * @param typeConstructor the constructor
     */
    registerType: function(typeName, typeConstructor) {
        if (this._typeToConstructorMap[typeName]) {
            throw new Error("Type already registered: " + typeName);
        }
        this._typeToConstructorMap[typeName] = typeConstructor;
    }
};

/**
 * Base class for components.
 * Derived classes should wishing to support hierarchal construction should provide constructors
 * with a first parameter name of 'properties' which is passed to the super-constructor.
 * In any case, the super-constructor must be invoked.
 * A component MUST have its componentType property set before it is used in a hierarchy.  Failing to do so
 * will throw an exception and/or result in indeterminate behavior.
 *
 * @sp {#Color} background the background color
 * @sp {#Font} font the component font
 * @sp {#Color} foreground the foreground color
 * @sp layoutData layout data information, describing how the component should be rendered by its container 
 * @event property An event fired when the a property of the component changes.  The <code>propertyName</code> property
 *        will specify the name of the changed property.  The <code>oldValue</code> and <code>newValue</code> properties
 *        (may) describe the previous and current states of the property, respectively.
 * @event init An event which is fired when the Component is added to a component hierarchy which is registered to an
 *        application.  The "application" property of the Component will be available when the event is fired.
 * @event dispose An event which is fired when the Component is about to be removed from a component hierarchy which is
 *        registered to an application.  The "application" property of the Component will be available when the event is fired.
 * @event parent An event which is fired when the Component's parent is changed.
 * @event children An event which is fired when a child is added to or removed from the Component.
 */
Echo.Component = Core.extend({
    
    $static: {

        /**
         * The next automatically assigned client render id.
         * @type Number
         */
        _nextRenderId: 0
    },
    
    $load: function() {
        Echo.ComponentFactory.registerType("Component", this);
    },

    $abstract: true,
    
    $virtual: {
    
        /**
         * Component type.  
         * This value should be the fully-qualified name of the component, e.g. "Foo.ExampleComponent".
         * This property must be set by implementors in order for peer discovery to work properly.
         * @type String
         */
        componentType: "Component",
        
        /** 
         * Flag indicating whether or not the component is focusable.
         * @type Boolean 
         */
        focusable: false,

        /**
         * Returns the order in which child components should be focused.
         * The natural order in which child components should be focused should be returned, without necessarily investigating
         * whether those children are focusable.  A value of null may be returned if the components should be focused in the
         * sequential order.
         * 
         * @return Array an array of child indices
         */
        getFocusOrder: null,
        
        /**
         *  Flag indicating whether component is rendered as a pane (pane components consume available height).
         *  @type Boolean 
         */
        pane: false
    },
    
    /**
     * Component layout direction.
     * @type Echo.LayoutDirection
     */
    _layoutDirection: null,
    
    /**
     * Component locale.
     * @type String
     */
    _locale: null,

    /**
     * The render id.
     * This value should be treated as read-only and immutable.
     * @type String
     */
    renderId: null,
    
    /**
     * The parent component.
     * This value is read-only.
     * @type Echo.Component
     */
    parent: null,
    
    /**
     * The registered application.
     * This value is read-only.
     * @type Echo.Application
     */
    application: null,
    
    /**
     * Listener list.  Lazily created.
     * @type Core.ListenerList
     */
    _listenerList: null,
    
    /**
     * Referenced external style
     */
    _style: null,
    
    /**
     * Assigned style name from application-level style sheet.
     * @type String
     */
    _styleName: null,

    /**
     * Enabled state of the component (default true).
     * @type Boolean
     */
    _enabled: true,
    
    /**
     * Array of child components.
     * This value is read-only.  Modifying this array will result in undefined behavior.
     * @type Array
     */
    children: null,
    
    /**
     * renderId of application-set next focusable component.
     * @type String 
     */
    focusNextId: null,
    
    /**
     * renderId of application-set previous focusable component.
     * @type String 
     */
    focusPreviousId: null,
    
    /**
     * Internal style used to store properties set directly on component.
     */
    _localStyle: null,
    
    /**
     * Creates a new Component.
     * The parent constructor MUST be invoked if it is overridden.  This is accomplished by including the statement
     * "BaseComponent.call(this, properties)" in any derivative constructor, where "BaseComponent" is
     * class from which the component is immediately derived (which may or may not be Echo.Component itself).
     *  
     * @param properties (Optional) associative mapping of initial property values (may be null)
     *        By default, all properties will be placed into the local style, except for the following:
     *        <ul>
     *         <li><code>styleName</code> specifies the component stylesheet style name</li>
     *         <li><code>style</code> specifies the referenced component style</li>
     *         <li><code>renderId</code> specifies the render id</li>
     *         <li><code>children</code> an array specifying the initial children of the component</li>
     *         <li><code>events</code> an associative mapping between event names and listener methods</li>
     *        </ul>
     */
    $construct: function(properties) {
        this.children = [];
        this._localStyle = { };
        
        if (properties) {
            for (var name in properties) {
                switch (name) {
                case "style": this._style = properties.style; break;
                case "styleName": this._styleName = properties.styleName; break;
                case "renderId": this.renderId = properties.renderId; break;
                case "children":
                    for (var i = 0; i < properties.children.length; ++i) {
                        this.add(properties.children[i]);
                    }
                    break;
                case "events":
                    for (var eventType in properties.events) {
                        this.addListener(eventType, properties.events[eventType]);
                    }
                    break;
                default:
                    this._localStyle[name] = properties[name];
                }
            }
        }
    },

    /**
     * Adds a component as a child.
     * 
     * @param {Echo.Component} component the component to add
     * @param {Number} index the (integer) index at which to add it (optional, omission
     *        will cause component to be appended to end)
     */
    add: function(component, index) {
        if (!(component instanceof Echo.Component)) {
            throw new Error("Cannot add child: specified component object is not derived from Echo.Component. " +
                    "Parent: " + this + ", Child: " + component);
        }
        if (!component.componentType) {
            throw new Error("Cannot add child: specified component object does not have a componentType property. " +
                    "Parent: " + this + ", Child: " + component);
        }
    
        if (component.parent) {
            component.parent.remove(component);
        }
        
        component.parent = this;
            
        if (index == null || index == this.children.length) {
            this.children.push(component);
        } else {
            this.children.splice(index, 0, component);
        }
        
        if (this.application) {
            component.register(this.application);
            this.application.notifyComponentUpdate(this, "children", null, component);
        }
        
        if (component._listenerList && component._listenerList.hasListeners("parent")) {
            component._listenerList.fireEvent({type: "parent", source: component, oldValue: null, newValue: this});
        }

        if (this._listenerList && this._listenerList.hasListeners("children")) {
            this._listenerList.fireEvent({type: "children", source: this, add: component, index: index});
        }
    },
    
    /**
     * Adds an arbitrary event listener.
     * 
     * @param {String} eventType the event type name
     * @param {Function} eventTarget the method to invoke when the event occurs 
     *        (the event will be passed as the single argument)
     */
    addListener: function(eventType, eventTarget) {
        if (this._listenerList == null) {
            this._listenerList = new Core.ListenerList();
        }
        this._listenerList.addListener(eventType, eventTarget);
        if (this.application) {
            this.application.notifyComponentUpdate(this, "listeners", null, eventType);
        }
    },
    
    /**
     * Provides notification of an arbitrary event.
     * Listeners will be notified based on the event's type property.
     * 
     * @param event the event to fire
     */
    fireEvent: function(event) {
        if (this._listenerList == null) {
            return;
        }
        this._listenerList.fireEvent(event);
    },
    
    /**
     * Returns an arbitrary property value.
     * 
     * @param {String} name the name of the property
     * @return the property value
     */
    get: function(name) {
        return this._localStyle[name];
    },
    
    /**
     * Retrieves the child component at the specified index.
     * 
     * @param {Number} index the (integer) index
     * @return the child component
     * @type Echo.Component
     */
    getComponent: function(index) {
        return this.children[index];
    },
    
    /**
     * Returns the number of child components.
     * 
     * @return the number of child components
     * @type Number
     */
    getComponentCount: function() {
        return this.children.length;
    },
    
    /**
     * Returns an arbitrary indexed property value.
     * 
     * @param {String} name the name of the property
     * @param {Number} index the index to return
     * @return the property value
     */
    getIndex: function(name, index) {
        var valueArray = this._localStyle[name];
        return valueArray ? valueArray[index] : null;
    },
    
    /**
     * Returns the component layout direction.
     * Note that in most cases it is preferable to set the layout direction of the Application, rather than individual components.
     * 
     * @return the component layout direction
     * @type Echo.LayoutDirection
     */
    getLayoutDirection: function() {
        return this._layoutDirection;
    },
    
    /**
     * Returns the component locale.
     * Note that in most cases it is preferable to set the locale of the Application, rather than individual components.
     * 
     * @return the component locale
     * @type String
     */
    getLocale: function() {
        return this._locale;
    },
    
    /**
     * Retrieves local style property map associations.  This method should only be used by a de-serialized for
     * the purpose of rapidly loading properties into a new component.
     * 
     * @return the internal style property map associations
     */
    getLocalStyleData: function() {
        return this._localStyle;
    },
    
    /**
     * Returns the layout direction with which the component should be rendered, based on analyzing the component's layout 
     * direction, its parent's, and/or the application's.
     * 
     * @return the rendering layout direction
     * @type Echo.LayoutDirection
     */
    getRenderLayoutDirection: function() {
        var component = this;
        while (component) {
            if (component._layoutDirection) {
                return component._layoutDirection;
            }
            component = component.parent;
        }
        if (this.application) {
            return this.application.getLayoutDirection();
        }
        return null;
    },
    
    /**
     * Returns the locale  with which the component should be rendered, based on analyzing the component's locale,
     * its parent's, and/or the application's.
     * 
     * @return the rendering locale
     * @type String
     */
    getRenderLocale: function() {
        var component = this;
        while (component) {
            if (component._locale) {
                return component._locale;
            }
            component = component.parent;
        }
        if (this.application) {
            return this.application.getLocale();
        }
        return null;
    },
    
    /**
     * Returns the style assigned to this component, if any.
     * 
     * @return the assigned style
     */
    getStyle: function() {
        return this._style;
    },
    
    /**
     * Returns the name of the style (from the application's style sheet) 
     * assigned to this component.
     * 
     * @return the style name
     * @type String
     */
    getStyleName: function() {
        return this._styleName;
    },
    
    /**
     * Returns the index of a child component, or -1 if the component
     * is not a child.
     * 
     * @param {Echo.Component} component the component
     * @return the index
     * @type Number
     */
    indexOf: function(component) {
        for (var i = 0; i < this.children.length; ++i) {
            if (this.children[i] == component) {
                return i;
            }
        }
        return -1;
    },
    
    /**
     * Determines if the component is active, that is, within the current modal context
     * and ready to receive input.
     * 
     * @return the active state
     * @type Boolean
     */
    isActive: function() {
        // Verify the component and its ancestors are all enabled.
        if (!this.isRenderEnabled()) {
            return false;
        }
        
        // Verify component is registered to an application, and that the application is active.
        if (!this.application || !this.application.isActive()) {
            return false;
        }
        
        // Verify component is in modal context.
        var modalContextRoot = this.application.getModalContextRoot();
        if (modalContextRoot != null && !modalContextRoot.isAncestorOf(this)) {
            return false;
        }
        
        return true;
    },
    
    /**
     * Determines if this component is or is an ancestor of another component.
     * 
     * @param {Echo.Component} c the component to test
     * @return true if an ancestor relationship exists
     * @type Boolean
     */
    isAncestorOf: function(c) {
        while (c != null && c != this) {
            c = c.parent;
        }
        return c == this;
    },
    
    /**
     * Determines the enabled state of this component.
     * Use isRenderEnabled() to determine whether a component should be rendered as enabled.
     * 
     * @return the enabled state of this specific component
     */
    isEnabled: function() {
        return this._enabled;
    },
    
    /**
     * Determines whether this <code>Component</code> should be rendered with
     * an enabled state.
     * Disabled <code>Component</code>s are not eligible to receive user input.
     * 
     * @return true if the component should be rendered enabled
     * @type Boolean
     */
    isRenderEnabled: function() {
        var component = this;
        while (component != null) {
            if (!component._enabled) {
                return false;
            }
            component = component.parent;
        }
        return true;
    },
    
    /**
     * Registers / unregisters a component that has been added/removed to/from a registered hierarchy
     * (a hierarchy that is registered to an application).
     * 
     * @param {Echo.Application} application the application (null to unregister the component)
     */
    register: function(application) {
        // Sanity check.
        if (application && this.application) {
            throw new Error("Attempt to re-register or change registered application of component.");
        }
        
        var i;
    
        if (!application) { // unregistering
            // Recursively unregister children.
            if (this.children != null) {
                for (i = 0; i < this.children.length; ++i) {
                     this.children[i].register(false); // Recursively unregister children.
                }
            }
            
            // Notify application.
            this.application._unregisterComponent(this);

            // Change application focus in the event the focused component is being removed.
            // Note that this is performed after de-registration to ensure any removed modal context is cleared.
            if (this.application._focusedComponent == this) {
                this.application.setFocusedComponent(this.parent);
            }

            // Notify dispose listeners.
            if (this._listenerList != null && this._listenerList.hasListeners("dispose")) {
                this._listenerList.fireEvent({ type: "dispose", source: this });
            }
        }
    
        // Link/unlink with application.
        this.application = application;
    
        if (application) { // registering
            // Assign render id if required.
            if (this.renderId == null) {
                this.renderId = "CL." + (++Echo.Component._nextRenderId);
            }
    
            // Notify application.
            this.application._registerComponent(this);
            
            // Notify init listeners.
            if (this._listenerList != null && this._listenerList.hasListeners("init")) {
                this._listenerList.fireEvent({ type: "init", source: this });
            }

            // Recursively register children.
            if (this.children != null) {
                for (i = 0; i < this.children.length; ++i) {
                     this.children[i].register(application); // Recursively unregister children.
                }
            }
        }
    },
    
    /**
     * Returns the value of a property that should be rendered,
     * based on the value set on this component, in the component's
     * specified style, and/or in the application's stylesheet.
     * 
     * @param {String} name the name of the property
     * @param defaultValue the default value to return if no value is 
     *        specified in an internal property, style, or stylesheet
     * @return the property value
     */
    render: function(name, defaultValue) {
        var value = this._localStyle[name];
        if (value == null) {
            if (this._style != null) {
                value = this._style[name];
            }
            if (value == null && this.application && this.application._styleSheet) {
                var style = this.application._styleSheet.getRenderStyle(
                        this._styleName != null ? this._styleName : "", this.componentType);
                if (style) {
                    value = style[name];
                }
            }
        }
        return value == null ? defaultValue : value;
    },
    
    /**
     * Returns the value of an indexed property that should be rendered,
     * based on the value set on this component, in the component's
     * specified style, and/or in the application's stylesheet.
     * 
     * @param {String} name the name of the property
     * @param {Number} index the (integer) index of the property
     * @param defaultValue the default value to return if no value is 
     *        specified in an internal property, style, or stylesheet
     * @return the property value
     */
    renderIndex: function(name, index, defaultValue) {
        var valueArray = this._localStyle[name];
        var value = valueArray ? valueArray[index] : null;
        if (value == null) {
            if (this._style != null) {
                valueArray = this._style[name];
                value = valueArray ? valueArray[index] : null;
            }
            if (value == null && this._styleName && this.application && this.application._styleSheet) {
                var style = this.application._styleSheet.getRenderStyle(
                        this._styleName != null ? this._styleName : "", this.componentType);
                if (style) {
                    valueArray = style[name];
                    value = valueArray ? valueArray[index] : null;
                }
            }
        }
        return value == null ? defaultValue : value;
    },
    
    /**
     * Removes a child component.
     * 
     * @param componentOrIndex the index of the component to remove, or the component to remove
     *        (values may be of type Echo.Component or Number)
     */
    remove: function(componentOrIndex) {
        var component;
        var index;
        if (typeof componentOrIndex == "number") {
            index = componentOrIndex;
            component = this.children[index];
            if (!component) {
                throw new Error("Component.remove(): index out of bounds: " + index + ", parent: " + this);
            }
        } else {
            component = componentOrIndex;
            index = this.indexOf(component);
            if (index == -1) {
                // Component is not a child: do nothing.
                return;
            }
        }
        
        if (this.application) {
            component.register(null);
        }
        
        this.children.splice(index, 1);
        component.parent = null;
        
        if (this.application) {
            this.application.notifyComponentUpdate(this, "children", component, null);
        }
        
        if (component._listenerList && component._listenerList.hasListeners("parent")) {
            component._listenerList.fireEvent({type: "parent", source: component, oldValue: this, newValue: null});
        }

        if (this._listenerList && this._listenerList.hasListeners("children")) {
            this._listenerList.fireEvent({type: "children", source: this, remove: component, index: index});
        }
    },
    
    /**
     * Removes all child components.
     */
    removeAll: function() {
        while (this.children.length > 0) {
            this.remove(this.children.length - 1);
        }
    },
    
    /**
     * Removes an arbitrary event listener.
     * 
     * @param {String} eventType the event type name
     * @param {Function} eventTarget the method to invoke when the event occurs 
     *        (the event will be passed as the single argument)
     */
    removeListener: function(eventType, eventTarget) {
        if (this._listenerList == null) {
            return;
        }
        this._listenerList.removeListener(eventType, eventTarget);
        if (this.application) {
            this.application.notifyComponentUpdate(this, "listeners", eventType, null);
        }
    },
    
    /** 
     * Sets the value of a property in the internal style.
     * 
     * @param {String} name the name of the property
     * @param value the new value of the property
     * @param rendered optional flag indicating whether the update has already been rendered by the containing client; 
     *        if enabled, the property update will not be sent to the update manager
     */
    set: function(name, newValue, rendered) {
        var oldValue = this._localStyle[name];
        if (oldValue === newValue) {
            return;
        }
        this._localStyle[name] = newValue;
        if (this._listenerList && this._listenerList.hasListeners("property")) {
            this._listenerList.fireEvent({type: "property", source: this, propertyName: name, 
                    oldValue: oldValue, newValue: newValue});
        }
        if (this.application) {
            this.application.notifyComponentUpdate(this, name, oldValue, newValue, rendered);
        }
    },
    
    /**
     * Sets the enabled state of the component.
     * 
     * @param newValue the new enabled state
     */
    setEnabled: function(newValue) {
        var oldValue = this._enabled;
        this._enabled = newValue;
        if (this.application) {
            this.application.notifyComponentUpdate(this, "enabled", oldValue, newValue);
        }
    },
    
    /** 
     * Sets the value of an indexed property in the internal style.
     * 
     * @param {String} name the name of the property
     * @param {Number} index the index of the property
     * @param newValue the new value of the property
     * @param rendered optional flag indicating whether the update has already been rendered by the containing client; 
     *        if enabled, the property update will not be sent to the update manager
     */
    setIndex: function(name, index, newValue, rendered) {
        var valueArray = this._localStyle[name];
        var oldValue = null;
        if (valueArray) {
            oldValue = valueArray[index];
            if (oldValue === newValue) {
                return;
            }
        } else {
            valueArray = [];
            this._localStyle[name] = valueArray;
        }
        valueArray[index] = newValue;
        if (this.application) {
            this.application.notifyComponentUpdate(this, name, oldValue, newValue, rendered);
        }
        if (this._listenerList && this._listenerList.hasListeners("property")) {
            this._listenerList.fireEvent({type: "property", source: this, propertyName: name, index: index,
                    oldValue: oldValue, newValue: newValue});
        }
    },
    
    /**
     * Sets a component-specific layout direction.
     * Note that in most cases it is preferable to set the layout direction of the Application, 
     * rather than individual components.
     * 
     * @param {Echo.LayoutDirection} newValue the new layout direction
     */
    setLayoutDirection: function(newValue) {
        var oldValue = this._layoutDirection;
        this._layoutDirection = newValue;
        if (this.application) {
            this.application.notifyComponentUpdate(this, "layoutDirection", oldValue, newValue);
        }
    },
    
    /**
     * Sets a component-specific locale.
     * Note that in most cases it is preferable to set the locale of the Application, 
     * rather than individual components.
     * 
     * @param {String} newValue the new layout direction
     */
    setLocale: function(newValue) {
        var oldValue = this._locale;
        this._locale = newValue;
        if (this.application) {
            this.application.notifyComponentUpdate(this, "locale", oldValue, newValue);
        }
    },
    
    /**
     * Sets the style of the component.
     * 
     * @param newValue the new style
     */
    setStyle: function(newValue) {
        var oldValue = this._style;
        this._style = newValue;
        if (this.application) {
            this.application.notifyComponentUpdate(this, "style", oldValue, newValue);
        }
    },
    
    /**
     * Sets the name of the style (from the application's style sheet) 
     * assigned to this component.
     * 
     * @param {String} newValue the style name
     */
    setStyleName: function(newValue) {
        var oldValue = this._styleName;
        this._styleName = newValue;
        if (this.application) {
            this.application.notifyComponentUpdate(this, "styleName", oldValue, newValue);
        }
    },
    
    /**
     * Returns a string representation of the component (default implementation).
     * 
     * @param {Boolean} longFormat an optional flag specifying whether all information about
     *        the component should be displayed (e.g., property values)
     * @return a string representation of the component
     * @type String
     */
    toString: function(longFormat) {
        var out = this.renderId + "/" + this.componentType;
        if (longFormat) {
            out += "\n";
            var componentCount = this.getComponentCount();
            out += this.renderId + "/properties:" + this._localStyle + "\n";
            for (var i = 0; i < componentCount; ++i) {
                var component = this.getComponent(i);
                out += this.renderId + "/child:" + component.renderId + "\n";
                out += component.toString(true);
            }
        }
        return out;
    }
});

/**
 * Provides focus management tools for an application.
 */
Echo.FocusManager = Core.extend({

    /**
     * The managed application.
     * @type Echo.Application
     */
    _application: null,

    /**
     * Focus management handler for a specific application instance.
     * One FocusManager is created for each application.
     * 
     * @param {Echo.Application} application the managed application
     */
    $construct: function(application) { 
        this._application = application;
    },
    
    /**
     * Searches the component hierarchy for the next component that should
     * be focused (based on the currently focused component).
     * Container components are queried to determine the order in which their
     * children should naturally be focused (certain components, e.g., SplitPanes,
     * will have a child focus order that may be different from the order of their 
     * children).
     * This search is depth first.
     * 
     * Search order (FORWARD):
     * 
     * (Start on Component)
     * First Child, next sibling, parent
     *
     * Search order (REVERSE):
     * Last Child, previous sibling, parent
     * 
     * @param {Echo.Component} component the component at which to begin searching
     * @param {Boolean} reverse flag indicating the direction of the search
     * @return the Component which should be focused
     * @type Echo.Component
     */
    find: function(component, reverse) {
        if (!component) {
            component = this._application.getFocusedComponent();
            if (!component) {
                component = this._application.rootComponent;
            }
        }
        
        // If a specific next focusable component has been specified, attempt to focus it.
        var setComponentId = reverse ? component.focusPreviousId : component.focusNextId;
        if (setComponentId) {
            var setComponent = this._application.getComponentByRenderId(setComponentId);
            if (setComponent && setComponent.isActive() && setComponent.focusable) {
                return setComponent;
            }
        }

        // The component which is currently focused by the application.
        var originComponent = component;
        
        // An associative array containing the ids of all previously visited components.
        var visitedComponents = { };
        
        // The value of 'component' on the previous iteration.
        var lastComponent = null;
        
        while (true) {
            // The candidate next component to be focused.
            var nextComponent = null;

            if ((reverse && component == originComponent) || (lastComponent && lastComponent.parent == component)) {
                // Searching in reverse on origin component (OR) Previously moved up: do not move down.
            } else {
                var componentCount = component.getComponentCount();
                if (componentCount > 0) {
                    // Attempt to move down.
                    // Next component is first child (searching forward) or last child (searching reverse).
                    var focusOrder = this._getFocusOrder(component);
                    if (focusOrder) {
                        nextComponent = component.getComponent(focusOrder[reverse ? componentCount - 1 : 0]);
                    } else {
                        nextComponent = component.getComponent(reverse ? componentCount - 1 : 0);
                    }
                    
                    if (visitedComponents[nextComponent.renderId]) {
                        // Already visited children, cancel the move.
                        nextComponent = null;
                    }
                }
            }
                
            if (nextComponent == null) {
                // Attempt to move to next/previous sibling.
                if (component.parent) {
                    nextComponent = this._getNextCandidate(component, reverse);
                }
            }

            if (nextComponent == null) {
                // Attempt to move up.
                nextComponent = component.parent;
            }
            
            if (nextComponent == null) {
                return null;
            }

            lastComponent = component;
            component = nextComponent;
            visitedComponents[component.renderId] = true;
            
            if (component != originComponent && component.isActive() && component.focusable) {
                return component;
            }
        }
    },
    
    /**
     * Finds next (or previous) focusable descendant of a parent component.
     * This method requires that the application's currently focused component
     * be a descendant of the specified parent component.  The search will
     * be limited to descendants of the parent component, i.e., if a suitable descendant
     * component cannot be found, null will be returned.
     * 
     * The <code>minimumDistance</code> property may be used to skip a number of siblings.
     * This is used by components such as "Grid" which may want to find a focusable component
     * in the next row, skipping over all columns of the current row.  
     * If omitted the default value of this property is 1.  As an example, a value of 2
     * would skip the immediately adjacent sibling of the current focused component.
     *
     * @param {Echo.Component} parentComponent the parent component to search
     * @param {Boolean} reverse the search direction, false indicating to search forward, true
     *        indicating reverse
     * @param {Number} minimumDistance the fewest number of lateral focus moves to make before
     *        returning a focusable component (optional, default value of 1)
     * @return the focusable descendant, or null if one cannot be found
     * @type Echo.Component
     */
    findInParent: function(parentComponent, reverse, minimumDistance) {
        if (!minimumDistance) {
            minimumDistance = 1;
        }
        
        var visitedIds = {},
            focusedComponent = this._application.getFocusedComponent();

        if (!focusedComponent) {
            return null;
        }

        visitedIds[focusedComponent.renderId] = true;
        
        var focusedIndex = this._getDescendantIndex(parentComponent, focusedComponent);
        if (focusedIndex == -1) {
            return null;
        }
        
        var componentIndex = focusedIndex;
        var component = focusedComponent;
        do {
            component = this.find(component, reverse, visitedIds);
            if (component == null || visitedIds[component.renderId]) {
                return null;
            }
            componentIndex = this._getDescendantIndex(parentComponent, component);
            visitedIds[component.renderId] = true;
        } while (Math.abs(componentIndex - focusedIndex) < minimumDistance && component != focusedComponent);

        if (component == focusedComponent) {
            // Search wrapped, only one focusable component.
            return null;
        }
        
        this._application.setFocusedComponent(component);
        return component;
    },
    
    /**
     * Determines the index of the child of <code>parent</code> in which
     * <code>descendant</code> is contained.
     * 
     * @param {Echo.Component} parent the parent component
     * @param {Echo.Component} descendant the descendant component
     * @return the descendant index, or -1 if the component is not a descendant of <code>parent</code>
     * @type Number
     */
    _getDescendantIndex: function(parent, descendant) {
        while (descendant.parent != parent && descendant.parent != null) {
            descendant = descendant.parent;
        }
        if (descendant.parent == null) {
            return -1;
        }
        return parent.indexOf(descendant);
    },
    
    /**
     * Returns and validates the component's natural focus order, if provided.
     * Null is returned in the event the component's natural focus order is invalid, i.e., one or more component
     * indices are repeated.
     * 
     * @param {Echo.Component} component the component
     * @return the focus order, an array of component indices
     * @type Array
     */
    _getFocusOrder: function(component) {
        var focusOrder = component.getFocusOrder ? component.getFocusOrder() : null;
        if (!focusOrder) {
            return null;
        }
        
        var testOrder = focusOrder.slice().sort();
        for (var i = 1; i < testOrder.length; ++i) {
            if (testOrder[i - 1] >= testOrder[i]) {
                // Invalid focus order.
                Core.Debug.consoleWrite("Invalid focus order for component " + component + ": " + focusOrder);
                return null;
            }
        }

        return focusOrder;
    },
    
    /**
     * Returns the next sibling candidate focus component adjacent the specified component.
     * Uses the focus order provided by <code>Echo.Component.getFocusOrder()</code> if provided.
     * 
     * @param {Echo.Component} component the current focused/analyzed component
     * @param {Boolean} reverse flag indicating whether next component (false) or previous copmonent (true)
     *        should be returned
     * @return the next focus candidate
     * @type Echo.Component
     */
    _getNextCandidate: function(component, reverse) {
        if (!component.parent) {
            return null;
        }
        
        var focusOrder = this._getFocusOrder(component.parent);
        var componentIndex, orderIndex;
        
        if (reverse) {
            componentIndex = component.parent.indexOf(component);
            if (focusOrder) {
                orderIndex = Core.Arrays.indexOf(focusOrder, componentIndex);
                if (orderIndex > 0) {
                    return component.parent.children[focusOrder[orderIndex - 1]];
                }
            } else {
                if (componentIndex > 0) {
                    return component.parent.getComponent(componentIndex - 1);
                }
            }
        } else {
            componentIndex = component.parent.indexOf(component);
            if (focusOrder) {
                orderIndex = Core.Arrays.indexOf(focusOrder, componentIndex);
                if (orderIndex < focusOrder.length - 1) {
                    return component.parent.children[focusOrder[orderIndex + 1]];
                }
            } else {
                if (componentIndex < component.parent.getComponentCount() - 1) {
                    return component.parent.getComponent(componentIndex + 1);
                }
            }
        }
    }
});

/**
 * Describes the layout direction of text and content to provide support 
 * for bidirectional localization.
 */
Echo.LayoutDirection = Core.extend({
    
    /**
     * Flag indicating whether layout direction is left-to-right.
     * @type Boolean 
     */
    _ltr: false,
    
    /**
     * LayoutDirection property.  Do not instantiate, use LTR/RTL constants.
     * 
     * @param {Boolean} ltr true if the layout direction is left-to-right 
     */
    $construct: function(ltr) {
        this._ltr = ltr;
    },

    /**
     * Determines if the layout direction is left-to-right.
     * 
     * @return true if the layout direction is left-to-right
     * @type Boolean
     */
    isLeftToRight: function() {
        return this._ltr;
    }
});

/**
 * Global instance representing a left-to-right layout direction.
 * @type Echo.LayoutDirection
 * @final
 */
Echo.LayoutDirection.LTR = new Echo.LayoutDirection(true);

/**
 * Global instance representing a right-to-left layout direction.
 * @type Echo.LayoutDirection
 * @final
 */
Echo.LayoutDirection.RTL = new Echo.LayoutDirection(false);

/**
 * An application style sheet.
 */
Echo.StyleSheet = Core.extend({

    /** Map between style names and type-name to style maps. */
    _nameToStyleMap: null,

    /** 
     * Style cache mapping style names and type-name to style maps.  Behaves identically to _nameToStyleMap except styles are 
     * stored explicitly for every component type.  This provides quick access to style information for the renderer. 
     */
    _renderCache: null,
    
    /**
     * Creates a new style sheet.
     *
     * @param initialValues an optional mapping between style names 
     *        and maps between component types and styles
     */
    $construct: function(initialValues) {
        this._renderCache = { };
        this._nameToStyleMap = { };
        
        if (initialValues) {
            for (var styleName in initialValues) {
                for (var componentType in initialValues[styleName]) {
                     this.setStyle(styleName, componentType, initialValues[styleName][componentType]);
                }
            }
        }
    },
    
    /**
     * Returns the style that should be used for a component.
     * 
     * @param {String} name the component's style name
     * @param {String} componentType the type of the component
     * @return the style
     */
    getRenderStyle: function(name, componentType) {
        // Retrieve style from cache.
        var typeToStyleMap = this._renderCache[name];
        if (!typeToStyleMap) {
            return null;
        }
        var style = typeToStyleMap[componentType];
        if (style !== undefined) {
            // If style found in cache, return immediately.
            return style;
        } else {
            return this._loadRenderStyle(name, componentType);
        }
    },
    
    /**
     * Creates a rendered style object for a specific style name and componentType and stores it in
     * the cache.  This method is invoked by <code>getRenderStyle()</code> when a cached style cannot be found.
     *
     * @param {String} name the style name
     * @param {String} componentType the type of the component
     * @return the style
     */
    _loadRenderStyle: function(name, componentType) {
        // Retrieve value (type-to-style-map) from name-to-style-map with specified name key.
        var typeToStyleMap = this._nameToStyleMap[name];
        if (typeToStyleMap == null) {
            // No styles available for specified name, mark cache entry as null and return null.
            this._renderCache[name][componentType] = null;
            return null;
        }
        
        // Retrieve style for specific componentType.
        var style = typeToStyleMap[componentType];
        if (style == null) {
            var testType = componentType;
            while (style == null) {
                // Search super types of testType to find style until found.
                testType = Echo.ComponentFactory.getSuperType(testType);
                if (testType == null) {
                    // No style available for component type, mark cache entry as null and return null.
                    this._renderCache[name][testType] = null;
                    return null;
                }
                style = typeToStyleMap[testType];
            }
        }
        this._renderCache[name][componentType] = style;
        return style;
    },
    
    /**
     * Retrieves a specific style from the style sheet.
     * 
     * @param {String} name the style name
     * @param {String} componentType the component type
     * @return the style
     */
    getStyle: function(name, componentType) {
        var typeToStyleMap = this._nameToStyleMap[name];
        if (typeToStyleMap == null) {
            return null;
        }
        return typeToStyleMap[componentType];
    },
    
    /**
     * Stores a style in the style sheet.
     * 
     * @param {String} name the style name
     * @param {String} componentType the component type
     * @param the style
     */
    setStyle: function(name, componentType, style) {
        // Create or clear cache entry for name.
        this._renderCache[name] = {};
        
        var typeToStyleMap = this._nameToStyleMap[name];
        if (typeToStyleMap == null) {
            typeToStyleMap = {};
            this._nameToStyleMap[name] = typeToStyleMap;
        }
        typeToStyleMap[componentType] = style;
    }
});

// Update Management

/**
 * Namespace for update management.
 * Provides capabilities for storing property changes made to applications and components
 * such that display redraws may be performed efficiently in batches by application container.
 * @namespace
 */
Echo.Update = { };

/**
 * Representation of an update to a single existing component which is currently rendered on the screen.
 */
Echo.Update.ComponentUpdate = Core.extend({

    $static: {
    
        /**
         * Data object representing the old and new states of a changed property.
         *
         * @param oldValue the old value of the property
         * @param newValue the new value of the property
         */
        PropertyUpdate: function(oldValue, newValue) {
            this.oldValue = oldValue;
            this.newValue = newValue;
        }
    },
    
    /**
     * The <code>Manager</code> to which this update belongs.
     * @type Array
     */
    _manager: null,
    
    /**
     * The parent component represented in this <code>ComponentUpdate</code>.
     * @type Echo.Component
     */
    parent: null,
    
    /**
     * Storage for contextual information used by application container to render this update.
     * Object type and content are specified by the application container, this variable is not
     * used by the application module in any capacity.
     */
    renderContext: null,
    
    /**
     * The set of child Component ids added to the <code>parent</code>.
     * @type Array
     */
    _addedChildIds: null,
    
    /**
     * A mapping between property names of the parent component and 
     * <code>PropertyUpdate</code>s.
     */
    _propertyUpdates: null,
    
    /**
     * The set of child Component ids removed from the <code>parent</code>.
     * @type Array
     */
    _removedChildIds: null,
    
    /**
     * The set of descendant Component ids which are implicitly removed 
     * as they were children of removed children.
     * @type Array
     */
    _removedDescendantIds: null,

    /**
     * The set of child Component ids whose <code>LayoutData</code> 
     * was updated. 
     * @type Array
     */
    _updatedLayoutDataChildIds: null,
    
    /**
     * The set of listener types which have been added to/removed from the component.
     * Associative mapping between listener type names and boolean values, true representing
     * the notion that listeners of a type have been added or removed.
     */
    _listenerUpdates: null,

    /**
     * Creates a new ComponentUpdate.
     * 
     * @param {Echo.Component} parent the updated component
     */
    $construct: function(manager, parent) {
    
        /**
         * The <code>Manager</code> to which this update belongs.
         * @type Array
         */
        this._manager = manager;
        
        /**
         * The parent component represented in this <code>ComponentUpdate</code>.
         * @type Echo.Component
         */
        this.parent = parent;
    },
    
    /**
     * Records the addition of a child to the parent component.
     * 
     * @param {Echo.Component} child the added child
     */
    _addChild: function(child) {
        if (!this._addedChildIds) {
            this._addedChildIds = [];
        }
        this._addedChildIds.push(child.renderId);
        this._manager._idMap[child.renderId] = child;
    },
    
    /**
     * Appends removed children and descendants from another update to this
     * update as removed descendants.
     * This method is invoked when a component is removed that is an ancestor
     * of a component that has an update in the update manager.
     * 
     * @param {Echo.Update.CompoentUpdate} update the update from which to pull 
     *        removed components/descendants
     */
    _appendRemovedDescendants: function(update) {
        var i;
        
        // Append removed descendants.
        if (update._removedDescendantIds != null) {
            if (this._removedDescendantIds == null) {
                this._removedDescendantIds = [];
            }
            for (i = 0; i < update._removedDescendantIds.length; ++i) {
                this._removedDescendantIds.push(update._removedDescendantIds[i]);
            }
        }
        
        // Append removed children.
        if (update._removedChildIds != null) {
            if (this._removedDescendantIds == null) {
                this._removedDescendantIds = [];
            }
            for (i = 0; i < update._removedChildIds.length; ++i) {
                this._removedDescendantIds.push(update._removedChildIds[i]);
            }
        }
        
        if (this._removedDescendantIds != null) {
            Core.Arrays.removeDuplicates(this._removedDescendantIds);
        }
    },
    
    /**
     * Returns an array containing the children added in this update,
     * or null if none were added.
     * 
     * @return the added children
     * @type Array
     */
    getAddedChildren: function() {
        if (!this._addedChildIds) {
            return null;
        }
        var components = [];
        for (var i = 0; i < this._addedChildIds.length; ++i) {
            components[i] = this._manager._idMap[this._addedChildIds[i]];
        }
        return components;
    },
    
    /**
     * Returns an array containing the children removed in this update,
     * or null if none were removed.
     * 
     * @return the removed children
     * @type Array
     */
    getRemovedChildren: function() {
        if (!this._removedChildIds) {
            return null;
        }
        var components = [];
        for (var i = 0; i < this._removedChildIds.length; ++i) {
            components[i] = this._manager._removedIdMap[this._removedChildIds[i]];
        }
        return components;
    },
    
    /**
     * Returns an array containing the descendants of any children removed in
     * this update, or null if none were removed.  The removed children
     * themselves are not returned by this method.
     * 
     * @return the removed descendants
     * @type Array
     */
    getRemovedDescendants: function() {
        if (!this._removedDescendantIds) {
            return null;
        }
        var components = [];
        for (var i = 0; i < this._removedDescendantIds.length; ++i) {
            components[i] = this._manager._removedIdMap[this._removedDescendantIds[i]];
        }
        return components;
    },
    
    /**
     * Returns an array containing the children of this component whose
     * LayoutDatas have changed in this update, or null if no such
     * changes were made.
     * 
     * @return the updated layout data children
     * @type Array
     */
    getUpdatedLayoutDataChildren: function() {
        if (!this._updatedLayoutDataChildIds) {
            return null;
        }
        var components = [];
        for (var i = 0; i < this._updatedLayoutDataChildIds.length; ++i) {
            components[i] = this._manager._idMap[this._updatedLayoutDataChildIds[i]];
        }
        return components;
    },
    
    /**
     * Determines if any children were added during this update.
     * 
     * @return true if any children were added
     * @type Boolean
     */
    hasAddedChildren: function() {
        return this._addedChildIds != null;
    },
    
    /**
     * Determines if any children were removed during this update.
     * 
     * @return true if any children were removed
     * @type Boolean
     */
    hasRemovedChildren: function() {
        return this._removedChildIds != null;
    },
    
    /**
     * Determines if any children had their LayoutData changed during this update.
     * 
     * @return true if any children had their LayoutData changed
     * @type Boolean
     */
    hasUpdatedLayoutDataChildren: function() {
        return this._updatedLayoutDataChildIds != null;
    },
    
    /**
     * Determines if this update has any changed properties.
     * 
     * @return true if properties are being updated
     * @type Boolean
     */
    hasUpdatedProperties: function() {
        return this._propertyUpdates != null;
    },
    
    /**
     * Returns a <code>PropertyUpdate</code> describing an update to the
     * property with the given <code>name</code>.
     * 
     * @param name the name of the property being updated
     * @return the <code>PropertyUpdate</code>, or null if none exists
     * @type Echo.Update.ComponentUpdate.PropertyUpdate
     */
    getUpdatedProperty: function(name) {
        if (this._propertyUpdates == null) {
            return null;
        }
        return this._propertyUpdates[name];
    },
    
    /**
     * Determines if any listeners of a specific type were added or removed
     * from the component.
     * 
     * @param {String} listenerType the type of listener to query
     */
    isListenerTypeUpdated: function(listenerType) {
        return this._listenerUpdates == null ? false : this._listenerUpdates[listenerType]; 
    },
    
    /**
     * Returns the names of all properties being updated in this update.
     * 
     * @return the names of all updated properties, if no properties are updated an
     *         empty array is returned
     * @type Array
     */
    getUpdatedPropertyNames: function() {
        if (this._propertyUpdates == null) {
            return [];
        }
        var updatedPropertyNames = [];
        for (var i in this._propertyUpdates) {
            updatedPropertyNames.push(i);
        }
        return updatedPropertyNames;
    },
    
    /**
     * Determines if any of the specified properties has been
     * updated in this update.  The provided object should have
     * have keys for the desired property names and  values that evaluate 
     * to true, e.g. to determine if either the "text" and/or "icon" properties
     * changed, specify {text: true, icon: true}.
     * 
     * @param updatedPropertySet the updated property set
     * @return true if any of the specified properties has been updated in this update
     * @type Boolean
     */
    hasUpdatedPropertyIn: function(updatedPropertySet) {
        for (var x in this._propertyUpdates) {
            if (updatedPropertySet[x]) {
                return true;
            }
        }
        return false;
    },

    /**
     * Determines if the set of updated property names is contained
     * within the specified set.  The provided object should have
     * have keys for the desired property names and  values that evaluate 
     * to true, e.g. to determine if no properties other than "text" and "icon"
     * changed, specify {text: true, icon: true}. 
     * 
     * @param updatedPropertySet the updated property set
     * @return true if the set of updated property names is contained within the specified set
     * @type Boolean
     */
    isUpdatedPropertySetIn: function(updatedPropertySet) {
        for (var x in this._propertyUpdates) {
            if (!updatedPropertySet[x]) {
                return false;
            }
        }
        return true;
    },
    
    /**
     * Records the removal of a child from the parent component.
     * 
     * @param {Echo.Component} child the removed child
     */
    _removeChild: function(child) {
        this._manager._removedIdMap[child.renderId] = child;
    
        if (this._addedChildIds) {
            // Remove child from add list if found.
            Core.Arrays.remove(this._addedChildIds, child.renderId);
        }
        
        if (this._updatedLayoutDataChildIds) {
            // Remove child from updated layout data list if found.
            Core.Arrays.remove(this._updatedLayoutDataChildIds, child.renderId);
        }
    
        if (!this._removedChildIds) {
            this._removedChildIds = [];
        }
        
        this._removedChildIds.push(child.renderId);
    
        for (var i = 0; i < child.children.length; ++i) {
            this._removeDescendant(child.children[i]);
        }
    },
    
    /**
     * Records the removal of a descendant of the parent component.
     * All children of a removed component are recorded as removed
     * descendants when the child is removed.
     * This method will recursively invoke itself on children of
     * the specified descendant.
     * 
     * @param {Echo.Component} descendant the removed descendant 
     */
    _removeDescendant: function(descendant) {
        this._manager._removedIdMap[descendant.renderId] = descendant;
        if (!this._removedDescendantIds) {
            this._removedDescendantIds = [];
        }
        this._removedDescendantIds.push(descendant.renderId);
        for (var i = 0; i < descendant.children.length; ++i) {
            this._removeDescendant(descendant.children[i]);
        }
    },
    
    /**
     * Returns a string representation.
     * 
     * @return a string representation
     * @type String
     */
    toString: function() {
        var s = "ComponentUpdate\n";
        s += "- Parent: " + this.parent + "\n";
        s += "- Adds: " + this._addedChildIds + "\n";
        s += "- Removes: " + this._removedChildIds + "\n";
        s += "- DescendantRemoves: " + this._removedDescendantIds + "\n";
        s += "- Properties: " + Core.Debug.toString(this._propertyUpdates) + "\n";
        s += "- LayoutDatas: " + this._updatedLayoutDataChildIds + "\n";
        return s;
    },
    
    /**
     * Records the update of the LayoutData of a child component.
     * 
     * @param {Echo.Component} child the child component whose layout data was updated
     */
    _updateLayoutData: function(child) {
        this._manager._idMap[child.renderId] = child;
        if (this._updatedLayoutDataChildIds == null) {
            this._updatedLayoutDataChildIds = [];
        }
        this._updatedLayoutDataChildIds.push(child.renderId);
    },
    
    /**
     * Records the addition or removal of listeners to the parent component.
     * 
     * @param {String} listenerType the listener type
     */
    _updateListener: function(listenerType) {
        if (this._listenerUpdates == null) {
            this._listenerUpdates = { };
        }
        this._listenerUpdates[listenerType] = true;
    },
    
    /**
     * Records the update of a property of the parent component.
     * 
     * @param {String} propertyName the name of the property
     * @param oldValue the previous value of the property
     * @param newValue the new value of the property
     */
   _updateProperty: function(propertyName, oldValue, newValue) {
        if (this._propertyUpdates == null) {
            this._propertyUpdates = { };
        }
        var propertyUpdate = new Echo.Update.ComponentUpdate.PropertyUpdate(oldValue, newValue);
        this._propertyUpdates[propertyName] = propertyUpdate;
    }
});

/**
 * Monitors and records updates made to the application between repaints.
 * Provides API to determine changes to component hierarchy since last update
 * in order to efficiently repaint the screen.
 */
Echo.Update.Manager = Core.extend({
    
    /**
     * Associative mapping between component ids and Echo.Update.ComponentUpdate
     * instances.
     */
    _componentUpdateMap: null,
    
    /**
     * Flag indicating whether a full refresh or incremental update will be performed.
     * @type Boolean
     */
    fullRefreshRequired: false,
    
    /**
     * The application whose updates are being managed.
     * @type Echo.Application
     */
    application: null,
    
    /**
     * Flag indicating whether any updates are pending.
     * @type Boolean
     */
    _hasUpdates: false,
    
    /**
     * Internal listener list for update listeners.
     * @type Core.ListenerList
     */
    _listenerList: null,
    
    /**
     * Associative mapping between component ids and component instances for all
     * updates held in this manager object.
     */
    _idMap: null,
    
    /**
     * Associative mapping from the ids of components which are to be removed in this update to the components themselves.
     */
    _removedIdMap: null,
    
    /** 
     * The id of the last parent component whose child was analyzed by
     * _isAncestorBeingAdded() that resulted in that method returning false.
     * This id is stored for performance optimization purposes.
     * This performance optimization relies on the fact that _isAncestorBeingAdded()
     * will be invoked for each attempt to modify the hierarchy.
     * @type String
     */
    _lastAncestorTestParentId: null,
    
    /**
     * Creates a new Update Manager.
     *
     * @param {Echo.Application} application the supported application
     */
    $construct: function(application) {
        this._componentUpdateMap = { };
        this.application = application;
        this._listenerList = new Core.ListenerList();
        this._idMap = { };
        this._removedIdMap = { };
    },
    
    /**
     * Adds a listener to receive notification of update events.
     * 
     * @param {Function} l the listener to add
     */
    addUpdateListener: function(l) {
        this._listenerList.addListener("update", l);
    },
    
    /**
     * Creates a new ComponentUpdate object (or returns an existing one) for a
     * specific parent component.
     * 
     * @param {Echo.Component} parent the parent Component
     * @return a ComponentUpdate instance for that Component
     * @type Echo.Update.ComponentUpdate 
     */
    _createComponentUpdate: function(parent) {
        this._hasUpdates = true;
        var update = this._componentUpdateMap[parent.renderId];
        if (!update) {
            update = new Echo.Update.ComponentUpdate(this, parent);
            this._componentUpdateMap[parent.renderId] = update;
        }
        return update;
    },
    
    /**
     * Permanently disposes of the Update Manager, freeing any resources.
     */
    dispose: function() {
        this.application = null;
    },
    
    /**
     * Notifies update listeners of an event.
     */
    _fireUpdate: function() {
        if (!this._listenerList.isEmpty()) {
            this._listenerList.fireEvent({type: "update", source: this});
        }
    },
    
    /**
     * Returns the current pending updates.  Returns null in the event that that no pending updates exist.
     * 
     * @return an array containing all component updates (as Echo.Update.ComponentUpdates)
     * @type Array
     */
    getUpdates: function() {
        var updates = [];
        for (var key in this._componentUpdateMap) {
            updates.push(this._componentUpdateMap[key]);
        }
        return updates;
    },
    
    /**
     * Determines if any updates exist in the Update Manager.
     * 
     * @return true if any updates are present
     * @type Boolean
     */
    hasUpdates: function() {
        return this._hasUpdates;
    },
    
    /**
     * Determines if an ancestor of the specified component is being added.
     * This method must be invoked by all hierarchy modification operations.
     * 
     * @param {Echo.Component} component the component to evaluate
     * @return true if the component or an ancestor of the component is being added
     * @type Boolean
     */
    _isAncestorBeingAdded: function(component) {
        var child = component;
        var parent = component.parent;
        
        var originalParentId = parent ? parent.renderId : null;
        if (originalParentId && this._lastAncestorTestParentId == originalParentId) {
            // If last invocation of _isAncestorBeingAdded for the same component returned false, it is safe
            // to assume that this invocation will return false as well.
            return false;
        }
        
        while (parent) {
            var update = this._componentUpdateMap[parent.renderId];
            if (update && update._addedChildIds) {
                for (var i = 0; i < update._addedChildIds.length; ++i) {
                    if (update._addedChildIds[i] == child.renderId) {
                        return true;
                    }
                }
            }
            child = parent;
            parent = parent.parent;
        }
        
        this._lastAncestorTestParentId = originalParentId;
        return false;
    },
    
    /**
     * Processes a child addition to a component.
     * 
     * @param {Echo.Component} parent the parent component
     * @param {Echo.Component} child the added child component
     */
    _processComponentAdd: function(parent, child) {
        if (this.fullRefreshRequired) {
            // A full refresh indicates an update already exists which encompasses this update.
            return;
        }
        if (this._isAncestorBeingAdded(child)) {
            // An ancestor being added indicates an update already exists which encompasses this update.
            return;
        }
        var update = this._createComponentUpdate(parent);
        update._addChild(child);
    },
    
    /**
     * Process a layout data update to a child component.
     * 
     * @param {Echo.Component} updatedComponent the updated component
     */
    _processComponentLayoutDataUpdate: function(updatedComponent) {
        if (this.fullRefreshRequired) {
            // A full refresh indicates an update already exists which encompasses this update.
            return;
        }
        var parent = updatedComponent.parent;
        if (parent == null || this._isAncestorBeingAdded(parent)) {
            // An ancestor being added indicates an update already exists which encompasses this update.
            return;
        }
        var update = this._createComponentUpdate(parent);
        update._updateLayoutData(updatedComponent);
    },
    
    /**
     * Process a layout data update to a child component.
     * 
     * @param {Echo.Component} updatedComponent the updated component
     */
    _processComponentListenerUpdate: function(parent, listenerType) {
        if (this.fullRefreshRequired) {
            // A full refresh indicates an update already exists which encompasses this update.
            return;
        }
        if (this._isAncestorBeingAdded(parent)) {
            // An ancestor being added indicates an update already exists which encompasses this update.
            return;
        }
        var update = this._createComponentUpdate(parent);
        update._updateListener(listenerType);
    },
    
    /**
     * Processes a child removal from a component.
     * 
     * @param {Echo.Component} parent the parent component
     * @param {Echo.Component} child the removed child component
     */
    _processComponentRemove: function(parent, child) {
        if (this.fullRefreshRequired) {
            // A full refresh indicates an update already exists which encompasses this update.
            return;
        }
        if (this._isAncestorBeingAdded(parent)) {
            // An ancestor being added indicates an update already exists which encompasses this update.
            return;
        }
        var update = this._createComponentUpdate(parent);
        update._removeChild(child);
        
        var disposedIds = null;
        
        // Search updated components for descendants of removed component.
        // Any found descendants will be removed and added to this update's
        // list of removed components.
        for (var testParentId in this._componentUpdateMap) {
             var testUpdate = this._componentUpdateMap[testParentId];
             if (child.isAncestorOf(testUpdate.parent)) {
                 update._appendRemovedDescendants(testUpdate);
                 if (disposedIds == null) {
                     disposedIds = [];
                 }
                 disposedIds.push(testParentId);
             }
        }
        
        if (disposedIds != null) {
            for (var i = 0; i < disposedIds.length; ++i) {
                delete this._componentUpdateMap[disposedIds[i]];
            }
        }
    },
    
    /**
     * Processes a property update to a component.
     * 
     * @param {Echo.Component} component the updated component
     * @param {String} propertyName the updated property name
     * @param oldValue the previous value of the property
     * @param newValue the new value of the property
     */
    _processComponentPropertyUpdate: function(component, propertyName, oldValue, newValue) {
        if (this.fullRefreshRequired) {
            // A full refresh indicates an update already exists which encompasses this update.
            return;
        }
        if (this._isAncestorBeingAdded(component)) {
            // An ancestor being added indicates an update already exists which encompasses this update.
            return;
        }
        var update = this._createComponentUpdate(component);
        update._updateProperty(propertyName, oldValue, newValue);
    },
    
    /**
     * Processes an event requiring a full-refresh.
     */
    _processFullRefresh: function() {
        // Mark all components as having being removed from root.
        for (var i = 0; i < this.application.rootComponent.children.length; ++i) {
            this._processComponentRemove(this.application.rootComponent, this.application.rootComponent.children[i]);
        }

        // Flag full refresh as required, such that all future property updates bounce.
        this.fullRefreshRequired = true;
        
        // Retrieve root component update and mark as full refresh.
        var update = this._createComponentUpdate(this.application.rootComponent);
        update.fullRefresh = true;
        
        // Notify container.
        this._fireUpdate();
    },
    
    /**
     * Processes component update notification received from the application instance.
     * 
     * @param {Echo.Component} component the updated component
     * @param {String} propertyName the updated property name
     * @param oldValue the previous value of the property
     * @param newValue the new value of the property
     */
    _processComponentUpdate: function(parent, propertyName, oldValue, newValue) {
        if (propertyName == "children") {
            // Child added/removed.
            if (newValue == null) {
                // Process child removal.
                this._processComponentRemove(parent, oldValue);
            } else {
                // Process child addition.
                this._processComponentAdd(parent, newValue);
            }
        } else if (propertyName == "layoutData") {
            // Process a layout data update.
            this._processComponentLayoutDataUpdate(parent);
        } else if (propertyName == "listeners") {
            // Process listeners addition/removal.
            this._processComponentListenerUpdate(parent, oldValue || newValue);
        } else {
            // Process property update.
            this._processComponentPropertyUpdate(parent, propertyName, oldValue, newValue);
        }
        this._fireUpdate();
    },

    /**
     * Purges all updates from the manager.
     * Invoked after the client has repainted the screen.
     */
    purge: function() {
        this.fullRefreshRequired = false;
        this._componentUpdateMap = { };
        this._idMap = { };
        this._removedIdMap = { };
        this._hasUpdates = false;
        this._lastAncestorTestParentId = null;
    },
    
    /**
     * Removes a listener from receiving notification of update events.
     * 
     * @param {Function} l the listener to remove
     */
    removeUpdateListener: function(l) {
        this._listenerList.removeListener("update", l);
    },
    
    /**
     * Returns a string representation.
     * 
     * @return a string representation
     * @type String
     */
    toString: function() {
        var s = "[ UpdateManager ]\n";
        if (this.fullRefreshRequired) {
            s += "fullRefresh";
        } else {
            for (var key in this._componentUpdateMap) {
                s += this._componentUpdateMap[key];
            }
        }
        return s;
    }
});

// Built-in Component Object Definitions

/**
 * Abstract base class for button components.
 *
 * @sp {String} actionCommand the action command fired in action events 
 *     when the button is pushed
 * @sp {#Alignment} alignment the alignment of the button's content (only horizontal alignments are supported, any vertical
 *     component of the alignment value will not be rendered)
 * @sp {#FillImage} backgroundImage the background image
 * @sp {#Border} border the default button border
 * @sp {#Color} disabledBackground the disabled background color
 * @sp {#FillImage} disabledBackgroundImage the disabled background image
 * @sp {#Border} disabledBorder the disabled border
 * @sp {#Font} disabledFont the disabled font
 * @sp {#Color} disabledForeground the disabled foreground color
 * @sp {#ImageReference} disabledIcon the disabled icon
 * @sp {#Color} focusedBackground the focused background
 * @sp {#FillImage}focusedBackgroundImage the focused background image
 * @sp {#Border} focusedBorder the focused border
 * @sp {Boolean} focusedEnabled boolean flag indicating whether focus effects are enabled 
 * @sp {#Font} focusedFont the focused font
 * @sp {#Color} focusedForeground the focused foreground color
 * @sp {#ImageReference} focusedIcon the focused icon
 * @sp {#Extent} height the button height
 * @sp {#ImageReference} icon the button icon
 * @sp {#Extent} iconTextMargin the extent margin between the button's icon and text
 * @sp {#Insets} insets the inset padding margin between the button's border and its content
 * @sp {Boolean} lineWrap boolean flag indicating whether text within the button may be wrapped
 * @sp {#Color} pressedBackground the pressed background color
 * @sp {#FillImage} pressedBackgroundImage the pressed background image
 * @sp {#Border} pressedBorder the pressed border
 * @sp {Boolean} pressedEnabled boolean flag indicating whether pressed effects are enabled 
 * @sp {#Font} pressedFont the pressed font
 * @sp {#Font} pressedForeground the pressed foreground color
 * @sp {#ImageReference} pressedIcon the pressed icon
 * @sp {#Color} rolloverBackground the rollover background color
 * @sp {#FillImage} rolloverBackgroundImage the rollover background image
 * @sp {#Border} rolloverBorder the rollover border
 * @sp {Boolean} rolloverEnabled boolean flag indicating whether rollover effects are enabled
 * @sp {#Font} rolloverFont the rollover font
 * @sp {#Color} rolloverForeground the rollover foreground
 * @sp {#ImageReference} rolloverIcon the rollover icon
 * @sp {String} text the text of the button
 * @sp {#Alignment} textAlignment the alignment of the text
 * @sp {#Alignment} textPosition the position of the text relative to the icon
 * @sp {String} toolTipText the tool tip text
 * @sp {#Extent} width the width of the button
 * @event action An event fired when the button is pressed (clicked).  The <code>actionCommand</code> property of the pressed
 *        button is provided as a property.
 */
Echo.AbstractButton = Core.extend(Echo.Component, {

    $abstract: true,
    
    $load: function() {
        Echo.ComponentFactory.registerType("AbstractButton", this);
        Echo.ComponentFactory.registerType("AB", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "AbstractButton",

    /** @see Echo.Component#focusable */
    focusable: true,
    
    $virtual: {
        
        /**
         * Programmatically performs a button action.
         */
        doAction: function() {
            this.fireEvent({type: "action", source: this, actionCommand: this.get("actionCommand")});
        }
    }
});

/**
 * Button component: a stateless "push" button which is used to initiate an
 * action.  May not contain child components.
 */
Echo.Button = Core.extend(Echo.AbstractButton, {

    $load: function() {
        Echo.ComponentFactory.registerType("Button", this);
        Echo.ComponentFactory.registerType("B", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "Button"
});

/**
 * An abstract base class for on/off toggle button components.
 *
 * @sp {#ImageReference} disabledStateIcon the disabled state icon to display when the toggle state is deselected
 * @sp {#ImageReference} disabledSelectedStateIcon the disabled state icon to display when thetoggle  state is selected
 * @sp {#ImageReference} pressedStateIcon the pressed state icon to display when the toggle state is deselected
 * @sp {#ImageReference} pressedSelectedStateIcon the pressed state icon to display when the toggle state is selected
 * @sp {#ImageReference} rolloverStateIcon the rollover state icon to display when the toggle state is deselected
 * @sp {#ImageReference} rolloverSelectedStateIcon the rollover state icon to display when the toggle state is selected
 * @sp {#ImageReference} selectedStateIcon the default state icon to display when the toggle state is deselected
 * @sp {#Alignment} stateAlignment the alignment of the state icon relative to the button's icon/text
 * @sp {#Alignment} statePosition the position (an alignment value) of the state icon relative to the button's icon/text
 * @sp {#ImageReference} stateIcon the default state icon to display when the toggle state is selected
 * @sp {Number} stateMargin the margin between the state icon and the button's icon/text
 */
Echo.ToggleButton = Core.extend(Echo.AbstractButton, {

    $load: function() {
        Echo.ComponentFactory.registerType("ToggleButton", this);
        Echo.ComponentFactory.registerType("TB", this);
    },

    $abstract: true,

    /** @see Echo.Component#componentType */
    componentType: "ToggleButton"
});

/**
 * CheckBox component: a simple on/off toggle button. May not contain child
 * components.
 */
Echo.CheckBox = Core.extend(Echo.ToggleButton, {

    $load: function() {
        Echo.ComponentFactory.registerType("CheckBox", this);
        Echo.ComponentFactory.registerType("CB", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "CheckBox"
});

/**
 * RadioButton component: a toggle button which allows a user to select one
 * option from a group of options. Radio buttons should be assigned to a unique
 * named group (by setting the <code>group</code> property). Only one radio
 * button in a group will be selected at a given time. May not contain child
 * components.
 * 
 * @sp {String} group a unique identifier used to group radio buttons together
 *     (set this property to a value generated by Echo.Application.generateUid()
 *     to guarantee uniqueness)
 */
Echo.RadioButton = Core.extend(Echo.ToggleButton, {

    $load: function() {
        Echo.ComponentFactory.registerType("RadioButton", this);
        Echo.ComponentFactory.registerType("RB", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "RadioButton"
});

/**
 * Abstract base class for selection list components (i.e., SelectFields and
 * ListBoxes).
 * 
 * @cp {Array} items the array of items contained in the list component. The
 *     value of the 'text' property or toString() value of the item will be
 *     displayed in the selection component.
 * @cp selectedId the values of the id property of the selected item, or an
 *     array of the id values when multiple items are selected
 * @cp selection the index of the selected item, or an array of the indices of
 *     selected items when multiple items are selected
 * 
 * @sp {#Border} border the default border
 * @sp {#Color} disabledBackground the disabled background color
 * @sp {#Border} disabledBorder the disabled border
 * @sp {#Font} disabledFont the disabled font
 * @sp {#Color} disabledForeground the disabled foreground color
 * @sp {#Extent} height the component height
 * @sp {#Insets} insets the inset margin between the border and the items of the
 *     list component
 * @sp {#Color} rolloverBackground the rollover background color
 * @sp {#Border} rolloverBorder the rollover border
 * @sp {#Font} rolloverFont the rollover font
 * @sp {#Color} rolloverForeground the rollover foreground color
 * @sp {#Extent} width the component width
 * @event action An event fired when an item is selected (clicked).
 */
Echo.AbstractListComponent = Core.extend(Echo.Component, {

    $abstract: true,

    $load: function() {
        Echo.ComponentFactory.registerType("AbstractListComponent", this);
        Echo.ComponentFactory.registerType("LC", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "AbstractListComponent",

    /** @see Echo.Component#focusable */
    focusable: true,
    
    $virtual: {
        
        /**
         * Programmatically performs a list select action.
         */
        doAction: function() {
            this.fireEvent({type: "action", source: this, actionCommand: this.get("actionCommand")});
        }
    }
});

/**
 * ListBox component: a selection component which displays selection items in a
 * list. May be configured to allow the selection of one item at a time, or to
 * allow the selection of multiple items at one time. Does not support child
 * components.
 * 
 * @sp {Number} selectionMode a value indicating the selection mode, one of the
 *     following values:
 *     <ul>
 *     <li><code>Echo.ListBox.SINGLE_SELECTION</code> (the default)</li>
 *     <li><code>Echo.ListBox.MULTIPLE_SELECTION</code></li>
 *     </ul>
 */
Echo.ListBox = Core.extend(Echo.AbstractListComponent, {

    $static: {

        /**
         * Constant for <code>selectionMode</code> property indicating single selection.
         * @type Number
         */
        SINGLE_SELECTION: 0,
        
        /**
         * Constant for <code>selectionMode</code> property indicating multiple selection.
         * @type Number
         */
        MULTIPLE_SELECTION: 2
    },

    $load: function() {
        Echo.ComponentFactory.registerType("ListBox", this);
        Echo.ComponentFactory.registerType("LB", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "ListBox"
});

/**
 * SelectField component: a selection component which display selection items in
 * a drop-down field. Allows the selection of only one item at a time. Does not
 * support child components.
 */
Echo.SelectField = Core.extend(Echo.AbstractListComponent, {

    $load: function() {
        Echo.ComponentFactory.registerType("SelectField", this);
        Echo.ComponentFactory.registerType("SF", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "SelectField"
});

/**
 * Column component: a layout container which renders its content in a single
 * vertical column of cells. May contain zero or more child components. Does not
 * support pane components as children.
 * 
 * @sp {#Border} border the border displayed around the entire column
 * @sp {#Extent} cellSpacing the extent margin between cells of the column
 * @sp {#Insets} insets the inset margin between the column border and its cells
 * 
 * @ldp {#Alignment} alignment the alignment of the child component within its
 *      cell
 * @ldp {#Color} background the background of the child component's cell
 * @ldp {#FillImage} backrgoundImage the background image of the child
 *      component's cell
 * @ldp {#Extent} height the height of the child component's cell
 * @ldp {#Insets} insets the insets margin of the child component's cell (this
 *      inset is added to any inset set on the container component)
 */
Echo.Column = Core.extend(Echo.Component, {

    $load: function() {
        Echo.ComponentFactory.registerType("Column", this);
        Echo.ComponentFactory.registerType("C", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "Column"
});

/**
 * Composite component: a generic composite component abstract base class. This
 * class is intended to be used as base class for composite components. Provides
 * no rendering properties (other than those specified in Component). May
 * contain at most one child component. May not contain a pane component as a
 * child.
 * 
 * This class provides no benefit if you are providing a custom
 * synchronization/rendering peer. In such cases, <code>Echo.Component</code>
 * itself should be derived instead of this class.
 */
Echo.Composite = Core.extend(Echo.Component, {

    $abstract: true,
    
    $load: function() {
        Echo.ComponentFactory.registerType("Composite", this);
        Echo.ComponentFactory.registerType("CM", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "Composite"
});

/**
 * Panel component: a single child container. Provides a configurable border,
 * margin, background image, and dimensions. May contain at most one child. May
 * contain pane components, and may be used as a means to add pane components to
 * containers which do not allow pane components as children. In such a case it
 * may be necessary to manually set the height property of the Panel itself.
 * 
 * @sp {#Alignment} alignment the alignment of the child component within the panel
 * @sp {#FillImage} backgroundImage the background image
 * @sp {#Border} border the border surrounding the child component
 * @sp {#Extent} height the height of the panel
 * @sp {#FillImageBorder} imageBorder an image-based border surrounding the child component (overrides <code>border</code>
 *     property when set)
 * @sp {#Insets} insets the inset padding margin between the panel border and its content
 * @sp {#Extent} width the width of the panel
 */
Echo.Panel = Core.extend(Echo.Composite, {

    $load: function() {
        Echo.ComponentFactory.registerType("Panel", this);
        Echo.ComponentFactory.registerType("P", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "Panel"
});

/**
 * ContentPane component: a high-level container/layout object which fills a
 * region and optionally provides the capability to add floating panes (e.g.
 * <code>WindowPane</code>s) above that content. A ContentPane is often
 * suitable for use as a base class to extend when creating a composite (pane)
 * component. May contain at most one non-floating pane component as a child.
 * May contain zero or more floating pane components as children.
 * 
 * @sp {#FillImage} backgroundImage the background image
 * @sp {#Extent} horizontalScroll the horizontal scroll position
 * @sp {#Insets} insets the inset margin of the content
 * @sp {Number} overflow the scrollbar behavior used when content overflows the
 *     boundaries of the pane, one of the following values:
 *     <ul>
 *     <li><code>OVERFLOW_AUTO</code> (the default)</li>
 *     <li><code>OVERFLOW_HIDDEN</code> hide content that overflows</li>
 *     <li><code>OVERFLOW_SCROLL</code> always display scrollbars</li>
 *     </ul>
 * @sp {#Extent} verticalScroll the vertical scroll position
 */
Echo.ContentPane = Core.extend(Echo.Component, {

    $static: {
    
        /**
         * Setting for <code>overflow</code> property that scrollbars should be displayed when content overflows.
         * @type Number
         */
        OVERFLOW_AUTO: 0,

        /** 
         * Setting for <code>overflow</code> property indicating that overflowing content should be hidden.
         * @type Number 
         */
        OVERFLOW_HIDDEN: 1,

        /** 
         * Setting for <code>overflow</code> property indicating that scrollbars should always be displayed.
         * @type Number 
         */
        OVERFLOW_SCROLL: 2
    },

    $load: function() {
        Echo.ComponentFactory.registerType("ContentPane", this);
        Echo.ComponentFactory.registerType("CP", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "ContentPane",
    
    /** @see Echo.Component#pane */
    pane: true
});

/**
 * Grid component: a layout container which displays children in a grid.
 * Individual child component cells may be configured to span multiple rows or
 * columns using layout data. May contain zero or more components as children.
 * May not contain panes as children.
 * 
 * @sp {#Border} border the border displayed around the grid, and between cells
 * @sp {#Extent} columnWidth an indexed property whose indices represent the
 *     width of each column of the grid
 * @sp {#Extent} height the overall height of the grid (may not be specified
 *     as a percentage value)
 * @sp {#Insets} insets the default inset margin displayed in each cell
 * @sp {Number} orientation a value indicating whether the grid will be laid out
 *     horizontally and then vertically or vice-versa, one of the following
 *     values:
 *     <ul>
 *     <li><code>ORIENTATION_HORIZONTAL</code> (the default) lay children out
 *     horizontally, then vertically</li>
 *     <li><code>ORIENTATION_VERTICAL</code> lay children out vertically,
 *     then horizontally</li>
 *     </ul>
 * @sp {#Extent} rowHeight an indexed property whose indices represent the height
 *     of each row of the grid
 * @sp {Number} size the number of cells to render before wrapping to the next
 *     column/row (default 2)
 * @sp {#Extent} width the overall width of the grid
 * @ldp {#Alignment} alignment the alignment of the child component within its
 *      cell
 * @ldp {#Color} background the background of the child component's cell
 * @ldp {#FillImage} backrgoundImage the background image of the child
 *      component's cell
 * @ldp {Number} columnSpan the number of column the containing cell should span
 *      (a value of <code>SPAN_FILL</code> indicates that cell should fill all
 *      columns until the end of the grid is reached; this value may only be
 *      used in this property for horizontally oriented grids)
 * @ldp {#Insets} insets the insets margin of the child component's cell (this
 *      inset is added to any inset set on the container component)
 * @ldp {Number} rowSpan the number of rows the containing cell should span (a
 *      value of <code>SPAN_FILL</code> indicates that cell should fill all
 *      rows until the end of the grid is reached; this value may only be used
 *      in this property for vertically oriented grids)
 */
Echo.Grid = Core.extend(Echo.Component, {

    $static: {

        /**
         * Constant value for <code>orientation</code> property indicating cells 
         * should be laid out horizontally and then vertically.
         * <code>ORIENTATION_HORIZONTAL</code> is the default orientation setting.
         * @type Number
         */
        ORIENTATION_HORIZONTAL: 0,
    
        /**
         * Constant value for <code>orientation</code> property indicating cells 
         * should be laid out vertically and then horizontally. 
         * @type Number
         */
        ORIENTATION_VERTICAL: 1,

        /**
         * A constant value for the <code>columnSpan</code> and <code>rowSpan</code>
         * properties of <code>LayoutData</code> objects used by children of a
         * Grid indicating that a cell should fill all remaining cells.  
         * <p>
         * <strong>WARNING</strong>: This value may ONLY be used for spans in the
         * direction of the layout of the <code>Grid</code>, i.e., it may only be 
         * used for column-spans if the orientation is horizontal, and it may only
         * be used for row-spans if the orientation is vertical.
         * @type Number
         */
        SPAN_FILL: -1
    },

    $load: function() {
        Echo.ComponentFactory.registerType("Grid", this);
        Echo.ComponentFactory.registerType("G", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "Grid"
});

/**
 * Label component: displays a text string, an icon, or both. May not contain
 * child components.
 * 
 * @sp {Boolean} formatWhitespace a boolean flag indicating whether whitespace
 *     formatting should be applied to the label
 * @sp {Boolean} lineWrap a boolean flag indicating whether long lines should be
 *     wrapped
 * @sp {#ImageReference} icon the icon/image to display in the label
 * @sp {#Extent} iconTextMargin an extent setting describing the distance
 *     between the label and icon
 * @sp {String} text the text to display in the label
 * @sp {#Alignment} textAlignment an alignment setting describing the alignment
 *     of the label's text
 * @sp {#Alignment} textPosition an alignment setting describing the position of
 *     the label's text relative to the icon
 */
Echo.Label = Core.extend(Echo.Component, {

    $load: function() {
        Echo.ComponentFactory.registerType("Label", this);
        Echo.ComponentFactory.registerType("L", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "Label"
});

/**
 * Row component: a layout container which renders its content in a single horizontal row of cells.
 * May have zero or more child components.  Does not support pane components as children.
 *
 * @sp {#Border} border the border displayed around the entire column
 * @sp {#Extent} cellSpacing the extent margin between cells of the column
 * @sp {#Insets} insets the inset margin between the column border and its cells
 *
 * @ldp {#Alignment} alignment the alignment of the child component within its cell
 * @ldp {#Color} background the background of the child component's cell
 * @ldp {#FillImage} backrgoundImage the background image of the child component's cell
 * @ldp {#Insets} insets the insets margin of the child component's cell 
 *      (this inset is added to any inset set on the container component)
 * @ldp {#Extent} width the width of the child component's cell
 */
Echo.Row = Core.extend(Echo.Component, {

    $load: function() {
        Echo.ComponentFactory.registerType("Row", this);
        Echo.ComponentFactory.registerType("R", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "Row"
});

/**
 * SplitPane component: a pane component which displays two components
 * horizontally or vertically adjacent to one another, optionally allowing the
 * user to apportion space between the two using a resize handle. May have at
 * most two child components. Supports pane components as children.
 * 
 * @sp {Boolean} autoPositioned flag indicating whether the pane should set the
 *     separator position automatically based on size of first child. This
 *     feature is only available on vertically oriented panes, where the first
 *     child contains non-pane content.
 * @sp {Number} orientation the orientation of the SplitPane, one of the
 *     following values:
 *     <ul>
 *     <li><code>ORIENTATION_HORIZONTAL_LEADING_TRAILING</code> (the default)</li>
 *     <li><code>ORIENTATION_HORIZONTAL_TRAILING_LEADING</code></li>
 *     <li><code>ORIENTATION_HORIZONTAL_LEFT_RIGHT</code></li>
 *     <li><code>ORIENTATION_HORIZONTAL_RIGHT_LEFT</code></li>
 *     <li><code>ORIENTATION_VERTICAL_TOP_BOTTOM</code></li>
 *     <li><code>ORIENTATION_VERTICAL_BOTTOM_TOP</code></li>
 *     </ul>
 * @sp {Boolean} resizable flag indicating whether the pane separator can be
 *     moved
 * @sp {#Color} separatorColor the separator color
 * @sp {#Extent} separatorHeight the height of the separator (this property is
 *     used to determine the size of the separator in vertical orientations)
 * @sp {#FillImage} separatorHorizontalImage a FillImage used to paint the
 *     separator for horizontal orientations
 * @sp {#FillImage} separatorHorizontalRolloverImage a FillImage used to paint
 *     the separator for horizontal orientations when the mouse is over it
 * @sp {#Extent} separatorPosition an extent specifying the position of the
 *     separator
 * @sp {#Color} separatorRolloverColor the rollover separator color
 * @sp {#FillImage} separatorVerticalImage a FillImage used to paint the
 *     separator for vertical orientations
 * @sp {#FillImage} separatorVerticalRolloverImage a FillImage used to paint the
 *     separator for vertical orientations when the mouse is over it
 * @sp {#Extent} separatorWidth the width of the separator (this property is
 *     used to determine the size of the separator in horizontal orientations)
 * @ldp {#Alignment} alignment the alignment of the child component within its
 *      subpane
 * @ldp {#Color} background the background of the child component's subpane
 * @ldp {#FillImage} backgroundImage the background image of the child
 *      component's subpane
 * @ldp {#Insets} insets the insets margin of the child component's subpane
 * @ldp {#Extent} maximumSize the maximum size of the child component's subpane
 * @ldp {#Extent} minimumSize the minimum size of the child component's subpane
 * @ldp {Number} overflow the layout behavior to use when the child component is
 *      larger than its containing subpane, one of the following values:
 *      <ul>
 *      <li><code>OVERFLOW_AUTO</code> (the default)</li>
 *      <li><code>OVERFLOW_HIDDEN</code></li>
 *      <li><code>OVERFLOW_SCROLL</code></li>
 *      </ul>
 */
Echo.SplitPane = Core.extend(Echo.Component, {

    $static: {
    
        /**
         * Orientation property value indicating a leading / trailing layout.
         * @type Number
         */
        ORIENTATION_HORIZONTAL_LEADING_TRAILING: 0,

        /**
         * Orientation property value indicating a trailing / leading layout.
         * @type Number
         */
        ORIENTATION_HORIZONTAL_TRAILING_LEADING: 1,
        
        /**
         * Orientation property value indicating a left / right layout.
         * @type Number
         */
        ORIENTATION_HORIZONTAL_LEFT_RIGHT: 2,
        
        /**
         * Orientation property value indicating a right / left layout.
         * @type Number
         */
        ORIENTATION_HORIZONTAL_RIGHT_LEFT: 3,
        
        /**
         * Orientation property value indicating a top / bottom layout.
         * @type Number
         */
        ORIENTATION_VERTICAL_TOP_BOTTOM: 4,

        /**
         * Orientation property value indicating a bottom / top layout.
         * @type Number
         */
        ORIENTATION_VERTICAL_BOTTOM_TOP: 5,
        
        /**
         * Default separator position.
         * @type #Extent
         */
        DEFAULT_SEPARATOR_POSITION: "50%",
        
        /**
         * Default separator size for fixed SplitPanes.
         * @type #Extent
         */
        DEFAULT_SEPARATOR_SIZE_FIXED: 0,

        /**
         * Default separator size for resizable SplitPanes.
         * @type #Extent
         */
        DEFAULT_SEPARATOR_SIZE_RESIZABLE: 4,
        
        /** 
         * Default separator color.
         * @type #Color
         */
        DEFAULT_SEPARATOR_COLOR: "#3f3f4f",
        
        /** 
         * Setting for <code>overflow</code> property that scrollbars should be displayed when content overflows. 
         * @type Number
         */
        OVERFLOW_AUTO: 0,

        /** 
         * Setting for <code>overflow</code> property indicating that overflowing content should be hidden.
         * @type Number
         */
        OVERFLOW_HIDDEN: 1,

        /** 
         * Setting for <code>overflow</code> property indicating that scrollbars should always be displayed. 
         * @type Number
         */
        OVERFLOW_SCROLL: 2
    },

    $load: function() {
        Echo.ComponentFactory.registerType("SplitPane", this);
        Echo.ComponentFactory.registerType("SP", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "SplitPane",

    /** @see Echo.Component#pane */
    pane: true,
    
    /** @see Echo.Component#getFocusOrder */
    getFocusOrder: function() {
        if (this.children.length < 2) {
            return null;
        }
        
        switch (this.render("orientation")) {
        case Echo.SplitPane.ORIENTATION_VERTICAL_BOTTOM_TOP:
        case Echo.SplitPane.ORIENTATION_HORIZONTAL_TRAILING_LEADING:
            return [1, 0];
        case Echo.SplitPane.ORIENTATION_HORIZONTAL_LEFT_RIGHT:
            return this.getRenderLayoutDirection().isLeftToRight() ? null : [1, 0]; 
        case Echo.SplitPane.ORIENTATION_HORIZONTAL_RIGHT_LEFT:
            return this.getRenderLayoutDirection().isLeftToRight() ? [1, 0] : null; 
        default:
            return null;
        }
    }
});

/**
 * Abstract base class for text-entry components.
 * 
 * @cp {String} text the text value
 * @sp {String} actionCommand the action command fired when the enter key is
 *     pressed within the text component
 * @sp {#Alignment} alignment an alignment setting describing the alignment of
 *     the text
 * @sp {#FillImage} backgroundImage the background image to display in the
 *     component
 * @sp {#Border} border the border to display around the component
 * @sp {#Color} disabledBackground the disabled background color
 * @sp {#Color} disabledBackgroundImage the disabled background image
 * @sp {#Border} disabledBorder the disabled border
 * @sp {#Font} disabledFont the disabled font
 * @sp {#Color} disabledForeground the disabled foreground color
 * @sp {Boolean} editable flag indicating whether field is editable (true) or read-only (false); default value is true
 * @sp {#Extent} height the height of the component
 * @sp {#Extent} horizontalScroll the horizontal scrollbar position
 * @sp {#Insets} insets the inset margin between the border and the text content
 * @sp {Number} maximumLength the maximum number of characters which may be
 *     entered
 * @sp {#Color} readOnlyBackground the read-only background color
 * @sp {#Color} readOnlyBackgroundImage the read-only background image
 * @sp {#Border} readOnlyBorder the read-only border
 * @sp {#Font} readOnlyFont the read-only font
 * @sp {#Color} readOnlyForeground the read-only foreground color
 * @sp {Number} selectionStart the character index of the beginning of the selection
 * @sp {Number} selectionEnd the character index of the end of the selection
 * @sp {String} toolTipText the tool tip text
 * @sp {#Extent} verticalScroll the vertical scrollbar position
 * @sp {#Extent} width the width of the component
 * @event action An event fired when the enter/return key is pressed while the
 *        field is focused.
 */
Echo.TextComponent = Core.extend(Echo.Component, {

    $abstract: true,

    $load: function() {
        Echo.ComponentFactory.registerType("TextComponent", this);
        Echo.ComponentFactory.registerType("TC", this);
    },

    $virtual: {
        
        /**
         * Programmatically performs a text component action.
         */
        doAction: function() {
            this.fireEvent({type: "action", source: this, actionCommand: this.get("actionCommand")});
        },
        
        /**
         * Notifies listeners of a key down event.
         * 
         * @param keyCode the (standardized) key code
         */
        doKeyDown: function(keyCode) {
            var e = { type: "keyDown", source: this, keyCode: keyCode };
            this.fireEvent(e);
            return !e.veto;
        },
        
        /**
         * Notifies listeners of a key press event.
         * 
         * @param keyCode the (standardized) key code
         * @param charCode the charater code
         */
        doKeyPress: function(keyCode, charCode) {
            var e = { type: "keyPress", source: this, keyCode: keyCode, charCode: charCode };
            this.fireEvent(e);
            return !e.veto;
        }
    },

    /** @see Echo.Component#componentType */
    componentType: "TextComponent",

    /** @see Echo.Component#focusable */
    focusable: true
});

/**
 * TextArea component: a multiple-line text input field. May not contain child
 * components.
 */
Echo.TextArea = Core.extend(Echo.TextComponent, {

    $load: function() {
        Echo.ComponentFactory.registerType("TextArea", this);
        Echo.ComponentFactory.registerType("TA", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "TextArea"
});

/**
 * TextField component: a single-line text input field. May not contain child
 * components.
 */
Echo.TextField = Core.extend(Echo.TextComponent, {

    $load: function() {
        Echo.ComponentFactory.registerType("TextField", this);
        Echo.ComponentFactory.registerType("TF", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "TextField"
});

/**
 * PasswordField component: a single-line text input field which masks input.
 * May not contain child components.
 */
Echo.PasswordField = Core.extend(Echo.TextField, {

    $load: function() {
        Echo.ComponentFactory.registerType("PasswordField", this);
        Echo.ComponentFactory.registerType("PF", this);
    },
    
    /** @see Echo.Component#componentType */
    componentType: "PasswordField"
});

/**
 * WindowPane component: displays content in a movable and/or resizable window.
 * May only be added to a <code>ContentPane</code>. May contain at most one
 * child component. May contain pane components as children.
 * 
 * @sp {#FillImage} backgroundImage the background image to display within the
 *     content area
 * @sp {#FillImageBorder} border the border frame containing the WindowPane
 * @sp {Boolean} closable flag indicating whether the window is closable
 * @sp {Number} closeAnimationTime the duration of the close animation, in 
 *     milliseconds (default/zero value will result in no animation)
 * @sp {#ImageReference} closeIcon the close button icon
 * @sp {#Insets} closeIconInsets the inset margin around the close button icon
 * @sp {#ImageReference} closeRolloverIcon the close button rollover icon
 * @sp {#Extent} contentHeight the height of the content region of the window
 * @sp {#Extent} contentWidth the width of the content region of the window
 * @sp {#Insets} controlsInsets the inset margin around the controls area
 * @sp {#Extent} controlsSpacing the spacing between controls in the controls
 *     area
 * @sp {#Extent} height the outside height of the window, including its border
 * @sp {#ImageReference} icon the icon to display adjacent the window title
 * @sp {#Insets} iconInsets the inset margin around the icon
 * @sp {#Insets} insets the inset margin around the window content
 * @sp {Boolean} maximizeEnabled flag indicating whether maximize feature should
 *     be enabled
 * @sp {#ImageReference} maximizeIcon the minimize button icon
 * @sp {#Insets} maximizeIconInsets the inset margin around the maximize button
 *     icon
 * @sp {#ImageReference} maximizeRolloverIcon the maximize button rollover icon
 * @sp {#Extent} maximumHeight the maximum height of the window
 * @sp {#Extent} maximumWidth the maximum width of the window
 * @sp {Boolean} minimizeEnabled flag indicating whether maximize feature should
 *     be enabled
 * @sp {#ImageReference} minimizeIcon the minimize button icon
 * @sp {#Insets} minimizeIconInsets the inset margin around the minimize button
 *     icon
 * @sp {#ImageReference} minimizeRolloverIcon the minimize button rollover icon
 * @sp {#Extent} minimumHeight the minimum height of the window
 * @sp {#Extent} minimumWidth the minimum width of the window
 * @sp {Boolean} modal flag indicating whether the window is modal (and will thus
 *     block input to components not contained within it)
 * @sp {Boolean} movable flag indicating whether the window is movable
 * @sp {Number} openAnimationTime the duration of the open animation, in 
 *     milliseconds (default/zero value will result in no animation)
 * @sp {#Extent} positionX the horizontal (x) position of the window
 * @sp {#Extent} positionY the vertical (y) position of the window
 * @sp {Boolean} resizable flag indicating whether the window is resizable
 * @sp {Number} resourceTimeout the maximum amount of time to wait before displaying
 *     the window (in order for resources/images to be loaded such that it may
 *     initially appear in a fully rendered state)
 * @sp {String} title the title of the window
 * @sp {#Color} titleBackground the background color to display in the title bar
 * @sp {#FillImage} titleBackgroundImage the background image to display in the
 *     title bar
 * @sp {#Font} titleFont the font in which to display the title text
 * @sp {#Color} titleForeground the foreground color of the title text
 * @sp {#Extent} titleHeight the height of the title bar
 * @sp {#Insets} titleInsets the inset margin of the title text
 * @sp {#Extent} width the outside width of the window, including its border
 * @event close An event fired when the close button is pressed.
 * @event maximize An event fired when the maximize button is pressed.
 * @event minimize An event fired when the minimize button is pressed.
 */
Echo.WindowPane = Core.extend(Echo.Component, {

    $load: function() {
        Echo.ComponentFactory.registerType("WindowPane", this);
        Echo.ComponentFactory.registerType("WP", this);
    },

    $static: {
        
        /**
         * Default maximum time to wait for resources to load before displaying a new window (milliseconds).
         * @type Number
         */
        DEFAULT_RESOURCE_TIMEOUT: 300,
        
        /** 
         * Default WindowPane border.
         * @type #FillImageBorder
         */
        DEFAULT_BORDER: { color: "#36537a", borderInsets: 20, contentInsets: 3 },
        
        /** 
         * Default WindowPane content background color.
         * @type #Color
         */
        DEFAULT_BACKGROUND: "#ffffff",
        
        /** 
         * Default WindowPane content background color.
         * @type #Color
         */
        DEFAULT_FOREGROUND: "#000000",
        
        /** 
         * Default insets around WindowPane controls.
         * @type #Insets
         */
        DEFAULT_CONTROLS_INSETS: 4,
        
        /** 
         * Default spacing between WindowPane controls.
         * @type #Extent
         */
        DEFAULT_CONTROLS_SPACING: 4,
        
        /** 
         * Default WindowPane height.
         * @type #Extent
         */
        DEFAULT_HEIGHT: "15em",
        
        /** 
         * Default WindowPane minimum width.
         * @type #Extent
         */
        DEFAULT_MINIMUM_WIDTH: 100,
        
        /** 
         * Default WindowPane minimum height.
         * @type #Extent
         */
        DEFAULT_MINIMUM_HEIGHT: 100,
        
        /** 
         * Default WindowPane title background color.
         * @type #Color
         */
        DEFAULT_TITLE_BACKGROUND: "#becafe",
        
        /** 
         * Default WindowPane title height.
         * @type #Extent
         */
        DEFAULT_TITLE_HEIGHT: 30,
        
        /** 
         * Default WindowPane title insets.
         * @type #Insets
         */
        DEFAULT_TITLE_INSETS: "5px 10px",
        
        /** 
         * Default WindowPane width.
         * @type #Extent
         */
        DEFAULT_WIDTH: "30em"
    },

    /** @see Echo.Component#componentType */
    componentType: "WindowPane",
    
    /** @see Echo.Component#modalSupport */
    modalSupport: true,
    
    /**
     * Render as floating pane in ContentPanes. 
     * @see Echo.ContentPane 
     */
    floatingPane: true,

    /** @see Echo.Component#pane */
    pane: true,
    
    /** @see Echo.Component#focusable */
    focusable: true,
    
    /** 
     * Object specifying state of window pane before it was maximized,
     * May contain x, y, width, height integer properties or be null.
     */
    _preMaximizedState: null,
    
    /**
     * Processes a user request to close the window.
     */
    userClose: function() {
        this.fireEvent({type: "close", source: this});
    },
    
    /**
     * Processes a user request to maximize the window.
     */
    userMaximize: function() {
        if (this.render("width") == "100%" && this.render("height") == "100%") {
            if (this._preMaximizedState) {
                this.set("width", this._preMaximizedState.width);
                this.set("height", this._preMaximizedState.height);
                this.set("positionX", this._preMaximizedState.x);
                this.set("positionY", this._preMaximizedState.y);
            }
        } else {
            this._preMaximizedState = { 
                    x: this.get("positionX"), y: this.get("positionY"),
                    width: this.get("width"), height: this.get("height") };
            this.set("width", "100%");
            this.set("height", "100%");
        }
        this.fireEvent({type: "maximize", source: this});
    },
    
    /**
     * Processes a user request to minimize the window.
     */
    userMinimize: function() {
        this.fireEvent({type: "minimize", source: this});
    }
});
/**
 * @namespace
 * Module for rendering state of application to DOM.
 * <ul>
 *  <li>Provides capability to process updates in Application UpdateManager,
 *   rendering state changes to the DOM.</li>
 *  <li>Provides component synchronization peer base class.</li>
 *  <li>Provides root component synchronization peer implementation.</li>
 *  <li>Provides rendering utilities for the core properties.</li>
 * </ul>
 * 
 * <h3>renderContext</h3>
 * 
 * <p>This object will add a <code>renderContext</code> property to all <code>Echo.Update.ComponentUpdate</code>
 * objects which are processed by it.
 */

/**
 * Application rendering namespace.
 * @namespace
 */
Echo.Render = {

    /**
     * Count of loaded/unloaded peers.  Used for testing purposes to ensure peers are not being leaked.
     * @type Number
     */
    _loadedPeerCount: 0,

    /**
     * Next sequentially assigned unique peer identifier.
     * @type Number
     */
    _nextPeerId: 0,
    
    /**
     * Mapping between component type names and instantiable peer classes.
     */
    _peers: {},
    
    /**
     * Map containing removed components.  Maps component ids to removed components.
     * Created and destroyed during each render.
     */
    _disposedComponents: null,
    
    /**
     * An array sorting implementation to organize an array by component depth.
     * @see Array#sort
     */
    _componentDepthArraySort: function(a, b) {
        return Echo.Render._getComponentDepth(a.parent) - Echo.Render._getComponentDepth(b.parent);
    },
    
    /**
     * Recursively invokes renderDisplay() method on a sub-hierarchy of the
     * component hierarchy.  If a peer does not provide a renderDisplay() implementation,
     * it is skipped (although its descendants will NOT be skipped).
     * 
     * @param {Echo.Component} the root component of the sub-hierarchy on which renderDisplay() should be invoked
     * @param {Boolean} includeSelf flag indicating whether renderDisplay() should be invoked on the
     *        specified component (if false, it will only be invoked on child components)
     */
    _doRenderDisplay: function(component, includeSelf) {
        // Ensure component is visible.
        var i, testComponent = component;
        var testParent = testComponent.parent;
        while (testParent) {
            if (testParent.peer.isChildVisible && !testParent.peer.isChildVisible(testComponent)) {
                // Do nothing for components that are not visible. 
                return;
            }
            testComponent = testParent;
            testParent = testParent.parent;
        }
        
        if (includeSelf) {
            Echo.Render._doRenderDisplayImpl(component);
        } else {
            if (component.peer.isChildVisible) {
                for (i = 0; i < component.children.length; ++i) {
                    if (component.peer.isChildVisible(component.children[i])) {
                        Echo.Render._doRenderDisplayImpl(component.children[i]);
                    }
                }
            } else {
                for (i = 0; i < component.children.length; ++i) {
                    Echo.Render._doRenderDisplayImpl(component.children[i]);
                }
            }
        }
    },
    
    /**
     * Recursive work method for _doRenderDisplay().  
     * 
     * @param {Echo.Component} component the component on which to invoke renderDisplay()
     */
    _doRenderDisplayImpl: function(component) {
        if (!component.peer) {
            // Do nothing for components that are not rendered. 
            return;
        }
        
        if (component.peer.renderDisplay) {
            component.peer.renderDisplay();
        }
        component.peer.displayed = true;
        
        var i;
        if (component.peer.isChildVisible) {
            for (i = 0; i < component.children.length; ++i) {
                if (component.peer.isChildVisible(component.children[i])) {
                    Echo.Render._doRenderDisplayImpl(component.children[i]);
                }
            }
        } else {
            for (i = 0; i < component.children.length; ++i) {
                Echo.Render._doRenderDisplayImpl(component.children[i]);
            }
        }
    },
    
    /**
     * Returns the depth of a specific component in the hierarchy.
     * The root component is at depth 0, its immediate children are
     * at depth 1, their children are at depth 2, and so on.
     *
     * @param {Echo.Component} component the component whose depth is to be calculated
     * @return the depth of the component
     * @type Number
     */
    _getComponentDepth: function(component) {
        var depth = -1;
        while (component != null) {
            component = component.parent;
            ++depth;
        }
        return depth;
    },
    
    /**
     * Creates a component synchronization peer for a component.
     * The peer will be stored in the "peer" property of the component.
     * The client will be stored in the "client" property of the component.
     * 
     * @param {Echo.Client} client the relevant Client
     * @param {Echo.Component} component the component
     */
    _loadPeer: function(client, component) {
        if (component.peer) {
            // If peer already loaded, do nothing.
            return;
        }
        
        var peerClass = Echo.Render._peers[component.componentType];
        
        if (!peerClass) {
            throw new Error("Peer not found for: " + component.componentType);
        }
        
        ++this._loadedPeerCount;        
        component.peer = new peerClass();
        component.peer._peerId = this._nextPeerId++;
        component.peer.component = component;
        component.peer.client = client;
    },
    
    /**
     * Notifies child components that the parent component has been drawn
     * or resized.  At this point the parent component is on the screen
     * (the parent element is part of the DOM hierarchy).
     * Child components (and their descendants) will be notified by having 
     * their renderDisplay() implementations invoked.
     * Note that the parent WILL NOT have its renderDisplay() method
     * invoked.
     * <p>
     * If your component requires virtual positioning (for IE6) you should invoke
     * this method after informing the virtual positioning system to recalculate
     * the size of your component.
     * 
     * @param {Echo.Component} parent the component whose size changed
     */
    notifyResize: function(parent) {
        Echo.Render._doRenderDisplay(parent, false);
    },
    
    /**
     * Invokes renderDispose() on all removed children and descendants found in the specified update.
     * 
     * @param {Echo.Update.ComponentUpdate} update the update
     */
    _processDispose: function(update) {
        var i, components = update.getRemovedDescendants();
        if (components) {
            for (i = 0; i < components.length; ++i) {
                Echo.Render._renderComponentDisposeImpl(update, components[i]);
            }
        }
        components = update.getRemovedChildren();
        if (components) {
            for (i = 0; i < components.length; ++i) {
                Echo.Render._renderComponentDisposeImpl(update, components[i]);
            }
        }
    },
    
    /**
     * Processes all pending updates in the client's application's update manager.
     * 
     * @param {Echo.Client} client the client
     */
    processUpdates: function(client) {
        var updateManager = client.application.updateManager;
        
        // Do nothing if no updates exist.
        if (!updateManager.hasUpdates()) {
            return;
        }
        
        // Create map to contain removed components (for peer unloading).
        Echo.Render._disposedComponents = {};
        
        // Retrieve updates, sorting by depth in hierarchy.  This will ensure that higher
        // level updates have a chance to execute first, in case they null out lower-level
        // updates if they require re-rendering their descendants.
        var updates = updateManager.getUpdates();
        updates.sort(Echo.Render._componentDepthArraySort);
        
        var peer, i, j;
    
        // Load peers for any new root components being updated.
        for (i = 0; i < updates.length; ++i) {
            updates[i].renderContext = {};
        
            peer = updates[i].parent.peer;
            if (peer == null && updates[i].parent.componentType == "Root") {
                Echo.Render._loadPeer(client, updates[i].parent);
            }
        }
    
        // Remove Phase: Invoke renderDispose on all updates.
        for (i = updates.length - 1; i >= 0; --i) {
            if (updates[i] == null) {
                // Skip removed updates.
                continue;
            }
            peer = updates[i].parent.peer;
            Echo.Render._processDispose(updates[i]);
        }
        
        // Profiling: Mark completion of remove phase. 
        if (Echo.Client.profilingTimer) {
            Echo.Client.profilingTimer.mark("rem");
        }
        
        // Update Phase: Invoke renderUpdate on all updates.
        for (i = 0; i < updates.length; ++i) {
            if (updates[i] == null) {
                // The update has been removed, skip it.
                continue;
            }
            
            // Obtain component synchronization peer.
            peer = updates[i].parent.peer;
            
            // Perform update by invoking peer's renderUpdate() method.
            var fullRender = peer.renderUpdate(updates[i]);
            
            // If the update required re-rendering descendants of the updated component,
            // null-out any pending updates to descendant components.
            if (fullRender) {
                for (j = i + 1; j < updates.length; ++j) {
                    if (updates[j] != null && updates[i].parent.isAncestorOf(updates[j].parent)) {
                        updates[j] = null;
                    }
                }
            }

            // Invoke _setPeerDisposedState() to ensure that peer is marked as non-disposed.
            // (A full-re-render may have invoked renderComponentDispose()).
            Echo.Render._setPeerDisposedState(updates[i].parent, false);
        }
        
        // Profiling: Mark completion of update phase.
        if (Echo.Client.profilingTimer) {
            Echo.Client.profilingTimer.mark("up");
        }
        
        // Display Phase: Invoke renderDisplay on all updates.
        // The "displayed" array holds component who have already had renderDisplay() invoked on themselves (and their descendants).
        // This is done to avoid invoking renderDisplay() multiple times on a single component during a single rendering.
        var displayed = [];
        for (i = 0; i < updates.length; ++i) {
            if (updates[i] == null) {
                // Skip removed updates.
                continue;
            }
            
            // Determine if component hierarchy has already had renderDisplay() invoked, skipping to next update if necessary.
            var cancelDisplay = false;
            for (j = 0; j < displayed.length; ++j) {
                if (displayed[j].isAncestorOf(updates[i].parent)) {
                    cancelDisplay = true;
                    break;
                }
            }
            if (cancelDisplay) {
                continue;
            }
            
            if (updates[i].renderContext.displayRequired) {
                // The renderContext has specified only certain child components should have their
                // renderDisplay() methods invoked.
                for (j = 0; j < updates[i].renderContext.displayRequired.length; ++j) {
                    displayed.push(updates[i].renderContext.displayRequired[j]);
                    Echo.Render._doRenderDisplay(updates[i].renderContext.displayRequired[j], true);
                }
            } else {
                displayed.push(updates[i].parent);
                Echo.Render._doRenderDisplay(updates[i].parent, true);
            }
        }
    
        // Profiling: Mark completion of display phase.
        if (Echo.Client.profilingTimer) {
            Echo.Client.profilingTimer.mark("disp");
        }
    
        // Unload peers for truly removed components, destroy mapping.
        for (var peerId in Echo.Render._disposedComponents) {
            var component = Echo.Render._disposedComponents[peerId];
            Echo.Render._unloadPeer(component);
        }

        // Clear disposed component list.
        Echo.Render._disposedComponents = null;
        
        // Inform UpdateManager that all updates have been completed.
        updateManager.purge();
        
        // Perform focus update.
        Echo.Render.updateFocus(client);
    },
    
    /**
     * Registers a component type name with an instantiable peer class.
     * Components of the specified type name will be assigned new instances of the peer class
     * when rendered for the first time.
     * 
     * @param {String} componentName the component type name
     * @param {Function} peerObject the peer class object
     */
    registerPeer: function(componentName, peerObject) {
        if (this._peers[componentName]) {
            throw new Error("Peer already registered: " + componentName);
        }
        this._peers[componentName] = peerObject;
    },
    
    /**
     * Renders a new component inside of a DOM element.
     * This method should be called by container components in order to render their children.
     * 
     * @param {Echo.Update.ComponentUpdate} update the relevant ComponentUpdate
     * @param {Echo.Component} component the component to add
     * @param {Element} parentElement the DOM element to which the rendered component should be added
     */
    renderComponentAdd: function(update, component, parentElement) {
        if (!component.parent || !component.parent.peer || !component.parent.peer.client) {
            throw new Error("Cannot find reference to the Client with which this component should be associated: " +
                    "cannot load peer.  This is due to the component's parent's peer not being associated with a Client. " +
                    "Component = " + component + ", Parent = " + component.parent + ", Parent Peer = " + 
                    (component.parent ? component.parent.peer : "N/A") + ", Parent Peer Client = " + 
                    ((component.parent && component.parent.peer) ? component.parent.peer.client : "N/A"));
        }
    
        Echo.Render._loadPeer(component.parent.peer.client, component);
        Echo.Render._setPeerDisposedState(component, false);
        component.peer.renderAdd(update, parentElement);
    },
    
    /**
     * Manually invokes renderDisplay on a component (and its descendants) that was added to the
     * hierarchy outside of processUpdates().  This method is only used in special cases,
     * e.g., by in the case of Application Rendered Components that need to render children.
     * 
     * @param {Echo.Component} parent the parent component of the sub-hierarchy on which renderDisplay() should
     *        be invoked (note that renderDisplay WILL be invoked on the parent as well 
     *        as its descendants)
     */
    renderComponentDisplay: function(parent) {
        this._doRenderDisplay(parent, true);
    },
    
    /**
     * Disposes of a component and its descendants.
     * This method should be invoked by any peer that will be updating a component in such
     * a fashion that it will be destroying the rendering of its children and re-rendering them.
     * It is not necessary to invoke this method on components that may not contain children.
     *
     * @param {Echo.Update.ComponentUpdate} update the <code>ComponentUpdate</code> for which this change is being performed
     * @param {Echo.Component} component the <code>Component</code> to be disposed
     */
    renderComponentDispose: function(update, component) {
        this._renderComponentDisposeImpl(update, component);
    },
    
    /**
     * Recursive implementation of renderComponentDispose.  Invokes
     * renderDispose() on all child peers, sets disposed state on each.
     * 
     * @param {Echo.Update.ComponentUpdate} update the <code>ComponentUpdate</code> for which this change is being performed
     * @param {Echo.Component} component the <code>Component</code> to be disposed
     */
    _renderComponentDisposeImpl: function(update, component) {
        if (!component.peer || component.peer.disposed) {
            return;
        }
        Echo.Render._setPeerDisposedState(component, true);
    
        component.peer.renderDispose(update);
        for (var i = 0; i < component.children.length; ++i) {
            Echo.Render._renderComponentDisposeImpl(update, component.children[i]);
        }
    },
    
    /**
     * Notifies a child component and its descendants that it is about to be removed from the DOM or otherwise hidden from view.
     * The <code>renderHide()</code> methods of the peers of the specified child component and its descendants will be invoked.
     * <strong>It is absolutely critical that this method be invoked before the component's rendered state is removed from the DOM 
     * hierarchy.</strong>
     * 
     * @param {Echo.Component} component the child component being hidden
     */
    renderComponentHide: function(component) {
        if (!component.peer || component.peer.disposed) {
            return;
        }
        
        if (component.peer.displayed) {
            if (component.peer.renderHide) {
                component.peer.renderHide();
            }
            component.peer.displayed = false;
            for (var i = 0; i < component.children.length; ++i) {
                Echo.Render.renderComponentHide(component.children[i]);
            }
        }
    },
    
    /**
     * Sets the peer disposed state of a component.
     * The peer disposed state indicates whether the renderDispose()
     * method of the component has been executed since it was last rendered.
     * 
     * @param {Echo.Component} component the component
     * @param {Boolean} disposed the disposed state, true indicating the component has
     *        been disposed
     */
    _setPeerDisposedState: function(component, disposed) {
        if (disposed) {
            component.peer.disposed = true;
            Echo.Render._disposedComponents[component.peer._peerId] = component;
        } else {
            component.peer.disposed = false;
            delete Echo.Render._disposedComponents[component.peer._peerId];
        }
    },
    
    /**
     * Destroys a component synchronization peer for a specific components.
     * The peer will be removed from the "peer" property of the component.
     * The client will be removed from the "client" property of the component.
     * The peer to component association will be removed.
     * 
     * @param {Echo.Component} component the component
     */
    _unloadPeer: function(component) {
        component.peer.client = null;
        component.peer.component = null;
        component.peer = null;
        --this._loadedPeerCount;        
    },

    /**
     * Focuses the currently focused component of the application.  
     *
     * This method may be necessary to invoke manually by component renderers
     * that use animation and may be hiding the focused component (such that
     * the client browser will not focus it) when processUpdates() completes.
     * 
     * @param {Echo.Client} client the client 
     */
    updateFocus: function(client) {
        var focusedComponent = client.application.getFocusedComponent();
        if (focusedComponent && focusedComponent.peer) {
            if (!focusedComponent.peer.renderFocus) {
                throw new Error("Cannot focus component: " + focusedComponent + 
                        ", peer does not provide renderFocus() implementation."); 
            }
            focusedComponent.peer.renderFocus();
        } else {
            // Cancel any runnable created by Core.Web.DOM.focusElement if no focused component specified.
            Core.Web.DOM.focusElement(null);
        }
    }
};

/**
 * Component synchronization peer. 
 * @class
 */
Echo.Render.ComponentSync = Core.extend({ 

    $static: {
    
        /**
         * Focus flag indicating up arrow keypress events should be handled by focus manager when
         * the component is focused.
         * @type Number
         */
        FOCUS_PERMIT_ARROW_UP: 0x1,

        /**
         * Focus flag indicating down arrow keypress events should be handled by focus manager when
         * the component is focused.
         * @type Number
         */
        FOCUS_PERMIT_ARROW_DOWN: 0x2, 

        /**
         * Focus flag indicating left arrow keypress events should be handled by focus manager when
         * the component is focused.
         * @type Number
         */
        FOCUS_PERMIT_ARROW_LEFT: 0x4,
        
        /**
         * Focus flag indicating right arrow keypress events should be handled by focus manager when
         * the component is focused.
         * @type Number
         */
        FOCUS_PERMIT_ARROW_RIGHT: 0x8, 

        /**
         * Focus flag indicating all arrow keypress events should be handled by focus manager when
         * the component is focused.
         * @type Number
         */
        FOCUS_PERMIT_ARROW_ALL: 0xf,
        
        /**
         * Dimension value for <code>getPreferredSize()</code> indicating height should be calculated.
         * @type Number
         */
        SIZE_HEIGHT: 0x1,
        
        /**
         * Dimension value for <code>getPreferredSize()</code> indicating width should be calculated.
         * @type Number
         */
        SIZE_WIDTH: 0x2
    },
    
    /**
     * Unique peer identifier, for internal use only.
     * Using component renderId is inadequate, as two unique component instances may have same id across
     * add-remove-add operations.
     * @type Number
     */
    _peerId: null,

    /**
     * The client supported by this peer.
     * @type Echo.Client
     */
    client: null,

    /**
     * The component instance supported by this peer.  
     * Each peer instance will support a single component instance.
     * @type Echo.Component
     */
    component: null,
    
    /**
     * Flag indicating whether component is displayed or hidden.  Initially false until <code>renderDisplay()</code> has been
     * invoked, then will be set to true.  Will again be set false after invocation of <code>renderHide()</code>.
     */
    displayed: false,
    
    /**
     * Flag indicating that the component has been disposed, i.e., the peer's <code>renderDispose()</code> method 
     * has run since the last time <code>renderAdd()</code> was last invoked.
     * @type Boolean
     */
    disposed: false,

    /**
     * Creates a new component synchronization peer.
     */
    $construct: function() { },
    
    $abstract: {

        /**
         * Renders the component to the DOM.
         * The supplied update will refer to a ancestor component of the supported component
         * being updated.
         *
         * @param {Echo.Update.ComponentUpdate} update the update being rendered
         * @param {Element} parentElement the parent DOM element to which the component should be rendered.
         */
        renderAdd: function(update, parentElement) { },

        /**
         * Invoked when the rendered component is about to be removed from the DOM.
         * This method should dispose of any client resources in use by the component, e.g.,
         * unregistering event listeners and removing any DOM elements that are not children of
         * the parent component's DOM element.
         * The DOM should NOT be modified to remove the element(s) representing this component
         * for performance as well as aesthetic reasons (e.g., in the case where a parent component
         * might be using an animated transition effect to remove the component.
         * The supplied update will refer to a ancestor component of the supported component
         * being updated.
         *
         * A component may be re-added to the screen after being disposed, e.g., in the case
         * where a parent component does not possess a 'partial update' capability and removes
         * a child component hierarchy and then re-renders it.  A synchronization peer should
         * allow for the fact that its renderAdd() method may be invoked at some point in time
         * after renderDispose() has been invoked.
         *        
         * @param {Echo.Update.ComponentUpdate} update the update being rendered
         */
        renderDispose: function(update) { },
        
        /**
         * Renders an update to a component, e.g., children added/removed, properties updated.
         * The supplied update will refer specifically to an update of the supported component.
         * 
         * The provided update will contain a <code>renderContext</code> object property.
         * The following properties of <code>renderContext</code> may be configured by the
         * implementation, if desired:
         *  
         * <ul>
         *  <li><code>displayRequired</code>: an array of child component objects whose synchronization peers should have their
         *  renderDisplay() methods invoked once the update cycle is complete.  The default value of null indicates the peers
         *  of all descendant components and the updated component itself will have their renderDisplay() methods invoked.
         *  Specifying an empty array will cause NO components to have their renderDisplay() methods invoked.
         *  This property is generally used on container components (or application-rendered components) which may have property
         *  updates that need not cause renderDisplay() to be invoked on their entire descendant tree for performance reasons.
         * </ul> 
         *
         * @param {Echo.Update.ComponentUpdate} update the update being rendered
         * @return true if this invocation has re-rendered all child components, false otherwise
         * @type Boolean
         */
        renderUpdate: function(update) { }
    },
    
    $virtual: {
    
        /**
         * (Optional) Processes a key down event received by the client's key listeners.  
         * Invoked by client based on current focused component of application.
         * 
         * @function
         * @param e the key event, containing (processed) keyCode property
         * @return true if higher-level containers should be allowed to process the key event as well
         * @type Boolean
         */
        clientKeyDown: null,

        /**
         * (Optional) Processes a key press event received by the client's key listeners.  
         * Invoked by client based on current focused component of application.
         * 
         * @function
         * @param e the key event, containing (processed) charCode and keyCode properties
         * @return true if higher-level containers should be allowed to process the key event as well
         * @type Boolean
         */
        clientKeyPress: null,
        
        /**
         * (Optional) Processes a key up event received by the client's key listeners.  
         * Invoked by client based on current focused component of application.
         * 
         * @function
         * @param e the key event, containing (processed) charCode and keyCode properties
         * @return true if higher-level containers should be allowed to process the key event as well
         * @type Boolean
         */
        clientKeyUp: null,
        
        /**
         * Returns the focus flags for the component, one or more of the following values, ORed together.
         * <ul>
         *  <li><code>FOCUS_PERMIT_ARROW_UP</code>: indicates that the container may change focus from the current component if
         *   the up arrow key is pressed.</li>
         *  <li><code>FOCUS_PERMIT_ARROW_DOWN</code>: indicates that the container may change focus from the current component if
         *   the down arrow key is pressed.</li>
         *  <li><code>FOCUS_PERMIT_ARROW_LEFT</code>: indicates that the container may change focus from the current component if
         *   the left arrow key is pressed.</li>
         *  <li><code>FOCUS_PERMIT_ARROW_RIGHT</code>: indicates that the container may change focus from the current component if
         *   the right arrow key is pressed.</li>
         *  <li><code>FOCUS_PERMIT_ARROW_ALL</code>: indicates that the container may change focus from the current component if
         *   any arrow key is pressed (this is a shorthand for up, left, down, and right ORed together).</li>
         * </ul>
         * 
         * @function
         * @return the focus flags
         * @type Number
         */
        getFocusFlags: null,
        
        /**
         * (Optional) Returns the preferred rendered size of the component in pixels.  Certain parent
         * components may query this method during <code>renderDisplay()</code> to determine
         * the space provided to the child component.  If implemented, this method should return
         * an object containing height and/or width properties specifying integer pixel values.
         * 
         * @function
         * @param dimension the dimension to be calculated, one of the following values, or null
         *        to specify that all dimensions should be calculated:
         *        <ul>
         *         <li><code>SIZE_WIDTH</code></li>
         *         <li><code>SIZE_HEIGHT</code></li>
         *        </ul>
         * @return the preferred rendered size of the component
         */
        getPreferredSize: null,
        
        /**
         * (Optional) Determines if the specified child component is currently displayed.  Implementations
         * should return true if the specified child component is on-screen and should have its <code>renderDisplay()</code>
         * method invoked when required, or false if the component is off-screen.
         * 
         * @function
         * @param component the child component
         * @return true if the component should have its renderDisplay() method invoked
         * @type Boolean
         */
        isChildVisible: null,
        
        /**
         * (Optional) Invoked when component is rendered focused.
         * 
         * @function
         */
        renderFocus: null,
        
        /**
         * (Optional) Invoked when a parent/ancestor component is hiding the content of this component, possibly removing it from
         * the DOM.  An parent/ancestor DOM element will automatically be removed/hidden, but the component may need to take action 
         * to remove any rendered items not contained within that element.
         * The renderDisplay() method will be invoked the when/if the component is displayed again.
         * This method may be invoked on components which are already in a hidden state.
         * This method will not necessarily be invoked prior to disposal.
         * 
         * @function
         */
        renderHide: null,
        
        /**
         * (Optional) Invoked when the component has been added (or-readded) to the hierarchy and first appears
         * on screen, and when ancestors of the component (or the containing window) have
         * resized.
         * 
         * @function
         */
        renderDisplay: null
    }
});

/**
 * Root component synchronization peer.
 * The root component is not managed by the server, but rather is an existing
 * element within which the Echo application is rendered.
 * This is a very special case in that there is no renderAdd() method.
 */
Echo.Render.RootSync = Core.extend(Echo.Render.ComponentSync, { 

    $load: function() {
        Echo.Render.registerPeer("Root", this);
    },
    
    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        throw new Error("Unsupported operation: renderAdd().");
    },
    
    /**
     * Removes all content from root container and adds current content.
     * 
     * @param {Echo.Update.ComponentUpdate} update the causing update 
     */
    _renderContent: function(update) {
        Echo.Render.renderComponentDispose(update, update.parent);
        Core.Web.DOM.removeAllChildren(this.client.domainElement);
        for (var i = 0; i < update.parent.children.length; ++i) {
            Echo.Render.renderComponentAdd(update, update.parent.children[i], this.client.domainElement);
        }
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) { },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        var property, fullRender = false;

        if (update.fullRefresh || update.hasAddedChildren() || update.hasRemovedChildren()) {
            Echo.Sync.renderComponentDefaults(this.component, this.client.domainElement);
            var title = this.component.render("title");
            if (title) {
                document.title = title;
            }
            this._renderContent(update);
            fullRender = true;
        } else {
            this.client.domainElement.dir = this.client.application.getLayoutDirection().isLeftToRight() ? "ltr" : "rtl";
            if (update.hasUpdatedProperties()) {
                property = update.getUpdatedProperty("title");
                if (property) {
                    document.title = property.newValue;
                }
                property = update.getUpdatedProperty("background");
                if (property) {
                    Echo.Sync.Color.renderClear(property.newValue, this.client.domainElement, "backgroundColor");
                }
                property = update.getUpdatedProperty("foreground");
                if (property) {
                    Echo.Sync.Color.renderClear(property.newValue, this.client.domainElement, "foreground");
                }
                property = update.getUpdatedProperty("font");
                if (property) {
                    Echo.Sync.Font.renderClear(property.newValue, this.client.domainElement);
                }
                Echo.Sync.LayoutDirection.render(this.component.getLayoutDirection(), this.client.domainElement);
            }
        }
        
        return fullRender;
    }
});
/**
 * @fileoverview
 * <ul> 
 *  <li>Provides property rendering utilities for core properties.</li>
 *  <li>Provides TriCellTable rendering utility (used by buttons and labels).</li>
 *  <li>Provides a floating pane z-index management system.</li> 
 * </ul>
 */

/**
 * @namespace
 */
Echo.Sync = { 

    /**
     * Retrieves an "effect-specific" property from a component (e.g., a rollover background) if it
     * is available, or otherwise returns the default (non-effect) property value.
     * 
     * @param {Echo.Component} component the component to query
     * @param {String} defaultPropertyName the name of the default (non-effect) property, e.g., "background"
     * @param {String} effectPropertyName the name of the effect property, e.g., "rolloverBackground"
     * @param {Boolean} effectState flag indicating whether the effect is enabled (if the effect is not enabled,
     *        the default (non-effect) value will always be returned)
     * @param defaultDefaultPropertyValue (optional) the default (non-effect) property value (this value will be returned
     *        if no other value can be determined for the property)
     * @param defaultEffectPropertyValue (optional) the default effect property value (this value will be returned if the
     *        effectState is true and no value has been specifically set for the effect property) 
     */
    getEffectProperty: function(component, defaultPropertyName, effectPropertyName, effectState,
            defaultDefaultPropertyValue, effectDefaultPropertyValue) {
        var property;
        if (effectState) {
            property = component.render(effectPropertyName, effectDefaultPropertyValue);
        }
        if (!property) {
            property = component.render(defaultPropertyName, defaultDefaultPropertyValue);
        }
        return property;
    },
    
    /**
     * Renders component foreground, background, font, and layout direction properties
     * (if each is provided) to the specified element.  This is a performance/convenience method
     * which combines capabilities found in Echo.Sync.Color/Font/LayoutDirection.
     * 
     * @param {Echo.Component} component the component
     * @param {Element} element the target element
     */
    renderComponentDefaults: function(component, element) {
        var color;
        if ((color = component.render("foreground"))) {
            color = Echo.Sync.Color.toTransparent(color);
            element.style.color = color;
        }
        if ((color = component.render("background"))) {
            color = Echo.Sync.Color.toTransparent(color);
            element.style.backgroundColor = color;
        }
        var font = component.render("font");
        if (font) {
            Echo.Sync.Font.render(font, element);
        }
        if (component.getLayoutDirection()) {
            element.dir = component.getLayoutDirection().isLeftToRight() ? "ltr" : "rtl";
        }
    }
};

/**
 * Provides tools for rendering alignment properties.
 * @class
 */
Echo.Sync.Alignment = {

    _HORIZONTALS: { left: true, center: true, right: true, leading: true, trailing: true },
    _VERTICALS: { top: true, middle: true, bottom: true },

    /**
     * Returns the render-able horizontal component of an alignment property.  This method
     * translates leading/trailing horizontal values to left/right based on the specified layout
     * direction provider.  If a provider is no given, leading defaults to left and trailing to
     * right.
     * 
     * @param {#Alignment} alignment the alignment
     * @return the rendered horizontal component, i.e., "left", "center", "right", or null
     * @type String
     */
    getRenderedHorizontal: function(alignment, layoutDirectionProvider) {
        if (alignment == null) {
            return null;
        }
    
        var layoutDirection = layoutDirectionProvider ? 
                layoutDirectionProvider.getRenderLayoutDirection() : Echo.LayoutDirection.LTR;
         
        var horizontal = typeof(alignment) == "object" ? alignment.horizontal : alignment; 
                
        switch (horizontal) {
        case "leading":
            return layoutDirection.isLeftToRight() ? "left" : "right";
        case "trailing":
            return layoutDirection.isLeftToRight() ? "right" : "left";
        default:
            return horizontal in this._HORIZONTALS ? horizontal : null;
        }
    },
    
    /**
     * Returns the horizontal component of an alignment property.
     * 
     * @param {#Alignment} the alignment
     * @return the horizontal component, i.e., "left", "center", "right", "leading", "trailing", or null
     * @type String
     */
    getHorizontal: function(alignment) {
        if (alignment == null) {
            return null;
        }
        if (typeof(alignment == "string")) {
            return alignment in this._HORIZONTALS ? alignment : null;
        } else {
            return alignment.horizontal;
        }
    },

    /**
     * Returns the vertical component of an alignment property.
     * 
     * @param {#Alignment} the alignment
     * @return the vertical component, i.e., "top", "middle", "bottom", or null 
     * @type String
     */
    getVertical: function(alignment) {
        if (alignment == null) {
            return null;
        }
        if (typeof(alignment == "string")) {
            return alignment in this._VERTICALS ? alignment : null;
        } else {
            return alignment.vertical;
        }
    },

    /**
     * Renders an alignment property to an element.
     * 
     * @param {#Alignment} alignment the alignment
     * @param {Element} the target element
     * @param {Boolean} renderToElement flag indicating whether the alignment state should be rendered to the element using
     *        attributes (true) or CSS (false)
     * @param layoutDirectionProvider an (optional) object providing a getRenderLayoutDirection() method to determine if the
     *        element has a layout direction of left-to-right or right-to-left
     */
    render: function(alignment, element, renderToElement, layoutDirectionProvider) {
        if (alignment == null) {
            return;
        }
        
        var horizontal = Echo.Sync.Alignment.getRenderedHorizontal(alignment, layoutDirectionProvider);
        var vertical = typeof(alignment) == "object" ? alignment.vertical : alignment;
    
        var horizontalValue;
        switch (horizontal) {
        case "left":   horizontalValue = "left";   break;
        case "center": horizontalValue = "center"; break;
        case "right":  horizontalValue = "right";  break;
        default:       horizontalValue = "";       break;
        }
        var verticalValue;
        switch (vertical) {
        case "top":    verticalValue = "top";      break;
        case "middle": verticalValue = "middle";   break;
        case "bottom": verticalValue = "bottom";   break;
        default:       verticalValue = "";         break;
        }
        
        if (renderToElement) {
            element.align = horizontalValue;
            element.vAlign = verticalValue;
        } else {
            element.style.textAlign = horizontalValue;
            element.style.verticalAlign = verticalValue;
        }
    }
};

/**
 * Provides tools for rendering border properties.
 * @class
 */
Echo.Sync.Border = {

    /**
     * Regular expression to validate/parse a CSS border expression, e.g., "1px solid #abcdef".
     * Supports omission of any term, or empty strings.
     * @type RegExp
     */
    _PARSER_PX: new RegExp("^(-?\\d+px)?(?:^|$|(?= )) ?(none|hidden|dotted|dashed|solid|" + 
            "double|groove|ridge|inset|outset)?(?:^|$|(?= )) ?(#[0-9a-fA-F]{6})?$"),

    /**
     * Regular expression to validate/parse a pixel-based CSS border expression, e.g., "1px solid #abcdef".
     * Supports omission of any term, or empty strings.
     * @type RegExp
     */
    _PARSER: new RegExp("^(-?\\d+(?:\\.\\d*)?(?:px|pt|pc|cm|mm|in|em|ex))?(?:^|$|(?= )) ?(none|hidden|dotted|dashed|solid|" +
            "double|groove|ridge|inset|outset)?(?:^|$|(?= )) ?(#[0-9a-fA-F]{6})?$"),
            
    /** 
     * Regular expression to test whether an extent string is a properly formatted integer pixel value.
     * @type RegExp 
     */
    _TEST_EXTENT_PX: /^-?\d+px$/,
    
    /**
     * Creates a border property from a size, style, and color.
     * 
     * @param {#Extent} size the border size
     * @param {String} the border style
     * @param {#Color} the border color
     * @return a border object
     * @type #Border
     */
    compose: function(size, style, color) {
        if (typeof size == "number") {
            size += "px";
        }
        var out = [];
        if (size) {
            out.push(size);
        }
        if (style) {
            out.push(style);
        }
        if (color) {
            out.push(color);
        }
        return out.join(" ");
    },
    
    /** 
     * Determines if a border is multisided.
     * 
     * @param {#Border} border the border to analyze
     * @return true if the border is multisided
     * @type Boolean
     */
    isMultisided: function(border) {
        return (border && (border.top || border.bottom || border.left || border.right)) ? true : false;
    },
    
    /**
     * Parses a border into size, style, and color components.
     * 
     * @param {#Border} border the border to parse
     * @return an object containing size, style, and color properties of the border
     */
    parse: function(border) {
        if (!border) {
            // Return an empty object if border evaluates false.
            return { };
        }
        if (typeof(border) == "string") {
            // Parse the border.
            var parts = this._PARSER.exec(border);
            return { size: parts[1], style: parts[2], color: parts[3] };
        } else {
            // Parse an individual border side.
            return Echo.Sync.Border.parse(border.top || border.right || border.bottom || border.left);
        }
    },

    /**
     * Renders a border to a DOM element.
     * 
     * @param {#Border} border the border to render
     * @param {Element} the target DOM element
     * @param {String} styleAttribute the CSS style attribute name (defaults to "border" if omitted)
     */
    render: function(border, element, styleAttribute) {
        if (!border) {
            return;
        }
        styleAttribute = styleAttribute ? styleAttribute : "border";
        if (typeof(border) == "string") {
            if (this._PARSER_PX.test(border)) {
                element.style[styleAttribute] = border;
            } else {
                var elements = this._PARSER.exec(border);
                if (elements == null) {
                    throw new Error("Invalid border: \"" + border + "\"");
                }
                this.render(Echo.Sync.Extent.toPixels(elements[1]) + "px " + elements[2] + " " + elements[3], 
                        element, styleAttribute);
            }
        } else {
            this.render(border.top, element, styleAttribute + "Top");
            if (border.right !== null) {
                this.render(border.right || border.top, element, styleAttribute + "Right");
            }
            if (border.bottom !== null) {
                this.render(border.bottom || border.top, element, styleAttribute + "Bottom");
            }
            if (border.left !== null) {
                this.render(border.left || border.right || border.top, element, styleAttribute + "Left");
            }
            
        }
    },
    
    /**
     * Renders a border to a DOM element, clearing an existing border if the border value is null.
     * 
     * @param {#Border} border the border to render
     * @param {Element} the target DOM element
     * @param {String} styleAttribute the CSS style attribute name (defaults to "border" if omitted)
     */
    renderClear: function(border, element) {
        if (border) {
            if (border instanceof Object) {
                element.style.border = "";
            }
            this.render(border, element);
        } else {
            element.style.border = "";
        }
    },

    /**
     * Determines the size of a particular side of the border in pixels.
     * 
     * @param {#Border} border the border
     * @param {String} sideName, the border side name, "left", "right", "bottom", or "top" (defaults to "top" if omitted)
     * @return the border size in pixels
     * @type Number
     */
    getPixelSize: function(border, sideName) {
        if (!border) {
            return 0;
        }
        
        if (typeof(border) == "string") {
            var extent = this._PARSER.exec(border)[1];
            if (extent == null) {
                return 0;
            } else if (this._TEST_EXTENT_PX.test(extent)) {
                return parseInt(extent, 10);
            } else {
                return Echo.Sync.Extent.toPixels(extent);
            }
        } else if (typeof(border) == "object") {
            // Retrieve value for individual side.
            // Specified side is queried first, followed by alternatives.
            while (true) {
                var side = this.getPixelSize(border[sideName]);
                if (side == null) {
                    switch (sideName) {
                    case "left": 
                        // If left side specified but value null, try again with right.
                        sideName = "right"; 
                        continue;
                    case "right":
                    case "bottom": 
                        // If bottom or right side specified, try again with top.
                        sideName = "top";
                        continue; 
                    }
                }
                return side;
            }
        }
    }
};

/**
 * Provides tools for rendering color properties.
 * @class
 */
Echo.Sync.Color = {

    /**
     * Adjusts the value of the color's RGB values by the
     * specified amounts, returning a new Color.
     * The original color is unchanged.
     * 
     * @param color the color to adjust (a 24 bit hex value, e.g., #1a2b3c)
     * @param r the amount to adjust the red value of the color (-255 to 255)
     * @param g the amount to adjust the green value of the color (-255 to 255)
     * @param b the amount to adjust the blue value of the color (-255 to 255)
     * @return the adjusted color (a 24 bit hex value)
     */
    adjust: function(value, r, g, b) {
        var colorInt = parseInt(value.substring(1), 16);
        var red = Math.floor(colorInt / 0x10000) + r;
        var green = Math.floor(colorInt / 0x100) % 0x100 + g;
        var blue = colorInt % 0x100 + b;
        return this.toHex(red, green, blue);
    },
    
    /**
     * Blends two colors together.
     * 
     * @param {#Color} value1 the first color
     * @param {#Color} value2 the second color
     * @param {Number} ratio the blend ratio, where 0 represents the first color, 1 the second color, and 0.5 an equal blend
     *        between the first and second colors
     * @return the blended color
     * @type #Color
     */
    blend: function(value1, value2, ratio) {
        ratio = ratio < 0 ? 0 : (ratio > 1 ? 1 : ratio);
        var colorInt1 = parseInt(value1.substring(1), 16);
        var colorInt2 = parseInt(value2.substring(1), 16);
        var red = Math.round(Math.floor(colorInt1 / 0x10000) * (1 - ratio) + Math.floor(colorInt2 / 0x10000) * ratio);
        var green = Math.round(Math.floor(colorInt1 / 0x100) % 0x100 * (1 - ratio) + 
                Math.floor(colorInt2 / 0x100) % 0x100 * ratio);
        var blue = Math.round((colorInt1 % 0x100) * (1 - ratio) + (colorInt2 % 0x100) * ratio);
        return this.toHex(red, green, blue);
    },

    /**
     * Renders a color to an element.
     * 
     * @param {#Color} color the color
     * @param {#Element} element the target element
     * @param {String} styleAttribute the name of the style attribute, e.g., "color", "backgroundColor" 
     */
    render: function(color, element, styleAttribute) {
        if (color) {
            color = this.toTransparent(color);
            element.style[styleAttribute] = color;
        }
    },
    
    /**
     * Renders a color to an element, clearing any existing value.
     * 
     * @param {#Color} color the color
     * @param {#Element} element the target element
     * @param {String} styleAttribute the name of the style attribute, e.g., "color", "backgroundColor" 
     */
    renderClear: function(color, element, styleAttribute) {
        element.style[styleAttribute] = color ? color : "";
    },
    
    /**
     * Renders the "foreground" and "background" color properties of a component to an element's "color" and
     * "backgroundColor" properties.
     * 
     * @param {Echo.Component} component the component
     * @param {Element} the target element 
     */
    renderFB: function(component, element) { 
        var color;
        if ((color = component.render("foreground"))) {
            color = this.toTransparent(color);
            element.style.color = color;
        }
        if ((color = component.render("background"))) {
            color = this.toTransparent(color);
            element.style.backgroundColor = color;
        }
    },
    
    /**
     * Converts red/green/blue integer values to a 6 digit hexadecimal string, preceded by a sharp, e.g. #1a2b3c.
     * 
     * @param {Number} red the red value, 0-255
     * @param {Number} green the green value, 0-255
     * @param {Number} blue the blue value, 0-255
     * @return the hex string
     * @type String
     */
    toHex: function(red, green, blue) {
        if (red < 0) {
            red = 0;
        } else if (red > 255) {
            red = 255;
        }
        if (green < 0) {
            green = 0;
        } else if (green > 255) {
            green = 255;
        }
        if (blue < 0) {
            blue = 0;
        } else if (blue > 255) {
            blue = 255;
        }

        return "#" + (red < 16 ? "0" : "") + red.toString(16) +
                (green < 16 ? "0" : "") + green.toString(16) +
                (blue < 16 ? "0" : "") + blue.toString(16); 
    },

    /**
     * Converts the color to 'transparent' if necessary
     *
     * @param {#Color} color to convert
     * @return the converted color
     * @type String
     */
    toTransparent: function(color) {
        // the mask for 'transparent' is '#-1'
        return (color == -1 || color == '#-1' || (color && color.toLowerCase() == '#transparent')) ? 'transparent' : color;
    }
};

/**
 * Provides tools for rendering extent (dimension) properties.
 * @class
 */
Echo.Sync.Extent = { 

    /**
     * Regular expression to parse an extent value, e.g., "12px" into its value and unit components.
     * @type RegExp
     */
    _PARSER: /^(-?\d+(?:\.\d+)?)(.+)?$/,

    /**
     * Regular expression to determine if an extent value is already formatted to pixel units.
     * @type RegExp
     */
    _FORMATTED_INT_PIXEL_TEST: /^(-?\d+px *)$/,
    
    /**
     * Regular expression to determine if an extent value is already formatted to pixel units.
     * @type RegExp
     */
    _FORMATTED_DECIMAL_PIXEL_TEST: /^(-?\d+(.\d+)?px *)$/,
    
    /**
     * Determines if an extent has percent units.
     * 
     * @param {#Extent} extent the Extent
     * @return true if the extent has percent units
     * @type Boolean
     */
    isPercent: function(extent) {
        if (extent == null || typeof(extent) == "number") {
            return false;
        } else {
            var parts = this._PARSER.exec(extent);
            if (!parts) {
                return false;
            }
            return parts[2] == "%";
        }
    },
    
    /**
     * Renders an extent value to an element.
     *
     * @param {#Extent} extent the Extent
     * @param {Element} element the target element
     * @param {String} styleAttribute the style attribute name, e.g., "padding-left", or "width"
     * @param {Boolean} horizontal flag indicating whether the value is being rendered horizontally
     * @param {Boolean} allowPercent flag indicating whether percent values should be rendered
     */
    render: function(extent, element, styleAttribute, horizontal, allowPercent) {
        var cssValue = Echo.Sync.Extent.toCssValue(extent, horizontal, allowPercent);
        if (cssValue !== "") {
            element.style[styleAttribute] = cssValue;
        }
    },

    /**
     * Returns a CSS representation of an extent value.
     * 
     * @param {#Extent} extent the Extent
     * @param {Boolean} horizontal flag indicating whether the value is being rendered horizontally
     * @param {Boolean} allowPercent flag indicating whether percent values should be rendered
     * @return the rendered CSS value or the empty string ("") if no value could be determined (null will never be returned)
     * @type String
     */
    toCssValue: function(extent, horizontal, allowPercent) {
        switch(typeof(extent)) {
        case "number":
            return Math.round(extent) + "px";
        case "string":
            if (this._FORMATTED_INT_PIXEL_TEST.test(extent)) {
                return extent;
            } else if (this._FORMATTED_DECIMAL_PIXEL_TEST.test(extent)) {
                return Math.round(parseFloat(extent)) + "px";
            } else {
                if (this.isPercent(extent)) {
                    return allowPercent ? extent : "";
                } else {
                    var pixels = this.toPixels(extent, horizontal);
                    return pixels == null ? "" : this.toPixels(extent, horizontal) + "px";
                }
            }
            break;
        }
        return "";
    },

    /**
     * Converts an extent value to pixels.
     * 
     * @param {#Extent} extent the Extent
     * @param {Boolean} horizontal flag indicating whether the value is being rendered horizontally
     * @return the pixel value
     * @type Number
     */
    toPixels: function(extent, horizontal) {
        if (extent == null) {
            return 0;
        } else if (typeof(extent) == "number") {
            return Math.round(extent);
        } else {
            return Math.round(Core.Web.Measure.extentToPixels(extent, horizontal));
        }
    }
};

/**
 * Provides tools for rendering fill image (background image) properties.
 * @class
 */
Echo.Sync.FillImage = { 

    /** Mapping between repeat property values and rendered CSS repeat values. */
    _REPEAT_VALUES: {
        "0": "no-repeat",
        "x": "repeat-x",
        "y": "repeat-y",
        "xy": "repeat",
        "no-repeat": "no-repeat",
        "repeat-x": "repeat-x",
        "repeat-y": "repeat-y",
        "repeat": "repeat"
    },

    /**
     * Flag indicating that the Internet Explorer 6-specific PNG alpha filter should be used to render PNG alpha (transparency).
     * @type Number
     */
    FLAG_ENABLE_IE_PNG_ALPHA_FILTER: 0x1,
    
    /**
     * Determines the background-position CSS attribute of a FillImage.
     * 
     * @param {#FillImage} fillImage the FillImage
     * @return the appropriate CSS background-position attribute, or null if it is not specified
     * @type String
     */
    getPosition: function(fillImage) {
        if (fillImage.x || fillImage.y) {
            var x, y;
            if (Echo.Sync.Extent.isPercent(fillImage.x)) {
                x = fillImage.x;
            } else {
                x = Echo.Sync.Extent.toPixels(fillImage.x, true) + "px";
            }
            if (Echo.Sync.Extent.isPercent(fillImage.y)) {
                y = fillImage.y;
            } else {
                y = Echo.Sync.Extent.toPixels(fillImage.y, false) + "px";
            }
            return x + " " + y;
        } else {
            return null;
        }
    },
    
    /**
     * Determines the background-repeat CSS attribute of a FillImage.
     * 
     * @param {#FillImage} fillImage the FillImage
     * @return the appropriate CSS background-repeat attribute, or null if it is not specified/invalid
     * @type String
     */
    getRepeat: function(fillImage) {
        if (this._REPEAT_VALUES[fillImage.repeat]) {
            return this._REPEAT_VALUES[fillImage.repeat]; 
        } else {
            return null;
        }
    },
    
    /**
     * Returns the URL of a FillImage.
     * 
     * @param {#FillImage} fillImage the FillImage
     * @return the URL
     * @type String
     */
    getUrl: function(fillImage) {
        if (fillImage == null) {
            return null;
        }
        return typeof(fillImage) == "object" ? fillImage.url : fillImage;
    },
    
    /**
     * Renders a FillImage to an element.
     * 
     * @param {#FillImage} fillImage the FillImage (may be null)
     * @param {Element} element the target element
     * @param {Number} flags (optional) the rendering flags, one or more of the following values:
     *        <ul>
     *         <li><code>FLAG_ENABLE_IE_PNG_ALPHA_FILTER</code></li>
     *        <ul>
     */
    render: function(fillImage, element, flags) {
        if (fillImage == null) {
            // No image specified, do nothing.
            return;
        }
        
        var isObject = typeof(fillImage) == "object";
        var url = isObject ? fillImage.url : fillImage;

        if (Core.Web.Env.QUIRK_IE_SECURE_ITEMS && document.location.protocol == "https:") {
            if (url.substring(0, 5) != "http:" && url.substring(0, 6) != "https:") {
                // Use full URL, see http://support.microsoft.com/kb/925014 and
                // http://weblogs.asp.net/rchartier/archive/2008/03/12/ie7-this-page-contains-both-secure-and-nonsecure-items.aspx
                url = document.location.protocol + "//" + document.location.hostname + 
                        (document.location.port ? (":" + document.location.port) : "") + url;
            }
        }
        if (Core.Web.Env.PROPRIETARY_IE_PNG_ALPHA_FILTER_REQUIRED &&
                flags && (flags & this.FLAG_ENABLE_IE_PNG_ALPHA_FILTER)) {
            // IE6 PNG workaround required.
            element.style.filter = "progid:DXImageTransform.Microsoft.AlphaImageLoader(src='" + url + "', sizingMethod='scale')";
        } else {
            // IE6 PNG workaround not required.
            element.style.backgroundImage = "url(" + url + ")";
        }
        
        if (isObject) {
            var position = Echo.Sync.FillImage.getPosition(fillImage);
            element.style.backgroundPosition = position ? position : "";
            element.style.backgroundRepeat = this._REPEAT_VALUES[fillImage.repeat] ? this._REPEAT_VALUES[fillImage.repeat]: ""; 
        }
    },
    
    /**
     * Renders a FillImage to an element, clearing any existing value.
     * 
     * @param {#FillImage} fillImage the FillImage (may be null)
     * @param {Element} element the target element
     * @param {Number} flags (optional) the rendering flags, one or more of the following values:
     *        <ul>
     *         <li><code>FLAG_ENABLE_IE_PNG_ALPHA_FILTER</code></li>
     *        <ul>
     */
    renderClear: function(fillImage, element, flags) {
        if (fillImage) {
            this.render(fillImage, element, flags);
        } else {
            if (Core.Web.Env.PROPRIETARY_IE_PNG_ALPHA_FILTER_REQUIRED) {
                element.style.filter = "";
            }
            element.style.backgroundImage = "";
            element.style.backgroundPosition = "";
            element.style.backgroundRepeat = "";
        }
    }
};

/**
 * Provides tools for rendering fill image border properties (borders composed of eight graphic images).
 * 
 * A relative-positioned DIV may be added to the created FillImageBorder container DIV.
 * Note that you should ALWAYS set the "zoom" CSS property to 1 to workaround "hasLayout" bugs in Internet Explorer's
 * rendering engine.  Use the following code to set this property on any relative positioned DIVs you create:
 * <code>if (Core.Web.Env.QUIRK_IE_HAS_LAYOUT) { div.style.zoom = 1; }</code>.
 * See http://msdn.microsoft.com/en-us/library/bb250481.aspx 
 * 
 * @class
 */
Echo.Sync.FillImageBorder = {
    
    /**
     * Mapping between child node indices of container element and fill image property names of a FillImageBorder.
     * @type Array
     */
    _NAMES: ["top", "topRight", "right", "bottomRight", "bottom", "bottomLeft", "left", "topLeft"],
    
    /**
     * Two dimensional mapping array representing which FillImageBorder side configurations have which elements.
     * First index represents FillImageBorder configuration, from 0-15, with bitwise 1=top, 2=right, 4=bottom 8=left
     * flags ORed together.  Second index represents border side in order top, top-right, right, 
     * bottom-right, bottom, bottom-left, left.  Value is 1 when side/corner element exists for this configuration, 0 otherwise.
     * @type Array
     */
    _MAP: [
    //   0  1  2  3  4  5  6  7
    //   T TR  R BR  B BL  L  TL
        [0, 0, 0, 0, 0, 0, 0, 0], // ----
        [1, 0, 0, 0, 0, 0, 0, 0], // ---t
        [0, 0, 1, 0, 0, 0, 0, 0], // --r-
        [1, 1, 1, 0, 0, 0, 0, 0], // --rt
        [0, 0, 0, 0, 1, 0, 0, 0], // -b--
        [1, 0, 0, 0, 1, 0, 0, 0], // -b-t
        [0, 0, 1, 1, 1, 0, 0, 0], // -br-
        [1, 1, 1, 1, 1, 0, 0, 0], // -brt
        [0, 0, 0, 0, 0, 0, 1, 0], // l---
        [1, 0, 0, 0, 0, 0, 1, 1], // l--t
        [0, 0, 1, 0, 0, 0, 1, 0], // l-r-
        [1, 1, 1, 0, 0, 0, 1, 1], // l-rt
        [0, 0, 0, 0, 1, 1, 1, 0], // lb--
        [1, 0, 0, 0, 1, 1, 1, 1], // lb-t
        [0, 0, 1, 1, 1, 1, 1, 0], // lbr-
        [1, 1, 1, 1, 1, 1, 1, 1]  // lbrt
    ],

    /**
     * Prototype storage.  Indices of this array store lazily-created DOM hierarchies for various FillImageBorder
     * side configurations.  Valid indices of this array are form 0-15, representing the following values ORed
     * together to describe possible configurations of sides:
     * <ul>
     *  <li><code>1</code>: bit indicating the top border should be rendered</li> 
     *  <li><code>2</code>: bit indicating the right border should be rendered</li> 
     *  <li><code>4</code>: bit indicating the bottom border should be rendered</li> 
     *  <li><code>8</code>: bit indicating the left border should be rendered</li> 
     * </li>
     */
    _PROTOTYPES: [],
    
    /**
     * Generates a segment of a rendered FillImageBorder DOM and adds it to its parent.
     * 
     * @param {Element} parent the parent element
     * @param {String} css the CSS text add to the rendered element
     */
    _createSegment: function(parent, css) {
        var child = document.createElement("div");
        child.style.cssText = "font-size:1px;line-height:0;position:absolute;" + css;
        parent.appendChild(child);
    },
    
    /**
     * Creates a prototype rendered DOM element hierarchy to display a fill image border.
     * The values returned by this method are stored and cloned for performance.
     * This method will be invoked at most 16 times, once per key (0-15).
     * 
     * @param key the fill image border key, any combination of the following values ORed together:
     *        <ul>
     *         <li><code>1</code>: bit indicating the top border should be rendered</li> 
     *         <li><code>2</code>: bit indicating the right border should be rendered</li> 
     *         <li><code>4</code>: bit indicating the bottom border should be rendered</li> 
     *         <li><code>8</code>: bit indicating the left border should be rendered</li> 
     *        </li>
     * @return the created border prototype
     */
    _createPrototype: function(key) {
        var div = document.createElement("div");
        if (Core.Web.Env.QUIRK_IE_HAS_LAYOUT) {
            div.style.zoom = 1;
        }
        
        if (key & 0x1) { // Top
            this._createSegment(div, "top:0;");
            if (key & 0x2) { // Right
                this._createSegment(div, "top:0;right:0;");
            }
        }
        if (key & 0x2) { // Right
            this._createSegment(div, "right:0;");
            if (key & 0x4) { // Bottom
                this._createSegment(div, "bottom:0;right:0;");
            }
        }
        if (key & 0x4) { // Bottom
            this._createSegment(div, "bottom:0;");
            if (key & 0x8) { // Left
                this._createSegment(div, "bottom:0;left:0;");
            }
        }
        if (key & 0x8) { // Left
            this._createSegment(div, "left:0;");
            if (key & 0x1) { // Top
                this._createSegment(div, "top:0;left:0;");
            }
        }
        return div;
    },
    
    /***
     * Rerturns the array of border DIV elements, in  the following order:
     * top, top-right, right, bottom-right, bottom, bottom-left, left, top-left.
     * The array will have a value of null for any position that is not rendered due to the border having a zero dimension on 
     * that side.
     * 
     * @param {Element} containerDiv the container element generated by <code>renderContainer()</code>
     * @return the array of border DIV elements
     * @type Array
     */
    getBorder: function(containerDiv) {
        var border = [];
        var child = containerDiv.firstChild;
        while (child) {
            if (child.__FIB_segment != null) {
                border[child.__FIB_segment] = child;
            }
            child = child.nextSibling;
        }
        return border;
    },
    
    /**
     * Returns the content element (to which children may be added) of a FillImageBorder container element created with
     * <code>renderContainer()</code>.
     * 
     * @param {Element} containerDiv the container element generated by <code>renderContainer()</code>
     * @return the content element to which child nodes may be added
     * @type Element
     */
    getContainerContent: function(containerDiv) {
        if (!containerDiv.__FIB_hasContent) {
            return null;
        }
        var child = containerDiv.firstChild;
        while (child) {
            if (child.__FIB_content) {
                return child;
            }
            child = child.nextSibling;
        }
        return null;
    },
    
    /**
     * Creates a DOM hierarchy representing a FillImageBorder.
     * The provided childElement will be added to it, if specified.
     * The outer container DIV element of the rendered DOM hierarchy is returned.  Width and height values may be configured
     * on this returned value.
     * 
     * The <code>renderContainerDisplay()</code> method should be invoked by the <code>renderDisplay()</code> method of any
     * synchronization peer making use of a rendered FillImageBorder container in order to support Internet Explorer 6 browsers
     * (the rendered border uses virtual positioning to appear properly in IE6).
     * 
     * @param {#FillImageBorder} fillImageBorder the FillImageBorder to be rendered.
     * @param configuration (optional) configuration options, an object containing one or more of the following properties:
     *        <ul>
     *         <li><code>update</code>: the containerDiv to update (normally null, which will result in a new one being
     *          created; note that it is less efficient to update a container than to create a new one; currently does not 
     *          support adding content)</li>
     *         <li><code>content</code>: flag indicating that a content element should be created/managed (implied by child)</li>
     *         <li><code>child</code>: a content element to added inside the border (implies content)</li>
     *         <li><code>absolute</code>: boolean flag indicating whether the DIV shold be absolutely (true) or relatively
     *         (false) positioned</li>
     *        </ul>
     * @return the outer container DIV element of the rendered DOM hierarchy
     * @type Element
     */
    renderContainer: function(fillImageBorder, configuration) {
        fillImageBorder = fillImageBorder || {};
        configuration = configuration || {};
        
        // Load pixel border insets.
        var bi = Echo.Sync.Insets.toPixels(fillImageBorder.borderInsets);
        
        // Create bitset "key" based on which sides of border are present.
        var key = (bi.left && 0x8) | (bi.bottom && 0x4) | (bi.right && 0x2) | (bi.top && 0x1);
        var map = this._MAP[key];
        var prototypeDiv = this._PROTOTYPES[key] ? this._PROTOTYPES[key] : this._PROTOTYPES[key] = this._createPrototype(key); 
        var div, child, childClone, firstChild, i, content = null, border = [], insertBefore = null, testChild, insets;
        
        if (configuration.update) {
            // Updating existing FillImageBorder container DIV: load element specified in update property.
            div = configuration.update;

            // Remove current fill image border children, store references to important elements.
            child = div.firstChild;
            while (child) {
                testChild = child;
                child = child.nextSibling;
                if (testChild.__FIB_segment != null) {
                    // Mark position where children should be inserted.
                    insertBefore = child;
                    div.removeChild(testChild);
                }
                if (testChild.__FIB_content) {
                    // Store content child.
                    content = testChild;
                }
            }
            
            // Add children from prototype.
            child = prototypeDiv.firstChild;
            while (child) {
                childClone = child.cloneNode(true);
                if (!firstChild) {
                    // Store reference to first added child.
                    firstChild = childClone;
                }
                
                // Insert child.
                if (insertBefore) {
                    div.insertBefore(childClone, insertBefore);
                } else {
                    div.appendChild(childClone);
                }
                child = child.nextSibling;
            }
        } else {
            // Creating new FillImageBorder container DIV: clone the prototype.
            div = prototypeDiv.cloneNode(true);
            firstChild = div.firstChild;

            // Create and append content container if required.
            if (configuration.content || configuration.child) {
                content = document.createElement("div");
                content.__FIB_content = true;
                if (configuration.child) {
                    content.appendChild(configuration.child);
                }
                div.__FIB_hasContent = true;
                div.appendChild(content);
            }
            
            // Set positioning based on configuration.
            if (configuration.absolute) {
                div.__FIB_absolute = true;
                div.style.position = "absolute";
            } else {
                div.style.position = "relative";
                if (content) {
                    content.style.position = "relative";
                    if (Core.Web.Env.QUIRK_IE_HAS_LAYOUT) {
                        content.style.zoom = 1;
                    }
                }
            }
        }
        div.__key = key;
        
        // Render FillImageBorder.
        child = firstChild;
        for (i = 0; i < 8; ++i) {
            if (!map[i]) {
                // Loaded map indicates no border element in this position: skip.
                continue;
            }
            // Set identifier on segment element.
            child.__FIB_segment = i;
            
            // Store segment element in array for convenient access later.
            border[i] = child;
            
            if (fillImageBorder.color) {
                child.style.backgroundColor = fillImageBorder.color; 
            }
            if (i === 0 || i === 1 || i === 7) { // 0,1,7 = top
                child.style.height = bi.top + "px";
            } else if (i >= 3 && i <= 5) { // 3,4,5 = bottom
                child.style.height = bi.bottom + "px";
            }
            if (i >= 1 && i <= 3) { // 1,2,3 = right
                child.style.width = bi.right + "px";
            } else if (i >= 5) { // 5,6,7 = left
                child.style.width = bi.left + "px";
            }
            Echo.Sync.FillImage.render(fillImageBorder[this._NAMES[i]], child, Echo.Sync.FillImage.FLAG_ENABLE_IE_PNG_ALPHA_FILTER);
            child = child.nextSibling;
        }

        // Set left/right, top/bottom positions of border sides (where elements exist).
        if (bi.top) {
            border[0].style.left = bi.left + "px";
            border[0].style.right = bi.right + "px";
        }
        if (bi.right) {
            border[2].style.top = bi.top + "px";
            border[2].style.bottom = bi.bottom + "px";
        }
        if (bi.bottom) {
            border[4].style.left = bi.left + "px";
            border[4].style.right = bi.right + "px";
        }
        if (bi.left) {
            border[6].style.top = bi.top + "px";
            border[6].style.bottom = bi.bottom + "px";
        }
        
        if (div.__FIB_absolute) {
            if (content) {
                // Set content positioning.
                var ci = Echo.Sync.Insets.toPixels(fillImageBorder.contentInsets);
                content.style.position = "absolute"; 
                content.style.overflow = "auto";
                content.style.top = ci.top + "px";
                content.style.right = ci.right + "px";
                content.style.bottom = ci.bottom + "px";
                content.style.left = ci.left + "px";
            }
        } else {
            if (content) {
                // Set content positioning.
                Echo.Sync.Insets.render(fillImageBorder.contentInsets, content, "padding");
            }
            if (!configuration.update) {
                div.style.position = "relative";
                if (content) {
                    content.style.position = "relative";
                }
            }
        }
        
        return div;
    },
    
    /**
     * Performs renderDisplay() operations on a FillImageBorder container DOM hierarchy.
     * This method should be invoked the renderDisplay() method of a synchronization peer on each FillImageBorder container
     * which it is using.  It is required for IE6 virtual positioning support.
     * 
     * @param {Element} containerDiv the container element generated by <code>renderContainer()</code>
     */
    renderContainerDisplay: function(containerDiv) {
        var content;
        if (Core.Web.VirtualPosition.enabled) {
            if (containerDiv.__FIB_absolute) {
                Core.Web.VirtualPosition.redraw(containerDiv);
                if ((content = this.getContainerContent(containerDiv))) {
                    Core.Web.VirtualPosition.redraw(content);
                }
            }
            var border = this.getBorder(containerDiv);
            for (var i = 0; i < 8; i += 2) {
                if (border[i]) {
                    Core.Web.VirtualPosition.redraw(border[i]);
                }
            }
        }
    }
};

/**
 * Provides tools for rendering font properties.
 * @class
 */
Echo.Sync.Font = { 

    /**
     * Renders a Font property to an element.
     * 
     * @param {#Font} font the font
     * @param {Element} element the target element
     */
    render: function(font, element) {
        if (!font) {
            return;
        }
        if (font.typeface) {
            if (font.typeface instanceof Array) {
                element.style.fontFamily = font.typeface.join(",");
            } else {
                element.style.fontFamily = font.typeface;
            }
        }
        if (font.size) {
            element.style.fontSize = Echo.Sync.Extent.toCssValue(font.size);
        }

        if (font.bold) {
            element.style.fontWeight = "bold";
        }
        if (font.italic) {
            element.style.fontStyle = "italic";
        }
        if (font.underline) {
            element.style.textDecoration = "underline";
        } else if (font.overline) {
            element.style.textDecoration = "overline";
        } else if (font.lineThrough) {
            element.style.textDecoration = "line-through";
        }
    },
    
    /**
     * Renders a Font property to an element, clearing any previously set font first.
     * 
     * @param {#Font} font the font
     * @param {Element} element the target element
     */
    renderClear: function(font, element) {
        if (font) {
            this.render(font, element);
            if (!font.typeface) {
                element.style.fontFamily = "";
            }
            if (!font.underline && !font.overline && !font.lineThrough) {
                element.style.textDecoration = "";
            }
            if (!font.bold) {
                element.style.fontWeight = "";
            }
            if (!font.size) {
                element.style.fontSize = "";
            }
            if (!font.italic) {
                element.style.fontStyle = "";
            }
        } else {
            element.style.fontFamily = "";
            element.style.fontSize = "";
            element.style.fontWeight = "";
            element.style.fontStyle = "";
            element.style.textDecoration = "";
        }
    }
};

/**
 * Provides tools for rendering image properties.
 * @class
 */
Echo.Sync.ImageReference = {

    /**
     * Returns the URL of an image reference object.
     * 
     * @param {#ImageReference} imageReference the image reference (may be null)
     * @return the URL
     * @type String
     */
    getUrl: function(imageReference) {
        return imageReference ? (typeof(imageReference) == "string" ? imageReference : imageReference.url) : null;
    },

    /**
     * Renders an image reference object to an IMG element.
     * 
     * @param {#ImageReference} imageReference the image reference
     * @param {Element} imgElement the IMG element.
     */
    renderImg: function(imageReference, imgElement) {
        if (!imageReference) {
            return;
        }
        
        if (typeof(imageReference) == "string") {
            imgElement.src = imageReference;
        } else {
            imgElement.src = imageReference.url;
            if (imageReference.width) {
                imgElement.style.width = Echo.Sync.Extent.toCssValue(imageReference.width, true);
            }
            if (imageReference.height) {
                imgElement.style.height = Echo.Sync.Extent.toCssValue(imageReference.height, false);
            }
        }
    }
};

/**
 * Provides tools for rendering insets/margin/padding properties.
 * @class
 */
Echo.Sync.Insets = {

    /**
     * Regular expression to test extents which are entirely presented in pixels
     * and may thus be directly added to CSS.
     * @type RegExp
     */
    _FORMATTED_PIXEL_INSETS: /^(-?\d+px *){1,4}$/,

    /** toPixels() return value when insets are 0/null. */
    _ZERO: { top: 0, right: 0, bottom: 0, left: 0 },
    
    /**
     * Mapping between number of inset values provided and arrays which represent the
     * inset value index for the top, right, bottom, and left value. 
     */
    _INDEX_MAPS: {
        1: [0, 0, 0, 0], 
        2: [0, 1, 0, 1], 
        3: [0, 1, 2, 1], 
        4: [0, 1, 2, 3] 
    },

    /**
     * Renders an insets property to an element.
     * 
     * @param {#Insets} insets the insets property
     * @param {Element} element the target element
     * @param {String} styleAttribute the style attribute name, e.g., "padding" or "margin" 
     */
    render: function(insets, element, styleAttribute) {
        switch(typeof(insets)) {
        case "number":
            element.style[styleAttribute] = Math.round(insets) + "px";
            break;
        case "string":
            if (this._FORMATTED_PIXEL_INSETS.test(insets)) {
                element.style[styleAttribute] = insets;
            } else {
                var pixelInsets = this.toPixels(insets);
                element.style[styleAttribute] = pixelInsets.top + "px " + pixelInsets.right + "px " +
                        pixelInsets.bottom + "px " + pixelInsets.left + "px";
            }
            break;
        }
    },
    
    /**
     * Renders an insets property to an element as absolute position coordinates (i.e., top/right/bottom/left values).
     * 
     * @param {#Instes} insets the insets property
     * @param {Element} element the target element
     */
    renderPosition: function(insets, element) {
        var insetsPx = this.toPixels(insets);
        element.style.top = insetsPx.top + "px";
        element.style.right = insetsPx.right + "px";
        element.style.bottom = insetsPx.bottom + "px";
        element.style.left = insetsPx.left + "px";
    },
    
    /**
     * Generates a CSS value for an insets property.
     * 
     * @param {#Insets} insets the insets property
     * @return the CSS value
     * @type String
     */
    toCssValue: function(insets) {
        switch(typeof(insets)) {
        case "number":
            return insets + "px";
        case "string":
            if (this._FORMATTED_PIXEL_INSETS.test(insets)) {
                return insets;
            } else {
                var pixelInsets = this.toPixels(insets);
                return pixelInsets.top + "px " + pixelInsets.right + "px " +
                        pixelInsets.bottom + "px " + pixelInsets.left + "px";
            }
            break;
        }
        return "";
    },
    
    /**
     * Returns an object representing the pixel dimensions of a insets property.
     * 
     * @param {#Insets} insets the insets property
     * @return an object containing top, bottom, left, and right values representing the pixel sizes of the insets property
     */
    toPixels: function(insets) {
        if (insets == null) {
            return this._ZERO;
        } else if (typeof(insets) == "number") {
            insets = Math.round(insets);
            return { top: insets, right: insets, bottom: insets, left: insets };
        }
        
        insets = insets.split(" ");
        var map = this._INDEX_MAPS[insets.length];
        return {
            top: Echo.Sync.Extent.toPixels(insets[map[0]], false),
            right: Echo.Sync.Extent.toPixels(insets[map[1]], true),
            bottom: Echo.Sync.Extent.toPixels(insets[map[2]], false),
            left: Echo.Sync.Extent.toPixels(insets[map[3]], true)
        };
    }
};

/**
 * Provides tools for rendering layout direction properties. 
 */
Echo.Sync.LayoutDirection = {

    /**
     * Renders a layout direction property to an element.
     * 
     * @param {Echo.LayoutDirection} layoutDirection the layoutDirection property (may be null)
     * @param {Element} element the target element
     */
    render: function(layoutDirection, element) {
        if (layoutDirection) {
            element.dir = layoutDirection.isLeftToRight() ? "ltr" : "rtl";
        }
    }
};

/**
 * Renders a table with two or three cells, suitable for laying out buttons, labels, 
 * and similar components.
 */
Echo.Sync.TriCellTable = Core.extend({

    $static: {
        
        /** 
         * Orientation flag indicating inverted (trailing-leading or bottom-top) orientation.
         * @type Number 
         */
        INVERTED: 1,
        
        /** 
         * Orientation flag indicating vertical (top-bottom or bottom-top) orientation. 
         * @type Number 
         */
        VERTICAL: 2,
        
        /** 
         * Orientation value indicating horizontal orientation, leading first, trailing second. 
         * @type Number 
         */
        LEADING_TRAILING: 0,
        
        /** 
         * Orientation value indicating horizontal orientation, trailing first, leading second.
         * @type Number 
         */
        TRAILING_LEADING: 1, // INVERTED
        
        /** 
         * Orientation value indicating vertical orientation, top first, bottom second. 
         * @type Number 
         */
        TOP_BOTTOM: 2,       // VERTICAL
        
        /** 
         * Orientation value indicating vertical orientation, bottom first, top second.
         * @type Number 
         */
        BOTTOM_TOP: 3,       // VERTICAL | INVERTED
        
        /**
         * Creates a prototype DOM element hierarchy for a TriCellTable, which may
         * be cloned for purposes of performance enhancement.
         * 
         * @return the prototype DOM element hierarchy
         * @type Element
         */
        _createTablePrototype: function() {
            var table = document.createElement("table");
            table.style.borderCollapse = "collapse";
            table.style.padding = "0";
            
            var tbody = document.createElement("tbody");
            table.appendChild(tbody);
            
            return table;
        },
        
        /**
         * Returns the inverted orientation value which should be used for a component (the opposite of that which
         * would be returned by getOrientation().
         * The rendered layout direction of the component will be factored when determining horizontal orientations.
         * 
         * @param {Echo.Component} component the component
         * @param {String} propertyName the alignment property name
         * @param {#Alignment} defaultValue default alignment value to use if component does not have specified property
         * @return the (inverted) orientation
         * @type Number
         */
        getInvertedOrientation: function(component, propertyName, defaultValue) {
            return this.getOrientation(component, propertyName, defaultValue) ^ this.INVERTED;
        },

        /**
         * Determines the orientation value which should be used to a component.
         * The rendered layout direction of the component will be factored when determining horizontal orientations.
         * 
         * @param {Echo.Component} component the component
         * @param {String} propertyName the alignment property name
         * @param {#Alignment} defaultValue default alignment value to use if component does not have specified property
         * @return the orientation
         * @type Number
         */
        getOrientation: function(component, propertyName, defaultValue) {
            var position = component.render(propertyName, defaultValue);
            var orientation;
            if (position) {
                switch (Echo.Sync.Alignment.getRenderedHorizontal(position, component)) {
                case "left":   return this.LEADING_TRAILING;
                case "right":  return this.TRAILING_LEADING;
                }
                switch (Echo.Sync.Alignment.getVertical(position, component)) {
                case "top":    return this.TOP_BOTTOM;
                case "bottom": return this.BOTTOM_TOP;
                }
            }
            return component.getRenderLayoutDirection().isLeftToRight() ? this.TRAILING_LEADING : this.LEADING_TRAILING; 
        }
    },
    
    $load: function() {
        this._tablePrototype = this._createTablePrototype(); 
    },
    
    /**
     * The rendered TABLE element.
     * @type Element
     */
    tableElement: null,
    
    /**
     * The rendered TBODY element.
     * @type Element
     */
    tbodyElement: null,

    /**
     * Creates a new <code>TriCellTable</code>
     * 
     * @param {Number} orientation0_1 the orientation of element 0 with respect to element 1, one of 
     *        the following values:
     *        <ul>
     *        <li>LEADING_TRAILING (element 0 is leading element 1)</li>
     *        <li>TRAILING_LEADING (element 1 is leading element 0)</li>
     *        <li>TOP_BOTTOM (element 0 is above element 1)</li>
     *        <li>BOTTOM_TOP (element 1 is above element 0)</li>
     *        </ul>
     * @param {Number} margin0_1 the margin size between element 0 and element 1
     * @param {Number} orientation01_2 (omitted for two-cell tables)
     *        the orientation of Elements 0 and 1 with 
     *        respect to Element 2, one of the following values:
     *        <ul>
     *        <li>LEADING_TRAILING (elements 0 and 1 are leading element 2)</li>
     *        <li>TRAILING_LEADING (element 2 is trailing elements 0 and 1)</li>
     *        <li>TOP_BOTTOM (elements 0 and 1 are above element 2)</li>
     *        <li>BOTTOM_TOP (element 2 is above elements 0 and 1)</li>
     *        </ul>
     * @param {Number} margin01_2 (omitted for two-cell tables)
     *        the margin size between the combination
     *        of elements 0 and 1 and element 2
     */
    $construct: function(orientation0_1, margin0_1, orientation01_2, margin01_2) {
        this.tableElement = Echo.Sync.TriCellTable._tablePrototype.cloneNode(true);
        this.tbodyElement = this.tableElement.firstChild;
        
        if (orientation01_2 == null) {
            this._configure2(orientation0_1, margin0_1);
        } else {
            this._configure3(orientation0_1, margin0_1, orientation01_2, margin01_2);
        }
    },
    
    /**
     * Appends a TD element to a TR element, if TD element is not null.
     * 
     * @param {Element} tr the table row (TR) element
     * @param {Element} td the table cell (TD) element
     */
    _addColumn: function(tr, td) {
        if (td != null) {
            tr.appendChild(td);
        }
    },
    
    /**
     * If the TD element is not null, creates a TR row element and appends the TD element to it;
     * then appends the TR element to the table body.
     * 
     * @param {Element} td the table cell element
     */
    _addRow: function(td) {
        if (td == null) {
            return;
        }
        var tr = document.createElement("tr");
        tr.appendChild(td);
        this.tbodyElement.appendChild(tr);
    },
    
    /**
     * Adds a spacer DIV to the specified parent element.
     * 
     * @param {Element} parentElement the parent element to which the spacer DIV should be added
     * @param {Number} size the pixel size of the spacer
     * @param {Boolean} vertical boolean flag indicating the orientation of the spacer, 
     *        true for vertical spacers, false for horizontal
     */
    _addSpacer: function(parentElement, size, vertical) {
        var divElement = document.createElement("div");
        if (vertical) {
            divElement.style.cssText = "width:1px;height:" + size + "px;font-size:1px;line-height:0;";
        } else {
            divElement.style.cssText = "width:" + size + "px;height:1px;font-size:1px;line-height:0;";
        }
        parentElement.appendChild(divElement);
    },
    
    /**
     * Configures a two-celled TriCellTable.
     * 
     * @param {Number} orientation0_1 the orientation of element 0 with respect to element 1
     * @param {Number} margin0_1 the margin size between element 0 and element 1
     */
    _configure2: function(orientation0_1, margin0_1) {
        this.tdElements = [document.createElement("td"), document.createElement("td")];
        this.tdElements[0].style.padding = "0";
        this.tdElements[1].style.padding = "0";
        this.marginTdElements = [];
        
        if (margin0_1) {
            this.marginTdElements[0] = document.createElement("td");
            this.marginTdElements[0].style.padding = "0";
            if ((orientation0_1 & Echo.Sync.TriCellTable.VERTICAL) === 0) {
                this.marginTdElements[0].style.width = margin0_1 + "px";
                this._addSpacer(this.marginTdElements[0], margin0_1, false);
            } else {
                this.marginTdElements[0].style.height = margin0_1 + "px";
                this._addSpacer(this.marginTdElements[0], margin0_1, true);
            }
        }
        
        if (orientation0_1 & Echo.Sync.TriCellTable.VERTICAL) {
            // Vertically oriented.
            if (orientation0_1 & Echo.Sync.TriCellTable.INVERTED) {
                // Inverted (bottom to top).
                this._addRow(this.tdElements[1]);
                this._addRow(this.marginTdElements[0]);
                this._addRow(this.tdElements[0]);
            } else {
                // Normal (top to bottom).
                this._addRow(this.tdElements[0]);
                this._addRow(this.marginTdElements[0]);
                this._addRow(this.tdElements[1]);
            }
        } else {
            // Horizontally oriented.
            var tr = document.createElement("tr");
            if (orientation0_1 & Echo.Sync.TriCellTable.INVERTED) {
                // Trailing to leading.
                this._addColumn(tr, this.tdElements[1]);
                this._addColumn(tr, this.marginTdElements[0]);
                this._addColumn(tr, this.tdElements[0]);
            } else {
                // Leading to trailing.
                this._addColumn(tr, this.tdElements[0]);
                this._addColumn(tr, this.marginTdElements[0]);
                this._addColumn(tr, this.tdElements[1]);
            }
            this.tbodyElement.appendChild(tr);
        }
    },
    
    /**
     * Configures a two-celled TriCellTable.
     * 
     * @param {Number} orientation0_1 the orientation of element 0 with respect to element 1
     * @param {Number} margin0_1 the margin size between element 0 and element 1
     * @param {Number} orientation01_2 the orientation of Elements 0 and 1 with respect to Element 2
     * @param {Number} margin01_2 the margin size between the combination of elements 0 and 1 and element 2
     */
    _configure3: function(orientation0_1, margin0_1, orientation01_2, margin01_2) {
        this.tdElements = [];
        for (var i = 0; i < 3; ++i) {
            this.tdElements[i] = document.createElement("td");
            this.tdElements[i].style.padding = "0";
        }
        this.marginTdElements = [];
        
        if (margin0_1 || margin01_2 != null) {
            if (margin0_1 && margin0_1 > 0) {
                this.marginTdElements[0] = document.createElement("td");
                if (orientation0_1 & Echo.Sync.TriCellTable.VERTICAL) {
                    this.marginTdElements[0].style.height = margin0_1 + "px";
                    this._addSpacer(this.marginTdElements[0], margin0_1, true);
                } else {
                    this.marginTdElements[0].style.width = margin0_1 + "px";
                    this._addSpacer(this.marginTdElements[0], margin0_1, false);
                }
            }
            if (margin01_2 != null && margin01_2 > 0) {
                this.marginTdElements[1] = document.createElement("td");
                if (orientation0_1 & Echo.Sync.TriCellTable.VERTICAL) {
                    this.marginTdElements[1].style.height = margin01_2 + "px";
                    this._addSpacer(this.marginTdElements[1], margin01_2, true);
                } else {
                    this.marginTdElements[1].style.width = margin01_2 + "px";
                    this._addSpacer(this.marginTdElements[1], margin01_2, false);
                }
            }
        }
        
        if (orientation0_1 & Echo.Sync.TriCellTable.VERTICAL) {
            // Vertically oriented 0/1.
            if (orientation01_2 & Echo.Sync.TriCellTable.VERTICAL) {
                // Vertically oriented 01/2
                
                if (orientation01_2 & Echo.Sync.TriCellTable.INVERTED) {
                    // 2 before 01: render #2 and margin at beginning of TABLE.
                    this._addRow(this.tdElements[2]);
                    this._addRow(this.marginTdElements[1]);
                }
                
                // Render 01
                if (orientation0_1 & Echo.Sync.TriCellTable.INVERTED) {
                    // Inverted (bottom to top)
                    this._addRow(this.tdElements[1]);
                    this._addRow(this.marginTdElements[0]);
                    this._addRow(this.tdElements[0]);
                } else {
                    // Normal (top to bottom)
                    this._addRow(this.tdElements[0]);
                    this._addRow(this.marginTdElements[0]);
                    this._addRow(this.tdElements[1]);
                }
    
                if (!(orientation01_2 & Echo.Sync.TriCellTable.INVERTED)) {
                    // 01 before 2: render #2 and margin at end of TABLE.
                    this._addRow(this.marginTdElements[1]);
                    this._addRow(this.tdElements[2]);
                }
            } else {
                // Horizontally oriented 01/2
                
                // Determine and apply row span based on presence of margin between 0 and 1.
                var rows = (margin0_1 && margin0_1 > 0) ? 3 : 2;
                this.tdElements[2].rowSpan = rows;
                if (this.marginTdElements[1]) {
                    this.marginTdElements[1].rowSpan = rows;
                }
                
                var tr = document.createElement("tr");
                if (orientation01_2 & Echo.Sync.TriCellTable.INVERTED) {
                    this._addColumn(tr, this.tdElements[2]);
                    this._addColumn(tr, this.marginTdElements[1]);
                    if (orientation0_1 & Echo.Sync.TriCellTable.INVERTED) {
                        this._addColumn(tr, this.tdElements[1]);
                    } else {
                        this._addColumn(tr, this.tdElements[0]);
                    }
                } else {
                    if (orientation0_1 & Echo.Sync.TriCellTable.INVERTED) {
                        this._addColumn(tr, this.tdElements[1]);
                    } else {
                        this._addColumn(tr, this.tdElements[0]);
                    }
                    this._addColumn(tr, this.marginTdElements[1]);
                    this._addColumn(tr, this.tdElements[2]);
                }
                this.tbodyElement.appendChild(tr);
                
                this._addRow(this.marginTdElements[0]);
                if (orientation0_1 & Echo.Sync.TriCellTable.INVERTED) {
                    this._addRow(this.tdElements[0]);
                } else {
                    this._addRow(this.tdElements[1]);
                }
            }
        } else {
            // horizontally oriented 0/1
            if (orientation01_2 & Echo.Sync.TriCellTable.VERTICAL) {
                // vertically oriented 01/2
    
                // determine and apply column span based on presence of margin between 0 and 1
                var columns = margin0_1 ? 3 : 2;
                this.tdElements[2].setAttribute("colspan", columns);
                if (this.marginTdElements[1] != null) {
                    this.marginTdElements[1].setAttribute("colspan", columns);
                }
                
                if (orientation01_2 & Echo.Sync.TriCellTable.INVERTED) {
                    // 2 before 01: render #2 and margin at beginning of TR.
                    this._addRow(this.tdElements[2]);
                    this._addRow(this.marginTdElements[1]);
                }
                
                // Render 01
                tr = document.createElement("tr");
                if ((orientation0_1 & Echo.Sync.TriCellTable.INVERTED) === 0) {
                    // normal (left to right)
                    this._addColumn(tr, this.tdElements[0]);
                    this._addColumn(tr, this.marginTdElements[0]);
                    this._addColumn(tr, this.tdElements[1]);
                } else {
                    // inverted (right to left)
                    this._addColumn(tr, this.tdElements[1]);
                    this._addColumn(tr, this.marginTdElements[0]);
                    this._addColumn(tr, this.tdElements[0]);
                }
                this.tbodyElement.appendChild(tr);
                
                if (!(orientation01_2 & Echo.Sync.TriCellTable.INVERTED)) {
                    // 01 before 2: render margin and #2 at end of TR.
                    this._addRow(this.marginTdElements[1]);
                    this._addRow(this.tdElements[2]);
                }
            } else {
                // horizontally oriented 01/2
                tr = document.createElement("tr");
                if (orientation01_2 & Echo.Sync.TriCellTable.INVERTED) {
                    // 2 before 01: render #2 and margin at beginning of TR.
                    this._addColumn(tr, this.tdElements[2]);
                    this._addColumn(tr, this.marginTdElements[1]);
                }
                
                // Render 01
                if (orientation0_1 & Echo.Sync.TriCellTable.INVERTED) {
                    // inverted (right to left)
                    this._addColumn(tr, this.tdElements[1]);
                    this._addColumn(tr, this.marginTdElements[0]);
                    this._addColumn(tr, this.tdElements[0]);
                } else {
                    // normal (left to right)
                    this._addColumn(tr, this.tdElements[0]);
                    this._addColumn(tr, this.marginTdElements[0]);
                    this._addColumn(tr, this.tdElements[1]);
                }
                
                if (!(orientation01_2 & Echo.Sync.TriCellTable.INVERTED)) {
                    this._addColumn(tr, this.marginTdElements[1]);
                    this._addColumn(tr, this.tdElements[2]);
                }
                
                this.tbodyElement.appendChild(tr);        
            }
        }
    }
});
/**
 * Tools for serializing components, stylesheets, and property instances to and from XML.
 * @namespace
 */
Echo.Serial = { 

    /**
     * Map between property class names and property translators.
     * Property translators stored in this map will be used when an object
     * provides a "className" property.
     */
    _translatorMap: { },
    
    /**
     * Array describing mapping between object constructors and property translators.
     * Even indices of the map contain constructors, and the subsequent odd indices
     * contain the property translator suitable for the constructor at the previous
     * index.  This array is iterated to determine the appropriate property translator.
     * This array is only used for a very small number of non-primitive 
     * property types which are provided by JavaScript itself, e.g., Date.
     */
    _translatorTypeData: [ ],
    
    /**
     * Adds a property translator for a specific class name.
     *
     * @param {String} className the class name
     * @param {Echo.Serial.PropertyTranslator} translator the property translator singleton (static class)
     */
    addPropertyTranslator: function(className, translator) {
        this._translatorMap[className] = translator;
    },
    
    /**
     * Adds a property translator for a specific constructor.
     *
     * @param {Function} type the constructor
     * @param {Echo.Serial.PropertyTranslator} translator the property translator singleton (static class) 
     */
    addPropertyTranslatorByType: function(type, translator) {
        this._translatorTypeData.push(type, translator);
    },
    
    /**
     * Retrieves a property translator for a specific class name.
     *
     * @param {String} className the class name
     * @return {Echo.Serial.PropertyTranslator} the property translator
     */
    getPropertyTranslator: function(className) {
        return this._translatorMap[className];
    },
    
    /**
     * Retrieves a property translator for a specific constructor.
     *
     * @param {Function} type the constructor
     * @return {Echo.Serial.PropertyTranslator} the property translator
     */
    getPropertyTranslatorByType: function(type) {
        for (var i = 0; i < this._translatorTypeData.length; i += 2) {
            if (this._translatorTypeData[i] == type) {
                return this._translatorTypeData[i + 1];
            } 
        }
        return null;
    },
    
    /**
     * Deserializes an XML representation of a component into a component instance.
     * Any child components will be added to the created component instance.
     * Events properties will be registered with the client by invoking the
     * "addComponentListener()" method on the provided 'client', passing in
     * the properties 'component' (the component instance) and 'event' (the event
     * type as a string).
     * 
     * @param {Echo.Client} client the containing client
     * @param {Element} cElement the 'c' DOM element to deserialize
     * @param propertyMap (optional) a mapping between property identifiers and property values for referenced properties 
     *        (properties which were rendered elsewhere in the document and are potentially referenced by multiple components)
     * @param styleMap (optional) a mapping between style identifiers and style values for referenced styles (styles which were 
     *        rendered elsewhere in the document and are potentially referenced by multiple components)
     * @return the instantiated component
     */
    loadComponent: function(client, cElement, propertyMap, styleMap) {
        if (!cElement.nodeName == "c") {
            throw new Error("Element is not a component.");
        }
        var type = cElement.getAttribute("t");
        var id = cElement.getAttribute("i");
    
        var component = Echo.ComponentFactory.newInstance(type, id);
        var styleData = component.getLocalStyleData();
        
        var element = cElement.firstChild;
        while (element) {
            if (element.nodeType == 1) {
                switch (element.nodeName) {
                case "c": // Child component
                    var childComponent = this.loadComponent(client, element, propertyMap, styleMap);
                    component.add(childComponent);
                    break;
                case "p": // Property
                    this.loadProperty(client, element, component, styleData, propertyMap);
                    break;
                case "s": // Style name
                    component.setStyleName(element.firstChild ? element.firstChild.nodeValue : null);
                    break;
                case "sr": // Style reference
                    component.setStyle(styleMap ? styleMap[element.firstChild.nodeValue] : null);
                    break;
                case "e": // Event
                    this._loadComponentEvent(client, element, component);
                    break;
                case "en": // Enabled state
                    component.setEnabled(element.firstChild.nodeValue == "true");
                    break;
                case "locale": // Locale
                    component.setLocale(element.firstChild ? element.firstChild.nodeValue : null);
                    break;
                case "dir": // Layout direction
                    component.setLayoutDirection(element.firstChild ?
                            (element.firstChild.nodeValue == "rtl" ? Echo.LayoutDirection.RTL : Echo.LayoutDirection.LTR) : null);
                    break;
                case "f": // Focus
                    if (element.getAttribute("n")) {
                        component.focusNextId = element.getAttribute("n");
                    }
                    if (element.getAttribute("p")) {
                        component.focusPreviousId = element.getAttribute("p");
                    }
                }
            }
            element = element.nextSibling;
        }
        
        return component;
    },
    
    /**
     * Processes an event registration directive element.
     * 
     * @param {Echo.Client} client the client
     * @param {Element} eventElement the event element
     * @param {Echo.Component} the component
     */
    _loadComponentEvent: function(client, eventElement, component) {
        if (client.addComponentListener) {
            var eventType = eventElement.getAttribute("t");
            client.addComponentListener(component, eventType);
        }
    },
    
    /**
     * Deserializes an XML representation of a property into an instance,
     * and assigns it to the specified object.
     * 
     * @param {Echo.Client} client the containing client
     * @param {Element} pElement the property element to parse
     * @param object the object on which the properties should be set (this object
     *        must contain set() and setIndex() methods
     * @param styleData (optional) an associative array on which properties can
     *        be directly set
     * @param propertyMap (optional) a mapping between property identifiers and property values for referenced properties 
     *        (properties which were rendered elsewhere in the document and are potentially referenced by multiple components)
     * @param styleMap (optional) a mapping between style identifiers and style values for referenced styles (styles which were 
     *        rendered elsewhere in the document and are potentially referenced by multiple components)
     */
    loadProperty: function(client, pElement, object, styleData, propertyMap) {
        var name = pElement.getAttribute("n");
        var type = pElement.getAttribute("t");
        var index = pElement.getAttribute("x");
        var value;
        
        if (type) {
            // Invoke custom property processor.
            var translator = Echo.Serial._translatorMap[type];
            if (!translator) {
                throw new Error("Translator not available for property type: " + type);
            }
            value = translator.toProperty(client, pElement);
        } else {
            if (propertyMap) {
                var propertyReference = pElement.getAttribute("r");
                if (propertyReference) {
                    value = propertyMap[propertyReference];
                } else {
                    value = Echo.Serial.String.toProperty(client, pElement);
                }
            } else {
                value = Echo.Serial.String.toProperty(client, pElement);
            }
        }
        
        if (name) {
            if (styleData) {
                if (index == null) {
                    styleData[name] = value;
                } else {
                    var indexValues = styleData[name];
                    if (!indexValues) {
                        indexValues = [];
                        styleData[name] = indexValues;
                    }
                    indexValues[index] = value;
                }
            } else {
                // Property has property name: invoke set(Index).
                if (index == null) {
                    object.set(name, value);
                } else {
                    object.setIndex(name, index, value);
                }
            }
        } else {
            // Property has method name: invoke method.
            var propertyMethod = pElement.getAttribute("m");
            if (index == null) {
                object[propertyMethod](value);
            } else {
                object[propertyMethod](index, value);
            }
        }
    },
    
    /**
     * Deserializes an XML representation of a style sheet into a
     * StyleSheet instance.
     * 
     * @param {Echo.Client} client the client instance
     * @param {Element} ssElement the "ss" element representing the root of the style sheet
     * @param propertyMap the (optional) property map containing referenced property information
     */
    loadStyleSheet: function(client, ssElement, propertyMap) {
        var styleSheet = new Echo.StyleSheet();
        
        var ssChild = ssElement.firstChild;
        while (ssChild) {
            if (ssChild.nodeType == 1) {
                if (ssChild.nodeName == "s") {
                    var style = {};
                    var sChild = ssChild.firstChild;
                    while (sChild) {
                        if (sChild.nodeType == 1) {
                            if (sChild.nodeName == "p") {
                                this.loadProperty(client, sChild, null, style, propertyMap);
                            }
                        }
                        sChild = sChild.nextSibling;
                    }
                    styleSheet.setStyle(ssChild.getAttribute("n") || "", ssChild.getAttribute("t"), style);
                }
            }
            ssChild = ssChild.nextSibling;
        }
        return styleSheet;
    },
    
    /**
     * Serializes a property value into an XML representation.
     * 
     * @param {Echo.Client} client the client instance
     * @param {Element} pElement the "p" element representing the property
     * @param value the value to render to the "p" element
     */
    storeProperty: function(client, pElement, value) {
        if (value == null) {
            // Set no value to indicate null.
        } else if (typeof (value) == "object") {
            var translator = null;
            if (value.className) {
                translator = this._translatorMap[value.className];
            } else {
                translator = this.getPropertyTranslatorByType(value.constructor);
            }
            
            if (!translator || !translator.toXml) {
                // If appropriate translator does not exist, or translator does not support to-XML translation,
                // simply ignore the property.
                return;
            }
            translator.toXml(client, pElement, value);
        } else {
            // call toString here, IE will otherwise convert boolean values to integers
            pElement.appendChild(pElement.ownerDocument.createTextNode(value.toString()));
        }
    }
};

/**
 * Abstract base class for property translators.
 */
Echo.Serial.PropertyTranslator = Core.extend({

    $abstract: true,
    
    $static: {
    
        /**
         * Converts an XML property value to a property instance.
         * 
         *  @param {Echo.Client} client the client
         *  @param {Element} the "p" DOM element describing the property value
         *  @return the generated property instance
         */
        toProperty: function(client, pElement) {
            return null;
        },
    
        /**
         * Optional: converts a property instance to an XML property element.
         * 
         * @param {Echo.Client} client the client
         * @param {Element} pElement the "p" DOM element in which the property value should be stored
         * @param value the property instance
         */
        toXml: null
    }
});

/**
 * Null Property Translator Singleton.
 */
Echo.Serial.Null = Core.extend(Echo.Serial.PropertyTranslator, {
    
    $static: {
    
        /** @see Echo.Serial.PropertyTranslator#toProperty */
        toProperty: function(client, pElement) {
            return null;
        }
    },

    $load: function() {
        Echo.Serial.addPropertyTranslator("0", this);
    }
});

/**
 * Boolean Property Translator Singleton.
 */
Echo.Serial.Boolean = Core.extend(Echo.Serial.PropertyTranslator, {
        
    $static: {
    
        /** @see Echo.Serial.PropertyTranslator#toProperty */
        toProperty: function(client, pElement) {
            return pElement.firstChild.data == "true";
        }
    },

    $load: function() {
        Echo.Serial.addPropertyTranslator("b", this);
    }
});

/**
 * Integer Property Translator Singleton.
 */
Echo.Serial.Integer = Core.extend(Echo.Serial.PropertyTranslator, {

    $static: {
    
        /** @see Echo.Serial.PropertyTranslator#toProperty */
        toProperty: function(client, pElement) {
            return parseInt(pElement.firstChild.data, 10);
        }
    },

    $load: function() {
        Echo.Serial.addPropertyTranslator("i", this);
    }
});

/**
 * Number Property Translator Singleton.
 */
Echo.Serial.Number = Core.extend(Echo.Serial.PropertyTranslator, {

    $static: {
    
        /** @see Echo.Serial.PropertyTranslator#toProperty */
        toProperty: function(client, pElement) {
            return parseFloat(pElement.firstChild.data);
        }
    },

    $load: function() {
        Echo.Serial.addPropertyTranslator("n", this);
    }
});

/**
 * String Property Translator Singleton.
 */
Echo.Serial.String = Core.extend(Echo.Serial.PropertyTranslator, {
    
    $static: {

        /** @see Echo.Serial.PropertyTranslator#toProperty */
        toProperty: function(client, pElement) {
            var textNode = pElement.firstChild;
            if (!textNode) {
                return "";
            }
            var text = textNode.data;
            while (textNode.nextSibling) {
                textNode = textNode.nextSibling;
                text += textNode.data;
            }
            return text;
        }
    },

    $load: function() {
        Echo.Serial.addPropertyTranslator("s", this);
    }
});

/**
 * Date Property Translator Singleton.
 */
Echo.Serial.Date = Core.extend(Echo.Serial.PropertyTranslator, {

    $static: {
    
        _expr: /(\d{4})\.(\d{2}).(\d{2})/,

        /** @see Echo.Serial.PropertyTranslator#toProperty */
        toProperty: function(client, pElement) {
            var value = Echo.Serial.String.toProperty(client, pElement);
            var result = this._expr.exec(value);
            if (!result) {
                return null;
            }
            return new Date(result[1], parseInt(result[2], 10) - 1, result[3]);
        },
        
        /** @see Echo.Serial.PropertyTranslator#toXml */
        toXml: function(client, pElement, value) {
            pElement.appendChild(pElement.ownerDocument.createTextNode(
                    value.getFullYear() + "." + (value.getMonth() + 1) + "." + value.getDate()));
        }
    },
    
    $load: function() {
        Echo.Serial.addPropertyTranslator("d", this);
        Echo.Serial.addPropertyTranslatorByType(Date, this);
    }
});

/**
 * Map (Associative Array) Property Translator Singleton.
 */
Echo.Serial.Map = Core.extend(Echo.Serial.PropertyTranslator, {

    $static: {

        /** @see Echo.Serial.PropertyTranslator#toProperty */
        toProperty: function(client, pElement) {
            var mapObject = {};
            var element = pElement.firstChild;
            while (element) {
                if (element.nodeType != 1) {
                    continue;
                }
        
                Echo.Serial.loadProperty(client, element, null, mapObject, null);
                element = element.nextSibling;
            }
            return mapObject;
        }
    },
    
    $load: function() {
        Echo.Serial.addPropertyTranslator("m", this);
    }
});

/**
 * Alignment Property Translator Singleton.
 */
Echo.Serial.Alignment = Core.extend(Echo.Serial.PropertyTranslator, {

    $static: {
    
        _HORIZONTAL_MAP: {
            "leading": "leading",
            "trailing": "trailing",
            "left": "left",
            "center": "center",
            "right": "right"
        },
        
        _VERTICAL_MAP: {
            "top": "top",
            "center": "middle",
            "bottom": "bottom"
        },
    
        /** @see Echo.Serial.PropertyTranslator#toProperty */
        toProperty: function(client, pElement) {
            var element = Core.Web.DOM.getChildElementByTagName(pElement, "a");
            var h = this._HORIZONTAL_MAP[element.getAttribute("h")];
            var v = this._VERTICAL_MAP[element.getAttribute("v")];
            
            if (h) {
                if (v) {
                    return { horizontal: h, vertical: v };
                }
                return h;
            }
            if (v) {
                return v;
            }
            return null;
        }
    },
    
    $load: function() {
        Echo.Serial.addPropertyTranslator("Alignment", this);
        Echo.Serial.addPropertyTranslator("AL", this);
    }
});

/**
 * Border Property Translator Singleton.
 */
Echo.Serial.Border = Core.extend(Echo.Serial.PropertyTranslator, {

    $static: {
    
        /** @see Echo.Serial.PropertyTranslator#toProperty */
        toProperty: function(client, pElement) {
    	    if (pElement.firstChild.nodeType == 3) { // Text content
    	        return pElement.firstChild.data;
    	    } else if (pElement.getAttribute("v")) {
                return pElement.getAttribute("v");
            } else {
                var element = Core.Web.DOM.getChildElementByTagName(pElement, "b");
                var border = {};
                
                var value = element.getAttribute("t");
                if (value) {
                    border.top = value;
                    value = element.getAttribute("r");
                    if (value) {
                        border.right = value;
                        value = element.getAttribute("b");
                        if (value) {
                            border.bottom = value;
                            value = element.getAttribute("l");
                            if (value) {
                                border.left = value;
                            }
                        }
                    }
                } else {
                    throw new Error("Invalid multi-sided border: no sides set.");
                }
                return border;
            }
        }
    },
    
    $load: function() {
        Echo.Serial.addPropertyTranslator("Border", this);
        Echo.Serial.addPropertyTranslator("BO", this);
    }
});

/**
 * FillImage Property Translator Singleton.
 */
Echo.Serial.FillImage = Core.extend(Echo.Serial.PropertyTranslator, {

    $static: {

        /**
         * Parses a &lt;fi&gt; fill image element.
         * 
         * @param {Echo.Client} client the client
         * @param {Element} fiElement the fill image element
         * @return the parsed fill image
         * @type #FillImage
         */
        parseElement: function(client, fiElement) {
            var url = fiElement.getAttribute("u");
            if (client.decompressUrl) {
                url = client.decompressUrl(url);
            }
            var repeat = fiElement.getAttribute("r");
            var x = fiElement.getAttribute("x");
            var y = fiElement.getAttribute("y");
            
            if (repeat || x || y) {
                return { url: url, repeat: repeat, x: x, y: y };
            } else {
                return url;
            }
        },

        /** @see Echo.Serial.PropertyTranslator#toProperty */
        toProperty: function(client, pElement) {
            var element = Core.Web.DOM.getChildElementByTagName(pElement, "fi");
            return this.parseElement(client, element);
        }
    },
    
    $load: function() {
        Echo.Serial.addPropertyTranslator("FillImage", this);
        Echo.Serial.addPropertyTranslator("FI", this);
    }
});

/**
 * FillImageBorder Property Translator Singleton.
 */
Echo.Serial.FillImageBorder = Core.extend(Echo.Serial.PropertyTranslator, {
    
    $static: {

        /** 
         * (Array) mapping between border indices and property names.
         * @type Array 
         */
        _NAMES: [ "topLeft", "top", "topRight", "left", "right", "bottomLeft", "bottom", "bottomRight" ],
        
        /**
         * Parses a &lt;fbi&gt; fill image border element.
         * 
         * @param {Echo.Client} client the client
         * @param {Element} fibElement the fill image border element
         * @return the parsed fill image border
         * @type #FillImageBorder
         */
        _parseElement: function(client, fibElement) {
            var fillImageBorder = { 
                contentInsets: fibElement.getAttribute("ci") ? fibElement.getAttribute("ci") : null,
                borderInsets: fibElement.getAttribute("bi") ? fibElement.getAttribute("bi") : null,
                color: fibElement.getAttribute("bc")
            };
            
            var element = fibElement.firstChild;
            var i = 0;
            while(element) {
                if (element.nodeType == 1) {
                    if (element.nodeName == "fi") {
                        fillImageBorder[this._NAMES[i]] = Echo.Serial.FillImage.parseElement(client, element);
                        ++i;
                    } else if (element.nodeName == "null-fi") {
                        ++i;
                    }
                }
                element = element.nextSibling;
            }
            if (!(i === 0 || i == 8)) {
                throw new Error("Invalid FillImageBorder image count: " + i);
            }
        
            return fillImageBorder;
        },
    
        /** @see Echo.Serial.PropertyTranslator#toProperty */
        toProperty: function(client, pElement) {
            var element = Core.Web.DOM.getChildElementByTagName(pElement, "fib");
            return Echo.Serial.FillImageBorder._parseElement(client, element);
        }
    },
    
    $load: function() {
        Echo.Serial.addPropertyTranslator("FillImageBorder", this);
        Echo.Serial.addPropertyTranslator("FIB", this);
    }
});

/**
 * Font Property Translator Singleton.
 */
Echo.Serial.Font = Core.extend(Echo.Serial.PropertyTranslator, {

    $static: {
    
        /** @see Echo.Serial.PropertyTranslator#toProperty */
        toProperty: function(client, pElement) {
            var element = Core.Web.DOM.getChildElementByTagName(pElement, "f");
            var tfElements = Core.Web.DOM.getChildElementsByTagName(element, "tf");
            
            var font = { };
            
            if (tfElements.length > 1) {
                font.typeface = [];
                for (var i = 0; i < tfElements.length; ++i) {
                    font.typeface[i] = tfElements[i].firstChild.data;
                }
            } else if (tfElements.length == 1) {
                font.typeface = tfElements[0].firstChild.data;
            }
            
            var size = element.getAttribute("sz");
            if (size) {
                font.size = size;
            }
            
            if (element.getAttribute("bo")) { font.bold        = true; }
            if (element.getAttribute("it")) { font.italic      = true; }
            if (element.getAttribute("un")) { font.underline   = true; }
            if (element.getAttribute("ov")) { font.overline    = true; }
            if (element.getAttribute("lt")) { font.lineThrough = true; }
            
            return font;
        }
    },
    
    $load: function() {
        Echo.Serial.addPropertyTranslator("Font", this);
        Echo.Serial.addPropertyTranslator("F", this);
    }
});

/**
 * ImageReference Property Translator Singleton.
 */
Echo.Serial.ImageReference = Core.extend(Echo.Serial.PropertyTranslator, {

    $static: {
    
        /** @see Echo.Serial.PropertyTranslator#toProperty */
        toProperty: function(client, pElement) {
            var url;
    	    if (pElement.firstChild.nodeType == 1) {
    	    	var iElement = pElement.firstChild;
    	        url = iElement.firstChild.data;
    	        if (client.decompressUrl) {
    	            url = client.decompressUrl(url);
    	        }
    	        var width = iElement.getAttribute("w");
    	        width = width ? width : null;
    	        var height = iElement.getAttribute("h");
    	        height = height ? height : null;
    	        
    	        if (width || height) {
    	            return { url: url, width: width, height: height };
    	        } else {
    	            return url;
    	        }
    	    } else {
    	     url = pElement.firstChild.data;
    	    	return client.decompressUrl ? client.decompressUrl(url) : url;
    	    }
        }
    },
    
    $load: function() {
        Echo.Serial.addPropertyTranslator("ImageReference", this);
        Echo.Serial.addPropertyTranslator("I", this);
    }
});

/**
 * LayoutData Property Translator Singleton.
 */
Echo.Serial.LayoutData = Core.extend(Echo.Serial.PropertyTranslator, {
        
    $static: {

        /** @see Echo.Serial.PropertyTranslator#toProperty */
        toProperty: function(client, pElement) {
            var layoutData = {};
            var element = pElement.firstChild;
            while (element) {
                if (element.nodeType == 1) {
                    if (element.nodeName == "p") {
                        Echo.Serial.loadProperty(client, element, null, layoutData);
                    }
                }
                element = element.nextSibling;
            }
            return layoutData;
        }
    },
    
    $load: function() {
        Echo.Serial.addPropertyTranslator("LayoutData", this);
        Echo.Serial.addPropertyTranslator("L", this);
    }
});
/**
 * Abstract base class for Echo clients.
 * @namespace
 */
Echo.Client = Core.extend({
    
    $static: {

        /**
         * Default client configuration, copied into client configuration.
         */
        DEFAULT_CONFIGURATION: {
            "StopError.Message": "This application has been stopped due to an error.",
            "WaitIndicator.Text": "Please wait...",
            "Action.Continue": "Continue",
            "Action.Restart": "Restart Application"
        },
        
        /**
         * Style property value for <code>displayError</code> indicating a critical error.
         * @type Number
         */
        STYLE_CRITICAL: 0,

        /**
         * Style property value for <code>displayError</code> indicating a message.
         * @type Number
         */
        STYLE_MESSAGE: 1,
    
        /**
         * Global array containing all active client instances in the current browser window.
         * @type Array
         */
        _activeClients: [],

        /**
         * Global listener to respond to resizing of browser window.
         * Invokes _windowResizeListener() method on all active clients.
         * 
         * @param e the DOM resize event
         */
        _globalWindowResizeListener: function(e) {
            for (var i = 0; i < Echo.Client._activeClients.length; ++i) {
                Echo.Client._activeClients[i]._windowResizeListener(e);
            }
        },
        
        /**
         * A client-generated unique persistent identifier for the window, stored in window.name.
         * @type String
         */
        windowId: null
    },
    
    $load: function() {
        // Register resize listener on containing window one time.
        Core.Web.DOM.addEventListener(window, "resize", this._globalWindowResizeListener, false);
        
        var re = /EchoWindowId=([0-9a-f]*\.[0-9a-f]*);/i;
        var match = re.exec(window.name || "");
        this.windowId = match && match[1];
        if (!this.windowId) {
            this.windowId = new Date().getTime().toString(16) + "." + parseInt(Math.random() * 0x100000000, 10).toString(16);
            window.name = (window.name || "") + ";EchoWindowId=" + this.windowId + ";";
        }
    },
    
    /**
     * Application-configurable properties.
     * Initialized at construction, this value should never be set, only individual properties of the configuration may
     * be modified.
     * @type Object
     */
    configuration: null,
    
    /**
     * Flag indicating the user interface should be rendered in design-mode, where all rendered component elements are
     * assigned an id.
     * @type Boolean
     */
    designMode: false,
    
    /**
     * The root DOM element in which the application is contained.
     * @type Element
     */
    domainElement: null,
    
    /**
     * The application being managed by this client.
     * @type Echo.Application
     */
    application: null,
    
    /**
     * Id of last issued input restriction id (incremented to deliver unique identifiers). 
     * @type Number
     */
    _lastInputRestrictionId: 0,
    
    /**
     * Number of currently registered input restrictions.
     * @type Number
     */
    _inputRestrictionCount: 0,
    
    /** 
     * Echo.Component renderId-to-restriction listener mapping.
     */
    _inputRestrictionListeners: null,
    
    /**
     * Id (String) map containing input restrictions.
     * Values are booleans, true indicating property updates are NOT restricted, and false
     * indicated all updates are restricted.
     */
    _inputRescriptionMap: null,
    
    /**
     * The renderId of the component which was focused during the last received <code>keyDown</code> event.
     * @String
     */
    _keyFocusedComponentId: null,
    
    /**
     * Last received keycode from <code>keydown</code> event.  Used for firing cross-browser <Code>keypress</code> events.
     * @type Number
     */
    _lastKeyCode: null,
    
    /**
     * Method reference to this._processKey().
     * @type Function
     */
    _processKeyRef: null,
    
    /**
     * Flag indicating wait indicator is active.
     * @type Boolean
     */
    _waitIndicatorActive: false, 
    
    /**
     * Method reference to this._processApplicationFocus().
     * @type Function
     */
    _processApplicationFocusRef: null,
    
    /**
     * The parent client.
     * @type Echo.Client
     */
    parent: null,
    
    /**
     * Wait indicator.
     * @type Echo.Client.WaitIndicator
     */
    _waitIndicator: null,
    
    /**
     * Restriction time before raising wait indicator, in milliseconds.
     * @type Number
     */
    _preWaitIndicatorDelay: 500,
    
    /**
     * Runnable that will trigger initialization of wait indicator.
     * @type Core.Web.Scheduler.Runnable
     */
    _waitIndicatorRunnable: null,
    
    /**
     * Flag indicating whether a client failure has occurred (indicating there a fail error has also been displayed).
     */
    _failed: false,

    /**
     * Creates a new Client instance.  Derived classes must invoke.
     */
    $construct: function() { 
        this.configuration = { };
        for (var x in Echo.Client.DEFAULT_CONFIGURATION) {
            this.configuration[x] = Echo.Client.DEFAULT_CONFIGURATION[x];
        }
        
        this._inputRestrictionMap = { };
        this._processKeyRef = Core.method(this, this._processKey);
        this._processApplicationFocusRef = Core.method(this, this._processApplicationFocus);
        this._waitIndicator = new Echo.Client.DefaultWaitIndicator();
        this._waitIndicatorRunnable = new Core.Web.Scheduler.MethodRunnable(Core.method(this, this._waitIndicatorActivate), 
                this._preWaitIndicatorDelay, false);
    },
    
    $abstract: true,
    
    $virtual: {

        /**
         * Returns the URL of a resource based on package name / 
         * resource name information.
         * Derived implementations should generally override this
         * method, and delegate to superclass if they are unable
         * to provide a resource for a specific URL.
         * Default implementation delegates to parent client
         * (if one is present) or otherwise returns null.
         * 
         * @param {String} packageName the package name in which the resource is contained
         * @param {String} resourceName the resource name
         * @return the full URL
         * @type String
         */
        getResourceUrl: function(packageName, resourceName) {
            if (this.parent) {
                return this.parent.getResourceUrl(packageName, resourceName);
            } else {
                return null;
            }
        },

        /**
         * Determines if the specified component and containing application is ready to receive input.
         * This method should be overridden by client implementations as needed, returning the value
         * from this implementation if the client has no other reason to disallow input.
         * 
         * @param {Echo.Component} component optional parameter indicating the component to query (if omitted, only the
         *        application's readiness state will be investigated)
         * @return true if the application/component are ready to receive input
         * @type Boolean
         */
        verifyInput: function(component) {
            // Check for input restrictions.
            if (this._inputRestrictionCount !== 0) {
                return false;
            }
        
            if (component) {
                return component.isActive();
            } else {
                return this.application.isActive();
            }
        },
        
        /**
         * Default dispose implementation.
         * Invokes configure(null, null) to deconfigure the client.  Disables wait indicator. 
         */
        dispose: function() {
            // Deconfigure.
            this.configure(null, null);

            // Disable wait indicator.
            this._setWaitVisible(false);
        }
    },
    
    /**
     * Registers an element (which is not a descendant of <code>domainElement</code>) that will contain rendered components.
     * The client will register event listeners to this element, such that it can provide notification of client-level events
     * to component synchronization peers when they occur within this element and its descendants.
     * Any component adding an element outside of the <code>domainElement</code> should invoke this method with said element.
     * Any object invoking this method <strong>MUST</strong> invoke <code>removeElement</code> when the element will no longer
     * be used.
     * This method should only be invoked <strong>once per element</code>, and only on the <strong>root element</code> of any 
     * element hierarchy added outside of the <code>domainElement</code>.
     * 
     * The common use case for this method is when adding elements directly to the <code>BODY</code> element of the DOM.
     * 
     * @param element the element to register
     * @see #removeElement
     */
    addElement: function(element) {
        Core.Web.Event.add(element, "keypress", this._processKeyRef, false);
        Core.Web.Event.add(element, "keydown", this._processKeyRef, false);
        Core.Web.Event.add(element, "keyup", this._processKeyRef, false);
    },
    
    /**
     * Configures/Deconfigures the client.  This method must be invoked
     * with the supported application/containing domain element before
     * the client is used, and invoked with null values before it is
     * disposed (in order to clean up resources).
     * 
     * @param {Echo.Application} application the application the client will support (if configuring)
     *        or null (if deconfiguring)
     * @param {Element} domainElement the DOM element into which the client will be rendered (if configuring),
     *        or null (if deconfiguring)
     */
    configure: function(application, domainElement) {
        if (this.application) {
            // Deconfigure current application if one is configured.
            Core.Arrays.remove(Echo.Client._activeClients, this);
            this.removeElement(this.domainElement);
            this.application.removeListener("focus", this._processApplicationFocusRef);
            this.application.doDispose();
            this.application.client = null;
        }
        
        // Update state.
        this.application = application;
        this.domainElement = domainElement;
        
        if (this.application) {
            // Configure new application if being set.
            this.application.client = this;
            this.application.doInit();
            this.application.addListener("focus", this._processApplicationFocusRef);
            this.addElement(this.domainElement);
            Echo.Client._activeClients.push(this);
        }
    },
    
    /**
     * Registers a new input restriction.  Input will be restricted until this and all other
     * input restrictions are removed.
     *
     * @return a handle identifier for the input restriction, which will be used to unregister
     *         the restriction by invoking removeInputRestriction()
     */
    createInputRestriction: function() {
        this._setWaitVisible(true);
        var id = (++this._lastInputRestrictionId).toString();
        ++this._inputRestrictionCount;
        this._inputRestrictionMap[id] = true;
        return id;
    },
    
    /**
     * Displays an error message, locking the state of the client.  The client is unlocked when the user presses an
     * (optionally configurable) action button.
     * 
     * @param {String} message the message to display
     * @param {String} detail optional details about the message (e.g., client-side exception)
     * @param {String} actionText optional text for an action button
     * @param {Function} actionFunction optional function to execute when action button is clicked
     * @param {Number} style the style in which to display the error, one of the following values:
     *        <ul>
     *         <li><code>STYLE_CRITICAL</code>: used to display a critical error (the default)</li>
     *         <li><code>STYLE_MESSAGE</code>: used to display a message to the user</li>
     *        </ul>
     */
    displayError: function(parentElement, message, detail, actionText, actionFunction, style) {
        parentElement = parentElement || document.body;
        
        // Create restriction.
        var restriction = this.createInputRestriction();

        // Disable wait indicator.
        this._setWaitVisible(false);

        // Darken screen.
        var blackoutDiv = document.createElement("div");
        blackoutDiv.style.cssText = "position:absolute;z-index:32766;width:100%;height:100%;background-color:#000000;opacity:0.75";
        if (Core.Web.Env.PROPRIETARY_IE_OPACITY_FILTER_REQUIRED) {
            blackoutDiv.style.filter = "alpha(opacity=75)";
        }
        parentElement.appendChild(blackoutDiv);
        
        // Render error message.
        var div = document.createElement("div");
        div.style.cssText = "position:absolute;z-index:32767;width:100%;height:100%;overflow:hidden;";
        parentElement.appendChild(div);
        
        var contentDiv = document.createElement("div");
        contentDiv.style.cssText = "color:#ffffff;padding:20px 40px 0px;" + 
              (style === Echo.Client.STYLE_MESSAGE ? "border-bottom:4px solid #1f1faf;background-color:#1f1f5f" :
              "border-bottom:4px solid #af1f1f;background-color:#5f1f1f");
        
        if (message) {
            var messageDiv = document.createElement("div");
            messageDiv.style.cssText = "font-weight: bold; margin-bottom:20px;";
            messageDiv.appendChild(document.createTextNode(message));
            contentDiv.appendChild(messageDiv);
        }
        
        if (detail) {
            var detailDiv = document.createElement("div");
            detailDiv.style.cssText = "max-height:10em;overflow:auto;margin-bottom:20px;";
            detailDiv.appendChild(document.createTextNode(detail));
            contentDiv.appendChild(detailDiv);
        }
        
        div.appendChild(contentDiv);

        if (actionText) {
            var actionDiv = document.createElement("div");
            actionDiv.tabIndex = "0";
            actionDiv.style.cssText = "margin-bottom:20px;cursor:pointer;font-weight:bold;padding:2px 10px;" +
                    (style === Echo.Client.STYLE_MESSAGE ? "border: 1px outset #2f2faf;background-color:#2f2faf;" :
                    "border: 1px outset #af2f2f;background-color:#af2f2f;");
            actionDiv.appendChild(document.createTextNode(actionText));
            contentDiv.appendChild(actionDiv);
            var listener = Core.method(this, function(e) {
                if (e.type != "keypress" || e.keyCode == 13) { 
                    try {
                        // Remove error elements.
                        Core.Web.DOM.removeEventListener(actionDiv, "click", listener, false);
                        Core.Web.DOM.removeEventListener(actionDiv, "keypress", listener, false);
                        div.parentNode.removeChild(div);
                        blackoutDiv.parentNode.removeChild(blackoutDiv);

                        // Remove restriction.
                        this.removeInputRestriction(restriction);
                    } finally {
                        if (actionFunction) {
                            actionFunction();
                        }
                    }
                }
            });
            
            Core.Web.DOM.addEventListener(actionDiv, "click", listener, false);
            Core.Web.DOM.addEventListener(actionDiv, "keypress", listener, false);
            Core.Web.DOM.focusElement(actionDiv);
        }
        
        var closeDiv = document.createElement("div");
        closeDiv.style.cssText = "position:absolute;top:2px;right:8px;color:#ffffff;font-weight:bold;cursor:pointer;";
        closeDiv.appendChild(document.createTextNode("x"));
        Core.Web.DOM.addEventListener(closeDiv, "click", Core.method(this, function() {
            blackoutDiv.parentNode.removeChild(blackoutDiv);
            div.parentNode.removeChild(div);
        }), false);
        
        div.appendChild(closeDiv);
    },
    
    /**
     * Loads required libraries and then executes a function, adding input restrictions while the libraries are being loaded.
     *
     * @param {Array} requiredLibraries the URLs of the libraries which must be loaded before the function can execute
     * @param {Function} f the function to execute
     */
    exec: function(requiredLibraries, f) {
        var restriction = this.createInputRestriction();
        Core.Web.Library.exec(requiredLibraries, Core.method(this, function(e) {
            if (e && !e.success) {
                this.fail("Cannot install library: " + e.url + " Exception: " + e.ex);
                return;
            }
            this.removeInputRestriction(restriction);
            f();
        }));
    },
    
    /**
     * Handles an application failure.
     * If the "StopError.URI" property of the <code>configuration</code> is set, the window is redirected to that URI.
     * If it is not set, an error message is displayed over the domain element, and further input is refused.  A restart
     * button is provided to reload the document.
     * 
     * @param {String} detail the error details 
     */
    fail: function(detail) {
        if (this._failed) {
            // Do nothing if failure has already been processed.
            return;
        }
        this._failed = true;
        var element = this.domainElement;
        try {
            // Attempt to dispose.
            this.dispose();
        } finally {
            if (this.configuration["StopError.URI"]) {
                // Redirect.
                window.location.href = this.configuration["StopError.URI"];
            } else {
                // Display error.
                this.displayError(element, this.configuration["StopError.Message"], detail, this.configuration["Action.Restart"], 
                        function() {
                    window.location.reload();
                });
            }
        }
    },
    
    /**
     * Force various browsers to redraw the screen correctly.  This method is used to workaround the blank screen bug in 
     * Internet Explorer and the CSS positioning bug in Opera. 
     */
    forceRedraw: function() {
        if (this.parent) {
            this.parent.forceRedraw();
        } else if (Core.Web.Env.QUIRK_IE_BLANK_SCREEN) {
            if (this.domainElement && this.domainElement.offsetHeight === 0) {
                // Force IE browser to re-render entire document if the height of the application's domain element measures zero.
                // This is a workaround for an Internet Explorer bug where the browser's rendering engine fundamentally fails and 
                // simply displays a blank screen (commonly referred to on bug-tracker/forum as the "blank screen of death").
                // This bug appears to be most prevalent in IE7. 
                var displayState = document.documentElement.style.display || "";
                document.documentElement.style.display = "none";
                document.documentElement.style.display = displayState;
            }
        }
    },
    
    /**
     * Returns the configured wait indicator.
     *
     * @return the wait indicator
     * @type Echo.Client.WaitIndicator
     */
    getWaitIndicator: function() {
        return this._waitIndicator;
    },
    
    /**
     * Listener for application change of component focus:
     * invokes focus() method on focused component's peer.
     * 
     * @param e the event
     */
    _processApplicationFocus: function(e) {
        var focusedComponent = this.application.getFocusedComponent();
        if (focusedComponent && focusedComponent.peer && focusedComponent.peer.renderFocus) {
            focusedComponent.peer.renderFocus();
        }
    },
    
    /**
     * Event handler for <code>keydown</code>, <code>keypress</code> events, and <code>keyup</code> events.
     * Notifies focsued component (and its ancestry) of event via <code>clientKeyDown</code>, <code>clientKeyPress</code>,
     * and <code>clientKeyUp</code> methods respectively.
     * 
     * @param e the event
     */
    _processKey: function(e) {
        var up = e.type == "keyup",
            press = e.type == "keypress",
            component = this.application.getFocusedComponent(),
            bubble = true,
            keyEvent = null,
            keyCode;
        
        // Determine key code.
        if (press) {
            // If key event is a keypress, retrieve keycode from previous keydown event.
            keyCode = this._lastKeyCode;
        } else {
            // If key event is not a keypress, translate value from event and additionally store in _lastKeyCode property.
            keyCode = this._lastKeyCode = Core.Web.Key.translateKeyCode(e.keyCode);
        }
        
        if (!up) {
            if (keyCode == 8) {
                // Prevent backspace from navigating to previous page.
                var nodeName = e.target.nodeName ? e.target.nodeName.toLowerCase() : null;
                if (nodeName != "input" && nodeName != "textarea") {
                    Core.Web.DOM.preventEventDefault(e);
                }
            } else if (!press && keyCode == 9) {
                // Process tab keydown event: focus next component in application, prevent default browser action.
                this.application.focusNext(e.shiftKey);
                Core.Web.DOM.preventEventDefault(e);
            }
        
            if (press && Core.Web.Env.QUIRK_KEY_PRESS_FIRED_FOR_SPECIAL_KEYS && !e.charCode) {
                // Do nothing in the event no char code is provided for a keypress.
                return true;
            }
        }
            
        if (!component) {
            // No component is focused, take no action.
            return true;
        }

        if (up || press) {
            if (this._keyFocusedComponentId != component.renderId) {
                // Focus has changed: do not fire clientKeyUp/clientKeyPress events.
                return true;
            }
        } else {
            // Store render id of focused component for keyDown events, such that it can be ensured that keyUp/keyPress events
            // will only be fired if that component remains focused when those events are received. 
            this._keyFocusedComponentId = component.renderId;
        }
        
        // Determine event method which should be invoked.
        var eventMethod = press ? "clientKeyPress" : (up ? "clientKeyUp" : "clientKeyDown");
        
        // Fire event to component and ancestry.
        while (component && bubble) {
            if (component.peer && component.peer[eventMethod]) {
                if (!keyEvent) {
                    // Lazy-create key event.
                    keyEvent = { type: e.type, source: this, keyCode: keyCode, domEvent: e };
                    if (press) {
                        keyEvent.charCode = Core.Web.Env.QUIRK_KEY_CODE_IS_CHAR_CODE ? e.keyCode : e.charCode;
                    }
                }
                // Fire event to clientKeyXXX() method.  Continue bubbling event only if clientKeyXXX() method returns true.
                bubble = component.peer[eventMethod](keyEvent);
            }
            component = component.parent;
        }        
        
        return true;
    },

    /**
     * Processes updates to the component hierarchy.
     * Invokes <code>Echo.Render.processUpdates()</code>.
     */
    processUpdates: function() {
        var ir = null;
        try {
            ir = this.createInputRestriction();
            Echo.Render.processUpdates(this);
            this.removeInputRestriction(ir);
            this.forceRedraw();
        } catch (ex) {
            if (ex.lineNumber) {
                // Display reported line number and adjusted line number (used if script was loaded dynamically).
                Core.Debug.consoleWrite("Reported Line #: " + ex.lineNumber);
                Core.Debug.consoleWrite("Evaluated Line #: " + (ex.lineNumber - Core.Web.Library.evalLine) + 
                        " (if evaluated script)");
            }
            if (ex.stack) {
                // Display stack trace if available (Mozilla browsers).
                Core.Debug.consoleWrite("Exception: " + ex + ", Stack Trace: " + ex.stack);
            }
            this.fail("Exception during Client.processUpdates(): " + ex.message);
            throw (ex);
        }
    },
    
    /**
     * Registers a listener to be notified when all input restrictions have been removed.
     * 
     * @param {Echo.Component} component the component for which the restriction listener is being registered
     * @param {Function} l the method to notify when all input restrictions have been cleared 
     */
    registerRestrictionListener: function(component, l) {
        if (!this._inputRestrictionListeners) {
            this._inputRestrictionListeners = { };
        }
        this._inputRestrictionListeners[component.renderId] = l;
    },
    
    /**
     * Removes an input restriction.
     *
     * @param {String} id the id (handle) of the input restriction to remove
     */
    removeInputRestriction: function(id) {
        if (this._inputRestrictionMap[id] === undefined) {
            return;
        }
        delete this._inputRestrictionMap[id];
        --this._inputRestrictionCount;
        
        if (this._inputRestrictionCount === 0) {
            // Last input restriction removed.

            // Disable wait indicator.
            this._setWaitVisible(false);
            
            if (this._inputRestrictionListeners) {
                // Copy restriction listeners to intermediate map, so that listeners can register new
                // listeners that will be invoked the next time all input restrictions are removed.
                var listeners = this._inputRestrictionListeners;
                this._inputRestrictionListeners = null;
               
                // Notify input restriction listeners.
                for (var x in listeners) {
                    listeners[x]();
                }
            }
        }
    },
    
    /**
     * Shows/hides wait indicator.
     * 
     * @param {Boolean} visible the new visibility state of the wait indicator
     */
    _setWaitVisible: function(visible) {
        if (visible) {
            if (!this._waitIndicatorActive) {
                this._waitIndicatorActive = true;
                
                // Schedule runnable to display wait indicator.
                Core.Web.Scheduler.add(this._waitIndicatorRunnable);
            }
        } else {
            if (this._waitIndicatorActive) {
                this._waitIndicatorActive = false;

                // Remove wait indicator from scheduling (if wait indicator has not been presented yet, it will not be).
                Core.Web.Scheduler.remove(this._waitIndicatorRunnable);
                
                // Deactivate if already displayed.
                this._waitIndicator.deactivate(this);
                this.forceRedraw();
            }
        }
    },
    
    /**
     * Sets the wait indicator that will be displayed when a client-server action takes longer than
     * a specified period of time.
     * 
     * @param {Echo.Client.WaitIndicator} waitIndicator the new wait indicator 
     */
    setWaitIndicator: function(waitIndicator) {
        if (this._waitIndicator) {
            this._setWaitVisible(false);
            if (this._waitIndicator.dispose) {
                this._waitIndicator.dispose(this);
            }
        }
        this._waitIndicator = waitIndicator;
    },
    
    /**
     * Unregisters an element (which is not a descendant of <code>domainElement</code>) that will contain rendered components.
     * 
     * @param element the element to unregister
     * @see #addElement
     */
    removeElement: function(element) {
        Core.Web.Event.remove(element, "keypress", this._processKeyRef, false);
        Core.Web.Event.remove(element, "keydown", this._processKeyRef, false);
        Core.Web.Event.remove(element, "keyup", this._processKeyRef, false);
    },
    
    /**
     * Activates the wait indicator.
     */
    _waitIndicatorActivate: function() {
        this._waitIndicator.activate(this);
    },

    /**
     * Instance listener to respond to resizing of browser window.
     * 
     * @param e the DOM resize event
     */
    _windowResizeListener: function(e) {
        if (this.application.rootComponent.peer) {
            Echo.Render.notifyResize(this.application.rootComponent);
        }
    }
});

/**
 * Provides a debugging tool for measuring performance of the Echo3 client engine.
 * This is generally best used to measure performance before/after modifications. 
 */
Echo.Client.Timer = Core.extend({

    /** Array of times. */
    _times: null,
    
    /** Array of labels. */
    _labels: null,
    
    /**
     * Creates a new debug timer.
     * 
     * @constructor
     */
    $construct: function() {
        this._times = [new Date().getTime()];
        this._labels = ["Start"];
    },
    
    /**
     * Marks the time required to complete a task.  This method should be invoked
     * when a task is completed with the 'label' specifying a description of the task.
     * 
     * @param {String} label a description of the completed task.
     */
    mark: function(label) {
        this._times.push(new Date().getTime());
        this._labels.push(label);
    },
    
    /**
     * Returns a String representation of the timer results, showing how long
     * each task required to complete (and included a total time).
     * 
     * @return the timer results
     * @type String
     */
    toString: function() {
        var out = "";
        for (var i = 1; i < this._times.length; ++i) {
            var time = this._times[i] - this._times[i - 1];
            out += this._labels[i] + ":" + time + " ";
        }
        out += "TOT:" + (this._times[this._times.length - 1] - this._times[0]) + "ms";
        return out;
    }
});

/**
 * Abstract base class for "Wait Indicators" which are displayed when the
 * application is not available (e.g., due to in-progress client/server
 * activity. A single wait indicator will be used by the application.
 */
Echo.Client.WaitIndicator = Core.extend({

    $abstract: {
        
        /**
         * Wait indicator activation method. Invoked when the wait indicator
         * should be activated. The implementation should add the wait indicator
         * to the DOM and begin any animation (if applicable).
         * 
         * @param {Echo.Client} the client
         */
        activate: function(client) { },
        
        /**
         * Wait indicator deactivation method. Invoked when the wait indicator
         * should be deactivated. The implementation should remove the wait
         * indicator from the DOM, cancel any animations, and dispose of any
         * resources.
         * 
         * @param {Echo.Client} the client
         */
        deactivate: function(client) { }
    },
    
    $virtual: {
        
        /**
         * Disposes of the wait indicator.
         * 
         * @param {Echo.Client} the client
         */
        dispose: null
    }
});

/**
 * Default wait indicator implementation.
 */
Echo.Client.DefaultWaitIndicator = Core.extend(Echo.Client.WaitIndicator, {
    
    /** Creates a new DefaultWaitIndicator. */
    $construct: function() {
        this._divElement = document.createElement("div");
        this._divElement.style.cssText = "display: none;z-index:32000;position:absolute;top:30px;right:30px;" +
                 "width:200px;padding:20px;border:1px outset #abcdef;background-color:#abcdef;color:#000000;text-align:center;";
        this._textNode = document.createTextNode("");
        this._divElement.appendChild(this._textNode);
        this._fadeRunnable = new Core.Web.Scheduler.MethodRunnable(Core.method(this, this._tick), 50, true);
        document.body.appendChild(this._divElement);
    },
    
    /** @see Echo.Client.WaitIndicator#activate */
    activate: function(client) {
        if (client.configuration["WaitIndicator.Background"]) {
            this._divElement.style.backgroundColor = client.configuration["WaitIndicator.Background"];
            this._divElement.style.borderColor = client.configuration["WaitIndicator.Background"];
        }
        if (client.configuration["WaitIndicator.Foreground"]) {
            this._divElement.style.color = client.configuration["WaitIndicator.Foreground"];
        }
        this._textNode.nodeValue = client.configuration["WaitIndicator.Text"];
        this._divElement.style.display = "block";
        Core.Web.Scheduler.add(this._fadeRunnable);
        this._opacity = 0;
    },
    
    /** @see Echo.Client.WaitIndicator#deactivate */
    deactivate: function(client) {
        this._divElement.style.display = "none";
        Core.Web.Scheduler.remove(this._fadeRunnable);
    },
    
    /** @see Echo.Client.WaitIndicator#dispose */
    dispose: function(client) {
        if (this._divElement && this._divElement.parentNode) {
            this._divElement.parentNode.removeChild(this._divElement);
        }
        this._divElement = null;
        this._textNode = null;
    },
    
    /**
     * Runnable-invoked method to animate (fade in/out) wait indicator.
     */
    _tick: function() {
        ++this._opacity;
        // Formula explained:
        // this._opacity starts at 0 and is incremented forever.
        // First operation is to modulo by 40 then subtract 20, result ranges from -20 to 20.
        // Next take the absolute value, result ranges from 20 to 0 to 20.
        // Divide this value by 30, so the range goes from 2/3 to 0 to 2/3.
        // Subtract that value from 1, so the range goes from 1/3 to 1 and back.
        var opacityValue = 1 - (Math.abs((this._opacity % 40) - 20) / 30);
        if (!Core.Web.Env.PROPRIETARY_IE_OPACITY_FILTER_REQUIRED) {
            this._divElement.style.opacity = opacityValue;
        }
    }
});
/**
 * @fileoverview
 * Freestanding Client Implementation.
 * Provides capability to develop server-independent applications.
 * Requires Core, Core.Web, Application, Render, Serial, Client.
 */
 
/**
 * FreeClient implementation.
 * The init() and dispose() lifecycle methods must be called before the client is used,
 * and when the client will no longer be used, respectively.
 * @namespace
 */ 
Echo.FreeClient = Core.extend(Echo.Client, {

    /** 
     * Method reference to <code>_processUpdate()</code> 
     * @type Function
     */
    _processUpdateRef: null,
    
    /** 
     * Method reference to <code>_doRender()</code> 
     * @type Function
     */
    _doRenderRef: null,
    
    /** Resource package name to base URL mapping for resource paths. */
    _resourcePaths: null,
    
    /** 
     * Flag indicating that a runnable has been enqueued to invoke _doRender(). 
     * @type Boolean
     */
    _renderPending: false,

    /**
     * Creates a new FreeClient.
     *
     * @param {Echo.Application} application the application which the client will contain
     * @param {Element} domainElement the HTML element in which the client will be rendered
     */
    $construct: function(application, domainElement) {
        Echo.Client.call(this);
        this._doRenderRef = Core.method(this, this._doRender);
        this._processUpdateRef = Core.method(this, this._processUpdate);
        this.configure(application, domainElement);
        this._processUpdate();
    },
    
    /**
     * Associates a resource package name with a base URL.
     * Later inquiries to <code>getResourceUrl()</code> with the specified package name will return
     * URLs with the specified <code>baseUrl</code> prepended to the resource name provided in the
     * call to <code>getResourceUrl()</code>.
     *
     * @param {String} packageName the resource package name
     * @param {String} baseUrl the base URL to prepend to resources in the specified package
     */
    addResourcePath: function(packageName, baseUrl) {
        if (!this._resourcePaths) {
            this._resourcePaths = { };
        }
        this._resourcePaths[packageName] = baseUrl;
    },

    /**
     * Disposes of the FreeClient.
     * This method must be invoked when the client will no longer be used, in order to clean up resources.
     */
    dispose: function() {
        this.application.updateManager.removeUpdateListener(this._processUpdateRef);
        Echo.Render.renderComponentDispose(null, this.application.rootComponent);
        Echo.Client.prototype.dispose.call(this);
    },
    
    /**
     * Performs rendering operations by invoking Echo.Render.processUpdates().
     * Invoked in separate execution context (scheduled).
     */
    _doRender: function() {
        if (this.application) {
            // Only execute updates in the event client has not been deconfigured, which can
            // occur before auto-update fires if other operations were scheduled for immediate
            // execution.
            this.processUpdates();
            this._renderPending = false;
        }
    },
    
    /** @see Echo.Client#getResoruceUrl */
    getResourceUrl: function(packageName, resourceName) {
        if (this._resourcePaths && this._resourcePaths[packageName]) {
            return this._resourcePaths[packageName] + resourceName;
        } else {
            return Echo.Client.prototype.getResourceUrl.call(this, packageName, resourceName);
        }
    },
    
    /**
     * Initializes the FreeClient.
     * This method must be invoked before the client is initially used.
     */
    init: function() {
        Core.Web.init();
        this.application.updateManager.addUpdateListener(this._processUpdateRef);
    },
    
    /**
     * Loads an XML style sheet into the client application from a URL.
     * 
     * @param {String} url the URL from which the StyleSheet should be fetched.
     */
    loadStyleSheet: function(url) {
        var conn = new Core.Web.HttpConnection(url, "GET");
        conn.addResponseListener(Core.method(this, this._processStyleSheet));
        conn.connect();
    },
    
    /**
     * Event listener invoked when a StyleSheet fetched via loadStyleSheet() has been retrieved.
     * 
     * @param e the HttpConnection response event
     */
    _processStyleSheet: function(e) {
        if (!e.valid) {
            throw new Error("Received invalid response from StyleSheet HTTP request.");
        }
        
        var ssElement =  e.source.getResponseXml().documentElement;
        var styleSheet = Echo.Serial.loadStyleSheet(this, ssElement);
        this.application.setStyleSheet(styleSheet);
    },

    /** Schedules doRender() to run in next execution context. */  
    _processUpdate: function(e) {
        if (!this._renderPending) {
            this._renderPending = true;
            Core.Web.Scheduler.run(this._doRenderRef);
        }
    }
});
/**
 * @fileoverview
 * Application rendered component module.
 * Requires Core, Core.Web, Application, Render, Serial, Client, FreeClient.
 */

/**
 * Namespace for application-rendered component support.
 * @namespace
 */
Echo.Arc = { };

/**
 * Application class.
 */
Echo.Arc.Application = Core.extend(Echo.Application, {
    
    /**
     * The containing <code>Echo.Arc.ComponentSync</code> instance.
     */
    arcSync: null,
    
    /** @see Echo.Application#isActive */
    isActive: function() {
        if (!this.arcSync.component.isActive()) {
            return false;
        } else {
            return Echo.Application.prototype.isActive.call(this);
        }
    }
});

/**
 * Client for application-rendered components.
 * These clients are automatically created and destroyed by the
 * ArcClient component synchronization peer.
 */
Echo.Arc.Client = Core.extend(Echo.FreeClient, {
    
    /**
     * The synchronization peer for the application-rendered component.
     * @type Echo.Arc.ComponentSync
     */
    arcSync: null,
    
    /** @see Echo.Client#verifyInput */
    verifyInput: function(component, flags) {
        if (!this.arcSync.client.verifyInput(this.arcSync.component, flags)) {
            return false;
        }
        return Echo.FreeClient.prototype.verifyInput.call(this, component, flags);
    }
});

/**
 * Component synchronization peer for application rendered components.
 * Application rendered component peers should extend this peer.
 * The super-implementations of the renderAdd(), renderDispose(),
 * renderDisplay(), and renderUpdate() methods must be invoked.
 */
Echo.Arc.ComponentSync = Core.extend(Echo.Render.ComponentSync, {

    /**
     * The embedded application.
     * @type Echo.Application
     */
    arcApplication: null,
    
    /**
     * The embedded client.
     * @type Echo.Client
     */
    arcClient: null,

    /**
     * The base component that will serve as the rendered form of this synchronization peer's supported component.
     * @type Echo.Component
     */
    baseComponent: null,
    
    /**
     * Default domain element.  A DIV element which is created/returned if 
     */
    _defaultDomainElement: null,
    
    _applicationFocusRef: null,
    
    $abstract: {
    
        /**
         * Creates the base component that will be added to the root
         * of the rendering application.  This component should probably be a
         * ContentPane or other container.
         * This method must be overridden by ARC implementations.
         * 
         * @type Echo.Component
         */
        createComponent: function() { }
    },
    
    $virtual: {
        
        /**
         * Returns the element in which the client should be rendered.
         * Default implementation creates/returns a DIV.
         * May be overridden.  This implementation does not need to be invoked by overriding implementation. 
         * 
         * @type Element
         */
        getDomainElement: function() { 
            if (!this._defaultDomainElement) {
                this._defaultDomainElement = document.createElement("div");
            }
            return this._defaultDomainElement;
        },

        /**
         * Listener for application focus change events.
         * Registered to both the rendered application and the containing component's application.
         */
        _processApplicationFocus: function(e) {
            if (e.source == this.component.application) {
                if (e.newValue != this.component) {
                    // Set focus of rendered application to null when containing application's focus moves
                    // away from the application rendered component.
                    this.arcApplication.setFocusedComponent(null);
                }
            } else if (e.source == this.arcApplication && e.newValue) {
                // Set focus of containing application to the application rendered component when a component contained
                // within the rendered application is focused.
                this.component.application.setFocusedComponent(this.component);
            }
        },
     
        /**
         * Default renderAdd() implementation: appends the element returned by getDomainElement() to the parent.
         * May be overridden.  This implementation does not need to be invoked by overriding implementation. 
         * 
         * @see Echo.Render.ComponentSync#renderAdd
         */
        renderAdd: function(update, parentElement) {
            var element = this.getDomainElement();
            parentElement.appendChild(element);
        },
    
        /**
         * renderDisplay() implementation: must be invoked by overriding method.
         * 
         * This method will create a new client and application instance if one does
         * not exist (i.e., if this method is being called for the first time after
         * renderAdd()).
         * 
         * When the application is created, the component returned by createComponent() 
         * will be added to the root component of the application.  The application will
         * be installed in the DOM at the element returned by the getDomainElement().
         * 
         * @see Echo.Render.ComponentSync#renderDisplay
         */
        renderDisplay: function() {
            if (this.arcApplication) {
                if (!this.baseComponent.peer) {
                    // Do nothing in the event application peers have not been instantiated.
                    return;
                }
                Echo.Render.renderComponentDisplay(this.baseComponent);
            } else {
                this.arcApplication = new Echo.Arc.Application();
                this.arcApplication.arcSync = this;
                this.arcApplication.setStyleSheet(this.client.application.getStyleSheet());
                this.baseComponent = this.createComponent();
                if (!this.baseComponent) {
                    throw new Error("Invalid base component: null");
                }
                this.arcApplication.rootComponent.add(this.baseComponent);
                this.arcClient = new Echo.Arc.Client(this.arcApplication, this.getDomainElement());
                this.arcClient.arcSync = this;
                this.arcClient.parent = this.client;
                this.arcClient.init();
                
                // Register application focus listeners for both containing application and rendered application.
                this._applicationFocusRef = Core.method(this, this._processApplicationFocus);
                this.arcApplication.addListener("focus", this._applicationFocusRef);
                this.client.application.addListener("focus", this._applicationFocusRef);
            }
        },
        
        /**
         * renderDispose() implementation: must be invoked by overriding method.
         * 
         * @see Echo.Render.ComponentSync#renderDispose
         */
        renderDispose: function(update) {
            if (this._applicationFocusRef) {
                // Unregister application focus listeners for both containing application and rendered application.
                this.arcApplication.removeListener("focus", this._applicationFocusRef);
                this.client.application.removeListener("focus", this._applicationFocusRef);
                this._applicationFocusRef = null;
            }
            if (this.arcClient) {
                this.arcClient.dispose();
                this.arcClient = null;
            }
            if (this.arcApplication) {
                this.arcApplication.arcSync = null;
                this.arcApplication = null;
                this.baseComponent = null;
            }
            this._defaultDomainElement = null;
        },
        
        /**
         * renderHide() implementation: must be invoked by overriding method.
         * 
         * @see Echo.Render.ComponentSync#renderHide
         */
        renderHide: function() {
            if (this.arcApplication) {
                if (!this.baseComponent.peer) {
                    // Do nothing in the event application peers have not been instantiated.
                    return;
                }
                Echo.Render.renderComponentHide(this.baseComponent);
            }
        },
        
        /**
         * Default implementation disposes of the existing client and application 
         * and creates a new one.  All application state will be lost.
         * This method should thus be overridden in the event that the application
         * rendered component desires to perform a more efficient update.
         * This implementation may be called by the overriding implementation if
         * replacing-and-redrawing is desired.
         * 
         * @see Echo.Render.ComponentSync#renderUpdate
         */
        renderUpdate: function(update) {
            var domainElement = this.getDomainElement();
            var containerElement = domainElement.parentNode;
            Echo.Render.renderComponentDispose(update, update.parent);
            containerElement.removeChild(domainElement);
            this.renderAdd(update, containerElement);
        }
    }
});

/**
 * A simple container in which to render children of an application rendered component.
 * This container will render as a simple DIV element.
 */
Echo.Arc.ChildContainer = Core.extend(Echo.Component, {

    $load: function() {
        Echo.ComponentFactory.registerType("ArcChildContainer", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "ArcChildContainer"
});

/**
 * Synchronization peer for ChildContainer.
 */
Echo.Arc.ChildContainerPeer = Core.extend(Echo.Render.ComponentSync, {

    $load: function() {
        Echo.Render.registerPeer("ArcChildContainer", this);
    },

    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this._div = document.createElement("div");
        var component = this.component.get("component");
        if (component) {
            if (!component.parent || !component.parent.peer || !component.parent.peer.client) {
                throw new Error("Invalid component: not part of registered hierarchy.");
            }
            Echo.Render.renderComponentAdd(null, component, this._div);
        }
        parentElement.appendChild(this._div);
    },
    
    /** @see Echo.Render.ComponentSync#renderDisplay */
    renderDisplay: function() {
        var component = this.component.get("component");
        if (component) {
            Echo.Render.renderComponentDisplay(component);
        }
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        var component = this.component.get("component");
        if (component) {
            Echo.Render.renderComponentDispose(null, component);
        }
        this._div = null;
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) { }
});
/**
 * Abstract base class for column/row peers.
 * This class should not be extended by developers, the implementation is subject to change.
 */
Echo.Sync.ArrayContainer = Core.extend(Echo.Render.ComponentSync, {

    $abstract: {

        /**
         * The DOM element name of child container cells.
         * @type String
         */
        cellElementNodeName: null,
        
        /** 
         * Abstract method which renders layout data on child cell element.
         * 
         * @param {Echo.Component} child the child component
         * @param {Element} the DOM element containing the child
         */
        renderChildLayoutData: function(child, cellElement) { }
    },
    
    $virtual: {
        
        /** 
         * The key code which should move focus to the previous child cell. 
         * @type Number
         */
        prevFocusKey: null,
        
        /** 
         * The Echo.Render.ComponentSync focus flag indicating which keys should trigger focus changes to the previous child. 
         * @type Boolean
         */
        prevFocusFlag: null,
        
        /** 
         * The key code which should move focus to the next child cell. 
         * @type Number
         */
        nextFocusKey: null,

        /** 
         * The Echo.Render.ComponentSync focus flag indicating which keys should trigger focus changes to the next child.
         * @type Boolean
         */
        nextFocusFlag: null,
        
        /** 
         * Flag indicating whether focus key should be inverted when the component is rendered with an RTL layout direction.
         * @type Boolean 
         */
        invertFocusRtl: false
    },
    
    /**
     * The root DOM element of the rendered array container.
     * @type Element
     */
    element: null,

    /**
     * The DOM element to which child elements should be added.  May be equivalent to <code>element</code>.
     * @type Element
     */
    containerElement: null,
    
    /**
     * Prototype Element to be cloned and added between cells of the array container.
     * 
     * @type Element
     */
    spacingPrototype: null,

    /** 
     * Number of pixels to be rendered as spacing between child cells of the container.
     * @type Number
     */
    cellSpacing: null,

    /**
     * Mapping between child render ids and child container cell elements. 
     */
    _childIdToElementMap: null,

    /**
     * Processes a key press event.  Provides support for adjusting focus via arrow keys.
     * 
     * @param e the event
     */
    clientKeyDown: function(e) {
        switch (e.keyCode) {
        case this.prevFocusKey:
        case this.nextFocusKey:
            var focusPrevious = e.keyCode == this.prevFocusKey;
            if (this.invertFocusRtl && !this.component.getRenderLayoutDirection().isLeftToRight()) {
                focusPrevious = !focusPrevious;
            }
            var focusedComponent = this.client.application.getFocusedComponent();
            if (focusedComponent && focusedComponent.peer && focusedComponent.peer.getFocusFlags) {
                var focusFlags = focusedComponent.peer.getFocusFlags();
                if ((focusPrevious && focusFlags & this.prevFocusFlag) || (!focusPrevious && focusFlags & this.nextFocusFlag)) {
                    var focusChild = this.client.application.focusManager.findInParent(this.component, focusPrevious);
                    if (focusChild) {
                        this.client.application.setFocusedComponent(focusChild);
                        Core.Web.DOM.preventEventDefault(e.domEvent);
                        return false;
                    }
                }
            }
            break;
        }
        return true;
    },

    /**
     * Renders the specified child to the containerElement.
     * 
     * @param {Echo.Update.ComponentUpdate} the update
     * @param {Echo.Component} the child component
     * @param {Number} index the index of the child within the parent 
     */
    _renderAddChild: function(update, child, index) {
        var cellElement = document.createElement(this.cellElementNodeName);
        this._childIdToElementMap[child.renderId] = cellElement;
        Echo.Render.renderComponentAdd(update, child, cellElement);

        this.renderChildLayoutData(child, cellElement);

        if (index != null) {
            var currentChildCount;
            if (this.containerElement.childNodes.length >= 3 && this.cellSpacing) {
                currentChildCount = (this.containerElement.childNodes.length + 1) / 2;
            } else {
                currentChildCount = this.containerElement.childNodes.length;
            }
            if (index == currentChildCount) {
                index = null;
            }
        }
        if (index == null || !this.containerElement.firstChild) {
            // Full render, append-at-end scenario, or index 0 specified and no children rendered.
            
            // Render spacing cell first if index != 0 and cell spacing enabled.
            if (this.cellSpacing && this.containerElement.firstChild) {
                this.containerElement.appendChild(this.spacingPrototype.cloneNode(false));
            }
    
            // Render child cell second.
            this.containerElement.appendChild(cellElement);
        } else {
            // Partial render insert at arbitrary location scenario (but not at end)
            var insertionIndex = this.cellSpacing ? index * 2 : index;
            var beforeElement = this.containerElement.childNodes[insertionIndex];
            
            // Render child cell first.
            this.containerElement.insertBefore(cellElement, beforeElement);
            
            // Then render spacing cell if required.
            if (this.cellSpacing) {
                this.containerElement.insertBefore(this.spacingPrototype.cloneNode(false), beforeElement);
            }
        }
    },
    
    /**
     * Renders all children.  Must be invoked by derived <code>renderAdd()</code> implementations.
     * 
     * @param {Echo.Update.ComponentUpdate} the update
     */
    renderAddChildren: function(update) {
        this._childIdToElementMap = {};
    
        var componentCount = this.component.getComponentCount();
        for (var i = 0; i < componentCount; ++i) {
            var child = this.component.getComponent(i);
            this._renderAddChild(update, child);
        }
    },

    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) { 
        this.element = null;
        this.containerElement = null;
        this._childIdToElementMap = null;
        this.spacingPrototype = null;
    },

    /**
     * Removes a child cell.
     * 
     * @param {Echo.Update.ComponentUpdate} the update
     * @param {Echo.Component} the child to remove
     */
    _renderRemoveChild: function(update, child) {
        var childElement = this._childIdToElementMap[child.renderId];
        if (!childElement) {
            return;
        }
        
        if (this.cellSpacing) {
            // If cell spacing is enabled, remove a spacing element, either before or after the removed child.
            // In the case of a single child existing in the Row, no spacing element will be removed.
            if (childElement.previousSibling) {
                this.containerElement.removeChild(childElement.previousSibling);
            } else if (childElement.nextSibling) {
                this.containerElement.removeChild(childElement.nextSibling);
            }
        }
        
        this.containerElement.removeChild(childElement);
        
        delete this._childIdToElementMap[child.renderId];
    },

    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        var i, fullRender = false;
        if (update.hasUpdatedProperties() || update.hasUpdatedLayoutDataChildren()) {
            // Full render
            fullRender = true;
        } else {
            var removedChildren = update.getRemovedChildren();
            if (removedChildren) {
                // Remove children.
                for (i = 0; i < removedChildren.length; ++i) {
                    this._renderRemoveChild(update, removedChildren[i]);
                }
            }
            var addedChildren = update.getAddedChildren();
            if (addedChildren) {
                // Add children.
                for (i = 0; i < addedChildren.length; ++i) {
                    this._renderAddChild(update, addedChildren[i], this.component.indexOf(addedChildren[i])); 
                }
            }
        }
        if (fullRender) {
            var element = this.element;
            var containerElement = element.parentNode;
            Echo.Render.renderComponentDispose(update, update.parent);
            containerElement.removeChild(element);
            this.renderAdd(update, containerElement);
        }
        
        return fullRender;
    }
});

/**
 * Component rendering peer: Column
 */
Echo.Sync.Column = Core.extend(Echo.Sync.ArrayContainer, {

    $load: function() {
        Echo.Render.registerPeer("Column", this);
    },

    /** @see Echo.Render.ComponentSync#cellElementNodeName */
    cellElementNodeName: "div",
    
    /** @see Echo.Sync.ArrayContainer#prevFocusKey */
    prevFocusKey: 38,
    
    /** @see Echo.Sync.ArrayContainer#prevFocusFlag */
    prevFocusFlag: Echo.Render.ComponentSync.FOCUS_PERMIT_ARROW_UP,

    /** @see Echo.Sync.ArrayContainer#nextFocusKey */
    nextFocusKey: 40,

    /** @see Echo.Sync.ArrayContainer#nextFocusFlag */
    nextFocusFlag: Echo.Render.ComponentSync.FOCUS_PERMIT_ARROW_DOWN,
    
    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this.element = this.containerElement = document.createElement("div");
        this.element.id = this.component.renderId;
        this.element.style.outlineStyle = "none";
        this.element.tabIndex = "-1";
    
        Echo.Sync.renderComponentDefaults(this.component, this.element);
        Echo.Sync.Border.render(this.component.render("border"), this.element);
        Echo.Sync.Insets.render(this.component.render("insets"), this.element, "padding");
    
        this.cellSpacing = Echo.Sync.Extent.toPixels(this.component.render("cellSpacing"), false);
        if (this.cellSpacing) {
            this.spacingPrototype = document.createElement("div");
            this.spacingPrototype.style.height = this.cellSpacing + "px";
            this.spacingPrototype.style.fontSize = "1px";
            this.spacingPrototype.style.lineHeight = "0";
        }
        
        this.renderAddChildren(update);

        parentElement.appendChild(this.element);
    },
    
    /** @see Echo.Sync.ArrayContainer#renderChildLayoutData */
    renderChildLayoutData: function(child, cellElement) {
        var layoutData = child.render("layoutData");
        if (layoutData) {
            Echo.Sync.Color.render(layoutData.background, cellElement, "backgroundColor");
            Echo.Sync.FillImage.render(layoutData.backgroundImage, cellElement);
            Echo.Sync.Insets.render(layoutData.insets, cellElement, "padding");
            Echo.Sync.Alignment.render(layoutData.alignment, cellElement, true, this.component);
            if (layoutData.height) {
                cellElement.style.height = Echo.Sync.Extent.toPixels(layoutData.height, false) + "px";
            }
        }
    }
});

/**
 * Component rendering peer: Row
 */
Echo.Sync.Row = Core.extend(Echo.Sync.ArrayContainer, {

    $static: {
    
        /** 
         * Creates a prototype DOM element hierarchy to be cloned when rendering.   
         * 
         * @return the prototype Element
         * @type Element
         */
        _createRowPrototype: function() {
            var div = document.createElement("div");
            div.style.outlineStyle = "none";
            div.tabIndex = "-1";
        
            var table = document.createElement("table");
            table.style.borderCollapse = "collapse";
            div.appendChild(table);
        
            var tbody = document.createElement("tbody");
            table.appendChild(tbody);
            
            tbody.appendChild(document.createElement("tr"));
        
            return div;
        },
        
        /** 
         * The prototype DOM element hierarchy to be cloned when rendering.
         * @type Element 
         */
        _rowPrototype: null
    },
    
    $load: function() {
        this._rowPrototype = this._createRowPrototype();
        Echo.Render.registerPeer("Row", this);
    },

    /** @see Echo.Render.ComponentSync#cellElementNodeName */
    cellElementNodeName: "td",

    /** @see Echo.Sync.ArrayContainer#prevFocusKey */
    prevFocusKey: 37,
    
    /** @see Echo.Sync.ArrayContainer#prevFocusFlag */
    prevFocusFlag: Echo.Render.ComponentSync.FOCUS_PERMIT_ARROW_LEFT,
    
    /** @see Echo.Sync.ArrayContainer#nextFocusKey */
    nextFocusKey: 39,

    /** @see Echo.Sync.ArrayContainer#nextFocusFlag */
    nextFocusFlag: Echo.Render.ComponentSync.FOCUS_PERMIT_ARROW_RIGHT,
    
    /** @see Echo.Sync.ArrayContainer#invertFocusRtl */
    invertFocusRtl: true,
    
    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this.element = Echo.Sync.Row._rowPrototype.cloneNode(true);
        this.element.id = this.component.renderId;

        Echo.Sync.renderComponentDefaults(this.component, this.element);
        Echo.Sync.Border.render(this.component.render("border"), this.element);
        Echo.Sync.Insets.render(this.component.render("insets"), this.element, "padding");
        Echo.Sync.Alignment.render(this.component.render("alignment"), this.element, true, this.component);
        
        //                      div          table      tbody      tr
        this.containerElement = this.element.firstChild.firstChild.firstChild;
    
        this.cellSpacing = Echo.Sync.Extent.toPixels(this.component.render("cellSpacing"), false);
        if (this.cellSpacing) {
            this.spacingPrototype = document.createElement("td");
            this.spacingPrototype.style.padding = 0;
            this.spacingPrototype.style.width = this.cellSpacing + "px";
        }
        
        this.renderAddChildren(update);

        parentElement.appendChild(this.element);
    },

    /** @see Echo.Sync.ArrayContainer#renderChildLayoutData */
    renderChildLayoutData: function(child, cellElement) {
        var layoutData = child.render("layoutData");
        var insets;
        if (layoutData) {
            insets = layoutData.insets;
            Echo.Sync.Color.render(layoutData.background, cellElement, "backgroundColor");
            Echo.Sync.FillImage.render(layoutData.backgroundImage, cellElement);
            Echo.Sync.Alignment.render(layoutData.alignment, cellElement, true, this.component);
            if (layoutData.width) {
                if (Echo.Sync.Extent.isPercent(layoutData.width)) {
                    cellElement.style.width = layoutData.width;
                    if (this.element.firstChild.style.width != "100%") {
                        this.element.firstChild.style.width = "100%";
                    }
                } else {
                    cellElement.style.width = Echo.Sync.Extent.toPixels(layoutData.width, true) + "px";
                }
            }
        }
        if (!insets) {
            insets = 0;
        }
        Echo.Sync.Insets.render(insets, cellElement, "padding");
    }
});
/**
 * Component rendering peer: Button.
 * This class should not be extended by developers, the implementation is subject to change.
 */
Echo.Sync.Button = Core.extend(Echo.Render.ComponentSync, {

    $static: {

        /**
         * Default margin between icon and text elements.
         * @type Number
         */
        _defaultIconTextMargin: 5,
        
        /**
         * Prototype DOM hierarchy for a rendered button.
         * @type Element
         */
        _prototypeButton: null,
        
        /**
         * Creates the prototype DOM hierarchy for a rendered button.
         * @type Element
         */
        _createPrototypeButton: function() {
            var div = document.createElement("div");
            div.tabIndex = "0";
            div.style.outlineStyle = "none";
            div.style.cursor = "pointer";
            return div;
        }
    },
    
    $load: function() {
        this._prototypeButton = this._createPrototypeButton();
        Echo.Render.registerPeer("Button", this);
    },
    
    /**
     * The rendered enabled state of the component.
     * @type Boolean
     */
    enabled: null,
    
    /**
     * Outer DIV containing button.
     * @type Element
     */
    div: null,
    
    /**
     * Text-containing element, upon which font styles should be set.
     * @type Element
     */
    _textElement: null,
    
    /**
     * IMG element representing buttons icon.
     * @type Element
     */
    iconImg: null,
    
    /**
     * Method reference to _processRolloverExit.
     * @type Function
     */
    _processRolloverExitRef: null,
    
    /**
     * Method reference to _processInitEvent.
     * @type Function
     */
    _processInitEventRef: null,
    
    /**
     * The rendered focus state of the button.
     * @type Boolean
     */
    _focused: false,
    
    /** Creates a new Echo.Sync.Button */
    $construct: function() { 
        this._processInitEventRef = Core.method(this, this._processInitEvent);
    },
    
    $virtual: {
        
        /**
         * Processes a user action (i.e., clicking or pressing enter when button is focused).
         * Default implementation invokes <code>doAction()</code> on supported <code>Echo.Component</code>.
         */
        doAction: function() {
            this.component.doAction();
        },
        
        /**
         * Renders the content (e.g. text and/or icon) of the button.
         * Appends rendered content to bounding element (<code>this.div</code>).
         */
        renderContent: function() {
            var text = this.component.render("text");
            var icon = Echo.Sync.getEffectProperty(this.component, "icon", "disabledIcon", !this.enabled);
            if (text != null) {
                if (icon) {
                    // Text and icon.
                    var iconTextMargin = this.component.render("iconTextMargin", 
                            Echo.Sync.Button._defaultIconTextMargin);
                    var orientation = Echo.Sync.TriCellTable.getOrientation(this.component, "textPosition");
                    var tct = new Echo.Sync.TriCellTable(orientation, 
                            Echo.Sync.Extent.toPixels(iconTextMargin));
                    this.renderButtonText(tct.tdElements[0], text);
                    this.iconImg = this.renderButtonIcon(tct.tdElements[1], icon);
                    this.div.appendChild(tct.tableElement);
                } else {
                    // Text only.
                    this.renderButtonText(this.div, text);
                }
            } else if (icon) {
                // Icon only.
                this.iconImg = this.renderButtonIcon(this.div, icon);
            }
        },

        /**
         * Enables/disables pressed appearance of button.
         * 
         * @param {Boolean} rollover the new pressed state
         * @param {Boolean} pressed the new pressed state
         */
        setHighlightState: function(rollover, pressed) {
            var focused = this.component && this.component.application && 
                    this.component.application.getFocusedComponent() == this.component;
            
            // Determine effect property name.  Priorities are 1: pressed, 2: rollover: 3: focused.
            var ep = pressed ? "pressed" : (rollover ? "rollover" : "focused");
            var state = focused || pressed || rollover;

            var foreground = Echo.Sync.getEffectProperty(this.component, "foreground", ep + "Foreground", state);
            var background = Echo.Sync.getEffectProperty(this.component, "background", ep + "Background", state);
            var backgroundImage = Echo.Sync.getEffectProperty(
                    this.component, "backgroundImage", ep + "BackgroundImage", state);
            var font = Echo.Sync.getEffectProperty(this.component, "font", ep + "Font", state);
            var border = Echo.Sync.getEffectProperty(this.component, "border", ep + "Border", state);
            
            Echo.Sync.Color.renderClear(foreground, this.div, "color");
            Echo.Sync.Color.renderClear(background, this.div, "backgroundColor");
            Echo.Sync.FillImage.renderClear(backgroundImage, this.div, "backgroundColor");
            
            if (state) {
                Echo.Sync.Insets.render(this.getInsetsForBorder(this.component.render(ep + "Border")), this.div, "padding");
            } else {
                Echo.Sync.Insets.render(this.component.render("insets"), this.div, "padding");
            }
            Echo.Sync.Border.renderClear(border, this.div);

            if (this._textElement) {
                Echo.Sync.Font.renderClear(font, this._textElement);
            }
            
            if (this.iconImg) {
                var iconUrl = Echo.Sync.ImageReference.getUrl(
                        Echo.Sync.getEffectProperty(this.component, "icon", ep + "Icon", state));
                if (iconUrl != this.iconImg.src) {
                    this.iconImg.src = iconUrl;
                }
            }
        }
    },
    
    /**
     * Registers event listeners on the button.  This method is invoked lazily, i.e., the first time the button
     * is focused or rolled over with the mouse.  The initial focus/mouse rollover listeners are removed by this method.
     * This strategy is used for performance reasons due to the fact that many buttons may be present 
     * on the screen, and each button has many event listeners, which would otherwise need to be registered on the initial render.
     */
    _addEventListeners: function() {
        this._processRolloverExitRef = Core.method(this, this._processRolloverExit);
    
        // Remove initialization listeners.
        Core.Web.Event.remove(this.div, "focus", this._processInitEventRef);
        Core.Web.Event.remove(this.div, "mouseover", this._processInitEventRef);
        
        Core.Web.Event.add(this.div, "click", Core.method(this, this._processClick), false);
        if (this.component.render("rolloverEnabled")) {
            Core.Web.Event.add(this.div, Core.Web.Env.PROPRIETARY_EVENT_MOUSE_ENTER_LEAVE_SUPPORTED ? "mouseenter" : "mouseover", 
                    Core.method(this, this._processRolloverEnter), false);
            Core.Web.Event.add(this.div, Core.Web.Env.PROPRIETARY_EVENT_MOUSE_ENTER_LEAVE_SUPPORTED ? "mouseleave" : "mouseout", 
                    Core.method(this, this._processRolloverExit), false);
        }
        if (this.component.render("pressedEnabled")) {
            Core.Web.Event.add(this.div, "mousedown", Core.method(this, this._processPress), false);
            Core.Web.Event.add(this.div, "mouseup", Core.method(this, this._processRelease), false);
        }
        Core.Web.Event.add(this.div, "focus", Core.method(this, this._processFocus), false);
        Core.Web.Event.add(this.div, "blur", Core.method(this, this._processBlur), false);
        
        Core.Web.Event.Selection.disable(this.div);
    },
    
    /** 
     * Processes a key press event.  Invokes <code>doAction()</code> in the case of enter being pressed.
     * @see Echo.Render.ComponentSync#clientKeyDown 
     */
    clientKeyDown: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return true;
        }
        if (e.keyCode == 13) {
            this.doAction();
            return false;
        } else {
            return true;
        }
    },
    
    /** @see Echo.Render.ComponentSync#getFocusFlags */ 
    getFocusFlags: function() {
        return Echo.Render.ComponentSync.FOCUS_PERMIT_ARROW_ALL;
    },
    
    /**
     * Returns an adjusted insets value to apply to the button such that the specified border+returned insets will occupy the
     * same space as the button's default state border+insets.
     * <p>
     * For example. consider a button with a border size of 5px, and a default inset of 3px.  
     * The total border/inset space would be 8px.  If this method is passed a border with
     * a size of 2px, it will return an inset with a size of 6px to compensate and ensure the border+inset size will be unchanged.
     * This calculation is performed individually for each side of the border/insets. 
     * 
     * @param #Border border the effect border for which insets should be calculated.
     * @return the adjusted insets
     * @type #Insets
     */
    getInsetsForBorder: function(border) {
        var defaultBorder = this.component.render("border");
        if (!border) {
            // Return default insets if provided border is null.
            return this.component.render("insets");
        }
        
        var insetsPx = Echo.Sync.Insets.toPixels(this.component.render("insets"));
        for (var x in insetsPx) {
            insetsPx[x] += Echo.Sync.Border.getPixelSize(defaultBorder, x) - Echo.Sync.Border.getPixelSize(border, x);
            if (insetsPx[x] < 0) {
                insetsPx[x] = 0;
            }
        }
        return insetsPx.top + " " + insetsPx.right + " " + insetsPx.bottom + " "  + insetsPx.left;
    },
        
    /** Processes a focus blur event. */
    _processBlur: function(e) {
        this._focused = false;
        this.setHighlightState(false, false);
    },
    
    /** Processes a mouse click event. */
    _processClick: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return true;
        }
        this.client.application.setFocusedComponent(this.component);
        this.doAction();
    },
    
    /** Processes a focus event. */
    _processFocus: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return true;
        }
        this.client.application.setFocusedComponent(this.component);
        this.setHighlightState(false, false);
    },
    
    /**
     * The Initial focus/mouse rollover listener.
     * This listener is invoked the FIRST TIME the button is focused or mouse rolled over.
     * It invokes the addListeners() method to lazily add the full listener set to the button.
     */
    _processInitEvent: function(e) {
        this._addEventListeners();
        switch (e.type) {
        case "focus":
            this._processFocus(e);
            break;
        case "mouseover":
            if (this.component.render("rolloverEnabled")) {
                this._processRolloverEnter(e);
            }
            break;
        }
    },
    
    /** Processes a mouse button press event, displaying the button's pressed appearance. */
    _processPress: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return true;
        }
        Core.Web.DOM.preventEventDefault(e);
        this.setHighlightState(false, true);
    },
    
    /** Processes a mouse button release event on the button, displaying the button's normal appearance. */
    _processRelease: function(e) {
        if (!this.client) {
            return true;
        }
        this.setHighlightState(false, false);
    },
    
    /** Processes a mouse roll over event, displaying the button's rollover appearance. */
    _processRolloverEnter: function(e) {
        if (!this.client || !this.client.verifyInput(this.component) || Core.Web.dragInProgress) {
            return true;
        }
        this.client.application.addListener("focus", this._processRolloverExitRef);
        this.setHighlightState(true, false);
        return true;
    },
    
    /** Processes a mouse roll over exit event, displaying the button's normal appearance. */
    _processRolloverExit: function(e) {
        if (!this.client || !this.client.application) {
            return true;
        }
        if (this._processRolloverExitRef) {
            this.client.application.removeListener("focus", this._processRolloverExitRef);
        }
        this.setHighlightState(false, false);
        return true;
    },
    
    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this.enabled = this.component.isRenderEnabled();
        
        this.div = Echo.Sync.Button._prototypeButton.cloneNode(false); 
        this.div.id = this.component.renderId;

        Echo.Sync.LayoutDirection.render(this.component.getLayoutDirection(), this.div);
        if (this.enabled) {
            Echo.Sync.Color.renderFB(this.component, this.div);
            Echo.Sync.Border.render(this.component.render("border"), this.div);
            Echo.Sync.FillImage.render(this.component.render("backgroundImage"), this.div);
        } else {
            this.div.style.cursor = "auto";
            Echo.Sync.Color.render(Echo.Sync.getEffectProperty(this.component, "foreground", "disabledForeground", true), 
                    this.div, "color");
            Echo.Sync.Color.render(Echo.Sync.getEffectProperty(this.component, "background", "disabledBackground", true), 
                    this.div, "backgroundColor");
            Echo.Sync.Border.render(Echo.Sync.getEffectProperty(this.component, "border", "disabledBorder", true), 
                    this.div);
            Echo.Sync.FillImage.render(Echo.Sync.getEffectProperty(this.component, 
                    "backgroundImage", "disabledBackgroundImage", true), this.div);
        }
        
        Echo.Sync.Insets.render(this.component.render("insets"), this.div, "padding");
        Echo.Sync.Alignment.render(this.component.render("alignment"), this.div, true, this.component);
        
        var toolTipText = this.component.render("toolTipText");
        if (toolTipText) {
            this.div.title = toolTipText;
        }
        var width = this.component.render("width");
        if (width) {
            this.div.style.width = Echo.Sync.Extent.toCssValue(width, true, true);
        }
        var height = this.component.render("height");
        if (height) {
            this.div.style.height = Echo.Sync.Extent.toCssValue(height, false);
            this.div.style.overflow = "hidden";
        }
        
        this.renderContent();
        
        if (this.enabled) {
            // Add event listeners for focus and mouse rollover.  When invoked, these listeners will register the full gamut
            // of button event listeners.  There may be a large number of such listeners depending on how many effects
            // are enabled, and as such we do this lazily for performance reasons.
            Core.Web.Event.add(this.div, "focus", this._processInitEventRef, false);
            Core.Web.Event.add(this.div, "mouseover", this._processInitEventRef, false);
        }
        
        parentElement.appendChild(this.div);
    },
    
    /**
     * Renders the button text.  Configures text alignment, and font.
     * 
     * @param element the element which should contain the text.
     * @param text the text to render
     */
    renderButtonText: function(element, text) {
        this._textElement = element;
        var textAlignment = this.component.render("textAlignment"); 
        if (textAlignment) {
            Echo.Sync.Alignment.render(textAlignment, element, true, this.component);
        }
        if (this.enabled) {
            Echo.Sync.Font.render(this.component.render("font"), this._textElement);
        } else {
            Echo.Sync.Font.render(Echo.Sync.getEffectProperty(this.component, "font", "disabledFont", true), this._textElement);
        }
        
        element.appendChild(document.createTextNode(text));
        if (!this.component.render("lineWrap", true)) {
            element.style.whiteSpace = "nowrap";
        }
    },
    
    /** 
     * Renders the button icon.
     * 
     * @param elemnt the element which should contain the icon.
     * @param icon the icon property to render
     */
    renderButtonIcon: function(element, icon) {
        var alignment = this.component.render("alignment"); 
        if (alignment) {
            Echo.Sync.Alignment.render(alignment, element, true, this.component);
        }
        var imgElement = document.createElement("img");
        Echo.Sync.ImageReference.renderImg(icon, imgElement);
        element.appendChild(imgElement);
        return imgElement;
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        if (this._processRolloverExitRef) {
            this.client.application.removeListener("focus", this._processRolloverExitRef);
        }

        Core.Web.Event.removeAll(this.div);
        
        this._focused = false;
        this.div = null;
        this._textElement = null;
        this.iconImg = null;
    },

    /** @see Echo.Render.ComponentSync#renderFocus */
    renderFocus: function() {
        if (this._focused) {
            return;
        }

        Core.Web.DOM.focusElement(this.div);
        this._focused = true;
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        var element = this.div;
        var containerElement = element.parentNode;
        this.renderDispose(update);
        containerElement.removeChild(element);
        this.renderAdd(update, containerElement);
        return false; // Child elements not supported: safe to return false.
    }
});
/**
 * Component rendering peer: Composite.
 * This class should not be extended by developers, the implementation is subject to change.
 */
Echo.Sync.Composite = Core.extend(Echo.Render.ComponentSync, {

    $load: function() {
        Echo.Render.registerPeer("Composite", this);
    },

    div: null,
    contentDiv: null,
    
    $virtual: {
        
        /**
         * Renders style attributes on the created DIV.
         * Overridden by <code>Echo.Sync.Panel</code> to provide additional features.
         */
        renderStyle: function() {
            Echo.Sync.renderComponentDefaults(this.component, this.div);
        }
    },
    
    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this.div = this.contentDiv = document.createElement("div");
        this.div.id = this.component.renderId;
        
        if (this.component.children.length !== 0) {
            this.renderStyle();
            Echo.Render.renderComponentAdd(update, this.component.children[0], this.contentDiv);
        }
        
        parentElement.appendChild(this.div);
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        this.contentDiv = null;
        this.div = null;
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        var element = this.div;
        var containerElement = element.parentNode;
        Echo.Render.renderComponentDispose(update, update.parent);
        containerElement.removeChild(element);
        this.renderAdd(update, containerElement);
        return true;
    }
});

/**
 * Component rendering peer: Panel.
 */
Echo.Sync.Panel = Core.extend(Echo.Sync.Composite, {
    
    $load: function() {
        Echo.Render.registerPeer("Panel", this);
    },
    
    /** @see Echo.Render.ComponentSync#renderDisplay */
    renderDisplay: function() {
        if (this._imageBorder) {
            Echo.Sync.FillImageBorder.renderContainerDisplay(this.div);
        }
    },

    /** @see Echo.Sync.Composite#renderStyle */
    renderStyle: function() {
        this._imageBorder = this.component.render("imageBorder");
        
        var child = this.component.children.length !== 0 ? this.component.children[0] : null;
        var width = this.component.render("width");
        var height = this.component.render("height");
        if (Echo.Sync.Extent.isPercent(height)) {
            height = null;
        }
        if (child && child.pane) {
            this.div.style.position = "relative";
            if (!height) {
                height = "10em";
            }
        }
        
        if (width || height) {
            this.contentDiv.style.overflow = "hidden";
            if (height && this._imageBorder) {
                var insetsPx = Echo.Sync.Insets.toPixels(this._imageBorder.contentInsets);
                var contentHeight = Echo.Sync.Extent.toPixels(height) - insetsPx.top - insetsPx.bottom;
                if (!child || !child.pane) {
                    insetsPx = Echo.Sync.Insets.toPixels(this.component.render("insets"));
                    contentHeight -= insetsPx.top + insetsPx.bottom;
                }
                this.contentDiv.style.height = contentHeight + "px";
            }
        }
        
        if (this._imageBorder) {
            this.div = Echo.Sync.FillImageBorder.renderContainer(this._imageBorder, { child: this.contentDiv });
        } else {
            Echo.Sync.Border.render(this.component.render("border"), this.contentDiv);
        }
        Echo.Sync.renderComponentDefaults(this.component, this.contentDiv);
        if (!child || !child.pane) {
            Echo.Sync.Insets.render(this.component.render("insets"), this.contentDiv, "padding");
        }
        Echo.Sync.Alignment.render(this.component.render("alignment"), this.contentDiv, true, this.component);
        Echo.Sync.FillImage.render(this.component.render("backgroundImage"), this.contentDiv);
        Echo.Sync.Extent.render(width, this.div, "width", true, true);
        Echo.Sync.Extent.render(height, this.div, "height", false, false);
    }
});
/**
 * Component rendering peer: ContentPane.
 * This class should not be extended by developers, the implementation is subject to change.
 * 
 * <h3>Exit Animations</h3>
 * 
 * <p>Child component peers may implement a <code>renderContentPaneRemove()</code> method if they desire to run
 * an "exit" animation.  If this method is provided, it will be used to determine if the child desires to play an exit
 * animation and if so, allow the child to begin executing the animation when the child is to be removed.  
 * The method must take the following form:</p>
 * <p><code>renderContentPaneRemove(element, completionMethod)</code></p>
 * <p>The first parameter, <code>element</code>, provides the DOM <code>Element</code> containing the child component</p>
 * <p>The second parameter,<code>completionMethod</code> is a function which the animator should call once the animation 
 * completes</p>
 * <p>If the <code>renderContentPaneRemove()</code> implementation determines that it will play an animation, it should return 
 * <code>true</code> and invoke the <code>completionMethod</code> when the animation completes.</p>
 * <p>If the <code>renderContentPaneRemove()</code> implementation determines that it will NOT play an animation, it should return
 * <code>false</code> and it should <strong>not invoke</strong> the <code>completionMethod</code>.</p>
 */
Echo.Sync.ContentPane = Core.extend(Echo.Render.ComponentSync, {

    $load: function() {
        Echo.Render.registerPeer("ContentPane", this);
    },
    
    /** 
     * Array of child floating panes components, organized by z-index. 
     * @type Array
     */
    _floatingPaneStack: null,
    
    /** 
     * Flag indicating that the rendered z-indices are not synchronized with the order of <code>_floatingPaneStack</code>.
     * @type Boolean
     */
    _zIndexRenderRequired: false,

    /** Constructor. */
    $construct: function() {
        this._floatingPaneStack = [];
    },
    
    /**
     * Returns the measured size of the content pane element.  Child floating pane (e.g. WindowPane) peers may invoke this 
     * method to determine dimensions in which such panes can be placed/moved.
     * 
     * @return a bounds object describing the measured size
     * @type Core.Web.Measure.Bounds
     */
    getSize: function() {
        return new Core.Web.Measure.Bounds(this._div);
    },
    
    /**
     * Raises a floating pane child to the top.
     * 
     * @param {Echo.Component} the child component to raise
     */
    raise: function(child) {
        if (this._floatingPaneStack[this._floatingPaneStack.length - 1] == child) {
            // Already on top, do nothing.
            return;
        }
        Core.Arrays.remove(this._floatingPaneStack, child);
        this._floatingPaneStack.push(child);
        this._renderFloatingPaneZIndices();
        this._storeFloatingPaneZIndices();
    },
    
    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        var i;
        
        this._div = document.createElement("div");
        this._div.id = this.component.renderId;
        this._div.style.position = "absolute";
        this._div.style.width = "100%";
        this._div.style.height = "100%";
        this._div.style.overflow = "hidden";
        this._div.style.zIndex = "0";
        
        Echo.Sync.renderComponentDefaults(this.component, this._div);

        var background = this.component.render("background");
        var backgroundImage = this.component.render("backgroundImage");
        Echo.Sync.FillImage.render(backgroundImage, this._div);
        
        if (!background && !backgroundImage) {
            Echo.Sync.FillImage.render(this.client.getResourceUrl("Echo", "resource/Transparent.gif"), this._div);  
        }
    
        this._childIdToElementMap = {};
        
        var componentCount = this.component.getComponentCount();
        for (i = 0; i < componentCount; ++i) {
            var child = this.component.getComponent(i);
            this._renderAddChild(update, child);
        }
    
        // Store values of horizontal/vertical scroll such that 
        // renderDisplay() will adjust scrollbars appropriately after rendering.
        this._pendingScrollX = this.component.render("horizontalScroll");
        this._pendingScrollY = this.component.render("verticalScroll");
        
        parentElement.appendChild(this._div);

        if (this._zIndexRenderRequired) {
            this._renderFloatingPaneZIndices();
        }
    },

    /**
     * Renders the addition of a child component.
     * 
     * @param {Echo.Update.ComponentUpdate} the update
     * @param {Echo.Component} child the child component to add
     */
    _renderAddChild: function(update, child) {
        var childDiv = document.createElement("div");
        this._childIdToElementMap[child.renderId] = childDiv;
        childDiv.style.position = "absolute";
        if (child.floatingPane) {
            var zIndex = child.render("zIndex");
            if (zIndex != null) {
                var added = false;
                var i = 0;
                
                while (i < this._floatingPaneStack.length && !added) {
                    var testZIndex = this._floatingPaneStack[i].render("zIndex");
                    if (testZIndex != null && testZIndex > zIndex) {
                        this._floatingPaneStack.splice(i, 0, child);
                        added = true;
                    }
                    ++i;
                }
                if (!added) {
                    this._floatingPaneStack.push(child);
                }
            } else {
                this._floatingPaneStack.push(child);
            }
            childDiv.style.zIndex = "1";
            childDiv.style.left = childDiv.style.top = 0;
            this._zIndexRenderRequired = true;
        } else {
            var insets = this.component.render("insets", 0);
            var pixelInsets = Echo.Sync.Insets.toPixels(insets);
            childDiv.style.zIndex = "0";
            childDiv.style.left = pixelInsets.left + "px";
            childDiv.style.top = pixelInsets.top + "px";
            childDiv.style.bottom = pixelInsets.bottom + "px";
            childDiv.style.right = pixelInsets.right + "px";
            if (child.pane) {
                childDiv.style.overflow = "hidden";
            } else {
                switch (this.component.render("overflow")) {
                case Echo.ContentPane.OVERFLOW_HIDDEN:
                    childDiv.style.overflow = "hidden";
                    break;
                case Echo.ContentPane.OVERFLOW_SCROLL:
                    childDiv.style.overflow = "scroll";
                    break;
                default:
                    childDiv.style.overflow = "auto";
                    break;
                }
            }
        }
        Echo.Render.renderComponentAdd(update, child, childDiv);
        this._div.appendChild(childDiv);
    },
    
    /** @see Echo.Render.ComponentSync#renderDisplay */
    renderDisplay: function() {
        var child = this._div.firstChild;
        while (child) {
            Core.Web.VirtualPosition.redraw(child);
            child = child.nextSibling;
        }
    
        // If a scrollbar adjustment has been requested by renderAdd, perform it.
        if (this._pendingScrollX || this._pendingScrollY) {
            var componentCount = this.component.getComponentCount();
            for (var i = 0; i < componentCount; ++i) {
                child = this.component.getComponent(i);
                if (!child.floatingPane) {
                    var contentElement = this._childIdToElementMap[child.renderId];
                    var position, percent;

                    // Adjust horizontal scroll position, if required.
                    if (this._pendingScrollX) {
                        var x = Echo.Sync.Extent.toPixels(this._pendingScrollX);
                        if (Echo.Sync.Extent.isPercent(this._pendingScrollX) || x < 0) {
                            percent = x < 0 ? 100 : parseInt(this._pendingScrollX, 10);
                            position = Math.round((contentElement.scrollWidth - contentElement.offsetWidth) * percent / 100);
                            if (position > 0) {
                                contentElement.scrollLeft = position;
                                if (Core.Web.Env.ENGINE_MSHTML) {
                                    // IE needs to be told twice.
                                    position = Math.round((contentElement.scrollWidth - contentElement.offsetWidth) * 
                                            percent / 100);
                                    contentElement.scrollLeft = position;
                                }
                            }
                        } else {
                            contentElement.scrollLeft = x;
                        }
                        this._pendingScrollX = null;
                    }

                    // Adjust vertical scroll position, if required.
                    if (this._pendingScrollY) {
                        var y = Echo.Sync.Extent.toPixels(this._pendingScrollY);
                        if (Echo.Sync.Extent.isPercent(this._pendingScrollY) || y < 0) {
                            percent = y < 0 ? 100 : parseInt(this._pendingScrollY, 10);
                            position = Math.round((contentElement.scrollHeight - contentElement.offsetHeight) * percent / 100);
                            if (position > 0) {
                                contentElement.scrollTop = position;
                                if (Core.Web.Env.ENGINE_MSHTML) {
                                    // IE needs to be told twice.
                                    position = Math.round((contentElement.scrollHeight - contentElement.offsetHeight) *
                                            percent / 100);
                                    contentElement.scrollTop = position;
                                }
                            }
                        } else {
                            contentElement.scrollTop = y;
                        }
                        this._pendingScrollY = null;
                    }
                    break;
                }
            }
        }
    },

    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        this._childIdToElementMap = null;
        this._div = null;
    },
    
    /** 
     * Updates the rendered CSS z-index attribute of all floating panes based on their positions in 
     * <code>_floatingPaneStack.</code>. 
     */ 
    _renderFloatingPaneZIndices: function() {
        for (var i = 0; i < this._floatingPaneStack.length; ++i) {
            var childElement = this._childIdToElementMap[this._floatingPaneStack[i].renderId];
            childElement.style.zIndex = 2 + i;
        }
        this._zIndexRenderRequired = false;
    },

    /**
     * Renders the removal of a child component.
     * 
     * @param {Echo.Update.ComponentUpdate} the update
     * @param {Echo.Component} child the child component to remove
     */
    _renderRemoveChild: function(update, child) {
        if (child.floatingPane) {
            Core.Arrays.remove(this._floatingPaneStack, child);
        }
        
        var childDiv = this._childIdToElementMap[child.renderId];
        if (!childDiv) {
            // Child never rendered.
            return;
        }

        // Determine if child component would like to render removal effect (e.g., WindowPane fade).
        // If so, inform child to start effect, provide copmletion callback to perform removal operations.
        var selfRemove = false;
        if (child.peer.renderContentPaneRemove) {
            selfRemove = child.peer.renderContentPaneRemove(this._childIdToElementMap[child.renderId], 
                    Core.method(this, function() {
                        childDiv.parentNode.removeChild(childDiv);
                    })
            );
        }
        
        if (!selfRemove) {
            // Child will not render removal effect, remove immediately.
            childDiv.parentNode.removeChild(childDiv);
        }
        
        delete this._childIdToElementMap[child.renderId];
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        var i, fullRender = false;
        if (update.hasUpdatedProperties() || update.hasUpdatedLayoutDataChildren()) {
            // Full render
            fullRender = true;
        } else {
            var removedChildren = update.getRemovedChildren();
            if (removedChildren) {
                // Remove children.
                for (i = 0; i < removedChildren.length; ++i) {
                    this._renderRemoveChild(update, removedChildren[i]);
                }
            }
            var addedChildren = update.getAddedChildren();

            update.renderContext.displayRequired = [];
            
            if (addedChildren) {
                // Add children.
                for (i = 0; i < addedChildren.length; ++i) {
                    if (!addedChildren[i].floatingPane) {
                        // Content updated: renderDisplay() invocation required on ContentPane itself.
                        update.renderContext.displayRequired = null;
                    }
                    this._renderAddChild(update, addedChildren[i], this.component.indexOf(addedChildren[i]));
                    if (update.renderContext.displayRequired) {
                        // If only floating panes are being updated, invoke renderDisplay() only on children.
                        update.renderContext.displayRequired.push(addedChildren[i]); 
                    }
                }

                if (this._zIndexRenderRequired) {
                    this._renderFloatingPaneZIndices();
                }
            }
        }
        if (fullRender) {
            this._floatingPaneStack = [];
            var element = this._div;
            var containerElement = element.parentNode;
            Echo.Render.renderComponentDispose(update, update.parent);
            containerElement.removeChild(element);
            this.renderAdd(update, containerElement);
        }
        
        return fullRender;
    },
    
    /** Sets "zIndex" property on all child components based on their positions within the <code>_floatingPaneStack</code>. */
    _storeFloatingPaneZIndices: function() {
        for (var i = 0; i < this._floatingPaneStack.length; ++i) {
            this._floatingPaneStack[i].set("zIndex", i);
        }
    }
});
/**
 * Component rendering peer: Grid.
 * This class should not be extended by developers, the implementation is subject to change.
 */
Echo.Sync.Grid = Core.extend(Echo.Render.ComponentSync, {

    $static: {

        /**
         * Creates a prototype rendering of the basic DOM structure of a Grid which may be cloned
         * for enhanced rendering performance.
         * 
         * @return the prototype DOM hierarchy
         * @type Element
         */
        _createPrototypeTable: function() {
            var div = document.createElement("div");
            
            var table = document.createElement("table");
            table.style.outlineStyle = "none";
            table.tabIndex = "-1";
            table.style.borderCollapse = "collapse";
            
            var colGroup = document.createElement("colgroup");
            table.appendChild(colGroup);
        
            table.appendChild(document.createElement("tbody"));
            
            div.appendChild(table);
            
            return div;
        },
        
        /**
         * Performs processing on layout of grid, determining rendered cell sizes, and
         * eliminating conflicting row/column spans.
         * 
         * This object describes coordinates in terms of x and y, rather than column/row.
         * The translation between x/y and column/row varies based on the grid's orientation.
         * For horizontally oriented grids, the x-axis represents columns and the y-axis rows.
         * For vertically oriented grids, the x-axis represents rows and the y-axis columns.
         */
        Processor: Core.extend({
        
            $static: {
            
                /**
                 * Representation of a single cell of the grid.
                 */
                Cell: Core.extend({
                    
                    /** 
                     * The number of cells spanned in the x direction
                     * @type Number
                     */
                    xSpan: null,
                    
                    /** 
                     * The number of cells spanned in the y direction. 
                     * @type Number
                     */
                    ySpan: null,
                    
                    /** 
                     * The index of the child component within the Grid parent. 
                     * @type Number
                     */
                    index: null,
                    
                    /** 
                     * The child component.
                     * @type Echo.Component 
                     */
                    component: null,
                    
                    /**
                     * Creates a new cell.
                     * 
                     * @param {Echo.Component} component the component
                     * @param {Number} index the index of the component within the Grid parent
                     * @param {Number} xSpan the number of cells spanned in the x direction
                     * @param {Number} ySpan the number of cells spanned in the y direction
                     */
                    $construct: function(component, index, xSpan, ySpan) {
                        this.component = component;
                        this.index = index;
                        this.xSpan = xSpan;
                        this.ySpan = ySpan;
                    }
                })
            },
            
            /**
             * Two dimensional array which contains <code>Cell</code>s.
             * Each index of this array contains an array which represents a y-index of the grid.
             * Each index in a contained arrays represents a cell of the grid.
             * @type Array
             */
            cellArrays: null,
            
            /**
             * The Grid being rendered.
             * @type Echo.Grid
             */
            grid: null,
            
            /** 
             * The size of the grid's x-axis.
             * @type Number
             */ 
            gridXSize: null,
            
            /** 
             * The size of the grid's x-axis.
             * @type Number
             */ 
            gridYSize: null,
            
            /**
             * Array of extents representing cell sizes on x-axis.
             * @type Array
             */
            xExtents: null,
            
            /**
             * Array of extents representing cell sizes on y-axis.
             * @type Array
             */
            yExtents: null,
            
            /**
             * Flag indicating whether the grid is horizontally oriented.
             * @type Boolean
             */
            horizontalOrientation: null,
            
            /**
             * Creates a new Processor instance.
             * 
             * @param {Echo.Grid} grid the supported grid
             */
            $construct: function(grid) {
                this.grid = grid;
                this.cellArrays = [];
                this.horizontalOrientation = grid.render("orientation") != Echo.Grid.ORIENTATION_VERTICAL;
                
                var cells = this.createCells();
                if (cells == null) {
                    // Special case: empty Grid.
                    this.gridXSize = 0;
                    this.gridYSize = 0;
                    return;
                }
            
                
                this.renderCellMatrix(cells);
                
                this.calculateExtents();
                
                this.reduceY();
                this.reduceX();
            },
            
            /**
             * Adds two extents.
             * 
             * @param {#Extent} a the first extent
             * @param {#Extent} b the second extent
             * @param {Boolean} flag indicating whether extents are horizontal
             * @return the sum of the extents
             * @type #Extent
             */
            addExtents: function(a, b, horizontal) {
                var ap = Echo.Sync.Extent.isPercent(a), bp = Echo.Sync.Extent.isPercent(b);
                if (ap || bp) {
                    if (ap && bp) {
                        // Both are percents, add them.
                        return (parseFloat(a) + parseFloat(b)) + "%";
                    } else {
                        // One extent is percent, the other is not: return the percent extent.
                        return ap ? a : b;
                    }
                } else {
                    return Echo.Sync.Extent.toPixels(a) + Echo.Sync.Extent.toPixels(b);
                }
            },
            
            /**
             * Calculates sizes of columns and rows.
             */
            calculateExtents: function() {
                var i,
                    xProperty = this.horizontalOrientation ? "columnWidth" : "rowHeight",
                    yProperty = this.horizontalOrientation ? "rowHeight" : "columnWidth";
                
                this.xExtents = [];
                for (i = 0; i < this.gridXSize; ++i) {
                    this.xExtents.push(this.grid.renderIndex(xProperty, i));
                }
            
                this.yExtents = [];
                for (i = 0; i < this.gridYSize; ++i) {
                    this.yExtents.push(this.grid.renderIndex(yProperty, i));
                }
            },
            
            /**
             * Creates array of <code>Cell</code> instances representing child components of the grid.
             * 
             * @return the array of <code>Cell</code> instances
             * @type Array
             */
            createCells: function() {
                var childCount = this.grid.getComponentCount();
                if (childCount === 0) {
                    // Abort if Grid is empty.
                    return null;
                }
                
                var cells = [];
                for (var i = 0; i < childCount; ++i) {
                    var child = this.grid.getComponent(i);
                    var layoutData = child.render("layoutData");
                    if (layoutData) {
                        var xSpan = this.horizontalOrientation ? layoutData.columnSpan : layoutData.rowSpan; 
                        var ySpan = this.horizontalOrientation ? layoutData.rowSpan : layoutData.columnSpan; 
                        cells.push(new Echo.Sync.Grid.Processor.Cell(child, i, xSpan ? xSpan : 1, ySpan ? ySpan : 1));
                    } else {
                        cells.push(new Echo.Sync.Grid.Processor.Cell(child, i, 1, 1));
                    }
                }
                return cells;
            },
            
            /**
             * Returns an array representing the cells at the specified y-index.
             * If no array currently exists, one is created.
             * 
             * @param {Integer} y the y-index
             * @return the array of cells.
             * @type Array
             */
            _getCellArray: function(y) {
                while (y >= this.cellArrays.length) {
                    this.cellArrays.push([]);
                }
                return this.cellArrays[y]; 
            },
            
            /**
             * Returns the number of columns that should be rendered.
             * 
             * @return the number of rendered columns
             * @type Integer
             */
            getColumnCount: function() {
                return this.horizontalOrientation ? this.gridXSize : this.gridYSize;
            },
            
            /**
             * Returns the cell that should be rendered at the
             * specified position.
             * 
             * @param {Integer} column the column index
             * @param {Integer} row the row index
             * @return the cell
             * @type Echo.Sync.Grid.Processor.Cell
             */
            getCell: function(column, row) {
                if (this.horizontalOrientation) {
                    return this.cellArrays[row][column];
                } else {
                    return this.cellArrays[column][row];
                }
            },
            
            /**
             * Returns the number of rows that should be rendered.
             * 
             * @return the number of rendered rows
             * @type Integer
             */
            getRowCount: function() {
                return this.horizontalOrientation ? this.gridYSize : this.gridXSize;
            },
            
            /**
             * Remove duplicates from the x-axis where all cells simply
             * "span over" a given x-axis coordinate. 
             */
            reduceX: function() {
                // Determine duplicate cell sets on x-axis.
                var xRemoves = [], 
                    x = 1, 
                    y, 
                    length = this.cellArrays[0].length;
                while (x < length) {
                    y = 0;
                    var identical = true;
                    while (y < this.cellArrays.length) {
                        if (this.cellArrays[y][x] != this.cellArrays[y][x - 1]) {
                            identical = false;
                            break;
                        }
                        ++y;
                    }
                    if (identical) {
                        xRemoves[x] = true;
                    }
                    ++x;
                }
                
                // If no reductions are necessary on the x-axis, do nothing.
                if (xRemoves.length === 0) {
                    return;
                }
                
                for (var removedX = this.gridXSize - 1; removedX >= 1; --removedX) {
                    if (!xRemoves[removedX]) {
                        continue;
                    }
                    
                    for (y = 0; y < this.gridYSize; ++y) {
                        if (y === 0 || this.cellArrays[y][removedX - 1] != this.cellArrays[y - 1][removedX - 1]) {
                            // Reduce x-span, taking care not to reduce it multiple times if cell has a y-span.
                            if (this.cellArrays[y][removedX - 1] != null) {
                                --this.cellArrays[y][removedX - 1].xSpan;
                            }
                        }
                        this.cellArrays[y].splice(removedX, 1);
                    }
                    
                    var removedXExtent = this.xExtents.splice(removedX, 1)[0];

                    if (removedXExtent) {
                        this.xExtents[removedX - 1] = this.addExtents(this.xExtents[removedX - 1], removedXExtent,
                                this.horizontalOrientation ? true : false);
                    }
                    
                    --this.gridXSize;
                }
            },
            
            /**
             * Remove duplicates from the y-axis where all cells simply
             * "span over" a given y-axis coordinate. 
             */
            reduceY: function() {
                var yRemoves = [],
                    y = 1,
                    x,
                    size = this.cellArrays.length,
                    previousCellArray,
                    currentCellArray = this.cellArrays[0];
                
                while (y < size) {
                    previousCellArray = currentCellArray;
                    currentCellArray = this.cellArrays[y];
                    
                    x = 0;
                    var identical = true;
                    
                    while (x < currentCellArray.length) {
                        if (currentCellArray[x] != previousCellArray[x]) {
                            identical = false;
                            break;
                        }
                        ++x;
                    }
                    if (identical) {
                        yRemoves[y] = true;
                    }
                    
                    ++y;
                }
                
                // If no reductions are necessary on the y-axis, do nothing.
                if (yRemoves.length === 0) {
                    return;
                }
                
                for (var removedY = this.gridYSize - 1; removedY >= 0; --removedY) {
                    if (!yRemoves[removedY]) {
                        continue;
                    }
                    
                    // Shorten the y-spans of the cell array that will be retained to 
                    // reflect the fact that a cell array is being removed.
                    var retainedCellArray = this.cellArrays[removedY - 1];
                    for (x = 0; x < this.gridXSize; ++x) {
                        if (x === 0 || retainedCellArray[x] != retainedCellArray[x - 1]) {
                            // Reduce y-span, taking care not to reduce it multiple times if cell has an x-span.
                            if (retainedCellArray[x] != null) {
                                --retainedCellArray[x].ySpan;
                            }
                        }
                    }
                    
                    // Remove the duplicate cell array.
                    this.cellArrays.splice(removedY, 1);
                    
                    // Remove size data for removed row, add value to previous if necessary.
                    var removedYExtent = this.yExtents.splice(removedY, 1)[0];
                    if (removedYExtent) {
                        this.yExtents[removedY - 1] = this.addExtents(this.yExtents[removedY - 1], removedYExtent,
                                this.horizontalOrientation ? false : true);
                    }
                    
                    // Decrement the grid size to reflect cell array removal.
                    --this.gridYSize;
                }
            },
            
            /**
             * Iterates over cells to create the cell matrix, adjusting column and row spans as of cells to ensure
             * that no overlap occurs between column and row spans.
             * Additionally determines actual y-size of grid.   
             * 
             * @param {Array} cells array of <code>Echo.Sync.Grid.Processor.Cell</code> instances 
             */
            renderCellMatrix: function(cells) {
                this.gridXSize = parseInt(this.grid.render("size", 2), 10);
                var x = 0, 
                    y = 0,
                    xIndex,
                    yIndex,
                    yCells = this._getCellArray(y);
                
                for (var componentIndex = 0; componentIndex < cells.length; ++componentIndex) {
                    
                    // Set x-span to fill remaining size in the event SPAN_FILL has been specified or if the cell would
                    // otherwise extend past the specified size.
                    if (cells[componentIndex].xSpan == Echo.Grid.SPAN_FILL || cells[componentIndex].xSpan > this.gridXSize - x) {
                        cells[componentIndex].xSpan = this.gridXSize - x;
                    }
                    
                    // Set x-span of any cell INCORRECTLY set to negative value to 1 (note that SPAN_FILL has already been handled).
                    if (cells[componentIndex].xSpan < 1) {
                        cells[componentIndex].xSpan = 1;
                    }
                    // Set y-span of any cell INCORRECTLY set to negative value (or more likely SPAN_FILL) to 1.
                    if (cells[componentIndex].ySpan < 1) {
                        cells[componentIndex].ySpan = 1;
                    }
                    
                    if (cells[componentIndex].xSpan != 1 || cells[componentIndex].ySpan != 1) {
                        // Scan to ensure no y-spans are blocking this x-span.
                        // If a y-span is blocking, shorten the x-span to not
                        // interfere.
                        for (xIndex = 1; xIndex < cells[componentIndex].xSpan; ++xIndex) {
                            if (yCells[x + xIndex] != null) {
                                // Blocking component found.
                                cells[componentIndex].xSpan = xIndex;
                                break;
                            }
                        }
                        for (yIndex = 0; yIndex < cells[componentIndex].ySpan; ++yIndex) {
                            var yIndexCells = this._getCellArray(y + yIndex);
                            for (xIndex = 0; xIndex < cells[componentIndex].xSpan; ++xIndex) {
                                yIndexCells[x + xIndex] = cells[componentIndex];
                            }
                        }
                    }
                    yCells[x] = cells[componentIndex];
            
                    if (componentIndex < cells.length - 1) {
                        // Move rendering cursor.
                        var nextRenderPointFound = false;
                        while (!nextRenderPointFound) {
                            if (x < this.gridXSize - 1) {
                                ++x;
                            } else {
                                // Move cursor to next line.
                                x = 0;
                                ++y;
                                yCells = this._getCellArray(y);
                                
                            }
                            nextRenderPointFound = yCells[x] == null;
                        }
                    }
                }
            
                // Store actual 'y' dimension.
                this.gridYSize = this.cellArrays.length;
            }
        })
    },
    
    $load: function() {
        this._prototypeTable = this._createPrototypeTable();
        Echo.Render.registerPeer("Grid", this);
    },
    
    /**
     * The number of columns.
     * @type Number
     */
    _columnCount: null,
    
    /**
     * The number of rows.
     * @type Number
     */
    _rowCount: null,
    
    /**
     * Processes a key press event (for focus navigation amongst child cells.
     */
    clientKeyDown: function(e) { 
        var focusPrevious,
            focusedComponent,
            focusFlags,
            focusChild;
        switch (e.keyCode) {
        case 37:
        case 39:
            focusPrevious = this.component.getRenderLayoutDirection().isLeftToRight() ? e.keyCode == 37 : e.keyCode == 39;
            focusedComponent = this.client.application.getFocusedComponent();
            if (focusedComponent && focusedComponent.peer && focusedComponent.peer.getFocusFlags) {
                focusFlags = focusedComponent.peer.getFocusFlags();
                if ((focusPrevious && focusFlags & Echo.Render.ComponentSync.FOCUS_PERMIT_ARROW_LEFT) ||
                        (!focusPrevious && focusFlags & Echo.Render.ComponentSync.FOCUS_PERMIT_ARROW_RIGHT)) {
                    focusChild = this.client.application.focusManager.findInParent(this.component, focusPrevious);
                    if (focusChild) {
                        this.client.application.setFocusedComponent(focusChild);
                        Core.Web.DOM.preventEventDefault(e.domEvent);
                        return false;
                    }
                }
            }
            break;
        case 38:
        case 40:
            focusPrevious = e.keyCode == 38;
            focusedComponent = this.client.application.getFocusedComponent();
            if (focusedComponent && focusedComponent.peer && focusedComponent.peer.getFocusFlags) {
                focusFlags = focusedComponent.peer.getFocusFlags();
                if ((focusPrevious && focusFlags & Echo.Render.ComponentSync.FOCUS_PERMIT_ARROW_UP) ||
                        (!focusPrevious && focusFlags & Echo.Render.ComponentSync.FOCUS_PERMIT_ARROW_DOWN)) {
                    focusChild = this.client.application.focusManager.findInParent(this.component, focusPrevious,
                            this._columnCount);
                    if (focusChild) {
                        this.client.application.setFocusedComponent(focusChild);
                        Core.Web.DOM.preventEventDefault(e.domEvent);
                        return false;
                    }
                }
            }
            break;
        }
        return true;
    },

    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        var gridProcessor = new Echo.Sync.Grid.Processor(this.component),
            defaultInsets = Echo.Sync.Insets.toCssValue(this.component.render("insets", 0)),
            defaultPixelInsets,
            defaultBorder = this.component.render("border", ""),
            width = this.component.render("width"),
            height = this.component.render("height"),
            td,
            columnIndex;
        defaultPixelInsets = Echo.Sync.Insets.toPixels(defaultInsets);
        
        this._columnCount = gridProcessor.getColumnCount();
        this._rowCount = gridProcessor.getRowCount();
        
        this._div = Echo.Sync.Grid._prototypeTable.cloneNode(true);
        this._div.id = this.component.renderId;
        
        var table = this._div.firstChild;
        
        Echo.Sync.renderComponentDefaults(this.component, table);
        Echo.Sync.Border.render(defaultBorder, table);
        table.style.padding = defaultInsets; 
        
        // Render percent widths using measuring for IE to avoid potential horizontal scrollbars.
        if (width && Core.Web.Env.QUIRK_IE_TABLE_PERCENT_WIDTH_SCROLLBAR_ERROR && Echo.Sync.Extent.isPercent(width)) {
            this._div.style.zoom = 1;
        }
        
        // Set overall width/height.
        if (width) {
            if (Echo.Sync.Extent.isPercent(width)) {
                table.style.width = width;
            } else {
                table.style.width = Echo.Sync.Extent.toCssValue(width, true);
            }
        }
        if (height) {
            if (Echo.Sync.Extent.isPercent(height)) {
                table.style.height = height;
            } else {
                table.style.height = Echo.Sync.Extent.toCssValue(height, false);
            }
        }

        // Render column widths into colgroup element.
        var colGroup = table.firstChild;
        for (columnIndex = 0; columnIndex < this._columnCount; ++columnIndex) {
            var col = document.createElement("col");
            width = gridProcessor.xExtents[columnIndex];
            if (width != null) {
                if (Echo.Sync.Extent.isPercent(width)) {
                    col.style.width = width.toString();
                } else {
                    var widthValue = Echo.Sync.Extent.toPixels(width, true);
                    if (Core.Web.Env.QUIRK_TABLE_CELL_WIDTH_EXCLUDES_PADDING) {
                        widthValue -= defaultPixelInsets.left + defaultPixelInsets.right;
                        if (widthValue < 0) {
                            widthValue = 0;
                        }
                    }
                    col.style.width = widthValue + "px";
                }
            }
            colGroup.appendChild(col);
        }
        
        var tbody = colGroup.nextSibling;
        
        var size = parseInt(this.component.render("size", 2), 10);
        
        var tr;
        var renderedComponentIds = {};
        
        var xSpan, ySpan;
        if (gridProcessor.horizontalOrientation) {
            xSpan = "colSpan";
            ySpan = "rowSpan"; 
        } else {
            xSpan = "rowSpan";
            ySpan = "colSpan"; 
        }
        
        var tdPrototype = document.createElement("td");
        Echo.Sync.Border.render(defaultBorder, tdPrototype);
        tdPrototype.style.padding = defaultInsets;
        
        // Render grid layout.
        for (var rowIndex = 0; rowIndex < this._rowCount; ++rowIndex) {
            tr = document.createElement("tr");
            height = gridProcessor.yExtents[rowIndex];
            if (height) {
                tr.style.height = Echo.Sync.Extent.toCssValue(height, false);
            }
            tbody.appendChild(tr);
            
            for (columnIndex = 0; columnIndex < this._columnCount; ++columnIndex) {
                var cell = gridProcessor.getCell(columnIndex, rowIndex);
                if (cell == null) {
                    td = document.createElement("td");
                    tr.appendChild(td);
                    continue;
                }
                if (renderedComponentIds[cell.component.renderId]) {
                    // Cell already rendered.
                    continue;
                }
                renderedComponentIds[cell.component.renderId] = true;
                
                td = tdPrototype.cloneNode(false);
                
                if (cell.xSpan > 1) {
                    td.setAttribute(xSpan, cell.xSpan);
                }
                if (cell.ySpan > 1) {
                    td.setAttribute(ySpan, cell.ySpan);
                }
                
                var layoutData = cell.component.render("layoutData");
                if (layoutData) {
                    var columnWidth = gridProcessor.xExtents[columnIndex];
                    if (Core.Web.Env.QUIRK_TABLE_CELL_WIDTH_EXCLUDES_PADDING && columnWidth && 
                            !Echo.Sync.Extent.isPercent(columnWidth)) { 
                        var cellInsets = Echo.Sync.Insets.toPixels(layoutData.insets);
                        if (defaultPixelInsets.left + defaultPixelInsets.right < cellInsets.left + cellInsets.right) {
                            td.style.width = (Echo.Sync.Extent.toPixels(columnWidth) - 
                                    (cellInsets.left + cellInsets.right)) + "px";
                        }
                    }
                    Echo.Sync.Insets.render(layoutData.insets, td, "padding");
                    Echo.Sync.Alignment.render(layoutData.alignment, td, true, this.component);
                    Echo.Sync.FillImage.render(layoutData.backgroundImage, td);
                    Echo.Sync.Color.render(layoutData.background, td, "backgroundColor");
                }
                
                Echo.Render.renderComponentAdd(update, cell.component, td);
    
                tr.appendChild(td);
            }
        }
        
        parentElement.appendChild(this._div);
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        this._div = null;
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        var element = this._div;
        var containerElement = element.parentNode;
        Echo.Render.renderComponentDispose(update, update.parent);
        containerElement.removeChild(element);
        this.renderAdd(update, containerElement);
        return true;
    }
});
/**
 * Component rendering peer: Label.
 * This class should not be extended by developers, the implementation is subject to change.
 */
Echo.Sync.Label = Core.extend(Echo.Render.ComponentSync, { 

    $static: {
    
       /** 
        * Default spacing between label icon/text. 
        * @type #Extent
        */
       _defaultIconTextMargin: 5
    },
    
    $load: function() {
        Echo.Render.registerPeer("Label", this);
    },
    
    /**
     * The text node or element representing the label.
     * @type Node
     */
    _node: null,
    
    /**
     * Formats the whitespace in the given text for use in HTML.
     * 
     * @param text {String} the text to format
     * @param parentElement the element to append the text to
     */
    _formatWhitespace: function(text, parentElement) {
        // switch between spaces and non-breaking spaces to preserve line wrapping
        text = text.replace(/\t/g, " \u00a0 \u00a0");
        text = text.replace(/ {2}/g, " \u00a0");
        var lines = text.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (i > 0) {
                parentElement.appendChild(document.createElement("br"));
            }
            if (line.length > 0) {
                parentElement.appendChild(document.createTextNode(line));
            }
        }
    },
    
    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this._containerElement = parentElement;
        var icon = this.component.render("icon"),
            text = this.component.render("text"),
            foreground = this.component.render("foreground"),
            background = this.component.render("background"),
            toolTip = this.component.render("toolTipText"),
            img;
    
        if (text != null) {
            var lineWrap = this.component.render("lineWrap", true);
            var formatWhitespace = this.component.render("formatWhitespace", false) &&
                    (text.indexOf(' ') != -1 || text.indexOf('\n') != -1 || text.indexOf('\t') != -1);
            
            if (icon) {
                // Text and icon.
                var iconTextMargin = this.component.render("iconTextMargin", 
                        Echo.Sync.Label._defaultIconTextMargin);
                var orientation = Echo.Sync.TriCellTable.getOrientation(this.component, "textPosition");
                var tct = new Echo.Sync.TriCellTable(orientation, Echo.Sync.Extent.toPixels(iconTextMargin));
                img = document.createElement("img");
                Echo.Sync.ImageReference.renderImg(icon, img);
                if (formatWhitespace) {
                    this._formatWhitespace(text, tct.tdElements[0]);
                } else {
                    tct.tdElements[0].appendChild(document.createTextNode(text));
                }
                if (!lineWrap) {
                    tct.tdElements[0].style.whiteSpace = "nowrap";
                }
                tct.tdElements[1].appendChild(img);
                this._node = tct.tableElement;
                this._node.id = this.component.renderId;
                Echo.Sync.renderComponentDefaults(this.component, this._node);
            } else {
                // Text without icon.
                var font = this.component.render("font");
                if (!this.client.designMode && !toolTip && !font && lineWrap && !foreground && !background && 
                        !formatWhitespace && !this.component.getLayoutDirection()) {
                    this._node = document.createTextNode(text);
                } else {
                    this._node = document.createElement("span");
                    this._node.id = this.component.renderId;
                    if (formatWhitespace) {
                        this._formatWhitespace(text, this._node);
                    } else {
                        this._node.appendChild(document.createTextNode(text));
                    }
                    if (!lineWrap) {
                        this._node.style.whiteSpace = "nowrap";
                    }
                    Echo.Sync.renderComponentDefaults(this.component, this._node);
                }
            }
        } else if (icon) {
            img = document.createElement("img");
            Echo.Sync.ImageReference.renderImg(icon, img);
            this._node = document.createElement("span");
            this._node.id = this.component.renderId;
            this._node.appendChild(img);
            Echo.Sync.Color.render(this.component.render("background"), this._node, "backgroundColor");
        } else {
            // Neither icon nor text, render blank.
            if (this.client.designMode) {
                this._node = document.createElement("span");
                this._node.id = this.component.renderId;
            } else {
                this._node = null;
            }
        }
    
        if (this._node) {
            if (toolTip) {
                this._node.title = toolTip;
            }
            parentElement.appendChild(this._node);
        }
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        this._containerElement = null;
        this._node = null;
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        if (this._node) {
            this._node.parentNode.removeChild(this._node);
        }
        // Note: this.renderDispose() is not invoked (it does nothing).
        this.renderAdd(update, this._containerElement);
        return false; // Child elements not supported: safe to return false.
    }
});
/**
 * Abstract base class for rendering SELECT-element based list components.
 * This class should not be extended by developers, the implementation is subject to change.
 */
Echo.Sync.ListComponent = Core.extend(Echo.Render.ComponentSync, {

    $static: {
    
        /** 
         * Alternate rendering: default border style.
         * @type #Border
         */
        DEFAULT_DIV_BORDER: "1px solid #7f7f7f",
        
        /** 
         * Alternate rendering: default selected item background.
         * @type #Color
         */
        DEFAULT_SELECTED_BACKGROUND: "#0a246a",
        
        /** 
         * Alternate rendering: default selected item foreground.
         * @type #Color
         */
        DEFAULT_SELECTED_FOREGROUND: "#ffffff"
    },

    $abstract: {
        
        /**
         * Flag indicating whether the component should be rendered as a list box (true) or select field (false).
         * @type Boolean
         */
        listBox: null
    },
    
    /**
     * Flag indicating that one or more of the items in the list component has been rendered with a selected appearance.
     * @type Boolean
     */
    _hasRenderedSelectedItems: false,
    
    /**
     * Flag indicating whether multiple selection is allowed (for listboxes).
     * @type Boolean
     */
    _multipleSelect: false,
    
    /**
     * Flag indicating that selection should be determined based on "selectedId"
     * property rather than "selection" property.  This flag is enabled when
     * "selectedId" is updated and disabled when an item is selected by the user.
     * @type Boolean
     */
    _selectedIdPriority: false,

    /**
     * Flag indicating that component will be rendered as a DHTML-based ListBox.
     * This form of rendering is necessary on Internet Explorer 6 browsers due to unstable
     * code in this web browser when using listbox-style SELECT elements.
     * @type Boolean
     */
    _alternateRender: false,
    
    /**
     * The "main" element upon which contains items and upon which listeners are registered.  
     * For normal rendering, this is the SELECT, which directly contains individual OPTION elements.
     * For the alternate rendering, this is the TABLE, whose TBODY element contains individual
     * TR elements that represent options.
     * @type Element
     */
    _element: null,
    
    /**
     * Rendered DIV element when alternate listbox rendering is enabled.
     * Null if list is rendered as a SELECT element.
     * @type Element.
     */
    _div: null,
    
    /**
     * Rendered focus state of component, based on received DOM focus/blur events.
     * @type Boolean
     */
    _focused: false,
    
    /**
     * Determines current selection state.
     * By default, the value of the "selection" property of the component is returned.
     * If the _selectedIdPriorirty flag is set, or if the "selection" property has no value,
     * then selection is determined based on the "selectedId" property of the component.
     * 
     * @return the selection, either an integer index or array of indices
     */
    _getSelection: function() {
        // Retrieve selection from "selection" property.
        var selection = this._selectedIdPriority ? null : this.component.get("selection");
        
        if (selection == null) {
            // If selection is now in "selection" property, query "selectedId" property.
            var selectedId = this.component.get("selectedId");

            if (selectedId) {
                // If selectedId property is set, find item with corresponding id.
                var items = this.component.get("items");

                for (var i = 0; i < items.length; ++i) {
                    if (items[i].id == selectedId) {
                        selection = i;
                        break;
                    }
                }
            }
            
            // If selection is null (selectedId not set, or corresponding item not found),
            // set selection to null/default value.
            if (selection == null) {
                selection = this.listBox ? [] : 0;
            }
        }
        
        return selection;
    },
    
    /** Processes a focus blur event */
    _processBlur: function(e) {
        this._focused = false;
    },
    
    /**
     * Processes a click event.
     * This event handler is registered only in the case of the "alternate" DHTML-based rendered
     * listbox for IE6, i.e., the _alternateRender flag will be true. 
     */
    _processClick: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            Core.Web.DOM.preventEventDefault(e);
            this._renderSelection();
            return true;
        }
        
        var child = this._div.firstChild;
        var i = 0;
        while (child) {
            if (child == e.target) {
                break;
            }
            child = child.nextSibling;
            ++i;
        }
        if (child == null) {
            return;
        }
        
        if (this._multipleSelect && e.ctrlKey) {
            // Multiple selection and user has pressed ctrl key to select multiple items.
            var selection = this._getSelection();
            if (selection == null) {
                selection = [];
            } else if (!(selection instanceof Array)) {
                selection = [selection];
            } else {
                // Clone array (required to ensure oldValue != newValue on property set).
                selection = selection.slice();
            }
            var arrayIndex = Core.Arrays.indexOf(selection, i); 
            if (arrayIndex == -1) {
                // Add item to selection if not present.
                selection.push(i);
            } else {
                // Remove item from selection if already present.
                selection.splice(arrayIndex, 1);
            }
        } else {
            selection = i;
        }
        
        this._setSelection(selection);
        this.component.doAction();
        this._renderSelection();
    },
    
    /**
     * Processes a selection change event.
     * This event handler is registered only for traditional SELECT elements, i.e., the _alternateRender flag will be false.
     */
    _processChange: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            Core.Web.DOM.preventEventDefault(e);
            this._renderSelection();
            return false;
        }
        
        var selection;
        if (this._multipleSelect) {
            selection = [];
            for (var i = 0; i < this._element.options.length; ++i) {
                if (this._element.options[i].selected) {
                    selection.push(i);
                }
            }
        } else {
            if (this._element.selectedIndex != -1) {
                selection = this._element.selectedIndex;
            }
        }
    
        this._setSelection(selection);
        this.component.doAction();
    },
    
    /** Processes a focus event */
    _processFocus: function(e) {
        this._focused = true;
        if (!this.client || !this.client.verifyInput(this.component)) {
            return true;
        }
        this.client.application.setFocusedComponent(this.component);
    },
    
    /** IE-specific event handler to prevent mouse-selection of text in DOM-rendered listbox component. */
    _processSelectStart: function(e) {
        Core.Web.DOM.preventEventDefault(e);
    },

    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this._multipleSelect = this.component.get("selectionMode") == Echo.ListBox.MULTIPLE_SELECTION;
        if (this.listBox && Core.Web.Env.QUIRK_IE_SELECT_LIST_DOM_UPDATE) {
            this._alternateRender = true;
        }
        this._enabled = this.component.isRenderEnabled();
        
        if (this._alternateRender) {
            this._renderMainAsDiv(update, parentElement);
        } else {
            this._renderMainAsSelect(update, parentElement);
        }
    },

    /** @see Echo.Render.ComponentSync#renderDisplay */
    renderDisplay: function() {
        this._renderSelection();
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) { 
        Core.Web.Event.removeAll(this._element);
        this._element = null;
        if (this._div) {
            Core.Web.Event.removeAll(this._div);
            this._div = null;
        }
    },
    
    /** @see Echo.Render.ComponentSync#renderFocus */
    renderFocus: function() {
        if (this._focused) {
            return;
        }
        
        this._focused = true;
        Core.Web.DOM.focusElement(this._element);
    },
    
    /**
     * Renders a list box as a DIV element containing DIV elements of selectable items.
     * This strategy is used on IE6 due to bugs in this browser's rendering engine.
     * This strategy is used when the _alternateRender flag is true.
     * 
     * @param {Echo.Update.ComponentUpdate} update the update
     * @param {Element} parent the parent DOM element 
     */
    _renderMainAsDiv: function(update, parentElement) {
        this._element = document.createElement("table");
        this._element.id = this.component.renderId;
        
        var tbodyElement = document.createElement("tbody");
        this._element.appendChild(tbodyElement);
        var trElement = document.createElement("tr");
        tbodyElement.appendChild(trElement);
        var tdElement = document.createElement("td");
        trElement.appendChild(tdElement);
        
        this._div = document.createElement("div");
        tdElement.appendChild(this._div);
        
        this._div.style.cssText = "cursor:default;overflow:auto;";
        this._div.style.height = Echo.Sync.Extent.toCssValue(this.component.render("height", "6em"), false, false);
        var width = this.component.render("width");
        if (!Echo.Sync.Extent.isPercent(width)) {
            this._div.style.width = Echo.Sync.Extent.toCssValue(width, true, false);
        }
        if (this._enabled) {
            Echo.Sync.renderComponentDefaults(this.component, this._element);
        } else {
            Echo.Sync.LayoutDirection.render(this.component.getLayoutDirection(), this._element);
            Echo.Sync.Color.render(Echo.Sync.getEffectProperty(this.component, "foreground", "disabledForeground", true), 
                    this._div, "color");
            Echo.Sync.Color.render(Echo.Sync.getEffectProperty(this.component, "background", "disabledBackground", true), 
                    this._div, "backgroundColor");
            Echo.Sync.Font.render(Echo.Sync.getEffectProperty(this.component, "font", "disabledFont", true), this._div);
        }
        Echo.Sync.Border.render(
                Echo.Sync.getEffectProperty(this.component, "border", "disabledBorder", !this._enabled, 
                Echo.Sync.ListComponent.DEFAULT_DIV_BORDER, null), 
                this._div);
        Echo.Sync.Insets.render(this.component.render("insets"), this._div, "padding");

        var items = this.component.get("items");
        if (items) {
            for (var i = 0; i < items.length; ++i) {
                var optionElement = document.createElement("div");
                if (items[i].text) {
                    optionElement.appendChild(document.createTextNode(items[i].text));
                } else {
                    optionElement.appendChild(document.createTextNode(items[i].toString()));
                }
                if (items[i].foreground) {
                    Echo.Sync.Color.render(items[i].foreground, optionElement, "color");
                }
                if (items[i].background) {
                    Echo.Sync.Color.render(items[i].background, optionElement, "backgroundColor");
                }
                if (items[i].font) {
                    Echo.Sync.Font.render(items[i].font, optionElement);
                }
                this._div.appendChild(optionElement);
            }
        }
        
        if (this._enabled) {
            Core.Web.Event.add(this._element, "blur", Core.method(this, this._processBlur), false);
            Core.Web.Event.add(this._element, "focus", Core.method(this, this._processFocus), false);
            Core.Web.Event.add(this._div, "click", Core.method(this, this._processClick), false);
            Core.Web.Event.add(this._div, "selectstart", Core.method(this, this._processSelectStart), false);
        }
        
        parentElement.appendChild(this._element);
    },
    
    /**
     * Renders the list selection component as a standard SELECT element.
     * This strategy is always used in all browsers except IE6, and is used in IE6
     * for drop-down select fields.  IE6 cannot use this strategy for listboxes
     * do to major bugs in this browser (listboxes randomly change back into selectfields
     * when rendered by DOM manipulation).
     * This strategy is used when the _alternateRender flag is false.
     * 
     * @param {Echo.Update.ComponentUpdate} update the update
     * @param {Element} parent the parent DOM element 
     */
    _renderMainAsSelect: function(update, parentElement) {
        this._element = document.createElement("select");
        this._element.id = this.component.renderId;
        this._element.size = this.listBox ? 6 : 1;

        if (!this._enabled) {
            this._element.disabled = true;
        }
        if (this._multipleSelect) {
            this._element.multiple = "multiple";
        }

        this._element.style.height = Echo.Sync.Extent.toCssValue(this.component.render("height"), false, false);
        
        var width = this.component.render("width");
        if (width) {
            if (Echo.Sync.Extent.isPercent(width)) {
                if (!Core.Web.Env.QUIRK_IE_SELECT_PERCENT_WIDTH) {
                    this._element.style.width = width;
                }
            } else {
                this._element.style.width = Echo.Sync.Extent.toCssValue(width, true, false);
            }
        }
        if (this._enabled) {
            Echo.Sync.renderComponentDefaults(this.component, this._element);
        } else {
            Echo.Sync.LayoutDirection.render(this.component.getLayoutDirection(), this._element);
            Echo.Sync.Color.render(Echo.Sync.getEffectProperty(this.component, "foreground", "disabledForeground", true), 
                    this._element, "color");
            Echo.Sync.Color.render(Echo.Sync.getEffectProperty(this.component, "background", "disabledBackground", true), 
                    this._element, "backgroundColor");
            Echo.Sync.Font.render(Echo.Sync.getEffectProperty(this.component, "font", "disabledFont", true),this._element);
        }
        Echo.Sync.Border.render(Echo.Sync.getEffectProperty(this.component, "border", "disabledBorder", !this._enabled), 
                this._element);
        Echo.Sync.Insets.render(this.component.render("insets"), this._element, "padding");

        var items = this.component.get("items");
        if (items) {
            for (var i = 0; i < items.length; ++i) {
                var optionElement = document.createElement("option");
                if (items[i].text == null) {
                    optionElement.appendChild(document.createTextNode(items[i].toString()));
                } else {
                    optionElement.appendChild(document.createTextNode(items[i].text));
                }
                if (items[i].foreground) {
                    Echo.Sync.Color.render(items[i].foreground, optionElement, "color");
                }
                if (items[i].background) {
                    Echo.Sync.Color.render(items[i].background, optionElement, "backgroundColor");
                }
                if (items[i].font) {
                    Echo.Sync.Font.render(items[i].font, optionElement);
                }
                this._element.appendChild(optionElement);
            }
        }
    
        if (this._enabled) {
            Core.Web.Event.add(this._element, "change", Core.method(this, this._processChange), false);
            Core.Web.Event.add(this._element, "blur", Core.method(this, this._processBlur), false);
            Core.Web.Event.add(this._element, "focus", Core.method(this, this._processFocus), false);
        }

        parentElement.appendChild(this._element);
    },

    /**
     * Renders the current selection state.
     */
    _renderSelection: function() {
        var selection = this._getSelection(),
            i;
        
        if (this._alternateRender) {
            if (this._hasRenderedSelectedItems) {
                var items = this.component.get("items");
                for (i = 0; i < items.length; ++i) {
                    Echo.Sync.Color.renderClear(items[i].foreground, this._div.childNodes[i], 
                            "color");
                    Echo.Sync.Color.renderClear(items[i].background, this._div.childNodes[i], 
                            "backgroundColor");
                }
            }
            if (selection instanceof Array) {
                for (i = 0; i < selection.length; ++i) {
                    if (selection[i] >= 0 && selection[i] < this._div.childNodes.length) {
                        Echo.Sync.Color.render(Echo.Sync.ListComponent.DEFAULT_SELECTED_FOREGROUND,
                                this._div.childNodes[selection[i]], "color");
                        Echo.Sync.Color.render(Echo.Sync.ListComponent.DEFAULT_SELECTED_BACKGROUND,
                                this._div.childNodes[selection[i]], "backgroundColor");
                    }
                }
            } else if (selection >= 0 && selection < this._div.childNodes.length) {
                Echo.Sync.Color.render(Echo.Sync.ListComponent.DEFAULT_SELECTED_FOREGROUND,
                        this._div.childNodes[selection], "color");
                Echo.Sync.Color.render(Echo.Sync.ListComponent.DEFAULT_SELECTED_BACKGROUND,
                        this._div.childNodes[selection], "backgroundColor");
            }
        } else {
            if (this._hasRenderedSelectedItems) {
                this._element.selectedIndex = -1;
            }
            if (selection instanceof Array) {
                for (i = 0; i < selection.length; ++i) {
                    if (selection[i] >= 0 && selection[i] < this._element.options.length) {
                        this._element.options[selection[i]].selected = true;
                    }
                }
            } else if (selection >= 0 && selection < this._element.options.length) {
                this._element.options[selection].selected = true;
            }
        }
        this._hasRenderedSelectedItems = true;
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        if (update.getUpdatedProperty("selectedId") && !update.getUpdatedProperty("selection")) {
            this._selectedIdPriority = true;
        }
    
        var element = this._element;
        var containerElement = element.parentNode;
        this.renderDispose(update);
        containerElement.removeChild(element);
        this.renderAdd(update, containerElement);
        if (this._focused) {
            Core.Web.DOM.focusElement(this._element);
        }
        return false; // Child elements not supported: safe to return false.
    },
    
    /**
     * Sets the selection state.
     * Updates values of both "selection" and "selectedId" properties of the component.
     * 
     * @param selection the new selection state, either the selected index or an array of selected indices 
     */
    _setSelection: function(selection) {
        this._selectedIdPriority = false;
    
        var selectedId = null;
        
        if (selection instanceof Array && selection.length == 1) {
            selection = selection[0];
        }
        
        var items = this.component.get("items");
        if (selection instanceof Array) {
            selectedId = [];
            for (var i = 0; i < selection.length; ++i) {
                var selectedIndex = selection[i];
                if (selectedIndex < items.length) {
                    if (items[selectedIndex].id != null) {
                        selectedId.push(items[selectedIndex].id);
                    }
                }
            }
        } else {
            if (selection < items.length) {
                if (items[selection].id != null) {
                    selectedId = items[selection].id;
                }
            }
        }

        this.component.set("selection", selection);
        this.component.set("selectedId", selectedId);
    }
});

/**
 * Component rendering peer: ListBox
 */
Echo.Sync.ListBox = Core.extend(Echo.Sync.ListComponent, {
    
    /** @see Echo.Sync.ListComponent#listBox */
    listBox: true,

    $load: function() {
        Echo.Render.registerPeer("ListBox", this);
    }
});

/**
 * Component rendering peer: SelectField
 */
Echo.Sync.SelectField = Core.extend(Echo.Sync.ListComponent, { 

    /** @see Echo.Sync.ListComponent#listBox */
    listBox: false,

    $load: function() {
        Echo.Render.registerPeer("SelectField", this);
    }
});
/**
 * Component rendering peer: SplitPane.
 * This class should not be extended by developers, the implementation is subject to change.
 */
Echo.Sync.SplitPane = Core.extend(Echo.Render.ComponentSync, {

    $static: {
    
        /**    
         * Describes the configuration of a child pane of the SplitPane,
         * including the child component and scroll bar positions.
         */
        ChildPane: Core.extend({
        
            /** 
             * Minimum pixel size of the child pane.
             * @type Number
             */
            minimumSize: 0,
            
            /** 
             * Maximum pixel size of the child pane.
             * @type Number
             */
            maximumSize: null,
            
            /**
             * The child pane <code>Echo.Component</code> instance.
             * @type Echo.Component
             */
            component: null,
            
            /**
             * The value of the child pane <code>Echo.Component</code>'s <code>layoutData</code> property.
             */
            layoutData: null,
            
            /** 
             * Horizontal scroll position, in pixels.
             * @type Number.
             */
            scrollLeft: 0,

            /** 
             * Vertical scroll position, in pixels.
             * @type Number.
             */
            scrollTop: 0,
            
            /** 
             * Flag indicating that scroll position should be reset on next renderDisplay() invocation.
             * @type Boolean
             */
            scrollRequired: false,
            
            /**
             * Flag indicating whether sizing information is permanent (fixed pixel-based) or variable (percent-based).
             * @type Boolean
             */
            _permanentSizes: false,
            
            /**
             * The SplitPane component rendering peer using this <code>ChildPane</code> object.
             * @type Echo.Sync.SplitPane
             */
            _peer: null,
        
            /**
             * Creates a new PaneConfiguration instance
             * 
             * @param {Echo.Sync.SplitPane} splitPanePeer the relevant componentPeer
             * @param {Echo.Component} component the child component
             */
            $construct: function(splitPanePeer, component) {
                this._peer = splitPanePeer;
                this.component = component;
                this.layoutData = component.render("layoutData");
            },
            
            /**
             * Load minimum and maximum separator positions for panes.
             */
            loadDisplayData: function() {
                if (this._permanentSizes) {
                    // Pane size constraints have been loaded for this ChildPane, and will not ever change
                    // (because they are pixel rather percent-based.
                    return;
                }
                
                var size;
                this._permanentSizes = true;
                if (this.layoutData) {
                    if (this.layoutData.minimumSize) {
                        if (Echo.Sync.Extent.isPercent(this.layoutData.minimumSize)) {
                            size = this._peer._getSize();
                            this.minimumSize = Math.round((this._peer._orientationVertical ? size.height : size.width) *
                                    parseInt(this.layoutData.minimumSize, 10) / 100);
                            this._permanentSizes = false;
                        } else {
                            this.minimumSize = Math.round(Echo.Sync.Extent.toPixels(this.layoutData.minimumSize, 
                                    !this._peer._orientationVertical));
                        }
                    }
                    if (this.layoutData.maximumSize) {
                        if (Echo.Sync.Extent.isPercent(this.layoutData.maximumSize)) {
                            size = this._peer._getSize();
                            this.maximumSize = Math.round((this._peer._orientationVertical ? size.height : size.width) *
                                    parseInt(this.layoutData.maximumSize, 10) / 100);
                            this._permanentSizes = false;
                        } else {
                            this.maximumSize = Math.round(Echo.Sync.Extent.toPixels(this.layoutData.maximumSize, 
                                    !this._peer._orientationVertical));
                        }
                    }
                }
            },
            
            /**
             * Update pane DIV element's scroll positions to reflect those stored in this object.
             *  
             * @param paneDiv the pane's DIV element
             */
            loadScrollPositions: function(paneDiv) {
                paneDiv.scrollLeft = this.scrollLeft;
                paneDiv.scrollTop = this.scrollTop;
            },
            
            /**
             * Retrieve scroll bar positions from pane DIV element and store in this object.
             * 
             * @param paneDiv the pane's DIV element
             */
            storeScrollPositions: function(paneDiv) {
                this.scrollLeft = paneDiv.scrollLeft;
                this.scrollTop = paneDiv.scrollTop;
            }
        })
    },

    $load: function() {
        Echo.Render.registerPeer("SplitPane", this);
    },

    /**
     * Array containing two PaneConfiguration instances, representing the state of each child pane.
     * @type Array
     */
    _childPanes: null,
    
    /**
     * Array containing the elements of the first and second child pane DIVs.  This array always has two elements.
     * @type Array
     */
    _paneDivs: null,
    
    /**
     * The rendered separator DIV element.
     * @type Element
     */
    _separatorDiv: null,
    
    /**
     * Flag indicating whether separator is to be automatically positioned.
     * @type Boolean
     */
    _autoPositioned: false,

    /**
     * Overlay DIV which covers other elements (such as IFRAMEs) when dragging which may otherwise suppress events.
     * @type Element
     */
    _overlay: null,
    
    /**
     * Flag indicating whether the renderDisplay() method must be invoked on this peer 
     * (and descendant component peers).
     * @type Number
     */
    _redisplayRequired: false,
    
    /**
     * The user's desired position of the separator.  This is the last
     * position to which the user dragged the separator or the last position
     * that the separator was explicitly set to.  This value may not be the
     * actual separator position, in cases where other constraints have
     * temporarily adjusted it.
     * This is value is retained such that if constraints are lifted, the 
     * separator position will return to where the user last preferred it.
     * 
     * @type Extent
     */
    _requested: null,
    
    /**
     * Current rendered separator position.
     * @type Number
     */
    _rendered: null,

    /**
     * Method reference to this._processSeparatorMouseMove().
     * @type Function
     */
    _processSeparatorMouseMoveRef: null,

    /**
     * Method reference to this._processSeparatorMouseUp().
     * @type Function
     */
    _processSeparatorMouseUpRef: null,

    /**
     * Flag indicating whether initial automatic sizing operation (which occurs on first invocation of 
     * <code>renderDisplay()</code> after <code>renderAdd()</code>) has been completed.
     * @type Boolean
     */
    _initialAutoSizeComplete: false,
    
    /**
     * The rendered size of the SplitPane outer DIV.  This value is lazily loaded by
     * _getSize(), thus it should always be retrieved by invoking _getSize().
     * This property will be cleared any time the size changes.
     */
    _size: null,

    /** Constructor. */
    $construct: function() {
        this._childPanes = [];
        this._paneDivs = [];
        this._processSeparatorMouseMoveRef = Core.method(this, this._processSeparatorMouseMove);
        this._processSeparatorMouseUpRef = Core.method(this, this._processSeparatorMouseUp);
    },
    
    /** Processes a key press event. */
    clientKeyDown: function(e) {
        var focusPrevious,
            focusedComponent,
            focusFlags,
            focusChild;
        switch (e.keyCode) {
        case 37:
        case 39:
            if (!this._orientationVertical) {
                focusPrevious = (e.keyCode == 37) ^ (!this._orientationTopLeft);
                focusedComponent = this.client.application.getFocusedComponent();
                if (focusedComponent && focusedComponent.peer && focusedComponent.peer.getFocusFlags) {
                    focusFlags = focusedComponent.peer.getFocusFlags();
                    if ((focusPrevious && focusFlags & Echo.Render.ComponentSync.FOCUS_PERMIT_ARROW_LEFT) || 
                            (!focusPrevious && focusFlags & Echo.Render.ComponentSync.FOCUS_PERMIT_ARROW_RIGHT)) {
                        focusChild = this.client.application.focusManager.findInParent(this.component, focusPrevious);
                        if (focusChild) {
                            this.client.application.setFocusedComponent(focusChild);
                            Core.Web.DOM.preventEventDefault(e.domEvent);
                            return false;
                        }
                    }
                }
            }
            break;
        case 38:
        case 40:
            if (this._orientationVertical) {
                focusPrevious = (e.keyCode == 38) ^ (!this._orientationTopLeft);
                focusedComponent = this.client.application.getFocusedComponent();
                if (focusedComponent && focusedComponent.peer && focusedComponent.peer.getFocusFlags) {
                    focusFlags = focusedComponent.peer.getFocusFlags();
                    if ((focusPrevious && focusFlags & Echo.Render.ComponentSync.FOCUS_PERMIT_ARROW_UP) ||
                            (!focusPrevious && focusFlags & Echo.Render.ComponentSync.FOCUS_PERMIT_ARROW_DOWN)) {
                        focusChild = this.client.application.focusManager.findInParent(this.component, focusPrevious);
                        if (focusChild) {
                            this.client.application.setFocusedComponent(focusChild);
                            Core.Web.DOM.preventEventDefault(e.domEvent);
                            return false;
                        }
                    }
                }
            }
            break;
        }
        return true;
    }, 
    
    /**
     * Converts a desired separator position into a render-able separator position that
     * complies with the SplitPane's separator bounds (miniumSize and maximumSize of child
     * component layout data).
     * 
     * @param {Number} position requested separator position
     * @return the bounded separator position
     * @type Number
     */
    _getBoundedSeparatorPosition: function(position) {
        if (this._childPanes[1]) {
            var totalSize = this._orientationVertical ? this._getSize().height : this._getSize().width;
            if (position > totalSize - this._childPanes[1].minimumSize - this._separatorSize) {
                position = totalSize - this._childPanes[1].minimumSize - this._separatorSize;
            } else if (this._childPanes[1].maximumSize != null
                    && position < totalSize - this._childPanes[1].maximumSize - this._separatorSize) {
                position = totalSize - this._childPanes[1].maximumSize - this._separatorSize;
            }
        }
        if (this._childPanes[0]) {
            if (position < this._childPanes[0].minimumSize) {
                position = this._childPanes[0].minimumSize;
            } else if (this._childPanes[0].maximumSize != null && position > this._childPanes[0].maximumSize) {
                position = this._childPanes[0].maximumSize;
            }
        }
        return position;
    },
    
    /**
     * Determines the number of pixels of inset margin specified in a layout data object.
     * Horizontal or vertical pixels will be analyzed based on the SplitPane's orientation.
     * The result of this method can be subtracted from the desired height or width of a pane
     * to determine the appropriate value to set for a CSS width/height attribute.
     * 
     * @param {Object} layoutData a component layout data object
     * @return the number of inset pixels
     * @type Number 
     */
    _getInsetsSizeAdjustment: function(position, layoutData) {
        if (!layoutData || layoutData.insets == null) {
            return 0;
        }
        var layoutDataInsets = Echo.Sync.Insets.toPixels(layoutData.insets);
        var adjustment;
        if (this._orientationVertical) {
            adjustment = layoutDataInsets.top + layoutDataInsets.bottom;
        } else {
            adjustment = layoutDataInsets.left + layoutDataInsets.right;
        }
        if (position != null && adjustment > position) {
            adjustment = position;
        }
        return adjustment;
    },
    
    /**
     * Calculates the preferred rendered size of the SplitPane by measuring the sizes of its content and/or
     * invoking getPreferredSize() on its content (if supported).
     * 
     * @see Echo.Render.ComponnetSync#getPreferredSize
     */
    getPreferredSize: function(dimension) {
        if (this.component.children.length === 0) {
            return null;
        }
        
        var bounds, insets, layoutData;
        
        dimension = dimension || (Echo.Render.ComponentSync.SIZE_WIDTH | Echo.Render.ComponentSync.SIZE_HEIGHT);        

        // Determine size of pane 0.
        var size0;
        if (this.component.children[0].peer.getPreferredSize) {
            // Use getPreferredSize() if available.
            size0 = this.component.children[0].peer.getPreferredSize(dimension) || { };
        } else if (!this.component.children[0].pane && (dimension & Echo.Render.ComponentSync.SIZE_HEIGHT) &&
                this._paneDivs[0].firstChild) {
            // Measure height of non-pane child (assuming height is being requested).
            bounds = new Core.Web.Measure.Bounds(this._paneDivs[0].firstChild);
            size0 = { height: bounds.height === 0 ? null : bounds.height };
            if (size0.height) {
                layoutData = this.component.children[0].render("layoutData");
                if (layoutData && layoutData.insets) {
                    insets = Echo.Sync.Insets.toPixels(layoutData.insets);
                    size0.height += insets.top + insets.bottom;
                }
            }
        } else {
            // Pane 0 cannot be measured.
            size0 = { };
        }

        // Determine size of pane 1.
        var size1;
        if (this.component.children.length == 1) {
            // Pane 1 does not exist.
            size1 = { width: 0, height: 0 };
        } else if (this.component.children[1].peer.getPreferredSize) {
            // Use getPreferredSize() if available.
            size1 = this.component.children[1].peer.getPreferredSize(dimension) || { };
        } else if (!this.component.children[1].pane && (dimension & Echo.Render.ComponentSync.SIZE_HEIGHT) &&
                this._paneDivs[1].firstChild) {
            // Measure height of non-pane child (assuming height is being requested).
            bounds = new Core.Web.Measure.Bounds(this._paneDivs[1].firstChild);
            size1 = { height: bounds.height === 0 ? null : bounds.height };
            if (size1.height) {
                layoutData = this.component.children[1].render("layoutData");
                if (layoutData && layoutData.insets) {
                    insets = Echo.Sync.Insets.toPixels(layoutData.insets);
                    size1.height += insets.top + insets.bottom;
                }
            }
        } else {
            // Pane 1 cannot be measured.
            size1 = { };
        }
        
        var height = null;
        if ((dimension & Echo.Render.ComponentSync.SIZE_HEIGHT) && size0.height != null && size1.height != null) {
            if (this._orientationVertical) {
                // Measure height of vertical SplitPane: sum pane heights and separator.
                height = size0.height + size1.height + this._separatorSize;
            } else {
                // Measure height of horizontal SplitPane: use maximum pane height.
                height = size0.height > size1.height ? size0.height : size1.height;
            }
        }
        
        var width = null;
        if ((dimension & Echo.Render.ComponentSync.SIZE_WIDTH) && size0.width != null && size1.width != null) {
            if (this._orientationVertical) {
                // Measure width of vertical SplitPane: use maximum pane width.
                width = size0.width > size1.width ? size0.width : size1.width;
            } else {
                // Measure width of horizontal SplitPane: sum pane widths and separator.
                width = size0.width + size1.width + this._separatorSize;
            }
        }
        
        return { height: height, width: width };
    },
    
    /**
     * Retrieves the (potentially cached) dimensions of the SplitPane outer DIV.
     * 
     * @return the dimensions
     * @type Core.Web.Measure.Bounds
     */
    _getSize: function() {
        if (!this._size) {
            this._size = new Core.Web.Measure.Bounds(this._splitPaneDiv);
        }
        return this._size;
    },
    
    /**
     * Determines if the specified update has caused either child of the SplitPane to
     * be relocated (i.e., a child which existed before continues to exist, but at a
     * different index).
     * 
     * @param {Echo.Update.ComponentUpdate} update the component update
     * @return true if a child has been relocated
     * @type Boolean
     */
    _hasRelocatedChildren: function(update) {
        var oldChild0 = this._childPanes[0] ? this._childPanes[0].component : null; 
        var oldChild1 = this._childPanes[1] ? this._childPanes[1].component : null; 
        var childCount = this.component.getComponentCount();
        var newChild0 = childCount > 0 ? this.component.getComponent(0) : null;
        var newChild1 = childCount > 1 ? this.component.getComponent(1) : null;
        return (oldChild0 != null && oldChild0 == newChild1) || 
                (oldChild1 != null && oldChild1 == newChild0);
    },

    /**
     * Retrieves properties from Echo.SplitPane component instances and
     * stores them in local variables in a format more convenient for processing
     * by this synchronization peer.
     */
    _loadRenderData: function() {
        var orientation = this.component.render("orientation", 
                Echo.SplitPane.ORIENTATION_HORIZONTAL_LEADING_TRAILING);
        
        switch (orientation) {
        case Echo.SplitPane.ORIENTATION_HORIZONTAL_LEADING_TRAILING:
            this._orientationTopLeft = this.component.getRenderLayoutDirection().isLeftToRight();
            this._orientationVertical = false;
            break;
        case Echo.SplitPane.ORIENTATION_HORIZONTAL_TRAILING_LEADING:
            this._orientationTopLeft = !this.component.getRenderLayoutDirection().isLeftToRight();
            this._orientationVertical = false;
            break;
        case Echo.SplitPane.ORIENTATION_HORIZONTAL_LEFT_RIGHT:
            this._orientationTopLeft = true;
            this._orientationVertical = false;
            break;
        case Echo.SplitPane.ORIENTATION_HORIZONTAL_RIGHT_LEFT:
            this._orientationTopLeft = false;
            this._orientationVertical = false;
            break;
        case Echo.SplitPane.ORIENTATION_VERTICAL_TOP_BOTTOM:
            this._orientationTopLeft = true;
            this._orientationVertical = true;
            break;
        case Echo.SplitPane.ORIENTATION_VERTICAL_BOTTOM_TOP:
            this._orientationTopLeft = false;
            this._orientationVertical = true;
            break;
        default:
            throw new Error("Invalid orientation: " + orientation);
        }

        this._resizable = this.component.render("resizable");
        this._autoPositioned = this.component.render("autoPositioned");
        this._requested = this.component.render("separatorPosition");
        
        var defaultSeparatorSize = this._resizable ? Echo.SplitPane.DEFAULT_SEPARATOR_SIZE_RESIZABLE : 
                Echo.SplitPane.DEFAULT_SEPARATOR_SIZE_FIXED;
        var separatorSizeExtent = this.component.render(
                this._orientationVertical ? "separatorHeight" : "separatorWidth", defaultSeparatorSize);
        this._separatorSize = Echo.Sync.Extent.toPixels(separatorSizeExtent, this._orientationVertical);
        if (this._separatorSize == null) {
            this._separatorSize = defaultSeparatorSize;
        }
        this._separatorVisible = this._resizable || (this.component.render("separatorVisible", true) && this._separatorSize > 0);
        if (!this._separatorVisible) {
            this._separatorSize = 0;
        }
        
        if (this._separatorSize > 0) {
            this._separatorColor = this.component.render("separatorColor", Echo.SplitPane.DEFAULT_SEPARATOR_COLOR); 
            this._separatorRolloverColor = this.component.render("separatorRolloverColor") || 
                    Echo.Sync.Color.adjust(this._separatorColor, 0x20, 0x20, 0x20);
            
            this._separatorImage = this.component.render(this._orientationVertical ? 
                    "separatorVerticalImage" : "separatorHorizontalImage");
            this._separatorRolloverImage = this.component.render(this._orientationVertical ? 
                    "separatorVerticalRolloverImage" : "separatorHorizontalRolloverImage");
        }
    },
    
    /**
     * Adds an overlay DIV at maximum z-index to cover any objects that will not provide move mouseup freedback.
     * @see #_overlayRemove
     */ 
    _overlayAdd: function() {
        if (this._overlay) {
            return;
        }
        this._overlay = document.createElement("div");
        this._overlay.style.cssText = "position:absolute;z-index:32600;width:100%;height:100%;";
        Echo.Sync.FillImage.render(this.client.getResourceUrl("Echo", "resource/Transparent.gif"), this._overlay);
        document.body.appendChild(this._overlay);
    },
    
    /**
     * Removes the overlay DIV.
     * @see #_overlayAdd
     */
    _overlayRemove: function() {
        if (!this._overlay) {
            return;
        }
        document.body.removeChild(this._overlay);
        this._overlay = null;
    },
    
    /** Processes a mouse down event on a SplitPane separator that is about to be dragged. */
    _processSeparatorMouseDown: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return true;
        }
    
        Core.Web.DOM.preventEventDefault(e);
        
        Core.Web.dragInProgress = true;
    
        this._dragInitPosition = this._rendered;
        if (this._orientationVertical) {
            this._dragInitMouseOffset = e.clientY;
        } else {
            this._dragInitMouseOffset = e.clientX;
        }
        
        Core.Web.Event.add(document.body, "mousemove", this._processSeparatorMouseMoveRef, true);
        Core.Web.Event.add(document.body, "mouseup", this._processSeparatorMouseUpRef, true);
        this._overlayAdd();
    },
    
    /** Processes a mouse move event on a SplitPane separator that is being dragged. */
    _processSeparatorMouseMove: function(e) {
        var mousePosition = this._orientationVertical ? e.clientY : e.clientX;
        this._rendered = this._getBoundedSeparatorPosition(this._orientationTopLeft ?
                this._dragInitPosition + mousePosition - this._dragInitMouseOffset :
                this._dragInitPosition - mousePosition + this._dragInitMouseOffset);
        this._redraw(this._rendered);
    },
    
    /** Processes a mouse up event on a SplitPane separator that was being dragged. */
    _processSeparatorMouseUp: function(e) {
        Core.Web.DOM.preventEventDefault(e);
        
        this._overlayRemove();
        Core.Web.dragInProgress = false;
    
        this._removeSeparatorListeners();
        this.component.set("separatorPosition", this._rendered);
        
        // Inform renderer that separator position is currently drawn as this._rendered.
        this._requested = this._rendered;
    
        if (this._paneDivs[0]) {
            Core.Web.VirtualPosition.redraw(this._paneDivs[0]);
        }
        if (this._paneDivs[1]) {
            Core.Web.VirtualPosition.redraw(this._paneDivs[1]);
        }
    
        Echo.Render.notifyResize(this.component);
    },
    
    /** Processes a mouse rollover enter event on the SplitPane separator. */
    _processSeparatorRolloverEnter: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return true;
        }
        
        if (this._separatorRolloverImage) {
            Echo.Sync.FillImage.render(this._separatorRolloverImage, this._separatorDiv, 0);
        } else {
            Echo.Sync.Color.render(this._separatorRolloverColor, this._separatorDiv, "backgroundColor");
        }
    },
    
    /** Processes a mouse rollover exit event on the SplitPane separator. */
    _processSeparatorRolloverExit: function(e) {
        if (this._separatorRolloverImage) {
            Echo.Sync.FillImage.renderClear(this._separatorImage, this._separatorDiv, 0);
        } else {
            Echo.Sync.Color.render(this._separatorColor, this._separatorDiv, "backgroundColor");
        }
    },
    
    /**
     * Updates the variable CSS attributes of the SplitPane.
     * 
     * @param {Number} position the pixel position of the separator
     */
    _redraw: function(position) {
        var insetsAdjustment = 0;
        if (this.component.getComponentCount() > 0) {
            var layoutData = this.component.getComponent(0).render("layoutData");
            insetsAdjustment = this._getInsetsSizeAdjustment(position, layoutData);
        }

        var sizeAttr = this._orientationVertical ? "height" : "width";
        var positionAttr = this._orientationVertical ?
                (this._orientationTopLeft ? "top" : "bottom") :
                (this._orientationTopLeft ? "left" : "right");
        if (this._paneDivs[0]) {
            this._paneDivs[0].style[sizeAttr] = (position - insetsAdjustment) + "px";
        }
        if (this._paneDivs[1]) {
            this._paneDivs[1].style[positionAttr] =  (position + this._separatorSize) + "px";
        }
        if (this._separatorDiv) {
            this._separatorDiv.style[positionAttr] = position + "px";
        }
    },
    
    /**
     * Removes listeners from the separator used to monitor its state while it is being dragging.
     */
    _removeSeparatorListeners: function() {
        Core.Web.Event.remove(document.body, "mousemove", this._processSeparatorMouseMoveRef, true);
        Core.Web.Event.remove(document.body, "mouseup", this._processSeparatorMouseUpRef, true);
    },
    
    /**
     * Adds basic structure of SplitPane to DOM, but much work is delayed for initial invocation
     * of renderDisplay().
     * @see Echo.Render.ComponentSync#renderAdd
     */
    renderAdd: function(update, parentElement) {
        this._initialAutoSizeComplete = false;
        this._loadRenderData();

        var childCount = this.component.getComponentCount();
        if (childCount > 2) {
            throw new Error("Cannot render SplitPane with more than two child components.");
        }
        var child0 = childCount < 1 ? null : this.component.getComponent(0);
        var child1 = childCount < 2 ? null : this.component.getComponent(1);
    
        this._splitPaneDiv = document.createElement("div");
        this._splitPaneDiv.id = this.component.renderId;
        this._splitPaneDiv.style.cssText = "position:absolute;overflow:hidden;top:0;left:0;right:0;bottom:0;";
        
        Echo.Sync.renderComponentDefaults(this.component, this._splitPaneDiv);
        
        if (this._separatorVisible) {
            this._separatorDiv = document.createElement("div");
            this._separatorDiv.style.cssText = "position:absolute;font-size:1px;line-height:0;z-index:2;";
            Echo.Sync.Color.render(this._separatorColor, this._separatorDiv, "backgroundColor");
    
            var resizeCursor = null;
            if (this._orientationVertical) {
                resizeCursor = this._orientationTopLeft ? "s-resize" : "n-resize";
                this._separatorDiv.style.width = "100%";
                this._separatorDiv.style.height = this._separatorSize + "px";
                Echo.Sync.FillImage.render(this._separatorImage, this._separatorDiv, 0);
            } else {
                resizeCursor = this._orientationTopLeft ? "e-resize" : "w-resize";
                this._separatorDiv.style.height = "100%";
                this._separatorDiv.style.width = this._separatorSize + "px";
                Echo.Sync.FillImage.render(this._separatorImage, this._separatorDiv, 0);
            }
            if (this._resizable && resizeCursor) {
                this._separatorDiv.style.cursor = resizeCursor;
            }
            this._splitPaneDiv.appendChild(this._separatorDiv);
        } else {
            this._separatorDiv = null;
        }
        
        for (var i = 0; i < childCount && i < 2; ++i) {
            var child = this.component.getComponent(i);
            this._renderAddChild(update, child, i);
        }
        
        parentElement.appendChild(this._splitPaneDiv);
        
        if (this._resizable) {
            Core.Web.Event.add(this._separatorDiv, "mousedown", 
                    Core.method(this, this._processSeparatorMouseDown), false);
            Core.Web.Event.add(this._separatorDiv, "mouseover", 
                    Core.method(this, this._processSeparatorRolloverEnter), false);
            Core.Web.Event.add(this._separatorDiv, "mouseout", 
                    Core.method(this, this._processSeparatorRolloverExit), false);
        }
    },
    
    /**
     * Renders the addition of a child.
     * 
     * @param {Echo.Update.ComponentUpdate} update the update
     * @param {Echo.Component} child the added child
     * @param {Number} index the index of the child within the SplitPane 
     */
    _renderAddChild: function(update, child, index) {
        var childIndex = this.component.indexOf(child);
        var paneDiv = document.createElement("div");
        this._paneDivs[index] = paneDiv;
        
        paneDiv.style.cssText = "position: absolute; overflow: auto; z-index: 1;";
        
        var layoutData = child.render("layoutData");
        if (layoutData) {
            Echo.Sync.Alignment.render(layoutData.alignment, paneDiv, false, this.component);
            Echo.Sync.Color.render(layoutData.background, paneDiv, "backgroundColor");
            Echo.Sync.FillImage.render(layoutData.backgroundImage, paneDiv);
            if (!child.pane) {
                Echo.Sync.Insets.render(layoutData.insets, paneDiv, "padding");
                switch (layoutData.overflow) {
                case Echo.SplitPane.OVERFLOW_HIDDEN:
                    paneDiv.style.overflow = "hidden";
                    break;
                case Echo.SplitPane.OVERFLOW_SCROLL:
                    paneDiv.style.overflow = "scroll";
                    break;
                }
            }
        }
        if (child.pane) {
            paneDiv.style.overflow = "hidden";
        }
                
        // Set static CSS positioning attributes on pane DIV.
        if (this._orientationVertical) {
            paneDiv.style.left = 0;
            paneDiv.style.right = 0;
            if ((this._orientationTopLeft && index === 0) || (!this._orientationTopLeft && index == 1)) {
                paneDiv.style.top = 0;
            } else {
                paneDiv.style.bottom = 0;
            }
        } else {
            paneDiv.style.top = "0";
            paneDiv.style.bottom = "0";
            if ((this._orientationTopLeft && index === 0) || (!this._orientationTopLeft && index == 1)) {
                paneDiv.style.left = 0;
            } else {
                paneDiv.style.right = 0;
            }
        }
        
        Echo.Render.renderComponentAdd(update, child, paneDiv);
        this._splitPaneDiv.appendChild(paneDiv);
    
        if (this._childPanes[index] && this._childPanes[index].component == child) {
            this._childPanes[index].scrollRequired = true;
        } else {
            this._childPanes[index] = new Echo.Sync.SplitPane.ChildPane(this, child);
        }
    },
    
    /** @see Echo.Render.ComponentSync#renderDisplay */
    renderDisplay: function() {
        Core.Web.VirtualPosition.redraw(this._splitPaneDiv);
        Core.Web.VirtualPosition.redraw(this._paneDivs[0]);
        Core.Web.VirtualPosition.redraw(this._paneDivs[1]);

        this._size = null;
        
        if (this._childPanes[0]) {
            this._childPanes[0].loadDisplayData();
        }
        if (this._childPanes[1]) {
            this._childPanes[1].loadDisplayData();
        }

        var position = this._requested;
        
        if (position == null && this._autoPositioned && this._paneDivs[0]) {
            // Automatic sizing requested: set separator and pane 1 positions to be adjacent to browser's 
            // rendered size of pane 0.

            if (this.component.children[0].peer.getPreferredSize) {
                // Query child 0 component for preferred size if available.
                var prefSize = this.component.children[0].peer.getPreferredSize(
                        this._orientationVertical ? Echo.Render.ComponentSync.SIZE_HEIGHT : Echo.Render.ComponentSync.SIZE_WIDTH);
                position = prefSize ? (this._orientationVertical ? prefSize.height : prefSize.width) : null;
            }
            
            if (position == null && this._orientationVertical && !this.component.children[0].pane) {
                // Automatically position vertical SplitPane based on height of non-pane child 0.
                this._paneDivs[0].style.height = "";
                var bounds0 = new Core.Web.Measure.Bounds(this._paneDivs[0]);
                position = bounds0.height;
            }

            if (position != null && !this._initialAutoSizeComplete) {
                // If position was successfully set, perform initial operations related to automatic sizing 
                // (executed on first renderDisplay() after renderAdd()).
                this._initialAutoSizeComplete = true;
                var imageListener = Core.method(this, function() {
                    if (this.component) { // Verify component still registered.
                        Echo.Render.renderComponentDisplay(this.component);
                    }
                });
                Core.Web.Image.monitor(this._paneDivs[0], imageListener);
            }
        }

        if (position == null) {
            // Use default separator position if none has been provided at this point.
            position = Echo.SplitPane.DEFAULT_SEPARATOR_POSITION;
        }

        if (Echo.Sync.Extent.isPercent(position)) {
            // Convert percent position to integer value.
            var totalSize = this._orientationVertical ? this._getSize().height : this._getSize().width;
            position = Math.round((parseInt(position, 10) / 100) * totalSize);
        } else {
            // Convert non-percent extent position to integer position.
            position = Math.round(Echo.Sync.Extent.toPixels(position, !this._orientationVertical));
        }
        
        // Constrain position and assign as rendered position.
        this._rendered = this._getBoundedSeparatorPosition(position);
        
        // Redraw dynamic elements of SplitPane.
        this._redraw(this._rendered);
        
        // IE Virtual positioning updates.
        Core.Web.VirtualPosition.redraw(this._paneDivs[0]);
        Core.Web.VirtualPosition.redraw(this._paneDivs[1]);

        // Update scroll bar positions for scenario where pane has been disposed and redrawn.
        for (var i = 0; i < this._childPanes.length; ++i) {
            if (this._childPanes[i] && this._childPanes[i].scrollRequired && this._paneDivs[i]) {
                this._childPanes[i].loadScrollPositions(this._paneDivs[i]);
                this._childPanes[i].scrollRequired = false;
            }
        }
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        this._overlayRemove();

        for (var i = 0; i < 2; ++i) {
            if (this._paneDivs[i]) {
                if (this._childPanes[i]) {
                    this._childPanes[i].storeScrollPositions(this._paneDivs[i]);
                }
                this._paneDivs[i] = null;
            }
        }
        
        if (this._separatorDiv) {
            Core.Web.Event.removeAll(this._separatorDiv);
            this._separatorDiv = null;
        }

        Core.Web.Event.removeAll(this._splitPaneDiv);
    
        this._splitPaneDiv = null;
    },
    
    /**
     * Renders the removal a single child component.
     * 
     * @param {Echo.Update.ComponentUpdate} update the update
     * @param {Echo.Component} child the removed child
     */
    _renderRemoveChild: function(update, child) {
        var index;
        if (this._childPanes[0] && this._childPanes[0].component == child) {
            index = 0;
        } else if (this._childPanes[1] && this._childPanes[1].component == child) {
            index = 1;
        } else {
            // Do nothing (component was never rendered within the SplitPane).
            return;
        }

        this._childPanes[index] = null;
        
        Core.Web.DOM.removeNode(this._paneDivs[index]);
        this._paneDivs[index] = null;
    },
        
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        var fullRender = false,
            i;
        
        if (this._hasRelocatedChildren()) {
            fullRender = true;
        } else if (update.hasUpdatedProperties() || update.hasUpdatedLayoutDataChildren()) {
            if (update.isUpdatedPropertySetIn({ separatorPosition: true })) {
                this._requested = this.component.render("separatorPosition");
            } else {
                fullRender = true;
            }
        }
        
        if (!fullRender && (update.hasAddedChildren() || update.hasRemovedChildren())) {
            var removedChildren = update.getRemovedChildren();
            if (removedChildren) {
                // Remove children.
                for (i = 0; i < removedChildren.length; ++i) {
                    this._renderRemoveChild(update, removedChildren[i]);
                }
            }
            var addedChildren = update.getAddedChildren();
            if (addedChildren) {
                // Add children.
                for (i = 0; i < addedChildren.length; ++i) {
                    this._renderAddChild(update, addedChildren[i], this.component.indexOf(addedChildren[i])); 
                }
            }
        }
        
        if (fullRender) {
            var element = this._splitPaneDiv;
            var containerElement = element.parentNode;
            Echo.Render.renderComponentDispose(update, update.parent);
            containerElement.removeChild(element);
            this.renderAdd(update, containerElement);
        }
        
        return fullRender;
    }
});
/**
 * Component rendering peer: TextComponent.
 * This class should not be extended by developers, the implementation is subject to change.
 * 
 * Note that this component has workarounds for issues with percentage-width text fields/areas in various browsers.
 * Percentage widths are reduced based on container size and border width to ensure overall width of component meets
 * user-set percent width specification.  Workaround is also provided for Internet Explorer 6's growing textarea bug. 
 */
Echo.Sync.TextComponent = Core.extend(Echo.Render.ComponentSync, {
    
    $abstract: true,
    
    $virtual: {
        
        getSupportedPartialProperties: function() {
           return ["text", "editable", "selectionStart", "selectionEnd"];
        },
        
        /**
         * Processes a focus blur event.
         * Overriding implementations must invoke.
         */
        processBlur: function(e) {
            this._focused = false;
            this._storeSelection();
            this._storeValue();
            return true;
        },
        
        /**
         * Processes a focus event. Notifies application of focus.
         * Overriding implementations must invoke.
         */
        processFocus: function(e) {
            this._focused = true;
            if (this.client) {
                if (this.component.isActive()) {
                    this.client.application.setFocusedComponent(this.component);
                } else {
                    this._resetFocus();
                }
            }
            return false;
        },
            
        /**
         * Invoked to ensure that input meets requirements of text field.  Default implementation ensures input
         * does not exceed maximum length.
         */
        sanitizeInput: function() {
            var maximumLength = this.component.render("maximumLength", -1);
            if (maximumLength >= 0) {
                if (this.input.value && this.input.value.length > maximumLength) {
                    this.input.value = this.input.value.substring(0, maximumLength);
                }
            }
        }
    },
    
    /**
     * The rendered "input" element (may be a textarea).
     * @type Element
     */
    input: null,
    
    /**
     * Container element which wraps the input element.
     * This element is only rendered for text areas, to mitigate IE "growing" text area bug.
     * @type Element
     */
    container: null,
    
    /**
     * Actual focus state of component, based on received DOM focus/blur events.
     * @type Boolean
     */
    _focused: false,
    
    /**
     * The last processed value of the text field, i.e., the last value of the input field
     * that was stored in the component hierarchy.  When input is provided while restrictions
     * are in place, this value is not updated.
     */
    _lastProcessedValue: null,
    
    /**
     * Flag indicating whether width has been set as a percentage.
     * @type Boolean
     */
    percentWidth: false,
    
    /**
     * First index of cursor selection.
     * @type Nunber
     */
    _selectionStart: 0,
    
    /**
     * Last index of cursor selection.
     * @type Nunber
     */
    _selectionEnd: 0,
    
    /**
     * Renders style information: colors, borders, font, insets, etc.
     * Sets percentWidth flag.
     */
    _renderStyle: function() {
        if (this.component.isRenderEnabled()) {
            Echo.Sync.renderComponentDefaults(this.component, this.input);
            Echo.Sync.Border.render(this.component.render("border"), this.input);
            Echo.Sync.FillImage.render(this.component.render("backgroundImage"), this.input);
            if (this.input.readOnly) {
                Echo.Sync.Color.render(Echo.Sync.getEffectProperty(this.component, "foreground", "readOnlyForeground", true),
                    this.input, "color");
                Echo.Sync.Color.render(Echo.Sync.getEffectProperty(this.component, "background", "readOnlyBackground", true),
                    this.input, "backgroundColor");
                Echo.Sync.Border.render(Echo.Sync.getEffectProperty(this.component, "border", "readOnlyBorder", true),
                    this.input);
                Echo.Sync.Font.render(Echo.Sync.getEffectProperty(this.component, "font", "readOnlyFont", true),
                    this.input);
                Echo.Sync.FillImage.render(Echo.Sync.getEffectProperty(this.component,
                    "backgroundImage", "readOnlyBackgroundImage", true), this.input);
            }
        } else {
            Echo.Sync.LayoutDirection.render(this.component.getLayoutDirection(), this.input);
            Echo.Sync.Color.render(Echo.Sync.getEffectProperty(this.component, "foreground", "disabledForeground", true), 
                    this.input, "color");
            Echo.Sync.Color.render(Echo.Sync.getEffectProperty(this.component, "background", "disabledBackground", true), 
                    this.input, "backgroundColor");
            Echo.Sync.Border.render(Echo.Sync.getEffectProperty(this.component, "border", "disabledBorder", true), 
                    this.input);
            Echo.Sync.Font.render(Echo.Sync.getEffectProperty(this.component, "font", "disabledFont", true), 
                    this.input);
            Echo.Sync.FillImage.render(Echo.Sync.getEffectProperty(this.component, 
                    "backgroundImage", "disabledBackgroundImage", true), this.input);
        }
        Echo.Sync.Alignment.render(this.component.render("alignment"), this.input, false, null);
        Echo.Sync.Insets.render(this.component.render("insets"), this.input, "padding");
        var width = this.component.render("width");
        this.percentWidth = Echo.Sync.Extent.isPercent(width);
        if (width) {
            if (this.percentWidth) {
                // Set width very small temporarily, renderDisplay will correct.
                this.input.style.width = "5px";
            } else {
                this.input.style.width = Echo.Sync.Extent.toCssValue(width, true);
            }
        }
        var height = this.component.render("height");
        if (height) {
            this.input.style.height = Echo.Sync.Extent.toCssValue(height, false);
        }
        var toolTipText = this.component.render("toolTipText");
        if (toolTipText) {
            this.input.title = toolTipText;
        }
    },
    
    /**
     * Registers event handlers on the text component.
     */
    _addEventHandlers: function() {
        Core.Web.Event.add(this.input, "keydown", Core.method(this, this._processKeyDown), false);
        Core.Web.Event.add(this.input, "click", Core.method(this, this._processClick), false);
        Core.Web.Event.add(this.input, "focus", Core.method(this, this.processFocus), false);
        Core.Web.Event.add(this.input, "blur", Core.method(this, this.processBlur), false);
    },
    
    /**
     * Reduces a percentage width by a number of pixels based on the container size.
     * 
     * @param {Number} percentValue the percent span
     * @param {Number} reducePixels the number of pixels by which the percent span should be reduced
     * @param {Number} containerPixels the size of the container element 
     */
    _adjustPercentWidth: function(percentValue, reducePixels, containerPixels) {
        var value = (100 - (100 * reducePixels / containerPixels)) * percentValue / 100;
        return value > 0 ? value : 0;
    },
    
    /** @see Echo.Render.ComponentSync#clientKeyDown */
    clientKeyDown: function(e) {
        this._storeValue(e);
        if (this.client && this.component.isActive()) {
            if (!this.component.doKeyDown(e.keyCode)) {
                Core.Web.DOM.preventEventDefault(e.domEvent);
            }
        }
        return true;
    },
    
    /** @see Echo.Render.ComponentSync#clientKeyPress */
    clientKeyPress: function(e) {
        this._storeValue(e);
        if (this.client && this.component.isActive()) {
            if (!this.component.doKeyPress(e.keyCode, e.charCode)) {
                Core.Web.DOM.preventEventDefault(e.domEvent);
            }
        }
        return true;
    },
    
    /** @see Echo.Render.ComponentSync#clientKeyUp */
    clientKeyUp: function(e) {
        this._storeSelection();
        this._storeValue(e);
        return true;
    },

    /**
     * Processes a mouse click event. Notifies application of focus.
     */
    _processClick: function(e) {
        if (!this.client || !this.component.isActive()) {
            Core.Web.DOM.preventEventDefault(e);
            return true;
        }
        this.client.application.setFocusedComponent(this.component);
        this._storeSelection();
        return false;
    },

    /**
     * Keydown event handler to suppress input when component is inactive
     * (clientKeyXXX() methods will not be invoked, even though component can potentially be focused).
     * 
     * @param e the event
     */
    _processKeyDown: function(e) {
        if (!this.component.isActive()) {
            Core.Web.DOM.preventEventDefault(e);
        }
        return true;
    },
    
    /**
     * Event listener to process input after client input restrictions have been cleared. 
     */
    _processRestrictionsClear: function() {
        if (!this.client) {
            // Component has been disposed, do nothing.
            return;
        }

        if (!this.client.verifyInput(this.component) || this.input.readOnly) {
            // Client is unwilling to accept input or component has been made read-only:
            // Reset value of text field to text property of component.
            this.input.value = this.component.get("text");
            return;
        }

        // All-clear, store current text value.
        this.component.set("text", this.input.value, true);
    },

    /**
     * Forcibly resets focus.  Creates hidden focusable text field, focuses it, destroys it.  Then invokes
     * Echo.Render.updateFocus() to re-focus correct component.
     */
    _resetFocus: function() {
        var div = document.createElement("div");
        div.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;";
        var input = document.createElement("input");
        input.type = "text";
        div.appendChild(input);
        document.body.appendChild(div);
        input.focus();
        document.body.removeChild(div);
        div = null;
        input = null;
        this.client.forceRedraw();
        Echo.Render.updateFocus(this.client);
    },
    
    /**
     * Adds the input element to its parent in the DOM.
     * Wraps the element in a special container DIV if necessary to appease Internet Explorer's various text field/area bugs,
     * including percent-based text areas inducing scroll bars and the IE6 percentage width "growing" text area bug.
     * 
     * @param parentElement the parent element
     */
    renderAddToParent: function(parentElement) {
        if (Core.Web.Env.ENGINE_MSHTML && this.percentWidth) {
            this.container = document.createElement("div");
            this.container.appendChild(this.input);
            parentElement.appendChild(this.container);
        } else {
            parentElement.appendChild(this.input);
        }
    },
    
    /** @see Echo.Render.ComponentSync#renderDisplay */
    renderDisplay: function() {
        var width = this.component.render("width");
        if (width && Echo.Sync.Extent.isPercent(width) && this.input.parentNode.offsetWidth) {
            // If width is a percentage, reduce rendered percent width based on measured container size and border width,
            // such that border pixels will not make the component wider than specified percentage.
            var border = this.component.render("border");
            var borderSize = border ? 
                    (Echo.Sync.Border.getPixelSize(border, "left") + Echo.Sync.Border.getPixelSize(border, "right")) : 4;
            var insets = this.component.render("insets");
            if (insets) {
                var insetsPx = Echo.Sync.Insets.toPixels(insets);
                borderSize += insetsPx.left + insetsPx.right;
            }
            
            // Perform fairly ridiculous browser-specific adjustments.
            if (Core.Web.Env.ENGINE_MSHTML) {
                // Add additional 1px for IE.
                borderSize += 1;
                // Add default windows scroll bar width to border size for Internet Explorer browsers. Seems to be not
                // needed in IE versions 8 and higher and instead causes problems when text components are embedded in
                // e.g. tables.
                if (Core.Web.Env.BROWSER_VERSION_MAJOR < 8) {
                    if (this.container) {
                        this.container.style.width = this._adjustPercentWidth(100, Core.Web.Measure.SCROLL_WIDTH,
                                this.input.parentNode.offsetWidth) + "%";
                    } else {
                        borderSize += Core.Web.Measure.SCROLL_WIDTH;
                    }
                }
            } else if (Core.Web.Env.BROWSER_CHROME && this.input.nodeName.toLowerCase() == "textarea") {
                // Add additional 3px to TEXTAREA elements for Chrome.
                borderSize += 3;
            } else if (Core.Web.Env.BROWSER_SAFARI && this.input.nodeName.toLowerCase() == "input") {
                // Add additional 1px to INPUT elements for Safari.
                borderSize += 1;
            } else if (Core.Web.Env.ENGINE_PRESTO) {
                // Add additional 1px to all for Opera.
                borderSize += 1;
            }
            
            this.input.style.width = this._adjustPercentWidth(parseInt(width, 10), borderSize, 
                    this.input.parentNode.offsetWidth) + "%";
        }
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        Core.Web.Event.removeAll(this.input);
        this._focused = false;
        this.input = null;
        this.container = null;
    },
    
    /** @see Echo.Render.ComponentSync#renderFocus */
    renderFocus: function() {
        if (this._focused) {
            return;
        }
            
        this._focused = true;
        Core.Web.DOM.focusElement(this.input);
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        var fullRender = !Core.Arrays.containsAll(this.getSupportedPartialProperties(), update.getUpdatedPropertyNames(), true);
    
        if (fullRender) {
            var element = this.container ? this.container : this.input;
            var containerElement = element.parentNode;
            this.renderDispose(update);
            containerElement.removeChild(element);
            this.renderAdd(update, containerElement);
        } else {
            if (update.hasUpdatedProperties()) {
                var textUpdate = update.getUpdatedProperty("text");
                if (textUpdate) {
                    var newValue = textUpdate.newValue == null ? "" : textUpdate.newValue;
                    if (newValue != this._lastProcessedValue) {
                        this.input.value = newValue;
                        this._lastProcessedValue = newValue;
                    }
                }
                var editableUpdate = update.getUpdatedProperty("editable");
                if (editableUpdate != null) {
                    this.input.readOnly = !editableUpdate.newValue;
                    this._renderStyle(this.input);
                }
            }
        }
        
        return false; // Child elements not supported: safe to return false.
    },

    /**
     * Stores the selection/cursor position within the input field.
     */
    _storeSelection: function() {
        var range, measureRange;
        if (!this.component) {
            return;
        }
        
        if (!Core.Web.Env.NOT_SUPPORTED_INPUT_SELECTION) {
            this._selectionStart = this.input.selectionStart;
            this._selectionEnd = this.input.selectionEnd;
        } else if (Core.Web.Env.PROPRIETARY_IE_RANGE) {
            range = document.selection.createRange();
            if (range.parentElement() != this.input) {
                return;
            }
            measureRange = range.duplicate();
            if (this.input.nodeName.toLowerCase() == "textarea") {
                measureRange.moveToElementText(this.input);
            } else {
                measureRange.expand("textedit");
            }
            measureRange.setEndPoint("EndToEnd", range);
            this._selectionStart = measureRange.text.length - range.text.length;
            this._selectionEnd = this._selectionStart + range.text.length;
        } else {
            return;
        }
        this.component.set("selectionStart", this._selectionStart, true);
        this.component.set("selectionEnd", this._selectionEnd, true);
    },
    
    /**
     * Stores the current value of the input field, if the client will allow it.
     * If the client will not allow it, but the component itself is active, registers
     * a restriction listener to be notified when the client is clear of input restrictions
     * to store the value later.
     * 
     * @param keyEvent the user keyboard event which triggered the value storage request (optional)
     */
    _storeValue: function(keyEvent) {
        if (!this.client || !this.component.isActive()) {
            if (keyEvent) {
                // Prevent input.
                Core.Web.DOM.preventEventDefault(keyEvent);
            }
            return;
        }

        this.sanitizeInput();
        
        if (!this.client.verifyInput(this.component)) {
            // Component is willing to receive input, but client is not ready:  
            // Register listener to be notified when client input restrictions have been removed, 
            // but allow the change to be reflected in the text field temporarily.
            this.client.registerRestrictionListener(this.component, Core.method(this, this._processRestrictionsClear)); 
            return;
        }

        // Component and client are ready to receive input, set the component property and/or fire action event.
        this.component.set("text", this.input.value, true);
        this._lastProcessedValue = this.input.value;
        
        if (keyEvent && keyEvent.keyCode == 13 && keyEvent.type == "keydown") {
            this.component.doAction();
        }
    }
});

/**
 * Component rendering peer: TextArea
 */
Echo.Sync.TextArea = Core.extend(Echo.Sync.TextComponent, {

    $load: function() {
        Echo.Render.registerPeer("TextArea", this);
    },

    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this.input = document.createElement("textarea");
        this.input.id = this.component.renderId;
        if (!this.component.render("editable", true)) {
            this.input.readOnly = true;
        }
        this._renderStyle(this.input);
        this.input.style.overflow = "auto";
        this._addEventHandlers(this.input);
        if (this.component.get("text")) {
            this.input.value = this.component.get("text");
        }
        this.renderAddToParent(parentElement);
    }
});

/**
 * Component rendering peer: TextField
 */
Echo.Sync.TextField = Core.extend(Echo.Sync.TextComponent, {
    
    $load: function() {
        Echo.Render.registerPeer("TextField", this);
    },
    
    $virtual: {
        
        /** 
         * Input element type, either "text" or "password"
         * @type String 
         */
        _type: "text"
    },

    /** @see Echo.Render.ComponentSync#getFocusFlags */
    getFocusFlags: function() {
        return Echo.Render.ComponentSync.FOCUS_PERMIT_ARROW_UP | Echo.Render.ComponentSync.FOCUS_PERMIT_ARROW_DOWN;
    },

    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this.input = document.createElement("input");
        this.input.id = this.component.renderId;
        if (!this.component.render("editable", true)) {
            this.input.readOnly = true;
        }
        this.input.type = this._type;
        var maximumLength = this.component.render("maximumLength", -1);
        if (maximumLength >= 0) {
            this.input.maxLength = maximumLength;
        }
        this._renderStyle(this.input);
        this._addEventHandlers(this.input);
        if (this.component.get("text")) {
            this.input.value = this.component.get("text");
        }
        
        this.renderAddToParent(parentElement);
    },

    /**
     * Allows all input.
     * @see Echo.Sync.TextComponent#sanitizeInput
     */
    sanitizeInput: function() {
        // allow all input
    }
});

/**
 * Component rendering peer: PasswordField
 */
Echo.Sync.PasswordField = Core.extend(Echo.Sync.TextField, {
    
    $load: function() {
        Echo.Render.registerPeer("PasswordField", this);
    },
    
    /** @see Echo.Sync.TextField#_type */
    _type: "password"
});
/**
 * Component rendering peer: ToggleButton.
 * This class should not be extended by developers, the implementation is subject to change.
 */
Echo.Sync.ToggleButton = Core.extend(Echo.Sync.Button, {
    
    $load: function() {
        Echo.Render.registerPeer("ToggleButton", this);
    },
    
    $abstract: {
        
        /** The type setting for the input form element (i.e. "radio" or "checkbox"). */
        inputType: null
    },
    
    /** 
     * Selection state.
     * @type Boolean
     */
    _selected: false,
    
    /**
     * The DOM element which represents the button's state.
     * 
     * @type Element
     */
    _stateElement: null,
    
    /** @see Echo.Sync.Button#doAction */
    doAction: function() {
        this.setSelected(!this._selected);
        Echo.Sync.Button.prototype.doAction.call(this);
    },
    
    /** 
     * Returns the appropriate state icon for the given state of the control (based on disabled and selected state).
     * 
     * @param {Boolean} rollover flag indicating whether the rollover icon should be retrieved
     * @param {Boolean} pressed flag indicating whether the pressed icon should be retrieved
     * @return the state icon
     * @type #ImageReference
     */
    getStateIcon: function(rollover, pressed) {
        var icon;
        if (this._selected) {
            icon = Echo.Sync.getEffectProperty(this.component, "selectedStateIcon", "disabledSelectedStateIcon", !this.enabled);
            if (icon) {
                if (pressed) {
                    icon = this.component.render("pressedSelectedStateIcon", icon); 
                } else if (rollover) {
                    icon = this.component.render("rolloverSelectedStateIcon", icon);
                }
            }
        }
        if (!icon) {
            icon = Echo.Sync.getEffectProperty(this.component, "stateIcon", "disabledStateIcon", !this.enabled);
            if (icon) {
                if (pressed) {
                    icon = this.component.render("pressedStateIcon", icon); 
                } else if (rollover) {
                    icon = this.component.render("rolloverStateIcon", icon);
                }
            }
        }
        return icon;
    },
    
    /** Processes a change event from the state INPUT element (checkbox/radio form control itself). */
    _processStateChange: function(e) {
        this._updateStateElement();
    },
    
    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this._selected = this.component.render("selected");
        
        Echo.Sync.Button.prototype.renderAdd.call(this, update, parentElement);
    },
    
    /** @see Echo.Sync.Button.renderContent */
    renderContent: function() {
        var text = this.component.render("text");
        var icon = this.component.render("icon");
        var orientation, margin, tct;
        
        var entityCount = (text != null ? 1 : 0) + (icon ? 1 : 0) + 1; // +1 for state element.
        if (entityCount == 1) {
            if (text != null) {
                this.renderButtonText(this.div, text);
            } else if (icon) {
                this.iconImg = this.renderButtonIcon(this.div, icon);
            } else {
                this._stateElement = this._renderButtonState(this.div);
            }
        } else if (entityCount == 2) {
            orientation = Echo.Sync.TriCellTable.getInvertedOrientation(this.component, "statePosition", "leading");
            margin = this.component.render("stateMargin", Echo.Sync.Button._defaultIconTextMargin);
            tct = new Echo.Sync.TriCellTable(orientation, Echo.Sync.Extent.toPixels(margin));
            if (text != null) {
                this.renderButtonText(tct.tdElements[0], text);
                if (icon) {
                    this.iconImg = this.renderButtonIcon(tct.tdElements[1], icon);
                } else {
                    this._stateElement = this._renderButtonState(tct.tdElements[1]);
                }
            } else {
                this.iconImg = this.renderButtonIcon(tct.tdElements[0], icon);
                this._stateElement = this._renderButtonState(tct.tdElements[1]);
            }
            this.div.appendChild(tct.tableElement);
        } else if (entityCount == 3) {
            orientation = Echo.Sync.TriCellTable.getOrientation(this.component, "textPosition");
            margin = this.component.render("iconTextMargin", Echo.Sync.Button._defaultIconTextMargin);
            var stateOrientation = Echo.Sync.TriCellTable.getInvertedOrientation(this.component, "statePosition", "leading");
            var stateMargin = this.component.render("stateMargin", Echo.Sync.Button._defaultIconTextMargin);
            tct = new Echo.Sync.TriCellTable(orientation, 
                    Echo.Sync.Extent.toPixels(margin), stateOrientation, Echo.Sync.Extent.toPixels(stateMargin));
            this.renderButtonText(tct.tdElements[0], text);
            this.iconImg = this.renderButtonIcon(tct.tdElements[1], icon);
            this._stateElement = this._renderButtonState(tct.tdElements[2]);
            this.div.appendChild(tct.tableElement);
        }
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        Echo.Sync.Button.prototype.renderDispose.call(this, update);
        if (this._stateElement) {
            Core.Web.Event.removeAll(this._stateElement);
            this._stateElement = null;
        }
    },
    
    /**
     * Renders the state element, appending it to the specified parent.
     *
     * @param {Element} parent the parent DOM element in which the state element should be rendered
     * @return the created state element
     * @type Element
     */
    _renderButtonState: function(parent) {
        var stateIcon = this.getStateIcon();
        var stateElement;
        if (stateIcon) {
            stateElement = document.createElement("img");
            Echo.Sync.ImageReference.renderImg(stateIcon, stateElement);
        } else {
            stateElement = document.createElement("input");
            stateElement.type = this.inputType;
            if (this.inputType == "radio") {
                stateElement.name = "__echo_" + Echo.Sync.RadioButton._nextNameId++;
            }
            stateElement.defaultChecked = this._selected ? true : false;
            stateElement.disabled = !this.enabled;
            Core.Web.Event.add(stateElement, "change", Core.method(this, this._processStateChange), false);
            Core.Web.Event.add(this.div, "click", Core.method(this, this._processStateChange), false);
        }
        parent.appendChild(stateElement);
        var stateAlignment = this.component.render("stateAlignment"); 
        if (stateAlignment) {
            Echo.Sync.Alignment.render(stateAlignment, parent, true, this.component);
        }
        
        return stateElement;
    },
    
    /** @see Echo.Sync.Button#setHighlightState */
    setHighlightState: function(rollover, pressed) {
        Echo.Sync.Button.prototype.setHighlightState.call(this, rollover, pressed);
        var stateIcon = this.getStateIcon(rollover, pressed);
        if (stateIcon) {
            var url = Echo.Sync.ImageReference.getUrl(stateIcon);
            if (this._stateElement.src != url) {
                this._stateElement.src = url;
            }
        }
    },
    
    /**
     * Selects or deselects this button.
     * 
     * @param newState {Boolean} the new selection state
     */
    setSelected: function(newState) {
        if (this._selected == newState) {
            return;
        }
        this._selected = newState;
        this.component.set("selected", newState);
        
        this._updateStateElement();
    },

    /**
     * Updates the image/checked state of the state element in response to the state having changed.
     */
    _updateStateElement: function() {
        var stateIcon = this.getStateIcon();
        if (stateIcon) {
            this._stateElement.src = Echo.Sync.ImageReference.getUrl(stateIcon);
        } else {
            this._stateElement.checked = this._selected ? true : false;
        }
    }
});

/**
 * Component rendering peer: CheckBox
 */
Echo.Sync.CheckBox = Core.extend(Echo.Sync.ToggleButton, {
    
    $load: function() {
        Echo.Render.registerPeer("CheckBox", this);
    },
    
    /** @see Echo.Sync.ToggleButton#inputType */
    inputType: "checkbox"
});

/**
 * Component rendering peer: RadioButton
 */
Echo.Sync.RadioButton = Core.extend(Echo.Sync.ToggleButton, {

    $static: {
    
        /** Next sequentially assigned identifier for radio button groups. */
        _nextNameId: 0,
        
        /**
         * Contains mappings from RadioButton render ids to Echo.Sync.RadioButton.Group objects.
         * 
         * @type Core.Arrays.LargeMap
         */
        _groups: new Core.Arrays.LargeMap()
    },

    $load: function() {
        Echo.Render.registerPeer("RadioButton", this);
    },
    
    /** @see Echo.Sync.ToggleButton#inputType */
    inputType: "radio",
    
    /** 
     * The group to which this radio button belongs.
     * @type Echo.Sync.RadioButton.Group
     */
    _group: null,

    /** @see Echo.Sync.Button#doAction */
    doAction: function() {
        if (this._group) {
            this._group.deselect();
        }
        Echo.Sync.ToggleButton.prototype.doAction.call(this);
    },

    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        var groupId = this.component.render("group");
        if (groupId != null) {
            var group = Echo.Sync.RadioButton._groups.map[groupId];
            if (!group) {
                group = new Echo.Sync.RadioButton.Group(groupId);
                Echo.Sync.RadioButton._groups.map[groupId] = group;
            }
            group.add(this);
            this._group = group;
        }
        Echo.Sync.ToggleButton.prototype.renderAdd.call(this, update, parentElement);
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        Echo.Sync.ToggleButton.prototype.renderDispose.call(this, update);
        if (this._group) {
            this._group.remove(this);
            if (this._group.size() === 0) {
                Echo.Sync.RadioButton._groups.remove(this._group.id);
            }
            this._group = null;
        }
    }
});

/**
 * Representation of a collection of radio buttons, only one of which
 * may be selected at a given time.
 */
Echo.Sync.RadioButton.Group = Core.extend({

    /** Group id. */
    id: null,
    
    /** Array of buttons (peers) in this group. */
    _buttons: null,

    /**
     * Creates a RadioButton group.
     * 
     * @param id {String} the id
     */
    $construct: function(id) {
        this.id = id;
        this._buttons = [];
    },
    
    /**
     * Adds the specified button to this button group.
     *
     * @param {Echo.Render.ComponentSync.ToggleButton} button the button
     */
    add: function(button) {
        this._buttons.push(button);
    },
    
    /**
     * Deselects all buttons in this button group.
     */
    deselect: function() {
        for (var i = 0; i < this._buttons.length; ++i) {
            this._buttons[i].setSelected(false);
        }
    },
    
    /**
     * Removes the specified button from this button group.
     * 
     * @param {Echo.Render.ComponentSync.ToggleButton} button the button
     */
    remove: function(button) {
        // Find index of button in array.
        var buttonIndex = -1;
        for (var i = 0; i < this._buttons.length; ++i) {
            if (this._buttons[i] == button) {
                buttonIndex = i;
                break;
            }
        }
        
        if (buttonIndex == -1) {
            // Button does not exist in group.
            throw new Error("No such button: " + button.component.renderId);
        }
        
        if (this._buttons.length == 1) {
            // Array will now be empty.
            this._buttons = [];
        } else {
            // Buttons remain, remove button from button group.
            this._buttons[buttonIndex] = this._buttons[this._buttons.length - 1];
            this._buttons.length = this._buttons.length - 1;
        }
    },

    /**
     * Returns the number of buttons contained by this button group.
     * 
     * @return the number of buttons
     * @type Number
     */
    size: function() {
        return this._buttons.length;
    }
});
/**
 * Component rendering peer: WindowPane.
 * This class should not be extended by developers, the implementation is subject to change.
 */
Echo.Sync.WindowPane = Core.extend(Echo.Render.ComponentSync, {

    $static: {
    
        /** 
         * Array mapping CSS cursor types to indices of the _borderDivs property.
         * @type Array 
         */
        CURSORS: ["n-resize", "ne-resize", "e-resize", "se-resize", "s-resize", "sw-resize", "w-resize", "nw-resize"],
        
        /** Map containing properties whose update can be rendered without replacing component. */
        PARTIAL_PROPERTIES: {background: true, backgroundImage: true, border: true, closable: true, closeIcon: true, 
                closeIconInsets: true, controlsInsets: true, font: true, foreground: true, height: true, icon: true, 
                iconInsets: true, insets: true, maximizeEnabled: true, maximizeIcon: true, maximumHeight: true, 
                maximumWidth: true, minimizeEnabled: true, minimizeIcon: true, minimumHeight: true, 
                minimumWidth: true, movable: true, positionX: true, positionY: true, resizable: true, title: true, 
                titleBackground: true, titleBackgroundImage: true, titleFont: true, 
                titleForeground: true, titleHeight: true, titleInsets: true, width: true },
                
        /** Map containing properties whose update should not result in any rendering. */
        NON_RENDERED_PROPERTIES: { zIndex: true },
                
        /** 
         * Map containing position/size-related properties whose update can be rendered by moving/resizing the window.
         */
        PARTIAL_PROPERTIES_POSITION_SIZE: { positionX: true, positionY: true, width: true, height: true },
        
        /**
         * Fade runnable for fading in/out windows.
         */
        FadeRunnable: Core.extend(Core.Web.Scheduler.Runnable, {
            
            timeInterval: 20,
            repeat: true,
            
            /** 
             * Flag for fading in/out, set to true when fading out.
             * @type Boolean 
             */
            _directionOut: false,
            
            /** 
             * The DIV element being animated.
             * @type Element 
             */
            _div: null,
            
            /** 
             * Completion callback method to be invoked when animation completes.
             * @type Function 
             */
            _completeMethod: null,
            
            /**
             * Desired animation time in milliseconds.
             * @type Number
             */
            _time: null,
            
            /**
             * Creates a new <code>FadeRunnable</code>.
             * 
             * @param {Element} div the element being animated
             * @param {Boolean} directionOut the animation direction, in = false, out = true
             * @param {Number} the desired animation time, in milliseconds
             * @param {Function} the completion method to execute when the animation completes
             */
            $construct: function(div, directionOut, time, completeMethod) {
                this._directionOut = directionOut;
                this._div = div;
                this._completeMethod = completeMethod;
                this._time = time;
            },
            
            run: function() {
                if (!this._startTime) {
                    this._startTime = new Date().getTime();
                }
                var value = (new Date().getTime() - this._startTime) / this._time;
                if (value > 1) {
                    value = 1;
                }
                this._div.style.opacity = this._directionOut ? 1 - value : value;
                
                if (value === 1) {
                    this.repeat = false;
                    if (this._completeMethod) {
                        this._completeMethod();
                        this._completeMethod = null;
                    }
                }
            }
        })
    },
    
    $load: function() {
        Echo.Render.registerPeer("WindowPane", this);
    },
    
    /**
     * Flag indicating whether initial automatic sizing operation (which occurs on first invocation of 
     * <code>renderDisplay()</code> after <code>_renderAddFrame()</code>) has been completed.
     * @type Boolean
     */
    _initialRenderDisplayComplete: false,
    
    /**
     * Flag indicating whether the window has been displayed on the screen, i.e., whether CSS visibility property has
     * been set/any open effect has been started.
     */
    _displayed: false,

    /**
     * The user-requested bounds of the window.  Contains properties x, y, width, and height.  
     * Property values are extents.  Percentage values are valid.
     */
    _requested: null,
    
    /**
     * Rendered bounds of the window.  Contains properties x, y, width, and height.
     * Property values are integers.  Will differ from user-requested bounds in scenarios where space is not available
     * or user-requested values are otherwise out of range.
     */
    _rendered: null,
    
    /**
     * The rendered bounds of the window immediately prior to the active drag operation.
     */
    _dragInit: null,
    
    /**
     * The X/Y coordinates of the mouse when the active drag operation originated.
     */
    _dragOrigin: null,
    
    /**
     * X/Y directions in which to increment (decrement) size of window when moving mouse.
     * Used in resize operations.
     */ 
    _resizeIncrement: null,
    
    /**
     * The size of the region containing the window.
     * @type Core.Web.Measure.Bounds
     */
    _containerSize: null,

    /**
     * Method reference to <code>_processBorderMouseMove()</code>.
     * @type Function
     */
    _processBorderMouseMoveRef: null,

    /**
     * Method reference to <code>_processBorderMouseUp()</code>.
     * @type Function
     */
    _processBorderMouseUpRef: null,

    /**
     * Method reference to <code>_processTitleBarMouseMove()</code>.
     * @type Function
     */
    _processTitleBarMouseMoveRef: null,

    /**
     * Method reference to <code>_processTitleBarMouseUp()</code>.
     * @type Function
     */
    _processTitleBarMouseUpRef: null,

    /**
     * Array of control icon DOM elements.
     * @type Array
     */
    _controlIcons: null,
    
    /**
     * Overlay DIV which covers other elements (such as IFRAMEs) when dragging which may otherwise suppress events.
     * @type Element
     */
    _overlay: null,

    /**
     * The closing animation time, in milliseconds.  Stored in instance variable due to unavailability of 
     * application/stylesheet after disposal.
     * @type Number
     */
    _closeAnimationTime: null,
    
    /**
     * Flag indicating whether window is being "opened", i.e., if the most recent update has it being directly added to its
     * parent <code>ContentPane</code>.
     * @type Boolean
     */
    _opening: false,

    /**
     * Time at which window started to wait for image loading.  Null in the event that images have completed loading.
     * This property is used to hold display of the window until images have loaded, unless a certain amount of time
     * passes before images can load.
     * @type Number
     */
    _imageWaitStartTime: null,

    /**
     * Creates a <code>Echo.Sync.WindowPane<code>.
     */
    $construct: function() {
        this._processBorderMouseMoveRef = Core.method(this, this._processBorderMouseMove);
        this._processBorderMouseUpRef = Core.method(this, this._processBorderMouseUp);
        this._processTitleBarMouseMoveRef = Core.method(this, this._processTitleBarMouseMove);
        this._processTitleBarMouseUpRef = Core.method(this, this._processTitleBarMouseUp);
    },
    
    /**
     * Vertically centers the window icon.
     */
    _centerIcon: function() {
        if (!this._titleIconImg || !this._titleIconImg.complete || !this._titleIconImg.height) {
            return;
        }
        
        var insetsPx = Echo.Sync.Insets.toPixels(this.component.render("iconInsets"));
        var padHeight = parseInt(this._titleBarDiv.style.height, 10) - insetsPx.top - insetsPx.bottom - this._titleIconImg.height;
        
        if (padHeight <= 0) {
            // Title bar sized by icon+insets, make no vertical adjustment.
            return;
        }
        
        this._titleIconDiv.style.paddingTop = Math.floor(padHeight / 2) + "px";
    },
    
    /**
     * Listener for events fired from <code>Core.Web.Image.Monitor</code> as contained images within
     * the <code>WindowPane</code> load.
     */
    _imageLoadListener: function(e) {
        if (!this.component) { // Verify component still registered.
            return;
        }
        
        if (this._titleIconImgLoading && this._titleIconImg.complete) {
            this._titleIconImgLoading = false;
            this._titleBarDiv.style.height = "";
            this._titleBarHeight = new Core.Web.Measure.Bounds(this._titleBarDiv).height || 
                    Echo.Sync.Extent.toPixels(Echo.WindowPane.DEFAULT_TITLE_HEIGHT);
            this._titleBarDiv.style.height = this._titleBarHeight + "px";
            
            this._contentDiv.style.top = (this._contentInsets.top + this._titleBarHeight) + "px";
        }
        
        if (e.complete) {
            this._imageWaitStartTime = null;
        }
        
        Echo.Render.renderComponentDisplay(this.component);
    },
    
    /**
     * Updates the _requested object based on values from the component object.
     */
    _loadPositionAndSize: function() {
        this._requested = {
            x: this.component.render("positionX", "50%"),
            y: this.component.render("positionY", "50%"),
            contentWidth: this.component.render("contentWidth"),
            contentHeight: this.component.render("contentHeight")
        };
        
        this._requested.width = this.component.render("width", 
                this._requested.contentWidth ? null : Echo.WindowPane.DEFAULT_WIDTH);
        this._requested.height = this.component.render("height");
    },

    /**
     * Determines size of container and stores in this._containerSize property.
     */
    _loadContainerSize: function() {
        this._containerSize = this.component.parent.peer.getSize();
    },
    
    /**
     * Adds an overlay DIV at maximum z-index to cover any objects that will not provide mouseup feedback (e.g., IFRAMEs).
     */
    _overlayAdd: function() {
        if (this._overlay) {
            return;
        }
        this._overlay = document.createElement("div");
        this._overlay.style.cssText = "position:absolute;z-index:32600;width:100%;height:100%;";
        Echo.Sync.FillImage.render(this.client.getResourceUrl("Echo", "resource/Transparent.gif"), this._overlay);
        document.body.appendChild(this._overlay);
    },
    
    /**
     * Removes the overlay DIV.
     */
    _overlayRemove: function() {
        if (!this._overlay) {
            return;
        }
        document.body.removeChild(this._overlay);
        this._overlay = null;
    },
    
    /**
     * Processes a mouse-down event on the window border (resize drag).
     */
    _processBorderMouseDown: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return true;
        }

        // Prevent selections.
        Core.Web.dragInProgress = true;
        Core.Web.DOM.preventEventDefault(e);
        this._overlayAdd();
    
        this._loadContainerSize();
        this._dragInit = {
            x: this._rendered.x,
            y: this._rendered.y,
            width: this._rendered.width,
            height: this._rendered.height
        };
        
        this._dragOrigin = { x: e.clientX, y: e.clientY };
        
        switch (e.target) {
        case this._borderDivs[0]: this._resizeIncrement = { x:  0, y: -1 }; break; 
        case this._borderDivs[1]: this._resizeIncrement = { x:  1, y: -1 }; break; 
        case this._borderDivs[2]: this._resizeIncrement = { x:  1, y:  0 }; break; 
        case this._borderDivs[3]: this._resizeIncrement = { x:  1, y:  1 }; break; 
        case this._borderDivs[4]: this._resizeIncrement = { x:  0, y:  1 }; break; 
        case this._borderDivs[5]: this._resizeIncrement = { x: -1, y:  1 }; break; 
        case this._borderDivs[6]: this._resizeIncrement = { x: -1, y:  0 }; break; 
        case this._borderDivs[7]: this._resizeIncrement = { x: -1, y: -1 }; break;
        }
            
        Core.Web.Event.add(document.body, "mousemove", this._processBorderMouseMoveRef, true);
        Core.Web.Event.add(document.body, "mouseup", this._processBorderMouseUpRef, true);
    },
    
    /**
     * Processes a mouse-move event on the window border (resize drag).
     */
    _processBorderMouseMove: function(e) {
        this._setBounds({
            x: this._resizeIncrement.x == -1 ? this._dragInit.x + e.clientX - this._dragOrigin.x : null,
            y: this._resizeIncrement.y == -1 ? this._dragInit.y + e.clientY - this._dragOrigin.y : null,
            width: this._dragInit.width + (this._resizeIncrement.x * (e.clientX - this._dragOrigin.x)),
            height: this._dragInit.height + (this._resizeIncrement.y * (e.clientY - this._dragOrigin.y))
        }, true);
        Echo.Sync.FillImageBorder.renderContainerDisplay(this._div);
    },

    /**
     * Processes a mouse-up event on the window border (resize drag).
     */
    _processBorderMouseUp: function(e) {
        Core.Web.DOM.preventEventDefault(e);
        
        Core.Web.dragInProgress = false;
        this._overlayRemove();
    
        this._removeBorderListeners();
        
        this.component.set("positionX", this._rendered.x);
        this.component.set("positionY", this._rendered.y);
        this.component.set("width", this._rendered.width);
        this.component.set("height", this._rendered.height);
        
        this._requested = {
            x: this._rendered.x,
            y: this._rendered.y,
            width: this._rendered.width,
            height: this._rendered.height
        };
        
        Echo.Sync.FillImageBorder.renderContainerDisplay(this._div);
        Core.Web.VirtualPosition.redraw(this._contentDiv);
        Core.Web.VirtualPosition.redraw(this._maskDiv);
        Echo.Render.notifyResize(this.component);
    },
    
    /**
     * Processes a click event on the window controls (i.e. close/maximize/minimize). 
     */
    _processControlClick: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return true;
        }
        switch (e.registeredTarget._controlData.name) {
        case "close":
            this.component.userClose();
            break;
        case "maximize":
            this.component.userMaximize();
            Echo.Render.processUpdates(this.client);
            break;
        case "minimize":
            this.component.userMinimize();
            break;
        }
    },
    
    /**
     * Processes a mouse rollover enter event on a specific window control button. 
     */
    _processControlRolloverEnter: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return true;
        }
        Echo.Sync.ImageReference.renderImg(e.registeredTarget._controlData.rolloverIcon, e.registeredTarget.firstChild);
    },
    
    /**
     * Processes a mouse rollover exit event on a specific window control button. 
     */
    _processControlRolloverExit: function(e) {
        Echo.Sync.ImageReference.renderImg(e.registeredTarget._controlData.icon, e.registeredTarget.firstChild);
    },
    
    /**
     * <code>ContentPane</code>-specific method to allow component to remove.
     * 
     * @return true if a self-remove is being performed, or false if the parent <code>ContentPane</code> should
     *         immediately remove the <code>WindowPane</code>
     */
    renderContentPaneRemove: function(container, completeCallback) {
        if (this._closeAnimationTime > 0) {
            Core.Web.Scheduler.add(new Echo.Sync.WindowPane.FadeRunnable(container, true, this._closeAnimationTime, 
                    completeCallback));
            return true;
        } else {
            // Return false, declining to perform effect.  Do not invoke callback.
            return false;
        }
    },
    
    /**
     * Processes a key down event in the window.
     */
    clientKeyDown: function(e) {
        if (e.keyCode == 27) {
            if (this.component.render("closable", true)) {
                this.component.userClose();
                Core.Web.DOM.preventEventDefault(e.domEvent);
                return false;
            }
        }
        return true;
    },
    
    /**
     * Processes a (captured) focus click within the window region.
     */
    _processFocusClick: function(e) { 
        if (!this.client || !this.client.verifyInput(this.component)) {
            return true;
        }
        this.component.parent.peer.raise(this.component);
        return true;
    },
    
    /**
     * Processes a mouse down event on the window title bar (move drag).
     */
    _processTitleBarMouseDown: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return true;
        }
        
        // Ignore mouse down clicks on control icons.
        var target = e.target;
        while (target != e.registeredTarget) {
            if (target._controlData) {
                return;
            }
            target = target.parentNode;
        }
    
        // Raise window.
        this.component.parent.peer.raise(this.component);
        
        // Prevent selections.
        Core.Web.dragInProgress = true;
        Core.Web.DOM.preventEventDefault(e);
        this._overlayAdd();
    
        this._loadContainerSize();
        this._dragInit = { x: this._rendered.x, y: this._rendered.y };
        this._dragOrigin = { x: e.clientX, y: e.clientY };
    
        Core.Web.Event.add(document.body, "mousemove", this._processTitleBarMouseMoveRef, true);
        Core.Web.Event.add(document.body, "mouseup", this._processTitleBarMouseUpRef, true);
    },
    
    /**
     * Processes a mouse move event on the window title bar (move drag).
     */
    _processTitleBarMouseMove: function(e) {
        this._setBounds({
            x: this._dragInit.x + e.clientX - this._dragOrigin.x, 
            y: this._dragInit.y + e.clientY - this._dragOrigin.y
        }, true);
    },
    
    /**
     * Processes a mouse up event on the window title bar (move drag).
     */
    _processTitleBarMouseUp: function(e) {
        Core.Web.dragInProgress = false;
        this._overlayRemove();
    
        this._removeTitleBarListeners();
    
        this.component.set("positionX", this._rendered.x);
        this.component.set("positionY", this._rendered.y);
    
        this._requested.x = this._rendered.x;
        this._requested.y = this._rendered.y;
    },
    
    /**
     * Repositions and resizes the window based on the current bounds specified in this._rendered.
     * Performs no operation if this._rendered does not have width/height data.
     */
    _redraw: function() {
        if (this._rendered.width <= 0 || this._rendered.height <= 0) {
            // Do not render if window does not have set dimensions.
            return;
        }
        
        var borderSideWidth = this._rendered.width - this._borderInsets.left - this._borderInsets.right;
        var borderSideHeight = this._rendered.height - this._borderInsets.top - this._borderInsets.bottom;
    
        this._div.style.left = this._rendered.x + "px";
        this._div.style.top = this._rendered.y + "px";
        this._div.style.width = this._rendered.width + "px";
        this._div.style.height = this._rendered.height + "px";
    
        this._titleBarDiv.style.width = (this._rendered.width - this._contentInsets.left - this._contentInsets.right) + "px";
        
        Echo.Sync.FillImageBorder.renderContainerDisplay(this._div);
        Core.Web.VirtualPosition.redraw(this._contentDiv);
        Core.Web.VirtualPosition.redraw(this._maskDiv);
    },
    
    /**
     * Removes mouseup/mousemove listeners from border.  Invoked after resize drag has completed/on dispose.
     */
    _removeBorderListeners: function() {
        Core.Web.Event.remove(document.body, "mousemove", this._processBorderMouseMoveRef, true);
        Core.Web.Event.remove(document.body, "mouseup", this._processBorderMouseUpRef, true);
    },
    
    /**
     * Removes mouseup/mousemove listeners from title bar.  Invoked after move drag has completed/on dispose.
     */
    _removeTitleBarListeners: function() {
        Core.Web.Event.remove(document.body, "mousemove", this._processTitleBarMouseMoveRef, true);
        Core.Web.Event.remove(document.body, "mouseup", this._processTitleBarMouseUpRef, true);
    },
    
    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this._opening = update.parent == this.component.parent;
        this._rtl = !this.component.getRenderLayoutDirection().isLeftToRight();
        this._closeAnimationTime = Core.Web.Env.NOT_SUPPORTED_CSS_OPACITY ? 0 : this.component.render("closeAnimationTime", 0);
        
        // Create content DIV.
        // Content DIV will be appended to main DIV by _renderAddFrame().
        this._contentDiv = document.createElement("div");

        // Render child component, add to content DIV.
        var componentCount = this.component.getComponentCount();
        if (componentCount == 1) {
            Echo.Render.renderComponentAdd(update, this.component.getComponent(0), this._contentDiv);
        } else if (componentCount > 1) {
            throw new Error("Too many children: " + componentCount);
        }
    
        // Render Internet Explorer 6-specific windowed control-blocking IFRAME ("mask DIV").
        // Mask DIV will be added to main DIV by _renderAddFrame().
        if (Core.Web.Env.QUIRK_IE_SELECT_Z_INDEX) {
            // Render Select Field Masking Transparent IFRAME.
            this._maskDiv = document.createElement("div");
            this._maskDiv.style.cssText = 
                    "filter:alpha(opacity=0);z-index:1;position:absolute;left:0,right:0,top:0,bottom:0,borderWidth:0;";
            var maskIFrameElement = document.createElement("iframe");
            maskIFrameElement.style.cssText = "width:100%;height:100%;";
            maskIFrameElement.src = this.client.getResourceUrl("Echo", "resource/Blank.html");
            this._maskDiv.appendChild(maskIFrameElement);
        }
    
        Echo.Sync.LayoutDirection.render(this.component.getLayoutDirection(), this._div);
        
        // Render window frame.
        this._renderAddFrame(parentElement);
    },
    
    /**
     * Renders the frame of the window.  Does not alter window content.  This method may be invoked after the window has 
     * initially been rendered to update the window content.
     * _renderDisposeFrame() must be invoked between invocations of _renderAddFrame() to dispose resources.
     * _contentDiv will be appended to rendered DOM structure.
     * 
     * @param {Element} parentElement the parent element to which the rendered frame should be appended 
     */
    _renderAddFrame: function(parentElement) {
        this._initialRenderDisplayComplete = false;
        this._loadPositionAndSize();

        // Load property states.
        this._minimumWidth = Echo.Sync.Extent.toPixels(
                this.component.render("minimumWidth", Echo.WindowPane.DEFAULT_MINIMUM_WIDTH), true);
        this._minimumHeight = Echo.Sync.Extent.toPixels(
                this.component.render("minimumHeight", Echo.WindowPane.DEFAULT_MINIMUM_HEIGHT), false);
        this._maximumWidth = Echo.Sync.Extent.toPixels(this.component.render("maximumWidth"), true);
        this._maximumHeight = Echo.Sync.Extent.toPixels(this.component.render("maximumHeight"), false);
        this._resizable = this.component.render("resizable", true);
        var border = this.component.render("border", Echo.WindowPane.DEFAULT_BORDER);
        this._borderInsets = Echo.Sync.Insets.toPixels(border.borderInsets);
        this._contentInsets = Echo.Sync.Insets.toPixels(border.contentInsets);
        var movable = this.component.render("movable", true);
        var closable = this.component.render("closable", true);
        var maximizeEnabled = this.component.render("maximizeEnabled", false);
        var minimizeEnabled = this.component.render("minimizeEnabled", false);
        var hasControlIcons = closable || maximizeEnabled || minimizeEnabled;
        var fillImageFlags = this.component.render("ieAlphaRenderBorder") ? Echo.Sync.FillImage.FLAG_ENABLE_IE_PNG_ALPHA_FILTER : 0;
        
        // Create main component DIV.
        this._div = Echo.Sync.FillImageBorder.renderContainer(border, { absolute: true });
        this._div.id = this.component.renderId;
        this._div.tabIndex = "0";
        this._div.style.outlineStyle = "none";
        this._div.style.overflow = "hidden";
        this._div.style.zIndex = 1;
        if (!this._displayed) {
            this._div.style.visibility = "hidden";
        }
        
        this._borderDivs = Echo.Sync.FillImageBorder.getBorder(this._div);
        var mouseDownHandler = this._resizable ? Core.method(this, this._processBorderMouseDown) : null; 
        for (var i = 0; i < 8; ++i) {
            if (this._borderDivs[i]) {
                if (this._resizable) {
                    this._borderDivs[i].style.zIndex = 2;
                    this._borderDivs[i].style.cursor = Echo.Sync.WindowPane.CURSORS[i];
                    Core.Web.Event.add(this._borderDivs[i], "mousedown", mouseDownHandler, true);
                }
            }
        }
        
        // Render Title Bar
        
        var titleInsets = this.component.render("titleInsets", Echo.WindowPane.DEFAULT_TITLE_INSETS);
        
        this._titleBarDiv = document.createElement("div");
        this._titleBarDiv.style.position = "absolute";
        this._titleBarDiv.style.zIndex = 3;
        
        var icon = this.component.render("icon");
        if (icon) {
            this._titleIconDiv = document.createElement("div");
            this._titleIconDiv.style[Core.Web.Env.CSS_FLOAT] = this._rtl ? "right" : "left";
            
            // Set icon insets.  If icon insets are unset, apply outside setting of title insets  to outside side of icon.
            var iconInsets = this.component.render("iconInsets");
            if (iconInsets) {
                Echo.Sync.Insets.render(iconInsets, this._titleIconDiv, "padding");
            } else {
                var titleInsetsPx = Echo.Sync.Insets.toPixels(titleInsets);
                if (this._rtl) {
                    this._titleIconDiv.style.paddingRight = titleInsetsPx.right + "px";
                } else {
                    this._titleIconDiv.style.paddingLeft = titleInsetsPx.left + "px";
                }
            }
            
            this._titleBarDiv.appendChild(this._titleIconDiv);

            this._titleIconImg = document.createElement("img");
            Echo.Sync.ImageReference.renderImg(icon, this._titleIconImg);
            this._titleIconDiv.appendChild(this._titleIconImg);
            
            this._titleIconImgLoading = true;
        }

        var title = this.component.render("title");
        var titleTextDiv = document.createElement("div");
        if (icon) {
            titleTextDiv.style[Core.Web.Env.CSS_FLOAT] = this._rtl ? "right" : "left";
        }
        titleTextDiv.style.whiteSpace = "nowrap";
        Echo.Sync.Font.render(this.component.render("titleFont"), titleTextDiv);
        Echo.Sync.Insets.render(titleInsets, titleTextDiv, "padding");
        titleTextDiv.appendChild(document.createTextNode(title ? title : "\u00a0"));
        this._titleBarDiv.appendChild(titleTextDiv);
        
        var titleBarHeight = this.component.render("titleHeight");
        if (titleBarHeight) {
            this._titleBarHeight = Echo.Sync.Extent.toPixels(titleBarHeight);
        }
        if (!titleBarHeight) {
            this._titleBarHeight = new Core.Web.Measure.Bounds(this._titleBarDiv).height || 
                            Echo.Sync.Extent.toPixels(Echo.WindowPane.DEFAULT_TITLE_HEIGHT);
        }
    
        this._titleBarDiv.style.top = this._contentInsets.top + "px";
        this._titleBarDiv.style.left = this._contentInsets.left + "px";
        this._titleBarDiv.style.height = this._titleBarHeight + "px";
        this._titleBarDiv.style.overflow = "hidden";
        if (movable) {
            this._titleBarDiv.style.cursor = "move";
            Core.Web.Event.add(this._titleBarDiv, "mousedown", Core.method(this, this._processTitleBarMouseDown), true);
        }
    
        Echo.Sync.Color.render(this.component.render("titleForeground"), this._titleBarDiv, "color");
    
        var titleBackground = this.component.render("titleBackground");
        var titleBackgroundImage = this.component.render("titleBackgroundImage");
    
        if (titleBackground) {
            this._titleBarDiv.style.backgroundColor = titleBackground;
        }
        if (titleBackgroundImage) {
            Echo.Sync.FillImage.render(titleBackgroundImage, this._titleBarDiv);
        }
    
        if (!titleBackground && !titleBackgroundImage) {
            this._titleBarDiv.style.backgroundColor = Echo.WindowPane.DEFAULT_TITLE_BACKGROUND;
        }
        
        if (hasControlIcons) {
            this._controlDiv = document.createElement("div");
            this._controlDiv.style.cssText = "position:absolute;top:0;";
            this._controlDiv.style[this._rtl ? "left" : "right"] = 0;
            Echo.Sync.Insets.render(this.component.render("controlsInsets",  
                    Echo.WindowPane.DEFAULT_CONTROLS_INSETS), this._controlDiv, "margin");
            this._titleBarDiv.appendChild(this._controlDiv);

            // Close Button
            if (closable) {
                this._renderControlIcon("close", this.client.getResourceUrl("Echo", "resource/WindowPaneClose.gif"), "[X]");
            }
            if (maximizeEnabled) {
                this._renderControlIcon("maximize", this.client.getResourceUrl("Echo", "resource/WindowPaneMaximize.gif"), "[+]");
            }
            if (minimizeEnabled) {
                this._renderControlIcon("minimize", this.client.getResourceUrl("Echo", "resource/WindowPaneMinimize.gif"), "[-]");
            }
        }
        
        this._div.appendChild(this._titleBarDiv);
        
        // Add content to main DIV.  
        // The object this._contentDiv will have been created by renderAdd(). 
        // Note that overflow is set to 'hidden' if child is a pane component, this is necessary to workaround what
        // what is presumably a bug in Safari 3.0.x.  It should otherwise not be required.
        this._contentDiv.style.cssText = "position:absolute;z-index:2;top:" + 
                (this._contentInsets.top + this._titleBarHeight) + "px;bottom:" + this._contentInsets.bottom + "px;left:" + 
                this._contentInsets.left + "px;right:" + this._contentInsets.right + "px;" +
                "overflow:"+ ((this.component.children.length === 0 || this.component.children[0].pane) ? "hidden;" : "auto;");
        Echo.Sync.Font.renderClear(this.component.render("font"), this._contentDiv);
        if (this.component.children.length > 0 && !this.component.children[0].pane) {
            Echo.Sync.Insets.render(this.component.render("insets"), this._contentDiv, "padding");
        }
                
        Echo.Sync.Color.render(this.component.render("background", Echo.WindowPane.DEFAULT_BACKGROUND),
                this._contentDiv, "backgroundColor");
        Echo.Sync.Color.render(this.component.render("foreground", Echo.WindowPane.DEFAULT_FOREGROUND),
                this._contentDiv, "color");
        Echo.Sync.FillImage.render(this.component.render("backgroundImage"), this._contentDiv);
        this._div.appendChild(this._contentDiv);

        // Add Internet Explorer 6-specific windowed control-blocking IFRAME.
        if (Core.Web.Env.QUIRK_IE_SELECT_Z_INDEX) {
            this._div.appendChild(this._maskDiv);
        }
        Core.Web.Event.add(this._div, "click", 
                Core.method(this, this._processFocusClick), true);

        // Append main DIV to parent.
        parentElement.appendChild(this._div);
    },

    /**
     * Renders a specific control button icon.
     * 
     * @param {String} name the name of the control icon, used for both event identification and to
     *        retrieve icon property names from component (e.g., a value "close" will cause
     *        "closeIcon" and "closeRolloverIcon" properties of component to be used)
     * @param {#ImageReference} defaultIcon the default icon image to use in the event none is specified
     *        by the component
     * @param {String} altText the alternate text to display if no icon is available (and defaultIcon is null)
     */
    _renderControlIcon: function(name, defaultIcon, altText) {
        var controlDiv = document.createElement("div"),
            icon = this.component.render(name + "Icon", defaultIcon),
            rolloverIcon = this.component.render(name + "RolloverIcon");
 
        var controlSpacing = Echo.Sync.Extent.toCssValue(this.component.render("controlsSpacing", 
                Echo.WindowPane.DEFAULT_CONTROLS_SPACING));
        controlDiv.style.cssText = this._rtl ? ("float:left;cursor:pointer;margin-right:" + controlSpacing) :  
                ("float:right;cursor:pointer;margin-left:" + controlSpacing);
        Echo.Sync.Insets.render(this.component.render(name + "Insets"), controlDiv, "padding");

        if (icon) {
            var img = document.createElement("img");
            Echo.Sync.ImageReference.renderImg(icon, img);
            controlDiv.appendChild(img);
            if (rolloverIcon) {
                Core.Web.Event.add(controlDiv, "mouseover", Core.method(this, this._processControlRolloverEnter), false);
                Core.Web.Event.add(controlDiv, "mouseout", Core.method(this, this._processControlRolloverExit), false);
            }
        } else {
            controlDiv.appendChild(document.createTextNode(altText));
        }
        
        Core.Web.Event.add(controlDiv, "click", Core.method(this, this._processControlClick), false);

        this._controlDiv.appendChild(controlDiv);
        if (this._controlIcons == null) {
            this._controlIcons = [];
        }
        this._controlIcons.push(controlDiv);
        
        controlDiv._controlData = {
            name: name,
            icon: icon,
            rolloverIcon: rolloverIcon
        };
    },
    
    /** @see Echo.Render.ComponentSync#renderDisplay */
    renderDisplay: function() {
        this._loadContainerSize();
        this._setBounds(this._requested, false);
        Core.Web.VirtualPosition.redraw(this._contentDiv);
        Core.Web.VirtualPosition.redraw(this._maskDiv);
        this._centerIcon();

        var waitTime = parseInt(this.component.render("resourceTimeout"), 10) || Echo.WindowPane.DEFAULT_RESOURCE_TIMEOUT;
        
        if (!this._initialRenderDisplayComplete) {
            // If position was successfully set, perform initial operations related to automatic sizing 
            // (executed on first renderDisplay() after renderAdd()).
            this._initialRenderDisplayComplete = true;
            
            if (waitTime) {
                if (Core.Web.Image.monitor(this._div, Core.method(this, this._imageLoadListener))) {
                    this._imageWaitStartTime = new Date().getTime();
                }
            }
        }
        
        if (!this._displayed) {
            if (this._imageWaitStartTime && new Date().getTime() > this._imageWaitStartTime + waitTime) {
                this._imageWaitStartTime = null;
            }
            
            if (!this._imageWaitStartTime) {
                this._displayed = true;
                var time = (Core.Web.Env.NOT_SUPPORTED_CSS_OPACITY || !this._opening) ? 
                        0 : this.component.render("openAnimationTime", 0);
                if (time > 0) {
                    Core.Web.Scheduler.add(new Echo.Sync.WindowPane.FadeRunnable(this._div, false, time, null));
                    this._div.style.opacity = 0;
                }
                this._div.style.visibility = "";
            }
        }
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        this._overlayRemove();
        this._renderDisposeFrame();
        this._maskDiv = null;
        this._contentDiv = null;
        this._controlDiv = null;
    },
    
    /**
     * Disposes state of rendered window frame.  This method disposes all resources initialized in _renderAddFrame().
     */
    _renderDisposeFrame: function() {
        var i;

        Core.Web.Event.removeAll(this._div);

        for (i = 0; i < 8; ++i) {
            if (this._borderDivs[i]) {
                Core.Web.Event.removeAll(this._borderDivs[i]);
            }
        }
        this._borderDivs = null;
        
        if (this._controlIcons != null) {
            for (i = 0; i < this._controlIcons.length; ++i) {
                Core.Web.Event.removeAll(this._controlIcons[i]);
            }
            this._controlIcons = null;
        }
        
        Core.Web.Event.removeAll(this._titleBarDiv);
        this._titleBarDiv = null;
        
        this._titleIconDiv = null;
        this._titleIconImg = null;
        this._titleIconImgLoading = false;
        
        this._div = null;
    },
    
    /** @see Echo.Render.ComponentSync#renderFocus */
    renderFocus: function() {
        Core.Web.DOM.focusElement(this._div);
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        if (update.hasAddedChildren() || update.hasRemovedChildren()) {
            // Children added/removed: perform full render.
        } else if (update.isUpdatedPropertySetIn(Echo.Sync.WindowPane.NON_RENDERED_PROPERTIES)) {
            // Do nothing.
            return false;
        } else if (update.isUpdatedPropertySetIn(Echo.Sync.WindowPane.PARTIAL_PROPERTIES_POSITION_SIZE)) {
            this._loadPositionAndSize();
            return false;
        } else if (update.isUpdatedPropertySetIn(Echo.Sync.WindowPane.PARTIAL_PROPERTIES)) {
            this._renderUpdateFrame();
            return false;
        }

        var element = this._div;
        var containerElement = element.parentNode;
        Echo.Render.renderComponentDispose(update, update.parent);
        containerElement.removeChild(element);
        this.renderAdd(update, containerElement);
        return true;
    },
    
    /**
     * Renders an update to the window frame.  Disposes existing frame, removes rendered elements, adds new frame.
     */
    _renderUpdateFrame: function() {
        var element = this._div;
        var containerElement = element.parentNode;
        this._renderDisposeFrame();
        containerElement.removeChild(element);
        this._renderAddFrame(containerElement);
    },
    
    /**
     * Sets the bounds of the window.  Constrains the specified bounds to within the available area.
     * If userAdjusting parameter is true, specBounds values must be in pixel values.
     * Invokes _redraw().
     * 
     * @param specBounds an object containing extent properties x, y, width, and height
     * @param {Boolean} userAdjusting flag indicating whether this bounds adjustment is a result of the user moving/resizing
     *        the window (true) or is programmatic (false)
     */
    _setBounds: function(specBounds, userAdjusting) {
        var pxBounds = {}, // Pixel bounds (x/y/width/height as numeric pixel values. 
            calculatedHeight = false; // Flag indicating whether height is calculated or default.
        
        if (userAdjusting) {
            // Constrain user adjustment specBounds coordinate to be an on-screen negative value.
            // if userAdjusting is true, x/y values are guaranteed to be integers.
            if (specBounds.x != null && specBounds.x < 0) {
                specBounds.x = 0;
            }
            if (specBounds.y != null && specBounds.y < 0) {
                specBounds.y = 0;
            }
        }
        
        // Determine pixel width based on specified extent width.
        if (specBounds.width != null) {
            // Determine pixel width based on specified outside width.
            pxBounds.width = Math.round(Echo.Sync.Extent.isPercent(specBounds.width) ?
                    (parseInt(specBounds.width, 10) * this._containerSize.width / 100) :
                    Echo.Sync.Extent.toPixels(specBounds.width, true));
        } else if (specBounds.contentWidth != null) {
            // Determine pixel width based on specified inside (content) width.
            pxBounds.contentWidth = Math.round(Echo.Sync.Extent.isPercent(specBounds.contentWidth) ?
                    (parseInt(specBounds.contentWidth, 10) * this._containerSize.width / 100) :
                    Echo.Sync.Extent.toPixels(specBounds.contentWidth, true));
            pxBounds.width = this._contentInsets.left + this._contentInsets.right + pxBounds.contentWidth;
        }
        
        // Determine pixel height based on specified extent height, or if not specified, calculate height.
        if (specBounds.height != null) {
            // Calculate pixel height based on specified outside height.
            pxBounds.height = Math.round(Echo.Sync.Extent.isPercent(specBounds.height) ?
                    (parseInt(specBounds.height, 10) * this._containerSize.height / 100) :
                    Echo.Sync.Extent.toPixels(specBounds.height, false));
        } else if (specBounds.contentHeight != null) {
            // Calculate pixel height based on specified inside (content) height.
            pxBounds.contentHeight = Math.round(Echo.Sync.Extent.isPercent(specBounds.contentHeight) ?
                    (parseInt(specBounds.contentHeight, 10) * this._containerSize.height / 100) :
                    Echo.Sync.Extent.toPixels(specBounds.contentHeight, false));
            pxBounds.height = this._contentInsets.top + this._contentInsets.bottom + this._titleBarHeight + pxBounds.contentHeight;
        } else if (!userAdjusting) {
            // Set calculated height flag, will be used later for constraints.
            calculatedHeight = true;
            
            // Calculate height based on content size.
            if (this.component.children[0]) {
                // Determine pixel content width.
                var contentWidth = pxBounds.contentWidth ? pxBounds.contentWidth : 
                        pxBounds.width - (this._contentInsets.left + this._contentInsets.right);
                // Cache current content DIV CSS text.
                var contentDivCss = this._contentDiv.style.cssText;
                
                // Use child peer's getPreferredSize() implementation if available.
                if (this.component.children[0].peer.getPreferredSize) {
                    // Set content DIV CSS text for measuring.
                    this._contentDiv.style.cssText = "position:absolute;width:" + contentWidth + 
                            "px;height:" + this._containerSize.height + "px";

                    // Determine size using getPreferredSize()
                    var prefSize = this.component.children[0].peer.getPreferredSize(Echo.Render.ComponentSync.SIZE_HEIGHT);
                    if (prefSize && prefSize.height) {
                        pxBounds.height = this._contentInsets.top + this._contentInsets.bottom + this._titleBarHeight + 
                                prefSize.height;
                    }
                    
                    // Reset content DIV CSS text.
                    this._contentDiv.style.cssText = contentDivCss;
                }
                
                // If height not yet determined and child is not a pane, measure child height.
                if (!pxBounds.height && !this.component.children[0].pane) {
                    // Configure _contentDiv state for proper measuring of its content height.
                    var insets = Echo.Sync.Insets.toPixels(this.component.render("insets"));
                    this._contentDiv.style.position = "static";
                    this._contentDiv.style.width = (contentWidth - insets.left - insets.right) + "px";
                    this._contentDiv.style.height = "";
                    this._contentDiv.style.padding = "";

                    // Determine size using measurement.
                    var measuredHeight = new Core.Web.Measure.Bounds(this._contentDiv).height;
                    if (measuredHeight) {
                        pxBounds.height = this._contentInsets.top + this._contentInsets.bottom + this._titleBarHeight + 
                                measuredHeight + insets.top + insets.bottom;
                    }

                    // Reset content DIV CSS text.
                    this._contentDiv.style.cssText = contentDivCss;
                }
            }
            
            if (!pxBounds.height) {
                // Height calculation not possible: revert to using default height value.
                pxBounds.height = Echo.Sync.Extent.toPixels(Echo.WindowPane.DEFAULT_HEIGHT, false);            
            }
        }
        
        // Determine x-coordinate of window based on specified x-coordinate.
        if (specBounds.x != null) {
            if (Echo.Sync.Extent.isPercent(specBounds.x)) {
                pxBounds.x = Math.round((this._containerSize.width - pxBounds.width) * (parseInt(specBounds.x, 10) / 100));
                if (pxBounds.x < 0) {
                    // Constain x coordinate if window is too large to fit on-screen.
                    pxBounds.x = 0;
                }
            } else {
                pxBounds.x = Math.round(Echo.Sync.Extent.toPixels(specBounds.x, true));
                if (pxBounds.x < 0) {
                    // Negative value: position window from right side of screen.
                    pxBounds.x += this._containerSize.width - pxBounds.width;
                }
            }
        }

        // Determine y-coordinate of window based on specified y-coordinate.
        if (specBounds.y != null) {
            if (Echo.Sync.Extent.isPercent(specBounds.y)) {
                pxBounds.y = Math.round((this._containerSize.height - pxBounds.height) * (parseInt(specBounds.y, 10) / 100));
                if (pxBounds.y < 0) {
                    // Constain y coordinate if window is too large to fit on-screen.
                    pxBounds.y = 0;
                }
            } else {
                pxBounds.y = Math.round(Echo.Sync.Extent.toPixels(specBounds.y, false));
                if (pxBounds.y < 0) {
                    // Negative value: position window from bottom side of screen
                    pxBounds.y += this._containerSize.height - pxBounds.height;
                }
            }
        }
        
        // Initialize _rendered property if required.
        if (this._rendered == null) {
            this._rendered = { };
        }

        // Constrain width, store value in _rendered property.
        if (pxBounds.width != null) {
            // Constrain to width of region.
            if (this._resizable && pxBounds.width > this._containerSize.width) {
                pxBounds.width = this._containerSize.width;
            }

            // Constrain to maximum width.
            if (this._maximumWidth && pxBounds.width > this._maximumWidth) {
                if (userAdjusting && pxBounds.x != null) {
                    // If user is adjusting the window and x-coordinate is provided, adjust x-coordinate appropriately
                    // as window is being resized using a left-side handle.
                    pxBounds.x += (pxBounds.width - this._maximumWidth);
                }
                pxBounds.width = this._maximumWidth;
            }

            // Constrain to minimum width.
            if (pxBounds.width < this._minimumWidth) {
                if (userAdjusting && pxBounds.x != null) {
                    // If user is adjusting the window and x-coordinate is provided, adjust x-coordinate appropriately
                    // as window is being resized using a left-side handle.
                    pxBounds.x += (pxBounds.width - this._minimumWidth);
                }
                pxBounds.width = this._minimumWidth;
            }

            // Store.
            this._rendered.width = Math.round(pxBounds.width);
        }
        
        // Constrain height, store value in _rendered property.
        if (pxBounds.height != null) {
            // Constrain to height of region.
            if ((calculatedHeight || this._resizable) && pxBounds.height > this._containerSize.height) {
                pxBounds.height = this._containerSize.height;
            }
            
            // Constrain to maximum height.
            if (this._maximumHeight && pxBounds.height > this._maximumHeight) {
                if (userAdjusting && pxBounds.y != null) {
                    // If user is adjusting the window and y-coordinate is provided, adjust y-coordinate appropriately
                    // as window is being resized using a top-side handle.
                    pxBounds.y += (pxBounds.height - this._maximumHeight);
                }
                pxBounds.height = this._maximumHeight;
            }

            // Constrain to minimum height.
            if (pxBounds.height < this._minimumHeight) {
                if (userAdjusting && pxBounds.y != null) {
                    // If user is adjusting the window and y-coordinate is provided, adjust y-coordinate appropriately
                    // as window is being resized using a top-side handle.
                    pxBounds.y += (pxBounds.height - this._minimumHeight);
                }
                pxBounds.height = this._minimumHeight;
            }
            
            // Store.
            this._rendered.height = Math.round(pxBounds.height);
        }
    
        // Constrain x position, store value in _rendered property.
        if (pxBounds.x != null) {
            // Ensure right edge of window is on-screen.
            if (this._containerSize.width > 0 && pxBounds.x > this._containerSize.width - this._rendered.width) {
                pxBounds.x = this._containerSize.width - this._rendered.width;
            }

            // Ensure left edge of window is on-screen.
            if (pxBounds.x < 0) {
                pxBounds.x = 0;
            }

            // Store.
            this._rendered.x = Math.round(pxBounds.x);
        }
    
        // Constrain y position, store value in _rendered property.
        if (pxBounds.y != null) {
            // Ensure bottom edge of window is on-screen.
            if (this._containerSize.height > 0 && pxBounds.y > this._containerSize.height - this._rendered.height) {
                pxBounds.y = this._containerSize.height - this._rendered.height;
            }

            // Ensure top edge of window is on-screen.
            if (pxBounds.y < 0) {
                pxBounds.y = 0;
            }

            // Store.
            this._rendered.y = Math.round(pxBounds.y);
        }

        // Perform redraw based on new _rendered state.
        this._redraw();
    }
});
