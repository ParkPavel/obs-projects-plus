const yaml = require('../__mocks__/yaml.js');

console.log('Testing with PLAIN mode:');
console.log('key:value ->', JSON.stringify(yaml.stringify({ test: 'key:value' }, { defaultStringType: 'PLAIN' })));
console.log('Title- ->', JSON.stringify(yaml.stringify({ test: 'Title-' }, { defaultStringType: 'PLAIN' })));
console.log('-Title ->', JSON.stringify(yaml.stringify({ test: '-Title' }, { defaultStringType: 'PLAIN' })));
console.log('foo, bar, baz ->', JSON.stringify(yaml.stringify({ test: 'foo, bar, baz' }, { defaultStringType: 'PLAIN' })));
console.log('Notes: Who Needs Them? ->', JSON.stringify(yaml.stringify({ test: 'Notes: Who Needs Them?' }, { defaultStringType: 'PLAIN' })));
console.log('- Title ->', JSON.stringify(yaml.stringify({ test: '- Title' }, { defaultStringType: 'PLAIN' })));
console.log('key: ->', JSON.stringify(yaml.stringify({ test: 'key:' }, { defaultStringType: 'PLAIN' })));

console.log('\nTesting with QUOTE_DOUBLE mode:');
console.log('key:value ->', JSON.stringify(yaml.stringify({ test: 'key:value' }, { defaultStringType: 'QUOTE_DOUBLE' })));