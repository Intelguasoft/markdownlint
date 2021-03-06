"use strict";

const fs = require("fs");
const path = require("path");
const md = require("markdown-it")();
const tv4 = require("tv4");
const markdownlint = require("../lib/markdownlint");
const shared = require("../lib/shared");
const rules = require("../lib/rules");
const customRules = require("./rules");
const defaultConfig = require("./markdownlint-test-default-config.json");
const configSchema = require("../schema/markdownlint-config-schema.json");

function promisify(func, ...args) {
  return new Promise((resolve, reject) => {
    func(...args, (error, result) => {
      if (error) {
        return reject(error);
      }
      resolve(result);
    });
  });
}

function createTestForFile(file) {
  return function testForFile(test) {
    test.expect(1);
    const detailedResults = /[/\\]detailed-results-/.test(file);
    const resultsFile = file.replace(/\.md$/, ".results.json");
    const configFile = file.replace(/\.md$/, ".json");
    const actualPromise = promisify(fs.stat, configFile)
      .then(
        function configFileExists() {
          return promisify(fs.readFile, configFile, shared.utf8Encoding)
            .then(JSON.parse);
        },
        function noConfigFile() {
          return {};
        })
      .then(
        function lintWithConfig(config) {
          const mergedConfig =
            shared.assign(shared.clone(defaultConfig), config);
          return promisify(markdownlint, {
            "files": [ file ],
            "config": mergedConfig,
            "resultVersion": detailedResults ? 2 : 0
          });
        });
    const expectedPromise = detailedResults ?
      promisify(fs.readFile, resultsFile, shared.utf8Encoding)
        .then(JSON.parse) :
      promisify(fs.readFile, file, shared.utf8Encoding)
        .then(
          function fileContents(contents) {
            const lines = contents.split(shared.newLineRe);
            const results = {};
            lines.forEach(function forLine(line, lineNum) {
              const regex = /\{(MD\d+)(?::(\d+))?\}/g;
              let match = null;
              while ((match = regex.exec(line))) {
                const rule = match[1];
                const errors = results[rule] || [];
                errors.push(match[2] ? parseInt(match[2], 10) : lineNum + 1);
                results[rule] = errors;
              }
            });
            const sortedResults = {};
            Object.keys(results).sort().forEach(function forKey(key) {
              sortedResults[key] = results[key];
            });
            return sortedResults;
          });
    Promise.all([ actualPromise, expectedPromise ])
      .then(
        function compareResults(fulfillments) {
          const actual = fulfillments[0];
          const results = fulfillments[1];
          const expected = {};
          expected[file] = results;
          test.deepEqual(actual, expected, "Line numbers are not correct.");
        })
      .catch()
      .then(test.done);
  };
}

fs.readdirSync("./test").forEach(function forFile(file) {
  if (file.match(/\.md$/)) {
    module.exports[file] = createTestForFile(path.join("./test", file));
  }
});

module.exports.projectFiles = function projectFiles(test) {
  test.expect(2);
  const options = {
    "files": [ "README.md" ],
    "noInlineConfig": true,
    "config": {
      "MD013": { "line_length": 150 },
      "MD024": false
    }
  };
  markdownlint(options, function callback(err, actual) {
    test.ifError(err);
    const expected = { "README.md": [] };
    test.deepEqual(actual, expected, "Issue(s) with project files.");
    test.done();
  });
};

module.exports.resultFormattingV0 = function resultFormattingV0(test) {
  test.expect(4);
  const options = {
    "files": [
      "./test/atx_heading_spacing.md",
      "./test/first_heading_bad_atx.md"
    ],
    "config": defaultConfig,
    "resultVersion": 0
  };
  markdownlint(options, function callback(err, actualResult) {
    test.ifError(err);
    const expectedResult = {
      "./test/atx_heading_spacing.md": {
        "MD002": [ 3 ],
        "MD018": [ 1 ],
        "MD019": [ 3, 5 ]
      },
      "./test/first_heading_bad_atx.md": {
        "MD002": [ 1 ]
      }
    };
    test.deepEqual(actualResult, expectedResult, "Undetected issues.");
    let actualMessage = actualResult.toString();
    let expectedMessage =
      "./test/atx_heading_spacing.md: 3: MD002" +
      " First heading should be a top level heading\n" +
      "./test/atx_heading_spacing.md: 1: MD018" +
      " No space after hash on atx style heading\n" +
      "./test/atx_heading_spacing.md: 3: MD019" +
      " Multiple spaces after hash on atx style heading\n" +
      "./test/atx_heading_spacing.md: 5: MD019" +
      " Multiple spaces after hash on atx style heading\n" +
      "./test/first_heading_bad_atx.md: 1: MD002" +
      " First heading should be a top level heading";
    test.equal(actualMessage, expectedMessage, "Incorrect message (name).");
    actualMessage = actualResult.toString(true);
    expectedMessage =
      "./test/atx_heading_spacing.md: 3: first-heading-h1" +
      " First heading should be a top level heading\n" +
      "./test/atx_heading_spacing.md: 1: no-missing-space-atx" +
      " No space after hash on atx style heading\n" +
      "./test/atx_heading_spacing.md: 3: no-multiple-space-atx" +
      " Multiple spaces after hash on atx style heading\n" +
      "./test/atx_heading_spacing.md: 5: no-multiple-space-atx" +
      " Multiple spaces after hash on atx style heading\n" +
      "./test/first_heading_bad_atx.md: 1: first-heading-h1" +
      " First heading should be a top level heading";
    test.equal(actualMessage, expectedMessage, "Incorrect message (alias).");
    test.done();
  });
};

module.exports.resultFormattingSyncV0 = function resultFormattingSyncV0(test) {
  test.expect(3);
  const options = {
    "files": [
      "./test/atx_heading_spacing.md",
      "./test/first_heading_bad_atx.md"
    ],
    "config": defaultConfig,
    "resultVersion": 0
  };
  const actualResult = markdownlint.sync(options);
  const expectedResult = {
    "./test/atx_heading_spacing.md": {
      "MD002": [ 3 ],
      "MD018": [ 1 ],
      "MD019": [ 3, 5 ]
    },
    "./test/first_heading_bad_atx.md": {
      "MD002": [ 1 ]
    }
  };
  test.deepEqual(actualResult, expectedResult, "Undetected issues.");
  let actualMessage = actualResult.toString();
  let expectedMessage =
    "./test/atx_heading_spacing.md: 3: MD002" +
    " First heading should be a top level heading\n" +
    "./test/atx_heading_spacing.md: 1: MD018" +
    " No space after hash on atx style heading\n" +
    "./test/atx_heading_spacing.md: 3: MD019" +
    " Multiple spaces after hash on atx style heading\n" +
    "./test/atx_heading_spacing.md: 5: MD019" +
    " Multiple spaces after hash on atx style heading\n" +
    "./test/first_heading_bad_atx.md: 1: MD002" +
    " First heading should be a top level heading";
  test.equal(actualMessage, expectedMessage, "Incorrect message (name).");
  actualMessage = actualResult.toString(true);
  expectedMessage =
    "./test/atx_heading_spacing.md: 3: first-heading-h1" +
    " First heading should be a top level heading\n" +
    "./test/atx_heading_spacing.md: 1: no-missing-space-atx" +
    " No space after hash on atx style heading\n" +
    "./test/atx_heading_spacing.md: 3: no-multiple-space-atx" +
    " Multiple spaces after hash on atx style heading\n" +
    "./test/atx_heading_spacing.md: 5: no-multiple-space-atx" +
    " Multiple spaces after hash on atx style heading\n" +
    "./test/first_heading_bad_atx.md: 1: first-heading-h1" +
    " First heading should be a top level heading";
  test.equal(actualMessage, expectedMessage, "Incorrect message (alias).");
  test.done();
};

