var svgicons2svgfont = require('svgicons2svgfont')
  , Path = require('path')
  , gutil = require('gulp-util')
  , Stream = require('readable-stream')
  , Fs = require('fs')
  , path = require('path')
;

module.exports = function(options) {
  var files = []
    , usedCodePoints = []
    , curCodepoint = 0xE001
  ;

  options = options || {};
  options.ignoreExt = options.ignoreExt || false;

  if (!options.fontName) {
    throw new gutil.PluginError('svgicons2svgfont', 'Missing options.fontName');
  }

  options.log = function() {
    gutil.log.apply(gutil, ['gulp-svgicons2svgfont: '].concat(
      [].slice.call(arguments, 0).concat()));
  };

  var stream = new Stream.Transform({objectMode: true});

  options.error = function() {
    stream.emit('error', new PluginError('svgicons2svgfont',
      [].slice.call(arguments, 0).concat()));
  };

  // Collecting icons
  stream._transform = function bufferContents(file, unused, done) {
    // When null just pass through
    if(file.isNull()) {
      stream.push(file); done();
      return;
    }

    // If the ext doesn't match, pass it through
    if((!options.ignoreExt) && '.svg' !== path.extname(file.path)) {
      stream.push(file); done();
      return;
    }

    files.push(file);

    done();
  };

  // Generating the font
  stream._flush = function endStream(done) {

    // No icons, exit
    if (files.length === 0) return done();

    // Map each icons to their corresponding glyphs
    var glyphs = files.map(function(file) {
      // Creating an object for each icon
      var matches = Path.basename(file.path).match(/^(?:u([0-9a-f]{4})\-)?(.*).svg$/i)
        , glyph = {
          name: matches[2],
          codepoint: 0,
          file: file.path,
          stream: file.pipe(new Stream.PassThrough())
        };
      if(matches&&matches[1]) {
        glyph.codepoint = parseInt(matches[1], 16);
        usedCodePoints.push(glyph.codepoint);
        return glyph;
      }
      return glyph;
    }).map(function(glyph){
      if(0 === glyph.codepoint) {
        do {
          glyph.codepoint = curCodepoint++;
        } while(-1 !== usedCodePoints.indexOf(glyph.codepoint))
        usedCodePoints.push(glyph.codepoint);
        if(options.appendCodepoints) {
            Fs.rename(glyph.file, Path.dirname(glyph.file) + '/'
              + 'u' + glyph.codepoint.toString(16).toUpperCase()
              + '-' + glyph.name + '.svg',
              function(err) {
                if(err) {
                  gutil.log("Could not save codepoint: "
                    + 'u' + i.toString(16).toUpperCase()
                    +' for ' + glyph.name + '.svg');
                } else {
                  gutil.log("Saved codepoint: "
                    + 'u' + glyph.codepoint.toString(16).toUpperCase()
                    +' for ' + glyph.name + '.svg');
                }
              }
            );
        }
      }
      return glyph;
    });

    // Create the font file
    var joinedFile = new gutil.File({
      cwd: files[0].cwd,
      base: files[0].base,
      path: Path.join(files[0].base, options.fontName) + '.svg'
    });
    
    // Running the parent library
    joinedFile.contents = svgicons2svgfont(glyphs, options);

    // Emit event containing codepoint mapping
    stream.emit('codepoints', glyphs.map(function(glyph) {
      return {
        name: glyph.name,
        codepoint: glyph.codepoint,
        codepointHex: glyph.codepoint.toString(16).toUpperCase()
      };
    }));

    // Giving the font back to the stream
    if(files[0].isBuffer()) {
      var buf = new Buffer('');
      joinedFile.contents.on('data', function(chunk) {
        buf = Buffer.concat([buf, chunk], buf.length + chunk.length);
      });
      joinedFile.contents.on('end', function() {
        joinedFile.contents = buf;
        stream.push(joinedFile);
        done();
      });
    } else {
      stream.push(joinedFile);
      done();
    }
  };

  return stream;
};
