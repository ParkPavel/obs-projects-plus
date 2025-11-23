const yaml = require('../__mocks__/yaml.js');

// Test the current stringify function
console.log('Testing stringify function:');
console.log('PLAIN mode:');
console.log('key:value ->', JSON.stringify(yaml.stringify({ test: 'key:value' }, { defaultStringType: 'PLAIN' })));
console.log('Title- ->', JSON.stringify(yaml.stringify({ test: 'Title-' }, { defaultStringType: 'PLAIN' })));
console.log('-Title ->', JSON.stringify(yaml.stringify({ test: '-Title' }, { defaultStringType: 'PLAIN' })));
console.log('foo, bar, baz ->', JSON.stringify(yaml.stringify({ test: 'foo, bar, baz' }, { defaultStringType: 'PLAIN' })));
console.log('Notes: Who Needs Them? ->', JSON.stringify(yaml.stringify({ test: 'Notes: Who Needs Them?' }, { defaultStringType: 'PLAIN' })));
console.log('- Title ->', JSON.stringify(yaml.stringify({ test: '- Title' }, { defaultStringType: 'PLAIN' })));
console.log('key: ->', JSON.stringify(yaml.stringify({ test: 'key:' }, { defaultStringType: 'PLAIN' })));
console.log('long dash string ->', JSON.stringify(yaml.stringify({ test: '-----------------------------------------------------------------------------------' }, { defaultStringType: 'PLAIN' })));

console.log('\nQUOTE_DOUBLE mode:');
console.log('key:value ->', JSON.stringify(yaml.stringify({ test: 'key:value' }, { defaultStringType: 'QUOTE_DOUBLE' })));