var fs = Npm.require('fs');
var path = Npm.require('path');
var less = Npm.require('less');
var Future = Npm.require('fibers/future');

Plugin.registerSourceHandler("less", function (compileStep) {
  // XXX annoying that this is replicated in .css, .less, and .styl
  if (! compileStep.archMatches('browser')) {
    // XXX in the future, might be better to emit some kind of a
    // warning if a stylesheet is included on the server, rather than
    // silently ignoring it. but that would mean you can't stick .css
    // at the top level of your app, which is kind of silly.
    return;
  }

  var source = compileStep.read().toString('utf8');
  var options = {
    // Use fs.readFileSync to process @imports. This is the bundler, so
    // that's not going to cause concurrency issues, and it means that (a)
    // we don't have to use Futures and (b) errors thrown by bugs in less
    // actually get caught.
    syncImport: true,
    sourceMap: true,
    paths: [path.dirname(compileStep._fullInputPath)] // for @import
  };

  var f = new Future;
  var css;
  try {
    less.render(source, options, f.resolver());
    css = f.wait();
  } catch (e) {
    // less.render() is supposed to report any errors via its
    // callback. But sometimes, it throws them instead. This is
    // probably a bug in less. Be prepared for either behavior.
    compileStep.error({
      message: "Less compiler error: " + e.message,
      sourcePath: e.filename || compileStep.inputPath,
      line: e.line - 1,  // dunno why, but it matches
      column: e.column + 1
    });
    return;
  }

  compileStep.addStylesheet({
    path: compileStep.inputPath + ".css",
    data: css
  });
});;

// Register lessimport files with the dependency watcher, without actually
// processing them.
Plugin.registerSourceHandler("lessimport", function () {
  // Do nothing
});
