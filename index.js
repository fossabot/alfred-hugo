'use strict';var _regenerator=require('babel-runtime/regenerator');var _regenerator2=_interopRequireDefault(_regenerator);var _asyncToGenerator2=require('babel-runtime/helpers/asyncToGenerator');var _asyncToGenerator3=_interopRequireDefault(_asyncToGenerator2);var _assign=require('babel-runtime/core-js/object/assign');var _assign2=_interopRequireDefault(_assign);var _stringify=require('babel-runtime/core-js/json/stringify');var _stringify2=_interopRequireDefault(_stringify);var _classCallCheck2=require('babel-runtime/helpers/classCallCheck');var _classCallCheck3=_interopRequireDefault(_classCallCheck2);var _createClass2=require('babel-runtime/helpers/createClass');var _createClass3=_interopRequireDefault(_createClass2);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}var Conf=require('conf');var CacheConf=require('cache-conf');var moment=require('moment');var readPkg=require('read-pkg');var latestVersion=require('latest-version');var semver=require('semver');var notifier=require('node-notifier');var path=require('path');var got=require('got');var Fuse=require('fuse.js');var Hugo=function(){function Hugo(){(0,_classCallCheck3.default)(this,Hugo);this._fuseDefaults={keys:['title'],threshold:0.4};this._options={checkUpdates:true,updateInterval:moment.duration(1,'days'),updateNotification:true,updateItem:false};this._outputBuffer={};this.config=new Conf({cwd:Hugo.workflowMeta.data});this.cache=new CacheConf({configName:'cache',cwd:Hugo.workflowMeta.cache,version:Hugo.workflowMeta.version});}(0,_createClass3.default)(Hugo,[{key:'addItem',value:function addItem(item){if(!this._outputBuffer.items){this._outputBuffer.items=[];}if(item.arg&&typeof item.arg==='object'){var arg=item.arg.arg;var variables=item.arg.variables;item.arg=(0,_stringify2.default)({alfredworkflow:{arg:arg,variables:variables}});}this._outputBuffer.items.push(item);}},{key:'addItems',value:function addItems(items){var _this=this;if(!this._outputBuffer.items){this._outputBuffer.items=[];}items.map(function(item){_this.addItem(item);return item;});}},{key:'addVariable',value:function addVariable(key,value){if(!this._outputBuffer.variables){this._outputBuffer.variables={};}this._outputBuffer.variables[key]=value;}},{key:'addVariables',value:function addVariables(variables){if(!this._outputBuffer.variables){this._outputBuffer.variables=variables;return;}this._outputBuffer.variables=(0,_assign2.default)({},this._outputBuffer.variables,variables);}},{key:'action',value:function action(keyword,callback){var query=process.argv[2];if(query&&callback&&query===keyword){query=process.argv[3]||'';callback(query);}return this;}},{key:'checkUpdates',value:function(){var _ref=(0,_asyncToGenerator3.default)(_regenerator2.default.mark(function _callee(){var pkg,wfName,wfIcon,latest,checkedOnline;return _regenerator2.default.wrap(function _callee$(_context){while(1){switch(_context.prev=_context.next){case 0:if(!(this._options.checkUpdates!==true||this._options.updateItem!==true&&this._options.updateNotification!==true)){_context.next=2;break;}return _context.abrupt('return');case 2:_context.next=4;return readPkg(process.cwd());case 4:pkg=_context.sent;wfName=Hugo.workflowMeta.name||'';wfIcon=Hugo.workflowMeta.icon||'';latest=this.cache.get('hugo_latest_version');checkedOnline=false;if(!(latest===false)){_context.next=11;break;}return _context.abrupt('return');case 11:if(!(latest===null)){_context.next=17;break;}_context.next=14;return latestVersion(pkg.name).catch(function(){return false;});case 14:latest=_context.sent;checkedOnline=true;this.cache.set('hugo_latest_version',latest,{maxAge:this._options.updateInterval.as('milliseconds')});case 17:if(latest&&semver.gt(latest,pkg.version)){if(checkedOnline===true&&this._options.updateNotification===true){notifier.notify({title:wfName,subtitle:`Workflow version ${latest} available`,message:`Run 'npm install -g ${pkg.name}' to update.`,sender:'com.runningwithcrayons.Alfred-3',timeout:10});}if(this._options.updateItem===true){this.addItem({title:`Workflow update available!`,subtitle:`Version ${latest} is available. Run 'npm install -g ${pkg.name}' to update.`,icon:wfIcon,arg:{arg:`npm update -g ${pkg.name}`,variables:{task:'wfUpdate'}}});}}case 18:case'end':return _context.stop();}}},_callee,this);}));function checkUpdates(){return _ref.apply(this,arguments);}return checkUpdates;}()},{key:'filterItems',value:function filterItems(query){var options=arguments.length>1&&arguments[1]!==undefined?arguments[1]:{};options=(0,_assign2.default)({},this._fuseDefaults,options);if(query.length===0){return;}var fuse=new Fuse(this._outputBuffer,options);this._outputBuffer.items=fuse.search(query)||[];}},{key:'options',value:function options(value){if(value.updateInterval&&!moment.isDuration(value.updateInterval)){value.updateInterval=moment.duration(value.updateInterval)||moment.duration(1,'days');}this._options=(0,_assign2.default)({},this._options,value);}},{key:'matches',value:function matches(candidates,query){var options=arguments.length>2&&arguments[2]!==undefined?arguments[2]:{};options=(0,_assign2.default)({},this._fuseDefaults,options);if(query.length===0){return candidates;}var fuse=new Fuse(candidates,options);return fuse.search(query)||[];}},{key:'rerun',value:function rerun(value){value=parseFloat(value);if(value&&value>0.1&&value<=5){this._rerun=value;}return this;}},{key:'feedback',value:function(){var _ref2=(0,_asyncToGenerator3.default)(_regenerator2.default.mark(function _callee2(){return _regenerator2.default.wrap(function _callee2$(_context2){while(1){switch(_context2.prev=_context2.next){case 0:if(this._rerun){this._outputBuffer.rerun=this._rerun;}if(!(this._options.checkUpdates===true)){_context2.next=4;break;}_context2.next=4;return this.checkUpdates().catch(function(){});case 4:console.log((0,_stringify2.default)(this._outputBuffer,null,'\t'));this._outputBuffer={};case 6:case'end':return _context2.stop();}}},_callee2,this);}));function feedback(){return _ref2.apply(this,arguments);}return feedback;}()},{key:'fetch',value:function(){var _ref3=(0,_asyncToGenerator3.default)(_regenerator2.default.mark(function _callee3(url){var _this2=this;var options=arguments.length>1&&arguments[1]!==undefined?arguments[1]:{};var cacheAge=arguments.length>2&&arguments[2]!==undefined?arguments[2]:null;var cacheResult;return _regenerator2.default.wrap(function _callee3$(_context3){while(1){switch(_context3.prev=_context3.next){case 0:options=(0,_assign2.default)({},{json:true},options);if(!(cacheAge&&cacheAge>0)){_context3.next=5;break;}cacheResult=this.cache.get(url);if(!cacheResult){_context3.next=5;break;}return _context3.abrupt('return',cacheResult);case 5:return _context3.abrupt('return',got(url,options).then(function(response){if(cacheAge&&cacheAge>0){_this2.cache.set(url,response.body,{maxAge:cacheAge*1000});}return response.body;}));case 6:case'end':return _context3.stop();}}},_callee3,this);}));function fetch(_x5){return _ref3.apply(this,arguments);}return fetch;}()}],[{key:'alfredMeta',get:function get(){return{version:process.env.alfred_version,theme:process.env.alfred_theme,themeBackground:process.env.alfred_theme_background,themeSelectionBackground:process.env.alfred_theme_selection_background,themeSubtext:parseFloat(process.env.alfred_theme_subtext),preferences:process.env.alfred_preferences,preferencesLocalHash:process.env.alfred_preferences_localhash};}},{key:'workflowMeta',get:function get(){return{name:process.env.alfred_workflow_name,version:process.env.alfred_workflow_version,uid:process.env.alfred_workflow_uid,bundleId:process.env.alfred_workflow_bundleid,data:process.env.alfred_workflow_data,cache:process.env.alfred_workflow_cache,icon:path.join(process.cwd(),'icon.png')};}}]);return Hugo;}();module.exports=new Hugo();