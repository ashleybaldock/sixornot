/*
 * SixOrNot build script
 */

const fs = require('fs-extra');
const archiver = require('archiver');
const { execSync } = require('child_process');

const manifest = require('./manifest.json');
const version = manifest.version;

// Create build directory by version
fs.ensureDirSync('./dist');
fs.removeSync(`./dist/${version}`);
fs.ensureDirSync(`./dist/${version}/src`);

[
  'background.js',
  'ko.persist.js',
  'ko.subPersist.js',
  'knockout-latest.debug.js',
  'knockout.mapping.js',
  'licence.txt',
  'manifest.json',
  'options.css',
  'options.html',
  'options.js',
  'popup.css',
  'popup.html',
  'popup.js',
  '_locales',
  'images'
].forEach(fileOrDir => {
  fs.copySync(`./${fileOrDir}`, `./dist/${version}/src/${fileOrDir}`);
});

// Remove .DS_Store files from output
let stdout = execSync(`find ./dist/${version}/ -name ".DS_Store" -delete`);

console.log(stdout);

var output = fs.createWriteStream(`./dist/${version}/sixornot-${version}.xpi`);
var archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(archive.pointer() + ' total bytes');
  console.log('archiver has been finalized and the output file descriptor has closed.');
});

output.on('end', () => {
  console.log('Data has been drained');
});

archive.on('warning', err => {
  if (err.code === 'ENOENT') {
    console.log(JSON.stringify(err));
  } else {
    throw err;
  }
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);

archive.directory(`./dist/${version}/src/`, false);

archive.finalize();
