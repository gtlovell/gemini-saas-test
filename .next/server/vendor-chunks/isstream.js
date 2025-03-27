/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/isstream";
exports.ids = ["vendor-chunks/isstream"];
exports.modules = {

/***/ "(rsc)/./node_modules/isstream/isstream.js":
/*!*******************************************!*\
  !*** ./node_modules/isstream/isstream.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval("var stream = __webpack_require__(/*! stream */ \"stream\")\n\n\nfunction isStream (obj) {\n  return obj instanceof stream.Stream\n}\n\n\nfunction isReadable (obj) {\n  return isStream(obj) && typeof obj._read == 'function' && typeof obj._readableState == 'object'\n}\n\n\nfunction isWritable (obj) {\n  return isStream(obj) && typeof obj._write == 'function' && typeof obj._writableState == 'object'\n}\n\n\nfunction isDuplex (obj) {\n  return isReadable(obj) && isWritable(obj)\n}\n\n\nmodule.exports            = isStream\nmodule.exports.isReadable = isReadable\nmodule.exports.isWritable = isWritable\nmodule.exports.isDuplex   = isDuplex\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvaXNzdHJlYW0vaXNzdHJlYW0uanMiLCJtYXBwaW5ncyI6IkFBQUEsYUFBYSxtQkFBTyxDQUFDLHNCQUFROzs7QUFHN0I7QUFDQTtBQUNBOzs7QUFHQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7QUFDQTs7O0FBR0E7QUFDQTtBQUNBOzs7QUFHQTtBQUNBLHlCQUF5QjtBQUN6Qix5QkFBeUI7QUFDekIsdUJBQXVCIiwic291cmNlcyI6WyIvVXNlcnMvZ2xvdmVsbC9kZXYvZ2VtaW5pLXNhYXMtdGVzdC9ub2RlX21vZHVsZXMvaXNzdHJlYW0vaXNzdHJlYW0uanMiXSwic291cmNlc0NvbnRlbnQiOlsidmFyIHN0cmVhbSA9IHJlcXVpcmUoJ3N0cmVhbScpXG5cblxuZnVuY3Rpb24gaXNTdHJlYW0gKG9iaikge1xuICByZXR1cm4gb2JqIGluc3RhbmNlb2Ygc3RyZWFtLlN0cmVhbVxufVxuXG5cbmZ1bmN0aW9uIGlzUmVhZGFibGUgKG9iaikge1xuICByZXR1cm4gaXNTdHJlYW0ob2JqKSAmJiB0eXBlb2Ygb2JqLl9yZWFkID09ICdmdW5jdGlvbicgJiYgdHlwZW9mIG9iai5fcmVhZGFibGVTdGF0ZSA9PSAnb2JqZWN0J1xufVxuXG5cbmZ1bmN0aW9uIGlzV3JpdGFibGUgKG9iaikge1xuICByZXR1cm4gaXNTdHJlYW0ob2JqKSAmJiB0eXBlb2Ygb2JqLl93cml0ZSA9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBvYmouX3dyaXRhYmxlU3RhdGUgPT0gJ29iamVjdCdcbn1cblxuXG5mdW5jdGlvbiBpc0R1cGxleCAob2JqKSB7XG4gIHJldHVybiBpc1JlYWRhYmxlKG9iaikgJiYgaXNXcml0YWJsZShvYmopXG59XG5cblxubW9kdWxlLmV4cG9ydHMgICAgICAgICAgICA9IGlzU3RyZWFtXG5tb2R1bGUuZXhwb3J0cy5pc1JlYWRhYmxlID0gaXNSZWFkYWJsZVxubW9kdWxlLmV4cG9ydHMuaXNXcml0YWJsZSA9IGlzV3JpdGFibGVcbm1vZHVsZS5leHBvcnRzLmlzRHVwbGV4ICAgPSBpc0R1cGxleFxuIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6WzBdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/isstream/isstream.js\n");

/***/ })

};
;