module.exports.resultFormattingV1 = function resultFormattingV1(test) {
  test.expect(3);
  const options = {
    "strings": {
      "truncate":
        "#  Multiple spaces inside hashes on closed atx style heading  #"
    },
    "files": [
      "./test/atx_heading_spacing.md",
      "./test/first_heading_bad_atx.md"
    ],
    "config": defaultConfig,
    "resultVersion": 1
  };
  markdownlint(options, function callback(err, actualResult) {
    test.ifError(err);
    const expectedResult = {
      "truncate": [
        { "lineNumber": 1,
          "ruleName": "MD021",
          "ruleAlias": "no-multiple-space-closed-atx",
          "ruleDescription":
            "Multiple spaces inside hashes on closed atx style heading",
          "errorDetail": null,
          "errorContext": "#  Multiple spa...tyle heading  #",
          "errorRange": [ 1, 4 ] }
      ],
      "./test/atx_heading_spacing.md": [
        { "lineNumber": 3,
          "ruleName": "MD002",
          "ruleAlias": "first-heading-h1",
          "ruleDescription": "First heading should be a top level heading",
          "errorDetail": "Expected: h1; Actual: h2",
          "errorContext": null,
          "errorRange": null },
        { "lineNumber": 1,
          "ruleName": "MD018",
          "ruleAlias": "no-missing-space-atx",
          "ruleDescription": "No space after hash on atx style heading",
          "errorDetail": null,
          "errorContext": "#Heading 1 {MD018}",
          "errorRange": [ 1, 2 ] },
        { "lineNumber": 3,
          "ruleName": "MD019",
          "ruleAlias": "no-multiple-space-atx",
          "ruleDescription": "Multiple spaces after hash on atx style heading",
          "errorDetail": null,
          "errorContext": "##  Heading 2 {MD019}",
          "errorRange": [ 1, 5 ] },
        { "lineNumber": 5,
          "ruleName": "MD019",
          "ruleAlias": "no-multiple-space-atx",
          "ruleDescription": "Multiple spaces after hash on atx style heading",
          "errorDetail": null,
          "errorContext": "##   Heading 3 {MD019}",
          "errorRange": [ 1, 6 ] }
      ],
      "./test/first_heading_bad_atx.md": [
        { "lineNumber": 1,
          "ruleName": "MD002",
          "ruleAlias": "first-heading-h1",
          "ruleDescription": "First heading should be a top level heading",
          "errorDetail": "Expected: h1; Actual: h2",
          "errorContext": null,
          "errorRange": null }
      ]
    };
    test.deepEqual(actualResult, expectedResult, "Undetected issues.");
    const actualMessage = actualResult.toString();
    const expectedMessage =
      "truncate: 1: MD021/no-multiple-space-closed-atx" +
      " Multiple spaces inside hashes on closed atx style heading" +
      " [Context: \"#  Multiple spa...tyle heading  #\"]\n" +
      "./test/atx_heading_spacing.md: 3: MD002/first-heading-h1" +
      " First heading should be a top level heading" +
      " [Expected: h1; Actual: h2]\n" +
      "./test/atx_heading_spacing.md: 1: MD018/no-missing-space-atx" +
      " No space after hash on atx style heading" +
      " [Context: \"#Heading 1 {MD018}\"]\n" +
      "./test/atx_heading_spacing.md: 3: MD019/no-multiple-space-atx" +
      " Multiple spaces after hash on atx style heading" +
      " [Context: \"##  Heading 2 {MD019}\"]\n" +
      "./test/atx_heading_spacing.md: 5: MD019/no-multiple-space-atx" +
      " Multiple spaces after hash on atx style heading" +
      " [Context: \"##   Heading 3 {MD019}\"]\n" +
      "./test/first_heading_bad_atx.md: 1: MD002/first-heading-h1" +
      " First heading should be a top level heading" +
      " [Expected: h1; Actual: h2]";
    test.equal(actualMessage, expectedMessage, "Incorrect message.");
    test.done();
  });
};

module.exports.resultFormattingV2 = function resultFormattingV2(test) {
  test.expect(3);
  const options = {
    "strings": {
      "truncate":
        "#  Multiple spaces inside hashes on closed atx style heading  #"
    },
    "files": [
      "./test/atx_heading_spacing.md",
      "./test/first_heading_bad_atx.md"
    ],
    "config": defaultConfig
  };
  markdownlint(options, function callback(err, actualResult) {
    test.ifError(err);
    const expectedResult = {
      "truncate": [
        { "lineNumber": 1,
          "ruleNames": [ "MD021", "no-multiple-space-closed-atx" ],
          "ruleDescription":
            "Multiple spaces inside hashes on closed atx style heading",
          "errorDetail": null,
          "errorContext": "#  Multiple spa...tyle heading  #",
          "errorRange": [ 1, 4 ] }
      ],
      "./test/atx_heading_spacing.md": [
        { "lineNumber": 3,
          "ruleNames": [ "MD002", "first-heading-h1", "first-header-h1" ],
          "ruleDescription": "First heading should be a top level heading",
          "errorDetail": "Expected: h1; Actual: h2",
          "errorContext": null,
          "errorRange": null },
        { "lineNumber": 1,
          "ruleNames": [ "MD018", "no-missing-space-atx" ],
          "ruleDescription": "No space after hash on atx style heading",
          "errorDetail": null,
          "errorContext": "#Heading 1 {MD018}",
          "errorRange": [ 1, 2 ] },
        { "lineNumber": 3,
          "ruleNames": [ "MD019", "no-multiple-space-atx" ],
          "ruleDescription": "Multiple spaces after hash on atx style heading",
          "errorDetail": null,
          "errorContext": "##  Heading 2 {MD019}",
          "errorRange": [ 1, 5 ] },
        { "lineNumber": 5,
          "ruleNames": [ "MD019", "no-multiple-space-atx" ],
          "ruleDescription": "Multiple spaces after hash on atx style heading",
          "errorDetail": null,
          "errorContext": "##   Heading 3 {MD019}",
          "errorRange": [ 1, 6 ] }
      ],
      "./test/first_heading_bad_atx.md": [
        { "lineNumber": 1,
          "ruleNames": [ "MD002", "first-heading-h1", "first-header-h1" ],
          "ruleDescription": "First heading should be a top level heading",
          "errorDetail": "Expected: h1; Actual: h2",
          "errorContext": null,
          "errorRange": null }
      ]
    };
    test.deepEqual(actualResult, expectedResult, "Undetected issues.");
    const actualMessage = actualResult.toString();
    const expectedMessage =
      "truncate: 1: MD021/no-multiple-space-closed-atx" +
      " Multiple spaces inside hashes on closed atx style heading" +
      " [Context: \"#  Multiple spa...tyle heading  #\"]\n" +
      "./test/atx_heading_spacing.md: 3:" +
      " MD002/first-heading-h1/first-header-h1" +
      " First heading should be a top level heading" +
      " [Expected: h1; Actual: h2]\n" +
      "./test/atx_heading_spacing.md: 1: MD018/no-missing-space-atx" +
      " No space after hash on atx style heading" +
      " [Context: \"#Heading 1 {MD018}\"]\n" +
      "./test/atx_heading_spacing.md: 3: MD019/no-multiple-space-atx" +
      " Multiple spaces after hash on atx style heading" +
      " [Context: \"##  Heading 2 {MD019}\"]\n" +
      "./test/atx_heading_spacing.md: 5: MD019/no-multiple-space-atx" +
      " Multiple spaces after hash on atx style heading" +
      " [Context: \"##   Heading 3 {MD019}\"]\n" +
      "./test/first_heading_bad_atx.md: 1:" +
      " MD002/first-heading-h1/first-header-h1" +
      " First heading should be a top level heading" +
      " [Expected: h1; Actual: h2]";
    test.equal(actualMessage, expectedMessage, "Incorrect message.");
    test.done();
  });
};

module.exports.stringInputLineEndings = function stringInputLineEndings(test) {
  test.expect(2);
  const options = {
    "strings": {
      "cr": "One\rTwo\r#Three",
      "lf": "One\nTwo\n#Three",
      "crlf": "One\r\nTwo\r\n#Three",
      "mixed": "One\rTwo\n#Three",
      "crnel": "One\r\u0085Two\r\u0085#Three",
      "snl": "One\u2424Two\u2424#Three",
      "lsep": "One\u2028Two\u2028#Three",
      "nel": "One\u0085Two\u0085#Three"
    },
    "config": defaultConfig,
    "resultVersion": 0
  };
  markdownlint(options, function callback(err, actualResult) {
    test.ifError(err);
    const expectedResult = {
      "cr": { "MD018": [ 3 ] },
      "lf": { "MD018": [ 3 ] },
      "crlf": { "MD018": [ 3 ] },
      "mixed": { "MD018": [ 3 ] },
      "crnel": { "MD018": [ 3 ] },
      "snl": { "MD018": [ 3 ] },
      "lsep": { "MD018": [ 3 ] },
      "nel": { "MD018": [ 3 ] }
    };
    test.deepEqual(actualResult, expectedResult, "Undetected issues.");
    test.done();
  });
};

module.exports.inputOnlyNewline = function inputOnlyNewline(test) {
  test.expect(2);
  const options = {
    "strings": {
      "cr": "\r",
      "lf": "\n",
      "crlf": "\r\n"
    },
    "config": {
      "default": false
    }
  };
  markdownlint(options, function callback(err, actualResult) {
    test.ifError(err);
    const expectedResult = {
      "cr": [],
      "lf": [],
      "crlf": []
    };
    test.deepEqual(actualResult, expectedResult, "Undetected issues.");
    test.done();
  });
};

module.exports.defaultTrue = function defaultTrue(test) {
  test.expect(2);
  const options = {
    "files": [
      "./test/atx_heading_spacing.md",
      "./test/first_heading_bad_atx.md"
    ],
    "config": {
      "default": true
    },
    "resultVersion": 0
  };
  markdownlint(options, function callback(err, actualResult) {
    test.ifError(err);
    const expectedResult = {
      "./test/atx_heading_spacing.md": {
        "MD002": [ 3 ],
        "MD018": [ 1 ],
        "MD019": [ 3, 5 ],
        "MD041": [ 1 ]
      },
      "./test/first_heading_bad_atx.md": {
        "MD002": [ 1 ],
        "MD041": [ 1 ]
      }
    };
    test.deepEqual(actualResult, expectedResult, "Undetected issues.");
    test.done();
  });
};

module.exports.defaultFalse = function defaultFalse(test) {
  test.expect(2);
  const options = {
    "files": [
      "./test/atx_heading_spacing.md",
      "./test/first_heading_bad_atx.md"
    ],
    "config": {
      "default": false
    },
    "resultVersion": 0
  };
  markdownlint(options, function callback(err, actualResult) {
    test.ifError(err);
    const expectedResult = {
      "./test/atx_heading_spacing.md": {},
      "./test/first_heading_bad_atx.md": {}
    };
    test.deepEqual(actualResult, expectedResult, "Undetected issues.");
    test.done();
  });
};

module.exports.defaultUndefined = function defaultUndefined(test) {
  test.expect(2);
  const options = {
    "files": [
      "./test/atx_heading_spacing.md",
      "./test/first_heading_bad_atx.md"
    ],
    "config": {},
    "resultVersion": 0
  };
  markdownlint(options, function callback(err, actualResult) {
    test.ifError(err);
    const expectedResult = {
      "./test/atx_heading_spacing.md": {
        "MD002": [ 3 ],
        "MD018": [ 1 ],
        "MD019": [ 3, 5 ],
        "MD041": [ 1 ]
      },
      "./test/first_heading_bad_atx.md": {
        "MD002": [ 1 ],
        "MD041": [ 1 ]
      }
    };
    test.deepEqual(actualResult, expectedResult, "Undetected issues.");
    test.done();
  });
};

