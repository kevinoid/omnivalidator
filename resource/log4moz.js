/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is log4moz
 *
 * The Initial Developer of the Original Code is
 * Michael Johnston
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * Michael Johnston <special.michael@gmail.com>
 * Dan Mills <thunder@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var Log4Moz = (function () {
"use strict";

const EXPORTED_SYMBOLS = ['Log4Moz'];

const Cc = typeof Components === "object" ? Components.classes : undefined;
const Ci = typeof Components === "object" ? Components.interfaces : undefined;
const Cr = typeof Components === "object" ? Components.results : undefined;
const Cu = typeof Components === "object" ? Components.utils : undefined;

const MODE_RDONLY   = 0x01;
const MODE_WRONLY   = 0x02;
const MODE_CREATE   = 0x08;
const MODE_APPEND   = 0x10;
const MODE_TRUNCATE = 0x20;

const PERMS_FILE      = parseInt("0644", 8);
const PERMS_DIRECTORY = parseInt("0755", 8);

const ONE_BYTE = 1;
const ONE_KILOBYTE = 1024 * ONE_BYTE;
const ONE_MEGABYTE = 1024 * ONE_KILOBYTE;

var Log4Moz = {
  Level: {
    Fatal:  70,
    Error:  60,
    Warn:   50,
    Info:   40,
    Config: 30,
    Debug:  20,
    Trace:  10,
    All:    0,
    Desc: {
      70: "FATAL",
      60: "ERROR",
      50: "WARN",
      40: "INFO",
      30: "CONFIG",
      20: "DEBUG",
      10: "TRACE",
      0:  "ALL"
    }
  },

  get repository() {
    delete Log4Moz.repository;
    Log4Moz.repository = new LoggerRepository();
    return Log4Moz.repository;
  },
  set repository(value) {
    delete Log4Moz.repository;
    Log4Moz.repository = value;
  },

  get LogMessage() { return LogMessage; },
  get Logger() { return Logger; },
  get LoggerRepository() { return LoggerRepository; },

  get Formatter() { return Formatter; },
  get BasicFormatter() { return BasicFormatter; },

  get Appender() { return Appender; },
  get DumpAppender() { return DumpAppender; },
  get ConsoleAppender() { return Ci ? MozConsoleAppender : ConsoleAppender; },
  get FileAppender() { return FileAppender; },
  get RotatingFileAppender() { return RotatingFileAppender; },

  // Logging helper:
  // var logger = Log4Moz.repository.getLogger("foo");
  // logger.info(Log4Moz.enumerateInterfaces(someObject).join(","));
  enumerateInterfaces: function Log4Moz_enumerateInterfaces(aObject) {
    var i, interfaces = [];

    for (i in Ci) {
      try {
        aObject.QueryInterface(Ci[i]);
        interfaces.push(i);
      }
      catch(ex) {}
    }

    return interfaces;
  },

  // Logging helper:
  // var logger = Log4Moz.repository.getLogger("foo");
  // logger.info(Log4Moz.enumerateProperties(someObject).join(","));
  enumerateProperties: function Log4Moz_enumerateProps(aObject,
                                                       aExcludeComplexTypes) {
    var p, properties = [];

    for (p in aObject) {
      try {
        if (aExcludeComplexTypes &&
            (typeof aObject[p] == "object" || typeof aObject[p] == "function"))
          continue;
        properties.push(p + " = " + aObject[p]);
      }
      catch(ex) {
        properties.push(p + " = " + ex);
      }
    }

    return properties;
  }
};


/*
 * LogMessage
 * Encapsulates a single log event's data
 */
function LogMessage(loggerName, level, message, error){
  this.loggerName = loggerName;
  this.message = message;
  this.level = level;
  this.error = error;
  this.time = Date.now();
}
LogMessage.prototype = {
  get levelDesc() {
    if (this.level in Log4Moz.Level.Desc)
      return Log4Moz.Level.Desc[this.level];
    return "UNKNOWN";
  },

  toString: function LogMsg_toString(){
    return "LogMessage [" + this.time + " " + this.level + " " +
      this.message + (" " + this.error || "") + "]";
  }
};

/*
 * Logger
 * Hierarchical version.  Logs to all appenders, assigned or inherited
 */

function Logger(name, repository) {
  if (!repository)
    repository = Log4Moz.repository;
  this._name = name;
  this.children = [];
  this.ownAppenders = [];
  this.appenders = [];
  this._repository = repository;
}
Logger.prototype = {
  get name() {
    return this._name;
  },

  _level: null,
  get level() {
    if (this._level != null)
      return this._level;
    if (this.parent)
      return this.parent.level;
    return Log4Moz.Level.All;
  },
  set level(level) {
    this._level = level;
  },

  _parent: null,
  get parent() { return this._parent; },
  set parent(parent) {
    if (this._parent == parent) {
      return;
    }
    // Remove ourselves from parent's children
    if (this._parent) {
      var index = this._parent.children.indexOf(this);
      if (index != -1) {
        this._parent.children.splice(index, 1);
      }
    }
    this._parent = parent;
    parent.children.push(this);
    this.updateAppenders();
  },

  updateAppenders: function updateAppenders() {
    if (this._parent) {
      var notOwnAppenders = this._parent.appenders.filter(function(appender) {
        return this.ownAppenders.indexOf(appender) == -1;
      }, this);
      this.appenders = notOwnAppenders.concat(this.ownAppenders);
    } else {
      this.appenders = this.ownAppenders.slice();
    }

    // Update children's appenders.
    for (var i = 0; i < this.children.length; i++) {
      this.children[i].updateAppenders();
    }
  },

  addAppender: function Logger_addAppender(appender) {
    if (this.ownAppenders.indexOf(appender) != -1) {
      return;
    }
    this.ownAppenders.push(appender);
    this.updateAppenders();
  },

  removeAppender: function Logger_removeAppender(appender) {
    var index = this.ownAppenders.indexOf(appender);
    if (index == -1) {
      return;
    }
    this.ownAppenders.splice(index, 1);
    this.updateAppenders();
  },

  log: function Logger_log(level, string, error) {
    if (this.level > level)
      return;

    // Hold off on creating the message object until we actually have
    // an appender that's responsible.
    var message;
    var appenders = this.appenders;
    for (var i = 0; i < appenders.length; i++){
      var appender = appenders[i];
      if (appender.level > level)
        continue;

      if (!message)
        message = new LogMessage(this._name, level, string, error);

      appender.append(message);
    }
  },

  fatal: function Logger_fatal(string, error) {
    this.log(Log4Moz.Level.Fatal, string, error);
  },
  error: function Logger_error(string, error) {
    this.log(Log4Moz.Level.Error, string, error);
  },
  warn: function Logger_warn(string, error) {
    this.log(Log4Moz.Level.Warn, string, error);
  },
  info: function Logger_info(string, error) {
    this.log(Log4Moz.Level.Info, string, error);
  },
  config: function Logger_config(string, error) {
    this.log(Log4Moz.Level.Config, string, error);
  },
  debug: function Logger_debug(string, error) {
    this.log(Log4Moz.Level.Debug, string, error);
  },
  trace: function Logger_trace(string, error) {
    this.log(Log4Moz.Level.Trace, string, error);
  }
};

/*
 * LoggerRepository
 * Implements a hierarchy of Loggers
 */

function LoggerRepository() {}
LoggerRepository.prototype = {
  _loggers: {},

  _rootLogger: null,
  get rootLogger() {
    if (!this._rootLogger) {
      this._rootLogger = new Logger("root", this);
      this._rootLogger.level = Log4Moz.Level.All;
    }
    return this._rootLogger;
  },
  set rootLogger(logger) {
    throw "Cannot change the root logger";
  },

  _updateParents: function LogRep__updateParents(name) {
    var pieces = name.split('.');
    var cur, parent;

    // find the closest parent
    // don't test for the logger name itself, as there's a chance it's already
    // there in this._loggers
    for (var i = 0; i < pieces.length - 1; i++) {
      if (cur)
        cur += '.' + pieces[i];
      else
        cur = pieces[i];
      if (cur in this._loggers)
        parent = cur;
    }

    // if we didn't assign a parent above, there is no parent
    if (!parent)
      this._loggers[name].parent = this.rootLogger;
    else
      this._loggers[name].parent = this._loggers[parent];

    // trigger updates for any possible descendants of this logger
    for (var logger in this._loggers) {
      if (logger != name && logger.indexOf(name) == 0)
        this._updateParents(logger);
    }
  },

  getLogger: function LogRep_getLogger(name) {
    if (name in this._loggers)
      return this._loggers[name];
    this._loggers[name] = new Logger(name, this);
    this._updateParents(name);
    return this._loggers[name];
  }
};

/*
 * Formatters
 * These massage a LogMessage into whatever output is desired
 * Only the BasicFormatter is currently implemented
 */

// Abstract formatter
function Formatter() {}
Formatter.prototype = {
  format: function Formatter_format(message) {}
};

// Basic formatter that doesn't do anything fancy
function BasicFormatter(dateFormat) {
  if (dateFormat)
    this.dateFormat = dateFormat;
}
BasicFormatter.prototype = {
  __proto__: Formatter.prototype,

  format: function BF_format(message) {
    return message.time + "\t" + message.loggerName + "\t" + message.levelDesc
           + "\t" + message.message
           + (message.error ? "\t" + message.error : "") + "\n";
  }
};

/*
 * Appenders
 * These can be attached to Loggers to log to different places
 * Simply subclass and override doAppend to implement a new one
 */

function Appender(formatter) {
  this._name = "Appender";
  this._formatter = formatter? formatter : new BasicFormatter();
}
Appender.prototype = {
  level: Log4Moz.Level.All,

  append: function App_append(message) {
    this.doAppend(this._formatter.format(message));
  },
  toString: function App_toString() {
    return this._name + " [level=" + this._level +
      ", formatter=" + this._formatter + "]";
  },
  doAppend: function App_doAppend(message, exeption) {}
};

/*
 * DumpAppender
 * Logs to standard out
 */

function DumpAppender(formatter) {
  this._name = "DumpAppender";
  this._formatter = formatter? formatter : new BasicFormatter();
}
DumpAppender.prototype = {
  __proto__: Appender.prototype,

  doAppend: function DApp_doAppend(message) {
    dump(message);
  }
};

/*
 * ConsoleAppender
 * Logs to the javascript console
 */

function ConsoleAppender(formatter) {
  this._name = "ConsoleAppender";
  this._formatter = formatter;
  if (typeof console !== "object" || typeof console.log !== "function") {
    throw new Error("console.log must be a function");
  }
}
ConsoleAppender.prototype = {
  __proto__: Appender.prototype,

  append: function CApp_append(message) {
    var fmtmessage = this._formatter.format(message);
    if (message.level <= Log4Moz.Level.Config) {
      console.log(fmtmessage);
    } else if (message.level <= Log4Moz.Level.Info) {
      console.info(fmtmessage);
    } else if (message.level <= Log4Moz.Level.Warn) {
      console.warn(fmtmessage);
    } else {
      console.error(fmtmessage);
    }
  }
};

/*
 * MozConsoleAppender
 * Logs to the javascript console using the Mozilla console service
 */

function MozConsoleAppender(formatter) {
  this._name = "MozConsoleAppender";
  this._formatter = formatter;
  this._console = Cc["@mozilla.org/consoleservice;1"].
    getService(Ci.nsIConsoleService);
}
MozConsoleAppender.prototype = {
  __proto__: Appender.prototype,

  append: function MCApp_append(message) {
    var fmtmessage = this._formatter.format(message);
    if (message.level < Log4Moz.Level.Warn && !message.error) {
      this._console.logStringMessage(fmtmessage);
    } else {
      var scriptError = Cc["@mozilla.org/scripterror;1"]
        .createInstance(Ci.nsIScriptError);
      scriptError.init(
          fmtmessage,
          message.error ? message.error.fileName : null,
          null,
          message.error ? message.error.lineNumber : null,
          null,
          message.level <= Log4Moz.Level.Warn ? Ci.nsIScriptError.warningFlag : Ci.nsIScriptError.errorFlag,
          // "chrome javascript" would be better, but not displayed by default
          "content javascript"
      );
      this._console.logMessage(scriptError);
    }
  }
};

/*
 * FileAppender
 * Logs to a file
 */

function FileAppender(file, formatter) {
  this._name = "FileAppender";
  this._file = file; // nsIFile
  this._formatter = formatter? formatter : new BasicFormatter();
}
FileAppender.prototype = {
  __proto__: Appender.prototype,
  __fos: null,
  get _fos() {
    if (!this.__fos)
      this.openStream();
    return this.__fos;
  },

  _errorInternal: function FApp__logInternal(level, message, error) {
    if (this._loggingInternal)
      return;

    try {
      this._loggingInternal = true;
      Log4Moz.repository.getLogger("Log4Moz").error(message, error);
    } finally {
      delete this._loggingInternal;
    }
  },

  openStream: function FApp_openStream() {
    try {
      var __fos = Cc["@mozilla.org/network/file-output-stream;1"].
        createInstance(Ci.nsIFileOutputStream);
      var flags = MODE_WRONLY | MODE_CREATE | MODE_APPEND;
      __fos.init(this._file, flags, PERMS_FILE, 0);

      this.__fos = Cc["@mozilla.org/intl/converter-output-stream;1"]
            .createInstance(Ci.nsIConverterOutputStream);
      this.__fos.init(__fos, "UTF-8", 4096,
            Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
    } catch(e) {
      this._errorInternal("Error opening stream", e);
    }
  },

  closeStream: function FApp_closeStream() {
    if (!this.__fos)
      return;
    try {
      this.__fos.close();
      this.__fos = null;
    } catch(e) {
      this._errorInternal("Failed to close file output stream", e);
    }
  },

  doAppend: function FApp_doAppend(message) {
    if (message === null || message.length <= 0 || this._loggingInternal)
      return;

    try {
      this._fos.writeString(message);
    } catch(e) {
      this._errorInternal("Error writing file", e);
    }
  },

  clear: function FApp_clear() {
    this.closeStream();
    try {
      this._file.remove(false);
    } catch (e) {
      this._errorInternal("Error removing file", e);
    }
  }
};

/*
 * RotatingFileAppender
 * Similar to FileAppender, but rotates logs when they become too large
 */

function RotatingFileAppender(file, formatter, maxSize, maxBackups) {
  if (maxSize === undefined)
    maxSize = ONE_MEGABYTE * 2;

  if (maxBackups === undefined)
    maxBackups = 0;

  this._name = "RotatingFileAppender";
  this._file = file; // nsIFile
  this._formatter = formatter? formatter : new BasicFormatter();
  this._maxSize = maxSize;
  this._maxBackups = maxBackups;
}
RotatingFileAppender.prototype = {
  __proto__: FileAppender.prototype,

  doAppend: function RFApp_doAppend(message) {
    if (message === null || message.length <= 0)
      return;
    try {
      this.rotateLogs();
      FileAppender.prototype.doAppend.call(this, message);
    } catch(e) {
      this._errorInternal("Error writing file", e);
    }
  },

  rotateLogs: function RFApp_rotateLogs() {
    if(this._file.exists() &&
       this._file.fileSize < this._maxSize)
      return;

    this.closeStream();

    for (var i = this.maxBackups - 1; i > 0; i--){
      var backup = this._file.parent.clone();
      backup.append(this._file.leafName + "." + i);
      if (backup.exists())
        backup.moveTo(this._file.parent, this._file.leafName + "." + (i + 1));
    }

    var cur = this._file.clone();
    if (cur.exists())
      cur.moveTo(cur.parent, cur.leafName + ".1");

    // Note: this._file still points to the same file
  }
};

return Log4Moz;
}());