module.exports.disableRules = function disableRules(test) {
  test.expect(2);
  const options = {
    "files": [
      "./test/atx_heading_spacing.md",
      "./test/first_heading_bad_atx.md"
    ],
    "config": {
      "MD002": false,
      "default": true,
      "MD019": false,
      "first-line-h1": false
    },
    "resultVersion": 0
  };
  markdownlint(options, function callback(err, actualResult) {
    test.ifError(err);
    const expectedResult = {
      "./test/atx_heading_spacing.md": {
        "MD018": [ 1 ]
      },
      "./test/first_heading_bad_atx.md": {}
    };
    test.deepEqual(actualResult, expectedResult, "Undetected issues.");
    test.done();
  });
};

module.exports.enableRules = function enableRules(test) {
  test.expect(2);
  const options = {
    "files": [
      "./test/atx_heading_spacing.md",
      "./test/first_heading_bad_atx.md"
    ],
    "config": {
      "MD002": true,
      "default": false,
      "no-multiple-space-atx": true
    },
    "resultVersion": 0
  };
  markdownlint(options, function callback(err, actualResult) {
    test.ifError(err);
    const expectedResult = {
      "./test/atx_heading_spacing.md": {
        "MD002": [ 3 ],
        "MD019": [ 3, 5 ]
      },
      "./test/first_heading_bad_atx.md": {
        "MD002": [ 1 ]
      }
    };
    test.deepEqual(actualResult, expectedResult, "Undetected issues.");
    test.done();
  });
};

module.exports.enableRulesMixedCase = function enableRulesMixedCase(test) {
  test.expect(2);
  const options = {
    "files": [
      "./test/atx_heading_spacing.md",
      "./test/first_heading_bad_atx.md"
    ],
    "config": {
      "Md002": true,
      "DeFaUlT": false,
      "nO-mUlTiPlE-sPaCe-AtX": true
    },
    "resultVersion": 0
  };
  markdownlint(options, function callback(err, actualResult) {
    test.ifError(err);
    const expectedResult = {
      "./test/atx_heading_spacing.md": {
        "MD002": [ 3 ],
        "MD019": [ 3, 5 ]
      },
      "./test/first_heading_bad_atx.md": {
        "MD002": [ 1 ]
      }
    };
    test.deepEqual(actualResult, expectedResult, "Undetected issues.");
    test.done();
  });
};

module.exports.disableTag = function disableTag(test) {
  test.expect(2);
  const options = {
    "files": [
      "./test/atx_heading_spacing.md",
      "./test/first_heading_bad_atx.md"
    ],
    "config": {
      "default": true,
      "spaces": false
    },
    "resultVersion": 0
  };
  markdownlint(options, function callback(err, actualResult) {
    test.ifError(err);
    const expectedResult = {
      "./test/atx_heading_spacing.md": {
        "MD002": [ 3 ],
        "MD041": [ 1 ]
      },
      "./test/first_heading_bad_atx.md": {
        "MD002": [ 1 ],
        "MD041": [ 1 ]
      }
    };
    test.deepEqual(actualResult, expectedResult, "Undetected issues.");
    test.done();
  });
};

module.exports.enableTag = function enableTag(test) {
  test.expect(2);
  const options = {
    "files": [
      "./test/atx_heading_spacing.md",
      "./test/first_heading_bad_atx.md"
    ],
    "config": {
      "default": false,
      "spaces": true,
      "notatag": true
    },
    "resultVersion": 0
  };
  markdownlint(options, function callback(err, actualResult) {
    test.ifError(err);
    const expectedResult = {
      "./test/atx_heading_spacing.md": {
        "MD018": [ 1 ],
        "MD019": [ 3, 5 ]
      },
      "./test/first_heading_bad_atx.md": {}
    };
    test.deepEqual(actualResult, expectedResult, "Undetected issues.");
    test.done();
  });
};

module.exports.enableTagMixedCase = function enableTagMixedCase(test) {
  test.expect(2);
  const options = {
    "files": [
      "./test/atx_heading_spacing.md",
      "./test/first_heading_bad_atx.md"
    ],
    "config": {
      "DeFaUlT": false,
      "SpAcEs": true,
      "NoTaTaG": true
    },
    "resultVersion": 0
  };
  markdownlint(options, function callback(err, actualResult) {
    test.ifError(err);
    const expectedResult = {
      "./test/atx_heading_spacing.md": {
        "MD018": [ 1 ],
        "MD019": [ 3, 5 ]
      },
      "./test/first_heading_bad_atx.md": {}
    };
    test.deepEqual(actualResult, expectedResult, "Undetected issues.");
    test.done();
  });
};

module.exports.styleFiles = function styleFiles(test) {
  test.expect(4);
  fs.readdir("./style", function readdir(err, files) {
    test.ifError(err);
    files.forEach(function forFile(file) {
      test.ok(require(path.join("../style", file)), "Unable to load/parse.");
    });
    test.done();
  });
};

module.exports.styleAll = function styleAll(test) {
  test.expect(2);
  const options = {
    "files": [ "./test/break-all-the-rules.md" ],
    "config": require("../style/all.json"),
    "resultVersion": 0
  };
  markdownlint(options, function callback(err, actualResult) {
    test.ifError(err);
    const expectedResult = {
      "./test/break-all-the-rules.md": {
        "MD001": [ 3 ],
        "MD002": [ 1 ],
        "MD003": [ 5, 30 ],
        "MD004": [ 8 ],
        "MD005": [ 12 ],
        "MD006": [ 8 ],
        "MD007": [ 8, 11 ],
        "MD009": [ 14 ],
        "MD010": [ 14 ],
        "MD011": [ 16 ],
        "MD012": [ 18 ],
        "MD013": [ 21 ],
        "MD014": [ 23 ],
        "MD018": [ 25 ],
        "MD019": [ 27 ],
        "MD020": [ 29 ],
        "MD021": [ 30 ],
        "MD022": [ 30 ],
        "MD023": [ 30 ],
        "MD024": [ 34 ],
        "MD026": [ 40 ],
        "MD027": [ 42 ],
        "MD028": [ 43 ],
        "MD029": [ 47 ],
        "MD030": [ 8 ],
        "MD031": [ 50 ],
        "MD032": [ 51 ],
        "MD033": [ 55 ],
        "MD034": [ 57 ],
        "MD035": [ 61 ],
        "MD036": [ 65 ],
        "MD037": [ 67 ],
        "MD038": [ 69 ],
        "MD039": [ 71 ],
        "MD040": [ 73 ],
        "MD041": [ 1 ],
        "MD042": [ 77 ],
        "MD045": [ 81 ]
      }
    };
    test.deepEqual(actualResult, expectedResult, "Undetected issues.");
    test.done();
  });
};

module.exports.styleRelaxed = function styleRelaxed(test) {
  test.expect(2);
  const options = {
    "files": [ "./test/break-all-the-rules.md" ],
    "config": require("../style/relaxed.json"),
    "resultVersion": 0
  };
  markdownlint(options, function callback(err, actualResult) {
    test.ifError(err);
    const expectedResult = {
      "./test/break-all-the-rules.md": {
        "MD001": [ 3 ],
        "MD002": [ 1 ],
        "MD003": [ 5, 30 ],
        "MD004": [ 8 ],
        "MD005": [ 12 ],
        "MD011": [ 16 ],
        "MD014": [ 23 ],
        "MD018": [ 25 ],
        "MD019": [ 27 ],
        "MD020": [ 29 ],
        "MD021": [ 30 ],
        "MD022": [ 30 ],
        "MD023": [ 30 ],
        "MD024": [ 34 ],
        "MD026": [ 40 ],
        "MD029": [ 47 ],
        "MD031": [ 50 ],
        "MD032": [ 51 ],
        "MD035": [ 61 ],
        "MD036": [ 65 ],
        "MD042": [ 77 ],
        "MD045": [ 81 ]
      }
    };
    test.deepEqual(actualResult, expectedResult, "Undetected issues.");
    test.done();
  });
};

module.exports.nullFrontMatter = function nullFrontMatter(test) {
  test.expect(2);
  markdownlint({
    "strings": {
      "content": "---\n\t\n---\n# Heading\n"
    },
    "frontMatter": null,
    "config": {
      "default": false,
      "MD010": true
    },
    "resultVersion": 0
  }, function callback(err, result) {
    test.ifError(err);
    const expectedResult = {
      "content": { "MD010": [ 2 ] }
    };
    test.deepEqual(result, expectedResult, "Undetected issues.");
    test.done();
  });
};

module.exports.customFrontMatter = function customFrontMatter(test) {
  test.expect(2);
  markdownlint({
    "strings": {
      "content": "<head>\n\t\n</head>\n# Heading\n"
    },
    "frontMatter": /<head>[^]*<\/head>/,
    "config": {
      "default": false,
      "MD010": true
    }
  }, function callback(err, result) {
    test.ifError(err);
    const expectedResult = {
      "content": []
    };
    test.deepEqual(result, expectedResult, "Did not get empty results.");
    test.done();
  });
};

module.exports.noInlineConfig = function noInlineConfig(test) {
  test.expect(2);
  markdownlint({
    "strings": {
      "content": [
        "# Heading",
        "",
        "\tTab",
        "",
        "<!-- markdownlint-disable-->",
        "",
        "\tTab",
        "",
        "<!-- markdownlint-enable-->",
        "",
        "\tTab"
      ].join("\n")
    },
    "noInlineConfig": true,
    "resultVersion": 0
  }, function callback(err, result) {
    test.ifError(err);
    const expectedResult = {
      "content": {
        "MD010": [ 3, 7, 11 ]
      }
    };
    test.deepEqual(result, expectedResult, "Undetected issues.");
    test.done();
  });
};

module.exports.readmeHeadings = function readmeHeadings(test) {
  test.expect(2);
  markdownlint({
    "files": "README.md",
    "noInlineConfig": true,
    "config": {
      "default": false,
      "MD013": {
        "line_length": 150
      },
      "MD043": {
        "headings": [
          "# markdownlint",
          "## Install",
          "## Overview",
          "### Related",
          "## Demonstration",
          "## Rules / Aliases",
          "## Tags",
          "## Configuration",
          "## API",
          "### Linting",
          "#### options",
          "##### options.customRules",
          "##### options.files",
          "##### options.strings",
          "##### options.config",
          "##### options.frontMatter",
          "##### options.noInlineConfig",
          "##### options.resultVersion",
          "#### callback",
          "#### result",
          "### Config",
          "#### file",
          "#### parsers",
          "#### callback",
          "#### result",
          "## Usage",
          "## Browser",
          "## Examples",
          "## History"
        ]
      }
    }
  }, function callback(err, result) {
    test.ifError(err);
    const expected = { "README.md": [] };
    test.deepEqual(result, expected, "Unexpected issues.");
    test.done();
  });
};

module.exports.filesArrayNotModified = function filesArrayNotModified(test) {
  test.expect(2);
  const files = [
    "./test/atx_heading_spacing.md",
    "./test/first_heading_bad_atx.md"
  ];
  const expectedFiles = files.slice();
  markdownlint({ "files": files }, function callback(err) {
    test.ifError(err);
    test.deepEqual(files, expectedFiles, "Files modified.");
    test.done();
  });
};

module.exports.filesArrayAsString = function filesArrayAsString(test) {
  test.expect(2);
  markdownlint({
    "files": "README.md",
    "noInlineConfig": true,
    "config": {
      "MD013": { "line_length": 150 },
      "MD024": false
    }
  }, function callback(err, actual) {
    test.ifError(err);
    const expected = { "README.md": [] };
    test.deepEqual(actual, expected, "Unexpected issues.");
    test.done();
  });
};

module.exports.missingOptions = function missingOptions(test) {
  test.expect(2);
  markdownlint(null, function callback(err, result) {
    test.ifError(err);
    test.deepEqual(result, {}, "Did not get empty result for missing options.");
    test.done();
  });
};

module.exports.missingFilesAndStrings = function missingFilesAndStrings(test) {
  test.expect(2);
  markdownlint({}, function callback(err, result) {
    test.ifError(err);
    test.ok(result, "Did not get result for missing files/strings.");
    test.done();
  });
};

module.exports.missingCallback = function missingCallback(test) {
  test.expect(0);
  markdownlint();
  test.done();
};

module.exports.badFile = function badFile(test) {
  test.expect(4);
  markdownlint({
    "files": [ "./badFile" ]
  }, function callback(err, result) {
    test.ok(err, "Did not get an error for bad file.");
    test.ok(err instanceof Error, "Error not instance of Error.");
    test.equal(err.code, "ENOENT", "Error code for bad file not ENOENT.");
    test.ok(!result, "Got result for bad file.");
    test.done();
  });
};

module.exports.badFileSync = function badFileSync(test) {
  test.expect(4);
  test.throws(function badFileCall() {
    markdownlint.sync({
      "files": [ "./badFile" ]
    });
  }, function testError(err) {
    test.ok(err, "Did not get an error for bad file.");
    test.ok(err instanceof Error, "Error not instance of Error.");
    test.equal(err.code, "ENOENT", "Error code for bad file not ENOENT.");
    return true;
  }, "Did not get exception for bad file.");
  test.done();
};

module.exports.missingStringValue = function missingStringValue(test) {
  test.expect(2);
  markdownlint({
    "strings": {
      "undefined": undefined,
      "null": null,
      "empty": ""
    },
    "config": defaultConfig
  }, function callback(err, result) {
    test.ifError(err);
    const expectedResult = {
      "undefined": [],
      "null": [],
      "empty": []
    };
    test.deepEqual(result, expectedResult, "Did not get empty results.");
    test.done();
  });
};

module.exports.readme = function readme(test) {
  test.expect(109);
  const tagToRules = {};
  rules.forEach(function forRule(rule) {
    rule.tags.forEach(function forTag(tag) {
      const tagRules = tagToRules[tag] || [];
      tagRules.push(rule.names[0]);
      tagToRules[tag] = tagRules;
    });
  });
  fs.readFile("README.md", shared.utf8Encoding,
    function readFile(err, contents) {
      test.ifError(err);
      const rulesLeft = rules.slice();
      let seenRelated = false;
      let seenRules = false;
      let inRules = false;
      let seenTags = false;
      let inTags = false;
      md.parse(contents, {}).forEach(function forToken(token) {
        if (token.type === "bullet_list_open") {
          if (!seenRelated) {
            seenRelated = true;
          } else if (seenRelated && !seenRules) {
            seenRules = inRules = true;
          } else if (seenRelated && seenRules && !seenTags) {
            seenTags = inTags = true;
          }
        } else if (token.type === "bullet_list_close") {
          inRules = inTags = false;
        } else if (token.type === "inline") {
          if (inRules) {
            const rule = rulesLeft.shift();
            test.ok(rule,
              "Missing rule implementation for " + token.content + ".");
            if (rule) {
              const ruleName = rule.names[0];
              const ruleAliases = rule.names.slice(1);
              const expected = "**[" + ruleName + "](doc/Rules.md#" +
                ruleName.toLowerCase() + ")** *" +
                ruleAliases.join("/") + "* - " + rule.description;
              test.equal(token.content, expected, "Rule mismatch.");
            }
          } else if (inTags) {
            const parts =
              token.content.replace(/\*\*/g, "").split(/ - |, |,\n/);
            const tag = parts.shift();
            test.deepEqual(parts, tagToRules[tag] || [],
              "Rule mismatch for tag " + tag + ".");
            delete tagToRules[tag];
          }
        }
      });
      const ruleLeft = rulesLeft.shift();
      test.ok(!ruleLeft,
        "Missing rule documentation for " +
          (ruleLeft || "[NO RULE]").toString() + ".");
      const tagLeft = Object.keys(tagToRules).shift();
      test.ok(!tagLeft, "Undocumented tag " + tagLeft + ".");
      test.done();
    });
};

module.exports.doc = function doc(test) {
  test.expect(310);
  fs.readFile("doc/Rules.md", shared.utf8Encoding,
    function readFile(err, contents) {
      test.ifError(err);
      const rulesLeft = rules.slice();
      let inHeading = false;
      let rule = null;
      let ruleHasTags = true;
      let ruleHasAliases = true;
      let ruleUsesParams = null;
      const tagAliasParameterRe = /, |: | /;
      function testTagsAliasesParams(r) {
        r = r || "[NO RULE]";
        test.ok(ruleHasTags,
          "Missing tags for rule " + r.toString() + ".");
        test.ok(ruleHasAliases,
          "Missing aliases for rule " + r.toString() + ".");
        test.ok(!ruleUsesParams,
          "Missing parameters for rule " + r.toString() + ".");
      }
      md.parse(contents, {}).forEach(function forToken(token) {
        if ((token.type === "heading_open") && (token.tag === "h2")) {
          inHeading = true;
        } else if (token.type === "heading_close") {
          inHeading = false;
        } else if (token.type === "inline") {
          if (inHeading) {
            testTagsAliasesParams(rule);
            rule = rulesLeft.shift();
            ruleHasTags = ruleHasAliases = false;
            test.ok(rule,
              "Missing rule implementation for " + token.content + ".");
            test.equal(token.content,
              rule.names[0] + " - " + rule.description,
              "Rule mismatch.");
            ruleUsesParams = rule.function.toString()
              .match(/params\.config\.[_a-z]*/gi);
            if (ruleUsesParams) {
              ruleUsesParams = ruleUsesParams.map(function forUse(use) {
                return use.split(".").pop();
              });
            }
          } else if (/^Tags: /.test(token.content) && rule) {
            test.deepEqual(token.content.split(tagAliasParameterRe).slice(1),
              rule.tags, "Tag mismatch for rule " + rule.toString() + ".");
            ruleHasTags = true;
          } else if (/^Aliases: /.test(token.content) && rule) {
            test.deepEqual(token.content.split(tagAliasParameterRe).slice(1),
              rule.names.slice(1),
              "Alias mismatch for rule " + rule.toString() + ".");
            ruleHasAliases = true;
          } else if (/^Parameters: /.test(token.content) && rule) {
            let inDetails = false;
            const parameters = token.content.split(tagAliasParameterRe)
              .slice(1)
              .filter(function forPart(part) {
                inDetails = inDetails || (part[0] === "(");
                return !inDetails;
              });
            test.deepEqual(parameters, ruleUsesParams,
              "Missing parameter for rule " + rule.toString());
            ruleUsesParams = null;
          }
        }
      });
      const ruleLeft = rulesLeft.shift();
      test.ok(!ruleLeft,
        "Missing rule documentation for " +
          (ruleLeft || "[NO RULE]").toString() + ".");
      if (rule) {
        testTagsAliasesParams(rule);
      }
      test.done();
    });
};

module.exports.validateConfigSchema = function validateConfigSchema(test) {
  const jsonFileRe = /\.json$/i;
  const resultsFileRe = /\.results\.json$/i;
  const testDirectory = __dirname;
  const testFiles = fs.readdirSync(testDirectory);
  testFiles.filter(function filterFile(file) {
    return jsonFileRe.test(file) && !resultsFileRe.test(file);
  }).forEach(function forFile(file) {
    const data = fs.readFileSync(path.join(testDirectory, file));
    test.ok(
      tv4.validate(JSON.parse(data), configSchema),
      file + "\n" + JSON.stringify(tv4.error, null, 2));
  });
  test.done();
};

module.exports.clearHtmlCommentTextValid =
function clearHtmlCommentTextValid(test) {
  test.expect(1);
  const validComments = [
    "<!-- text -->",
    "<!--text-->",
    "<!-- -->",
    "<!---->",
    "<!---text-->",
    "<!--text-text-->",
    "<!--- -->",
    "<!--",
    "-->",
    "<!--",
    "",
    "-->",
    "<!--",
    "",
    "",
    "-->",
    "<!--",
    "",
    " text ",
    "",
    "-->",
    "<!--text",
    "",
    "text-->",
    "text<!--text-->text",
    "text<!--",
    "-->text",
    "text<!--",
    "text",
    "-->text",
    "<!--text--><!--text-->",
    "text<!--text-->text<!--text-->text",
    "<!--",
    "text"
  ];
  const validResult = [
    "<!--      -->",
    "<!--    -->",
    "<!-- -->",
    "<!---->",
    "<!--     -->",
    "<!--         -->",
    "<!--  -->",
    "<!--",
    "-->",
    "<!--",
    "",
    "-->",
    "<!--",
    "",
    "",
    "-->",
    "<!--",
    "",
    "     \\",
    "",
    "-->",
    "<!--   \\",
    "",
    "    -->",
    "text<!--    -->text",
    "text<!--",
    "-->text",
    "text<!--",
    "   \\",
    "-->text",
    "<!--    --><!--    -->",
    "text<!--    -->text<!--    -->text",
    "<!--",
    "    \\"
  ];
  const actual = shared.clearHtmlCommentText(validComments.join("\n"));
  const expected = validResult.join("\n");
  test.equal(actual, expected);
  test.done();
};

module.exports.clearHtmlCommentTextInvalid =
function clearHtmlCommentTextInvalid(test) {
  test.expect(1);
  const invalidComments = [
    "<!>",
    "<!->",
    "<!-->",
    "<!--->",
    "<!-->-->",
    "<!--->-->",
    "<!----->",
    "<!------>",
    "<!-- -- -->",
    "<!-->-->",
    "<!--> -->",
    "<!--->-->",
    "<!-->text-->",
    "<!--->text-->",
    "<!--text--->",
    "<!--te--xt-->"
  ];
  const actual = shared.clearHtmlCommentText(invalidComments.join("\n"));
  const expected = invalidComments.join("\n");
  test.equal(actual, expected);
  test.done();
};

module.exports.clearHtmlCommentTextNonGreedy =
function clearHtmlCommentTextNonGreedy(test) {
  test.expect(1);
  const nonGreedyComments = [
    "<!-- text --> -->",
    "<!---text --> -->",
    "<!--t--> -->",
    "<!----> -->"
  ];
  const nonGreedyResult = [
    "<!--      --> -->",
    "<!--      --> -->",
    "<!-- --> -->",
    "<!----> -->"
  ];
  const actual = shared.clearHtmlCommentText(nonGreedyComments.join("\n"));
  const expected = nonGreedyResult.join("\n");
  test.equal(actual, expected);
  test.done();
};

module.exports.clearHtmlCommentTextEmbedded =
function clearHtmlCommentTextEmbedded(test) {
  test.expect(1);
  const embeddedComments = [
    "text<!--text-->text",
    "<!-- markdownlint-disable MD010 -->",
    "text<!--text-->text",
    "text<!-- markdownlint-disable MD010 -->text",
    "text<!--text-->text"
  ];
  const embeddedResult = [
    "text<!--    -->text",
    "<!-- markdownlint-disable MD010 -->",
    "text<!--    -->text",
    "text<!-- markdownlint-disable MD010 -->text",
    "text<!--    -->text"
  ];
  const actual = shared.clearHtmlCommentText(embeddedComments.join("\n"));
  const expected = embeddedResult.join("\n");
  test.equal(actual, expected);
  test.done();
};

module.exports.trimLeftRight = function trimLeftRight(test) {
  const inputs = [
    "text text",
    " text text ",
    "   text text   ",
    // ECMAScript Whitespace
    "\u0009 text text \u0009",
    "\u000b text text \u000b",
    "\u000c text text \u000c",
    "\u0020 text text \u0020",
    "\u00a0 text text \u00a0",
    "\ufeff text text \ufeff",
    // ECMAScript LineTerminator
    "\u000a text text \u000a",
    "\u000d text text \u000d",
    "\u2028 text text \u2028",
    "\u2029 text text \u2029"
  ];
  test.expect(inputs.length * 2);
  inputs.forEach(function forInput(input) {
    test.equal(shared.trimLeft(input), input.trimLeft(),
      "trimLeft incorrect for '" + input + "'");
    test.equal(shared.trimRight(input), input.trimRight(),
      "trimRight incorrect for '" + input + "'");
  });
  test.done();
};

module.exports.configSingle = function configSingle(test) {
  test.expect(2);
  markdownlint.readConfig("./test/config/config-child.json",
    function callback(err, actual) {
      test.ifError(err);
      const expected = require("./config/config-child.json");
      test.deepEqual(actual, expected, "Config object not correct.");
      test.done();
    });
};

module.exports.configAbsolute = function configAbsolute(test) {
  test.expect(2);
  markdownlint.readConfig(path.join(__dirname, "config", "config-child.json"),
    function callback(err, actual) {
      test.ifError(err);
      const expected = require("./config/config-child.json");
      test.deepEqual(actual, expected, "Config object not correct.");
      test.done();
    });
};

module.exports.configMultiple = function configMultiple(test) {
  test.expect(2);
  markdownlint.readConfig("./test/config/config-grandparent.json",
    function callback(err, actual) {
      test.ifError(err);
      const expected = shared.assign(
        shared.assign(
          shared.assign({}, require("./config/config-child.json")),
          require("./config/config-parent.json")),
        require("./config/config-grandparent.json"));
      delete expected.extends;
      test.deepEqual(actual, expected, "Config object not correct.");
      test.done();
    });
};

module.exports.configBadFile = function configBadFile(test) {
  test.expect(4);
  markdownlint.readConfig("./test/config/config-badfile.json",
    function callback(err, result) {
      test.ok(err, "Did not get an error for bad file.");
      test.ok(err instanceof Error, "Error not instance of Error.");
      test.equal(err.code, "ENOENT", "Error code for bad file not ENOENT.");
      test.ok(!result, "Got result for bad file.");
      test.done();
    });
};

module.exports.configBadChildFile = function configBadChildFile(test) {
  test.expect(4);
  markdownlint.readConfig("./test/config/config-badchildfile.json",
    function callback(err, result) {
      test.ok(err, "Did not get an error for bad child file.");
      test.ok(err instanceof Error, "Error not instance of Error.");
      test.equal(err.code, "ENOENT",
        "Error code for bad child file not ENOENT.");
      test.ok(!result, "Got result for bad child file.");
      test.done();
    });
};

module.exports.configBadJson = function configBadJson(test) {
  test.expect(3);
  markdownlint.readConfig("./test/config/config-badjson.json",
    function callback(err, result) {
      test.ok(err, "Did not get an error for bad JSON.");
      test.ok(err instanceof Error, "Error not instance of Error.");
      test.ok(!result, "Got result for bad JSON.");
      test.done();
    });
};

module.exports.configBadChildJson = function configBadChildJson(test) {
  test.expect(3);
  markdownlint.readConfig("./test/config/config-badchildjson.json",
    function callback(err, result) {
      test.ok(err, "Did not get an error for bad child JSON.");
      test.ok(err instanceof Error, "Error not instance of Error.");
      test.ok(!result, "Got result for bad child JSON.");
      test.done();
    });
};

module.exports.configSingleYaml = function configSingleYaml(test) {
  test.expect(2);
  markdownlint.readConfig(
    "./test/config/config-child.yaml",
    [ require("js-yaml").safeLoad ],
    function callback(err, actual) {
      test.ifError(err);
      const expected = require("./config/config-child.json");
      test.deepEqual(actual, expected, "Config object not correct.");
      test.done();
    });
};

module.exports.configMultipleYaml = function configMultipleYaml(test) {
  test.expect(2);
  markdownlint.readConfig(
    "./test/config/config-grandparent.yaml",
    [ require("js-yaml").safeLoad ],
    function callback(err, actual) {
      test.ifError(err);
      const expected = shared.assign(
        shared.assign(
          shared.assign({}, require("./config/config-child.json")),
          require("./config/config-parent.json")),
        require("./config/config-grandparent.json"));
      delete expected.extends;
      test.deepEqual(actual, expected, "Config object not correct.");
      test.done();
    });
};

module.exports.configMultipleHybrid = function configMultipleHybrid(test) {
  test.expect(2);
  markdownlint.readConfig(
    "./test/config/config-grandparent-hybrid.yaml",
    [ JSON.parse, require("toml").parse, require("js-yaml").safeLoad ],
    function callback(err, actual) {
      test.ifError(err);
      const expected = shared.assign(
        shared.assign(
          shared.assign({}, require("./config/config-child.json")),
          require("./config/config-parent.json")),
        require("./config/config-grandparent.json"));
      delete expected.extends;
      test.deepEqual(actual, expected, "Config object not correct.");
      test.done();
    });
};

module.exports.configBadHybrid = function configBadHybrid(test) {
  test.expect(4);
  markdownlint.readConfig(
    "./test/config/config-badcontent.txt",
    [ JSON.parse, require("toml").parse, require("js-yaml").safeLoad ],
    function callback(err, result) {
      test.ok(err, "Did not get an error for bad child JSON.");
      test.ok(err instanceof Error, "Error not instance of Error.");
      test.ok(err.message.match(
        // eslint-disable-next-line max-len
        /^Unable to parse '[^']*'; Unexpected token \S+ in JSON at position \d+; Expected [^;]+ or end of input but "\S+" found.; end of the stream or a document separator is expected at line \d+, column \d+:[^;]*$/
      ), "Error message unexpected.");
      test.ok(!result, "Got result for bad child JSON.");
      test.done();
    });
};

module.exports.configSingleSync = function configSingleSync(test) {
  test.expect(1);
  const actual = markdownlint.readConfigSync("./test/config/config-child.json");
  const expected = require("./config/config-child.json");
  test.deepEqual(actual, expected, "Config object not correct.");
  test.done();
};

module.exports.configAbsoluteSync = function configAbsoluteSync(test) {
  test.expect(1);
  const actual = markdownlint.readConfigSync(
    path.join(__dirname, "config", "config-child.json"));
  const expected = require("./config/config-child.json");
  test.deepEqual(actual, expected, "Config object not correct.");
  test.done();
};

module.exports.configMultipleSync = function configMultipleSync(test) {
  test.expect(1);
  const actual =
    markdownlint.readConfigSync("./test/config/config-grandparent.json");
  const expected = shared.assign(
    shared.assign(
      shared.assign({}, require("./config/config-child.json")),
      require("./config/config-parent.json")),
    require("./config/config-grandparent.json"));
  delete expected.extends;
  test.deepEqual(actual, expected, "Config object not correct.");
  test.done();
};

module.exports.configBadFileSync = function configBadFileSync(test) {
  test.expect(4);
  test.throws(function badFileCall() {
    markdownlint.readConfigSync("./test/config/config-badfile.json");
  }, function testError(err) {
    test.ok(err, "Did not get an error for bad file.");
    test.ok(err instanceof Error, "Error not instance of Error.");
    test.equal(err.code, "ENOENT", "Error code for bad file not ENOENT.");
    return true;
  }, "Did not get exception for bad file.");
  test.done();
};

module.exports.configBadChildFileSync = function configBadChildFileSync(test) {
  test.expect(4);
  test.throws(function badChildFileCall() {
    markdownlint.readConfigSync("./test/config/config-badchildfile.json");
  }, function testError(err) {
    test.ok(err, "Did not get an error for bad child file.");
    test.ok(err instanceof Error, "Error not instance of Error.");
    test.equal(err.code, "ENOENT", "Error code for bad child file not ENOENT.");
    return true;
  }, "Did not get exception for bad child file.");
  test.done();
};

module.exports.configBadJsonSync = function configBadJsonSync(test) {
  test.expect(4);
  test.throws(function badJsonCall() {
    markdownlint.readConfigSync("./test/config/config-badjson.json");
  }, function testError(err) {
    test.ok(err, "Did not get an error for bad JSON.");
    test.ok(err instanceof Error, "Error not instance of Error.");
    test.ok(err.message.match(
      // eslint-disable-next-line max-len
      /^Unable to parse '[^']*'; Unexpected token \S+ in JSON at position \d+$/
    ), "Error message unexpected.");
    return true;
  }, "Did not get exception for bad JSON.");
  test.done();
};

module.exports.configBadChildJsonSync = function configBadChildJsonSync(test) {
  test.expect(4);
  test.throws(function badChildJsonCall() {
    markdownlint.readConfigSync("./test/config/config-badchildjson.json");
  }, function testError(err) {
    test.ok(err, "Did not get an error for bad child JSON.");
    test.ok(err instanceof Error, "Error not instance of Error.");
    test.ok(err.message.match(
      // eslint-disable-next-line max-len
      /^Unable to parse '[^']*'; Unexpected token \S+ in JSON at position \d+$/
    ), "Error message unexpected.");
    return true;
  }, "Did not get exception for bad child JSON.");
  test.done();
};

module.exports.configSingleYamlSync = function configSingleYamlSync(test) {
  test.expect(1);
  const actual = markdownlint.readConfigSync(
    "./test/config/config-child.yaml", [ require("js-yaml").safeLoad ]);
  const expected = require("./config/config-child.json");
  test.deepEqual(actual, expected, "Config object not correct.");
  test.done();
};

module.exports.configMultipleYamlSync = function configMultipleYamlSync(test) {
  test.expect(1);
  const actual = markdownlint.readConfigSync(
    "./test/config/config-grandparent.yaml", [ require("js-yaml").safeLoad ]);
  const expected = shared.assign(
    shared.assign(
      shared.assign({}, require("./config/config-child.json")),
      require("./config/config-parent.json")),
    require("./config/config-grandparent.json"));
  delete expected.extends;
  test.deepEqual(actual, expected, "Config object not correct.");
  test.done();
};

module.exports.configMultipleHybridSync =
function configMultipleHybridSync(test) {
  test.expect(1);
  const actual = markdownlint.readConfigSync(
    "./test/config/config-grandparent-hybrid.yaml",
    [ JSON.parse, require("toml").parse, require("js-yaml").safeLoad ]);
  const expected = shared.assign(
    shared.assign(
      shared.assign({}, require("./config/config-child.json")),
      require("./config/config-parent.json")),
    require("./config/config-grandparent.json"));
  delete expected.extends;
  test.deepEqual(actual, expected, "Config object not correct.");
  test.done();
};

module.exports.configBadHybridSync = function configBadHybridSync(test) {
  test.expect(4);
  test.throws(function badHybridCall() {
    markdownlint.readConfigSync(
      "./test/config/config-badcontent.txt",
      [ JSON.parse, require("toml").parse, require("js-yaml").safeLoad ]);
  }, function testError(err) {
    test.ok(err, "Did not get an error for bad content.");
    test.ok(err instanceof Error, "Error not instance of Error.");
    test.ok(err.message.match(
      // eslint-disable-next-line max-len
      /^Unable to parse '[^']*'; Unexpected token \S+ in JSON at position \d+; Expected [^;]+ or end of input but "\S+" found.; end of the stream or a document separator is expected at line \d+, column \d+:[^;]*$/
    ), "Error message unexpected.");
    return true;
  }, "Did not get exception for bad content.");
  test.done();
};

module.exports.customRulesV0 = function customRulesV0(test) {
  test.expect(4);
  const customRulesMd = "./test/custom-rules.md";
  const options = {
    "customRules": customRules.all,
    "files": [ customRulesMd ],
    "resultVersion": 0
  };
  markdownlint(options, function callback(err, actualResult) {
    test.ifError(err);
    const expectedResult = {};
    expectedResult[customRulesMd] = {
      "any-blockquote": [ 12 ],
      "every-n-lines": [ 2, 4, 6, 10, 12 ],
      "first-line": [ 1 ],
      "letters-E-X": [ 3, 7 ]
    };
    test.deepEqual(actualResult, expectedResult, "Undetected issues.");
    let actualMessage = actualResult.toString();
    let expectedMessage =
      "./test/custom-rules.md: 12: any-blockquote" +
      " Rule that reports an error for any blockquote\n" +
      "./test/custom-rules.md: 2: every-n-lines" +
      " Rule that reports an error every N lines\n" +
      "./test/custom-rules.md: 4: every-n-lines" +
      " Rule that reports an error every N lines\n" +
      "./test/custom-rules.md: 6: every-n-lines" +
      " Rule that reports an error every N lines\n" +
      "./test/custom-rules.md: 10: every-n-lines" +
      " Rule that reports an error every N lines\n" +
      "./test/custom-rules.md: 12: every-n-lines" +
      " Rule that reports an error every N lines\n" +
      "./test/custom-rules.md: 1: first-line" +
      " Rule that reports an error for the first line\n" +
      "./test/custom-rules.md: 3: letters-E-X" +
      " Rule that reports an error for lines with the letters 'EX'\n" +
      "./test/custom-rules.md: 7: letters-E-X" +
      " Rule that reports an error for lines with the letters 'EX'";
    test.equal(actualMessage, expectedMessage, "Incorrect message (name).");
    actualMessage = actualResult.toString(true);
    expectedMessage =
      "./test/custom-rules.md: 12: any-blockquote" +
      " Rule that reports an error for any blockquote\n" +
      "./test/custom-rules.md: 2: every-n-lines" +
      " Rule that reports an error every N lines\n" +
      "./test/custom-rules.md: 4: every-n-lines" +
      " Rule that reports an error every N lines\n" +
      "./test/custom-rules.md: 6: every-n-lines" +
      " Rule that reports an error every N lines\n" +
      "./test/custom-rules.md: 10: every-n-lines" +
      " Rule that reports an error every N lines\n" +
      "./test/custom-rules.md: 12: every-n-lines" +
      " Rule that reports an error every N lines\n" +
      "./test/custom-rules.md: 1: first-line" +
      " Rule that reports an error for the first line\n" +
      "./test/custom-rules.md: 3: letter-E-letter-X" +
      " Rule that reports an error for lines with the letters 'EX'\n" +
      "./test/custom-rules.md: 7: letter-E-letter-X" +
      " Rule that reports an error for lines with the letters 'EX'";
    test.equal(actualMessage, expectedMessage, "Incorrect message (alias).");
    test.done();
  });
};

module.exports.customRulesV1 = function customRulesV1(test) {
  test.expect(3);
  const customRulesMd = "./test/custom-rules.md";
  const options = {
    "customRules": customRules.all,
    "files": [ customRulesMd ],
    "resultVersion": 1
  };
  markdownlint(options, function callback(err, actualResult) {
    test.ifError(err);
    const expectedResult = {};
    expectedResult[customRulesMd] = [
      { "lineNumber": 12,
        "ruleName": "any-blockquote",
        "ruleAlias": "any-blockquote",
        "ruleDescription": "Rule that reports an error for any blockquote",
        "errorDetail": "Blockquote spans 1 line(s).",
        "errorContext": "> Block",
        "errorRange": null },
      { "lineNumber": 2,
        "ruleName": "every-n-lines",
        "ruleAlias": "every-n-lines",
        "ruleDescription": "Rule that reports an error every N lines",
        "errorDetail": "Line number 2",
        "errorContext": null,
        "errorRange": null },
      { "lineNumber": 4,
        "ruleName": "every-n-lines",
        "ruleAlias": "every-n-lines",
        "ruleDescription": "Rule that reports an error every N lines",
        "errorDetail": "Line number 4",
        "errorContext": null,
        "errorRange": null },
      { "lineNumber": 6,
        "ruleName": "every-n-lines",
        "ruleAlias": "every-n-lines",
        "ruleDescription": "Rule that reports an error every N lines",
        "errorDetail": "Line number 6",
        "errorContext": null,
        "errorRange": null },
      { "lineNumber": 10,
        "ruleName": "every-n-lines",
        "ruleAlias": "every-n-lines",
        "ruleDescription": "Rule that reports an error every N lines",
        "errorDetail": "Line number 10",
        "errorContext": null,
        "errorRange": null },
      { "lineNumber": 12,
        "ruleName": "every-n-lines",
        "ruleAlias": "every-n-lines",
        "ruleDescription": "Rule that reports an error every N lines",
        "errorDetail": "Line number 12",
        "errorContext": null,
        "errorRange": null },
      { "lineNumber": 1,
        "ruleName": "first-line",
        "ruleAlias": "first-line",
        "ruleDescription": "Rule that reports an error for the first line",
        "errorDetail": null,
        "errorContext": null,
        "errorRange": null },
      { "lineNumber": 3,
        "ruleName": "letters-E-X",
        "ruleAlias": "letter-E-letter-X",
        "ruleDescription":
          "Rule that reports an error for lines with the letters 'EX'",
        "errorDetail": null,
        "errorContext": "text",
        "errorRange": null },
      { "lineNumber": 7,
        "ruleName": "letters-E-X",
        "ruleAlias": "letter-E-letter-X",
        "ruleDescription":
          "Rule that reports an error for lines with the letters 'EX'",
        "errorDetail": null,
        "errorContext": "text",
        "errorRange": null }
    ];
    test.deepEqual(actualResult, expectedResult, "Undetected issues.");
    const actualMessage = actualResult.toString();
    const expectedMessage =
      "./test/custom-rules.md: 12: any-blockquote/any-blockquote" +
      " Rule that reports an error for any blockquote" +
      " [Blockquote spans 1 line(s).] [Context: \"> Block\"]\n" +
      "./test/custom-rules.md: 2: every-n-lines/every-n-lines" +
      " Rule that reports an error every N lines [Line number 2]\n" +
      "./test/custom-rules.md: 4: every-n-lines/every-n-lines" +
      " Rule that reports an error every N lines [Line number 4]\n" +
      "./test/custom-rules.md: 6: every-n-lines/every-n-lines" +
      " Rule that reports an error every N lines [Line number 6]\n" +
      "./test/custom-rules.md: 10: every-n-lines/every-n-lines" +
      " Rule that reports an error every N lines [Line number 10]\n" +
      "./test/custom-rules.md: 12: every-n-lines/every-n-lines" +
      " Rule that reports an error every N lines [Line number 12]\n" +
      "./test/custom-rules.md: 1: first-line/first-line" +
      " Rule that reports an error for the first line\n" +
      "./test/custom-rules.md: 3: letters-E-X/letter-E-letter-X" +
      " Rule that reports an error for lines with the letters 'EX'" +
      " [Context: \"text\"]\n" +
      "./test/custom-rules.md: 7: letters-E-X/letter-E-letter-X" +
      " Rule that reports an error for lines with the letters 'EX'" +
      " [Context: \"text\"]";
    test.equal(actualMessage, expectedMessage, "Incorrect message.");
    test.done();
  });
};

module.exports.customRulesV2 = function customRulesV2(test) {
  test.expect(3);
  const customRulesMd = "./test/custom-rules.md";
  const options = {
    "customRules": customRules.all,
    "files": [ customRulesMd ],
    "resultVersion": 2
  };
  markdownlint(options, function callback(err, actualResult) {
    test.ifError(err);
    const expectedResult = {};
    expectedResult[customRulesMd] = [
      { "lineNumber": 12,
        "ruleNames": [ "any-blockquote" ],
        "ruleDescription": "Rule that reports an error for any blockquote",
        "errorDetail": "Blockquote spans 1 line(s).",
        "errorContext": "> Block",
        "errorRange": null },
      { "lineNumber": 2,
        "ruleNames": [ "every-n-lines" ],
        "ruleDescription": "Rule that reports an error every N lines",
        "errorDetail": "Line number 2",
        "errorContext": null,
        "errorRange": null },
      { "lineNumber": 4,
        "ruleNames": [ "every-n-lines" ],
        "ruleDescription": "Rule that reports an error every N lines",
        "errorDetail": "Line number 4",
        "errorContext": null,
        "errorRange": null },
      { "lineNumber": 6,
        "ruleNames": [ "every-n-lines" ],
        "ruleDescription": "Rule that reports an error every N lines",
        "errorDetail": "Line number 6",
        "errorContext": null,
        "errorRange": null },
      { "lineNumber": 10,
        "ruleNames": [ "every-n-lines" ],
        "ruleDescription": "Rule that reports an error every N lines",
        "errorDetail": "Line number 10",
        "errorContext": null,
        "errorRange": null },
      { "lineNumber": 12,
        "ruleNames": [ "every-n-lines" ],
        "ruleDescription": "Rule that reports an error every N lines",
        "errorDetail": "Line number 12",
        "errorContext": null,
        "errorRange": null },
      { "lineNumber": 1,
        "ruleNames": [ "first-line" ],
        "ruleDescription": "Rule that reports an error for the first line",
        "errorDetail": null,
        "errorContext": null,
        "errorRange": null },
      { "lineNumber": 3,
        "ruleNames": [ "letters-E-X", "letter-E-letter-X", "contains-ex" ],
        "ruleDescription":
          "Rule that reports an error for lines with the letters 'EX'",
        "errorDetail": null,
        "errorContext": "text",
        "errorRange": null },
      { "lineNumber": 7,
        "ruleNames": [ "letters-E-X", "letter-E-letter-X", "contains-ex" ],
        "ruleDescription":
          "Rule that reports an error for lines with the letters 'EX'",
        "errorDetail": null,
        "errorContext": "text",
        "errorRange": null }
    ];
    test.deepEqual(actualResult, expectedResult, "Undetected issues.");
    const actualMessage = actualResult.toString();
    const expectedMessage =
      "./test/custom-rules.md: 12: any-blockquote" +
      " Rule that reports an error for any blockquote" +
      " [Blockquote spans 1 line(s).] [Context: \"> Block\"]\n" +
      "./test/custom-rules.md: 2: every-n-lines" +
      " Rule that reports an error every N lines [Line number 2]\n" +
      "./test/custom-rules.md: 4: every-n-lines" +
      " Rule that reports an error every N lines [Line number 4]\n" +
      "./test/custom-rules.md: 6: every-n-lines" +
      " Rule that reports an error every N lines [Line number 6]\n" +
      "./test/custom-rules.md: 10: every-n-lines" +
      " Rule that reports an error every N lines [Line number 10]\n" +
      "./test/custom-rules.md: 12: every-n-lines" +
      " Rule that reports an error every N lines [Line number 12]\n" +
      "./test/custom-rules.md: 1: first-line" +
      " Rule that reports an error for the first line\n" +
      "./test/custom-rules.md: 3: letters-E-X/letter-E-letter-X/contains-ex" +
      " Rule that reports an error for lines with the letters 'EX'" +
      " [Context: \"text\"]\n" +
      "./test/custom-rules.md: 7: letters-E-X/letter-E-letter-X/contains-ex" +
      " Rule that reports an error for lines with the letters 'EX'" +
      " [Context: \"text\"]";
    test.equal(actualMessage, expectedMessage, "Incorrect message.");
    test.done();
  });
};

module.exports.customRulesConfig = function customRulesConfig(test) {
  test.expect(2);
  const customRulesMd = "./test/custom-rules.md";
  const options = {
    "customRules": customRules.all,
    "files": [ customRulesMd ],
    "config": {
      "blockquote": true,
      "every-n-lines": {
        "n": 3
      },
      "letters-e-x": false
    },
    "resultVersion": 0
  };
  markdownlint(options, function callback(err, actualResult) {
    test.ifError(err);
    const expectedResult = {};
    expectedResult[customRulesMd] = {
      "any-blockquote": [ 12 ],
      "every-n-lines": [ 3, 6, 12 ],
      "first-line": [ 1 ],
      "letters-E-X": [ 7 ]
    };
    test.deepEqual(actualResult, expectedResult, "Undetected issues.");
    test.done();
  });
};

module.exports.customRulesBadProperty = function customRulesBadProperty(test) {
  test.expect(76);
  [
    [ "names", [ null, "string", [], [ null ], [ "" ], [ "string", 10 ] ] ],
    [ "description", [ null, 10, "", [] ] ],
    [ "tags", [ null, "string", [], [ null ], [ "" ], [ "string", 10 ] ] ],
    [ "function", [ null, "string", [] ] ]
  ].forEach(function forProperty(property) {
    const propertyName = property[0];
    property[1].forEach(function forPropertyValue(propertyValue) {
      const badRule = shared.clone(customRules.anyBlockquote);
      badRule[propertyName] = propertyValue;
      const options = {
        "customRules": [ badRule ]
      };
      test.throws(function badRuleCall() {
        markdownlint.sync(options);
      }, function testError(err) {
        test.ok(err, "Did not get an error for missing property.");
        test.ok(err instanceof Error, "Error not instance of Error.");
        test.equal(err.message,
          "Property '" + propertyName +
            "' of custom rule at index 0 is incorrect.",
          "Incorrect message for missing property.");
        return true;
      }, "Did not get exception for missing property.");
    });
  });
  test.done();
};

module.exports.customRulesUsedNameName =
function customRulesUsedNameName(test) {
  test.expect(4);
  markdownlint({
    "customRules": [
      {
        "names": [ "name", "NO-missing-SPACE-atx" ],
        "description": "description",
        "tags": [ "tag" ],
        "function": function noop() {}
      }
    ]
  }, function callback(err, result) {
    test.ok(err, "Did not get an error for duplicate name.");
    test.ok(err instanceof Error, "Error not instance of Error.");
    test.equal(err.message,
      "Name 'NO-missing-SPACE-atx' of custom rule at index 0 is " +
        "already used as a name or tag.",
      "Incorrect message for duplicate name.");
    test.ok(!result, "Got result for duplicate name.");
    test.done();
  });
};

module.exports.customRulesUsedNameTag =
function customRulesUsedNameTag(test) {
  test.expect(4);
  markdownlint({
    "customRules": [
      {
        "names": [ "name", "HtMl" ],
        "description": "description",
        "tags": [ "tag" ],
        "function": function noop() {}
      }
    ]
  }, function callback(err, result) {
    test.ok(err, "Did not get an error for duplicate name.");
    test.ok(err instanceof Error, "Error not instance of Error.");
    test.equal(err.message,
      "Name 'HtMl' of custom rule at index 0 is already used as a name or tag.",
      "Incorrect message for duplicate name.");
    test.ok(!result, "Got result for duplicate name.");
    test.done();
  });
};

module.exports.customRulesUsedTagName =
function customRulesUsedTagName(test) {
  test.expect(4);
  markdownlint({
    "customRules": [
      {
        "names": [ "filler" ],
        "description": "description",
        "tags": [ "tag" ],
        "function": function noop() {}
      },
      {
        "names": [ "name" ],
        "description": "description",
        "tags": [ "tag", "NO-missing-SPACE-atx" ],
        "function": function noop() {}
      }
    ]
  }, function callback(err, result) {
    test.ok(err, "Did not get an error for duplicate tag.");
    test.ok(err instanceof Error, "Error not instance of Error.");
    test.equal(err.message,
      "Tag 'NO-missing-SPACE-atx' of custom rule at index 1 is " +
        "already used as a name.",
      "Incorrect message for duplicate name.");
    test.ok(!result, "Got result for duplicate tag.");
    test.done();
  });
};

module.exports.customRulesThrowForFile =
function customRulesThrowForFile(test) {
  test.expect(4);
  const exceptionMessage = "Test exception message";
  markdownlint({
    "customRules": [
      {
        "names": [ "name" ],
        "description": "description",
        "tags": [ "tag" ],
        "function": function throws() {
          throw new Error(exceptionMessage);
        }
      }
    ],
    "files": [ "./test/custom-rules.md" ]
  }, function callback(err, result) {
    test.ok(err, "Did not get an error for function thrown.");
    test.ok(err instanceof Error, "Error not instance of Error.");
    test.equal(err.message, exceptionMessage,
      "Incorrect message for function thrown.");
    test.ok(!result, "Got result for function thrown.");
    test.done();
  });
};

module.exports.customRulesThrowForFileSync =
function customRulesThrowForFileSync(test) {
  test.expect(4);
  const exceptionMessage = "Test exception message";
  test.throws(function customRuleThrowsCall() {
    markdownlint.sync({
      "customRules": [
        {
          "names": [ "name" ],
          "description": "description",
          "tags": [ "tag" ],
          "function": function throws() {
            throw new Error(exceptionMessage);
          }
        }
      ],
      "files": [ "./test/custom-rules.md" ]
    });
  }, function testError(err) {
    test.ok(err, "Did not get an error for function thrown.");
    test.ok(err instanceof Error, "Error not instance of Error.");
    test.equal(err.message, exceptionMessage,
      "Incorrect message for function thrown.");
    return true;
  }, "Did not get exception for function thrown.");
  test.done();
};

module.exports.customRulesThrowForString =
function customRulesThrowForString(test) {
  test.expect(4);
  const exceptionMessage = "Test exception message";
  markdownlint({
    "customRules": [
      {
        "names": [ "name" ],
        "description": "description",
        "tags": [ "tag" ],
        "function": function throws() {
          throw new Error(exceptionMessage);
        }
      }
    ],
    "strings": {
      "string": "String"
    }
  }, function callback(err, result) {
    test.ok(err, "Did not get an error for function thrown.");
    test.ok(err instanceof Error, "Error not instance of Error.");
    test.equal(err.message, exceptionMessage,
      "Incorrect message for function thrown.");
    test.ok(!result, "Got result for function thrown.");
    test.done();
  });
};

module.exports.customRulesOnErrorNull = function customRulesOnErrorNull(test) {
  test.expect(4);
  const options = {
    "customRules": [
      {
        "names": [ "name" ],
        "description": "description",
        "tags": [ "tag" ],
        "function": function onErrorNull(params, onError) {
          onError(null);
        }
      }
    ],
    "strings": {
      "string": "String"
    }
  };
  test.throws(function badErrorCall() {
    markdownlint.sync(options);
  }, function testError(err) {
    test.ok(err, "Did not get an error for null object.");
    test.ok(err instanceof Error, "Error not instance of Error.");
    test.equal(err.message,
      "Property 'lineNumber' of onError parameter is incorrect.",
      "Incorrect message for bad object.");
    return true;
  }, "Did not get exception for null object.");
  test.done();
};

module.exports.customRulesOnErrorBad = function customRulesOnErrorBad(test) {
  test.expect(44);
  [
    [ "lineNumber", [ null, "string" ] ],
    [ "detail", [ 10, [] ] ],
    [ "context", [ 10, [] ] ],
    [ "range", [ 10, [], [ 10 ], [ 10, null ], [ 10, 11, 12 ] ] ]
  ].forEach(function forProperty(property) {
    const propertyName = property[0];
    property[1].forEach(function forPropertyValue(propertyValue) {
      const badObject = {
        "lineNumber": 1
      };
      badObject[propertyName] = propertyValue;
      const options = {
        "customRules": [
          {
            "names": [ "name" ],
            "description": "description",
            "tags": [ "tag" ],
            "function": function onErrorBad(params, onError) {
              onError(badObject);
            }
          }
        ],
        "strings": {
          "string": "String"
        }
      };
      test.throws(function badErrorCall() {
        markdownlint.sync(options);
      }, function testError(err) {
        test.ok(err, "Did not get an error for bad object.");
        test.ok(err instanceof Error, "Error not instance of Error.");
        test.equal(err.message,
          "Property '" + propertyName + "' of onError parameter is incorrect.",
          "Incorrect message for bad object.");
        return true;
      }, "Did not get exception for bad object.");
    });
  });
  test.done();
};

module.exports.customRulesOnErrorLazy = function customRulesOnErrorLazy(test) {
  test.expect(2);
  const options = {
    "customRules": [
      {
        "names": [ "name" ],
        "description": "description",
        "tags": [ "tag" ],
        "function": function onErrorNull(params, onError) {
          onError({
            "lineNumber": 1,
            "detail": "",
            "context": "",
            "range": [ 0, 0 ]
          });
        }
      }
    ],
    "strings": {
      "string": "# Heading"
    }
  };
  markdownlint(options, function callback(err, actualResult) {
    test.ifError(err);
    const expectedResult = {
      "string": [
        {
          "lineNumber": 1,
          "ruleNames": [ "name" ],
          "ruleDescription": "description",
          "errorDetail": null,
          "errorContext": null,
          "errorRange": [ 0, 0 ]
        }
      ]
    };
    test.deepEqual(actualResult, expectedResult, "Undetected issues.");
    test.done();
  });
};

module.exports.customRulesFileName = function customRulesFileName(test) {
  test.expect(2);
  const options = {
    "customRules": [
      {
        "names": [ "name" ],
        "description": "description",
        "tags": [ "tag" ],
        "function": function stringName(params) {
          test.equal(params.name, "doc/CustomRules.md", "Incorrect file name");
        }
      }
    ],
    "files": "doc/CustomRules.md"
  };
  markdownlint(options, function callback(err) {
    test.ifError(err);
    test.done();
  });
};

module.exports.customRulesStringName = function customRulesStringName(test) {
  test.expect(2);
  const options = {
    "customRules": [
      {
        "names": [ "name" ],
        "description": "description",
        "tags": [ "tag" ],
        "function": function stringName(params) {
          test.equal(params.name, "string", "Incorrect string name");
        }
      }
    ],
    "strings": {
      "string": "# Heading"
    }
  };
  markdownlint(options, function callback(err) {
    test.ifError(err);
    test.done();
  });
};

module.exports.customRulesDoc = function customRulesDoc(test) {
  test.expect(2);
  markdownlint({
    "files": "doc/CustomRules.md",
    "config": {
      "MD013": { "line_length": 200 }
    }
  }, function callback(err, actual) {
    test.ifError(err);
    const expected = { "doc/CustomRules.md": [] };
    test.deepEqual(actual, expected, "Unexpected issues.");
    test.done();
  });
};
